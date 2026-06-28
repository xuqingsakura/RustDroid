/** 文件条目 */
export interface FileEntry {
  name: string;
  path: string;
  /** "file" | "directory" | "symlink" */
  type: 'file' | 'directory' | 'symlink';
  size?: number;
  modified: number;
}

/** 文件读取结果 */
export interface FileContent {
  content: string;
  encoding: string;
  size: number;
}

/** 文件变更事件 */
export interface FileChangeEvent {
  kind: 'created' | 'modified' | 'deleted';
  path: string;
}

/** 最近项目 */
export interface RecentProject {
  name: string;
  path: string;
  lastOpened: string;
}

/** 项目信息 */
export interface ProjectInfo {
  name: string;
  path: string;
  isAndroidProject: boolean;
  fileCount: number;
}
