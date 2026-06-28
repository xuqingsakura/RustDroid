//! Uri 类型：统一的资源定位符，用于标识文件、内存文档等

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

/// 统一资源标识符
///
/// 当前实现仅支持文件路径方案（file://），后续可扩展到内存文档、
/// 虚拟文件系统（如 APK 内资源）等场景。
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Uri {
    /// 规范化后的路径（绝对路径）
    path: PathBuf,
}

impl Uri {
    /// 从文件路径创建 Uri
    pub fn from_file_path<P: Into<PathBuf>>(path: P) -> Self {
        let path = path.into();
        // 规范化：转换为绝对路径（若相对则基于 cwd）
        let path = if path.is_absolute() {
            path
        } else {
            std::env::current_dir().unwrap_or_default().join(path)
        };
        Self { path }
    }

    /// 获取底层路径
    pub fn path(&self) -> &Path {
        &self.path
    }

    /// 转为字符串形式的 URI（file:// 协议）
    pub fn as_str(&self) -> String {
        // 简化实现：仅 Windows 路径需要特殊处理盘符
        let path_str = self.path.to_string_lossy();
        if cfg!(windows) {
            // C:\foo -> file:///C:/foo
            let normalized = path_str.replace('\\', "/");
            format!("file:///{}", normalized)
        } else {
            format!("file://{}", path_str)
        }
    }

    /// 从 file:// URI 字符串解析
    pub fn parse(uri: &str) -> Result<Self, UriParseError> {
        let path = if let Some(rest) = uri.strip_prefix("file://") {
            let rest = rest.trim_start_matches('/');
            if cfg!(windows) {
                // file:///C:/foo -> C:\foo
                PathBuf::from(rest.replace('/', "\\"))
            } else {
                PathBuf::from(format!("/{}", rest))
            }
        } else {
            // 无前缀，直接当路径处理
            PathBuf::from(uri)
        };
        Ok(Self { path })
    }
}

impl std::fmt::Display for Uri {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

impl From<PathBuf> for Uri {
    fn from(path: PathBuf) -> Self {
        Self::from_file_path(path)
    }
}

impl AsRef<Path> for Uri {
    fn as_ref(&self) -> &Path {
        &self.path
    }
}

/// URI 解析错误
#[derive(Debug, thiserror::Error)]
pub enum UriParseError {
    #[error("invalid URI format: {0}")]
    InvalidFormat(String),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip_file_path() {
        let path = if cfg!(windows) {
            r"C:\Users\test\file.txt"
        } else {
            "/home/test/file.txt"
        };
        let uri = Uri::from_file_path(path);
        let parsed = Uri::parse(&uri.as_str()).unwrap();
        assert_eq!(uri.path(), parsed.path());
    }

    #[test]
    fn as_str_starts_with_file() {
        let uri = Uri::from_file_path("/tmp/test.txt");
        assert!(uri.as_str().starts_with("file://"));
    }
}
