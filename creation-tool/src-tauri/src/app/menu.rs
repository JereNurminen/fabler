use crate::db::Database;
use tauri::{
    menu::{Menu, MenuItemBuilder, SubmenuBuilder},
    AppHandle, Emitter, Manager,
};

pub fn create_menus<R: tauri::Runtime>(app: &AppHandle<R>) -> Result<Menu<R>, Box<dyn std::error::Error>> {
    let edit_submenu = SubmenuBuilder::new(app, "Edit")
        .cut()
        .copy()
        .paste()
        .build()?;

    let debug_db_reset_menu_item =
        MenuItemBuilder::with_id("debug_reset_db", "Reset database").build(app)?;

    let debug_submenu = SubmenuBuilder::new(app, "Debug")
        .item(&debug_db_reset_menu_item)
        .build()?;

    let menu = Menu::new(app)?;
    menu.append(&edit_submenu)?;
    menu.append(&debug_submenu)?;

    Ok(menu)
}

pub fn setup_menu_handlers<R: tauri::Runtime>(app: &AppHandle<R>) {
    app.on_menu_event(move |app, event| {
        if event.id() == "debug_reset_db" {
            let db = app.state::<Database>();
            tauri::async_runtime::block_on(async {
                if let Err(e) = db.reset_db().await {
                    eprintln!("Failed to reset database: {}", e);
                } else {
                    let _ = app.emit("database-reset", ());
                }
            });
        }
    });
}
