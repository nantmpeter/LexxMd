use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::Manager;

/// State type for buffering file paths opened during startup.
pub struct PendingFiles(pub Mutex<Vec<String>>);

/// Return (and clear) file paths that were opened before the frontend was ready.
#[tauri::command]
pub fn drain_pending_files(app: tauri::AppHandle) -> Vec<String> {
    if let Some(pending) = app.try_state::<PendingFiles>() {
        if let Ok(mut buf) = pending.0.lock() {
            return std::mem::take(&mut *buf);
        }
    }
    Vec::new()
}
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

/// Write Markdown content to disk (atomic: temp file + rename in the target directory).
#[tauri::command]
pub fn file_write(path: String, content: String) -> Result<(), String> {
    atomic_write(PathBuf::from(&path), content.as_bytes()).map_err(|e| e.to_string())
}

/// Write binary content (base64-encoded) to a file (atomic).
/// Used for JPEG and DOCX export.
#[tauri::command]
pub fn file_write_binary(path: String, content: String) -> Result<(), String> {
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&content)
        .map_err(|e| format!("Base64 decode error: {e}"))?;
    let path = PathBuf::from(&path);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    atomic_write(path, &bytes).map_err(|e| e.to_string())
}

/// Sidecar name for atomic writes: `.{name}.tmp-<pid>-<nanos>-<seq>`. Two
/// concurrent writers targeting the same file must not share a temp name, or
/// one writer's rename could promote the other's partial content.
fn temp_sidecar_name(file_name: &std::ffi::OsStr) -> String {
    use std::sync::atomic::{AtomicU64, Ordering};
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    let seq = COUNTER.fetch_add(1, Ordering::Relaxed);
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    format!(
        ".{}.tmp-{}-{}-{}",
        file_name.to_string_lossy(),
        std::process::id(),
        nanos,
        seq
    )
}

/// Write `bytes` to `target` atomically: write to a `.<name>.tmp-<unique>`
/// sibling file in the target's own directory (same volume, so `fs::rename`
/// is an atomic replace), then rename it over the target. On any failure the
/// original target is left untouched and the leftover temp file is removed;
/// on success the temp file no longer exists (it became the target).
fn atomic_write(target: PathBuf, bytes: &[u8]) -> std::io::Result<()> {
    let file_name = target.file_name().ok_or_else(|| {
        std::io::Error::new(std::io::ErrorKind::InvalidInput, "path has no file name")
    })?;
    let parent = target.parent().unwrap_or_else(|| std::path::Path::new("."));
    let tmp = parent.join(temp_sidecar_name(file_name));

    if let Err(e) = fs::write(&tmp, bytes) {
        let _ = fs::remove_file(&tmp);
        return Err(e);
    }

    if let Err(e) = fs::rename(&tmp, &target) {
        let _ = fs::remove_file(&tmp);
        return Err(e);
    }

    Ok(())
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

    /// True if any atomic-write sidecar (`.{name}.tmp-*`) survives in `dir`.
    /// The suffix is randomized, so residue detection must scan by prefix —
    /// a fixed-name existence check would miss every leftover.
    fn temp_residue_exists(dir: &std::path::Path, name: &str) -> bool {
        let prefix = format!(".{name}.tmp");
        match fs::read_dir(dir) {
            Ok(mut entries) => entries.any(|e| {
                e.map(|e| e.file_name().to_string_lossy().starts_with(&prefix))
                    .unwrap_or(false)
            }),
            Err(_) => false,
        }
    }

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

    #[test]
    fn atomic_write_readonly_dir_fails_and_original_is_intact() {
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;

            let dir = std::env::temp_dir().join("mdeditor_test_atomic_ro");
            fs::create_dir_all(&dir).unwrap();
            let path = dir.join("protected.md");
            fs::write(&path, "ORIGINAL").unwrap();

            // Make the directory read-only: creating the .tmp sibling fails.
            let mut perms = fs::metadata(&dir).unwrap().permissions();
            perms.set_mode(0o555);
            fs::set_permissions(&dir, perms.clone()).unwrap();

            let result = file_write(path.to_string_lossy().to_string(), "NEW".into());
            assert!(result.is_err(), "write into a read-only dir must fail");

            // Restore permissions so cleanup can happen.
            perms.set_mode(0o755);
            fs::set_permissions(&dir, perms).unwrap();

            // The original file must be untouched and no temp residue left.
            assert_eq!(fs::read_to_string(&path).unwrap(), "ORIGINAL");
            assert!(
                !temp_residue_exists(&dir, "protected.md"),
                "temp file must be removed on failure"
            );

            fs::remove_file(&path).ok();
            fs::remove_dir(&dir).ok();
        }
    }

    #[test]
    fn atomic_write_rename_blocked_by_directory_original_is_intact() {
        let dir = std::env::temp_dir().join("mdeditor_test_atomic_dir");
        let target_dir = dir.join("blocked");
        fs::create_dir_all(target_dir.join("occupied")).unwrap();

        // Temp write succeeds (dir is writable) but rename onto the occupied
        // directory fails, which must clean up the temp file and keep the
        // occupied directory's contents untouched.
        let result = atomic_write(target_dir.clone(), b"NEW".as_slice());
        assert!(result.is_err(), "rename onto a non-empty dir must fail");

        assert!(
            !temp_residue_exists(&dir, "blocked"),
            "temp file must be removed when rename fails"
        );
        assert!(
            target_dir.join("occupied").exists(),
            "occupying directory must remain untouched"
        );

        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn atomic_write_replaces_target_without_residue() {
        let dir = std::env::temp_dir().join("mdeditor_test_atomic_ok");
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("doc.md");
        fs::write(&path, "OLD").unwrap();

        atomic_write(path.clone(), b"NEW".as_slice()).unwrap();

        assert_eq!(fs::read_to_string(&path).unwrap(), "NEW");
        assert!(
            !temp_residue_exists(&dir, "doc.md"),
            "temp file must not survive a successful write"
        );

        fs::remove_file(&path).ok();
        fs::remove_dir(&dir).ok();
    }
}
