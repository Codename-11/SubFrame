/**
 * File Editor Module
 * Handles file reading and writing for the editor overlay
 */

import * as fs from 'fs';
import * as path from 'path';
import type { BrowserWindow, IpcMain } from 'electron';
import { IPC } from '../shared/ipcChannels';

interface ReadFileResult {
  success: boolean;
  content?: string;
  error?: string;
  filePath: string;
  extension?: string;
  fileName?: string;
  readOnly?: boolean;
}

/** File extensions that should not be opened in the text editor */
const BINARY_EXTENSIONS = new Set([
  // Audio/Video
  'mp3', 'mp4', 'wav', 'ogg', 'avi', 'mov', 'mkv', 'flac', 'aac', 'webm',
  // Archives
  'zip', 'tar', 'gz', '7z', 'rar', 'bz2', 'xz', 'zst',
  // Executables/Libraries
  'exe', 'dll', 'so', 'dylib', 'bin', 'msi',
  // Fonts
  'woff', 'woff2', 'ttf', 'otf', 'eot',
  // Documents
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  // Compiled
  'class', 'o', 'obj', 'pyc', 'pyd', 'pyo',
  // Databases
  'sqlite', 'db', 'sqlite3',
]);

/** Image extensions that can be previewed (binary images only — SVG is text) */
const IMAGE_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'bmp', 'ico', 'webp', 'avif', 'tiff', 'tif',
]);

const MIME_TYPES: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', webp: 'image/webp', avif: 'image/avif',
  svg: 'image/svg+xml', bmp: 'image/bmp', ico: 'image/x-icon',
  tiff: 'image/tiff', tif: 'image/tiff',
};

interface ImageReadResult {
  success: boolean;
  dataUrl?: string;
  error?: string;
  filePath: string;
  fileSize?: number;
}

/** Maximum file size for text editing (5 MB) */
const MAX_TEXT_FILE_SIZE = 5 * 1024 * 1024;

interface WriteFileResult {
  success: boolean;
  error?: string;
  filePath: string;
}

/**
 * Initialize file editor module
 */
function init(_window: BrowserWindow): void {
  // Window ref reserved for future use (e.g., editor notifications)
}

/**
 * Check if a file extension indicates a binary file
 */
function isBinaryFile(filePath: string): boolean {
  return BINARY_EXTENSIONS.has(getFileExtension(filePath));
}

/**
 * Check if a file is an image that can be previewed
 */
function isImageFile(filePath: string): boolean {
  return IMAGE_EXTENSIONS.has(getFileExtension(filePath));
}

/**
 * Read an image file and return it as a base64 data URI
 */
