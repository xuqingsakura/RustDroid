//! Tauri command 定义
//!
//! Sprint 1-1：仅暴露应用信息查询命令，后续 Sprint 在此扩展。

use ide_ipc::{AppInfo, IpcResult};

/// 获取完整应用信息
#[tauri::command]
pub fn app_info() -> IpcResult<AppInfo> {
    Ok(AppInfo::current())
}

/// 获取版本号（前端 Hello World 展示用）
#[tauri::command]
pub fn app_version() -> IpcResult<String> {
    Ok(AppInfo::current().version)
}
