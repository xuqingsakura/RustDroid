//! Tauri event 类型定义
//!
//! 后端通过 `app.emit("rustdroid://<kind>", payload)` 推送事件，
//! 前端通过 `listen("rustdroid://<kind>", handler)` 订阅。

use serde::{Deserialize, Serialize};

/// 事件大类
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EventKind {
    /// 文件系统变更（Sprint 1-2）
    FileChanged,
    /// 文档保存（Sprint 1-3）
    DocumentSaved,
    /// 终端输出（Sprint 1-5）
    TerminalData,
    /// LSP 诊断（Sprint 2-1）
    LspDiagnostics,
    /// 构建输出（Sprint 3-1）
    BuildOutput,
    /// 设备变更（Sprint 3-2）
    DeviceChanged,
    /// Logcat 日志（Sprint 3-3）
    LogcatLine,
}

impl EventKind {
    /// 转为 Tauri event 名称（`rustdroid://<snake>`)
    pub fn as_event_name(&self) -> &'static str {
        match self {
            EventKind::FileChanged => "rustdroid://file_changed",
            EventKind::DocumentSaved => "rustdroid://document_saved",
            EventKind::TerminalData => "rustdroid://terminal_data",
            EventKind::LspDiagnostics => "rustdroid://lsp_diagnostics",
            EventKind::BuildOutput => "rustdroid://build_output",
            EventKind::DeviceChanged => "rustdroid://device_changed",
            EventKind::LogcatLine => "rustdroid://logcat_line",
        }
    }
}

/// 事件载荷（占位，具体 payload 由各 Sprint 扩展为 enum 变体）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum EventPayload {
    /// 文本消息
    Text(String),
    /// JSON 值
    Json(serde_json::Value),
}

/// 完整的 IPC 事件
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IpcEvent {
    /// 事件类型
    pub kind: EventKind,
    /// 载荷
    pub payload: EventPayload,
}
