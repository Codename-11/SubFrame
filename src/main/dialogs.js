/**
 * Dialogs Module
 * Handles system dialogs - folder picker, file dialogs
 */

const { dialog } = require('electron');
const { IPC } = require('../shared/ipcChannels');

let mainWindow = null;
let onProjectSelected = null;

/**
 * Initialize dialogs module
 */
function init(window, callback) {
  mainWindow = window;
  onProjectSelected = callback;
}

/**
 * Show folder picker dialog
 */
async function showFolderPicker(event) {
  const result = await dialog.showOpenDialog(mainWindow, {
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
async function showNewProjectDialog(event) {
  const result = await dialog.showOpenDialog(mainWindow, {
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
async function showDefaultProjectDirPicker() {
  const result = await dialog.showOpenDialog(mainWindow, {
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
function setupIPC(ipcMain) {
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

module.exports = {
  init,
  showFolderPicker,
  showNewProjectDialog,
  setupIPC
};
