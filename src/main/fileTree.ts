/**
 * File Tree Module
 * Generates directory tree structure with .gitignore filtering,
 * lazy directory loading, and file watching via chokidar.
 */

import * as fs from 'fs';
import * as path from 'path';
import ignore, { type Ignore } from 'ignore';
import chokidar, { type FSWatcher } from 'chokidar';
import { app } from 'electron';
import type { IpcMain } from 'electron';
import { IPC, type FileTreeNode } from '../shared/ipcChannels';
import { broadcast } from './eventBridge';

// ── .gitignore Helpers ─────────────────────────────────────────────────────

/**
 * Build an `ignore` instance from .gitignore files between projectRoot and dirPath.
 * Collects the root .gitignore first, then any nested .gitignore files along the path.
 */
function buildIgnoreFilter(projectRoot: string, dirPath?: string): Ignore {
  const ig = ignore();

  // Always ignore node_modules at any level
  ig.add('node_modules');

  // Collect .gitignore files from root down to the target directory
  const gitignorePaths: string[] = [];

  // Root .gitignore
  const rootGitignore = path.join(projectRoot, '.gitignore');
  if (fs.existsSync(rootGitignore)) {
    gitignorePaths.push(rootGitignore);
  }

  // Nested .gitignore files between root and dirPath
  if (dirPath && dirPath !== projectRoot) {
    const relative = path.relative(projectRoot, dirPath);
    const segments = relative.split(path.sep);
    let currentDir = projectRoot;
    for (const segment of segments) {
      currentDir = path.join(currentDir, segment);
      const nestedGitignore = path.join(currentDir, '.gitignore');
      if (nestedGitignore !== rootGitignore && fs.existsSync(nestedGitignore)) {
        gitignorePaths.push(nestedGitignore);
      }
    }
  }

  for (const gitignorePath of gitignorePaths) {
    try {
      const content = fs.readFileSync(gitignorePath, 'utf-8');
      ig.add(content);
    } catch {
      // Ignore read errors
    }
  }

  return ig;
}

/**
 * Check if a path should be included in the tree.
 * Always shows .subframe/ regardless of gitignore rules.
 */
function shouldInclude(
  relativePath: string,
  name: string,
  isDirectory: boolean,
  ig: Ignore,
  showDotfiles: boolean
): boolean {
  // Always show .subframe directory
  if (name === '.subframe') return true;

  // Dotfiles: hidden by default unless toggled
  if (name.startsWith('.') && !showDotfiles) return false;

  // Check gitignore — append trailing slash for directories so patterns like `dist/` match
  const testPath = isDirectory ? relativePath + '/' : relativePath;
  if (ig.ignores(testPath)) return false;

  return true;
}

// ── File Tree Generation ───────────────────────────────────────────────────

/**
 * Get file tree for a directory with .gitignore filtering.
 * When maxDepth is reached, directories are returned with hasChildren flag
 * but no children array — the renderer can lazy-load them later.
 */
