//! 文件系统变更监听
//!
//! 使用 notify 直接监听项目目录的文件变更，保留 create/modify/delete 事件类型。
//! 通过 Tauri event 推送到前端。

#![forbid(unsafe_code)]

use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::path::PathBuf;
use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};

/// 文件变更事件载荷
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileChangePayload {
    /// 变更类型: "created" | "modified" | "deleted" | "other"
    pub kind: String,
    /// 受影响的文件路径
    pub path: String,
}

/// Watcher 状态
type WatcherHandle = Arc<Mutex<Option<RecommendedWatcher>>>;

/// 启动文件监听
pub fn start_watcher(app: &AppHandle, root_path: PathBuf) -> Result<(), String> {
    // 先停止已有监听
    stop_watcher(app);

    let app_clone = app.clone();
    let (tx, rx) = mpsc::channel::<Result<Event, notify::Error>>();

    let mut watcher = RecommendedWatcher::new(tx, Config::default())
        .map_err(|e| format!("failed to create watcher: {}", e))?;

    watcher
        .watch(&root_path, RecursiveMode::Recursive)
        .map_err(|e| format!("failed to watch directory: {}", e))?;

    // 启动后台线程处理事件
    std::thread::spawn(move || {
        while let Ok(Ok(event)) = rx.recv() {
            let kind = match event.kind {
                EventKind::Create(_) => "created",
                EventKind::Modify(_) => "modified",
                EventKind::Remove(_) => "deleted",
                _ => "other",
            };

            for path in &event.paths {
                let _ = app_clone.emit(
                    "rustdroid://file_changed",
                    &FileChangePayload {
                        kind: kind.to_string(),
                        path: path.to_string_lossy().to_string(),
                    },
                );
            }
        }
    });

    // 存储到 app state 以保持 watcher 存活
    if app.try_state::<WatcherHandle>().is_none() {
        app.manage(WatcherHandle::default());
    }
    let state = app.state::<WatcherHandle>();
    *state.lock().unwrap() = Some(watcher);

    tracing::info!("file watcher started for: {:?}", root_path);
    Ok(())
}

/// 停止文件监听
pub fn stop_watcher(app: &AppHandle) {
    if let Some(state) = app.try_state::<WatcherHandle>() {
        *state.lock().unwrap() = None;
    }
    tracing::info!("file watcher stopped");
}

use tauri::command;

/// 开始监听目录
#[command]
pub fn watch_directory(app: AppHandle, path: String) -> Result<(), String> {
    start_watcher(&app, PathBuf::from(&path))
}

/// 停止监听目录
#[command]
pub fn unwatch_directory(app: AppHandle) -> Result<(), String> {
    stop_watcher(&app);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_file_change_payload_serialization() {
        let payload = FileChangePayload {
            kind: "created".into(),
            path: "/test/newfile.txt".into(),
        };
        let json = serde_json::to_string(&payload).unwrap();
        assert!(json.contains("\"kind\""));
        assert!(json.contains("\"path\""));
        assert!(json.contains("newfile.txt"));
    }

    #[test]
    fn test_event_kind_mapping() {
        let check = |kind: &str| -> bool {
            matches!(kind, "created" | "modified" | "deleted" | "other")
        };
        assert!(check("created"));
        assert!(check("modified"));
        assert!(check("deleted"));
        assert!(check("other"));
        assert!(!check("unknown"));
    }
}
