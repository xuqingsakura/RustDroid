import { create } from 'zustand';
import type { FileEntry } from '../types/fs';
import { fsApi } from '../api/fs';

interface FileStoreState {
  /** 当前项目根路径 */
  projectPath: string | null;
  /** 项目名称 */
  projectName: string;
  /** 根目录文件/目录列表 */
  rootEntries: FileEntry[];
  /** 子目录缓存（path → FileEntry[]） */
  dirCache: Record<string, FileEntry[]>;
  /** 展开的目录路径集合 */
  expandedPaths: Set<string>;
  /** 当前选中文件路径 */
  selectedFile: string | null;
  /** 打开的编辑器文件路径列表 */
  openFiles: string[];
  /** 加载状态 */
  loading: boolean;

  // Sprint 1-3: 编辑器相关
  /** 文件内容缓存 (path → content) */
  fileContents: Record<string, string>;
  /** 当前激活的文件路径 */
  activeFile: string | null;
  /** 已修改但未保存的文件路径集合 */
  dirtyFiles: Set<string>;
  /** 加载文件内容中 */
  loadingFile: boolean;

  // Actions
  setProjectPath: (path: string | null) => void;
  loadRootEntries: () => Promise<void>;
  loadDirectory: (path: string) => Promise<FileEntry[]>;
  toggleExpand: (path: string) => Promise<void>;
  selectFile: (path: string | null) => void;
  addOpenFile: (path: string) => void;
  removeOpenFile: (path: string) => void;
  refreshRoot: () => Promise<void>;

  // Sprint 1-3: 编辑器 actions
  openFile: (path: string) => Promise<void>;
  setActiveFile: (path: string | null) => void;
  setFileContent: (path: string, content: string) => void;
  setFileDirty: (path: string, dirty: boolean) => void;
  closeFile: (path: string) => void;
  saveFile: (path: string) => Promise<void>;
}

export const useFileStore = create<FileStoreState>((set, get) => ({
  projectPath: null,
  projectName: '',
  rootEntries: [],
  dirCache: {},
  expandedPaths: new Set<string>(),
  selectedFile: null,
  openFiles: [],
  loading: false,
  fileContents: {},
  activeFile: null,
  dirtyFiles: new Set<string>(),
  loadingFile: false,

  setProjectPath: (path) => {
    set({
      projectPath: path,
      projectName: path
        ? (path.split('\\').pop()?.split('/').pop() ?? '')
        : '',
      rootEntries: [],
      dirCache: {},
      expandedPaths: new Set<string>(),
      selectedFile: null,
      openFiles: [],
      fileContents: {},
      activeFile: null,
      dirtyFiles: new Set<string>(),
    });
  },

  loadRootEntries: async () => {
    const { projectPath } = get();
    if (!projectPath) return;
    set({ loading: true });
    try {
      const entries = await fsApi.readDirectory(projectPath);
      set({ rootEntries: entries, loading: false });
    } catch (e) {
      console.error('Failed to load root entries:', e);
      set({ loading: false });
    }
  },

  loadDirectory: async (path: string) => {
    try {
      const entries = await fsApi.readDirectory(path);
      set((state) => ({
        dirCache: { ...state.dirCache, [path]: entries },
      }));
      return entries;
    } catch (e) {
      console.error('Failed to load directory:', path, e);
      return [];
    }
  },

  toggleExpand: async (path: string) => {
    const { expandedPaths, dirCache } = get();
    const newExpanded = new Set(expandedPaths);

    if (newExpanded.has(path)) {
      newExpanded.delete(path);
      set({ expandedPaths: newExpanded });
    } else {
      newExpanded.add(path);
      set({ expandedPaths: newExpanded });
      if (!dirCache[path]) {
        await get().loadDirectory(path);
      }
    }
  },

  selectFile: (path) => set({ selectedFile: path }),

  addOpenFile: (path) => {
    const { openFiles } = get();
    if (!openFiles.includes(path)) {
      set({ openFiles: [...openFiles, path] });
    }
  },

  removeOpenFile: (path) => {
    set((state) => ({
      openFiles: state.openFiles.filter((f) => f !== path),
    }));
  },

  refreshRoot: async () => {
    await get().loadRootEntries();
    const { expandedPaths } = get();
    for (const dirPath of expandedPaths) {
      await get().loadDirectory(dirPath);
    }
  },

  // Sprint 1-3: 编辑器 actions

  openFile: async (path: string) => {
    const { fileContents, openFiles } = get();

    // 如果内容已缓存，直接打开
    if (fileContents[path]) {
      set((state) => ({
        activeFile: path,
        selectedFile: path,
        openFiles: state.openFiles.includes(path)
          ? state.openFiles
          : [...state.openFiles, path],
      }));
      return;
    }

    set({ loadingFile: true });
    try {
      const result = await fsApi.readFileText(path);
      set((state) => ({
        fileContents: { ...state.fileContents, [path]: result.content },
        activeFile: path,
        selectedFile: path,
        openFiles: state.openFiles.includes(path)
          ? state.openFiles
          : [...state.openFiles, path],
        loadingFile: false,
      }));
    } catch (e) {
      console.error('Failed to open file:', path, e);
      set({ loadingFile: false });
    }
  },

  setActiveFile: (path) => set({ activeFile: path }),

  setFileContent: (path, content) => {
    set((state) => ({
      fileContents: { ...state.fileContents, [path]: content },
      dirtyFiles: new Set(state.dirtyFiles).add(path),
    }));
  },

  setFileDirty: (path, dirty) => {
    set((state) => {
      const newDirty = new Set(state.dirtyFiles);
      if (dirty) {
        newDirty.add(path);
      } else {
        newDirty.delete(path);
      }
      return { dirtyFiles: newDirty };
    });
  },

  closeFile: (path) => {
    set((state) => {
      const newOpenFiles = state.openFiles.filter((f) => f !== path);
      const newContents = { ...state.fileContents };
      delete newContents[path];
      const newDirty = new Set(state.dirtyFiles);
      newDirty.delete(path);

      // 如果关闭的是当前激活文件，切换到另一个
      let newActive = state.activeFile;
      if (state.activeFile === path) {
        newActive = newOpenFiles.length > 0
          ? newOpenFiles[newOpenFiles.length - 1]
          : null;
      }

      return {
        openFiles: newOpenFiles,
        fileContents: newContents,
        dirtyFiles: newDirty,
        activeFile: newActive,
        selectedFile: newActive,
      };
    });
  },

  saveFile: async (path: string) => {
    const { fileContents, dirtyFiles } = get();
    const content = fileContents[path];
    if (content === undefined) return;

    try {
      await fsApi.writeFileText(path, content);
      const newDirty = new Set(dirtyFiles);
      newDirty.delete(path);
      set({ dirtyFiles: newDirty });
    } catch (e) {
      console.error('Failed to save file:', path, e);
    }
  },
}));
