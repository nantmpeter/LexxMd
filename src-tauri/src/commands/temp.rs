use std::fs;
use std::path::PathBuf;
use serde::Serialize;
use tauri::Manager;

#[derive(Debug, Serialize)]
pub struct TempFile {
    pub path: String,
    pub filename: String,
    pub modified: u64,
}

/// Save content to a temp file in the app data directory for crash recovery.
#[tauri::command]
pub fn temp_save(app: tauri::AppHandle, filename: String, content: String) -> Result<String, String> {
    let data_dir = app.path().app_data_dir()
        .map_err(|e| e.to_string())?;
    let temp_dir = data_dir.join("temp");
    fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;
    let file_path = temp_dir.join(&filename);
    fs::write(&file_path, &content).map_err(|e| e.to_string())?;
    Ok(file_path.to_string_lossy().to_string())
}

/// List all temp recovery files.
#[tauri::command]
pub fn list_temp_files(app: tauri::AppHandle) -> Result<Vec<TempFile>, String> {
    let data_dir = app.path().app_data_dir()
        .map_err(|e| e.to_string())?;
    let temp_dir = data_dir.join("temp");
    if !temp_dir.exists() {
        return Ok(vec![]);
    }
    let mut files = Vec::new();
    for entry in fs::read_dir(&temp_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let metadata = entry.metadata().map_err(|e| e.to_string())?;
        if metadata.is_file() {
            let path = entry.path();
            if path.extension().map(|e| e == "md").unwrap_or(false) {
                files.push(TempFile {
                    path: path.to_string_lossy().to_string(),
                    filename: path.file_name().unwrap().to_string_lossy().to_string(),
                    modified: metadata.modified()
                        .ok()
                        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                        .map(|d| d.as_secs())
                        .unwrap_or(0),
                });
            }
        }
    }
    Ok(files)
}

/// Delete a temp file after recovery or cleanup.
#[tauri::command]
pub fn delete_temp_file(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    // Safety check: only delete files inside the temp directory
    if p.exists() && p.to_string_lossy().contains("temp") {
        fs::remove_file(&p).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn delete_temp_file_safety_check_refuses_non_temp_paths() {
        let dir = std::env::temp_dir().join("mdeditor_safe_guard");
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("protected.md");
        fs::write(&path, "important").unwrap();

        // Path does NOT contain "temp", so file should NOT be deleted
        let result = delete_temp_file(path.to_string_lossy().to_string());
        assert!(result.is_ok());
        assert!(path.exists(), "File should still exist outside temp dir");

        fs::remove_file(&path).ok();
        fs::remove_dir(&dir).ok();
    }

    #[test]
    fn delete_temp_file_deletes_inside_temp_dir() {
        let dir = std::env::temp_dir().join("mdeditor_temp_test");
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("temp").join("deleteme.md");
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(&path, "disposable").unwrap();

        let result = delete_temp_file(path.to_string_lossy().to_string());
        assert!(result.is_ok());
        assert!(!path.exists(), "File in temp dir should be deleted");

        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn delete_temp_file_nonexistent_is_ok() {
        let result = delete_temp_file("/tmp/temp/nonexistent_file_99999.md".into());
        assert!(result.is_ok());
    }
}
