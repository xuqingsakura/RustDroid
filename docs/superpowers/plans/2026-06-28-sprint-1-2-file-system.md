# Sprint 1-2: 文件系统与文件树 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现文件系统浏览、文件树组件、右键菜单和最近项目功能，使用户能够打开项目文件夹并浏览/管理文件。

**Architecture:** Rust 后端通过 Tauri commands 封装 `tauri-plugin-fs` 和 `notify` crate，提供目录读取、文件 CRUD 和外部变更监听 API；前端通过 Zustand store 管理文件树状态，递归渲染目录结构，支持惰性加载和展开/折叠。

**Tech Stack:** Rust (tauri-plugin-fs 2.x, notify 8.x), React 19, Zustand 5, TypeScript 5

## Global Constraints

- 所有 Tauri command 返回 `IpcResult<T>` 统一错误类型
- 前端 Tauri IPC 调用通过 `src/api/` 层封装，不直接调用 `invoke`
- 文件树采用惰性加载：初始只读取根目录，展开时才加载子目录
- `notify` 事件去抖 300ms，避免频繁刷新 UI
- 最近项目列表持久化到 Tauri `app_data_dir/recent_projects.json`
- 文件路径使用 `PathBuf` 处理，Windows 路径含盘符（如 `C:\`）
- 所有新 Rust 代码标记 `#![forbid(unsafe_code)]`
- 带有 `#[serde(rename_all = "camelCase")]` 以匹配前端 TypeScript 命名

---

### Task 1: 后端 — 文件系统操作命令

**Files:**
- Create: `src-tauri/src/fs.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/capabilities/default.json`

**Interfaces:**
- Produces: `read_directory(path) -> Vec<FileEntry>` — 读取目录内容
- Produces: `read_file_text(path) -> FileContent` — 读取文件文本内容
- Produces: `write_file_text(path, content) -> ()` — 写入文本文件
- Produces: `create_file(path) -> ()` — 创建空文件
- Produces: `create_directory(path) -> ()` — 创建目录
- Produces: `delete_file(path) -> ()` — 删除文件或空目录
- Produces: `rename_file(old_path, new_path) -> ()` — 重命名文件/目录

- [ ] **Step 1: 创建 `src-tauri/src/fs.rs`，定义文件条目类型**

```rust
//! 文件系统操作命令
//!
//! 封装 tauri-plugin-fs，提供面向 IDE 场景的文件操作 API。
//! 所有路径均使用绝对路径。

use serde::Serialize;

/// 文件条目（单个文件或目录）
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    /// 文件/目录名（不含路径）
    pub name: String,
    /// 绝对路径
    pub path: String,
    /// 类型：file / directory / symlink
    #[serde(rename = "type")]
    pub kind: String,
    /// 文件大小（字节），目录为 null
    pub size: Option<u64>,
    /// 修改时间戳（Unix 毫秒）
    pub modified: u64,
}

/// 文件读取结果
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileContent {
    /// 文本内容
    pub content: String,
    /// 编码
    pub encoding: String,
    /// 文件大小（字节）
    pub size: u64,
}
```

- [ ] **Step 2: 实现 `read_directory` 命令**

```rust
use tauri::command;
use std::fs;
use std::path::Path;
use std::time::UNIX_EPOCH;
use ide_ipc::{IpcResult, IpcError};

/// 读取目录内容，返回文件条目列表
#[command]
pub fn read_directory(path: String) -> IpcResult<Vec<FileEntry>> {
    let dir = Path::new(&path);
    if !dir.is_dir() {
        return Err(IpcError::NotFound(format!("directory not found: {}", path)));
    }

    let mut entries = Vec::new();
    for entry in fs::read_dir(dir).map_err(|e| IpcError::Io(e.to_string()))? {
        let entry = entry.map_err(|e| IpcError::Io(e.to_string()))?;
        let metadata = entry.metadata().map_err(|e| IpcError::Io(e.to_string()))?;
        let file_type = entry.file_type().map_err(|e| IpcError::Io(e.to_string()))?;
        let modified = metadata.modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);

        entries.push(FileEntry {
            name: entry.file_name().to_string_lossy().to_string(),
            path: entry.path().to_string_lossy().to_string(),
            kind: if file_type.is_dir() { "directory".into() }
                  else if file_type.is_symlink() { "symlink".into() }
                  else { "file".into() },
            size: if metadata.is_dir() { None } else { Some(metadata.len()) },
            modified,
        });
    }

    // 排序：目录在前，文件在后，按名称字母序
    entries.sort_by(|a, b| {
        if a.kind != b.kind {
            if a.kind == "directory" { std::cmp::Ordering::Less }
            else { std::cmp::Ordering::Greater }
        } else {
            a.name.to_lowercase().cmp(&b.name.to_lowercase())
        }
    });

    Ok(entries)
}
```

- [ ] **Step 3: 实现 `read_file_text` 命令**

```rust
/// 读取文本文件内容
#[command]
pub fn read_file_text(path: String) -> IpcResult<FileContent> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err(IpcError::NotFound(format!("file not found: {}", path)));
    }
    let content = fs::read_to_string(p)
        .map_err(|e| IpcError::Io(format!("failed to read file (may not be text): {}", e)))?;
    let size = fs::metadata(p)
        .map(|m| m.len())
        .unwrap_or(0);

    Ok(FileContent {
        content,
        encoding: "utf-8".into(),
        size,
    })
}
```

- [ ] **Step 4: 实现文件写入/创建/删除/重命名命令**

