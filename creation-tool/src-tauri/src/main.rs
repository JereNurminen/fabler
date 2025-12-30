#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod commands;
mod db;
mod models;
mod error;
mod app;
mod schema;

#[cfg(feature = "test-server")]
mod test_server;

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
        export_story_toml,
        get_toml_schema,
        get_page,
        patch_page,
        create_page,
        create_choice,
        delete_choice,
        patch_choice,
        get_story_flags,
        create_flag,
        patch_flag,
        delete_flag,
        set_flag_operation,
        remove_flag_operation,
        get_choice_flag_operations,
        get_page_flag_operations,
        set_choice_condition,
        remove_choice_condition,
        get_choice_conditions
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
            let db = tauri::async_runtime::block_on(async {
                match setup_database(&handle).await {
                    Ok(db) => {
                        handle.manage(db.clone());
                        Ok(db)
                    }
                    Err(e) => {
                        eprintln!("Failed to setup database: {}", e);
                        Err(Box::new(e) as Box<dyn std::error::Error>)
                    }
                }
            })?;

            // Start test server if enabled
            #[cfg(feature = "test-server")]
            {
                let db_clone = std::sync::Arc::new(db);
                tauri::async_runtime::spawn(async move {
                    if let Err(e) = test_server::start_test_server(db_clone, 3001).await {
                        eprintln!("Test server error: {}", e);
                    }
                });
                println!("Test server will start on http://127.0.0.1:3001");
            }

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
            export_story_toml,
            get_toml_schema,
            get_page,
            patch_page,
            create_page,
            create_choice,
            delete_choice,
            patch_choice,
            get_story_flags,
            create_flag,
            patch_flag,
            delete_flag,
            set_flag_operation,
            remove_flag_operation,
            get_choice_flag_operations,
            get_page_flag_operations,
            set_choice_condition,
            remove_choice_condition,
            get_choice_conditions
        ])
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
