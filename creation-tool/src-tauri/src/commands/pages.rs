use crate::db::Database;
use crate::models::PagePatch;
use shared::models::{Page, StoryId};
use tauri::State;

#[tauri::command]
#[specta::specta]
pub async fn get_page(id: i64, db: State<'_, Database>) -> Result<Page, String> {
    match db.get_page(id).await.map_err(String::from)? {
        Some(page) => Ok(page),
        None => Err("Page not found".to_string()),
    }
}

#[tauri::command]
#[specta::specta]
pub async fn patch_page(patch: PagePatch, db: State<'_, Database>) -> Result<(), String> {
    db.patch_page(patch.id, patch).await.map_err(Into::into)
}

#[tauri::command]
#[specta::specta]
pub async fn create_page(story_id: StoryId, db: State<'_, Database>) -> Result<i64, String> {
    db.create_page(story_id).await.map_err(Into::into)
}
