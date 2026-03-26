use crate::db::Database;
use crate::error::{AppError, AppResult};
use futures::{stream::FuturesUnordered, StreamExt};
use shared::export::{ExportedStory, StoryMetadata};
use shared::models::{PageListItem, Story, StoryId, StoryListing, StoryOutline};
use sqlx::Row;

impl Database {
    pub async fn get_story_list(&self) -> AppResult<Vec<StoryListing>> {
        let rows = sqlx::query("SELECT id, title FROM stories")
            .fetch_all(&self.pool)
            .await?;

        Ok(rows
            .iter()
            .map(|row| StoryListing {
                id: row.get("id"),
                title: row.get("title"),
            })
            .collect())
    }

    pub async fn get_story(&self, id: StoryId) -> AppResult<Story> {
        let story = sqlx::query("SELECT id, title, start_page FROM stories WHERE id = ?")
            .bind(id)
            .fetch_one(&self.pool)
            .await?;

        let pages_rows =
            sqlx::query("SELECT id, story_id, name, content FROM pages WHERE story_id = ?")
                .bind(id)
                .fetch_all(&self.pool)
                .await?;

        let mut futures = FuturesUnordered::new();
        for row in pages_rows {
            futures.push(self.build_page(row));
        }

        let mut pages = Vec::new();
        while let Some(page_result) = futures.next().await {
            pages.push(page_result?);
        }

        Ok(Story {
            id: story.get("id"),
            title: story.get("title"),
            start_page: story.get("start_page"),
            pages,
        })
    }

    pub async fn get_story_outline(&self, id: StoryId) -> AppResult<StoryOutline> {
        let story = sqlx::query("SELECT id, title, start_page FROM stories WHERE id = ?")
            .bind(id)
            .fetch_one(&self.pool)
            .await?;

        let pages_rows = sqlx::query("SELECT id, name FROM pages WHERE story_id = ?")
            .bind(id)
            .fetch_all(&self.pool)
            .await?;

        let pages = pages_rows
            .iter()
            .map(|row| PageListItem {
                id: row.get("id"),
                name: row.get("name"),
            })
            .collect();

        Ok(StoryOutline {
            id: story.get("id"),
            title: story.get("title"),
            start_page: story.get("start_page"),
            pages,
        })
    }

    pub async fn add_story(&self, title: &str) -> AppResult<StoryId> {
        let mut tx = self.pool.begin().await?;

        let result =
            sqlx::query("INSERT INTO stories (title, created_at) VALUES (?, CURRENT_TIMESTAMP)")
                .bind(title)
                .execute(&mut tx)
                .await?;

        let story_id = result.last_insert_rowid();

        let start_page_id =
            sqlx::query("INSERT INTO pages (name, content, story_id) VALUES (?, ?, ?)")
                .bind("Start")
                .bind("")
                .bind(story_id)
                .execute(&mut tx)
                .await?
                .last_insert_rowid();

        sqlx::query("UPDATE stories SET start_page = ? WHERE id = ?")
            .bind(start_page_id)
            .bind(story_id)
            .execute(&mut tx)
            .await?;

        tx.commit().await?;
        Ok(story_id)
    }

