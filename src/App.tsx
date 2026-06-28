import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from './store/appStore';
import { useFileStore } from './store/fileStore';
import { getVersion } from './api/app';
import { FileTree } from './components/FileTree';
import { RecentProjects } from './components/RecentProjects';
import { ContextMenu } from './components/ContextMenu';
import type { ContextMenuItem } from './components/ContextMenu';
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
  } = useFileStore();

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    items: ContextMenuItem[];
  } | null>(null);
  const [view, setView] = useState<'welcome' | 'editor'>('welcome');

  useEffect(() => {
    getVersion().then(setVersion).catch(console.error);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** 打开项目 */
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

  /** 文件右键菜单 */
  const handleFileContextMenu = useCallback(
    (e: React.MouseEvent, path: string) => {
      e.preventDefault();
      const dir = path.substring(0, path.lastIndexOf('\\'));
      const items: ContextMenuItem[] = [
        {
          label: '打开',
          onClick: () => {
            if (path !== selectedFile) selectFile(path);
          },
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
    [selectedFile, selectFile, refreshRoot],
  );

  /** 打开文件夹对话框 */
  const handleOpenFolder = useCallback(async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const path = await open({ directory: true, multiple: false, title: '选择项目文件夹' });
      if (path) {
        handleOpenProject(path as string);
      }
    } catch (e) {
      console.error('Failed to open folder dialog:', e);
    }
  }, [handleOpenProject]);

  /** 主题切换 */
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
          <button className="activity-btn" title="主题切换" onClick={toggleTheme}>
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>

        {/* 侧边栏 — 文件树 */}
        <div className="sidebar">
          <FileTree onContextMenu={handleFileContextMenu} />
        </div>

        {/* 编辑器区域 */}
        <div className="editor-area">
          <div className="editor-tabs">
            {selectedFile && (
              <div className="editor-tab active">
                {selectedFile.split('\\').pop()?.split('/').pop()}
              </div>
            )}
          </div>
          <div className="editor-content">
            {selectedFile ? (
              <p className="editor-placeholder">📄 {selectedFile}</p>
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
          <span>{projectPath}</span>
          {selectedFile && (
            <span>{selectedFile.split('\\').pop()?.split('/').pop()}</span>
          )}
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
    </div>
  );
}
