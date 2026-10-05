pub mod commands;

#[cfg(target_os = "macos")]
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Emitter, Manager};

/// Emit an event only to the currently focused webview window, falling back
/// to `main` when nothing reports focus (e.g. while windows are still
/// opening). A plain `emit` broadcasts to every window, so in multi-window
/// sessions each window's `menu-event`/`file-open` handler would run once
/// per window (menu action executed N times, .md files opened repeatedly).
///
/// Note: this only scopes delivery because the frontend listens through
/// `getCurrentWebviewWindow().listen(...)`, which registers the window as
/// the event target. The bare `listen()` helper from `@tauri-apps/api/event`
/// registers `EventTarget::Any` (a global sniffer) and would receive
/// targeted emits in every window regardless.
fn emit_to_focused(app: &AppHandle, event: &str, payload: &str) {
    for (_label, window) in app.webview_windows() {
        if window.is_focused().unwrap_or(false) {
            let _ = app.emit_to(window.label(), event, payload);
            return;
        }
    }
    let _ = app.emit_to("main", event, payload);
}

/// Extract markdown file paths from a list of command-line arguments.
/// Shared by the Windows startup path and the single-instance callback:
/// args[0] is the program path; later entries may be files the OS passed in.
fn argv_md_files(args: &[String]) -> Vec<String> {
    args.iter()
        .skip(1)
        .filter(|arg| {
            let lower = arg.to_lowercase();
            lower.ends_with(".md")
                || lower.ends_with(".markdown")
                || lower.ends_with(".mdx")
        })
        .filter(|arg| std::path::Path::new(arg).exists())
        .cloned()
        .collect()
}

/// Extract file paths from Windows command-line arguments.
/// When a user double-clicks an associated file, Windows passes the path as
/// the first argument: `Lexx.exe path\to\file.md`.
#[cfg(target_os = "windows")]
fn windows_argv_files() -> Vec<String> {
    argv_md_files(&std::env::args().collect::<Vec<String>>())
}

pub fn run() {
    tauri::Builder::default()
        // Single-instance lock must be the FIRST registered plugin (upstream
        // requirement): a second launch is closed here and relayed to this
        // process. The callback reuses the existing `file-open` event so the
        // frontend's regular file-open flow runs.
        // On macOS double-open normally arrives via RunEvent::Opened below;
        // registering here too is harmless and covers direct binary launches.
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
            // Emit ONLY — never push into PendingFiles here. This callback
            // fires inside the already-running instance whose frontend listens
            // for `file-open`, so the event delivers the file immediately; a
            // buffered copy would survive the handling and be drained a second
            // time by the next new window's mount (double open). (PendingFiles
            // stays reserved for pre-frontend startup paths: the Windows argv
            // buffer in setup and the macOS RunEvent::Opened buffer, where no
            // listener exists yet and the emit alone would be lost.)
            for path in argv_md_files(&args) {
                emit_to_focused(app, "file-open", &path);
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(commands::PendingFiles(std::sync::Mutex::new(Vec::new())))
        .invoke_handler(tauri::generate_handler![
            commands::file_read,
            commands::file_read_binary,
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
            commands::consume_pending_file,
        ])
        .setup(|app| {
            // On Windows, file associations pass the path as a CLI argument.
            // Buffer them here so the frontend can drain_pending_files on mount.
            #[cfg(target_os = "windows")]
            {
                let files = windows_argv_files();
                if !files.is_empty() {
                    if let Some(pending) = app.try_state::<commands::PendingFiles>() {
                        if let Ok(mut buf) = pending.0.lock() {
                            for f in files {
                                buf.push(f);
                            }
                        }
                    }
                }
            }

            // Native menu bar — macOS only.
            // On Windows the menu is replaced by a lightweight frontend toolbar.
            #[cfg(target_os = "macos")]
            {
                let app_menu = Submenu::with_items(app, "App", true, &[
                    &PredefinedMenuItem::hide(app, None)?,
                    &PredefinedMenuItem::hide_others(app, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    // macOS convention: Preferences... lives in the app menu,
                    // above Quit, with the Cmd+, accelerator.
                    &MenuItem::with_id(app, "prefs", "Preferences...", true, Some("CmdOrCtrl+,"))?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::quit(app, None)?,
                ])?;

                let file_menu = Submenu::with_items(app, "File", true, &[
                    &MenuItem::with_id(app, "fn", "New", true, None::<String>)?,
                    &MenuItem::with_id(app, "fo", "Open...", true, None::<String>)?,
                    &MenuItem::with_id(app, "fq", "Quick Open...", true, Some("CmdOrCtrl+P"))?,
                    &MenuItem::with_id(app, "ff", "Open Folder...", true, None::<String>)?,
                    &PredefinedMenuItem::separator(app)?,
                    &MenuItem::with_id(app, "fs", "Save", true, None::<String>)?,
                    &MenuItem::with_id(app, "sa", "Save As...", true, Some("CmdOrCtrl+Shift+S"))?,
                    &PredefinedMenuItem::separator(app)?,
                    // Cmd+P is taken by Quick Open; the Alt variant keeps the
                    // print entry point visible in the menu without a clash.
                    &MenuItem::with_id(app, "pr", "Print...", true, Some("CmdOrCtrl+Alt+P"))?,
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
                    &MenuItem::with_id(app, "ef", "Find...", true, Some("CmdOrCtrl+F"))?,
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
                    // macOS menus are global: the focused window is the one
                    // the user is working in, so only it must act on the id.
                    emit_to_focused(app, "menu-event", event.id().as_ref());
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
                            // Buffer: this event can fire during a cold launch,
                            // BEFORE the webview has mounted its `file-open`
                            // listener — the emit alone would be lost, so the
                            // mount-time drain_pending_files is the fallback
                            // delivery path.
                            if let Some(pending) = app.try_state::<commands::PendingFiles>() {
                                if let Ok(mut buf) = pending.0.lock() {
                                    buf.push(path_str.clone());
                                }
                            }
                            // Also emit for when the frontend is already
                            // listening; the OS activation focused the target
                            // window. To keep the two paths single-delivery,
                            // the frontend consumes the buffered copy right
                            // after handling this event (consume_pending_file),
                            // so a later window's drain can never re-open it.
                            emit_to_focused(app, "file-open", &path_str);
                        }
                    }
                }
                _ => {}
            }
        })
}
