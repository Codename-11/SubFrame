/**
 * Settings Manager
 * Manages application settings stored in frame-settings.json
 */

const { ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const { IPC } = require('../shared/ipcChannels');

let mainWindow = null;
let settingsPath = null;

// Default settings
const DEFAULT_SETTINGS = {
  general: {
    autoCreateTerminal: false,
    defaultProjectDir: ''
  },
  aiTools: {},
  terminal: {
    fontSize: 14,
    scrollback: 10000
  }
};

let settings = null;

/**
 * Initialize the settings manager
 */
function init(window, app) {
  mainWindow = window;
  settingsPath = path.join(app.getPath('userData'), 'frame-settings.json');
  loadSettings();
  setupIPC();
}

/**
 * Load settings from file
 */
function loadSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf8');
      const loaded = JSON.parse(data);
      settings = deepMerge(structuredClone(DEFAULT_SETTINGS), loaded);
    } else {
      settings = structuredClone(DEFAULT_SETTINGS);
    }
  } catch (error) {
    console.error('Error loading settings:', error);
    settings = structuredClone(DEFAULT_SETTINGS);
  }
  return settings;
}

/**
 * Save settings to file
 */
function saveSettings() {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
  } catch (error) {
    console.error('Error saving settings:', error);
  }
}

/**
 * Update a setting by key path (e.g. 'aiTools.claude.customCommand')
 */
function updateSetting(keyPath, value) {
  const keys = keyPath.split('.');
  let obj = settings;

  for (let i = 0; i < keys.length - 1; i++) {
    if (obj[keys[i]] === undefined || obj[keys[i]] === null) {
      obj[keys[i]] = {};
    }
    obj = obj[keys[i]];
  }

  obj[keys[keys.length - 1]] = value;
  saveSettings();

  // Notify renderer
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(IPC.SETTINGS_UPDATED, { key: keyPath, value, settings });
  }

  return settings;
}

/**
 * Get a setting by key path
 */
function getSetting(keyPath) {
  const keys = keyPath.split('.');
  let obj = settings;

  for (const key of keys) {
    if (obj === undefined || obj === null) return undefined;
    obj = obj[key];
  }

  return obj;
}

/**
 * Deep merge two objects
 */
function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

/**
 * Setup IPC handlers
 */
function setupIPC() {
  ipcMain.handle(IPC.LOAD_SETTINGS, () => {
    return settings;
  });

  ipcMain.handle(IPC.UPDATE_SETTING, (event, { key, value }) => {
    return updateSetting(key, value);
  });
}

module.exports = {
  init,
  loadSettings,
  saveSettings,
  updateSetting,
  getSetting
};
