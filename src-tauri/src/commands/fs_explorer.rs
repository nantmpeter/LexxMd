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
/// Excludes dotfile entries (names starting with `.`) so that `.git`,
/// `.DS_Store`, `.idea`, etc. are hidden from the file tree and quick open.
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

/// Generate a process-unique window label: `<prefix>-<unix-millis>-<seq>`.
/// The atomic counter is what guarantees uniqueness: two windows created
/// within the same millisecond previously produced identical labels and the
/// second `WebviewWindowBuilder::build` failed (an error the frontend
/// swallows, leaving the user with a silently unopened window). Pure
/// function so label uniqueness is directly unit-testable.
fn next_window_label(prefix: &str) -> String {
    use std::sync::atomic::{AtomicU32, Ordering};
    static COUNTER: AtomicU32 = AtomicU32::new(0);
    let millis = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis();
    let seq = COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("{}-{}-{}", prefix, millis, seq)
}

/// Open a folder in a new application window (for conflict resolution).
#[tauri::command]
pub async fn open_folder_in_new_window(
    app: tauri::AppHandle,
    folder_path: String,
) -> Result<(), String> {
    use tauri::{WebviewUrl, WebviewWindowBuilder};

    let label = next_window_label("ws");
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

/// Open a file in a new application window (used when workspace is open).
#[tauri::command]
pub async fn open_file_in_new_window(
    app: tauri::AppHandle,
    file_path: String,
) -> Result<(), String> {
    use tauri::{WebviewUrl, WebviewWindowBuilder};

    let label = next_window_label("file");
    let encoded = urlencoding::encode(&file_path);
    let url = format!("index.html?file={}", encoded);

    // Extract filename for the window title
    let filename = PathBuf::from(&file_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Untitled")
        .to_string();

    WebviewWindowBuilder::new(&app, label, WebviewUrl::App(url.into()))
        .title(&filename)
        .inner_size(1200.0, 800.0)
        .min_inner_size(800.0, 600.0)
        .center()
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    fn next_window_label_format() {
        let label = next_window_label("ws");
        assert!(label.starts_with("ws-"), "label missing prefix: {label}");
        // Shape is `ws-<millis>-<seq>`: two numeric fields after the prefix.
        let fields: Vec<&str> = label["ws-".len()..].split('-').collect();
        assert_eq!(fields.len(), 2, "unexpected label shape: {label}");
        assert!(
            fields.iter().all(|f| !f.is_empty() && f.chars().all(|c| c.is_ascii_digit())),
            "non-numeric label fields: {label}"
        );
    }

    #[test]
    fn next_window_label_unique_across_threads() {
        // Hammer the generator from several threads at once: the shared
        // atomic counter must keep every label distinct even when calls
        // land in the same millisecond (the original collision bug).
        let handles: Vec<_> = (0..8)
            .map(|_| {
                std::thread::spawn(|| {
                    (0..64).map(|_| next_window_label("ws")).collect::<Vec<_>>()
                })
            })
            .collect();
        let mut seen = HashSet::new();
        for handle in handles {
            for label in handle.join().unwrap() {
                assert!(seen.insert(label), "duplicate window label generated");
            }
        }
        assert_eq!(seen.len(), 8 * 64);
    }

    #[test]
    fn next_window_label_prefixes_never_collide() {
        // `ws` and `file` labels share one global counter, so even
        // same-millisecond calls across the two prefixes stay distinct.
        let ws = next_window_label("ws");
        let file = next_window_label("file");
        assert_ne!(ws, file);
        assert!(ws.starts_with("ws-"));
        assert!(file.starts_with("file-"));
    }
}
