use crate::db::Database;
use crate::error::AppResult;
use crate::models::PagePatch;
use shared::models::{Choice, Page, StoryId};
use sqlx::Row;

impl Database {
    pub async fn get_page(&self, id: i64) -> AppResult<Option<Page>> {
        let page = match sqlx::query("SELECT id, story_id, name, content FROM pages WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.pool)
            .await?
        {
            Some(row) => row,
            None => return Ok(None),
        };

        let page = self.build_page(page).await?;
        Ok(Some(page))
    }

    pub async fn create_page(&self, story_id: StoryId) -> AppResult<i64> {
        let result = sqlx::query(
            "INSERT INTO pages (name, content, story_id) VALUES (?, ?, ?) RETURNING id",
        )
        .bind("")
        .bind("")
        .bind(story_id)
        .execute(&self.pool)
        .await?;

        Ok(result.last_insert_rowid())
    }

    pub async fn patch_page(&self, id: i64, patch: PagePatch) -> AppResult<()> {
        let mut updates = Vec::new();
        let mut binds = Vec::new();

        if let Some(name) = patch.name {
            updates.push("name = ?");
            binds.push(name);
        }

        if let Some(body) = patch.body {
            updates.push("content = ?");
            binds.push(body);
        }

        if updates.is_empty() {
            return Ok(());
        }

        let query = format!("UPDATE pages SET {} WHERE id = ?", updates.join(", "));

        let mut query_builder = sqlx::query(&query);

        for bind in binds {
            query_builder = query_builder.bind(bind);
        }
        query_builder = query_builder.bind(id);

        query_builder.execute(&self.pool).await?;
        Ok(())
    }

    // Private helper methods
    pub(crate) async fn build_page(&self, row: sqlx::sqlite::SqliteRow) -> AppResult<Page> {
        let page_id: i64 = row.get("id");
        let choices = self.fetch_choices_for_page(page_id).await?;

        Ok(Page {
            id: page_id,
            story_id: row.get("story_id"),
            name: row.get("name"),
            body: row.get("content"),
            options: choices,
        })
    }

    async fn fetch_choices_for_page(&self, page_id: i64) -> AppResult<Vec<Choice>> {
        let rows =
            sqlx::query("SELECT id, page_id, text, target_page_id FROM choices WHERE page_id = ?")
                .bind(page_id)
                .fetch_all(&self.pool)
                .await?;

        Ok(rows
            .iter()
            .map(|row| Choice {
                id: row.get("id"),
                page_id: row.get("page_id"),
                text: row.get("text"),
                target_page: row.get("target_page_id"),
            })
            .collect())
    }
}