function getFileTree(
  dirPath: string,
  projectRoot: string,
  maxDepth: number = 2,
  currentDepth: number = 0,
  showDotfiles: boolean = false,
  ig?: Ignore
): FileTreeNode[] {
  // Build ignore filter from project root on first call
  if (!ig) {
    ig = buildIgnoreFilter(projectRoot, dirPath);
  }

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
      const isDir = item.isDirectory();
      const fullPath = path.join(dirPath, item.name);
      const relativePath = path.relative(projectRoot, fullPath).replace(/\\/g, '/');

      if (!shouldInclude(relativePath, item.name, isDir, ig, showDotfiles)) continue;

      const fileInfo: FileTreeNode = {
        name: item.name,
        path: fullPath,
        isDirectory: isDir,
      };

      if (isDir) {
        if (currentDepth < maxDepth) {
          // Check for nested .gitignore — if found, rebuild filter for that subtree
          const nestedGitignore = path.join(fullPath, '.gitignore');
          const childIg = fs.existsSync(nestedGitignore)
            ? buildIgnoreFilter(projectRoot, fullPath)
            : ig;

          const children = getFileTree(fullPath, projectRoot, maxDepth, currentDepth + 1, showDotfiles, childIg);
          fileInfo.children = children;
          fileInfo.childrenLoaded = true;
          fileInfo.hasChildren = children.length > 0;
        } else {
          // Beyond depth limit — mark as having potential children for lazy loading
          fileInfo.hasChildren = hasVisibleChildren(fullPath, projectRoot, ig, showDotfiles);
          fileInfo.childrenLoaded = false;
        }
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
 * Quick check if a directory has any visible children (respecting gitignore + dotfiles).
 * Used to set hasChildren flag without fully reading children.
 */
function hasVisibleChildren(dirPath: string, projectRoot: string, ig: Ignore, showDotfiles: boolean): boolean {
  try {
    const items = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const item of items) {
      const relativePath = path.relative(projectRoot, path.join(dirPath, item.name)).replace(/\\/g, '/');
      if (shouldInclude(relativePath, item.name, item.isDirectory(), ig, showDotfiles)) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Load children for a specific directory (lazy loading).
 * Returns one level of children, with hasChildren flags on sub-directories.
 */
function getDirectoryChildren(
  dirPath: string,
  projectRoot: string,
  showDotfiles: boolean
): FileTreeNode[] {
  const ig = buildIgnoreFilter(projectRoot, dirPath);
  // Load one additional level (maxDepth=1 from current depth 0)
  return getFileTree(dirPath, projectRoot, 1, 0, showDotfiles, ig);
}

// ── File Watcher ───────────────────────────────────────────────────────────

let activeWatcher: FSWatcher | null = null;
let activeProjectPath: string | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Start watching a project directory for file changes.
 * Debounces events and broadcasts FILE_TREE_CHANGED to the renderer.
 */
function startWatcher(projectPath: string): void {
  // Stop any existing watcher
  stopWatcher();

  activeProjectPath = projectPath;

  // Build gitignore patterns for watcher ignore
  const ignoredPaths: string[] = [
    '**/node_modules/**',
    '**/.git/**',
  ];

  // Read .gitignore patterns for watcher ignore hints
  const rootGitignore = path.join(projectPath, '.gitignore');
  if (fs.existsSync(rootGitignore)) {
    try {
      const content = fs.readFileSync(rootGitignore, 'utf-8');
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          // Convert gitignore patterns to chokidar-compatible glob patterns
          const cleaned = trimmed.replace(/^\//, '').replace(/\/$/, '');
          ignoredPaths.push(`**/${cleaned}/**`);
          ignoredPaths.push(`**/${cleaned}`);
        }
      }
    } catch {
      // Ignore read errors
    }
  }

  try {
    activeWatcher = chokidar.watch(projectPath, {
      ignoreInitial: true,
      ignored: ignoredPaths,
      depth: 20,
      followSymlinks: false,
      usePolling: false,
      ignorePermissionErrors: true,
    });
  } catch (err) {
    console.error('[FileTree] Failed to start watcher:', err instanceof Error ? err.message : String(err));
    activeProjectPath = null;
    activeWatcher = null;
    return;
  }

  const emitChange = (event: string, filePath: string) => {
    if (!activeProjectPath) return;

    // Debounce: accumulate events and emit once after 300ms of quiet
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      broadcast(IPC.FILE_TREE_CHANGED, {
        projectPath: activeProjectPath!,
        event,
        path: filePath,
      });
    }, 300);
  };

  activeWatcher
    .on('add', (filePath: string) => emitChange('add', filePath))
    .on('addDir', (filePath: string) => emitChange('addDir', filePath))
    .on('unlink', (filePath: string) => emitChange('unlink', filePath))
    .on('unlinkDir', (filePath: string) => emitChange('unlinkDir', filePath))
    .on('error', (error: unknown) => {
      console.error('[FileTree] Watcher error:', error instanceof Error ? error.message : String(error));
    });
}

/**
 * Stop the active file watcher and clean up resources.
 */
function stopWatcher(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (activeWatcher) {
    activeWatcher.close().catch((err: Error) => {
      console.error('[FileTree] Error closing watcher:', err.message);
    });
    activeWatcher = null;
  }
  activeProjectPath = null;
}

// Clean up watcher on app quit
app.on('before-quit', () => {
  stopWatcher();
});

// ── IPC Handlers ───────────────────────────────────────────────────────────

/**
 * Setup IPC handlers
 */
function setupIPC(ipcMain: IpcMain): void {
  // Load full file tree (initial + refresh)
  ipcMain.on(IPC.LOAD_FILE_TREE, (event, data: string | { path: string; showDotfiles?: boolean }) => {
    const projectPath = typeof data === 'string' ? data : data.path;
    const showDotfiles = typeof data === 'object' ? !!data.showDotfiles : false;
    const files = getFileTree(projectPath, projectPath, 2, 0, showDotfiles);
    event.sender.send(IPC.FILE_TREE_DATA, files);
  });

  // Load children of a specific directory (lazy loading)
  ipcMain.on(IPC.LOAD_DIRECTORY_CHILDREN, (event, data: { path: string; showDotfiles: boolean }) => {
    // Determine the project root — use the active watcher path or walk up to find .git
    const projectRoot = activeProjectPath || findProjectRoot(data.path);
    const children = getDirectoryChildren(data.path, projectRoot, data.showDotfiles);
    event.sender.send(IPC.DIRECTORY_CHILDREN_DATA, { path: data.path, children });
  });

  // Start file watcher for a project
  ipcMain.on(IPC.START_FILE_WATCHER, (_event, data: { projectPath: string }) => {
    startWatcher(data.projectPath);
  });

  // Stop file watcher
  ipcMain.on(IPC.STOP_FILE_WATCHER, () => {
    stopWatcher();
  });
}

/**
 * Walk up from a directory to find the project root (directory containing .git).
 * Falls back to the directory itself.
 */
function findProjectRoot(dirPath: string): string {
  let current = dirPath;
  while (current !== path.dirname(current)) {
    if (fs.existsSync(path.join(current, '.git'))) return current;
    current = path.dirname(current);
  }
  return dirPath;
}

export { getFileTree, getDirectoryChildren, startWatcher, stopWatcher, setupIPC };
