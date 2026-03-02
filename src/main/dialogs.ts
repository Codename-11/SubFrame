/**
 * Dialogs Module
 * Handles system dialogs - folder picker, file dialogs
 */

import { dialog, BrowserWindow, IpcMainEvent } from 'electron';
import type { IpcMain } from 'electron';
import { IPC } from '../shared/ipcChannels';

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
}

export { init, showFolderPicker, showNewProjectDialog, setupIPC };
