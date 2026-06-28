import { useRef, useCallback, useMemo } from 'react';
import Editor, { OnMount, OnChange } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import './Editor.css';
import { TOKYO_NIGHT_THEME } from './tokyo-night-theme';

interface MonacoEditorProps {
  path: string;
  value: string;
  language?: string;
  onChange?: (value: string) => void;
  onMount?: (editor: editor.IStandaloneCodeEditor) => void;
  options?: editor.IStandaloneEditorConstructionOptions;
}

function pathToLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'java': return 'java';
    case 'kt': case 'kts': return 'kotlin';
    case 'xml': case 'html': return 'xml';
    case 'json': return 'json';
    case 'js': case 'jsx': return 'javascript';
    case 'ts': case 'tsx': return 'typescript';
    case 'rs': return 'rust';
    case 'py': return 'python';
    case 'md': return 'markdown';
    case 'yaml': case 'yml': return 'yaml';
    case 'css': return 'css';
    case 'scss': return 'scss';
    case 'sh': case 'bash': return 'shell';
    case 'gradle': return 'groovy';
    default: return 'plaintext';
  }
}

const DEFAULT_OPTIONS: editor.IStandaloneEditorConstructionOptions = {
  fontSize: 14,
  fontFamily: "'JetBrains Mono', 'Consolas', monospace",
  lineNumbers: 'on',
  minimap: { enabled: true },
  scrollBeyondLastLine: false,
  automaticLayout: true,
  tabSize: 4,
  wordWrap: 'off',
  renderWhitespace: 'selection',
  bracketPairColorization: { enabled: true },
  padding: { top: 8 },
  smoothScrolling: true,
  cursorBlinking: 'smooth',
  cursorSmoothCaretAnimation: 'on',
};

export function MonacoEditor({
  path,
  value,
  onChange,
  onMount,
  options,
}: MonacoEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const mergedOptions = useMemo(
    () => ({ ...DEFAULT_OPTIONS, ...options }),
    [options],
  );

  const handleMount: OnMount = useCallback(
    (editorInstance, monaco) => {
      editorRef.current = editorInstance;
      // 注册 Tokyo Night 主题
      monaco.editor.defineTheme('tokyo-night', TOKYO_NIGHT_THEME);
      monaco.editor.setTheme('tokyo-night');
      onMount?.(editorInstance);
    },
    [onMount],
  );

  const handleChange: OnChange = useCallback(
    (val) => {
      onChange?.(val ?? '');
    },
    [onChange],
  );

  const resolvedLanguage = language ?? pathToLanguage(path);

  return (
    <div className="editor-wrapper">
      <Editor
        path={path}
        language={resolvedLanguage}
        value={value}
        onChange={handleChange}
        onMount={handleMount}
        options={mergedOptions}
        loading={<div className="editor-loading">加载编辑器...</div>}
      />
    </div>
  );
}
