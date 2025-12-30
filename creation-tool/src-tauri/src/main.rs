#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod db;

use db::{Database, PagePatch, ChoicePatch};
use serde::Serialize;
use shared::models::{Page, PageId, Story, StoryId, StoryListing, StoryOutline};
use specta::Type;
use specta_typescript::{BigIntExportBehavior, Typescript};
use std::path::PathBuf;
use tauri::menu::{Menu, MenuItemBuilder, SubmenuBuilder};
use tauri::Emitter;
use tauri::{Manager, State};
use tauri_specta::{collect_commands, Builder};

#[derive(Debug, Serialize, Type)]
pub struct CommandError {
    message: String,
}

#[tauri::command]
#[specta::specta]
async fn get_story(id: i64, db: State<'_, Database>) -> Result<Story, String> {
    db.get_story(id).await.map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
async fn get_story_outline(id: i64, db: State<'_, Database>) -> Result<StoryOutline, String> {
    db.get_story_outline(id).await.map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
async fn get_stories(db: State<'_, Database>) -> Result<Vec<StoryListing>, String> {
    db.get_story_list().await.map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
async fn add_story(name: String, db: State<'_, Database>) -> Result<StoryId, String> {
    db.add_story(&name).await.map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
async fn delete_story(id: i64, db: State<'_, Database>) -> Result<(), String> {
    db.delete_story(id)
        .await
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
async fn get_page(id: i64, db: State<'_, Database>) -> Result<Page, String> {
    match db.get_page(id).await {
        Ok(Some(page)) => Ok(page),
        Ok(None) => Err("Page not found".to_string()),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
#[specta::specta]
async fn patch_page(patch: PagePatch, db: State<'_, Database>) -> Result<(), String> {
    db.patch_page(patch.id, patch)
        .await
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
async fn create_page(story_id: StoryId, db: State<'_, Database>) -> Result<i64, String> {
    db.create_page(story_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
async fn create_choice(
    page_id: PageId,
    text: String,
    target_page_id: PageId,
    db: State<'_, Database>,
) -> Result<i64, String> {
    db.create_choice(page_id, &text, target_page_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
async fn delete_choice(id: i64, db: State<'_, Database>) -> Result<(), String> {
    db.delete_choice(id)
        .await
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
async fn patch_choice(patch: ChoicePatch, db: State<'_, Database>) -> Result<(), String> {
    db.patch_choice(patch.id, patch)
        .await
        .map(|_| ())
        .map_err(|e| e.to_string())
}

async fn setup_database(
    app_handle: &tauri::AppHandle,
) -> Result<Database, Box<dyn std::error::Error>> {
    let db_dir = app_handle
        .path()
        .app_data_dir()
        .expect("failed to get path to database");

    std::fs::create_dir_all(&db_dir)?;

    let db_path: PathBuf = db_dir.join("story_nodes.db");
    let db_url = format!(
        "sqlite://{}?mode=rwc",
        db_path.to_str().ok_or("Invalid database path")?
    );

    let database = Database::new(&db_url).await?;

    sqlx::migrate!("./migrations").run(&database.pool).await?;

    Ok(database)
}

fn main() {
    let commands = collect_commands![
        get_stories,
        add_story,
        get_story,
        get_story_outline,
        delete_story,
        get_page,
        patch_page,
        create_page,
        create_choice,
        delete_choice,
        patch_choice
    ];

    Builder::<tauri::Wry>::new()
        .commands(commands)
        .export(
            Typescript::default().bigint(BigIntExportBehavior::Number),
            "../src/bindings.ts",
        )
        .expect("Failed to export typescript bindings");

    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle();

            tauri::async_runtime::block_on(async {
                match setup_database(&handle).await {
                    Ok(db) => {
                        handle.manage(db);
                        Ok::<(), Box<dyn std::error::Error>>(())
                    }
                    Err(e) => {
                        eprintln!("Failed to setup database: {}", e);
                        Err(e.into())
                    }
                }
            })?;

            let edit_submenu = SubmenuBuilder::new(handle, "Edit")
                .cut()
                .copy()
                .paste()
                .build()?;

            let debug_db_reset_menu_item =
                MenuItemBuilder::with_id("debug_reset_db", "Reset database")
                    .build(app.handle())
                    .expect("Failed to build debug menu");
            let debug_submenu = SubmenuBuilder::new(handle, "Debug")
                .item(&debug_db_reset_menu_item)
                .build()?;

            app.on_menu_event(move |app, event| {
                if event.id() == debug_db_reset_menu_item.id() {
                    let db = app.state::<Database>();
                    let app_handle = app.app_handle();
                    tauri::async_runtime::block_on(async {
                        if let Err(e) = db.reset_db().await {
                            eprintln!("Failed to reset database: {}", e);
                        } else {
                            // Emit event after successful reset
                            app.emit("database-reset", ()).unwrap();
                        }
                    });
                }
            });

            let menu = Menu::new(handle)?;
            menu.append(&edit_submenu)?;
            menu.append(&debug_submenu)?;
            app.set_menu(menu)
                .expect("Failed to build application menu");

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_stories,
            get_story,
            get_story_outline,
            add_story,
            delete_story,
            get_page,
            patch_page,
            create_page,
            create_choice,
            delete_choice,
            patch_choice
        ])
        .plugin(tauri_plugin_dialog::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
