/**
 * Settings Manager
 * Manages application settings stored in frame-settings.json
 */

import { ipcMain, type App, type BrowserWindow, type IpcMain } from 'electron';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { IPC } from '../shared/ipcChannels';
import { broadcast } from './eventBridge';
import type { RoutableIPC } from './ipcRouter';

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
    showFreezeHoverAction: boolean;
    showFreezeOverlay: boolean;
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
    workspacePillDisplay: {
      showIndex: boolean;
      showShortLabel: boolean;
      showIcon: boolean;
    };
    customThemes: Array<{
      id: string;
      name: string;
      description: string;
      tokens: Record<string, unknown>;
      builtIn: boolean;
      createdAt?: string;
    }>;
  };
  server: {
    enabled: boolean;
    startOnLaunch: boolean;
    port: number;
    lastPort: number;
    terminalBatchIntervalMs: number;
    lanMode: boolean;
    showRemoteCursor: boolean;
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
    showFreezeHoverAction: true,
    showFreezeOverlay: true,
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
    workspacePillDisplay: {
      showIndex: true,
      showShortLabel: false,
      showIcon: false,
    },
    customThemes: [],
  },
  server: {
    enabled: false,
    startOnLaunch: false,
    port: 0,
    lastPort: 0,
    terminalBatchIntervalMs: 16,
    lanMode: false,
    showRemoteCursor: false,
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
}

/**
 * Load settings from file
 */
function loadSettings(): Record<string, unknown> {
  try {
    if (settingsPath && fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf8');
      const loaded = JSON.parse(data) as Record<string, unknown>;
      const loadedServer = loaded.server as Record<string, unknown> | undefined;
      if (
        loadedServer &&
        !Object.prototype.hasOwnProperty.call(loadedServer, 'startOnLaunch') &&
        loadedServer.enabled === true
      ) {
        loadedServer.startOnLaunch = true;
      }
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
    broadcast(IPC.SETTINGS_UPDATED, { key: keyPath, value, settings });
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
function setupIPC(ipc: RoutableIPC | IpcMain = ipcMain): void {
  ipc.handle(IPC.LOAD_SETTINGS, () => {
    return settings;
  });

  ipc.handle(IPC.UPDATE_SETTING, (_event, { key, value }: { key: string; value: unknown }) => {
    return updateSetting(key, value);
  });

  // AI Configuration status — check existence and validate config files for all AI tools
  ipc.handle(IPC.GET_CLAUDE_CONFIG_STATUS, (_event, projectPath: string | null) => {
    const home = os.homedir();

    interface FileStatus {
      exists: boolean;
      path: string;
      size?: number;
      warnings?: string[];
    }

    function checkFile(filePath: string, validate?: (content: string) => string[]): FileStatus {
      const exists = fs.existsSync(filePath);
      if (!exists) return { exists, path: filePath };
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const stat = fs.statSync(filePath);
        const warnings = validate ? validate(content) : [];
        return { exists, path: filePath, size: stat.size, warnings };
      } catch {
        return { exists, path: filePath, warnings: ['Could not read file'] };
      }
    }

    // JSON validator — checks parse errors + common issues
    function validateJson(content: string): string[] {
      const warnings: string[] = [];
      try {
        const parsed = JSON.parse(content);
        if (typeof parsed !== 'object' || parsed === null) warnings.push('Root must be an object');
      } catch (e) {
        warnings.push(`Invalid JSON: ${(e as Error).message}`);
      }
      return warnings;
    }

    // Markdown validator — checks for common issues
    function validateMd(content: string): string[] {
      const warnings: string[] = [];
      if (content.trim().length === 0) warnings.push('File is empty');
      if (content.length > 50000) warnings.push(`File is large (${Math.round(content.length / 1024)}KB) — may slow context loading`);
      return warnings;
    }

    // Claude config
    const claude = {
      global: {
        claudeMd: checkFile(path.join(home, '.claude', 'CLAUDE.md'), validateMd),
        settings: checkFile(path.join(home, '.claude', 'settings.json'), validateJson),
      },
      project: null as { claudeMd: FileStatus; settings: FileStatus; privateMd: FileStatus } | null,
    };
    if (projectPath) {
      claude.project = {
        claudeMd: checkFile(path.join(projectPath, 'CLAUDE.md'), validateMd),
        settings: checkFile(path.join(projectPath, '.claude', 'settings.json'), validateJson),
        privateMd: checkFile(path.join(projectPath, '.claude', 'CLAUDE.md'), validateMd),
      };
    }

    // Gemini config
    const gemini = {
      global: {
        settings: checkFile(path.join(home, '.gemini', 'settings.json'), validateJson),
      },
      project: null as { geminiMd: FileStatus; settings: FileStatus } | null,
    };
    if (projectPath) {
      gemini.project = {
        geminiMd: checkFile(path.join(projectPath, 'GEMINI.md'), validateMd),
        settings: checkFile(path.join(projectPath, '.gemini', 'settings.json'), validateJson),
      };
    }

    // Codex config
    const codex = {
      global: {
        instructions: checkFile(path.join(home, '.codex', 'instructions.md'), validateMd),
      },
      project: null as { agentsMd: FileStatus; instructions: FileStatus } | null,
    };
    if (projectPath) {
      codex.project = {
        agentsMd: checkFile(path.join(projectPath, 'AGENTS.md'), validateMd),
        instructions: checkFile(path.join(projectPath, '.codex', 'instructions.md'), validateMd),
      };
    }

    // Legacy compat: return claude's structure at top level + new tool-specific sections
    return {
      global: claude.global,
      project: claude.project,
      claude,
      gemini,
      codex,
    };
  });
}

/** Re-read settings from disk (used by dev sync). */
function reload(): void {
  loadSettings();
}

export { init, setupIPC, loadSettings, saveSettings, updateSetting, getSetting, onSettingChange, reload };
