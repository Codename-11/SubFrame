/**
 * Application Menu Module
 * Defines menu structure and handlers
 * Supports dynamic menu based on active AI tool
 */

import { Menu, shell, dialog, app as _electronApp } from 'electron';
import type { BrowserWindow, App, MenuItemConstructorOptions } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { IPC } from '../shared/ipcChannels';
import { IS_DEV_MODE, WORKSPACE_DIR, WORKSPACE_DIR_PROD, WORKSPACE_FILE } from '../shared/frameConstants';
import { checkForUpdates } from './updaterManager';
import { broadcast } from './eventBridge';
import { showOpenFileDialog } from './dialogs';

const REPO_URL = 'https://github.com/Codename-11/SubFrame';
const DOCS_URL = 'https://codename-11.github.io/SubFrame';

import type { AITool } from '../shared/ipcChannels';

interface AIToolManagerLike {
  getActiveTool(): Promise<AITool>;
  getAvailableTools(): Promise<Record<string, AITool>>;
  setActiveTool(toolId: string): Promise<boolean>;
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
    broadcast(channel, args[0]);
  }
}

/**
 * Get menu template based on active AI tool
 */
async function getMenuTemplate(): Promise<MenuItemConstructorOptions[]> {
  const activeTool: AITool = aiToolManager ? await aiToolManager.getActiveTool() : {
    id: 'claude',
    name: 'Claude Code',
    menuLabel: 'AI Commands',
    command: 'claude',
    description: 'Anthropic Claude Code CLI',
    commands: {},
    supportsPlugins: true,
    features: {
      hooks: true, preToolUse: true, postToolUse: true, notification: true,
      stop: true, sessionStart: true, sessionEnd: true, userPromptSubmit: true,
      streamingOutput: true, plugins: true, agentHooks: true, promptHooks: true,
      httpHooks: true, pluginHooks: false, hookMaturity: 'mature' as const,
    },
  };

  const aiCommandsSubmenu = await buildAICommandsSubmenu(activeTool);

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
          label: 'Open File...',
          accelerator: 'CmdOrCtrl+O',
          click: () => showOpenFileDialog()
        },
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
    // ── AI Commands menu (tool-agnostic label, tool-specific contents) ──
    {
      label: 'AI Commands',
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
        { role: 'paste' },
        { type: 'separator' },
        { role: 'selectAll' }
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
    },
    // ── Help menu ──
    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          click: () => shell.openExternal(DOCS_URL)
        },
        {
          label: 'Report Issue...',
          click: () => shell.openExternal(`${REPO_URL}/issues/new`)
        },
        {
          label: 'View on GitHub',
          click: () => shell.openExternal(REPO_URL)
        },
        { type: 'separator' },
        {
          label: 'Check for Updates...',
          click: () => checkForUpdates()
        },
        ...(process.platform !== 'darwin' ? [
          { type: 'separator' as const },
          { role: 'about' as const }
        ] : [])
      ]
    },
    // ── Dev menu (only in dev mode) ──
    ...(IS_DEV_MODE ? [{
      label: 'Dev',
      submenu: [
        {
          label: 'Sync from Production Data',
          accelerator: 'CmdOrCtrl+Shift+F5',
          click: async () => {
            if (!mainWindow || mainWindow.isDestroyed()) return;
            const { response } = await dialog.showMessageBox(mainWindow, {
              type: 'question',
              buttons: ['Sync', 'Cancel'],
              defaultId: 0,
              title: 'Sync Dev Data',
              message: 'Copy settings, workspaces, and AI config from the installed (production) app into this dev instance?',
              detail: 'This will overwrite your current dev settings. The app will reload afterwards.',
            });
            if (response !== 0) return;
            try {
              const copied: string[] = [];
              // Sync userData files
              const devUserData = _electronApp.getPath('userData');
              const prodUserData = devUserData.replace(/-dev$/, '');
              for (const file of ['frame-settings.json', 'ai-tool-config.json', 'window-state.json', 'popout-state.json']) {
                const src = path.join(prodUserData, file);
                const dest = path.join(devUserData, file);
                if (fs.existsSync(src)) { fs.copyFileSync(src, dest); copied.push(file); }
              }
              // Sync workspace file
              const home = os.homedir();
              const prodWs = path.join(home, WORKSPACE_DIR_PROD, WORKSPACE_FILE);
              const devWsDir = path.join(home, WORKSPACE_DIR);
              if (!fs.existsSync(devWsDir)) fs.mkdirSync(devWsDir, { recursive: true });
              if (fs.existsSync(prodWs)) {
                fs.copyFileSync(prodWs, path.join(devWsDir, WORKSPACE_FILE));
                copied.push('workspaces.json');
              }
              console.log(`[dev] Synced ${copied.length} files from production: ${copied.join(', ')}`);
              mainWindow?.webContents.reloadIgnoringCache();
            } catch (err) {
              dialog.showErrorBox('Sync Failed', (err as Error).message);
            }
          }
        },
        { type: 'separator' as const },
        {
          label: 'Open Dev userData Folder',
          click: () => shell.openPath(_electronApp.getPath('userData'))
        },
        {
          label: 'Open Production userData Folder',
          click: () => {
            const devPath = _electronApp.getPath('userData');
            const prodPath = devPath.replace(/-dev$/, '');
            shell.openPath(prodPath);
          }
        },
      ] as MenuItemConstructorOptions[]
    }] as MenuItemConstructorOptions[] : [])
  ];

  // macOS app menu
  if (process.platform === 'darwin') {
    template.unshift({
      label: 'SubFrame',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Check for Updates...',
          click: () => checkForUpdates()
        },
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

  // macOS Window menu (standard convention)
  if (process.platform === 'darwin') {
    // Insert before Help (last item)
    template.splice(template.length - 1, 0, {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' }
      ]
    });
  }

  return template;
}

/**
 * Build AI commands submenu based on active tool
 */
async function buildAICommandsSubmenu(tool: AITool): Promise<MenuItemConstructorOptions[]> {
  const submenu: MenuItemConstructorOptions[] = [];

  // Active tool indicator
  submenu.push({
    label: `Active: ${tool.name}`,
    enabled: false
  });
  submenu.push({ type: 'separator' });

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
    enabled: tool.installed !== false,
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
      submenu: await buildToolSwitcherSubmenu()
    });
  }

  return submenu;
}

/**
 * Build tool switcher submenu
 */
async function buildToolSwitcherSubmenu(): Promise<MenuItemConstructorOptions[]> {
  if (!aiToolManager) return [];

  const tools = await aiToolManager.getAvailableTools();
  const activeTool = await aiToolManager.getActiveTool();

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
async function createMenu(): Promise<Electron.Menu> {
  const template = await getMenuTemplate();
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  return menu;
}

export { init, createMenu, getMenuTemplate };
