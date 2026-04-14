pub mod commands;
pub mod markdown;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::file_read,
            commands::file_write,
            commands::get_app_data_dir,
            commands::file_open_dialog,
            commands::file_save_dialog,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