```rust
/// 写入文本文件（创建或覆盖）
#[command]
pub fn write_file_text(path: String, content: String) -> IpcResult<()> {
    fs::write(&path, &content)
        .map_err(|e| IpcError::Io(format!("failed to write file: {}", e)))?;
    Ok(())
}

/// 创建空文件
#[command]
pub fn create_file(path: String) -> IpcResult<()> {
    let p = Path::new(&path);
    if p.exists() {
        return Err(IpcError::Generic(format!("file already exists: {}", path)));
    }
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| IpcError::Io(format!("failed to create parent dir: {}", e)))?;
    }
    fs::File::create(p)
        .map_err(|e| IpcError::Io(format!("failed to create file: {}", e)))?;
    Ok(())
}

/// 创建目录
#[command]
pub fn create_directory(path: String) -> IpcResult<()> {
    fs::create_dir_all(&path)
        .map_err(|e| IpcError::Io(format!("failed to create directory: {}", e)))?;
    Ok(())
}

/// 删除文件或空目录
#[command]
pub fn delete_file(path: String) -> IpcResult<()> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err(IpcError::NotFound(format!("path not found: {}", path)));
    }
    if p.is_dir() {
        fs::remove_dir(p)
            .map_err(|e| IpcError::Io(format!("failed to remove directory: {}", e)))?;
    } else {
        fs::remove_file(p)
            .map_err(|e| IpcError::Io(format!("failed to remove file: {}", e)))?;
    }
    Ok(())
}

/// 重命名文件或目录
#[command]
pub fn rename_file(old_path: String, new_path: String) -> IpcResult<()> {
    fs::rename(&old_path, &new_path)
        .map_err(|e| IpcError::Io(format!("failed to rename: {}", e)))?;
    Ok(())
}
```

- [ ] **Step 5: 在 `src-tauri/src/lib.rs` 中注册新命令并添加模块**

```rust
mod commands;
mod fs;      // 新增
mod watcher; // 新增（后续任务）
mod project; // 新增（后续任务）

// 在 invoke_handler 中注册：
.invoke_handler(tauri::generate_handler![
    commands::app_info,
    commands::app_version,
    // 文件系统命令
    fs::read_directory,
    fs::read_file_text,
    fs::write_file_text,
    fs::create_file,
    fs::create_directory,
    fs::delete_file,
    fs::rename_file,
])
```

- [ ] **Step 6: 更新 `capabilities/default.json` 添加详细 fs 权限**

```json
{
    "identifier": "default",
    "windows": ["main"],
    "permissions": [
        "core:default",
        "core:app:allow-version",
        "core:app:allow-name",
        "fs:default",
        "fs:allow-read",
        "fs:allow-write",
        "fs:allow-exists",
        "fs:allow-mkdir",
        "fs:allow-remove",
        "fs:allow-rename",
        "dialog:default",
        "dialog:allow-open",
        "dialog:allow-save"
    ]
}
```

- [ ] **Step 7: 写入 Rust 单元测试**

在 `src-tauri/src/fs.rs` 末尾添加测试模块：

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn test_read_directory_returns_entries() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("hello.txt"), "world").unwrap();
        fs::create_dir(dir.path().join("subdir")).unwrap();

        let entries = read_directory(dir.path().to_string_lossy().to_string()).unwrap();
        assert_eq!(entries.len(), 2);
        // 目录在前
        assert_eq!(entries[0].kind, "directory");
        assert_eq!(entries[1].kind, "file");
    }

    #[test]
    fn test_read_file_text_returns_content() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("test.txt");
        fs::write(&file_path, "Hello RustDroid").unwrap();

        let result = read_file_text(file_path.to_string_lossy().to_string()).unwrap();
        assert_eq!(result.content, "Hello RustDroid");
    }

    #[test]
    fn test_create_file_and_delete() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("newfile.txt");
        let path_str = file_path.to_string_lossy().to_string();

        create_file(path_str.clone()).unwrap();
        assert!(file_path.exists());

        delete_file(path_str.clone()).unwrap();
        assert!(!file_path.exists());
    }

    #[test]
    fn test_rename_file() {
        let dir = tempdir().unwrap();
        let old_path = dir.path().join("old.txt");
        let new_path = dir.path().join("new.txt");
        fs::write(&old_path, "content").unwrap();

        rename_file(
            old_path.to_string_lossy().to_string(),
            new_path.to_string_lossy().to_string(),
        ).unwrap();
        assert!(!old_path.exists());
        assert!(new_path.exists());
    }
}
```

- [ ] **Step 8: 添加 `tempfile` 到 dev 依赖并运行测试**

在 `src-tauri/Cargo.toml` 中添加：
```toml
[dev-dependencies]
tempfile = "3"
```

运行:
```bash
cd d:/RustDroid && cargo test -p rustdroid-ide --lib -- fs::tests 2>&1
```
预期输出: `running 4 tests` ... `test result: ok. 4 passed`

---

### Task 2: 后端 — 文件变更监听

**Files:**
- Create: `src-tauri/src/watcher.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/Cargo.toml`（添加 notify/channel 依赖）

**Interfaces:**
- Consumes: Tauri `AppHandle` for event emission
- Produces: 通过 `app.emit("rustdroid://file_changed", payload)` 推送文件变更事件
- Produces: `start_watcher(app_handle, root_path)` — 启动监听

- [ ] **Step 1: 在 `src-tauri/Cargo.toml` 中添加依赖**

```toml
[dependencies]
# ... 保持现有依赖 ...
notify = { version = "8", features = ["macos_kqueue"] }
notify-debouncer-mini = "0.4"
```

- [ ] **Step 2: 创建 `src-tauri/src/watcher.rs`**

```rust
//! 文件系统变更监听
//!
//! 使用 notify 监听项目目录的文件变更，通过 Tauri event 推送到前端。
//! 使用 debouncer 合并高频变更，间隔 300ms。

use notify_debouncer_mini::{notify::RecursiveMode, DebounceEventResult, Debouncer, new_debouncer};
use std::path::PathBuf;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use serde::Serialize;
use std::sync::Mutex;

/// 文件变更事件载荷
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileChangePayload {
    /// 变更类型
    pub kind: String, // "created" | "modified" | "deleted"
    /// 受影响的文件路径列表
    pub paths: Vec<String>,
}

