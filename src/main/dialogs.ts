/**
 * Dialogs Module
 * Handles system dialogs - folder picker, file dialogs
 */

import { dialog, BrowserWindow, IpcMainEvent } from 'electron';
import type { IpcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { IPC } from '../shared/ipcChannels';
import { broadcast } from './eventBridge';

let mainWindow: BrowserWindow | null = null;
let onProjectSelected: ((projectPath: string) => void) | null = null;

/**
 * Initialize dialogs module
 */
function init(window: BrowserWindow, callback: (projectPath: string) => void): void {
  mainWindow = window;
  onProjectSelected = callback;
}

/**
 * Show folder picker dialog
 */
async function showFolderPicker(event: IpcMainEvent): Promise<string | null> {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory'],
    title: 'Select Project Folder'
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const selectedPath = result.filePaths[0];

    if (onProjectSelected) {
      onProjectSelected(selectedPath);
    }

    event.sender.send(IPC.PROJECT_SELECTED, selectedPath);
    return selectedPath;
  }

  return null;
}

/**
 * Show new project dialog
 */
async function showNewProjectDialog(event: IpcMainEvent): Promise<string | null> {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Select Location for New Project',
    buttonLabel: 'Create Project Here'
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const selectedPath = result.filePaths[0];

    if (onProjectSelected) {
      onProjectSelected(selectedPath);
    }

    event.sender.send(IPC.PROJECT_SELECTED, selectedPath);
    return selectedPath;
  }

  return null;
}

/**
 * Show open file dialog and broadcast selected file path to renderer
 */
async function showOpenFileDialog(): Promise<string | null> {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile'],
    title: 'Open File',
    filters: [
      { name: 'All Files', extensions: ['*'] },
      { name: 'Text Files', extensions: ['txt', 'md', 'json', 'yaml', 'yml', 'toml', 'xml', 'csv'] },
      { name: 'Source Code', extensions: ['ts', 'tsx', 'js', 'jsx', 'py', 'rs', 'go', 'java', 'c', 'cpp', 'h', 'css', 'html', 'scss', 'vue', 'svelte'] },
      { name: 'Config Files', extensions: ['env', 'ini', 'cfg', 'conf'] },
    ]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const selectedPath = result.filePaths[0];
    broadcast(IPC.MENU_OPEN_FILE, selectedPath);
    return selectedPath;
  }

  return null;
}

/**
 * Show default project directory picker
 */
async function showDefaultProjectDirPicker(): Promise<string | null> {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory'],
    title: 'Select Default Project Directory'
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
}

/**
 * Show a generic folder picker dialog (invoke-style).
 */
async function selectFolder(): Promise<{ path: string } | null> {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory'],
    title: 'Select Folder',
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return { path: result.filePaths[0] };
  }
  return null;
}

/**
 * Create a new folder inside a parent directory.
 */
function createFolder(parentPath: string, folderName: string): { path: string } {
  if (/[/\\]/.test(folderName)) {
    throw new Error('Folder name cannot contain path separators');
  }
  const trimmed = folderName.trim();
  if (!trimmed) {
    throw new Error('Folder name cannot be empty');
  }
  const fullPath = path.join(parentPath, trimmed);
  fs.mkdirSync(fullPath, { recursive: true });
  return { path: fullPath };
}

/**
 * Setup IPC handlers
 */
function setupIPC(ipcMain: IpcMain): void {
  ipcMain.on(IPC.SELECT_PROJECT_FOLDER, async (event) => {
    await showFolderPicker(event);
  });

  ipcMain.on(IPC.CREATE_NEW_PROJECT, async (event) => {
    await showNewProjectDialog(event);
  });

  ipcMain.handle(IPC.SELECT_DEFAULT_PROJECT_DIR, async () => {
    return showDefaultProjectDirPicker();
  });

  ipcMain.handle(IPC.MENU_OPEN_FILE, async () => {
    return showOpenFileDialog();
  });

  ipcMain.handle(IPC.SELECT_FOLDER, async () => {
    return selectFolder();
  });

  ipcMain.handle(IPC.CREATE_FOLDER, async (_event, payload: { parentPath: string; folderName: string }) => {
    return createFolder(payload.parentPath, payload.folderName);
  });
}

export { init, showFolderPicker, showNewProjectDialog, showOpenFileDialog, setupIPC };
