use axum::{
    extract::Path,
    extract::State as AxumState,
    http::StatusCode,
    response::Json,
    routing::{delete, get, post},
    Router,
};
use serde_json::{json, Value};
use std::sync::{Arc, Mutex};
use tower_http::cors::CorsLayer;

use shared::models::{Page, Story};

use crate::project::Project;

struct AppState {
    project: Mutex<Option<Project>>,
}

pub async fn start_test_server() {
    let temp_dir = std::env::temp_dir().join("fabler-test-project");
    if temp_dir.exists() {
        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    let project =
        Project::create(temp_dir.to_str().unwrap(), "Test Story").expect("Failed to create test project");

    let state = Arc::new(AppState {
        project: Mutex::new(Some(project)),
    });

    let app = Router::new()
        // Project
        .route("/api/story", get(get_story))
        .route("/api/story", post(save_story))
        // Pages
        .route("/api/pages", get(list_pages))
        .route("/api/pages", post(create_page))
        .route("/api/pages/:id", get(get_page))
        .route("/api/pages/:id", post(save_page))
        .route("/api/pages/:id", delete(delete_page))
        // Assets
        .route("/api/assets", get(list_assets))
        // Test setup helpers
        .route("/api/test/reset", post(reset_project))
        .layer(CorsLayer::very_permissive())
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3001")
        .await
        .expect("Failed to bind to port 3001");

    println!("Test server running on http://localhost:3001");
    axum::serve(listener, app).await.unwrap();
}

fn with_project<T: serde::Serialize>(
    state: &AppState,
    f: impl FnOnce(&Project) -> Result<T, String>,
) -> Result<Json<Value>, StatusCode> {
    let lock = state.project.lock().unwrap();
    let project = lock.as_ref().ok_or(StatusCode::INTERNAL_SERVER_ERROR)?;
    match f(project) {
        Ok(data) => Ok(Json(json!(data))),
        Err(e) => {
            eprintln!("Error: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn get_story(AxumState(state): AxumState<Arc<AppState>>) -> Result<Json<Value>, StatusCode> {
    with_project(&state, |p| Ok(p.story()))
}

async fn save_story(
    AxumState(state): AxumState<Arc<AppState>>,
    Json(story): Json<Story>,
) -> Result<Json<Value>, StatusCode> {
    let lock = state.project.lock().unwrap();
    let project = lock.as_ref().ok_or(StatusCode::INTERNAL_SERVER_ERROR)?;
    project
        .save_story(story)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!(null)))
}

async fn list_pages(AxumState(state): AxumState<Arc<AppState>>) -> Result<Json<Value>, StatusCode> {
    with_project(&state, |p| p.list_pages().map_err(|e| e.to_string()))
}

async fn create_page(
    AxumState(state): AxumState<Arc<AppState>>,
    Json(body): Json<Value>,
) -> Result<Json<Value>, StatusCode> {
    let name = body
        .as_str()
        .or_else(|| body.get("name").and_then(|n| n.as_str()))
        .unwrap_or("New Page");
    with_project(&state, |p| p.create_page(name).map_err(|e| e.to_string()))
}

async fn get_page(
    AxumState(state): AxumState<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<Value>, StatusCode> {
    eprintln!("GET /api/pages/{}", id);
    let result = with_project(&state, |p| p.read_page(&id).map_err(|e| e.to_string()));
    if result.is_err() {
        eprintln!("  -> ERROR");
    }
    result
}

async fn save_page(
    AxumState(state): AxumState<Arc<AppState>>,
    Path(_id): Path<String>,
    Json(page): Json<Page>,
) -> Result<Json<Value>, StatusCode> {
    let lock = state.project.lock().unwrap();
    let project = lock.as_ref().ok_or(StatusCode::INTERNAL_SERVER_ERROR)?;
    project
        .save_page(&page)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!(null)))
}

async fn delete_page(
    AxumState(state): AxumState<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<Value>, StatusCode> {
    let lock = state.project.lock().unwrap();
    let project = lock.as_ref().ok_or(StatusCode::INTERNAL_SERVER_ERROR)?;
    project
        .delete_page(&id)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!(null)))
}

async fn list_assets(
    AxumState(state): AxumState<Arc<AppState>>,
) -> Result<Json<Value>, StatusCode> {
    with_project(&state, |p| p.list_assets().map_err(|e| e.to_string()))
}

async fn reset_project(
    AxumState(state): AxumState<Arc<AppState>>,
) -> Result<Json<Value>, StatusCode> {
    let temp_dir = std::env::temp_dir().join("fabler-test-project");
    if temp_dir.exists() {
        let _ = std::fs::remove_dir_all(&temp_dir);
    }
    let project = Project::create(temp_dir.to_str().unwrap(), "Test Story")
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    *state.project.lock().unwrap() = Some(project);
    Ok(Json(json!(null)))
}
