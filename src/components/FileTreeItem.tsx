import type { FileEntry } from '../types/fs';

interface FileTreeItemProps {
  entry: FileEntry;
  depth: number;
  isExpanded: boolean;
  isSelected: boolean;
  hasChildren: boolean;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
  onContextMenu: (e: React.MouseEvent, path: string) => void;
}

/** 文件/目录名对应的图标 */
function fileIcon(name: string, type: string, isDirExpanded: boolean): string {
  if (type === 'directory') return isDirExpanded ? '📂' : '📁';
  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'kt': case 'kts': return '🟣';
    case 'java': return '🟡';
    case 'xml': return '🔵';
    case 'gradle': return '🟠';
    case 'json': return '⚪';
    case 'md': return '📝';
    case 'png': case 'jpg': case 'svg': return '🖼️';
    default: return '📄';
  }
}

export function FileTreeItem({
  entry,
  depth,
  isExpanded,
  isSelected,
  hasChildren,
  onToggle,
  onSelect,
  onContextMenu,
}: FileTreeItemProps) {
  const handleClick = () => {
    if (entry.type === 'directory') {
      onToggle(entry.path);
    } else {
      onSelect(entry.path);
    }
  };

  return (
    <div
      className={`file-tree-item ${isSelected ? 'selected' : ''}`}
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
      onClick={handleClick}
      onContextMenu={(e) => onContextMenu(e, entry.path)}
    >
      <span className="file-tree-item-icon">
        {entry.type === 'directory' && (
          <span className={`chevron ${isExpanded ? 'expanded' : ''}`}>▶</span>
        )}
        <span className="file-icon">
          {fileIcon(entry.name, entry.type, isExpanded)}
        </span>
      </span>
      <span className="file-tree-item-name">{entry.name}</span>
    </div>
  );
}
