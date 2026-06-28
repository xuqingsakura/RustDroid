//! ide-editor: RustDroid IDE 文档模型
//!
//! 基于 ropey 的高效文本缓冲区管理，支持增量编辑和 LSP 集成。
//! 提供 DocumentModel 类型，被 src-tauri 的编辑器命令使用。

#![forbid(unsafe_code)]
#![warn(missing_docs)]

mod document_model;

pub use document_model::{DocumentModel, EditKind, EditOperation};
