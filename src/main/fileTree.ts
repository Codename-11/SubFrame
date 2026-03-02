/**
 * File Tree Module
 * Generates directory tree structure
 */

import * as fs from 'fs';
import * as path from 'path';
import type { IpcMain } from 'electron';
import { IPC, type FileTreeNode } from '../shared/ipcChannels';

/**
 * Get file tree for a directory
 */
function getFileTree(dirPath: string, maxDepth: number = 5, currentDepth: number = 0, showDotfiles: boolean = false): FileTreeNode[] {
  if (currentDepth >= maxDepth) return [];

  try {
    const items = fs.readdirSync(dirPath, { withFileTypes: true });

    // Sort: directories first, then files
    items.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    const files: FileTreeNode[] = [];

    for (const item of items) {
      // Skip node_modules
      if (item.name === 'node_modules') continue;

      // Dotfiles: always show .subframe, skip others unless showDotfiles enabled
      if (item.name.startsWith('.') && item.name !== '.subframe' && !showDotfiles) continue;

      const fullPath = path.join(dirPath, item.name);
      const fileInfo: FileTreeNode = {
        name: item.name,
        path: fullPath,
        isDirectory: item.isDirectory()
      };

      // Recursively get children for directories
      if (item.isDirectory()) {
        fileInfo.children = getFileTree(fullPath, maxDepth, currentDepth + 1, showDotfiles);
      }

      files.push(fileInfo);
    }

    return files;
  } catch (err) {
    console.error('Error reading directory:', err);
    return [];
  }
}

/**
 * Setup IPC handlers
 */
function setupIPC(ipcMain: IpcMain): void {
  ipcMain.on(IPC.LOAD_FILE_TREE, (event, data: string | { path: string; showDotfiles?: boolean }) => {
    const projectPath = typeof data === 'string' ? data : data.path;
    const showDotfiles = typeof data === 'object' ? !!data.showDotfiles : false;
    const files = getFileTree(projectPath, 5, 0, showDotfiles);
    event.sender.send(IPC.FILE_TREE_DATA, files);
  });
}

export { getFileTree, setupIPC };
