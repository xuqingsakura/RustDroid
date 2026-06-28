//! 文件系统操作命令
//!
//! 封装 tauri-plugin-fs，提供面向 IDE 场景的文件操作 API。
//! 所有路径均使用绝对路径。

#![forbid(unsafe_code)]

use serde::Serialize;
use std::fs;
use std::path::Path;
use std::time::UNIX_EPOCH;
use ide_ipc::{IpcResult, IpcError};
use tauri::command;

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
        let modified = metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);

        entries.push(FileEntry {
            name: entry.file_name().to_string_lossy().to_string(),
            path: entry.path().to_string_lossy().to_string(),
            kind: if file_type.is_dir() {
                "directory".into()
            } else if file_type.is_symlink() {
                "symlink".into()
            } else {
                "file".into()
            },
            size: if metadata.is_dir() { None } else { Some(metadata.len()) },
            modified,
        });
    }

    // 排序：目录在前，文件在后，按名称字母序
    entries.sort_by(|a, b| {
        if a.kind != b.kind {
            if a.kind == "directory" {
                std::cmp::Ordering::Less
            } else {
                std::cmp::Ordering::Greater
            }
        } else {
            a.name.to_lowercase().cmp(&b.name.to_lowercase())
        }
    });

    Ok(entries)
}

/// 读取文本文件内容
#[command]
pub fn read_file_text(path: String) -> IpcResult<FileContent> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err(IpcError::NotFound(format!("file not found: {}", path)));
    }
    let content = fs::read_to_string(p)
        .map_err(|e| IpcError::Io(format!("failed to read file (may not be text): {}", e)))?;
    let size = fs::metadata(p).map(|m| m.len()).unwrap_or(0);

    Ok(FileContent {
        content,
        encoding: "utf-8".into(),
        size,
    })
}

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
        )
        .unwrap();
        assert!(!old_path.exists());
        assert!(new_path.exists());
    }
}
