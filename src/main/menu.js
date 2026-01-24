/**
 * Application Menu Module
 * Defines menu structure and handlers
 */

const { Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { IPC } = require('../shared/ipcChannels');

let mainWindow = null;
let appPath = null;

/**
 * Initialize menu module
 */
function init(window, app) {
  mainWindow = window;
  appPath = app.getPath('userData');
}

/**
 * Get menu template
 */
function getMenuTemplate() {
  return [
    {
      label: 'Claude Commands',
      submenu: [
        {
          label: 'Initialize Project (/init)',
          accelerator: 'CmdOrCtrl+I',
          click: () => sendCommand('/init')
        },
        {
          label: 'Commit Changes (/commit)',
          accelerator: 'CmdOrCtrl+Shift+C',
          click: () => sendCommand('/commit')
        },
        {
          label: 'Review PR (/review-pr)',
          click: () => sendCommand('/review-pr')
        },
        { type: 'separator' },
        {
          label: 'Start Claude Code',
          accelerator: 'CmdOrCtrl+K',
          click: () => sendCommand('claude')
        },
        { type: 'separator' },
        {
          label: 'Toggle Prompt History Panel',
          accelerator: 'CmdOrCtrl+Shift+H',
          click: () => toggleHistoryPanel()
        },
        {
          label: 'Open History File',
          accelerator: 'CmdOrCtrl+H',
          click: () => openHistoryFile()
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    }
  ];
}

/**
 * Send command to terminal
 */
function sendCommand(command) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(IPC.RUN_COMMAND, command);
  }
}

/**
 * Toggle history panel
 */
function toggleHistoryPanel() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(IPC.TOGGLE_HISTORY_PANEL);
  }
}

/**
 * Open history file in default editor
 */
function openHistoryFile() {
  const logPath = path.join(appPath, 'prompts-history.txt');

  // Create file if it doesn't exist
  if (!fs.existsSync(logPath)) {
    fs.writeFileSync(logPath, '# Prompt History\n\n', 'utf8');
  }

  shell.openPath(logPath);
}

/**
 * Create and set application menu
 */
function createMenu() {
  const template = getMenuTemplate();
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  return menu;
}

module.exports = {
  init,
  createMenu,
  getMenuTemplate
};
