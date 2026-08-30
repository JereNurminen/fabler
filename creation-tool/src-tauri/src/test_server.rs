use axum::{extract::State as AxumState, response::Json, routing::post, Router};
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

    let project = Project::create(temp_dir.to_str().unwrap(), "Test Story")
        .expect("Failed to create test project");

    let state = Arc::new(AppState {
        project: Mutex::new(Some(project)),
    });

    let app = Router::new()
        .route("/api/invoke", post(invoke_handler))
        .layer(CorsLayer::very_permissive())
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3001")
        .await
        .expect("Failed to bind to port 3001");

    println!("Test server running on http://localhost:3001");
    axum::serve(listener, app).await.unwrap();
}

async fn invoke_handler(
    AxumState(state): AxumState<Arc<AppState>>,
    Json(body): Json<Value>,
) -> Result<Json<Value>, axum::http::StatusCode> {
    let cmd = body["cmd"]
        .as_str()
        .ok_or(axum::http::StatusCode::BAD_REQUEST)?;
    let args = &body["args"];

    let mut lock = state.project.lock().unwrap();

    // Commands that don't need a project
    if cmd == "test_reset" {
        let temp_dir = std::env::temp_dir().join("fabler-test-project");
        if temp_dir.exists() {
            let _ = std::fs::remove_dir_all(&temp_dir);
        }
        let project = Project::create(temp_dir.to_str().unwrap(), "Test Story").map_err(|e| {
            eprintln!("reset error: {e}");
            axum::http::StatusCode::INTERNAL_SERVER_ERROR
        })?;
        *lock = Some(project);
        return Ok(Json(json!(null)));
    }

    let project = lock
        .as_ref()
        .ok_or(axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;

    let result: Result<Value, String> = (|| -> Result<Value, String> {
        match cmd {
            "get_story" => Ok(json!(project.story())),

            "save_story" => {
                let story: Story =
                    serde_json::from_value(args["story"].clone()).map_err(|e| e.to_string())?;
                project.save_story(story).map_err(|e| e.to_string())?;
                Ok(json!(null))
            }

            "list_pages" => project
                .list_pages()
                .map(|p| json!(p))
                .map_err(|e| e.to_string()),

            "create_page" => {
                let name = args["name"].as_str().unwrap_or("New Page");
                project
                    .create_page(name)
                    .map(|p| json!(p))
                    .map_err(|e| e.to_string())
            }

            "get_page" => {
                let id = args["id"].as_str().ok_or("missing id".to_string())?;
                project
                    .read_page(id)
                    .map(|p| json!(p))
                    .map_err(|e| e.to_string())
            }

            "save_page" => {
                let page: Page =
                    serde_json::from_value(args["page"].clone()).map_err(|e| e.to_string())?;
                project.save_page(&page).map_err(|e| e.to_string())?;
                Ok(json!(null))
            }

            "list_assets" => project
                .list_assets()
                .map(|a| json!(a))
                .map_err(|e| e.to_string()),

            "delete_asset" => {
                let filename = args["filename"]
                    .as_str()
                    .ok_or("missing filename".to_string())?;
                project.delete_asset(filename).map_err(|e| e.to_string())?;
                Ok(json!(null))
            }

            "get_project_assets_dir" => Ok(json!(project.get_assets_dir().to_string_lossy())),

            "validate_story" => project
                .validate()
                .map(|r| json!(r))
                .map_err(|e| e.to_string()),

            "get_story_graph" => project
                .story_graph()
                .map(|g| json!(g))
                .map_err(|e| e.to_string()),

            "clear_editor_positions" => {
                project
                    .clear_editor_positions()
                    .map_err(|e| e.to_string())?;
                Ok(json!(null))
            }

            // Export in test mode writes to a fixed temp path so e2e can
            // assert on blocked vs successful export. Safe because
            // playwright.config.ts pins `workers: 1, fullyParallel: false`.
            "export_bundle" => {
                let out = std::env::temp_dir().join("fabler-test-export.fabler");
                let _ = std::fs::remove_file(&out);
                project
                    .export_bundle(out.to_str().unwrap())
                    .map(|_| json!(null))
                    .map_err(|e| e.to_string())
            }

            _ => Err(format!("unknown command: {cmd}")),
        }
    })();

    match result {
        Ok(data) => Ok(Json(data)),
        Err(e) => {
            eprintln!("Error in {cmd}: {e}");
            Err(axum::http::StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}
