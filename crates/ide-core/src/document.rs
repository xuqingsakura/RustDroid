//! Document 类型：文档元数据（内容模型由 ide-editor 的 ropey 维护）

use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU64, Ordering};

use crate::{LanguageId, Uri};

/// 文档版本号（单调递增，每次修改自增）
pub type Version = u32;

/// 全局唯一文档 ID
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct DocumentId(pub u64);

static NEXT_DOC_ID: AtomicU64 = AtomicU64::new(1);

impl DocumentId {
    /// 生成新的文档 ID
    pub fn next() -> Self {
        Self(NEXT_DOC_ID.fetch_add(1, Ordering::Relaxed))
    }
}

impl std::fmt::Display for DocumentId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "doc#{}", self.0)
    }
}

/// 行尾符类型
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LineEnding {
    /// \n（Unix / Linux / macOS 10+）
    Lf,
    /// \r\n（Windows）
    Crlf,
    /// \r（旧 macOS，已废弃，仅作兼容）
    Cr,
}

impl LineEnding {
    /// 根据内容推断主导行尾符
    pub fn detect(text: &str) -> Self {
        let crlf = text.matches("\r\n").count();
        let lf = text.matches('\n').count() - crlf;
        if crlf >= lf {
            LineEnding::Crlf
        } else {
            LineEnding::Lf
        }
    }

    /// 转为字符串
    pub fn as_str(&self) -> &'static str {
        match self {
            LineEnding::Lf => "\n",
            LineEnding::Crlf => "\r\n",
            LineEnding::Cr => "\r",
        }
    }
}

impl Default for LineEnding {
    fn default() -> Self {
        if cfg!(windows) {
            LineEnding::Crlf
        } else {
            LineEnding::Lf
        }
    }
}

/// 文档元数据
///
/// 注意：此处仅保存元信息，不持有文本内容。文本内容（ropey::Rope）
/// 由 ide-editor crate 的 DocumentService 管理，避免核心层依赖具体文本库。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Document {
    /// 文档 ID
    pub id: DocumentId,
    /// 文档 URI
    pub uri: Uri,
    /// 语言标识
    pub language_id: LanguageId,
    /// 当前版本号
    pub version: Version,
    /// 行尾符
    pub line_ending: LineEnding,
    /// 文件大小（字节）
    pub size: u64,
    /// 文本编码（"utf-8" / "gbk" 等）
    pub encoding: String,
    /// 是否已修改（dirty flag）
    pub dirty: bool,
}

impl Document {
    /// 创建新文档元数据
    pub fn new(uri: Uri, language_id: LanguageId) -> Self {
        Self {
            id: DocumentId::next(),
            uri,
            language_id,
            version: 0,
            line_ending: LineEnding::default(),
            size: 0,
            encoding: "utf-8".to_string(),
            dirty: false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn line_ending_detect() {
        assert_eq!(LineEnding::detect("a\nb\n"), LineEnding::Lf);
        assert_eq!(LineEnding::detect("a\r\nb\r\n"), LineEnding::Crlf);
        assert_eq!(LineEnding::detect("a\r\nb\n"), LineEnding::Crlf); // 多数派
    }

    #[test]
    fn doc_id_unique() {
        let a = DocumentId::next();
        let b = DocumentId::next();
        assert_ne!(a, b);
        assert!(b.0 > a.0);
    }
}
