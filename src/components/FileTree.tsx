import { useEffect, useCallback, ReactNode } from 'react';
import { useFileStore } from '../store/fileStore';
import { FileTreeItem } from './FileTreeItem';
import type { FileEntry } from '../types/fs';
import './FileTree.css';

interface FileTreeProps {
  onContextMenu: (e: React.MouseEvent, path: string) => void;
}

interface RenderItem {
  entry: FileEntry;
  depth: number;
}

/** 递归渲染文件树节点 */
function renderTreeItems(
  items: RenderItem[],
  expandedPaths: Set<string>,
  dirCache: Record<string, FileEntry[]>,
  selectedFile: string | null,
  onToggle: (path: string) => void,
  onSelect: (path: string) => void,
  onContextMenu: (e: React.MouseEvent, path: string) => void,
): ReactNode[] {
  const result: ReactNode[] = [];

  for (const { entry, depth } of items) {
    const isExpanded = expandedPaths.has(entry.path);
    const isSelected = selectedFile === entry.path;
    const hasChildren = entry.type === 'directory';

    result.push(
      <FileTreeItem
        key={entry.path}
        entry={entry}
        depth={depth}
        isExpanded={isExpanded}
        isSelected={isSelected}
        hasChildren={hasChildren}
        onToggle={onToggle}
        onSelect={onSelect}
        onContextMenu={onContextMenu}
      />,
    );

    // 如果目录已展开且有缓存，递归渲染子项
    if (isExpanded && entry.type === 'directory') {
      const children = dirCache[entry.path];
      if (children && children.length > 0) {
        const childItems = children.map((child) => ({
          entry: child,
          depth: depth + 1,
        }));
        result.push(
          ...renderTreeItems(
            childItems,
            expandedPaths,
            dirCache,
            selectedFile,
            onToggle,
            onSelect,
            onContextMenu,
          ),
        );
      }
    }
  }

  return result;
}

export function FileTree({ onContextMenu }: FileTreeProps) {
  const {
    projectPath,
    rootEntries,
    expandedPaths,
    dirCache,
    selectedFile,
    loading,
    loadRootEntries,
    toggleExpand,
    selectFile,
    refreshRoot,
  } = useFileStore();

  useEffect(() => {
    if (projectPath) {
      loadRootEntries();
    }
  }, [projectPath, loadRootEntries]);

  const handleSelect = useCallback(
    (path: string) => {
      selectFile(path);
      // 读取文件内容（Task 6 将把内容交给编辑器）
      import('../api/fs').then(({ fsApi }) => {
        fsApi.readFileText(path).catch(console.error);
      });
    },
    [selectFile],
  );

  if (!projectPath) {
    return <div className="file-tree-empty">未打开项目</div>;
  }

  if (loading && rootEntries.length === 0) {
    return <div className="file-tree-loading">加载中...</div>;
  }

  const topLevelItems: RenderItem[] = rootEntries.map((entry) => ({
    entry,
    depth: 0,
  }));

  return (
    <div className="file-tree">
      <div className="file-tree-header">
        <span className="file-tree-title">
          {useFileStore.getState().projectName}
        </span>
        <button
          className="file-tree-refresh"
          onClick={() => refreshRoot()}
          title="刷新"
        >
          ↻
        </button>
      </div>
      <div className="file-tree-content">
        {rootEntries.length === 0 ? (
          <div className="file-tree-empty">空目录</div>
        ) : (
          renderTreeItems(
            topLevelItems,
            expandedPaths,
            dirCache,
            selectedFile,
            toggleExpand,
            handleSelect,
            onContextMenu,
          )
        )}
      </div>
    </div>
  );
}