/// 启动文件监听
///
/// 在独立线程中运行 debouncer，通过 Tauri event 推送变更。
pub fn start_watcher(app: AppHandle, root_path: PathBuf) -> Result<(), String> {
    let app_clone = app.clone();

    let mut debouncer: Debouncer<notify::RecommendedWatcher> =
        new_debouncer(Duration::from_millis(300), move |result: DebounceEventResult| {
            match result {
                Ok(events) => {
                    for event in events {
                        let kind = match event.kind {
                            notify::EventKind::Create(_) => "created",
                            notify::EventKind::Modify(_) => "modified",
                            notify::EventKind::Remove(_) => "deleted",
                            _ => continue, // 忽略其他事件类型
                        };

                        let paths: Vec<String> = event
                            .paths
                            .iter()
                            .map(|p| p.to_string_lossy().to_string())
                            .collect();

                        let payload = FileChangePayload {
                            kind: kind.to_string(),
                            paths,
                        };

                        let _ = app_clone.emit("rustdroid://file_changed", &payload);
                    }
                }
                Err(err) => {
                    tracing::warn!("file watcher error: {:?}", err);
                }
            }
        })
        .map_err(|e| format!("failed to create debouncer: {}", e))?;

    debouncer
        .watcher()
        .watch(&root_path, RecursiveMode::Recursive)
        .map_err(|e| format!("failed to watch directory: {}", e))?;

    // 防止 debouncer 被 drop
    // 注意：这里需要将 debouncer 持有在 AppHandle 的 managed state 中
    // 但 notify-debouncer-mini 的 Debouncer 不是 Send/Sync，需要特殊处理
    // 简化为存储 watcher channel 的 sender 端

    tracing::info!("file watcher started for: {:?}", root_path);

    Ok(())
}
```

- [ ] **Step 3: 处理 debouncer 生命周期 — 使用 `Arc<Mutex<Option<Debouncer>>>` 存储**

由于 `Debouncer` 需要活得和 app 一样长，将它存储到 Tauri managed state 中：

```rust
use std::sync::Arc;

type WatcherState = Arc<Mutex<Option<notify_debouncer_mini::Debouncer<notify::RecommendedWatcher>>>>;

/// 启动文件监听（改进版，支持生命周期管理）
pub fn start_watcher(
    app: &AppHandle,
    root_path: PathBuf,
) -> Result<(), String> {
    let app_clone = app.clone();

    let debouncer = new_debouncer(
        Duration::from_millis(300),
        move |result: DebounceEventResult| {
            match result {
                Ok(events) => {
                    for event in events {
                        let kind = match event.kind {
                            notify::EventKind::Create(_) => "created",
                            notify::EventKind::Modify(_) => "modified",
                            notify::EventKind::Remove(_) => "deleted",
                            _ => continue,
                        };
                        let paths: Vec<String> = event
                            .paths
                            .iter()
                            .map(|p| p.to_string_lossy().to_string())
                            .collect();
                        let _ = app_clone.emit("rustdroid://file_changed", &FileChangePayload {
                            kind: kind.to_string(),
                            paths,
                        });
                    }
                }
                Err(e) => tracing::warn!("watcher debounce error: {:?}", e),
            }
        },
    ).map_err(|e| format!("failed to create debouncer: {}", e))?;

    debouncer.watcher()
        .watch(&root_path, RecursiveMode::Recursive)
        .map_err(|e| format!("failed to watch: {}", e))?;

    // 存储到 app state
    app.manage(WatcherState::default());
    let state = app.state::<WatcherState>();
    *state.lock().unwrap() = Some(debouncer);

    tracing::info!("file watcher started for: {:?}", root_path);
    Ok(())
}
```

- [ ] **Step 4: 在 `src-tauri/src/lib.rs` 的 `setup` 中不自动启动 watcher（用户在打开项目时通过 command 启动）**

创建启动/停止 watcher 的命令：

```rust
/// 开始监听目录
#[command]
pub fn watch_directory(app: AppHandle, path: String) -> IpcResult<()> {
    watcher::start_watcher(&app, PathBuf::from(&path))
        .map_err(|e| IpcError::Generic(e))?;
    Ok(())
}

/// 停止监听
#[command]
pub fn unwatch_directory(app: AppHandle) -> IpcResult<()> {
    let state = app.state::<WatcherState>();
    *state.lock().unwrap() = None;
    tracing::info!("file watcher stopped");
    Ok(())
}
```

- [ ] **Step 5: 编写 watcher 单元测试**

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_file_change_payload_serialization() {
        let payload = FileChangePayload {
            kind: "modified".into(),
            paths: vec!["/test/file.txt".into()],
        };
        let json = serde_json::to_string(&payload).unwrap();
        assert!(json.contains("modified"));
        assert!(json.contains("file.txt"));
    }
}
```

- [ ] **Step 6: 编译验证**

```bash
cd d:/RustDroid && cargo build -p rustdroid-ide 2>&1
```
预期输出：编译成功，无错误。

---

### Task 3: 后端 — 项目管理与最近项目持久化

**Files:**
- Create: `src-tauri/src/project.rs`
- Modify: `src-tauri/src/lib.rs`

**Interfaces:**
- Produces: `open_project(path) -> ProjectInfo` — 打开项目目录，返回项目信息
- Produces: `get_recent_projects() -> Vec<RecentProject>` — 获取最近项目列表
- Produces: `add_recent_project(path) -> ()` — 添加项目到最近列表

- [ ] **Step 1: 创建 `src-tauri/src/project.rs`**

