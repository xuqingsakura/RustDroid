import { invoke } from '@tauri-apps/api/core';

export interface RustEditorSettings {
  font_size: number;
  tab_size: number;
  word_wrap: boolean;
  minimap: boolean;
  line_numbers: boolean;
  auto_save: boolean;
  auto_save_delay: number;
}

export interface RustAppearanceSettings {
  theme: string;
  sidebar_visible: boolean;
  status_bar_visible: boolean;
  zoom_level: number;
}

export interface RustAppSettings {
  editor: RustEditorSettings;
  appearance: RustAppearanceSettings;
}

export const settingsApi = {
  getSettings(): Promise<RustAppSettings> {
    return invoke<RustAppSettings>('get_settings');
  },
  saveSettings(settings: RustAppSettings): Promise<void> {
    return invoke<void>('save_settings', { settings });
  },
};
