use futures::stream::FuturesUnordered;
use futures::StreamExt;
use serde::{Deserialize, Serialize};
use specta::Type;
use sqlx::sqlite::{SqlitePool, SqliteQueryResult};
use sqlx::Row;

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
    pub async fn new(db_url: &String) -> Self {
        // Connect to the SQLite database
        let pool = SqlitePool::connect(db_url)
            .await
            .expect("Failed to connect to the database");

        Database { pool }
    }

    pub async fn get_story_list(&self) -> Option<Vec<StoryListing>> {
        let story_listings_from_db = sqlx::query("SELECT id, title FROM stories;")
            .fetch_all(&self.pool)
            .await
            .ok()?;

        Some(
            story_listings_from_db
                .iter()
                .map(|row| StoryListing {
                    id: row.get(0),
                    title: row.get(1),
                })
                .collect(),
        )
    }

    pub async fn create_page(&self, story_id: StoryId, name: String) -> i64 {
        sqlx::query("INSERT INTO pages (name, content, story_id) VALUES (?, ?, ?);")
            .bind(name)
            .bind("")
            .bind(story_id)
            .execute(&self.pool)
            .await
            .expect("Failed to insert new page")
            .last_insert_rowid()
    }

    pub async fn add_story(&self, title: &String) -> StoryId {
        let story_id =
            sqlx::query("INSERT INTO stories (title, created_at) VALUES (?, CURRENT_TIMESTAMP);")
                .bind(title)
                .execute(&self.pool)
                .await
                .expect("Failed to insert new story")
                .last_insert_rowid();

        let start_page_id = self.create_page(story_id, "Start".to_string()).await;

        sqlx::query("UPDATE stories SET start_page = ? WHERE id = ?;")
            .bind(start_page_id)
            .bind(story_id)
            .execute(&self.pool)
            .await
            .expect("Failed to update story with start page");

        story_id
    }

    pub async fn get_story(&self, id: StoryId) -> Option<Story> {
        let story_from_db = sqlx::query("SELECT id, title, start_page FROM stories WHERE id = ?;")
            .bind(id)
            .fetch_one(&self.pool)
            .await
            .expect("Failed to fetch story from database");

        let pages_from_db =
            sqlx::query("SELECT id, story_id, name, content FROM pages WHERE story_id = ?;")
                .bind(id)
                .fetch_all(&self.pool)
                .await
                .expect("Failed to fetch pages for story");

        let mut pages = Vec::new();
        let mut fetch_futures = FuturesUnordered::new();

        for row in pages_from_db.iter() {
            // Spawn each future for fetching choices
            fetch_futures.push(async {
                let page_id: i64 = row.get(0);
                let choices_from_db = sqlx::query(
                    "SELECT id, page_id, text, target_page_id FROM choices WHERE page_id = ?;",
                )
                .bind(page_id)
                .fetch_all(&self.pool)
                .await
                .expect("Failed to fetch choices for page");

                // Synchronously map choices
                let choices = choices_from_db
                    .iter()
                    .map(|row| Choice {
                        id: row.get(0),
                        page_id: row.get(1),
                        text: row.get(2),
                        target_page: row.get(3),
                    })
                    .collect();

                // Create the page with its choices
                Page {
                    id: row.get(0),
                    story_id: row.get(1),
                    name: row.get(2),
                    body: row.get(3),
                    options: choices,
                }
            });
        }

        // Collect all the pages once the async operations complete
        while let Some(page) = fetch_futures.next().await {
            pages.push(page);
        }

        Some(Story {
            id: story_from_db.get(0),
            title: story_from_db.get(1),
            start_page: story_from_db.get(2),
            pages,
        })
    }

    pub async fn delete_story(&self, id: StoryId) -> SqliteQueryResult {
        sqlx::query("DELETE FROM stories WHERE id = ?;")
            .bind(id)
            .execute(&self.pool)
            .await
            .expect("Failed to delete story")
    }

    pub async fn get_page(&self, id: i64) -> Option<Page> {
        let page_from_db = sqlx::query("SELECT id, story_id, name, body FROM pages WHERE id = ?;")
            .bind(id)
            .fetch_one(&self.pool)
            .await
            .ok()?;

        let choices_from_db =
            sqlx::query("SELECT id, page_id, text, target_page_id FROM choices WHERE page_id = ?;")
                .bind(id)
                .fetch_all(&self.pool)
                .await
                .expect("Failed to fetch choices for page");

        let choices = choices_from_db
            .iter()
            .map(|row| Choice {
                id: row.get(0),
                page_id: row.get(1),
                text: row.get(2),
                target_page: row.get(3),
            })
            .collect();

        Some(Page {
            id: page_from_db.get(0),
            story_id: page_from_db.get(1),
            name: page_from_db.get(2),
            body: page_from_db.get(3),
            options: choices,
        })
    }

    pub async fn patch_page(&self, id: i64, patch: PagePatch) -> SqliteQueryResult {
        let mut query = "UPDATE pages SET ".to_string();
        let mut binds = Vec::new();

        if let Some(title) = patch.name {
            query.push_str("name = ?, ");
            binds.push(title);
        }

        if let Some(body) = patch.body {
            query.push_str("content = ?, ");
            binds.push(body);
        }

        query.truncate(query.len() - 2);

        query.push_str(" WHERE id = ?;");
        binds.push(id.to_string());

        let mut query_builder = sqlx::query(&query);

        for bind in binds {
            query_builder = query_builder.bind(bind);
        }

        query_builder
            .execute(&self.pool)
            .await
            .expect("Failed to patch page")
    }
}