```rust
//! 项目管理
//!
//! 处理项目打开、最近项目列表持久化。
//! 最近项目数据存储在 app_data_dir/recent_projects.json。

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use ide_ipc::{IpcResult, IpcError};

/// 最近项目条目
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentProject {
    /// 项目名称（目录名）
    pub name: String,
    /// 完整路径
    pub path: String,
    /// 最后打开时间（ISO 8601）
    pub last_opened: String,
}

/// 项目信息
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInfo {
    /// 项目名称（目录名）
    pub name: String,
    /// 完整路径
    pub path: String,
    /// 是否是有效的 Android 项目
    pub is_android_project: bool,
    /// 文件数量
    pub file_count: usize,
}

const RECENT_FILE: &str = "recent_projects.json";
const MAX_RECENT: usize = 20;

/// 获取最近项目文件路径
fn recent_file_path(app: &AppHandle) -> PathBuf {
    app.path().app_data_dir().unwrap_or_else(|_| PathBuf::from(".")).join(RECENT_FILE)
}

/// 获取最近项目列表
#[command]
pub fn get_recent_projects(app: AppHandle) -> IpcResult<Vec<RecentProject>> {
    let path = recent_file_path(&app);
    if !path.exists() {
        return Ok(Vec::new());
    }
    let data = fs::read_to_string(&path)
        .map_err(|e| IpcError::Io(format!("failed to read recent projects: {}", e)))?;
    let projects: Vec<RecentProject> = serde_json::from_str(&data)
        .unwrap_or_default();
    Ok(projects)
}

/// 添加项目到最近列表
#[command]
pub fn add_recent_project(app: AppHandle, path: String) -> IpcResult<()> {
    let name = PathBuf::from(&path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "unknown".into());

    let now = chrono::Utc::now().to_rfc3339();
    let new_project = RecentProject {
        name,
        path,
        last_opened: now,
    };

    let mut projects = get_recent_projects(app.clone())?;

    // 如果已存在相同路径，移除旧的
    projects.retain(|p| p.path != new_project.path);

    // 插入到最前
    projects.insert(0, new_project);

    // 限制数量
    projects.truncate(MAX_RECENT);

    // 写入文件
    let file_path = recent_file_path(&app);
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| IpcError::Io(format!("failed to create app data dir: {}", e)))?;
    }
    let data = serde_json::to_string_pretty(&projects)
        .map_err(|e| IpcError::Generic(format!("serialization error: {}", e)))?;
    fs::write(&file_path, data)
        .map_err(|e| IpcError::Io(format!("failed to write recent projects: {}", e)))?;

    Ok(())
}

/// 打开项目（扫描目录并返回项目信息）
#[command]
pub fn open_project(path: String) -> IpcResult<ProjectInfo> {
    let dir = PathBuf::from(&path);
    if !dir.is_dir() {
        return Err(IpcError::NotFound(format!("directory not found: {}", path)));
    }

    let name = dir.file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| dir.to_string_lossy().to_string());

    // 检查是否是 Android 项目（有 build.gradle 或 build.gradle.kts）
    let has_build_gradle = dir.join("build.gradle").exists() || dir.join("build.gradle.kts").exists();
    let has_settings_gradle = dir.join("settings.gradle").exists() || dir.join("settings.gradle.kts").exists();
    let is_android_project = has_build_gradle || has_settings_gradle;

    // 扫描根目录文件数量（非递归，仅计数量）
    let file_count = fs::read_dir(&dir)
        .map(|entries| entries.count())
        .unwrap_or(0);

    Ok(ProjectInfo {
        name,
        path,
        is_android_project,
        file_count,
    })
}
```

- [ ] **Step 2: 在 `src-tauri/Cargo.toml` 中添加 `chrono` 依赖**

```toml
chrono = { version = "0.4", features = ["serde"] }
```

- [ ] **Step 3: 在 `lib.rs` 中注册项目命令**

```rust
.invoke_handler(tauri::generate_handler![
    // ... 已有命令 ...
    project::open_project,
    project::get_recent_projects,
    project::add_recent_project,
])
```

- [ ] **Step 4: 在 `lib.rs` 的 `setup` 中确保 app_data_dir 存在**

```rust
.setup(|app| {
    // 确保 app_data_dir 存在
    if let Ok(data_dir) = app.path().app_data_dir() {
        let _ = std::fs::create_dir_all(&data_dir);
        tracing::info!("app data dir: {:?}", data_dir);
    }
    tracing::info!("tauri app setup complete");
    Ok(())
})
```

- [ ] **Step 5: 编写单元测试**

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_recent_project_serialization() {
        let project = RecentProject {
            name: "MyApp".into(),
            path: "/projects/MyApp".into(),
            last_opened: "2026-01-01T00:00:00Z".into(),
        };
        let json = serde_json::to_string(&project).unwrap();
        assert!(json.contains("myApp")); // camelCase
    }

    #[test]
    fn test_android_project_detection() {
        let dir = tempfile::tempdir().unwrap();
        // 没有 gradle 文件，不是 Android 项目
        let info = open_project(dir.path().to_string_lossy().to_string()).unwrap();
        assert!(!info.is_android_project);

        // 添加 build.gradle.kts
        std::fs::write(dir.path().join("build.gradle.kts"), "").unwrap();
        let info = open_project(dir.path().to_string_lossy().to_string()).unwrap();
        assert!(info.is_android_project);
    }
}
```

- [ ] **Step 6: 编译测试**

```bash
cd d:/RustDroid && cargo build -p rustdroid-ide 2>&1
cargo test -p rustdroid-ide --lib 2>&1
```

---

### Task 4: 前端 — 文件系统 API 层与状态管理

**Files:**
- Create: `src/types/fs.ts`
- Create: `src/api/fs.ts`
- Create: `src/store/fileStore.ts`
- Modify: `src/store/appStore.ts`（可选，添加项目路径状态）

**Interfaces:**
- Produces: `fsApi.readDirectory(path)` → `FileEntry[]`
- Produces: `fsApi.readFileText(path)` → `FileContent`
- Produces: `fsApi.writeFileText(path, content)` → `void`
- Produces: `fsApi.createFile(path)` / `createDirectory(path)` → `void`
- Produces: `fsApi.deleteFile(path)` → `void`
- Produces: `fsApi.renameFile(oldPath, newPath)` → `void`
- Produces: `fsApi.openProject(path)` → `ProjectInfo`
- Produces: `fsApi.getRecentProjects()` → `RecentProject[]`
- Produces: `fsApi.addRecentProject(path)` → `void`
- Produces: `useFileStore` — Zustand store 管理文件树状态

- [ ] **Step 1: 创建 `src/types/fs.ts`**

```typescript
/** 文件条目 */
export interface FileEntry {
  name: string;
  path: string;
  /** "file" | "directory" | "symlink" */
  type: 'file' | 'directory' | 'symlink';
  size?: number;
  modified: number;
}

/** 文件读取结果 */
export interface FileContent {
  content: string;
  encoding: string;
  size: number;
}

/** 文件变更事件 */
export interface FileChangeEvent {
  kind: 'created' | 'modified' | 'deleted';
  paths: string[];
}

/** 最近项目 */
export interface RecentProject {
  name: string;
  path: string;
  lastOpened: string;
}

