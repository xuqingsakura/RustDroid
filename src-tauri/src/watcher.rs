//! 文件变更监听（Sprint 1-2 Task 2）
//! 桩实现 — Task 2 中完善

#![forbid(unsafe_code)]

use serde::Serialize;
use tauri::AppHandle;

/// 文件变更事件载荷
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileChangePayload {
    pub kind: String,
    pub paths: Vec<String>,
}

/// 启动文件监听（桩）
pub fn start_watcher(_app: &AppHandle, _root_path: std::path::PathBuf) -> Result<(), String> {
    tracing::warn!("file watcher stub — not yet implemented");
    Ok(())
}

/// 停止文件监听（桩）
pub fn stop_watcher(_app: &AppHandle) {
    tracing::warn!("file watcher stop stub — not yet implemented");
}
