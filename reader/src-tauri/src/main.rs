#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod error;
mod library;
mod storage;

use library::Library;
use storage::SaveStorage;
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data dir");

            std::fs::create_dir_all(&app_data_dir)?;

            let library = Library::new(&app_data_dir)?;
            let stories_dir = app_data_dir.join("stories");
            let save_storage = SaveStorage::new(&stories_dir);

            app.manage(library);
            app.manage(save_storage);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_stories,
            commands::install_bundle,
            commands::get_manifest,
            commands::delete_story,
            commands::save_slot,
            commands::load_slot,
            commands::list_slots,
            commands::delete_slot,
            commands::read_asset_base64,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
