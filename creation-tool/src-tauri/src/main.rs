#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod commands;
mod db;
mod models;
mod error;
mod app;

use commands::*;
use app::{setup_database, create_menus, setup_menu_handlers};
use specta_typescript::{BigIntExportBehavior, Typescript};
use tauri::Manager;
use tauri_specta::{collect_commands, Builder};

fn main() {
    // Collect commands for TypeScript bindings
    let commands = collect_commands![
        get_stories,
        add_story,
        get_story,
        get_story_outline,
        delete_story,
        patch_story,
        get_page,
        patch_page,
        create_page,
        create_choice,
        delete_choice,
        patch_choice
    ];

    // Export TypeScript bindings
    Builder::<tauri::Wry>::new()
        .commands(commands)
        .export(
            Typescript::default().bigint(BigIntExportBehavior::Number),
            "../src/bindings.ts",
        )
        .expect("Failed to export typescript bindings");

    // Run Tauri application
    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle();

            // Setup database
            tauri::async_runtime::block_on(async {
                match setup_database(&handle).await {
                    Ok(db) => {
                        handle.manage(db);
                        Ok(())
                    }
                    Err(e) => {
                        eprintln!("Failed to setup database: {}", e);
                        Err(Box::new(e) as Box<dyn std::error::Error>)
                    }
                }
            })?;

            // Setup menus
            let menu = create_menus(&handle)?;
            app.set_menu(menu)?;

            // Setup menu event handlers
            setup_menu_handlers(&handle);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_stories,
            get_story,
            get_story_outline,
            add_story,
            delete_story,
            patch_story,
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
