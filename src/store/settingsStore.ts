import { create } from 'zustand';

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

  updateEditor: (partial: Partial<EditorSettings>) => void;
  updateAppearance: (partial: Partial<AppearanceSettings>) => void;
  resetEditor: () => void;
  resetAppearance: () => void;
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

export const useSettingsStore = create<SettingsState>((set) => ({
  editor: { ...DEFAULT_EDITOR },
  appearance: { ...DEFAULT_APPEARANCE },
  shortcuts: [...DEFAULT_SHORTCUTS],

  updateEditor: (partial) =>
    set((state) => ({ editor: { ...state.editor, ...partial } })),

  updateAppearance: (partial) =>
    set((state) => ({ appearance: { ...state.appearance, ...partial } })),

  resetEditor: () => set({ editor: { ...DEFAULT_EDITOR } }),

  resetAppearance: () => set({ appearance: { ...DEFAULT_APPEARANCE } }),
}));
