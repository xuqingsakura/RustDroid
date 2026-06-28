//! Position 类型：文本中的位置（行、列）

use serde::{Deserialize, Serialize};
use std::cmp::Ordering;

/// 零基行/列位置
///
/// - `line`: 行号，从 0 开始
/// - `column`: 列号，从 0 开始（按 UTF-16 code unit 计数，与 LSP 规范一致）
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Position {
    /// 行号（0-based）
    pub line: u32,
    /// 列号（0-based，UTF-16 code unit）
    pub column: u32,
}

impl Position {
    /// 创建新位置
    pub const fn new(line: u32, column: u32) -> Self {
        Self { line, column }
    }

    /// 行首位置
    pub const fn start_of_line(line: u32) -> Self {
        Self { line, column: 0 }
    }

    /// 文档起始位置 (0, 0)
    pub const fn zero() -> Self {
        Self::new(0, 0)
    }
}

impl Default for Position {
    fn default() -> Self {
        Self::zero()
    }
}

impl PartialOrd for Position {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for Position {
    fn cmp(&self, other: &Self) -> Ordering {
        self.line
            .cmp(&other.line)
            .then(self.column.cmp(&other.column))
    }
}

impl std::fmt::Display for Position {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}:{}", self.line, self.column)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ordering() {
        assert!(Position::new(0, 5) < Position::new(1, 0));
        assert!(Position::new(2, 3) < Position::new(2, 10));
        assert!(Position::new(2, 3) == Position::new(2, 3));
    }
}
