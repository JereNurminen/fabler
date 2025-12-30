use crate::db::Database;
use crate::models::{CreateFlag, FlagPatch, SetChoiceCondition, SetFlagOperation};
use shared::models::{ChoiceCondition, Flag, FlagOperation};
use tauri::State;

// ===== Flag CRUD =====

#[tauri::command]
#[specta::specta]
pub async fn get_story_flags(story_id: i64, db: State<'_, Database>) -> Result<Vec<Flag>, String> {
    db.get_flags_for_story(story_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
#[specta::specta]
pub async fn create_flag(create: CreateFlag, db: State<'_, Database>) -> Result<i64, String> {
    db.create_flag(create).await.map_err(Into::into)
}

#[tauri::command]
#[specta::specta]
pub async fn patch_flag(patch: FlagPatch, db: State<'_, Database>) -> Result<(), String> {
    db.patch_flag(patch.id, patch).await.map_err(Into::into)
}

#[tauri::command]
#[specta::specta]
pub async fn delete_flag(id: i64, db: State<'_, Database>) -> Result<(), String> {
    db.delete_flag(id).await.map_err(Into::into)
}

// ===== Flag Operations =====

#[tauri::command]
#[specta::specta]
pub async fn set_flag_operation(
    op: SetFlagOperation,
    db: State<'_, Database>,
) -> Result<i64, String> {
    db.set_flag_operation(op).await.map_err(Into::into)
}

#[tauri::command]
#[specta::specta]
pub async fn remove_flag_operation(
    choice_id: Option<i64>,
    page_id: Option<i64>,
    flag_id: i64,
    db: State<'_, Database>,
) -> Result<(), String> {
    db.remove_flag_operation(choice_id, page_id, flag_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
#[specta::specta]
pub async fn get_choice_flag_operations(
    choice_id: i64,
    db: State<'_, Database>,
) -> Result<Vec<FlagOperation>, String> {
    db.get_choice_flag_operations(choice_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
#[specta::specta]
pub async fn get_page_flag_operations(
    page_id: i64,
    db: State<'_, Database>,
) -> Result<Vec<FlagOperation>, String> {
    db.get_page_flag_operations(page_id)
        .await
        .map_err(Into::into)
}

// ===== Choice Conditions =====

#[tauri::command]
#[specta::specta]
pub async fn set_choice_condition(
    cond: SetChoiceCondition,
    db: State<'_, Database>,
) -> Result<i64, String> {
    db.set_choice_condition(cond).await.map_err(Into::into)
}

#[tauri::command]
#[specta::specta]
pub async fn remove_choice_condition(
    choice_id: i64,
    flag_id: i64,
    db: State<'_, Database>,
) -> Result<(), String> {
    db.remove_choice_condition(choice_id, flag_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
#[specta::specta]
pub async fn get_choice_conditions(
    choice_id: i64,
    db: State<'_, Database>,
) -> Result<Vec<ChoiceCondition>, String> {
    db.get_choice_conditions(choice_id)
        .await
        .map_err(Into::into)
}
