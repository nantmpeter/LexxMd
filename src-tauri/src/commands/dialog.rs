//! @file Native file open/save dialog commands
//! @author Backend-Dev Agent (Rust)
//! @created 2026-04-14
//!
//! IMPLEMENTATION SCOPE:
//! - Implemented: file_open_dialog, file_save_dialog using tauri_plugin_dialog
//! - Not implemented: directory picker, multi-file selection
//! - Pending: Integration with frontend EditorStore

use serde::{Deserialize, Serialize};
use tauri_plugin_dialog::DialogExt;

#[derive(Debug, Serialize, Deserialize)]
pub struct FileDialogResult {
    pub path: String,
    pub content: String,
}

/// Open a native file dialog to pick a Markdown file.
/// Returns the file path and its contents, or None if the user cancelled.
#[tauri::command]
pub async fn file_open_dialog(
    app: tauri::AppHandle,
) -> Result<Option<FileDialogResult>, String> {
    let file_path = app
        .dialog()
        .file()
        .add_filter("Markdown", &["md", "markdown", "txt"])
        .blocking_pick_file();

    match file_path {
        Some(fp) => {
            let path_str = fp.to_string();
            let content = std::fs::read_to_string(&path_str)
                .map_err(|e| e.to_string())?;
            Ok(Some(FileDialogResult {
                path: path_str,
                content,
            }))
        }
        None => Ok(None),
    }
}

/// Open a native save file dialog.
/// Returns the chosen path as a string, or None if the user cancelled.
#[tauri::command]
pub async fn file_save_dialog(
    app: tauri::AppHandle,
    default_name: Option<String>,
) -> Result<Option<String>, String> {
    let mut dialog = app.dialog().file().add_filter("Markdown", &["md"]);
    if let Some(name) = default_name {
        dialog = dialog.set_file_name(name);
    }

    let file_path = dialog.blocking_save_file();
    Ok(file_path.map(|p| p.to_string()))
}
