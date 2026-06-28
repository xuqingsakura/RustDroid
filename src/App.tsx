import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from './store/appStore';
import { useFileStore } from './store/fileStore';
import { getVersion } from './api/app';
import { FileTree } from './components/FileTree';
import { RecentProjects } from './components/RecentProjects';
import { ContextMenu } from './components/ContextMenu';
import type { ContextMenuItem } from './components/ContextMenu';
import { EditorTabs } from './components/EditorTabs';
import { MonacoEditor } from './components/MonacoEditor';
import { SettingsPage } from './components/SettingsPage';
import { AboutPage } from './components/AboutPage';
import { fsApi } from './api/fs';
import './styles/global.css';

export default function App() {
  const { version, setVersion, theme, setTheme } = useAppStore();
  const {
    projectPath,
    setProjectPath,
    refreshRoot,
    selectFile,
    selectedFile,
    openFiles,
    activeFile,
    fileContents,
    dirtyFiles,
    openFile,
    setActiveFile,
    setFileContent,
    closeFile,
    saveFile,
  } = useFileStore();

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    items: ContextMenuItem[];
  } | null>(null);
  const [view, setView] = useState<'welcome' | 'editor'>('welcome');
  const [showSettings, setShowSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  useEffect(() => {
    getVersion().then(setVersion).catch(console.error);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Ctrl+, 打开设置
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === ',') {
        e.preventDefault();
        setShowSettings(true);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // 自动保存：800ms 防抖
  useEffect(() => {
    if (dirtyFiles.size === 0) return;
    const timer = setTimeout(() => {
      for (const path of dirtyFiles) {
        saveFile(path);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [dirtyFiles, saveFile]);

  const handleOpenProject = useCallback(
    async (path: string) => {
      try {
        const info = await fsApi.openProject(path);
        await fsApi.addRecentProject(path);
        setProjectPath(path);
        setView('editor');
      } catch (e) {
        console.error('Failed to open project:', e);
      }
    },
    [setProjectPath],
  );

  const handleFileSelect = useCallback(
    (path: string) => {
      selectFile(path);
      openFile(path);
    },
    [selectFile, openFile],
  );

  const handleEditorChange = useCallback(
    (value: string) => {
      if (activeFile) {
        setFileContent(activeFile, value);
      }
    },
    [activeFile, setFileContent],
  );

  const handleFileContextMenu = useCallback(
    (e: React.MouseEvent, path: string) => {
      e.preventDefault();
      const dir = path.substring(0, path.lastIndexOf('\\'));
      const items: ContextMenuItem[] = [
        {
          label: '打开',
          onClick: () => handleFileSelect(path),
        },
        {
          label: '重命名',
          onClick: () => {
            const newName = prompt('新文件名:');
            if (newName) {
              const newPath = `${dir}\\${newName}`;
              fsApi
                .renameFile(path, newPath)
                .then(() => refreshRoot())
                .catch(console.error);
            }
          },
        },
        {
          label: '删除',
          onClick: () => {
            if (confirm('确定删除?')) {
              fsApi
                .deleteFile(path)
                .then(() => {
                  refreshRoot();
                  if (selectedFile === path) selectFile(null);
                })
                .catch(console.error);
            }
          },
        },
        { label: '', onClick: () => {}, divider: true },
        {
          label: '新建文件',
          onClick: () => {
            const name = prompt('文件名:');
            if (name) {
              fsApi
                .createFile(`${dir}\\${name}`)
                .then(() => refreshRoot())
                .catch(console.error);
            }
          },
        },
        {
          label: '新建目录',
          onClick: () => {
            const name = prompt('目录名:');
            if (name) {
              fsApi
                .createDirectory(`${dir}\\${name}`)
                .then(() => refreshRoot())
                .catch(console.error);
            }
          },
        },
      ];
      setContextMenu({ x: e.clientX, y: e.clientY, items });
    },
    [selectedFile, selectFile, refreshRoot, handleFileSelect],
  );

  const handleOpenFolder = useCallback(async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const path = await open({
        directory: true,
        multiple: false,
        title: '选择项目文件夹',
      });
      if (path) {
        handleOpenProject(path as string);
      }
    } catch (e) {
      console.error('Failed to open folder dialog:', e);
    }
  }, [handleOpenProject]);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  // ===== 欢迎页 =====
  if (view === 'welcome') {
    return (
      <div className="app-shell" data-theme={theme}>
        <main className="welcome-main">
          <div className="welcome-hero">
            <h1 className="welcome-title">RustDroid</h1>
            <p className="welcome-sub">轻量级 Android IDE</p>
            <span className="welcome-version">v{version}</span>
          </div>

          <div className="welcome-actions">
            <button className="welcome-btn" onClick={handleOpenFolder}>
              📂 打开项目
            </button>
            <button className="welcome-btn" disabled>
              ➕ 新建项目
            </button>
            <button className="welcome-btn" disabled>
              📦 克隆仓库
            </button>
          </div>

          <RecentProjects onSelectProject={handleOpenProject} />
        </main>
      </div>
    );
  }

  // ===== 编辑器视图 =====
  const currentContent = activeFile ? fileContents[activeFile] : undefined;

  return (
    <div className="app-shell" data-theme={theme}>
      <div className="ide-layout">
        {/* 活动栏 */}
        <div className="activity-bar">
          <button className="activity-btn active" title="文件">
            📁
          </button>
          <button className="activity-btn" title="搜索" disabled>
            🔍
          </button>
          <button className="activity-btn" title="Git" disabled>
            ⎇
          </button>
          <div className="activity-spacer" />
          <button
            className="activity-btn"
            title="主题切换"
            onClick={toggleTheme}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button
            className="activity-btn"
            title="设置 (Ctrl+,)"
            onClick={() => setShowSettings(true)}
          >
            ⚙
          </button>
        </div>

        {/* 侧边栏 — 文件树 */}
        <div className="sidebar">
          <FileTree onContextMenu={handleFileContextMenu} />
        </div>

        {/* 编辑器区域 */}
        <div className="editor-area">
          <EditorTabs
            openFiles={openFiles}
            activeFile={activeFile}
            dirtyFiles={dirtyFiles}
            onSelect={(path) => {
              setActiveFile(path);
              selectFile(path);
            }}
            onClose={closeFile}
          />
          <div className="editor-content">
            {activeFile && currentContent !== undefined ? (
              <MonacoEditor
                key={activeFile}
                path={activeFile}
                value={currentContent}
                onChange={handleEditorChange}
              />
            ) : (
              <div className="welcome-hero" style={{ padding: '2rem' }}>
                <h2 className="welcome-title" style={{ fontSize: '1.5rem' }}>
                  RustDroid IDE
                </h2>
                <p className="welcome-sub">选择一个文件开始编辑</p>
              </div>
            )}
          </div>
        </div>

        {/* 状态栏 */}
        <div className="status-bar">
          <span>RustDroid IDE v{version}</span>
          {dirtyFiles.size > 0 && (
            <span style={{ color: 'var(--orange)' }}>
              ↻ 自动保存中 ({dirtyFiles.size})
            </span>
          )}
          <span className="status-path">{projectPath}</span>
          <span
            className="status-link"
            onClick={() => setShowAbout(true)}
          >
            关于
          </span>
        </div>
      </div>

      {/* 右键菜单 */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* 设置页 */}
      {showSettings && (
        <SettingsPage onClose={() => setShowSettings(false)} />
      )}

      {/* 关于页 */}
      {showAbout && (
        <AboutPage version={version} onClose={() => setShowAbout(false)} />
      )}
    </div>
  );
}
