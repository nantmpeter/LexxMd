//! Cooperative app exit: an app-level quit request must not kill the process
//! while windows still hold unsaved buffers, so the backend hands the exit
//! decision to the windows and waits for every one of them to report its
//! save-flow result.

use std::sync::Mutex;

use tauri::{AppHandle, Emitter, Manager};

/// Windows that still owe an `app_exit_ready`/`app_exit_cancel` after an
/// app-level quit request was handed to the frontend. `Some(list)` = a quit
/// is in flight; `None` = idle or cancelled by the user declining to discard
/// unsaved changes.
pub struct PendingExitAcks(pub Mutex<Option<Vec<String>>>);

/// Begin the cooperative quit: remember which windows must confirm, then ask
/// every window to run its save flow (`app-exit` event). The process keeps
/// living until all windows answered via `app_exit_ready`, or until any
/// window cancels via `app_exit_cancel`.
///
/// Call sites:
/// - macOS: the app menu's custom Quit item (`Cmd+Q` accelerator). The native
///   `terminate:` predefined item cannot be used here — tao installs no
///   `applicationShouldTerminate:` veto, so termination would bypass this
///   whole flow and never trigger `RunEvent::ExitRequested`.
/// - Windows/Linux: `RunEvent::ExitRequested { code: None }` with windows
///   still alive (see the run-event branch in lib.rs).
pub fn begin_app_exit(app: &AppHandle) {
    // A quit is already in flight (e.g. Cmd+Q pressed twice in a row, or the
    // menu item firing twice): ignore the repeat. Overwriting the ack list
    // would drop acks already collected, and re-emitting `app-exit` would run
    // the save flow in every window a second time (stacked confirm dialogs).
    if let Ok(guard) = app.state::<PendingExitAcks>().0.lock() {
        if guard.is_some() {
            return;
        }
    }
    let labels: Vec<String> = app.webview_windows().keys().cloned().collect();
    if labels.is_empty() {
        // No window left to run a save flow (e.g. the last window just
        // closed and its own close flow already saved): exit for real.
        app.exit(0);
        return;
    }
    if let Ok(mut guard) = app.state::<PendingExitAcks>().0.lock() {
        *guard = Some(labels.clone());
    }
    for label in &labels {
        // Targeted on purpose: each window only saves its own slots.
        let _ = app.emit_to(label.as_str(), "app-exit", ());
    }
}

/// A window finished its exit save flow (nothing dirty, everything saved, or
/// the user confirmed discarding). Once every expected window has reported —
/// and every still-expected window still exists — exit for real.
#[tauri::command]
pub fn app_exit_ready(window: tauri::WebviewWindow, app: AppHandle) {
    let label = window.label().to_string();
    let state = app.state::<PendingExitAcks>();
    let done = {
        let Ok(mut guard) = state.0.lock() else {
            return;
        };
        match guard.as_mut() {
            Some(waiting) => {
                waiting.retain(|l| l != &label);
                // A window destroyed mid-quit (user closed it by hand; its own
                // close flow already saved) can never report ready — prune it,
                // or the quit would hang forever on a phantom ack.
                waiting.retain(|l| app.get_webview_window(l).is_some());
                waiting.is_empty()
            }
            // No quit in flight (cancelled, or a stray event): stay alive.
            None => false,
        }
    };
    if done {
        // Explicit exit: arrives as ExitRequested with code Some(0), which the
        // run-event branch lets through — the save flow already ran.
        app.exit(0);
    }
}

/// A window's save flow was aborted (auto-save failed and the user declined
/// to discard unsaved changes): the app stays alive. The next quit request
/// starts a fresh round.
#[tauri::command]
pub fn app_exit_cancel(app: AppHandle) {
    if let Ok(mut guard) = app.state::<PendingExitAcks>().0.lock() {
        *guard = None;
    }
}
