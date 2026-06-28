import { useState } from 'react';
import { useSettingsStore, EditorSettings, AppearanceSettings } from '../store/settingsStore';
import './SettingsPage.css';

type SettingsTab = 'editor' | 'appearance' | 'shortcuts';

interface SettingsPageProps {
  onClose: () => void;
}

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'editor', label: '编辑器' },
  { id: 'appearance', label: '外观' },
  { id: 'shortcuts', label: '快捷键' },
];

export function SettingsPage({ onClose }: SettingsPageProps) {
  const { editor, appearance, shortcuts, updateEditor, updateAppearance, resetEditor, resetAppearance } = useSettingsStore();
  const [activeTab, setActiveTab] = useState<SettingsTab>('editor');

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>设置</h2>
          <button className="settings-close" onClick={onClose}>×</button>
        </div>
        <div className="settings-body">
          <nav className="settings-nav">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                className={`settings-nav-item ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>
          <div className="settings-content">
            {activeTab === 'editor' && (
              <EditorSettingsPanel settings={editor} onUpdate={updateEditor} onReset={resetEditor} />
            )}
            {activeTab === 'appearance' && (
              <AppearanceSettingsPanel settings={appearance} onUpdate={updateAppearance} onReset={resetAppearance} />
            )}
            {activeTab === 'shortcuts' && (
              <ShortcutsPanel shortcuts={shortcuts} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EditorSettingsPanel({
  settings,
  onUpdate,
  onReset,
}: {
  settings: EditorSettings;
  onUpdate: (p: Partial<EditorSettings>) => void;
  onReset: () => void;
}) {
  return (
    <div className="settings-section">
      <h3>编辑器设置</h3>

      <SettingRow label="字体大小" description="编辑器文字大小 (px)">
        <input
          type="number"
          min={10}
          max={30}
          value={settings.fontSize}
          onChange={(e) => onUpdate({ fontSize: Number(e.target.value) })}
          className="settings-input-number"
        />
      </SettingRow>

      <SettingRow label="字号行高" description="行高倍数">
        <input
          type="number"
          min={1.0}
          max={3.0}
          step={0.1}
          value={settings.lineHeight}
          onChange={(e) => onUpdate({ lineHeight: Number(e.target.value) })}
          className="settings-input-number"
        />
      </SettingRow>

      <SettingRow label="制表符大小" description="缩进空格数">
        <input
          type="number"
          min={2}
          max={8}
          value={settings.tabSize}
          onChange={(e) => onUpdate({ tabSize: Number(e.target.value) })}
          className="settings-input-number"
        />
      </SettingRow>

      <SettingRow label="自动换行" description="超出屏幕宽度时自动折行">
        <input
          type="checkbox"
          checked={settings.wordWrap}
          onChange={(e) => onUpdate({ wordWrap: e.target.checked })}
        />
      </SettingRow>

      <SettingRow label="Minimap" description="显示代码缩略图">
        <input
          type="checkbox"
          checked={settings.minimap}
          onChange={(e) => onUpdate({ minimap: e.target.checked })}
        />
      </SettingRow>

      <SettingRow label="行号" description="显示行号">
        <input
          type="checkbox"
          checked={settings.lineNumbers}
          onChange={(e) => onUpdate({ lineNumbers: e.target.checked })}
        />
      </SettingRow>

      <SettingRow label="自动保存" description="编辑后自动保存文件">
        <input
          type="checkbox"
          checked={settings.autoSave}
          onChange={(e) => onUpdate({ autoSave: e.target.checked })}
        />
      </SettingRow>

      {settings.autoSave && (
        <SettingRow label="自动保存延迟" description="防抖等待时间 (ms)">
          <input
            type="number"
            min={200}
            max={5000}
            step={100}
            value={settings.autoSaveDelay}
            onChange={(e) => onUpdate({ autoSaveDelay: Number(e.target.value) })}
            className="settings-input-number"
          />
        </SettingRow>
      )}

      <div className="settings-actions">
        <button className="settings-btn" onClick={onReset}>恢复默认</button>
      </div>
    </div>
  );
}

function AppearanceSettingsPanel({
  settings,
  onUpdate,
  onReset,
}: {
  settings: AppearanceSettings;
  onUpdate: (p: Partial<AppearanceSettings>) => void;
  onReset: () => void;
}) {
  return (
    <div className="settings-section">
      <h3>外观设置</h3>

      <SettingRow label="主题配色" description="深色/浅色模式">
        <select
          value={settings.theme}
          onChange={(e) => onUpdate({ theme: e.target.value as 'dark' | 'light' })}
          className="settings-select"
        >
          <option value="dark">Tokyo Night (深色)</option>
          <option value="light">Tokyo Night Light (浅色)</option>
        </select>
      </SettingRow>

      <SettingRow label="侧边栏" description="显示文件树侧边栏">
        <input
          type="checkbox"
          checked={settings.sidebarVisible}
          onChange={(e) => onUpdate({ sidebarVisible: e.target.checked })}
        />
      </SettingRow>

      <SettingRow label="状态栏" description="显示底部状态栏">
        <input
          type="checkbox"
          checked={settings.statusBarVisible}
          onChange={(e) => onUpdate({ statusBarVisible: e.target.checked })}
        />
      </SettingRow>

      <SettingRow label="界面缩放" description="整体缩放比例 (%)">
        <input
          type="number"
          min={80}
          max={200}
          step={10}
          value={settings.zoomLevel}
          onChange={(e) => onUpdate({ zoomLevel: Number(e.target.value) })}
          className="settings-input-number"
        />
      </SettingRow>

      <div className="settings-actions">
        <button className="settings-btn" onClick={onReset}>恢复默认</button>
      </div>
    </div>
  );
}

function ShortcutsPanel({ shortcuts }: { shortcuts: { id: string; label: string; keys: string }[] }) {
  return (
    <div className="settings-section">
      <h3>快捷键</h3>
      <p className="settings-desc">以下快捷键可直接在编辑器中使用。自定义快捷键将在后续版本中支持。</p>
      <div className="shortcuts-list">
        {shortcuts.map((s) => (
          <div key={s.id} className="shortcut-row">
            <span className="shortcut-label">{s.label}</span>
            <kbd className="shortcut-keys">{s.keys}</kbd>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="setting-row">
      <div className="setting-info">
        <span className="setting-label">{label}</span>
        <span className="setting-desc">{description}</span>
      </div>
      <div className="setting-control">{children}</div>
    </div>
  );
}