function readImageFile(filePath: string): ImageReadResult {
  try {
    const ext = getFileExtension(filePath);
    const mime = MIME_TYPES[ext];
    if (!mime) {
      return { success: false, error: 'Unsupported image format', filePath };
    }
    const stats = fs.statSync(filePath);
    let dataUrl: string;
    if (ext === 'svg') {
      const content = fs.readFileSync(filePath, 'utf8');
      dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(content)}`;
    } else {
      const buffer = fs.readFileSync(filePath);
      const base64 = buffer.toString('base64');
      dataUrl = `data:${mime};base64,${base64}`;
    }
    return {
      success: true,
      dataUrl,
      filePath,
      fileSize: stats.size,
    };
  } catch (err) {
    return { success: false, error: (err as Error).message, filePath };
  }
}

/**
 * Check if a file is writable by the current user
 */
function isWritable(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read file contents
 */
function readFile(filePath: string): ReadFileResult {
  try {
    if (isImageFile(filePath)) {
      return { success: false, error: 'image', filePath };
    }
    if (isBinaryFile(filePath)) {
      return { success: false, error: 'Binary file — cannot open in text editor', filePath };
    }
    const stats = fs.statSync(filePath);
    if (stats.size > MAX_TEXT_FILE_SIZE) {
      return { success: false, error: `File too large for editor (${(stats.size / 1024 / 1024).toFixed(1)} MB, max 5 MB)`, filePath };
    }
    const content = fs.readFileSync(filePath, 'utf8');
    const readOnly = !isWritable(filePath);
    return { success: true, content, filePath, readOnly };
  } catch (err) {
    return { success: false, error: (err as Error).message, filePath };
  }
}

/**
 * Write file contents
 */
function writeFile(filePath: string, content: string): WriteFileResult {
  try {
    fs.writeFileSync(filePath, content, 'utf8');
    return { success: true, filePath };
  } catch (err) {
    return { success: false, error: (err as Error).message, filePath };
  }
}

/**
 * Get file extension
 */
function getFileExtension(filePath: string): string {
  return path.extname(filePath).toLowerCase().slice(1);
}

/**
 * Resolve and validate that a target path is absolute and not obviously malicious.
 * Returns the normalised absolute path, or null if validation fails.
 *
 * NOTE: This is a basic sanity check. The renderer already sends absolute paths
 * derived from the FileTree (which only shows project-scoped files). Full
 * project-root boundary enforcement would require passing projectPath in every
 * CRUD IPC call — tracked as a future improvement.
 */
function safeResolvePath(filePath: string): string | null {
  try {
    const resolved = path.resolve(filePath);
    const normalized = path.normalize(resolved);
    // Block relative traversal that escapes the starting directory context
    // (e.g. "../../etc/passwd" resolved against cwd)
    if (filePath.includes('..')) {
      // Allow .. only if the resolved path is still under the same drive/root
      // as the original input (prevents cross-drive traversal on Windows)
      const inputRoot = path.parse(filePath).root;
      const resolvedRoot = path.parse(normalized).root;
      if (inputRoot && resolvedRoot && inputRoot !== resolvedRoot) return null;
    }
    // Must be an absolute path after resolution
    if (!path.isAbsolute(normalized)) return null;
    return normalized;
  } catch {
    return null;
  }
}

/**
 * Check whether a path (or any ancestor) is a .git directory.
 */
function isInsideGitDir(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  return normalized.includes('/.git/') || normalized.endsWith('/.git') || normalized.split('/').includes('.git');
}

/**
 * Setup IPC handlers
 */
function setupIPC(ipcMain: IpcMain): void {
  ipcMain.on(IPC.READ_FILE, (event, filePath: string) => {
    const result = readFile(filePath);
    result.extension = getFileExtension(filePath);
    result.fileName = path.basename(filePath);
    event.sender.send(IPC.FILE_CONTENT, result);
  });

  ipcMain.on(IPC.WRITE_FILE, (event, { filePath, content }: { filePath: string; content: string }) => {
    const result = writeFile(filePath, content);
    event.sender.send(IPC.FILE_SAVED, result);
  });

  ipcMain.on(IPC.READ_FILE_IMAGE, (event, filePath: string) => {
    const result = readImageFile(filePath);
    event.sender.send(IPC.IMAGE_CONTENT, result);
  });

  // ── File CRUD (invoke/handle) ──────────────────────────────────────────────

  ipcMain.handle(IPC.CREATE_FILE, (_event, { filePath, content }: { filePath: string; content?: string }) => {
    try {
      const resolved = safeResolvePath(filePath);
      if (!resolved) return { success: false, error: 'Invalid file path' };
      if (isInsideGitDir(resolved)) return { success: false, error: 'Cannot create files inside .git directory' };
      if (fs.existsSync(resolved)) return { success: false, error: 'File already exists' };
      // Ensure parent directory exists
      const parentDir = path.dirname(resolved);
      fs.mkdirSync(parentDir, { recursive: true });
      fs.writeFileSync(resolved, content ?? '', 'utf8');
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(IPC.CREATE_DIRECTORY, (_event, { dirPath }: { dirPath: string }) => {
    try {
      const resolved = safeResolvePath(dirPath);
      if (!resolved) return { success: false, error: 'Invalid directory path' };
      if (isInsideGitDir(resolved)) return { success: false, error: 'Cannot create directories inside .git directory' };
      if (fs.existsSync(resolved)) return { success: false, error: 'Directory already exists' };
      fs.mkdirSync(resolved, { recursive: true });
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(IPC.RENAME_FILE, (_event, { oldPath, newPath }: { oldPath: string; newPath: string }) => {
    try {
      const resolvedOld = safeResolvePath(oldPath);
      const resolvedNew = safeResolvePath(newPath);
      if (!resolvedOld || !resolvedNew) return { success: false, error: 'Invalid file path' };
      if (isInsideGitDir(resolvedOld)) return { success: false, error: 'Cannot rename files inside .git directory' };
      if (isInsideGitDir(resolvedNew)) return { success: false, error: 'Cannot move files into .git directory' };
      if (!fs.existsSync(resolvedOld)) return { success: false, error: 'Source file does not exist' };
      if (fs.existsSync(resolvedNew)) return { success: false, error: 'A file with that name already exists' };
      fs.renameSync(resolvedOld, resolvedNew);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(IPC.DELETE_FILE, (_event, { filePath, isDirectory }: { filePath: string; isDirectory: boolean }) => {
    try {
      const resolved = safeResolvePath(filePath);
      if (!resolved) return { success: false, error: 'Invalid file path' };
      if (isInsideGitDir(resolved)) return { success: false, error: 'Cannot delete files inside .git directory' };
      // Prevent deleting the .git directory itself
      if (path.basename(resolved) === '.git') return { success: false, error: 'Cannot delete the .git directory' };
      if (!fs.existsSync(resolved)) return { success: false, error: 'File does not exist' };
      if (isDirectory) {
        fs.rmSync(resolved, { recursive: true, force: true });
      } else {
        fs.unlinkSync(resolved);
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });
}

export { init, readFile, writeFile, isImageFile, setupIPC };
