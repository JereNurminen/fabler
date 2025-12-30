use crate::db::Database;
use crate::error::AppResult;
use std::path::PathBuf;
use tauri::Manager;

pub async fn setup_database(app_handle: &tauri::AppHandle) -> AppResult<Database> {
    let db_dir = app_handle
        .path()
        .app_data_dir()
        .expect("failed to get path to database");

    std::fs::create_dir_all(&db_dir)?;

    let db_path: PathBuf = db_dir.join("story_nodes.db");
    let db_url = format!(
        "sqlite://{}?mode=rwc",
        db_path.to_str().ok_or("Invalid database path")?
    );

    let database = Database::new(&db_url).await?;
    sqlx::migrate!("./migrations").run(&database.pool).await?;

    Ok(database)
}