/** 项目信息 */
export interface ProjectInfo {
  name: string;
  path: string;
  isAndroidProject: boolean;
  fileCount: number;
}
```

- [ ] **Step 2: 创建 `src/api/fs.ts`**

```typescript
import { invoke } from '@tauri-apps/api/core';
import type { FileEntry, FileContent, RecentProject, ProjectInfo } from '../types/fs';

/** 文件系统操作 API */
export const fsApi = {
  /** 读取目录内容 */
  readDirectory(path: string): Promise<FileEntry[]> {
    return invoke<FileEntry[]>('read_directory', { path });
  },

  /** 读取文本文件 */
  readFileText(path: string): Promise<FileContent> {
    return invoke<FileContent>('read_file_text', { path });
  },

  /** 写入文本文件 */
  writeFileText(path: string, content: string): Promise<void> {
    return invoke<void>('write_file_text', { path, content });
  },

  /** 创建文件 */
  createFile(path: string): Promise<void> {
    return invoke<void>('create_file', { path });
  },

  /** 创建目录 */
  createDirectory(path: string): Promise<void> {
    return invoke<void>('create_directory', { path });
  },

  /** 删除文件或目录 */
  deleteFile(path: string): Promise<void> {
    return invoke<void>('delete_file', { path });
  },

  /** 重命名 */
  renameFile(oldPath: string, newPath: string): Promise<void> {
    return invoke<void>('rename_file', { oldPath, newPath });
  },

  /** 打开项目 */
  openProject(path: string): Promise<ProjectInfo> {
    return invoke<ProjectInfo>('open_project', { path });
  },

  /** 获取最近项目 */
  getRecentProjects(): Promise<RecentProject[]> {
    return invoke<RecentProject[]>('get_recent_projects');
  },

  /** 添加最近项目 */
  addRecentProject(path: string): Promise<void> {
    return invoke<void>('add_recent_project', { path });
  },
};
```

- [ ] **Step 3: 创建 `src/store/fileStore.ts`**

```typescript
import { create } from 'zustand';
import type { FileEntry } from '../types/fs';
import { fsApi } from '../api/fs';

interface FileStoreState {
  /** 当前项目根路径 */
  projectPath: string | null;
  /** 项目名称 */
  projectName: string;
  /** 根目录文件/目录列表 */
  rootEntries: FileEntry[];
  /** 子目录缓存（path → FileEntry[]） */
  dirCache: Record<string, FileEntry[]>;
  /** 展开的目录路径集合 */
  expandedPaths: Set<string>;
  /** 当前选中文件路径 */
  selectedFile: string | null;
  /** 打开的编辑器文件路径列表 */
  openFiles: string[];
  /** 加载状态 */
  loading: boolean;

  // Actions
  setProjectPath: (path: string | null) => void;
  loadRootEntries: () => Promise<void>;
  loadDirectory: (path: string) => Promise<FileEntry[]>;
  toggleExpand: (path: string) => Promise<void>;
  selectFile: (path: string | null) => void;
  addOpenFile: (path: string) => void;
  removeOpenFile: (path: string) => void;
  refreshRoot: () => Promise<void>;
}

export const useFileStore = create<FileStoreState>((set, get) => ({
  projectPath: null,
  projectName: '',
  rootEntries: [],
  dirCache: {},
  expandedPaths: new Set(),
  selectedFile: null,
  openFiles: [],
  loading: false,

  setProjectPath: (path) => {
    set({
      projectPath: path,
      projectName: path ? path.split('\\').pop()?.split('/').pop() ?? '' : '',
      rootEntries: [],
      dirCache: {},
      expandedPaths: new Set(),
      selectedFile: null,
      openFiles: [],
    });
  },

  loadRootEntries: async () => {
    const { projectPath } = get();
    if (!projectPath) return;
    set({ loading: true });
    try {
      const entries = await fsApi.readDirectory(projectPath);
      set({ rootEntries: entries, loading: false });
    } catch (e) {
      console.error('Failed to load root entries:', e);
      set({ loading: false });
    }
  },

  loadDirectory: async (path: string) => {
    try {
      const entries = await fsApi.readDirectory(path);
      set((state) => ({
        dirCache: { ...state.dirCache, [path]: entries },
      }));
      return entries;
    } catch (e) {
      console.error('Failed to load directory:', path, e);
      return [];
    }
  },

  toggleExpand: async (path: string) => {
    const { expandedPaths, dirCache } = get();
    const newExpanded = new Set(expandedPaths);

    if (newExpanded.has(path)) {
      newExpanded.delete(path);
      set({ expandedPaths: newExpanded });
    } else {
      newExpanded.add(path);
      set({ expandedPaths: newExpanded });
      // 惰性加载子目录（如未缓存）
      if (!dirCache[path]) {
        await get().loadDirectory(path);
      }
    }
  },

  selectFile: (path) => set({ selectedFile: path }),

  addOpenFile: (path) => {
    const { openFiles } = get();
    if (!openFiles.includes(path)) {
      set({ openFiles: [...openFiles, path] });
    }
  },

  removeOpenFile: (path) => {
    set((state) => ({
      openFiles: state.openFiles.filter((f) => f !== path),
    }));
  },

  refreshRoot: async () => {
    await get().loadRootEntries();
    // 同时刷新所有已展开的目录
    const { expandedPaths } = get();
    for (const dirPath of expandedPaths) {
      await get().loadDirectory(dirPath);
    }
  },
}));
```

---

### Task 5: 前端 — 文件树组件与交互

**Files:**
- Create: `src/components/FileTree.tsx`
- Create: `src/components/FileTreeItem.tsx`
- Create: `src/components/ContextMenu.tsx`
- Create: `src/components/FileTree.css`

- [ ] **Step 1: 创建 `src/components/FileTreeItem.tsx`**

```tsx
import { useState } from 'react';
import type { FileEntry } from '../types/fs';

interface FileTreeItemProps {
  entry: FileEntry;
  depth: number;
  isExpanded: boolean;
  isSelected: boolean;
  hasChildren: boolean;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
  onContextMenu: (e: React.MouseEvent, path: string) => void;
}

