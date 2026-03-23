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
    reuseIdleTerminal: boolean;
    defaultProjectDir: string;
    showDotfiles: boolean;
    confirmBeforeClose: boolean;
    usagePollingInterval: number;
    gridOverflowAutoSwitch: boolean;
    highlightUserMessages: boolean;
    userMessageColor: string;
  };
  aiTools: Record<string, unknown>;
  terminal: {
    fontSize: number;
    scrollback: number;
    fontFamily: string;
    lineHeight: number;
    cursorBlink: boolean;
    cursorStyle: string;
    defaultShell: string;
    bellSound: boolean;
    copyOnSelect: boolean;
    maxTerminals: number;
    restoreOnStartup: boolean;
    restoreScrollback: boolean;
    autoResumeAgent: 'auto' | 'prompt' | 'never';
    agentExitTimeout: number;
    maxScrollbackExport: number;
  };
  editor: {
    minimap: boolean;
    fullscreen: boolean;
    theme: string;
    wordWrap: boolean;
    fontSize: number;
    fontFamily: string;
    lineNumbers: boolean;
    bracketMatching: boolean;
    tabSize: number;
  };
  updater: {
    autoCheck: boolean;
    allowPrerelease: string;
    checkIntervalHours: number;
  };
  onboarding: {
    analysisTimeout: number;
  };
  appearance: {
    activeThemeId: string;
    customThemes: Array<{
      id: string;
      name: string;
      description: string;
      tokens: Record<string, unknown>;
      builtIn: boolean;
      createdAt?: string;
    }>;
  };
  [key: string]: unknown;
}

// Default settings
const DEFAULT_SETTINGS: DefaultSettings = {
  general: {
    autoCreateTerminal: false,
    reuseIdleTerminal: true,
    defaultProjectDir: '',
    showDotfiles: false,
    confirmBeforeClose: true,
    usagePollingInterval: 0,
    gridOverflowAutoSwitch: true,
    highlightUserMessages: true,
    userMessageColor: '#ff6eb4',
  },
  aiTools: {},
  terminal: {
    fontSize: 14,
    scrollback: 10000,
    fontFamily: "'JetBrainsMono Nerd Font', 'CaskaydiaCove Nerd Font', 'FiraCode Nerd Font', 'JetBrains Mono', 'Cascadia Code', 'Fira Code', monospace",
    lineHeight: 1.2,
    cursorBlink: true,
    cursorStyle: 'bar',
    defaultShell: '',
    bellSound: false,
    copyOnSelect: false,
    maxTerminals: 9,
    restoreOnStartup: true,
    restoreScrollback: false,
    autoResumeAgent: 'prompt',
    agentExitTimeout: 5000,
    maxScrollbackExport: 5000,
  },
  editor: {
    minimap: false,
    fullscreen: false,
    theme: 'subframe-dark',
    wordWrap: false,
    fontSize: 12,
    fontFamily: "'JetBrainsMono Nerd Font', 'CaskaydiaCove Nerd Font', 'FiraCode Nerd Font', 'JetBrains Mono', 'Cascadia Code', 'Fira Code', monospace",
    lineNumbers: true,
    bracketMatching: true,
    tabSize: 2,
  },
  updater: {
    autoCheck: true,
    allowPrerelease: 'auto',
    checkIntervalHours: 1,
  },
  onboarding: {
    analysisTimeout: 120000,
  },
  appearance: {
    activeThemeId: 'classic-amber',
    customThemes: [],
  },
};

let settings: Record<string, unknown> | null = null;

type SettingChangeListener = (key: string, value: unknown) => void;
const changeListeners: SettingChangeListener[] = [];

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

  // Notify main-process listeners
  for (const listener of changeListeners) {
    listener(keyPath, value);
  }

  return settings as Record<string, unknown>;
}

/**
 * Register a listener for setting changes (main-process only)
 */
function onSettingChange(listener: SettingChangeListener): () => void {
  changeListeners.push(listener);
  return () => {
    const idx = changeListeners.indexOf(listener);
    if (idx >= 0) changeListeners.splice(idx, 1);
  };
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

export { init, loadSettings, saveSettings, updateSetting, getSetting, onSettingChange };
