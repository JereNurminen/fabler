use crate::db::Database;
use crate::error::AppResult;
use futures::{stream::FuturesUnordered, StreamExt};
use shared::export::{
    ExportedChoice, ExportedChoiceCondition, ExportedFlag, ExportedFlagOperation, ExportedPage,
    ExportedStory, StoryMetadata,
};
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

    pub async fn export_story(&self, story_id: StoryId) -> AppResult<ExportedStory> {
        // Get complete story with all pages and choices
        let story = self.get_story(story_id).await?;

        // Get flags for this story
        let flags = self.get_flags_for_story(story_id).await?;
        let exported_flags: Vec<ExportedFlag> = flags
            .into_iter()
            .map(|flag| ExportedFlag {
                id: flag.id,
                name: flag.name,
                default_value: flag.default_value,
            })
            .collect();

        // Convert pages
        let exported_pages: Vec<ExportedPage> = story
            .pages
            .into_iter()
            .map(|page| {
                let choices = page
                    .options
                    .into_iter()
                    .map(|choice| ExportedChoice {
                        id: choice.id,
                        text: choice.text,
                        target: choice.target_page,
                        flag_operations: choice
                            .flag_operations
                            .into_iter()
                            .map(|op| ExportedFlagOperation {
                                flag_id: op.flag_id,
                                operation: op.operation,
                            })
                            .collect(),
                        conditions: choice
                            .conditions
                            .into_iter()
                            .map(|cond| ExportedChoiceCondition {
                                flag_id: cond.flag_id,
                                required_value: cond.required_value,
                            })
                            .collect(),
                    })
                    .collect();

                ExportedPage {
                    id: page.id,
                    name: page.name,
                    content: page.body,
                    choices,
                    flag_operations: page
                        .flag_operations
                        .into_iter()
                        .map(|op| ExportedFlagOperation {
                            flag_id: op.flag_id,
                            operation: op.operation,
                        })
                        .collect(),
                }
            })
            .collect();

        Ok(ExportedStory {
            story: StoryMetadata {
                id: story.id,
                title: story.title,
                start_page: story.start_page,
            },
            flags: exported_flags,
            pages: exported_pages,
        })
    }
}
