//! ide-core: RustDroid IDE 核心类型定义
//!
//! 提供 Document / Position / Range / Uri 等编辑器基础数据模型，
//! 被所有上层 crate（ide-editor, ide-lsp, ide-project 等）共享依赖。

#![forbid(unsafe_code)]
#![warn(missing_docs)]

mod uri;
mod position;
mod range;
mod document;

pub use uri::Uri;
pub use position::Position;
pub use range::Range;
pub use document::{Document, DocumentId, LanguageId, LineEnding, Version};

/// 重新导出常用类型，便于上层 crate 使用
pub mod prelude {
    pub use crate::{Document, DocumentId, LanguageId, LineEnding, Position, Range, Uri, Version};
}
