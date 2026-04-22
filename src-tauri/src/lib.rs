pub mod commands;

#[cfg(target_os = "macos")]
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{Emitter, Manager};

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(commands::PendingFiles(std::sync::Mutex::new(Vec::new())))
        .invoke_handler(tauri::generate_handler![
            commands::file_read,
            commands::file_write,
            commands::file_write_binary,
            commands::get_app_data_dir,
            commands::file_open_dialog,
            commands::file_save_dialog,
            commands::directory_open_dialog,
            commands::list_directory,
            commands::open_folder_in_new_window,
            commands::open_file_in_new_window,
            commands::temp_save,
            commands::list_temp_files,
            commands::delete_temp_file,
            commands::update_window_title,
            commands::toggle_fullscreen,
            commands::drain_pending_files,
        ])
        .setup(|app| {
            // Native menu bar — macOS only.
            // On Windows the menu is replaced by a lightweight frontend toolbar.
            #[cfg(target_os = "macos")]
            {
                let app_menu = Submenu::with_items(app, "App", true, &[
                    &PredefinedMenuItem::hide(app, None)?,
                    &PredefinedMenuItem::hide_others(app, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::quit(app, None)?,
                ])?;

                let file_menu = Submenu::with_items(app, "File", true, &[
                    &MenuItem::with_id(app, "fn", "New", true, None::<String>)?,
                    &MenuItem::with_id(app, "fo", "Open...", true, None::<String>)?,
                    &MenuItem::with_id(app, "ff", "Open Folder...", true, None::<String>)?,
                    &PredefinedMenuItem::separator(app)?,
                    &MenuItem::with_id(app, "fs", "Save", true, None::<String>)?,
                    &PredefinedMenuItem::separator(app)?,
                    &Submenu::with_items(app, "Export", true, &[
                        &MenuItem::with_id(app, "ep", "Export as PDF...", true, None::<String>)?,
                        &MenuItem::with_id(app, "ed", "Export as DOCX...", true, None::<String>)?,
                        &MenuItem::with_id(app, "ej", "Export as JPEG...", true, None::<String>)?,
                    ])?,
                    &PredefinedMenuItem::separator(app)?,
                    &MenuItem::with_id(app, "fc", "Close", true, None::<String>)?,
                ])?;

                let edit_menu = Submenu::with_items(app, "Edit", true, &[
                    &PredefinedMenuItem::undo(app, None)?,
                    &PredefinedMenuItem::redo(app, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::cut(app, None)?,
                    &PredefinedMenuItem::copy(app, None)?,
                    &PredefinedMenuItem::paste(app, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::select_all(app, None)?,
                ])?;

                let view_menu = Submenu::with_items(app, "View", true, &[
                    &MenuItem::with_id(app, "vs", "Source Mode", true, None::<String>)?,
                    &PredefinedMenuItem::separator(app)?,
                    &MenuItem::with_id(app, "vf", "Toggle Full Screen", true, None::<String>)?,
                ])?;

                let menu = Menu::with_items(app, &[
                    &app_menu,
                    &file_menu,
                    &edit_menu,
                    &view_menu,
                ])?;

                app.set_menu(menu)?;
            }

            Ok(())
        })
        .on_menu_event(|app, event| {
            match event.id().as_ref() {
                "vf" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let fullscreen = window.is_fullscreen().unwrap_or(false);
                        let _ = window.set_fullscreen(!fullscreen);
                    }
                }
                _ => {
                    let _ = app.emit("menu-event", event.id().as_ref());
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            match event {
                #[cfg(target_os = "macos")]
                tauri::RunEvent::Opened { urls } => {
                    for url in urls {
                        if let Ok(path) = url.to_file_path() {
                            let path_str = path.to_string_lossy().to_string();
                            // Buffer for frontend to pick up on mount
                            if let Some(pending) = app.try_state::<commands::PendingFiles>() {
                                if let Ok(mut buf) = pending.0.lock() {
                                    buf.push(path_str.clone());
                                }
                            }
                            // Also emit for when frontend is already listening
                            let _ = app.emit("file-open", &path_str);
                        }
                    }
                }
                _ => {}
            }
        })
}
