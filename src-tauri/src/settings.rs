//! 设置持久化
//!
//! 编辑器/外观设置读写到 app_data_dir/settings.json。

#![forbid(unsafe_code)]

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager, command};

/// 编辑器设置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EditorSettings {
    pub font_size: u32,
    pub tab_size: u32,
    pub word_wrap: bool,
    pub minimap: bool,
    pub line_numbers: bool,
    pub auto_save: bool,
    pub auto_save_delay: u32,
}

/// 外观设置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppearanceSettings {
    pub theme: String,
    pub sidebar_visible: bool,
    pub status_bar_visible: bool,
    pub zoom_level: u32,
}

/// 全部设置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub editor: EditorSettings,
    pub appearance: AppearanceSettings,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            editor: EditorSettings {
                font_size: 14,
                tab_size: 4,
                word_wrap: false,
                minimap: true,
                line_numbers: true,
                auto_save: true,
                auto_save_delay: 800,
            },
            appearance: AppearanceSettings {
                theme: "dark".into(),
                sidebar_visible: true,
                status_bar_visible: true,
                zoom_level: 100,
            },
        }
    }
}

fn settings_path(app: &AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("settings.json")
}

/// 读取设置
#[command]
pub fn get_settings(app: AppHandle) -> AppSettings {
    let path = settings_path(&app);
    if !path.exists() {
        return AppSettings::default();
    }
    fs::read_to_string(&path)
        .ok()
        .and_then(|data| serde_json::from_str(&data).ok())
        .unwrap_or_default()
}

/// 保存设置
#[command]
pub fn save_settings(app: AppHandle, settings: AppSettings) -> Result<(), String> {
    let path = settings_path(&app);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("failed to create dir: {}", e))?;
    }
    let data = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("serialization error: {}", e))?;
    fs::write(&path, data).map_err(|e| format!("failed to write settings: {}", e))?;
    Ok(())
}
