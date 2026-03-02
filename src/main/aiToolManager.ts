/**
 * AI Tool Manager
 * Manages switching between different AI coding tools (Claude Code, Codex CLI, etc.)
 */

import { ipcMain, type App, type BrowserWindow } from 'electron';
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
    supportsPlugins: true
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
    supportsPlugins: false
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
    supportsPlugins: false
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

/**
 * Get all available AI tools
 */
function getAvailableTools(): Record<string, AITool> {
  return { ...AI_TOOLS, ...config.customTools };
}

/**
 * Get the currently active tool
 */
function getActiveTool(): AITool {
  const tools = getAvailableTools();
  return tools[config.activeTool] || tools.claude;
}

/**
 * Set the active AI tool
 */
function setActiveTool(toolId: string): boolean {
  const tools = getAvailableTools();
  if (tools[toolId]) {
    config.activeTool = toolId;
    saveConfig();

    // Notify renderer about the change
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC.AI_TOOL_CHANGED, getActiveTool());
    }

    return true;
  }
  return false;
}

/**
 * Get full configuration for renderer
 */
function getConfig(): AIToolConfigResponse {
  return {
    activeTool: getActiveTool(),
    availableTools: getAvailableTools()
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
  ipcMain.handle(IPC.GET_AI_TOOL_CONFIG, () => {
    return getConfig();
  });

  ipcMain.handle(IPC.SET_AI_TOOL, (_event, toolId: string) => {
    return setActiveTool(toolId);
  });

  ipcMain.handle(IPC.ADD_CUSTOM_AI_TOOL, (_event, tool: { id: string; name: string; command: string; description?: string }) => {
    const result = addCustomTool(tool);
    if (result && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC.AI_TOOL_CHANGED, getActiveTool());
    }
    return result;
  });

  ipcMain.handle(IPC.REMOVE_CUSTOM_AI_TOOL, (_event, toolId: string) => {
    const result = removeCustomTool(toolId);
    if (result && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC.AI_TOOL_CHANGED, getActiveTool());
    }
    return result;
  });
}

/**
 * Get command for specific action
 */
function getCommand(action: string): string | null {
  const tool = getActiveTool();
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
function getStartCommand(): string {
  const tool = getActiveTool();
  const custom = getCustomCommand(tool.id);
  return custom || tool.command;
}

export {
  init, getAvailableTools, getActiveTool, setActiveTool,
  getConfig, getCommand, getStartCommand,
  addCustomTool, removeCustomTool, AI_TOOLS
};
