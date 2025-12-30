mod stories;
mod pages;
mod choices;
mod flags;

use sqlx::sqlite::SqlitePool;
use crate::error::AppResult;

pub struct Database {
    pub pool: SqlitePool,
}

impl Database {
    pub async fn new(db_url: &str) -> AppResult<Self> {
        let pool = SqlitePool::connect(db_url).await?;
        Ok(Self { pool })
    }

    pub async fn reset_db(&self) -> AppResult<()> {
        sqlx::query("DELETE FROM stories")
            .execute(&self.pool)
            .await?;
        Ok(())
    }
}