/** 文件/目录名对应的图标 */
function fileIcon(name: string, type: string, isDirExpanded: boolean): string {
  if (type === 'directory') return isDirExpanded ? '📂' : '📁';
  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'kt': case 'kts': return '🟣';
    case 'java': return '🟡';
    case 'xml': return '🔵';
    case 'gradle': return '🟠';
    case 'json': return '⚪';
    case 'md': return '📝';
    case 'png': case 'jpg': case 'svg': return '🖼️';
    default: return '📄';
  }
}

export function FileTreeItem({ entry, depth, isExpanded, isSelected, hasChildren, onToggle, onSelect, onContextMenu }: FileTreeItemProps) {
  const handleClick = () => {
    if (entry.type === 'directory') {
      onToggle(entry.path);
    } else {
      onSelect(entry.path);
    }
  };

  return (
    <div
      className={`file-tree-item ${isSelected ? 'selected' : ''}`}
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
      onClick={handleClick}
      onContextMenu={(e) => onContextMenu(e, entry.path)}
    >
      <span className="file-tree-item-icon">
        {entry.type === 'directory' && (
          <span className={`chevron ${isExpanded ? 'expanded' : ''}`}>▶</span>
        )}
        <span className="file-icon">{fileIcon(entry.name, entry.type, isExpanded)}</span>
      </span>
      <span className="file-tree-item-name">{entry.name}</span>
    </div>
  );
}
```

- [ ] **Step 2: 创建 `src/components/FileTree.tsx`**

```tsx
import { useEffect, useCallback } from 'react';
import { useFileStore } from '../store/fileStore';
import { FileTreeItem } from './FileTreeItem';
import { fsApi } from '../api/fs';
import './FileTree.css';

interface FileTreeProps {
  onContextMenu: (e: React.MouseEvent, path: string) => void;
}

/** 递归渲染文件树节点 */
function renderTreeItems(
  entries: { entry: FileEntry; depth: number }[],
  expandedPaths: Set<string>,
  dirCache: Record<string, FileEntry[]>,
  selectedFile: string | null,
  onToggle: (path: string) => void,
  onSelect: (path: string) => void,
  onContextMenu: (e: React.MouseEvent, path: string) => void,
): React.ReactNode[] {
  const items: React.ReactNode[] = [];

  for (const { entry, depth } of entries) {
    const isExpanded = expandedPaths.has(entry.path);
    const isSelected = selectedFile === entry.path;
    const hasChildren = entry.type === 'directory';

    items.push(
      <FileTreeItem
        key={entry.path}
        entry={entry}
        depth={depth}
        isExpanded={isExpanded}
        isSelected={isSelected}
        hasChildren={hasChildren}
        onToggle={onToggle}
        onSelect={onSelect}
        onContextMenu={onContextMenu}
      />,
    );

    // 如果目录已展开且有缓存，递归渲染子项
    if (isExpanded && entry.type === 'directory' && dirCache[entry.path]) {
      const children = dirCache[entry.path].map((child) => ({
        entry: child,
        depth: depth + 1,
      }));
      // 必须检查 children.length > 0 否则不渲染子项
      if (children.length > 0) {
        items.push(
          ...renderTreeItems(
            children,
            expandedPaths,
            dirCache,
            selectedFile,
            onToggle,
            onSelect,
            onContextMenu,
          ),
        );
      }
    }
  }

  return items;
}

