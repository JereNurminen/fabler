#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod app;
mod commands;
mod error;
mod project;

use commands::ProjectState;
use std::sync::Mutex;
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(ProjectState(Mutex::new(None)))
        .setup(|app| {
            let handle = app.handle();
            let menu = app::menu::create_menus(&handle)?;
            app.set_menu(menu)?;
            app::menu::setup_menu_handlers(&handle);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::open_project,
            commands::create_project,
            commands::close_project,
            commands::get_story,
            commands::save_story,
            commands::list_pages,
            commands::get_page,
            commands::save_page,
            commands::create_page,
            commands::delete_page,
            commands::export_bundle,
            commands::copy_asset,
            commands::get_project_assets_dir,
            commands::list_assets,
            commands::delete_asset,
            commands::read_asset_base64,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
