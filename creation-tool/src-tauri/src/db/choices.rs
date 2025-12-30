use crate::db::Database;
use crate::error::AppResult;
use crate::models::ChoicePatch;

impl Database {
    pub async fn create_choice(&self, page_id: i64, text: &str, target_page_id: i64) -> AppResult<i64> {
        let result = sqlx::query(
            "INSERT INTO choices (page_id, text, target_page_id) VALUES (?, ?, ?) RETURNING id",
        )
        .bind(page_id)
        .bind(text)
        .bind(target_page_id)
        .execute(&self.pool)
        .await?;

        Ok(result.last_insert_rowid())
    }

    pub async fn delete_choice(&self, id: i64) -> AppResult<()> {
        sqlx::query("DELETE FROM choices WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn patch_choice(&self, id: i64, patch: ChoicePatch) -> AppResult<()> {
        let mut updates = Vec::new();
        let mut text_bind = None;
        let mut target_page_bind = None;

        if let Some(text) = patch.text {
            updates.push("text = ?");
            text_bind = Some(text);
        }

        if let Some(target_page) = patch.target_page {
            updates.push("target_page_id = ?");
            target_page_bind = Some(target_page);
        }

        if updates.is_empty() {
            return Ok(());
        }

        let query = format!("UPDATE choices SET {} WHERE id = ?", updates.join(", "));
        let mut query_builder = sqlx::query(&query);

        if let Some(text) = text_bind {
            query_builder = query_builder.bind(text);
        }

        if let Some(target_page) = target_page_bind {
            query_builder = query_builder.bind(target_page);
        }

        query_builder = query_builder.bind(id);

        query_builder.execute(&self.pool).await?;
        Ok(())
    }
}
