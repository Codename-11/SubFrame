/**
 * Application Menu Module
 * Defines menu structure and handlers
 * Supports dynamic menu based on active AI tool
 */

import { Menu, shell, app as _electronApp } from 'electron';
import type { BrowserWindow, App, MenuItemConstructorOptions } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { IPC } from '../shared/ipcChannels';

interface AIToolCommands {
  [key: string]: string;
}

interface AITool {
  id: string;
  name: string;
  command: string;
  commands: AIToolCommands;
  menuLabel: string;
  supportsPlugins: boolean;
}

interface AIToolManagerLike {
  getActiveTool(): AITool;
  getAvailableTools(): Record<string, AITool>;
  setActiveTool(toolId: string): boolean;
}

let mainWindow: BrowserWindow | null = null;
let appPath: string | null = null;
let aiToolManager: AIToolManagerLike | null = null;

/**
 * Initialize menu module
 */
function init(window: BrowserWindow, app: App, toolManager: AIToolManagerLike): void {
  mainWindow = window;
  appPath = app.getPath('userData');
  aiToolManager = toolManager;
}

/**
 * Send an IPC event to the renderer
 */
function sendToRenderer(channel: string, ...args: unknown[]): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, ...args);
  }
}

/**
 * Get menu template based on active AI tool
 */
function getMenuTemplate(): MenuItemConstructorOptions[] {
  const activeTool: AITool = aiToolManager ? aiToolManager.getActiveTool() : {
    id: 'claude',
    name: 'Claude Code',
    menuLabel: 'AI Commands',
    command: 'claude',
    commands: {},
    supportsPlugins: true
  };

  const aiCommandsSubmenu = buildAICommandsSubmenu(activeTool);

  const template: MenuItemConstructorOptions[] = [
    // ── File menu (standard editor convention) ──
    {
      label: 'File',
      submenu: [
        {
          label: 'New Terminal',
          accelerator: 'CmdOrCtrl+Shift+T',
          click: () => sendToRenderer(IPC.MENU_NEW_TERMINAL)
        },
        {
          label: 'Close Terminal',
          accelerator: 'CmdOrCtrl+Shift+W',
          click: () => sendToRenderer(IPC.MENU_CLOSE_TERMINAL)
        },
        { type: 'separator' },
        {
          label: 'Open Project...',
          click: () => sendToRenderer(IPC.PROJECT_SELECTED, '__open_dialog__')
        },
        { type: 'separator' },
        {
          label: 'Settings...',
          accelerator: 'CmdOrCtrl+,',
          click: () => sendToRenderer(IPC.MENU_OPEN_SETTINGS)
        },
        { type: 'separator' },
        process.platform === 'darwin'
          ? { role: 'close' as const }
          : { role: 'quit' as const }
      ]
    },
    // ── AI Commands menu ──
    {
      label: activeTool.menuLabel,
      submenu: aiCommandsSubmenu
    },
    // ── Edit menu ──
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
    // ── View menu ──
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Sidebar',
          accelerator: 'CmdOrCtrl+B',
          click: () => sendToRenderer(IPC.MENU_TOGGLE_SIDEBAR)
        },
        {
          label: 'Toggle Right Panel',
          click: () => sendToRenderer(IPC.MENU_TOGGLE_RIGHT_PANEL)
        },
        { type: 'separator' },
        {
          label: 'Reset Layout',
          click: () => sendToRenderer(IPC.MENU_RESET_LAYOUT)
        },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' }
      ]
    }
  ];

  // macOS app menu
  if (process.platform === 'darwin') {
    template.unshift({
      label: 'SubFrame',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });
  }

  return template;
}

/**
 * Build AI commands submenu based on active tool
 */
function buildAICommandsSubmenu(tool: AITool): MenuItemConstructorOptions[] {
  const submenu: MenuItemConstructorOptions[] = [];

  // Tool-specific commands
  if (tool.commands.init) {
    submenu.push({
      label: `Initialize Project (${tool.commands.init})`,
      accelerator: 'CmdOrCtrl+I',
      click: () => sendCommand(tool.commands.init)
    });
  }

  if (tool.commands.commit) {
    submenu.push({
      label: `Commit Changes (${tool.commands.commit})`,
      accelerator: 'CmdOrCtrl+Shift+C',
      click: () => sendCommand(tool.commands.commit)
    });
  }

  if (tool.commands.review) {
    submenu.push({
      label: `Review (${tool.commands.review})`,
      click: () => sendCommand(tool.commands.review)
    });
  }

  if (tool.commands.model) {
    submenu.push({
      label: `Switch Model (${tool.commands.model})`,
      click: () => sendCommand(tool.commands.model)
    });
  }

  if (tool.commands.permissions) {
    submenu.push({
      label: `Permissions (${tool.commands.permissions})`,
      click: () => sendCommand(tool.commands.permissions)
    });
  }

  if (tool.commands.memory) {
    submenu.push({
      label: `Memory (${tool.commands.memory})`,
      click: () => sendCommand(tool.commands.memory)
    });
  }

  if (tool.commands.compress) {
    submenu.push({
      label: `Compress Context (${tool.commands.compress})`,
      click: () => sendCommand(tool.commands.compress)
    });
  }

  if (tool.commands.settings) {
    submenu.push({
      label: `Settings (${tool.commands.settings})`,
      click: () => sendCommand(tool.commands.settings)
    });
  }

  if (tool.commands.help) {
    submenu.push({
      label: `Help (${tool.commands.help})`,
      click: () => sendCommand(tool.commands.help)
    });
  }

  submenu.push({ type: 'separator' });

  // Start command
  submenu.push({
    label: `Start ${tool.name}`,
    accelerator: 'CmdOrCtrl+K',
    click: () => sendCommand(tool.command)
  });

  submenu.push({ type: 'separator' });

  // History commands (universal)
  submenu.push({
    label: 'Toggle Prompt History Panel',
    accelerator: 'CmdOrCtrl+Shift+H',
    click: () => toggleHistoryPanel()
  });

  submenu.push({
    label: 'Open History File',
    accelerator: 'CmdOrCtrl+H',
    click: () => openHistoryFile()
  });

  // AI Tool switcher
  if (aiToolManager) {
    submenu.push({ type: 'separator' });
    submenu.push({
      label: 'Switch AI Tool...',
      submenu: buildToolSwitcherSubmenu()
    });
  }

  return submenu;
}

/**
 * Build tool switcher submenu
 */
function buildToolSwitcherSubmenu(): MenuItemConstructorOptions[] {
  if (!aiToolManager) return [];

  const tools = aiToolManager.getAvailableTools();
  const activeTool = aiToolManager.getActiveTool();

  return Object.values(tools).map(tool => ({
    label: tool.name,
    type: 'radio' as const,
    checked: tool.id === activeTool.id,
    click: () => {
      aiToolManager!.setActiveTool(tool.id);
      // Rebuild menu with new tool
      createMenu();
    }
  }));
}

/**
 * Send command to terminal
 */
function sendCommand(command: string): void {
  sendToRenderer(IPC.RUN_COMMAND, command);
}

/**
 * Toggle history panel
 */
function toggleHistoryPanel(): void {
  sendToRenderer(IPC.TOGGLE_HISTORY_PANEL);
}

/**
 * Open history file in default editor
 */
function openHistoryFile(): void {
  if (!appPath) return;
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
function createMenu(): Electron.Menu {
  const template = getMenuTemplate();
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  return menu;
}

export { init, createMenu, getMenuTemplate };
