/**
 * AI Tool Manager
 * Manages switching between different AI coding tools (Claude Code, Codex CLI, etc.)
 */

import { ipcMain, type App, type BrowserWindow } from 'electron';
import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { IPC } from '../shared/ipcChannels';

interface AIToolCommands {
  [key: string]: string;
}

interface AITool {
  id: string;
  name: string;
  command: string;
  fallbackCommand?: string;
  description: string;
  commands: AIToolCommands;
  menuLabel: string;
  supportsPlugins: boolean;
  installUrl?: string;
  installed?: boolean;
}

interface AIToolConfig {
  activeTool: string;
  customTools: Record<string, AITool>;
}

interface AIToolConfigResponse {
  activeTool: AITool;
  availableTools: Record<string, AITool>;
}

let mainWindow: BrowserWindow | null = null;
let configPath: string | null = null;
let onToolChanged: (() => void) | null = null;

// Default AI tools configuration
const AI_TOOLS: Record<string, AITool> = {
  claude: {
    id: 'claude',
    name: 'Claude Code',
    command: 'claude',
    description: 'Anthropic Claude Code CLI',
    commands: {
      init: '/init',
      commit: '/commit',
      review: '/review-pr',
      help: '/help'
    },
    menuLabel: 'Claude Commands',
    supportsPlugins: true,
    installUrl: 'https://docs.anthropic.com/en/docs/claude-code/overview'
  },
  codex: {
    id: 'codex',
    name: 'Codex CLI',
    command: './.subframe/bin/codex',
    fallbackCommand: 'codex',
    description: 'OpenAI Codex CLI (with AGENTS.md injection)',
    commands: {
      review: '/review',
      model: '/model',
      permissions: '/permissions',
      help: '/help'
    },
    menuLabel: 'Codex Commands',
    supportsPlugins: false,
    installUrl: 'https://github.com/openai/codex'
  },
  gemini: {
    id: 'gemini',
    name: 'Gemini CLI',
    command: 'gemini',
    description: 'Google Gemini CLI (reads GEMINI.md natively)',
    commands: {
      init: '/init',
      model: '/model',
      memory: '/memory',
      compress: '/compress',
      settings: '/settings',
      help: '/help'
    },
    menuLabel: 'Gemini Commands',
    supportsPlugins: false,
    installUrl: 'https://github.com/google-gemini/gemini-cli'
  }
};

// Current configuration
let config: AIToolConfig = {
  activeTool: 'claude',
  customTools: {}
};

/**
 * Initialize the AI Tool Manager
 */
function init(window: BrowserWindow, app: App): void {
  mainWindow = window;
  configPath = path.join(app.getPath('userData'), 'ai-tool-config.json');
  loadConfig();
  setupIPC();
}

/**
 * Load configuration from file
 */
function loadConfig(): void {
  try {
    if (configPath && fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      const loaded = JSON.parse(data);
      config = { ...config, ...loaded };
    }
  } catch (error) {
    console.error('Error loading AI tool config:', error);
  }
}

/**
 * Save configuration to file
 */
function saveConfig(): void {
  try {
    if (configPath) {
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    }
  } catch (error) {
    console.error('Error saving AI tool config:', error);
  }
}

// Cache for install status (avoids repeated `where`/`which` calls)
const installCache = new Map<string, { installed: boolean; checkedAt: number }>();
const CACHE_TTL_MS = 60_000; // 1 minute

/**
 * Check if a command is available on PATH.
 * Uses `where.exe` on Windows, `which` on Unix.
 * Results are cached for 1 minute.
 * Uses async execFile (no shell) to avoid blocking the main thread.
 */
