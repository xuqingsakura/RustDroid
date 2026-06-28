//! Range 类型：文本区间，由起止位置定义

use serde::{Deserialize, Serialize};
use Position;

/// 文本区间 [start, end)
///
/// `start` 必须小于等于 `end`，区间为半闭半开：包含 start 位置，不包含 end 位置。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Range {
    /// 起始位置（包含）
    pub start: Position,
    /// 结束位置（不包含）
    pub end: Position,
}

impl Range {
    /// 创建新区间
    pub const fn new(start: Position, end: Position) -> Self {
        Self { start, end }
    }

    /// 单点区间（start == end），常用于光标位置、空选择
    pub const fn point(pos: Position) -> Self {
        Self { start: pos, end: pos }
    }

    /// 整行区间
    pub fn line(line: u32, line_length: u32) -> Self {
        Self::new(Position::start_of_line(line), Position::new(line, line_length))
    }

    /// 是否为空区间（光标）
    pub fn is_empty(&self) -> bool {
        self.start == self.end
    }

    /// 是否为单行区间
    pub fn is_single_line(&self) -> bool {
        self.start.line == self.end.line
    }

    /// 区间长度（按 UTF-16 code unit 计；仅单行区间有意义）
    pub fn len(&self) -> u32 {
        if self.is_single_line() {
            self.end.column - self.start.column
        } else {
            0
        }
    }

    /// 是否包含某位置
    pub fn contains(&self, pos: Position) -> bool {
        pos >= self.start && pos < self.end
    }
}

impl Default for Range {
    fn default() -> Self {
        Range::point(Position::zero())
    }
}

impl std::fmt::Display for Range {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "[{}-{}]", self.start, self.end)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_range() {
        let r = Range::point(Position::new(1, 2));
        assert!(r.is_empty());
        assert!(r.is_single_line());
        assert_eq!(r.len(), 0);
    }

    #[test]
    fn contains_check() {
        let r = Range::new(Position::new(0, 0), Position::new(2, 5));
        assert!(r.contains(Position::new(1, 0)));
        assert!(r.contains(Position::new(0, 0)));
        assert!(!r.contains(Position::new(2, 5))); // 半开
        assert!(!r.contains(Position::new(3, 0)));
    }
}
