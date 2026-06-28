import './EditorTabs.css';

interface EditorTabsProps {
  openFiles: string[];
  activeFile: string | null;
  dirtyFiles: Set<string>;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
}

export function EditorTabs({
  openFiles,
  activeFile,
  dirtyFiles,
  onSelect,
  onClose,
}: EditorTabsProps) {
  if (openFiles.length === 0) return null;

  return (
    <div className="editor-tabs">
      {openFiles.map((filePath) => {
        const fileName = filePath.split('\\').pop()?.split('/').pop() ?? filePath;
        const isActive = filePath === activeFile;
        const isDirty = dirtyFiles.has(filePath);

        return (
          <div
            key={filePath}
            className={`editor-tab ${isActive ? 'active' : ''}`}
            onClick={() => onSelect(filePath)}
          >
            <span className="editor-tab-name">
              {isDirty && <span className="editor-tab-dirty">· </span>}
              {fileName}
            </span>
            <button
              className="editor-tab-close"
              onClick={(e) => {
                e.stopPropagation();
                onClose(filePath);
              }}
              title="关闭"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
