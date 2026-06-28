//! 基于 ropey 的文档模型
//!
//! 使用 Rope 数据结构高效管理大文本文件的编辑操作，
//! 支持插入、删除、替换和行级访问。

#![forbid(unsafe_code)]

use ide_core::{Document, Position, Range};
use ropey::Rope;
use serde::{Deserialize, Serialize};

/// 编辑操作类型
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum EditKind {
    /// 插入文本
    Insert,
    /// 删除文本
    Delete,
    /// 替换文本
    Replace,
}

/// 单一编辑操作
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EditOperation {
    /// 操作类型
    pub kind: EditKind,
    /// 起始位置
    pub start: Position,
    /// 结束位置（删除/替换用）
    pub end: Option<Position>,
    /// 新文本（插入/替换用）
    pub text: Option<String>,
}

/// 文档模型 — 持有 Document 元数据和 Rope 文本缓冲区
#[derive(Debug)]
pub struct DocumentModel {
    /// 文档元数据
    pub document: Document,
    /// 文本缓冲区（rope 数据结构）
    rope: Rope,
}

impl DocumentModel {
    /// 从字符串内容创建文档模型
    pub fn from_string(document: Document, content: String) -> Self {
        let rope = Rope::from_str(&content);
        Self { document, rope }
    }

    /// 获取完整文本内容
    pub fn text(&self) -> String {
        self.rope.to_string()
    }

    /// 获取总行数
    pub fn line_count(&self) -> usize {
        self.rope.len_lines()
    }

    /// 获取指定行的文本（不含换行符）
    pub fn line_text(&self, line: usize) -> Option<String> {
        if line < self.rope.len_lines() {
            let text = self.rope.line(line).to_string();
            // ropey 的 line() 包含末尾换行符，需要去除
            Some(text.trim_end_matches('\n').trim_end_matches('\r').to_string())
        } else {
            None
        }
    }

    /// 获取总字符数
    pub fn char_count(&self) -> usize {
        self.rope.len_chars()
    }

    /// 在指定位置插入文本
    pub fn insert(&mut self, pos: Position, text: &str) {
        let char_idx = self.position_to_char_index(pos);
        self.rope.insert(char_idx, text);
        self.document.version += 1;
        self.document.size = self.rope.len_bytes() as u64;
        self.document.dirty = true;
    }

    /// 删除指定区间的文本
    pub fn delete(&mut self, range: Range) {
        let start = self.position_to_char_index(range.start);
        let end = self.position_to_char_index(range.end);
        self.rope.remove(start..end);
        self.document.version += 1;
        self.document.size = self.rope.len_bytes() as u64;
        self.document.dirty = true;
    }

    /// 替换指定区间的文本
    pub fn replace(&mut self, range: Range, new_text: &str) {
        let start = self.position_to_char_index(range.start);
        let end = self.position_to_char_index(range.end);
        self.rope.remove(start..end);
        self.rope.insert(start, new_text);
        self.document.version += 1;
        self.document.size = self.rope.len_bytes() as u64;
        self.document.dirty = true;
    }

    /// 应用一组编辑操作（用于 Monaco 增量同步）
    pub fn apply_edits(&mut self, edits: &[EditOperation]) {
        for edit in edits {
            match edit.kind {
                EditKind::Insert => {
                    if let Some(ref text) = edit.text {
                        self.insert(edit.start, text);
                    }
                }
                EditKind::Delete => {
                    if let Some(end) = edit.end {
                        self.delete(Range::new(edit.start, end));
                    }
                }
                EditKind::Replace => {
                    if let Some(end) = edit.end {
                        if let Some(ref text) = edit.text {
                            self.replace(Range::new(edit.start, end), text);
                        }
                    }
                }
            }
        }
    }

    /// 标记文档为已保存（清除 dirty 标记）
    pub fn mark_saved(&mut self) {
        self.document.dirty = false;
    }

    /// Position 转 Rope char index
    fn position_to_char_index(&self, pos: Position) -> usize {
        let line = pos.line as usize;
        let column = pos.column as usize;
        if line >= self.rope.len_lines() {
            return self.rope.len_chars();
        }
        let line_start = self.rope.line_to_char(line);
        let line_len = self.rope.line(line).len_chars();
        line_start + column.min(line_len)
    }

    /// Rope char index 转 Position
    pub fn char_index_to_position(&self, char_idx: usize) -> Position {
        let line = self.rope.char_to_line(char_idx);
        let line_start = self.rope.line_to_char(line);
        let column = char_idx - line_start;
        Position::new(line as u32, column as u32)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ide_core::{Document, LanguageId, Uri};

    fn test_document() -> Document {
        Document::new(
            Uri::from_file_path("/test/file.txt"),
            LanguageId::PlainText,
        )
    }

    #[test]
    fn test_create_from_string() {
        let doc = test_document();
        let model = DocumentModel::from_string(doc, "hello\nworld".into());
        assert_eq!(model.text(), "hello\nworld");
        assert_eq!(model.line_count(), 2);
        assert_eq!(model.line_text(0), Some("hello".into()));
        assert_eq!(model.line_text(1), Some("world".into()));
    }

    #[test]
    fn test_insert_text() {
        let doc = test_document();
        let mut model = DocumentModel::from_string(doc, "helo".into());
        model.insert(Position::new(0, 2), "l");
        assert_eq!(model.text(), "hello");
    }

    #[test]
    fn test_delete_range() {
        let doc = test_document();
        let mut model = DocumentModel::from_string(doc, "hello world".into());
        let range = Range::new(Position::new(0, 5), Position::new(0, 6));
        model.delete(range);
        assert_eq!(model.text(), "helloworld");
    }

    #[test]
    fn test_replace() {
        let doc = test_document();
        let mut model = DocumentModel::from_string(doc, "hello java".into());
        let range = Range::new(Position::new(0, 6), Position::new(0, 10));
        model.replace(range, "rust");
        assert_eq!(model.text(), "hello rust");
    }

    #[test]
    fn test_apply_edits() {
        let doc = test_document();
        let mut model = DocumentModel::from_string(doc, "abcdef".into());
        let edits = vec![
            EditOperation {
                kind: EditKind::Replace,
                start: Position::new(0, 1),
                end: Some(Position::new(0, 4)),
                text: Some("xxx".into()),
            },
        ];
        model.apply_edits(&edits);
        assert_eq!(model.text(), "axxxef");
    }

    #[test]
    fn test_mark_saved() {
        let doc = test_document();
        let mut model = DocumentModel::from_string(doc, "test".into());
        // Document::new() 默认 dirty = false，做一次编辑使其变为 dirty
        assert!(!model.document.dirty);
        model.insert(Position::new(0, 4), "!");
        assert!(model.document.dirty);
        model.mark_saved();
        assert!(!model.document.dirty);
    }

    #[test]
    fn test_version_increments() {
        let doc = test_document();
        let mut model = DocumentModel::from_string(doc, "test".into());
        let v0 = model.document.version;
        model.insert(Position::new(0, 4), "!");
        assert_eq!(model.document.version, v0 + 1);
    }
}
