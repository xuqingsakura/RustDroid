//! RustDroid IDE 应用入口
//!
//! Sprint 1-1：注册 Tauri command 与 plugin，启动应用。

#![forbid(unsafe_code)]

mod commands;

use tracing_subscriber::{fmt, prelude::*, EnvFilter};

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
        ])
        .setup(|_app| {
            tracing::info!("tauri app setup complete");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
