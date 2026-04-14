use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::Manager;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum FileError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("File not found: {0}")]
    NotFound(String),
}

impl Serialize for FileError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileContent {
    pub path: String,
    pub content: String,
}

/// Read a Markdown file from disk.
#[tauri::command]
pub fn file_read(path: String) -> Result<String, String> {
    let path = PathBuf::from(&path);
    if !path.exists() {
        return Err(format!("File not found: {}", path.display()));
    }
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

/// Write Markdown content to disk.
#[tauri::command]
pub fn file_write(path: String, content: String) -> Result<(), String> {
    fs::write(&path, &content).map_err(|e| e.to_string())
}

/// Get the app data directory for storing preferences.
#[tauri::command]
pub fn get_app_data_dir(app: tauri::AppHandle) -> Result<String, String> {
    app.path()
        .app_data_dir()
        .map(|p: PathBuf| p.to_string_lossy().to_string())
        .map_err(|e: tauri::Error| e.to_string())
}
