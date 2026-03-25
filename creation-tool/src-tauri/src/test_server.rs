#[cfg(feature = "test-server")]
use crate::db::Database;
use axum::{
    extract::{Json, Path, State as AxumState},
    http::StatusCode,
    routing::{delete, get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};

#[derive(Clone)]
pub struct AppState {
    pub db: Arc<Database>,
}

#[derive(Serialize)]
struct ApiResponse<T> {
    status: String,
    data: Option<T>,
    error: Option<String>,
}

impl<T: Serialize> ApiResponse<T> {
    fn ok(data: T) -> Self {
        Self {
            status: "ok".to_string(),
            data: Some(data),
            error: None,
        }
    }

    fn error(msg: String) -> Self {
        Self {
            status: "error".to_string(),
            data: None,
            error: Some(msg),
        }
    }
}

// Story endpoints
async fn get_stories(
    AxumState(state): AxumState<AppState>,
) -> Result<Json<ApiResponse<Vec<shared::models::StoryListing>>>, StatusCode> {
    match state.db.get_story_list().await {
        Ok(stories) => Ok(Json(ApiResponse::ok(stories))),
        Err(e) => Ok(Json(ApiResponse::error(e.to_string()))),
    }
}

async fn add_story(
    AxumState(state): AxumState<AppState>,
    Json(payload): Json<serde_json::Value>,
) -> Result<Json<ApiResponse<i64>>, StatusCode> {
    let name = payload
        .as_str()
        .ok_or(StatusCode::BAD_REQUEST)?
        .to_string();

    match state.db.add_story(&name).await {
        Ok(id) => Ok(Json(ApiResponse::ok(id))),
        Err(e) => Ok(Json(ApiResponse::error(e.to_string()))),
    }
}

async fn get_story(
    AxumState(state): AxumState<AppState>,
    Path(id): Path<i64>,
) -> Result<Json<ApiResponse<shared::models::Story>>, StatusCode> {
    match state.db.get_story(id).await {
        Ok(story) => Ok(Json(ApiResponse::ok(story))),
        Err(e) => Ok(Json(ApiResponse::error(e.to_string()))),
    }
}

async fn get_story_outline(
    AxumState(state): AxumState<AppState>,
    Path(id): Path<i64>,
) -> Result<Json<ApiResponse<shared::models::StoryOutline>>, StatusCode> {
    match state.db.get_story_outline(id).await {
        Ok(outline) => Ok(Json(ApiResponse::ok(outline))),
        Err(e) => Ok(Json(ApiResponse::error(e.to_string()))),
    }
}

async fn delete_story(
    AxumState(state): AxumState<AppState>,
    Path(id): Path<i64>,
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    match state.db.delete_story(id).await {
        Ok(_) => Ok(Json(ApiResponse::ok(()))),
        Err(e) => Ok(Json(ApiResponse::error(e.to_string()))),
    }
}

async fn patch_story(
    AxumState(state): AxumState<AppState>,
    Json(patch): Json<crate::models::StoryPatch>,
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    match state.db.patch_story(patch.id, patch).await {
        Ok(_) => Ok(Json(ApiResponse::ok(()))),
        Err(e) => Ok(Json(ApiResponse::error(e.to_string()))),
    }
}

async fn export_story_toml(
    AxumState(state): AxumState<AppState>,
    Path(id): Path<i64>,
) -> Result<Json<ApiResponse<String>>, StatusCode> {
    match state.db.export_story(id).await {
        Ok(exported) => match toml::to_string_pretty(&exported) {
            Ok(toml_string) => Ok(Json(ApiResponse::ok(toml_string))),
            Err(e) => Ok(Json(ApiResponse::error(e.to_string()))),
        },
        Err(e) => Ok(Json(ApiResponse::error(e.to_string()))),
    }
}

async fn import_story_toml(
    AxumState(state): AxumState<AppState>,
    Json(toml_content): Json<String>,
) -> Result<Json<ApiResponse<i64>>, StatusCode> {
    let exported: shared::export::ExportedStory = match toml::from_str(&toml_content) {
        Ok(e) => e,
        Err(e) => return Ok(Json(ApiResponse::error(format!("Failed to parse TOML: {}", e)))),
    };
    match state.db.import_story(exported).await {
        Ok(id) => Ok(Json(ApiResponse::ok(id))),
        Err(e) => Ok(Json(ApiResponse::error(e.to_string()))),
    }
}

async fn get_toml_schema() -> Json<ApiResponse<String>> {
    Json(ApiResponse::ok(crate::schema::generate_toml_schema()))
}

// Page endpoints
async fn get_page(
    AxumState(state): AxumState<AppState>,
    Path(id): Path<i64>,
) -> Result<Json<ApiResponse<shared::models::Page>>, StatusCode> {
    match state.db.get_page(id).await {
        Ok(Some(page)) => Ok(Json(ApiResponse::ok(page))),
        Ok(None) => Ok(Json(ApiResponse::error(format!("Page {} not found", id)))),
        Err(e) => Ok(Json(ApiResponse::error(e.to_string()))),
    }
}

async fn patch_page(
    AxumState(state): AxumState<AppState>,
    Json(patch): Json<crate::models::PagePatch>,
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    match state.db.patch_page(patch.id, patch).await {
        Ok(_) => Ok(Json(ApiResponse::ok(()))),
        Err(e) => Ok(Json(ApiResponse::error(e.to_string()))),
    }
}

async fn create_page(
    AxumState(state): AxumState<AppState>,
    Json(story_id): Json<i64>,
) -> Result<Json<ApiResponse<i64>>, StatusCode> {
    match state.db.create_page(story_id).await {
        Ok(id) => Ok(Json(ApiResponse::ok(id))),
        Err(e) => Ok(Json(ApiResponse::error(e.to_string()))),
    }
}

// Choice endpoints
#[derive(Deserialize)]
struct CreateChoiceRequest {
    page_id: i64,
    text: String,
    target_page_id: i64,
}

async fn create_choice(
    AxumState(state): AxumState<AppState>,
    Json(req): Json<CreateChoiceRequest>,
) -> Result<Json<ApiResponse<i64>>, StatusCode> {
    match state.db.create_choice(req.page_id, &req.text, req.target_page_id).await {
        Ok(id) => Ok(Json(ApiResponse::ok(id))),
        Err(e) => Ok(Json(ApiResponse::error(e.to_string()))),
    }
}

#[derive(Deserialize)]
struct DeleteChoiceRequest {
    id: i64,
}

async fn delete_choice(
    AxumState(state): AxumState<AppState>,
    Json(req): Json<DeleteChoiceRequest>,
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    match state.db.delete_choice(req.id).await {
        Ok(_) => Ok(Json(ApiResponse::ok(()))),
        Err(e) => Ok(Json(ApiResponse::error(e.to_string()))),
    }
}

async fn patch_choice(
    AxumState(state): AxumState<AppState>,
    Json(patch): Json<crate::models::ChoicePatch>,
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    match state.db.patch_choice(patch.id, patch).await {
        Ok(_) => Ok(Json(ApiResponse::ok(()))),
        Err(e) => Ok(Json(ApiResponse::error(e.to_string()))),
    }
}

// Flag endpoints
async fn get_story_flags(
    AxumState(state): AxumState<AppState>,
    Path(story_id): Path<i64>,
) -> Result<Json<ApiResponse<Vec<shared::models::Flag>>>, StatusCode> {
    match state.db.get_flags_for_story(story_id).await {
        Ok(flags) => Ok(Json(ApiResponse::ok(flags))),
        Err(e) => Ok(Json(ApiResponse::error(e.to_string()))),
    }
}

async fn create_flag(
    AxumState(state): AxumState<AppState>,
    Json(flag): Json<crate::models::CreateFlag>,
) -> Result<Json<ApiResponse<i64>>, StatusCode> {
    match state.db.create_flag(flag).await {
        Ok(id) => Ok(Json(ApiResponse::ok(id))),
        Err(e) => Ok(Json(ApiResponse::error(e.to_string()))),
    }
}

async fn patch_flag(
    AxumState(state): AxumState<AppState>,
    Json(patch): Json<crate::models::FlagPatch>,
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    match state.db.patch_flag(patch.id, patch).await {
        Ok(_) => Ok(Json(ApiResponse::ok(()))),
        Err(e) => Ok(Json(ApiResponse::error(e.to_string()))),
    }
}

async fn delete_flag(
    AxumState(state): AxumState<AppState>,
    Path(id): Path<i64>,
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    match state.db.delete_flag(id).await {
        Ok(_) => Ok(Json(ApiResponse::ok(()))),
        Err(e) => Ok(Json(ApiResponse::error(e.to_string()))),
    }
}

async fn set_flag_operation(
    AxumState(state): AxumState<AppState>,
    Json(op): Json<crate::models::SetFlagOperation>,
) -> Result<Json<ApiResponse<i64>>, StatusCode> {
    match state.db.set_flag_operation(op).await {
        Ok(id) => Ok(Json(ApiResponse::ok(id))),
        Err(e) => Ok(Json(ApiResponse::error(e.to_string()))),
    }
}

#[derive(Deserialize)]
struct RemoveFlagOperationRequest {
    choice_id: Option<i64>,
    page_id: Option<i64>,
    flag_id: i64,
}

async fn remove_flag_operation(
    AxumState(state): AxumState<AppState>,
    Json(req): Json<RemoveFlagOperationRequest>,
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    match state.db.remove_flag_operation(req.choice_id, req.page_id, req.flag_id).await {
        Ok(_) => Ok(Json(ApiResponse::ok(()))),
        Err(e) => Ok(Json(ApiResponse::error(e.to_string()))),
    }
}

async fn set_choice_condition(
    AxumState(state): AxumState<AppState>,
    Json(cond): Json<crate::models::SetChoiceCondition>,
) -> Result<Json<ApiResponse<i64>>, StatusCode> {
    match state.db.set_choice_condition(cond).await {
        Ok(id) => Ok(Json(ApiResponse::ok(id))),
        Err(e) => Ok(Json(ApiResponse::error(e.to_string()))),
    }
}

#[derive(Deserialize)]
struct RemoveChoiceConditionRequest {
    choice_id: i64,
    flag_id: i64,
}

async fn remove_choice_condition(
    AxumState(state): AxumState<AppState>,
    Json(req): Json<RemoveChoiceConditionRequest>,
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    match state.db.remove_choice_condition(req.choice_id, req.flag_id).await {
        Ok(_) => Ok(Json(ApiResponse::ok(()))),
        Err(e) => Ok(Json(ApiResponse::error(e.to_string()))),
    }
}

pub fn create_router(db: Arc<Database>) -> Router {
    let state = AppState { db };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        // Story routes
        .route("/api/stories", get(get_stories))
        .route("/api/stories", post(add_story))
        .route("/api/stories/:id", get(get_story))
        .route("/api/stories/:id/outline", get(get_story_outline))
        .route("/api/stories/:id", delete(delete_story))
        .route("/api/stories/:id/flags", get(get_story_flags))
        .route("/api/stories/patch", post(patch_story))
        .route("/api/stories/:id/export", get(export_story_toml))
        .route("/api/stories/import", post(import_story_toml))
        .route("/api/schema", get(get_toml_schema))
        // Page routes
        .route("/api/pages/:id", get(get_page))
        .route("/api/pages/patch", post(patch_page))
        .route("/api/pages", post(create_page))
        // Choice routes
        .route("/api/choices", post(create_choice))
        .route("/api/choices/delete", post(delete_choice))
        .route("/api/choices/patch", post(patch_choice))
        // Flag routes
        .route("/api/flags", post(create_flag))
        .route("/api/flags/patch", post(patch_flag))
        .route("/api/flags/:id", delete(delete_flag))
        .route("/api/flags/operation", post(set_flag_operation))
        .route("/api/flags/operation/remove", post(remove_flag_operation))
        .route("/api/flags/condition", post(set_choice_condition))
        .route("/api/flags/condition/remove", post(remove_choice_condition))
        .layer(cors)
        .with_state(state)
}

pub async fn start_test_server(db: Arc<Database>, port: u16) -> Result<(), Box<dyn std::error::Error>> {
    let app = create_router(db);
    let addr = format!("127.0.0.1:{}", port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;

    println!("Test server listening on http://{}", addr);

    axum::serve(listener, app).await?;

    Ok(())
}
