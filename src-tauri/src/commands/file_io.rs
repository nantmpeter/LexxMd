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

/// Write binary content (base64-encoded) to a file.
/// Used for JPEG and DOCX export.
#[tauri::command]
pub fn file_write_binary(path: String, content: String) -> Result<(), String> {
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&content)
        .map_err(|e| format!("Base64 decode error: {e}"))?;
    if let Some(parent) = PathBuf::from(&path).parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&path, &bytes).map_err(|e| e.to_string())
}

/// Get the app data directory for storing preferences.
#[tauri::command]
pub fn get_app_data_dir(app: tauri::AppHandle) -> Result<String, String> {
    app.path()
        .app_data_dir()
        .map(|p: PathBuf| p.to_string_lossy().to_string())
        .map_err(|e: tauri::Error| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn file_read_nonexistent_returns_error() {
        let result = file_read("/tmp/mdeditor_test_nonexistent_99999.md".into());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("File not found"));
    }

    #[test]
    fn file_write_then_read_roundtrip() {
        let dir = std::env::temp_dir().join("mdeditor_test_io");
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("roundtrip_test.md");
        let content = "# Hello\n\nWorld **bold** text.";

        file_write(path.to_string_lossy().to_string(), content.to_string()).unwrap();
        let read_back = file_read(path.to_string_lossy().to_string()).unwrap();
        assert_eq!(read_back, content);

        fs::remove_file(&path).ok();
    }

    #[test]
    fn file_write_to_existing_dir() {
        let dir = std::env::temp_dir().join("mdeditor_test_write_existing");
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("new_file.md");

        file_write(path.to_string_lossy().to_string(), "content".into()).unwrap();
        assert!(path.exists());
        assert_eq!(fs::read_to_string(&path).unwrap(), "content");

        fs::remove_file(&path).ok();
    }

    #[test]
    fn file_read_returns_file_content() {
        let dir = std::env::temp_dir().join("mdeditor_test_read");
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("read_test.md");

        let mut f = fs::File::create(&path).unwrap();
        f.write_all(b"test content 123").unwrap();

        let result = file_read(path.to_string_lossy().to_string()).unwrap();
        assert_eq!(result, "test content 123");

        fs::remove_file(&path).ok();
    }

    #[test]
    fn file_write_overwrites_existing() {
        let dir = std::env::temp_dir().join("mdeditor_test_overwrite");
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("overwrite_test.md");

        file_write(path.to_string_lossy().to_string(), "first".into()).unwrap();
        file_write(path.to_string_lossy().to_string(), "second".into()).unwrap();

        assert_eq!(fs::read_to_string(&path).unwrap(), "second");
        fs::remove_file(&path).ok();
    }
}
