use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use tauri_plugin_dialog::DialogExt;

#[derive(Debug, Serialize)]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub is_markdown: bool,
}

/// Open a native directory picker dialog.
/// Returns the chosen directory path, or None if cancelled.
#[tauri::command]
pub async fn directory_open_dialog(
    app: tauri::AppHandle,
) -> Result<Option<String>, String> {
    let dir_path = app
        .dialog()
        .file()
        .blocking_pick_folder();
    Ok(dir_path.map(|p| p.to_string()))
}

/// List entries in a directory. Returns sorted (dirs first, then files, alphabetical).
/// Excludes hidden entries (starting with `.`).
#[tauri::command]
pub fn list_directory(dir_path: String) -> Result<Vec<DirEntry>, String> {
    let path = PathBuf::from(&dir_path);
    if !path.is_dir() {
        return Err(format!("Not a directory: {}", dir_path));
    }

    let mut entries: Vec<DirEntry> = Vec::new();
    let read_dir = fs::read_dir(&path).map_err(|e| e.to_string())?;

    for entry in read_dir {
        let entry = entry.map_err(|e| e.to_string())?;
        let file_name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden entries
        if file_name.starts_with('.') {
            continue;
        }

        let file_path = entry.path();
        let is_dir = file_path.is_dir();
        let ext = file_path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();
        let is_markdown = !is_dir && matches!(ext.as_str(), "md" | "markdown" | "txt");

        entries.push(DirEntry {
            name: file_name,
            path: file_path.to_string_lossy().to_string(),
            is_dir,
            is_markdown,
        });
    }

    // Sort: directories first (alpha), then files (alpha)
    entries.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    Ok(entries)
}

/// Open a folder in a new application window (for conflict resolution).
#[tauri::command]
pub async fn open_folder_in_new_window(
    app: tauri::AppHandle,
    folder_path: String,
) -> Result<(), String> {
    use tauri::{WebviewUrl, WebviewWindowBuilder};

    let label = format!(
        "ws-{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis()
    );
    let encoded = urlencoding::encode(&folder_path);
    let url = format!("index.html?workspace={}", encoded);

    WebviewWindowBuilder::new(&app, label, WebviewUrl::App(url.into()))
        .title("Lexx")
        .inner_size(1200.0, 800.0)
        .min_inner_size(800.0, 600.0)
        .center()
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}