export function FileTree({ onContextMenu }: FileTreeProps) {
  const {
    projectPath,
    rootEntries,
    expandedPaths,
    dirCache,
    selectedFile,
    loading,
    loadRootEntries,
    toggleExpand,
    selectFile,
  } = useFileStore();

  useEffect(() => {
    if (projectPath) {
      loadRootEntries();
    }
  }, [projectPath, loadRootEntries]);

  const handleSelect = useCallback((path: string) => {
    selectFile(path);
    // 打开文件时触发回调
    fsApi.readFileText(path).then((content) => {
      console.log('File opened:', path, 'size:', content.size);
    }).catch(console.error);
  }, [selectFile]);

  if (!projectPath) {
    return <div className="file-tree-empty">未打开项目</div>;
  }

  if (loading) {
    return <div className="file-tree-loading">加载中...</div>;
  }

  const topLevelItems = rootEntries.map((entry) => ({ entry, depth: 0 }));

  return (
    <div className="file-tree">
      <div className="file-tree-header">
        <span className="file-tree-title">{useFileStore.getState().projectName}</span>
      </div>
      <div className="file-tree-content">
        {renderTreeItems(
          topLevelItems,
          expandedPaths,
          dirCache,
          selectedFile,
          toggleExpand,
          handleSelect,
          onContextMenu,
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 创建 `src/components/ContextMenu.tsx`**

```tsx
import { useEffect, useRef } from 'react';

export interface ContextMenuItem {
  label: string;
  shortcut?: string;
  disabled?: boolean;
  divider?: boolean;
  onClick: () => void;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="context-menu"
      style={{ left: x, top: y }}
    >
      {items.map((item, i) =>
        item.divider ? (
          <div key={i} className="context-menu-divider" />
        ) : (
          <div
            key={i}
            className={`context-menu-item ${item.disabled ? 'disabled' : ''}`}
            onClick={() => {
              if (!item.disabled) {
                item.onClick();
                onClose();
              }
            }}
          >
            <span className="context-menu-label">{item.label}</span>
            {item.shortcut && <span className="context-menu-shortcut">{item.shortcut}</span>}
          </div>
        ),
      )}
    </div>
  );
}
```

- [ ] **Step 4: 创建 `src/components/FileTree.css`**

```css
/* 文件树 */
.file-tree {
  display: flex;
  flex-direction: column;
  height: 100%;
  user-select: none;
}

.file-tree-header {
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
  border-bottom: 1px solid var(--rule);
}

.file-tree-content {
  flex: 1;
  overflow-y: auto;
  padding: 0.25rem 0;
}

.file-tree-empty,
.file-tree-loading {
  padding: 1rem;
  color: var(--muted);
  text-align: center;
  font-size: 0.85rem;
}

/* 文件树项目 */
.file-tree-item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2rem 0.5rem;
  cursor: pointer;
  font-size: 0.85rem;
  color: var(--muted2);
  white-space: nowrap;
  transition: background 0.1s;
}

.file-tree-item:hover {
  background: var(--bg3);
}

.file-tree-item.selected {
  background: rgba(122, 162, 247, 0.15);
  color: var(--ink);
}

.file-tree-item-icon {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
}

.chevron {
  font-size: 0.6rem;
  transition: transform 0.15s;
  width: 10px;
  display: inline-block;
}

.chevron.expanded {
  transform: rotate(90deg);
}

.file-icon {
  font-size: 0.9rem;
  line-height: 1;
}

.file-tree-item-name {
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 右键菜单 */
.context-menu {
  position: fixed;
  z-index: 1000;
  min-width: 180px;
  background: var(--bg2);
  border: 1px solid var(--rule);
  border-radius: 6px;
  padding: 0.25rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.context-menu-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.35rem 0.75rem;
  font-size: 0.82rem;
  color: var(--ink);
  cursor: pointer;
  border-radius: 4px;
}

.context-menu-item:hover {
  background: var(--accent);
  color: #fff;
}

.context-menu-item.disabled {
  color: var(--muted);
  cursor: not-allowed;
}

.context-menu-item.disabled:hover {
  background: transparent;
  color: var(--muted);
}

.context-menu-divider {
  height: 1px;
  background: var(--rule);
  margin: 0.25rem 0.5rem;
}

.context-menu-shortcut {
  font-size: 0.75rem;
  color: var(--muted);
  margin-left: 1.5rem;
  font-family: 'JetBrains Mono', monospace;
}
```

---

### Task 6: 前端 — 最近项目组件与应用集成

**Files:**
- Create: `src/components/RecentProjects.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles/global.css`

- [ ] **Step 1: 创建 `src/components/RecentProjects.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { fsApi } from '../api/fs';
import { useFileStore } from '../store/fileStore';
import type { RecentProject } from '../types/fs';

interface RecentProjectsProps {
  onSelectProject: (path: string) => void;
}

export function RecentProjects({ onSelectProject }: RecentProjectsProps) {
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fsApi.getRecentProjects()
      .then(setRecentProjects)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleOpenProject = async (path: string) => {
    try {
      const info = await fsApi.openProject(path);
      await fsApi.addRecentProject(path);
      onSelectProject(path);
    } catch (e) {
      console.error('Failed to open project:', e);
    }
  };

  if (loading) return null;

  return (
    <div className="recent-projects">
      {recentProjects.length > 0 && (
        <>
          <h3 className="recent-projects-title">最近项目</h3>
          <ul className="recent-projects-list">
            {recentProjects.map((project) => (
              <li
                key={project.path}
                className="recent-project-item"
                onClick={() => handleOpenProject(project.path)}
              >
                <span className="recent-project-name">{project.name}</span>
                <span className="recent-project-path">{project.path}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 修改 `src/App.tsx` — 集成文件树和最近项目**

```tsx
import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from './store/appStore';
import { useFileStore } from './store/fileStore';
import { getVersion } from './api/app';
import { FileTree } from './components/FileTree';
import { RecentProjects } from './components/RecentProjects';
import { ContextMenu } from './components/ContextMenu';
import type { ContextMenuItem } from './components/ContextMenu';
import { fsApi } from './api/fs';
import './styles/global.css';

export default function App() {
  const { version, setVersion, theme, setTheme } = useAppStore();
  const { projectPath, setProjectPath, refreshRoot, selectFile, selectedFile } = useFileStore();

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null);
  const [view, setView] = useState<'welcome' | 'editor'>('welcome');

  // 获取版本号
  useEffect(() => {
    getVersion().then(setVersion).catch(console.error);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOpenProject = useCallback(async (path: string) => {
    try {
      const info = await fsApi.openProject(path);
      await fsApi.addRecentProject(path);
      setProjectPath(path);
      setView('editor');
    } catch (e) {
      console.error('Failed to open project:', e);
    }
  }, [setProjectPath]);

  const handleFileContextMenu = useCallback((e: React.MouseEvent, path: string) => {
    e.preventDefault();
    const items: ContextMenuItem[] = [
      { label: '打开', onClick: () => selectFile(path) },
      { label: '重命名', onClick: () => {
        const newName = prompt('新文件名:');
        if (newName) {
          const dir = path.substring(0, path.lastIndexOf('\\'));
          fsApi.renameFile(path, `${dir}\\${newName}`).then(() => refreshRoot());
        }
      }},
      { label: '删除', onClick: () => {
        if (confirm('确定删除?')) {
          fsApi.deleteFile(path).then(() => {
            refreshRoot();
            if (selectedFile === path) selectFile(null);
          });
        }
      }},
      { label: '', onClick: () => {}, divider: true },
      { label: '新建文件', onClick: () => {
        const name = prompt('文件名:');
        if (name) {
          const dir = path.substring(0, path.lastIndexOf('\\'));
          fsApi.createFile(`${dir}\\${name}`).then(() => refreshRoot());
        }
      }},
      { label: '新建目录', shortcut: '', onClick: () => {
        const name = prompt('目录名:');
        if (name) {
          const dir = path.substring(0, path.lastIndexOf('\\'));
          fsApi.createDirectory(`${dir}\\${name}`).then(() => refreshRoot());
        }
      }},
    ];
    setContextMenu({ x: e.clientX, y: e.clientY, items });
  }, [selectedFile, selectFile, refreshRoot]);

  // 欢迎页
  if (view === 'welcome') {
    return (
      <div className="app-shell" data-theme={theme}>
        <main className="welcome-main">
          <div className="welcome-hero">
            <h1 className="welcome-title">RustDroid</h1>
            <p className="welcome-sub">轻量级 Android IDE</p>
            <span className="welcome-version">v{version}</span>
          </div>

          <div className="welcome-actions">
            <button className="welcome-btn" onClick={() => {
              // 使用 Tauri dialog 打开文件夹选择器
              import('@tauri-apps/plugin-dialog').then(({ open }) => {
                open({ directory: true, multiple: false, title: '选择项目文件夹' })
                  .then((path) => { if (path) handleOpenProject(path as string); });
              });
            }}>
              📂 打开项目
            </button>
            <button className="welcome-btn" disabled>
              ➕ 新建项目
            </button>
            <button className="welcome-btn" disabled>
              📦 克隆仓库
            </button>
          </div>

          <RecentProjects onSelectProject={handleOpenProject} />
        </main>
      </div>
    );
  }

  // 编辑器视图
  return (
    <div className="app-shell" data-theme={theme}>
      <div className="ide-layout">
        {/* 活动栏 - 46px */}
        <div className="activity-bar">
          <button className="activity-btn active" title="文件">📁</button>
          <button className="activity-btn" title="搜索" disabled>🔍</button>
          <button className="activity-btn" title="Git" disabled>⎇</button>
          <div className="activity-spacer" />
          <button className="activity-btn" title="设置" disabled>⚙</button>
        </div>

        {/* 侧边栏 - 文件树 */}
        <div className="sidebar">
          <FileTree onContextMenu={handleFileContextMenu} />
        </div>

        {/* 编辑器区域 */}
        <div className="editor-area">
          <div className="editor-tabs">
            {selectedFile && (
              <div className="editor-tab active">
                {selectedFile.split('\\').pop()?.split('/').pop()}
              </div>
            )}
          </div>
          <div className="editor-content">
            {selectedFile ? (
              <p className="editor-placeholder">打开文件: {selectedFile}</p>
            ) : (
              <div className="welcome-hero" style={{ padding: '2rem' }}>
                <h2 className="welcome-title" style={{ fontSize: '1.5rem' }}>RustDroid IDE</h2>
                <p className="welcome-sub">选择一个文件开始编辑</p>
              </div>
            )}
          </div>
        </div>

        {/* 状态栏 */}
        <div className="status-bar">
          <span>RustDroid IDE v{version}</span>
          {selectedFile && <span>{selectedFile.split('\\').pop()}</span>}
        </div>
      </div>

      {/* 右键菜单 */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: 更新 `src/styles/global.css` — 添加 IDE 布局与欢迎页样式**

在文件末尾添加：

```css
/* ===== 欢迎页 ===== */
.welcome-main {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  gap: 2rem;
  padding: 2rem;
}

.welcome-hero {
  text-align: center;
}

.welcome-title {
  font-size: 2.5rem;
  font-weight: 300;
  letter-spacing: -0.03em;
  color: var(--orange);
}

.welcome-sub {
  font-size: 0.95rem;
  color: var(--muted2);
  margin-top: 0.25rem;
}

.welcome-version {
  font-size: 0.75rem;
  color: var(--muted);
  font-family: 'JetBrains Mono', monospace;
}

.welcome-actions {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  justify-content: center;
}

.welcome-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: var(--bg2);
  border: 1px solid var(--rule);
  border-radius: 8px;
  color: var(--ink);
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.15s;
}

.welcome-btn:hover:not(:disabled) {
  background: var(--bg3);
  border-color: var(--accent);
}

.welcome-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.recent-projects {
  width: 100%;
  max-width: 400px;
}

.recent-projects-title {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
  margin-bottom: 0.5rem;
}

.recent-projects-list {
  list-style: none;
  padding: 0;
}

.recent-project-item {
  display: flex;
  flex-direction: column;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.15s;
}

.recent-project-item:hover {
  background: var(--bg2);
}

.recent-project-name {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--ink);
}

.recent-project-path {
  font-size: 0.75rem;
  color: var(--muted);
  font-family: 'JetBrains Mono', monospace;
}

/* ===== IDE 布局 ===== */
.ide-layout {
  display: grid;
  grid-template-columns: 46px 260px 1fr;
  grid-template-rows: 1fr auto;
  height: 100vh;
  overflow: hidden;
}

.activity-bar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 0.5rem 0;
  background: var(--bg2);
  border-right: 1px solid var(--rule);
  grid-row: 1 / -1;
}

.activity-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 1rem;
  cursor: pointer;
  border-radius: 4px;
}

.activity-btn:hover:not(:disabled) {
  background: var(--bg3);
  color: var(--ink);
}

.activity-btn.active {
  color: var(--accent);
  border-left: 2px solid var(--accent);
  border-radius: 0;
}

.activity-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.activity-spacer {
  flex: 1;
}

.sidebar {
  background: var(--bg);
  border-right: 1px solid var(--rule);
  overflow: hidden;
}

.editor-area {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg);
}

.editor-tabs {
  display: flex;
  background: var(--bg2);
  border-bottom: 1px solid var(--rule);
  min-height: 32px;
}

.editor-tab {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.3rem 0.75rem;
  font-size: 0.8rem;
  color: var(--muted);
  border-right: 1px solid var(--rule);
  cursor: pointer;
}

.editor-tab.active {
  background: var(--bg);
  color: var(--ink);
  border-bottom: 2px solid var(--accent);
}

.editor-content {
  flex: 1;
  overflow: auto;
}

.editor-placeholder {
  padding: 1rem;
  color: var(--muted);
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.85rem;
}

.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0.75rem;
  height: 24px;
  background: var(--bg2);
  border-top: 1px solid var(--rule);
  font-size: 0.72rem;
  color: var(--muted);
  grid-column: 1 / -1;
}
```

---

### Task 7: 编译验证与集成测试

**Files:** 无新建文件

- [ ] **Step 1: 完整编译 Rust 后端**

```bash
cd d:/RustDroid && cargo build -p rustdroid-ide 2>&1
```
预期输出：编译成功，无警告。

- [ ] **Step 2: 运行 Rust 单元测试**

```bash
cd d:/RustDroid && cargo test -p rustdroid-ide 2>&1
```
预期输出：`test result: ok. N passed; 0 failed`

- [ ] **Step 3: 检查前端 TypeScript 编译**

```bash
cd d:/RustDroid && npx tsc --noEmit 2>&1
```
预期输出：无类型错误。

- [ ] **Step 4: 前端 Vite 构建**

```bash
cd d:/RustDroid && npx vite build 2>&1
```
预期输出：构建成功，输出到 `dist/` 目录。
