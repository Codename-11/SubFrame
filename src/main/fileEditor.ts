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
}

export { init, readFile, writeFile, isImageFile, setupIPC };
