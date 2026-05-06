mod crypto;
mod volume;
mod files;
mod state;
mod commands;
mod error;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            commands::create_volume,
            commands::mount_volume,
            commands::unmount_volume,
            commands::list_mounts,
            commands::add_files_to_mount,
            commands::list_mount_entries,
            commands::extract_entry,
            commands::delete_entry,
            commands::encrypt_path,
            commands::decrypt_path,
            commands::password_strength,
            commands::generate_passphrase,
            commands::benchmark_kdf,
            commands::app_info,
        ])
        .run(tauri::generate_context!())
        .expect("error while running cryptvault");
}
