use serde::{Deserialize, Serialize};
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;

#[derive(Debug, Serialize, Deserialize)]
pub struct FileDialogResult {
    pub path: String,
    pub content: String,
}

#[derive(Debug, Deserialize)]
pub struct DialogFilter {
    pub name: String,
    pub extensions: Vec<String>,
}

/// Toggle the main window between fullscreen and normal.
#[tauri::command]
pub async fn toggle_fullscreen(app: tauri::AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or("main window not found")?;
    let fullscreen = window.is_fullscreen().map_err(|e: tauri::Error| e.to_string())?;
    window
        .set_fullscreen(!fullscreen)
        .map_err(|e: tauri::Error| e.to_string())
}

/// Open a native file dialog to pick one or more Markdown files.
/// Returns a list of results, or an empty list if the user cancelled.
#[tauri::command]
pub async fn file_open_dialog(
    app: tauri::AppHandle,
) -> Result<Vec<FileDialogResult>, String> {
    let file_paths = app
        .dialog()
        .file()
        .add_filter("Markdown", &["md", "markdown", "txt"])
        .blocking_pick_files();

    let paths = match file_paths {
        Some(ps) => ps,
        None => return Ok(vec![]),
    };

    let mut results = Vec::new();
    for fp in paths {
        let path_str = fp.to_string();
        let content = std::fs::read_to_string(&path_str)
            .map_err(|e| e.to_string())?;
        results.push(FileDialogResult {
            path: path_str,
            content,
        });
    }
    Ok(results)
}

/// Update the native window title bar text.
#[tauri::command]
pub async fn update_window_title(
    app: tauri::AppHandle,
    title: String,
) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or("main window not found")?;
    window
        .set_title(&title)
        .map_err(|e: tauri::Error| e.to_string())
}

/// Open a native save file dialog.
/// Returns the chosen path as a string, or None if the user cancelled.
#[tauri::command]
pub async fn file_save_dialog(
    app: tauri::AppHandle,
    default_name: Option<String>,
    filters: Option<Vec<DialogFilter>>,
) -> Result<Option<String>, String> {
    let mut dialog = app.dialog().file();
    if let Some(filter_list) = filters {
        for f in filter_list {
            let exts: Vec<&str> = f.extensions.iter().map(|s| s.as_str()).collect();
            dialog = dialog.add_filter(&f.name, &exts);
        }
    } else {
        dialog = dialog.add_filter("Markdown", &["md"]);
    }
    if let Some(name) = default_name {
        dialog = dialog.set_file_name(name);
    }
    let file_path = dialog.blocking_save_file();
    Ok(file_path.map(|p| p.to_string()))
}
