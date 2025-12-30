use crate::db::Database;
use crate::models::ChoicePatch;
use shared::models::PageId;
use tauri::State;

#[tauri::command]
#[specta::specta]
pub async fn create_choice(
    page_id: PageId,
    text: String,
    target_page_id: PageId,
    db: State<'_, Database>,
) -> Result<i64, String> {
    db.create_choice(page_id, &text, target_page_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
#[specta::specta]
pub async fn delete_choice(id: i64, db: State<'_, Database>) -> Result<(), String> {
    db.delete_choice(id).await.map_err(Into::into)
}

#[tauri::command]
#[specta::specta]
pub async fn patch_choice(patch: ChoicePatch, db: State<'_, Database>) -> Result<(), String> {
    db.patch_choice(patch.id, patch).await.map_err(Into::into)
}