async function isCommandInstalledAsync(command: string): Promise<boolean> {
  // Relative paths (e.g. ./.subframe/bin/codex) — check the fallback command instead
  const checkCmd = command.startsWith('.') ? undefined : command;
  if (!checkCmd) return true; // relative paths are project-local, skip check

  const cached = installCache.get(checkCmd);
  if (cached && Date.now() - cached.checkedAt < CACHE_TTL_MS) {
    return cached.installed;
  }

  let installed = false;
  try {
    const whichCmd = process.platform === 'win32' ? 'where.exe' : 'which';
    await new Promise<void>((resolve, reject) => {
      execFile(whichCmd, [checkCmd], { timeout: 3000 }, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
    installed = true;
  } catch {
    installed = false;
  }

  installCache.set(checkCmd, { installed, checkedAt: Date.now() });
  return installed;
}

/**
 * Check install status for a single tool (considers fallbackCommand)
 */
async function checkToolInstalled(tool: AITool): Promise<boolean> {
  if (await isCommandInstalledAsync(tool.command)) return true;
  if (tool.fallbackCommand && await isCommandInstalledAsync(tool.fallbackCommand)) return true;
  return false;
}

/**
 * Get all available AI tools (with install status)
 */
async function getAvailableTools(): Promise<Record<string, AITool>> {
  const merged = { ...AI_TOOLS, ...config.customTools };
  const entries = Object.entries(merged);
  const installResults = await Promise.all(
    entries.map(([, tool]) => checkToolInstalled(tool))
  );
  const tools: Record<string, AITool> = {};
  for (let i = 0; i < entries.length; i++) {
    const [id, tool] = entries[i];
    tools[id] = { ...tool, installed: installResults[i] };
  }
  return tools;
}

/**
 * Get the currently active tool
 */
async function getActiveTool(): Promise<AITool> {
  const tools = await getAvailableTools();
  return tools[config.activeTool] || tools.claude;
}

/**
 * Set the active AI tool
 */
async function setActiveTool(toolId: string): Promise<boolean> {
  const tools = await getAvailableTools();
  if (tools[toolId]) {
    config.activeTool = toolId;
    saveConfig();

    // Notify renderer about the change
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC.AI_TOOL_CHANGED, await getActiveTool());
    }

    // Notify main-process listeners (e.g. menu rebuild)
    onToolChanged?.();

    return true;
  }
  return false;
}

/**
 * Register a callback that fires when the active tool changes.
 * Used by index.ts to rebuild the application menu.
 */
function onActiveToolChanged(callback: () => void): void {
  onToolChanged = callback;
}

/**
 * Get full configuration for renderer
 */
async function getConfig(): Promise<AIToolConfigResponse> {
  return {
    activeTool: await getActiveTool(),
    availableTools: await getAvailableTools()
  };
}

/**
 * Add a custom AI tool
 */
function addCustomTool(tool: Partial<AITool> & { id: string; name: string; command: string }): boolean {
  if (tool.id && tool.name && tool.command) {
    config.customTools[tool.id] = {
      ...tool,
      description: tool.description || '',
      commands: tool.commands || {},
      menuLabel: tool.menuLabel || `${tool.name} Commands`,
      supportsPlugins: tool.supportsPlugins || false
    };
    saveConfig();
    return true;
  }
  return false;
}

/**
 * Remove a custom AI tool
 */
function removeCustomTool(toolId: string): boolean {
  if (config.customTools[toolId]) {
    delete config.customTools[toolId];
    if (config.activeTool === toolId) {
      config.activeTool = 'claude';
    }
    saveConfig();
    return true;
  }
  return false;
}

/**
 * Setup IPC handlers
 */
function setupIPC(): void {
  ipcMain.handle(IPC.GET_AI_TOOL_CONFIG, async () => {
    return getConfig();
  });

  ipcMain.handle(IPC.SET_AI_TOOL, async (_event, toolId: string) => {
    return setActiveTool(toolId);
  });

  ipcMain.handle(IPC.ADD_CUSTOM_AI_TOOL, async (_event, tool: { id: string; name: string; command: string; description?: string }) => {
    const result = addCustomTool(tool);
    if (result && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC.AI_TOOL_CHANGED, await getActiveTool());
    }
    return result;
  });

  ipcMain.handle(IPC.REMOVE_CUSTOM_AI_TOOL, async (_event, toolId: string) => {
    const result = removeCustomTool(toolId);
    if (result && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC.AI_TOOL_CHANGED, await getActiveTool());
    }
    return result;
  });

  ipcMain.handle(IPC.RECHECK_AI_TOOLS, async () => {
    installCache.clear();
    return getConfig();
  });
}

/**
 * Get command for specific action
 */
async function getCommand(action: string): Promise<string | null> {
  const tool = await getActiveTool();
  return tool.commands[action] || null;
}

/**
 * Get custom command override from settings for a tool
 */
function getCustomCommand(toolId: string): string | null {
  try {
    // Dynamic require to avoid circular dependency at module load time
    const settingsManager = require('./settingsManager');
    const custom = settingsManager.getSetting(`aiTools.${toolId}.customCommand`);
    return (custom as string) || null;
  } catch (_err) {
    return null;
  }
}

/**
 * Get the start command for active tool
 */
async function getStartCommand(): Promise<string> {
  const tool = await getActiveTool();
  const custom = getCustomCommand(tool.id);
  return custom || tool.command;
}

export {
  init, getAvailableTools, getActiveTool, setActiveTool,
  getConfig, getCommand, getStartCommand, checkToolInstalled,
  addCustomTool, removeCustomTool, onActiveToolChanged, AI_TOOLS
};
