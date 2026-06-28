//! RustDroid IDE 应用入口
//!
//! Sprint 1-2：注册文件系统命令与项目管理命令。

#![forbid(unsafe_code)]

mod commands;
mod fs;
mod project;
mod settings;
mod watcher;

use tracing_subscriber::{fmt, prelude::*, EnvFilter};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 初始化日志
    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info,rustdroid_ide_lib=debug,ide_core=debug,ide_ipc=debug"));
    tracing_subscriber::registry()
        .with(env_filter)
        .with(fmt::layer().with_target(false).with_file(true).with_line_number(true))
        .init();

    tracing::info!("starting RustDroid IDE");

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::app_info,
            commands::app_version,
            // Sprint 1-2：文件系统命令
            fs::read_directory,
            fs::read_file_text,
            fs::write_file_text,
            fs::create_file,
            fs::create_directory,
            fs::delete_file,
            fs::rename_file,
            // Sprint 1-2：项目管理命令
            project::open_project,
            project::get_recent_projects,
            project::add_recent_project,
            // Sprint 1-2：文件监听命令
            watcher::watch_directory,
            watcher::unwatch_directory,
            // Sprint 1-4：设置命令
            settings::get_settings,
            settings::save_settings,
        ])
        .setup(|app| {
            // 确保 app_data_dir 存在
            if let Ok(data_dir) = app.path().app_data_dir() {
                let _ = std::fs::create_dir_all(&data_dir);
                tracing::info!("app data dir: {:?}", data_dir);
            }
            tracing::info!("tauri app setup complete");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
