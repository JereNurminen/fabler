#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod db;

use db::{ Database, PagePatch };
use shared::models::{ StoryId, Story, StoryListing, Page };

use std::path::PathBuf;
use tauri::async_runtime::spawn;
use tauri::Manager;
use tauri::State;
use specta_typescript::Typescript;
use specta_typescript::BigIntExportBehavior;
use tauri_specta::{collect_commands, Builder};

#[tauri::command]
#[specta::specta]
async fn get_story(id: i64, db: State<'_, Database>) -> Result<Story, ()> {
    let node = db.get_story(id).await;
    match node {
        Some(node) => Ok(node),
        None => Err(()),
    }
}

#[tauri::command]
#[specta::specta]
async fn get_stories(db: State<'_, Database>) -> Result<Vec<StoryListing>, ()> {
    let nodes = db.get_story_list().await;
    match nodes {
        Some(nodes) => Ok(nodes),
        None => Err(()),
    }
}

#[tauri::command]
#[specta::specta]
async fn add_story(name: String, db: State<'_, Database>) -> Result<StoryId, ()> {
    Ok(db.add_story(&name).await)
}

#[tauri::command]
#[specta::specta]
async fn delete_story(id: i64, db: State<'_, Database>) -> Result<(), ()> {
    db.delete_story(id).await;
    Ok(())
}

#[tauri::command]
#[specta::specta]
async fn get_page(id: i64, db: State<'_, Database>) -> Result<Page, ()> {
    let node = db.get_page(id).await;
    match node {
        Some(node) => Ok(node),
        None => Err(()),
    }
}

#[tauri::command]
#[specta::specta]
async fn patch_page(patch: PagePatch, db: State<'_, Database>) -> Result<(), ()> {
    db.patch_page(patch.id, patch).await;
    Ok(())
}


fn main() {
    let mut builder = Builder::<tauri::Wry>::new()
        .commands(collect_commands![get_stories, add_story, get_story, delete_story, get_page, patch_page]);
   
    builder
        .export(Typescript::default().bigint(BigIntExportBehavior::Number), "../src/bindings.ts")
        .expect("Failed to export typescript bindings");
   
    tauri::Builder::default()
        .setup(|app| {
            let app_handle = app.handle().clone();
            let db_dir = app_handle
                .path()
                .app_data_dir()
                .expect("Failed to get app data directory");
            std::fs::create_dir_all(&db_dir).expect("Failed to create database directory");

            let db_path: PathBuf = db_dir.join("story_nodes.db");

            let db_url = format!("sqlite://{}?mode=rwc", db_path.to_str().unwrap());

            spawn(async move {
                let db = Database::new(&db_url).await;
                sqlx::migrate!("./migrations").run(&db.pool).await.expect("Failed to run migrations");
                app_handle.manage(db);
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_stories, get_story, add_story, delete_story, get_page, patch_page])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
