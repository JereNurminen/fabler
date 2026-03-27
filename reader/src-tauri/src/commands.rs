use tauri::State;
use crate::library::{Library, InstalledStory};
use crate::storage::{SaveStorage, SavedState, SlotInfo};
use shared::bundle::Manifest;

// -- Library commands --

#[tauri::command]
pub async fn list_stories(library: State<'_, Library>) -> Result<Vec<InstalledStory>, String> {
    library.list_stories().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn install_bundle(bundle_data: Vec<u8>, library: State<'_, Library>) -> Result<InstalledStory, String> {
    library.install_bundle(&bundle_data).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_manifest(story_id: String, library: State<'_, Library>) -> Result<Manifest, String> {
    library.get_manifest(&story_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_story(story_id: String, library: State<'_, Library>) -> Result<(), String> {
    library.delete_story(&story_id).map_err(|e| e.to_string())
}

// -- Save commands --

#[tauri::command]
pub async fn save_slot(
    story_id: String,
    slot_id: String,
    state: SavedState,
    storage: State<'_, SaveStorage>,
) -> Result<(), String> {
    storage.save_slot(&story_id, &slot_id, &state).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn load_slot(
    story_id: String,
    slot_id: String,
    storage: State<'_, SaveStorage>,
) -> Result<Option<SavedState>, String> {
    storage.load_slot(&story_id, &slot_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_slots(
    story_id: String,
    storage: State<'_, SaveStorage>,
) -> Result<Vec<SlotInfo>, String> {
    storage.list_slots(&story_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_slot(
    story_id: String,
    slot_id: String,
    storage: State<'_, SaveStorage>,
) -> Result<(), String> {
    storage.delete_slot(&story_id, &slot_id).map_err(|e| e.to_string())
}
