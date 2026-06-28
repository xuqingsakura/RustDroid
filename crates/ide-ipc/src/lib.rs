//! ide-ipc: Tauri command/event 共享类型
//!
//! 定义前端 ↔ Rust 后端通过 Tauri IPC 传递的请求/响应/事件类型。
//! 所有类型均实现 Serialize/Deserialize，字段命名采用 camelCase（与前端 TS 一致）。

#![forbid(unsafe_code)]
#![warn(missing_docs)]

mod app;
mod event;

pub use app::AppInfo;
pub use event::{EventKind, EventPayload, IpcEvent};

/// 所有 Tauri command 的统一错误类型
#[derive(Debug, serde::Serialize)]
#[serde(tag = "kind", content = "message")]
pub enum IpcError {
    /// 通用错误
    #[serde(rename = "error")]
    Generic(String),
    /// 文件未找到
    #[serde(rename = "not_found")]
    NotFound(String),
    /// 权限不足
    #[serde(rename = "forbidden")]
    Forbidden(String),
    /// IO 错误
    #[serde(rename = "io")]
    Io(String),
}

impl From<std::io::Error> for IpcError {
    fn from(e: std::io::Error) -> Self {
        match e.kind() {
            std::io::ErrorKind::NotFound => IpcError::NotFound(e.to_string()),
            std::io::ErrorKind::PermissionDenied => IpcError::Forbidden(e.to_string()),
            _ => IpcError::Io(e.to_string()),
        }
    }
}

impl From<anyhow::Error> for IpcError {
    fn from(e: anyhow::Error) -> Self {
        IpcError::Generic(e.to_string())
    }
}

/// Tauri command 的统一返回类型
pub type IpcResult<T> = Result<T, IpcError>;
