#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod app;
mod commands;
mod error;
mod project;

#[cfg(feature = "test-server")]
mod test_server;

use commands::ProjectState;
use std::sync::Mutex;

fn main() {
    #[cfg(feature = "test-server")]
    {
        // In test mode, run only the HTTP test server (no Tauri window)
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(test_server::start_test_server());
        return;
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(ProjectState(Mutex::new(None)))
        .setup(|app| {
            let handle = app.handle();
            let menu = app::menu::create_menus(handle)?;
            app.set_menu(menu)?;
            app::menu::setup_menu_handlers(handle);
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
            commands::validate_story,
            commands::get_story_graph,
            commands::copy_asset,
            commands::get_project_assets_dir,
            commands::list_assets,
            commands::delete_asset,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
