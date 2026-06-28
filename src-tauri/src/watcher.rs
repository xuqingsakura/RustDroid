//! 文件系统变更监听
//!
//! 使用 notify 监听项目目录的文件变更，通过 Tauri event 推送到前端。
//! 使用 debouncer 合并高频变更，间隔 300ms。

#![forbid(unsafe_code)]

use notify::RecursiveMode;
use notify_debouncer_mini::{new_debouncer, DebounceEventResult};
use serde::Serialize;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

/// 文件变更事件载荷
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileChangePayload {
    /// 变更类型: "created" | "modified" | "deleted" | "any"
    pub kind: String,
    /// 受影响的文件路径
    pub path: String,
}

/// Watcher 状态
type Debouncer = notify_debouncer_mini::Debouncer<notify::RecommendedWatcher>;
type WatcherState = Arc<Mutex<Option<Debouncer>>>;

/// 启动文件监听
pub fn start_watcher(app: &AppHandle, root_path: PathBuf) -> Result<(), String> {
    let app_clone = app.clone();

    let mut debouncer = new_debouncer(
        Duration::from_millis(300),
        move |result: DebounceEventResult| {
            match result {
                Ok(events) => {
                    for event in events {
                        let kind = match event.kind {
                            notify_debouncer_mini::DebouncedEventKind::Any => "modified",
                            _ => "any",
                        };

                        let _ = app_clone.emit(
                            "rustdroid://file_changed",
                            &FileChangePayload {
                                kind: kind.to_string(),
                                path: event.path.to_string_lossy().to_string(),
                            },
                        );
                    }
                }
                Err(e) => {
                    tracing::warn!("watcher error: {:?}", e);
                }
            }
        },
    )
    .map_err(|e| format!("failed to create debouncer: {}", e))?;

    debouncer
        .watcher()
        .watch(&root_path, RecursiveMode::Recursive)
        .map_err(|e| format!("failed to watch directory: {}", e))?;

    // 存储到 app state 以保持 watcher 存活
    app.manage(WatcherState::default());
    let state = app.state::<WatcherState>();
    *state.lock().unwrap() = Some(debouncer);

    tracing::info!("file watcher started for: {:?}", root_path);
    Ok(())
}

/// 停止文件监听
pub fn stop_watcher(app: &AppHandle) {
    let state = app.state::<WatcherState>();
    *state.lock().unwrap() = None;
    tracing::info!("file watcher stopped");
}

/// 注册 Tauri 命令
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
            kind: "modified".into(),
            path: "/test/file.txt".into(),
        };
        let json = serde_json::to_string(&payload).unwrap();
        assert!(json.contains("modified"));
        assert!(json.contains("file.txt"));
        assert!(json.contains("path")); // 验证字段名
    }
}
