/**
 * Settings Manager
 * Manages application settings stored in frame-settings.json
 */

import { ipcMain, type App, type BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { IPC } from '../shared/ipcChannels';

let mainWindow: BrowserWindow | null = null;
let settingsPath: string | null = null;

interface DefaultSettings {
  general: {
    autoCreateTerminal: boolean;
    defaultProjectDir: string;
    showDotfiles: boolean;
  };
  aiTools: Record<string, unknown>;
  terminal: {
    fontSize: number;
    scrollback: number;
  };
  editor: {
    minimap: boolean;
    fullscreen: boolean;
    theme: string;
    wordWrap: boolean;
    fontSize: number;
  };
  onboarding: {
    analysisTimeout: number;
  };
  [key: string]: unknown;
}

// Default settings
const DEFAULT_SETTINGS: DefaultSettings = {
  general: {
    autoCreateTerminal: false,
    defaultProjectDir: '',
    showDotfiles: false
  },
  aiTools: {},
  terminal: {
    fontSize: 14,
    scrollback: 10000
  },
  editor: {
    minimap: false,
    fullscreen: false,
    theme: 'subframe-dark',
    wordWrap: false,
    fontSize: 12,
  },
  onboarding: {
    analysisTimeout: 120000,
  }
};

let settings: Record<string, unknown> | null = null;

/**
 * Initialize the settings manager
 */
function init(window: BrowserWindow, app: App): void {
  mainWindow = window;
  settingsPath = path.join(app.getPath('userData'), 'frame-settings.json');
  loadSettings();
  setupIPC();
}

/**
 * Load settings from file
 */
function loadSettings(): Record<string, unknown> {
  try {
    if (settingsPath && fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf8');
      const loaded = JSON.parse(data);
      settings = deepMerge(structuredClone(DEFAULT_SETTINGS) as Record<string, unknown>, loaded);
    } else {
      settings = structuredClone(DEFAULT_SETTINGS) as Record<string, unknown>;
    }
  } catch (error) {
    console.error('Error loading settings:', error);
    settings = structuredClone(DEFAULT_SETTINGS) as Record<string, unknown>;
  }
  return settings!;
}

/**
 * Save settings to file
 */
function saveSettings(): void {
  try {
    if (settingsPath) {
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
    }
  } catch (error) {
    console.error('Error saving settings:', error);
  }
}

/**
 * Update a setting by key path (e.g. 'aiTools.claude.customCommand')
 */
function updateSetting(keyPath: string, value: unknown): Record<string, unknown> {
  const keys = keyPath.split('.');
  let obj: Record<string, unknown> = settings as Record<string, unknown>;

  for (let i = 0; i < keys.length - 1; i++) {
    if (obj[keys[i]] === undefined || obj[keys[i]] === null) {
      obj[keys[i]] = {};
    }
    obj = obj[keys[i]] as Record<string, unknown>;
  }

  obj[keys[keys.length - 1]] = value;
  saveSettings();

  // Notify renderer
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(IPC.SETTINGS_UPDATED, { key: keyPath, value, settings });
  }

  return settings as Record<string, unknown>;
}

/**
 * Get a setting by key path
 */
function getSetting(keyPath: string): unknown {
  const keys = keyPath.split('.');
  let obj: unknown = settings;

  for (const key of keys) {
    if (obj === undefined || obj === null) return undefined;
    obj = (obj as Record<string, unknown>)[key];
  }

  return obj;
}

/**
 * Deep merge two objects
 */
function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      deepMerge(target[key] as Record<string, unknown>, source[key] as Record<string, unknown>);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

/**
 * Setup IPC handlers
 */
function setupIPC(): void {
  ipcMain.handle(IPC.LOAD_SETTINGS, () => {
    return settings;
  });

  ipcMain.handle(IPC.UPDATE_SETTING, (_event, { key, value }: { key: string; value: unknown }) => {
    return updateSetting(key, value);
  });
}

export { init, loadSettings, saveSettings, updateSetting, getSetting };
