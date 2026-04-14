pub mod commands;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::file_read,
            commands::file_write,
            commands::get_app_data_dir,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
