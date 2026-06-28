//! 应用级信息

use serde::{Deserialize, Serialize};

/// 应用信息（响应 `app_version` / `app_info` 命令）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    /// 应用版本号（来自 Cargo.toml）
    pub version: String,
    /// 应用名称
    pub name: String,
    /// 提交 hash（CI 构建时注入）
    pub commit: String,
    /// 构建时间（RFC3339）
    pub build_time: String,
}

impl AppInfo {
    /// 获取当前应用信息（编译期注入）
    pub fn current() -> Self {
        Self {
            version: env!("CARGO_PKG_VERSION").to_string(),
            name: env!("CARGO_PKG_NAME").to_string(),
            commit: option_env!("RUSTDROID_COMMIT")
                .unwrap_or("dev")
                .to_string(),
            build_time: option_env!("RUSTDROID_BUILD_TIME")
                .unwrap_or("unknown")
                .to_string(),
        }
    }
}
