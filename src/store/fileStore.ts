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

  // Actions
  setProjectPath: (path: string | null) => void;
  loadRootEntries: () => Promise<void>;
  loadDirectory: (path: string) => Promise<FileEntry[]>;
  toggleExpand: (path: string) => Promise<void>;
  selectFile: (path: string | null) => void;
  addOpenFile: (path: string) => void;
  removeOpenFile: (path: string) => void;
  refreshRoot: () => Promise<void>;
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
      // 惰性加载子目录（如未缓存）
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
    // 同时刷新所有已展开的目录
    const { expandedPaths } = get();
    for (const dirPath of expandedPaths) {
      await get().loadDirectory(dirPath);
    }
  },
}));
