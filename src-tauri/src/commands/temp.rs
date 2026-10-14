use std::fs;
use std::path::{Path, PathBuf};
use serde::Serialize;
use tauri::Manager;

#[derive(Debug, Serialize)]
pub struct TempFile {
    pub path: String,
    pub filename: String,
    pub modified: u64,
}

/// Reject filenames that could escape the crash-recovery temp directory:
/// path separators, parent components, or absolute paths. Must stay a bare
/// file name. Pure function (no AppHandle) so it is directly unit-testable.
fn validate_temp_filename(filename: &str) -> Result<(), String> {
    let reject = || format!("Invalid temp filename: {filename:?}");
    if filename.is_empty() {
        return Err(reject());
    }
    let path = Path::new(filename);
    if path.is_absolute()
        || filename.contains('/')
        || filename.contains('\\')
        // Substring check is deliberately strict: it also rejects names that
        // merely contain "..", which is acceptable for recovery copies.
        || filename.contains("..")
    {
        return Err(reject());
    }
    Ok(())
}

/// Decide whether `raw_path` may be deleted, given the app's temp root.
/// Pure function (no AppHandle) so it is directly unit-testable.
///
/// Both sides are canonicalized before the prefix check: on macOS
/// `std::env::temp_dir()` resolves to `/var/folders/...` while canonicalize
/// yields `/private/var/folders/...` — normalizing only the input side would
/// reject every legitimate delete. Canonicalizing both also resolves symlinks,
/// so a symlink planted inside temp cannot smuggle an outside target through.
fn delete_temp_file_checked(raw_path: &str, temp_dir: &Path) -> Result<(), String> {
    let target = PathBuf::from(raw_path);
    // Nonexistent paths are a no-op: recovery cleanup may run twice or race
    // with another window cleaning up the same file.
    if !target.exists() {
        return Ok(());
    }
    let canonical_target = target.canonicalize().map_err(|e| e.to_string())?;
    let canonical_root = temp_dir.canonicalize().map_err(|e| e.to_string())?;
    if canonical_target.starts_with(&canonical_root) {
        fs::remove_file(&canonical_target).map_err(|e| e.to_string())
    } else {
        Err(format!(
            "Refusing to delete path outside temp directory: {raw_path}"
        ))
    }
}

/// Save content to a temp file in the app data directory for crash recovery.
#[tauri::command]
pub fn temp_save(app: tauri::AppHandle, filename: String, content: String) -> Result<String, String> {
    validate_temp_filename(&filename)?;
    let data_dir = app.path().app_data_dir()
        .map_err(|e| e.to_string())?;
    let temp_dir = data_dir.join("temp");
    fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;
    // Safe join: validate_temp_filename guarantees a bare file name.
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

/// Delete a temp file after recovery or cleanup. The temp root is resolved
/// from the AppHandle; the frontend still passes the full path.
#[tauri::command]
pub fn delete_temp_file(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let data_dir = app.path().app_data_dir()
        .map_err(|e| e.to_string())?;
    delete_temp_file_checked(&path, &data_dir.join("temp"))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Per-pid AND per-call test root: cargo runs tests in parallel threads,
    /// and two tests sharing one path race their create/remove_dir_all calls
    /// (Windows locks directories during removal, failing create_dir_all).
    fn unique_dir(name: &str) -> PathBuf {
        use std::sync::atomic::{AtomicU32, Ordering};
        static SEQ: AtomicU32 = AtomicU32::new(0);
        let seq = SEQ.fetch_add(1, Ordering::Relaxed);
        std::env::temp_dir().join(format!("{name}_{}_{seq}", std::process::id()))
    }

    #[test]
    fn validate_temp_filename_rejects_traversal() {
        assert!(validate_temp_filename("../x.md").is_err());
        assert!(validate_temp_filename("a/../b.md").is_err());
        assert!(validate_temp_filename("..").is_err());
        assert!(validate_temp_filename("sub/dir.md").is_err());
        assert!(validate_temp_filename("sub\\dir.md").is_err());
        assert!(validate_temp_filename("/etc/passwd").is_err());
        assert!(validate_temp_filename("").is_err());
    }

    #[test]
    fn validate_temp_filename_accepts_bare_names() {
        assert!(validate_temp_filename("Untitled-ab12cd34.md").is_ok());
        assert!(validate_temp_filename("note.md").is_ok());
        // Dots are fine as long as there is no parent component.
        assert!(validate_temp_filename("a.b.c.md").is_ok());
    }

    #[test]
    fn delete_temp_file_deletes_inside_temp_dir() {
        let root = unique_dir("mdeditor_temp_root");
        fs::create_dir_all(&root).unwrap();
        let inner = root.join("deleteme.md");
        fs::write(&inner, "disposable").unwrap();

        let result = delete_temp_file_checked(inner.to_string_lossy().as_ref(), &root);
        assert!(result.is_ok());
        assert!(!inner.exists(), "file inside temp dir should be deleted");

        fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn delete_temp_file_refuses_existing_file_outside_temp() {
        let root = unique_dir("mdeditor_temp_root");
        let outside_dir = unique_dir("mdeditor_temp_outside");
        fs::create_dir_all(&root).unwrap();
        fs::create_dir_all(&outside_dir).unwrap();
        let path = outside_dir.join("protected.md");
        fs::write(&path, "important").unwrap();

        let result = delete_temp_file_checked(path.to_string_lossy().as_ref(), &root);
        assert!(result.is_err(), "deleting outside the temp root must fail");
        assert!(path.exists(), "file outside temp dir must not be deleted");

        fs::remove_file(&path).ok();
        fs::remove_dir_all(&outside_dir).ok();
        fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn delete_temp_file_nonexistent_is_ok() {
        // The nonexistent check short-circuits before canonicalization, so the
        // temp root need not exist either.
        let root = unique_dir("mdeditor_temp_root_absent");
        let missing = root.join("nonexistent_file_99999.md");
        let result = delete_temp_file_checked(missing.to_string_lossy().as_ref(), &root);
        assert!(result.is_ok());
        assert!(!missing.exists());
    }
}
