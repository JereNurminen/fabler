use futures::stream::FuturesUnordered;
use futures::StreamExt;
use serde::{Deserialize, Serialize};
use specta::Type;
use sqlx::{
    sqlite::{SqlitePool, SqliteQueryResult},
    Error, Row,
};

use shared::models::{Choice, Page, Story, StoryId, StoryListing};

#[derive(Serialize, Deserialize, Debug, Clone, Type)]
pub struct PagePatch {
    pub id: i64,
    pub name: Option<String>,
    pub body: Option<String>,
}

pub struct Database {
    pub pool: SqlitePool,
}

impl Database {
    pub async fn new(db_url: &str) -> Result<Self, Error> {
        let pool = SqlitePool::connect(db_url).await?;
        Ok(Self { pool })
    }

    pub async fn get_story_list(&self) -> Result<Vec<StoryListing>, Error> {
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

    pub async fn create_page(&self, story_id: StoryId, name: String) -> Result<i64, Error> {
        let result = sqlx::query("INSERT INTO pages (name, content, story_id) VALUES (?, ?, ?)")
            .bind(&name)
            .bind("")
            .bind(story_id)
            .execute(&self.pool)
            .await?;

        Ok(result.last_insert_rowid())
    }

    pub async fn add_story(&self, title: &str) -> Result<StoryId, Error> {
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

    async fn fetch_choices_for_page(&self, page_id: i64) -> Result<Vec<Choice>, Error> {
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

    async fn build_page(&self, row: sqlx::sqlite::SqliteRow) -> Result<Page, Error> {
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

    pub async fn get_story(&self, id: StoryId) -> Result<Story, Error> {
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

    pub async fn delete_story(&self, id: StoryId) -> Result<SqliteQueryResult, Error> {
        sqlx::query("DELETE FROM stories WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
    }

    pub async fn get_page(&self, id: i64) -> Result<Option<Page>, Error> {
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

    pub async fn patch_page(&self, id: i64, patch: PagePatch) -> Result<SqliteQueryResult, Error> {
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
            return Ok(SqliteQueryResult::default());
        }

        let query = format!("UPDATE pages SET {} WHERE id = ?", updates.join(", "));

        let mut query_builder = sqlx::query(&query);

        for bind in binds {
            query_builder = query_builder.bind(bind);
        }
        query_builder = query_builder.bind(id);

        query_builder.execute(&self.pool).await
    }

    pub async fn reset_db(&self) -> Result<SqliteQueryResult, Error> {
        sqlx::query("DELETE FROM stories").execute(&self.pool).await
    }
}
