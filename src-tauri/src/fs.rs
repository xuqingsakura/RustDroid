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

/// 尝试检测并解码文本文件
fn read_text_file(path: &Path) -> Result<(String, String), IpcError> {
    let bytes = fs::read(path).map_err(|e| IpcError::Io(e.to_string()))?;

    // 尝试 UTF-8（从切片借用，不 clone）
    if let Ok(text) = String::from_utf8(bytes) {
        return Ok((text, "utf-8".into()));
    }
    // 到这里说明 bytes 已 move 失败，重新读取
    let bytes = fs::read(path).map_err(|e| IpcError::Io(e.to_string()))?;

    // 尝试 GBK（Windows 中文常用编码）
    let (text, _, had_errors) = encoding_rs::GBK.decode(&bytes);
    if !had_errors {
        return Ok((text.into(), "gbk".into()));
    }

    // 回退：UTF-8 lossy 转换
    let text = String::from_utf8_lossy(&bytes).to_string();
    Ok((text, "utf-8-lossy".into()))
}

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

/// 大文件阈值（5MB）
const LARGE_FILE_THRESHOLD: u64 = 5 * 1024 * 1024;

/// 读取文本文件内容（自动检测编码：UTF-8 → GBK → lossy）
#[command]
pub fn read_file_text(path: String) -> IpcResult<FileContent> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err(IpcError::NotFound(format!("file not found: {}", path)));
    }

    // 大文件检查
    if let Ok(meta) = p.metadata() {
        if meta.len() > LARGE_FILE_THRESHOLD {
            return Err(IpcError::Generic(format!(
                "file too large ({} MB). Max: 5 MB",
                meta.len() / 1024 / 1024
            )));
        }
    }

    let (content, encoding) = read_text_file(p)?;
    let size = p.metadata().map(|m| m.len()).unwrap_or(0);

    Ok(FileContent {
        content,
        encoding,
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
