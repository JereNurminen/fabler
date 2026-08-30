use std::sync::Mutex;

use tauri::State;

use shared::models::{Page, PageListItem, Story};

use crate::project::Project;

pub struct ProjectState(pub Mutex<Option<Project>>);

fn with_project<T>(
    state: &State<ProjectState>,
    f: impl FnOnce(&Project) -> crate::error::AppResult<T>,
) -> Result<T, String> {
    let lock = state.0.lock().unwrap();
    let project = lock.as_ref().ok_or_else(|| "No project open".to_string())?;
    f(project).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_project(state: State<ProjectState>, story_json_path: String) -> Result<Story, String> {
    let project = Project::open(&story_json_path).map_err(|e| e.to_string())?;
    let story = project.story();
    *state.0.lock().unwrap() = Some(project);
    Ok(story)
}

#[tauri::command]
pub fn create_project(
    state: State<ProjectState>,
    dir_path: String,
    title: String,
) -> Result<Story, String> {
    let project = Project::create(&dir_path, &title).map_err(|e| e.to_string())?;
    let story = project.story();
    *state.0.lock().unwrap() = Some(project);
    Ok(story)
}

#[tauri::command]
pub fn close_project(state: State<ProjectState>) -> Result<(), String> {
    *state.0.lock().unwrap() = None;
    Ok(())
}

#[tauri::command]
pub fn get_story(state: State<ProjectState>) -> Result<Story, String> {
    with_project(&state, |p| Ok(p.story()))
}

#[tauri::command]
pub fn save_story(state: State<ProjectState>, story: Story) -> Result<(), String> {
    with_project(&state, |p| p.save_story(story.clone()))
}

#[tauri::command]
pub fn list_pages(state: State<ProjectState>) -> Result<Vec<PageListItem>, String> {
    with_project(&state, |p| p.list_pages())
}

#[tauri::command]
pub fn get_page(state: State<ProjectState>, id: String) -> Result<Page, String> {
    with_project(&state, |p| p.read_page(&id))
}

#[tauri::command]
pub fn save_page(state: State<ProjectState>, page: Page) -> Result<(), String> {
    with_project(&state, |p| p.save_page(&page))
}

#[tauri::command]
pub fn create_page(state: State<ProjectState>, name: String) -> Result<Page, String> {
    with_project(&state, |p| p.create_page(&name))
}

#[tauri::command]
pub fn delete_page(state: State<ProjectState>, id: String) -> Result<(), String> {
    with_project(&state, |p| p.delete_page(&id))
}

#[tauri::command]
pub fn export_bundle(state: State<ProjectState>, output_path: String) -> Result<(), String> {
    with_project(&state, |p| p.export_bundle(&output_path))
}

#[tauri::command]
pub fn validate_story(state: State<ProjectState>) -> Result<shared::validation::Report, String> {
    with_project(&state, |p| p.validate())
}

#[tauri::command]
pub fn copy_asset(source_path: String, state: State<ProjectState>) -> Result<String, String> {
    with_project(&state, |p| p.copy_asset(&source_path))
}

#[tauri::command]
pub fn get_project_assets_dir(state: State<ProjectState>) -> Result<String, String> {
    with_project(&state, |p| {
        Ok(p.get_assets_dir().to_string_lossy().to_string())
    })
}

#[tauri::command]
pub fn list_assets(state: State<ProjectState>) -> Result<Vec<String>, String> {
    with_project(&state, |p| p.list_assets())
}

#[tauri::command]
pub fn delete_asset(filename: String, state: State<ProjectState>) -> Result<(), String> {
    with_project(&state, |p| p.delete_asset(&filename))
}
