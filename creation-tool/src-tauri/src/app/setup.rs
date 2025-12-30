use crate::db::Database;
use crate::error::AppResult;

#[cfg(not(feature = "test-server"))]
use std::path::PathBuf;

#[cfg(not(feature = "test-server"))]
use tauri::Manager;

pub async fn setup_database(app_handle: &tauri::AppHandle) -> AppResult<Database> {
    // Use in-memory database for tests to avoid file locking issues
    #[cfg(feature = "test-server")]
    let db_url = "sqlite::memory:".to_string();

    #[cfg(not(feature = "test-server"))]
    let db_url = {
        let db_dir = app_handle
            .path()
            .app_data_dir()
            .expect("failed to get path to database");

        std::fs::create_dir_all(&db_dir)?;

        let db_path: PathBuf = db_dir.join("story_nodes.db");
        format!(
            "sqlite://{}?mode=rwc",
            db_path.to_str().ok_or("Invalid database path")?
        )
    };

    let database = Database::new(&db_url).await?;
    sqlx::migrate!("./migrations").run(&database.pool).await?;

    Ok(database)
}
