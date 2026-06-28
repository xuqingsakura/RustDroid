import { invoke } from '@tauri-apps/api/core';
import type { FileEntry, FileContent, RecentProject, ProjectInfo } from '../types/fs';

/** 文件系统操作 API */
export const fsApi = {
  /** 读取目录内容 */
  readDirectory(path: string): Promise<FileEntry[]> {
    return invoke<FileEntry[]>('read_directory', { path });
  },

  /** 读取文本文件 */
  readFileText(path: string): Promise<FileContent> {
    return invoke<FileContent>('read_file_text', { path });
  },

  /** 写入文本文件 */
  writeFileText(path: string, content: string): Promise<void> {
    return invoke<void>('write_file_text', { path, content });
  },

  /** 创建文件 */
  createFile(path: string): Promise<void> {
    return invoke<void>('create_file', { path });
  },

  /** 创建目录 */
  createDirectory(path: string): Promise<void> {
    return invoke<void>('create_directory', { path });
  },

  /** 删除文件或目录 */
  deleteFile(path: string): Promise<void> {
    return invoke<void>('delete_file', { path });
  },

  /** 重命名 */
  renameFile(oldPath: string, newPath: string): Promise<void> {
    return invoke<void>('rename_file', { oldPath, newPath });
  },

  /** 打开项目 */
  openProject(path: string): Promise<ProjectInfo> {
    return invoke<ProjectInfo>('open_project', { path });
  },

  /** 获取最近项目 */
  getRecentProjects(): Promise<RecentProject[]> {
    return invoke<RecentProject[]>('get_recent_projects');
  },

  /** 添加最近项目 */
  addRecentProject(path: string): Promise<void> {
    return invoke<void>('add_recent_project', { path });
  },
};
