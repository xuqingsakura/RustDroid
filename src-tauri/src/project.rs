//! 项目管理（Sprint 1-2 Task 3）
//! 桩文件 - 实现将在 Task 3 中完成

#![forbid(unsafe_code)]

use ide_ipc::{IpcResult, IpcError};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager, command};

/// 最近项目条目
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentProject {
    pub name: String,
    pub path: String,
    pub last_opened: String,
}

/// 项目信息
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInfo {
    pub name: String,
    pub path: String,
    pub is_android_project: bool,
    pub file_count: usize,
}

/// 打开项目
#[command]
pub fn open_project(path: String) -> IpcResult<ProjectInfo> {
    let dir = PathBuf::from(&path);
    if !dir.is_dir() {
        return Err(IpcError::NotFound(format!("directory not found: {}", path)));
    }
    let name = dir.file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| dir.to_string_lossy().to_string());
    let has_build_gradle = dir.join("build.gradle").exists() || dir.join("build.gradle.kts").exists();
    let has_settings_gradle = dir.join("settings.gradle").exists() || dir.join("settings.gradle.kts").exists();
    let file_count = fs::read_dir(&dir).map(|e| e.count()).unwrap_or(0);
    Ok(ProjectInfo {
        name,
        path,
        is_android_project: has_build_gradle || has_settings_gradle,
        file_count,
    })
}

/// 获取最近项目列表
#[command]
pub fn get_recent_projects(app: AppHandle) -> IpcResult<Vec<RecentProject>> {
    let path = recent_file_path(&app);
    if !path.exists() { return Ok(Vec::new()); }
    let data = fs::read_to_string(&path)
        .map_err(|e| IpcError::Io(format!("failed to read recent projects: {}", e)))?;
    Ok(serde_json::from_str(&data).unwrap_or_default())
}

/// 添加项目到最近列表
#[command]
pub fn add_recent_project(app: AppHandle, path: String) -> IpcResult<()> {
    let name = PathBuf::from(&path)
        .file_name().map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "unknown".into());
    let new_project = RecentProject {
        name,
        path,
        last_opened: chrono::Utc::now().to_rfc3339(),
    };
    let mut projects = get_recent_projects(app.clone())?;
    projects.retain(|p| p.path != new_project.path);
    projects.insert(0, new_project);
    projects.truncate(20);
    let file_path = recent_file_path(&app);
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| IpcError::Io(format!("failed to create app data dir: {}", e)))?;
    }
    let data = serde_json::to_string_pretty(&projects)
        .map_err(|e| IpcError::Generic(format!("serialization error: {}", e)))?;
    fs::write(&file_path, data)
        .map_err(|e| IpcError::Io(format!("failed to write: {}", e)))?;
    Ok(())
}

fn recent_file_path(app: &AppHandle) -> PathBuf {
    app.path().app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("recent_projects.json")
}