    pub async fn delete_story(&self, id: StoryId) -> AppResult<()> {
        sqlx::query("DELETE FROM stories WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn patch_story(&self, id: StoryId, patch: crate::models::StoryPatch) -> AppResult<()> {
        let mut updates = Vec::new();
        let mut title_bind = None;
        let mut start_page_bind = None;

        if let Some(title) = patch.title {
            updates.push("title = ?");
            title_bind = Some(title);
        }

        if let Some(start_page) = patch.start_page {
            updates.push("start_page = ?");
            start_page_bind = Some(start_page);
        }

        if updates.is_empty() {
            return Ok(());
        }

        let query = format!("UPDATE stories SET {} WHERE id = ?", updates.join(", "));
        let mut query_builder = sqlx::query(&query);

        if let Some(title) = title_bind {
            query_builder = query_builder.bind(title);
        }

        if let Some(start_page) = start_page_bind {
            query_builder = query_builder.bind(start_page);
        }

        query_builder = query_builder.bind(id);
        query_builder.execute(&self.pool).await?;
        Ok(())
    }

    pub async fn import_story(&self, exported: ExportedStory) -> AppResult<StoryId> {
        use std::collections::HashMap;

        let mut tx = self.pool.begin().await?;

        // Create the story
        let story_id = sqlx::query(
            "INSERT INTO stories (title, created_at) VALUES (?, CURRENT_TIMESTAMP)",
        )
        .bind(&exported.story.title)
        .execute(&mut tx)
        .await?
        .last_insert_rowid();

        // Insert pages and build old→new page ID mapping
        let mut page_id_map: HashMap<i64, i64> = HashMap::new();
        for page in &exported.pages {
            let new_page_id =
                sqlx::query("INSERT INTO pages (name, content, story_id) VALUES (?, ?, ?)")
                    .bind(&page.name)
                    .bind(&page.body)
                    .bind(story_id)
                    .execute(&mut tx)
                    .await?
                    .last_insert_rowid();
            page_id_map.insert(page.id, new_page_id);
        }

        // Set start_page using remapped ID
        let new_start_page = page_id_map
            .get(&exported.story.start_page)
            .ok_or_else(|| AppError::Custom("Start page ID not found in exported pages".into()))?;
        sqlx::query("UPDATE stories SET start_page = ? WHERE id = ?")
            .bind(new_start_page)
            .bind(story_id)
            .execute(&mut tx)
            .await?;

        // Insert flags and build old→new flag ID mapping
        let mut flag_id_map: HashMap<i64, i64> = HashMap::new();
        for flag in &exported.flags {
            let new_flag_id = sqlx::query(
                "INSERT INTO flags (story_id, name, default_value) VALUES (?, ?, ?)",
            )
            .bind(story_id)
            .bind(&flag.name)
            .bind(if flag.default_value { 1 } else { 0 })
            .execute(&mut tx)
            .await?
            .last_insert_rowid();
            flag_id_map.insert(flag.id, new_flag_id);
        }

        // Insert choices, flag operations, and conditions for each page
        for page in &exported.pages {
            let new_page_id = page_id_map[&page.id];

            // Page flag operations
            for op in &page.flag_operations {
                if let Some(&new_flag_id) = flag_id_map.get(&op.flag_id) {
                    sqlx::query(
                        "INSERT INTO page_flag_operations (page_id, flag_id, operation) VALUES (?, ?, ?)",
                    )
                    .bind(new_page_id)
                    .bind(new_flag_id)
                    .bind(&op.operation)
                    .execute(&mut tx)
                    .await?;
                }
            }

            // Choices
            for choice in &page.options {
                let new_target_page = page_id_map
                    .get(&choice.target_page)
                    .ok_or_else(|| {
                        AppError::Custom(format!(
                            "Choice target page {} not found in exported pages",
                            choice.target_page
                        ))
                    })?;

                let new_choice_id = sqlx::query(
                    "INSERT INTO choices (page_id, text, target_page_id) VALUES (?, ?, ?)",
                )
                .bind(new_page_id)
                .bind(&choice.text)
                .bind(new_target_page)
                .execute(&mut tx)
                .await?
                .last_insert_rowid();

                // Choice flag operations
                for op in &choice.flag_operations {
                    if let Some(&new_flag_id) = flag_id_map.get(&op.flag_id) {
                        sqlx::query(
                            "INSERT INTO choice_flag_operations (choice_id, flag_id, operation) VALUES (?, ?, ?)",
                        )
                        .bind(new_choice_id)
                        .bind(new_flag_id)
                        .bind(&op.operation)
                        .execute(&mut tx)
                        .await?;
                    }
                }

                // Choice conditions
                for cond in &choice.conditions {
                    if let Some(&new_flag_id) = flag_id_map.get(&cond.flag_id) {
                        sqlx::query(
                            "INSERT INTO choice_conditions (choice_id, flag_id, required_value) VALUES (?, ?, ?)",
                        )
                        .bind(new_choice_id)
                        .bind(new_flag_id)
                        .bind(if cond.required_value { 1 } else { 0 })
                        .execute(&mut tx)
                        .await?;
                    }
                }
            }
        }

        tx.commit().await?;
        Ok(story_id)
    }

    pub async fn export_story(&self, story_id: StoryId) -> AppResult<ExportedStory> {
        // Get complete story with all pages and choices
        let story = self.get_story(story_id).await?;

        // Get flags for this story
        let flags = self.get_flags_for_story(story_id).await?;

        let mut pages = story.pages;
        pages.sort_by_key(|p| p.id);

        Ok(ExportedStory {
            story: StoryMetadata {
                id: story.id,
                title: story.title.clone(),
                start_page: story.start_page,
            },
            flags,
            pages,
        })
    }
}
