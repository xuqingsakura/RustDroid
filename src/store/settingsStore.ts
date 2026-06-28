import { create } from 'zustand';
import { settingsApi, type RustAppSettings } from '../api/settings';

export interface EditorSettings {
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  tabSize: number;
  wordWrap: boolean;
  minimap: boolean;
  lineNumbers: boolean;
  autoSave: boolean;
  autoSaveDelay: number;
  formatOnSave: boolean;
}

export interface AppearanceSettings {
  theme: 'dark' | 'light';
  sidebarVisible: boolean;
  activityBarVisible: boolean;
  statusBarVisible: boolean;
  zoomLevel: number;
}

export interface ShortcutItem {
  id: string;
  label: string;
  keys: string;
}

export interface SettingsState {
  editor: EditorSettings;
  appearance: AppearanceSettings;
  shortcuts: ShortcutItem[];
  loaded: boolean;

  updateEditor: (partial: Partial<EditorSettings>) => void;
  updateAppearance: (partial: Partial<AppearanceSettings>) => void;
  resetEditor: () => void;
  resetAppearance: () => void;
  loadSettings: () => Promise<void>;
  saveSettings: () => Promise<void>;
}

const DEFAULT_EDITOR: EditorSettings = {
  fontSize: 14,
  fontFamily: "'JetBrains Mono', 'Consolas', monospace",
  lineHeight: 1.6,
  tabSize: 4,
  wordWrap: false,
  minimap: true,
  lineNumbers: true,
  autoSave: true,
  autoSaveDelay: 800,
  formatOnSave: false,
};

const DEFAULT_APPEARANCE: AppearanceSettings = {
  theme: 'dark',
  sidebarVisible: true,
  activityBarVisible: true,
  statusBarVisible: true,
  zoomLevel: 100,
};

const DEFAULT_SHORTCUTS: ShortcutItem[] = [
  { id: 'cmd.palette', label: '命令面板', keys: 'Ctrl+Shift+P' },
  { id: 'file.save', label: '保存文件', keys: 'Ctrl+S' },
  { id: 'file.open', label: '打开文件', keys: 'Ctrl+O' },
  { id: 'edit.undo', label: '撤销', keys: 'Ctrl+Z' },
  { id: 'edit.redo', label: '重做', keys: 'Ctrl+Y' },
  { id: 'edit.find', label: '查找', keys: 'Ctrl+F' },
  { id: 'edit.replace', label: '替换', keys: 'Ctrl+H' },
  { id: 'view.toggleSidebar', label: '切换侧边栏', keys: 'Ctrl+B' },
  { id: 'view.toggleTerminal', label: '切换终端', keys: 'Ctrl+`' },
  { id: 'editor.multiCursor', label: '多光标', keys: 'Alt+Click' },
  { id: 'editor.format', label: '格式化文档', keys: 'Shift+Alt+F' },
  { id: 'editor.comment', label: '切换行注释', keys: 'Ctrl+/' },
  { id: 'editor.indent', label: '增加缩进', keys: 'Tab' },
  { id: 'editor.outdent', label: '减少缩进', keys: 'Shift+Tab' },
  { id: 'nav.gotoLine', label: '跳转到行', keys: 'Ctrl+G' },
];

/** 将前端设置转换为 Rust 后端格式 */
function toRustSettings(editor: EditorSettings, appearance: AppearanceSettings): RustAppSettings {
  return {
    editor: {
      font_size: editor.fontSize,
      tab_size: editor.tabSize,
      word_wrap: editor.wordWrap,
      minimap: editor.minimap,
      line_numbers: editor.lineNumbers,
      auto_save: editor.autoSave,
      auto_save_delay: editor.autoSaveDelay,
    },
    appearance: {
      theme: appearance.theme,
      sidebar_visible: appearance.sidebarVisible,
      status_bar_visible: appearance.statusBarVisible,
      zoom_level: appearance.zoomLevel,
    },
  };
}

/** 从 Rust 后端格式恢复前端设置 */
function fromRustSettings(rust: RustAppSettings): { editor: Partial<EditorSettings>; appearance: Partial<AppearanceSettings> } {
  return {
    editor: {
      fontSize: rust.editor.font_size,
      tabSize: rust.editor.tab_size,
      wordWrap: rust.editor.word_wrap,
      minimap: rust.editor.minimap,
      lineNumbers: rust.editor.line_numbers,
      autoSave: rust.editor.auto_save,
      autoSaveDelay: rust.editor.auto_save_delay,
    },
    appearance: {
      theme: rust.appearance.theme as 'dark' | 'light',
      sidebarVisible: rust.appearance.sidebar_visible,
      statusBarVisible: rust.appearance.status_bar_visible,
      zoomLevel: rust.appearance.zoom_level,
    },
  };
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  editor: { ...DEFAULT_EDITOR },
  appearance: { ...DEFAULT_APPEARANCE },
  shortcuts: [...DEFAULT_SHORTCUTS],
  loaded: false,

  updateEditor: (partial) => {
    set((state) => ({ editor: { ...state.editor, ...partial } }));
    get().saveSettings();
  },

  updateAppearance: (partial) => {
    set((state) => ({ appearance: { ...state.appearance, ...partial } }));
    get().saveSettings();
  },

  resetEditor: () => {
    set({ editor: { ...DEFAULT_EDITOR } });
    get().saveSettings();
  },

  resetAppearance: () => {
    set({ appearance: { ...DEFAULT_APPEARANCE } });
    get().saveSettings();
  },

  loadSettings: async () => {
    try {
      const rust = await settingsApi.getSettings();
      const { editor, appearance } = fromRustSettings(rust);
      set((state) => ({
        editor: { ...state.editor, ...editor },
        appearance: { ...state.appearance, ...appearance },
        loaded: true,
      }));
    } catch (e) {
      console.error('Failed to load settings:', e);
      set({ loaded: true });
    }
  },

  saveSettings: async () => {
    try {
      const { editor, appearance } = get();
      const rust = toRustSettings(editor, appearance);
      await settingsApi.saveSettings(rust);
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  },
}));
