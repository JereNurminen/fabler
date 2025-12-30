use crate::db::Database;
use crate::models::StoryPatch;
use shared::models::{Story, StoryId, StoryListing, StoryOutline};
use tauri::State;

#[tauri::command]
#[specta::specta]
pub async fn get_stories(db: State<'_, Database>) -> Result<Vec<StoryListing>, String> {
    db.get_story_list().await.map_err(Into::into)
}

#[tauri::command]
#[specta::specta]
pub async fn add_story(name: String, db: State<'_, Database>) -> Result<StoryId, String> {
    db.add_story(&name).await.map_err(Into::into)
}

#[tauri::command]
#[specta::specta]
pub async fn get_story(id: i64, db: State<'_, Database>) -> Result<Story, String> {
    db.get_story(id).await.map_err(Into::into)
}

#[tauri::command]
#[specta::specta]
pub async fn get_story_outline(id: i64, db: State<'_, Database>) -> Result<StoryOutline, String> {
    db.get_story_outline(id).await.map_err(Into::into)
}

#[tauri::command]
#[specta::specta]
pub async fn delete_story(id: i64, db: State<'_, Database>) -> Result<(), String> {
    db.delete_story(id).await.map_err(Into::into)
}

#[tauri::command]
#[specta::specta]
pub async fn patch_story(patch: StoryPatch, db: State<'_, Database>) -> Result<(), String> {
    db.patch_story(patch.id, patch).await.map_err(Into::into)
}

#[tauri::command]
#[specta::specta]
pub async fn export_story_toml(story_id: i64, db: State<'_, Database>) -> Result<String, String> {
    // Get exported story structure
    let exported = db
        .export_story(story_id)
        .await
        .map_err(|e| format!("Failed to export story: {}", e))?;

    // Serialize to TOML
    let toml_string = toml::to_string_pretty(&exported)
        .map_err(|e| format!("Failed to serialize to TOML: {}", e))?;

    Ok(toml_string)
}

#[tauri::command]
#[specta::specta]
pub fn get_toml_schema() -> String {
    crate::schema::generate_toml_schema()
}
