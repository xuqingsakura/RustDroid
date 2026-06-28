import { invoke } from '@tauri-apps/api/core';

/**
 * 获取应用版本号（来自 Rust 后端 ide-ipc 的 app_version 命令）
 */
export async function getVersion(): Promise<string> {
  return invoke<string>('app_version');
}
