use tauri::{
    menu::{Menu, MenuItemBuilder, SubmenuBuilder},
    AppHandle, Emitter,
};

pub fn create_menus<R: tauri::Runtime>(
    app: &AppHandle<R>,
) -> Result<Menu<R>, Box<dyn std::error::Error>> {
    let file_import_menu_item =
        MenuItemBuilder::with_id("file_import_story", "Import Story...").build(app)?;
    let file_export_menu_item =
        MenuItemBuilder::with_id("file_export_story", "Export Story...").build(app)?;

    let file_submenu = SubmenuBuilder::new(app, "File")
        .item(&file_import_menu_item)
        .item(&file_export_menu_item)
        .build()?;

    let edit_submenu = SubmenuBuilder::new(app, "Edit")
        .cut()
        .copy()
        .paste()
        .build()?;

    let menu = Menu::new(app)?;
    menu.append(&file_submenu)?;
    menu.append(&edit_submenu)?;

    Ok(menu)
}

pub fn setup_menu_handlers<R: tauri::Runtime>(app: &AppHandle<R>) {
    app.on_menu_event(move |app, event| {
        if event.id() == "file_import_story" {
            let _ = app.emit("import-story", ());
        } else if event.id() == "file_export_story" {
            let _ = app.emit("export-story", ());
        }
    });
}
