use crate::db::Database;
use crate::error::AppResult;
use crate::models::{CreateFlag, FlagPatch, SetChoiceCondition, SetFlagOperation};
use shared::models::{ChoiceCondition, Flag, FlagOperation};
use sqlx::Row;

impl Database {
    // ===== Flag CRUD =====

    pub async fn create_flag(&self, create: CreateFlag) -> AppResult<i64> {
        let result = sqlx::query(
            "INSERT INTO flags (story_id, name, default_value) VALUES (?, ?, ?)",
        )
        .bind(create.story_id)
        .bind(create.name)
        .bind(if create.default_value { 1 } else { 0 })
        .execute(&self.pool)
        .await?;

        Ok(result.last_insert_rowid())
    }

    pub async fn get_flags_for_story(&self, story_id: i64) -> AppResult<Vec<Flag>> {
        let rows = sqlx::query("SELECT id, story_id, name, default_value FROM flags WHERE story_id = ?")
            .bind(story_id)
            .fetch_all(&self.pool)
            .await?;

        Ok(rows
            .iter()
            .map(|row| Flag {
                id: row.get("id"),
                story_id: row.get("story_id"),
                name: row.get("name"),
                default_value: row.get::<i64, _>("default_value") != 0,
            })
            .collect())
    }

    pub async fn patch_flag(&self, id: i64, patch: FlagPatch) -> AppResult<()> {
        let mut updates = Vec::new();
        let mut name_bind = None;
        let mut default_value_bind = None;

        if let Some(name) = patch.name {
            updates.push("name = ?");
            name_bind = Some(name);
        }

        if let Some(default_value) = patch.default_value {
            updates.push("default_value = ?");
            default_value_bind = Some(if default_value { 1 } else { 0 });
        }

        if updates.is_empty() {
            return Ok(());
        }

        let query = format!("UPDATE flags SET {} WHERE id = ?", updates.join(", "));
        let mut query_builder = sqlx::query(&query);

        if let Some(name) = name_bind {
            query_builder = query_builder.bind(name);
        }

        if let Some(default_value) = default_value_bind {
            query_builder = query_builder.bind(default_value);
        }

        query_builder = query_builder.bind(id);
        query_builder.execute(&self.pool).await?;
        Ok(())
    }

    pub async fn delete_flag(&self, id: i64) -> AppResult<()> {
        sqlx::query("DELETE FROM flags WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    // ===== Flag Operations =====

    pub async fn set_flag_operation(&self, op: SetFlagOperation) -> AppResult<i64> {
        let result = if let Some(choice_id) = op.choice_id {
            // Choice flag operation
            sqlx::query(
                "INSERT INTO choice_flag_operations (choice_id, flag_id, operation)
                 VALUES (?, ?, ?)
                 ON CONFLICT(choice_id, flag_id)
                 DO UPDATE SET operation = excluded.operation",
            )
            .bind(choice_id)
            .bind(op.flag_id)
            .bind(op.operation)
            .execute(&self.pool)
            .await?
        } else if let Some(page_id) = op.page_id {
            // Page flag operation
            sqlx::query(
                "INSERT INTO page_flag_operations (page_id, flag_id, operation)
                 VALUES (?, ?, ?)
                 ON CONFLICT(page_id, flag_id)
                 DO UPDATE SET operation = excluded.operation",
            )
            .bind(page_id)
            .bind(op.flag_id)
            .bind(op.operation)
            .execute(&self.pool)
            .await?
        } else {
            return Err(crate::error::AppError::Custom(
                "Either choice_id or page_id must be provided".to_string(),
            ));
        };

        Ok(result.last_insert_rowid())
    }

    pub async fn remove_flag_operation(
        &self,
        choice_id: Option<i64>,
        page_id: Option<i64>,
        flag_id: i64,
    ) -> AppResult<()> {
        if let Some(choice_id) = choice_id {
            sqlx::query("DELETE FROM choice_flag_operations WHERE choice_id = ? AND flag_id = ?")
                .bind(choice_id)
                .bind(flag_id)
                .execute(&self.pool)
                .await?;
        } else if let Some(page_id) = page_id {
            sqlx::query("DELETE FROM page_flag_operations WHERE page_id = ? AND flag_id = ?")
                .bind(page_id)
                .bind(flag_id)
                .execute(&self.pool)
                .await?;
        } else {
            return Err(crate::error::AppError::Custom(
                "Either choice_id or page_id must be provided".to_string(),
            ));
        }
        Ok(())
    }

    pub async fn get_choice_flag_operations(&self, choice_id: i64) -> AppResult<Vec<FlagOperation>> {
        let rows = sqlx::query(
            "SELECT id, flag_id, operation FROM choice_flag_operations WHERE choice_id = ?",
        )
        .bind(choice_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(rows
            .iter()
            .map(|row| FlagOperation {
                id: row.get("id"),
                flag_id: row.get("flag_id"),
                operation: row.get("operation"),
            })
            .collect())
    }

    pub async fn get_page_flag_operations(&self, page_id: i64) -> AppResult<Vec<FlagOperation>> {
        let rows =
            sqlx::query("SELECT id, flag_id, operation FROM page_flag_operations WHERE page_id = ?")
                .bind(page_id)
                .fetch_all(&self.pool)
                .await?;

        Ok(rows
            .iter()
            .map(|row| FlagOperation {
                id: row.get("id"),
                flag_id: row.get("flag_id"),
                operation: row.get("operation"),
            })
            .collect())
    }

    // ===== Choice Conditions =====

    pub async fn set_choice_condition(&self, cond: SetChoiceCondition) -> AppResult<i64> {
        let result = sqlx::query(
            "INSERT INTO choice_conditions (choice_id, flag_id, required_value)
             VALUES (?, ?, ?)
             ON CONFLICT(choice_id, flag_id)
             DO UPDATE SET required_value = excluded.required_value",
        )
        .bind(cond.choice_id)
        .bind(cond.flag_id)
        .bind(if cond.required_value { 1 } else { 0 })
        .execute(&self.pool)
        .await?;

        Ok(result.last_insert_rowid())
    }

    pub async fn remove_choice_condition(&self, choice_id: i64, flag_id: i64) -> AppResult<()> {
        sqlx::query("DELETE FROM choice_conditions WHERE choice_id = ? AND flag_id = ?")
            .bind(choice_id)
            .bind(flag_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn get_choice_conditions(&self, choice_id: i64) -> AppResult<Vec<ChoiceCondition>> {
        let rows = sqlx::query(
            "SELECT id, flag_id, required_value FROM choice_conditions WHERE choice_id = ?",
        )
        .bind(choice_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(rows
            .iter()
            .map(|row| ChoiceCondition {
                id: row.get("id"),
                flag_id: row.get("flag_id"),
                required_value: row.get::<i64, _>("required_value") != 0,
            })
            .collect())
    }
}
