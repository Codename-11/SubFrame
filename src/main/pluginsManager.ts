/**
 * Plugins Manager Module
 * Handles Claude Code plugins - reading marketplace, installed, and enabled status
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import type { BrowserWindow, IpcMain } from 'electron';
import { IPC } from '../shared/ipcChannels';
import { broadcast } from './eventBridge';
import { log as outputLog } from './outputChannelManager';

interface PluginConfig {
  name?: string;
  description?: string;
  author?: { name?: string };
}

interface PluginInfo {
  id: string;
  name: string;
  description: string;
  author: string;
  path: string;
  installed?: boolean;
  enabled?: boolean;
  installedAt?: string | null;
}

interface ToggleResult {
  success: boolean;
  pluginId: string;
  enabled: boolean;
}

interface RefreshResult {
  success: boolean;
  error?: string;
}

let mainWindow: BrowserWindow | null = null;

// Claude Code paths
const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const PLUGINS_DIR = path.join(CLAUDE_DIR, 'plugins');
const SETTINGS_FILE = path.join(CLAUDE_DIR, 'settings.json');
const INSTALLED_PLUGINS_FILE = path.join(PLUGINS_DIR, 'installed_plugins.json');
const MARKETPLACES_DIR = path.join(PLUGINS_DIR, 'marketplaces');

/**
 * Initialize plugins manager
 */
function init(window: BrowserWindow): void {
  mainWindow = window;
}

/**
 * Read JSON file safely
 */
function readJsonFile(filePath: string): Record<string, unknown> | null {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
  }
  return null;
}

/**
 * Write JSON file safely
 */
function writeJsonFile(filePath: string, data: Record<string, unknown>): boolean {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err);
    return false;
  }
}

/**
 * Get enabled plugins from settings
 */
function getEnabledPlugins(): Record<string, boolean> {
  const settings = readJsonFile(SETTINGS_FILE);
  return (settings?.enabledPlugins as Record<string, boolean>) || {};
}

/**
 * Get installed plugins
 */
function getInstalledPlugins(): Record<string, unknown[]> {
  const data = readJsonFile(INSTALLED_PLUGINS_FILE);
  return (data?.plugins as Record<string, unknown[]>) || {};
}

/**
 * Get all available plugins from marketplace
 */
function getMarketplacePlugins(): PluginInfo[] {
  const plugins: PluginInfo[] = [];
  const officialMarketplace = path.join(MARKETPLACES_DIR, 'claude-plugins-official', 'plugins');

  if (!fs.existsSync(officialMarketplace)) {
    // Try to initialize it
    ensureOfficialMarketplace();

    // Check again
    if (!fs.existsSync(officialMarketplace)) {
      return plugins;
    }
  }

  try {
    const pluginDirs = fs.readdirSync(officialMarketplace);

    for (const pluginName of pluginDirs) {
      const pluginPath = path.join(officialMarketplace, pluginName);
      const configPath = path.join(pluginPath, '.claude-plugin', 'plugin.json');

      if (fs.existsSync(configPath)) {
        const config = readJsonFile(configPath) as unknown as PluginConfig | null;
        if (config) {
          plugins.push({
            id: `${pluginName}@claude-plugins-official`,
            name: config.name || pluginName,
            description: config.description || '',
            author: config.author?.name || 'Unknown',
            path: pluginPath
          });
        }
      }
    }
  } catch (err) {
    console.error('Error reading marketplace plugins:', err);
  }

  return plugins;
}

/**
 * Get all plugins with their status
 */
function getAllPlugins(): PluginInfo[] {
  const marketplacePlugins = getMarketplacePlugins();
  const installedPlugins = getInstalledPlugins();
  const enabledPlugins = getEnabledPlugins();

  return marketplacePlugins.map(plugin => {
    const isInstalled = !!installedPlugins[plugin.id];
    const isEnabled = enabledPlugins[plugin.id] === true;
    const installInfo = installedPlugins[plugin.id]?.[0] as { installedAt?: string } | undefined;

    return {
      ...plugin,
      installed: isInstalled,
      enabled: isEnabled,
      installedAt: installInfo?.installedAt || null
    };
  });
}

/**
 * Toggle plugin enabled/disabled status
 */
function togglePlugin(pluginId: string): ToggleResult {
  const settings = readJsonFile(SETTINGS_FILE) || {};

  if (!settings.enabledPlugins) {
    settings.enabledPlugins = {};
  }

  // Toggle the status
  const enabledPlugins = settings.enabledPlugins as Record<string, boolean>;
  const currentStatus = enabledPlugins[pluginId] === true;
  enabledPlugins[pluginId] = !currentStatus;

  const success = writeJsonFile(SETTINGS_FILE, settings);
  outputLog('extensions', `Plugin ${pluginId} ${!currentStatus ? 'enabled' : 'disabled'}${success ? '' : ' (save failed)'}`);

  return {
    success,
    pluginId,
    enabled: !currentStatus
  };
}

/**
 * Ensure official marketplace exists
 */
function ensureOfficialMarketplace(): boolean {
  const officialMarketplace = path.join(MARKETPLACES_DIR, 'claude-plugins-official');

  if (fs.existsSync(officialMarketplace)) {
    return true;
  }

  try {
    // Create marketplaces dir if it doesn't exist
    if (!fs.existsSync(MARKETPLACES_DIR)) {
      fs.mkdirSync(MARKETPLACES_DIR, { recursive: true });
    }

    outputLog('extensions', 'Cloning official plugins repository...');
    execSync('git clone https://github.com/anthropics/claude-plugins-official.git', {
      cwd: MARKETPLACES_DIR,
      stdio: 'pipe',
      timeout: 60000
    });
    outputLog('extensions', 'Official marketplace cloned successfully');
    return true;
  } catch (err) {
    console.error('Error cloning official marketplace:', err);
    outputLog('extensions', `Failed to clone marketplace: ${(err as Error).message}`);
    return false;
  }
}

/**
 * Refresh marketplace plugins (git pull or clone)
 */
function refreshMarketplace(): RefreshResult {
  const officialMarketplace = path.join(MARKETPLACES_DIR, 'claude-plugins-official');

  // If not exists, try to clone
  if (!fs.existsSync(officialMarketplace)) {
    const success = ensureOfficialMarketplace();
    if (!success) {
      return { success: false, error: 'Failed to clone marketplace' };
    }
    return { success: true };
  }

  try {
    outputLog('extensions', 'Refreshing marketplace plugins...');
    execSync('git pull', {
      cwd: officialMarketplace,
      stdio: 'pipe',
      timeout: 30000
    });
    outputLog('extensions', 'Marketplace refreshed successfully');
    return { success: true };
  } catch (err) {
    console.error('Error refreshing marketplace:', err);
    outputLog('extensions', `Failed to refresh marketplace: ${(err as Error).message}`);
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Setup IPC handlers
 */
function setupIPC(ipcMain: IpcMain): void {
  // Load all plugins
  ipcMain.handle(IPC.LOAD_PLUGINS, async () => {
    return getAllPlugins();
  });

  // Toggle plugin
  ipcMain.handle(IPC.TOGGLE_PLUGIN, async (_event, pluginId: string) => {
    const result = togglePlugin(pluginId);

    // Notify renderer of the change
    broadcast(IPC.PLUGIN_TOGGLED, result);

    return result;
  });

  // Refresh plugins marketplace
  ipcMain.handle(IPC.REFRESH_PLUGINS, async () => {
    const result = refreshMarketplace();
    if (result.success) {
      return getAllPlugins();
    }
    return { error: result.error };
  });
}

export { init, setupIPC, getAllPlugins, togglePlugin };
