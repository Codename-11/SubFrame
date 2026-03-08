/**
 * Main Process Entry Point
 * Initializes Electron app, creates window, loads modules
 */

import { app, BrowserWindow, ipcMain, screen } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { IPC } from '../shared/ipcChannels';

// Import modules
import * as pty from './pty';
import * as ptyManager from './ptyManager';
import * as menu from './menu';
import * as dialogs from './dialogs';
import * as fileTree from './fileTree';
import * as promptLogger from './promptLogger';
import * as workspace from './workspace';
import * as frameProject from './frameProject';
import * as fileEditor from './fileEditor';
import * as tasksManager from './tasksManager';
import * as pluginsManager from './pluginsManager';
import * as githubManager from './githubManager';
import * as claudeUsageManager from './claudeUsageManager';
import * as overviewManager from './overviewManager';
import * as gitBranchesManager from './gitBranchesManager';
import * as aiToolManager from './aiToolManager';
import * as claudeSessionsManager from './claudeSessionsManager';
import * as settingsManager from './settingsManager';
import * as aiFilesManager from './aiFilesManager';
import * as agentStateManager from './agentStateManager';
import * as skillsManager from './skillsManager';
import * as promptsManager from './promptsManager';
import * as onboardingManager from './onboardingManager';
import * as updaterManager from './updaterManager';
import * as pipelineManager from './pipelineManager';
import { getLogoSVG, LOGO_COLORS } from '../shared/logoSVG';

// ── Global error handlers — surface errors to terminal on crash/exit ──
process.on('uncaughtException', (err) => {
  console.error('[Main:uncaughtException]', err.stack || err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[Main:unhandledRejection]', reason);
});

interface WindowState {
  bounds: Electron.Rectangle;
  isMaximized: boolean;
}

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;

/**
 * Get path for persisted window state
 */
function getWindowStatePath(): string {
  return path.join(app.getPath('userData'), 'window-state.json');
}

/**
 * Load saved window state (bounds + maximized)
 */
function loadWindowState(): WindowState | null {
  try {
    const data = fs.readFileSync(getWindowStatePath(), 'utf8');
    return JSON.parse(data) as WindowState;
  } catch {
    return null;
  }
}

/**
 * Save current window state
 */
function saveWindowState(): void {
  if (!mainWindow) return;
  const isMaximized = mainWindow.isMaximized();
  // Save the normal (non-maximized) bounds so we can restore properly
  const bounds = isMaximized ? ((mainWindow as any)._normalBounds || mainWindow.getBounds()) : mainWindow.getBounds();
  try {
    fs.writeFileSync(getWindowStatePath(), JSON.stringify({ bounds, isMaximized }));
  } catch { /* ignore write errors */ }
}

/**
 * Create a lightweight splash window that appears instantly.
 */
function createSplash(bounds: Partial<Electron.Rectangle>, isMaximized?: boolean): void {
  const logoSVG = getLogoSVG({ size: 140, id: 'sp', frame: true });
  const splashHTML = `
    <html><head><style>
      html, body { margin: 0; height: 100%; background: #0f0f10; display: flex;
        align-items: center; justify-content: center; overflow: hidden; }
      .c { display: flex; flex-direction: column; align-items: center; gap: 24px; }
      .t { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 20px; font-weight: 600; color: #e8e6e3; letter-spacing: -0.3px; }
      .bar { width: 120px; height: 3px; background: rgba(255,255,255,0.06);
        border-radius: 2px; overflow: hidden; }
      .fill { height: 100%; width: 40%; border-radius: 2px;
        background: ${LOGO_COLORS.gradientCSS};
        animation: s 1.2s ease-in-out infinite; }
      @keyframes s { 0%{transform:translateX(-100%)} 100%{transform:translateX(400%)} }
    </style></head><body>
      <div class="c">
        ${logoSVG}
        <span class="t">SubFrame</span>
        <div class="bar"><div class="fill"></div></div>
      </div>
    </body></html>`;

  splashWindow = new BrowserWindow({
    width: bounds.width || 1000,
    height: bounds.height || 700,
    x: bounds.x,
    y: bounds.y,
    frame: false,
    transparent: false,
    backgroundColor: '#0f0f10',
    resizable: false,
    skipTaskbar: true,
    show: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });

  if (isMaximized) {
    splashWindow.maximize();
  }

  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHTML)}`);
}

/**
 * Create main application window
 */
function createWindow(): BrowserWindow {
  const saved = loadWindowState();
  const defaults = { width: 1000, height: 700 };
  const bounds: Partial<Electron.Rectangle> & { width: number; height: number } = saved?.bounds || defaults;

  // Validate bounds are on a visible display
  if (saved?.bounds) {
    const displays = screen.getAllDisplays();
    const visible = displays.some(d => {
      const b = d.bounds;
      return (bounds.x ?? 0) >= b.x && (bounds.y ?? 0) >= b.y &&
             (bounds.x ?? 0) < b.x + b.width && (bounds.y ?? 0) < b.y + b.height;
    });
    if (!visible) {
      bounds.x = undefined;
      bounds.y = undefined;
    }
  }

  // Show splash instantly while main window loads
  createSplash(bounds, saved?.isMaximized);

  mainWindow = new BrowserWindow({
    ...bounds,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      spellcheck: true
    },
    backgroundColor: '#0f0f10',
    title: 'SubFrame'
  });

  // When main window is ready, swap it in and close splash
  mainWindow.once('ready-to-show', () => {
    if (saved?.isMaximized) {
      mainWindow!.maximize();
    }
    mainWindow!.show();

    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }
  });

  // Initialize modules with window reference BEFORE loadFile()
  // so IPC handlers are registered before the renderer can invoke them
  pty.init(mainWindow);
  ptyManager.init(mainWindow);
  settingsManager.init(mainWindow, app);
  aiToolManager.init(mainWindow, app);
  menu.init(mainWindow, app, aiToolManager);
  dialogs.init(mainWindow, (projectPath: string) => {
    pty.setProjectPath(projectPath);
    workspace.addProject(projectPath);
    const result = workspace.getProjectsWithScanned();
    mainWindow!.webContents.send(IPC.WORKSPACE_UPDATED, result);
  });
  initModulesWithWindow(mainWindow);

  mainWindow.loadFile('index.html');

  // Bridge renderer console to main process terminal (errors + warnings only)
  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    // level: 0=verbose, 1=info, 2=warning, 3=error
    if (level >= 2) {
      const prefix = level === 3 ? '[Renderer:error]' : '[Renderer:warn]';
      const source = sourceId ? ` (${sourceId}:${line})` : '';
      console.error(`${prefix} ${message}${source}`);
    }
  });

  // Open DevTools only in development mode
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Dev auto-reload: watch renderer bundle + CSS and reload on change
  if (process.env.ELECTRON_DEV === '1') {
    const devWatchers: fs.FSWatcher[] = [];
    let reloadTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleReload = (label: string): void => {
      if (reloadTimer) clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          console.log(`[dev] ${label} changed — reloading renderer`);
          mainWindow.webContents.reloadIgnoringCache();
        }
      }, 300);
    };

    // Watch JS bundle
    const bundlePath = path.join(__dirname, '..', '..', 'dist', 'renderer.js');
    devWatchers.push(fs.watch(bundlePath, () => scheduleReload('Bundle')));

    // Watch CSS bundle (esbuild extracts Tailwind CSS to a separate file)
    const cssPath = path.join(__dirname, '..', '..', 'dist', 'renderer.css');
    try { devWatchers.push(fs.watch(cssPath, () => scheduleReload('CSS'))); } catch { /* CSS file may not exist yet */ }

    // Watch index.html
    const htmlPath = path.join(__dirname, '..', '..', 'index.html');
    devWatchers.push(fs.watch(htmlPath, () => scheduleReload('HTML')));

    mainWindow.on('closed', () => devWatchers.forEach(w => w.close()));
  }

  // Track normal bounds so we can save them even when maximized
  mainWindow.on('move', () => {
    if (!mainWindow!.isMaximized()) (mainWindow as any)._normalBounds = mainWindow!.getBounds();
  });
  mainWindow.on('resize', () => {
    if (!mainWindow!.isMaximized()) (mainWindow as any)._normalBounds = mainWindow!.getBounds();
  });

  // Save state before close
  mainWindow.on('close', () => {
    saveWindowState();
  });

  mainWindow.on('closed', () => {
    pty.killPTY();
    ptyManager.destroyAll();
    mainWindow = null;
  });

  // Create application menu
  menu.createMenu();

  return mainWindow;
}

/**
 * Setup all IPC handlers
 */
function setupAllIPC(): void {
  // Setup module IPC handlers
  pty.setupIPC(ipcMain);
  ptyManager.setupIPC(ipcMain);
  dialogs.setupIPC(ipcMain);
  fileTree.setupIPC(ipcMain);
  promptLogger.setupIPC(ipcMain);
  workspace.setupIPC(ipcMain);
  frameProject.setupIPC(ipcMain);
  fileEditor.setupIPC(ipcMain);
  tasksManager.setupIPC(ipcMain);
  pluginsManager.setupIPC(ipcMain);
  githubManager.setupIPC(ipcMain);
  claudeUsageManager.setupIPC(ipcMain);
  overviewManager.setupIPC(ipcMain);
  gitBranchesManager.setupIPC(ipcMain);
  claudeSessionsManager.setupIPC(ipcMain);
  aiFilesManager.setupIPC(ipcMain);
  agentStateManager.setupIPC(ipcMain);
  skillsManager.setupIPC(ipcMain);
  promptsManager.setupIPC(ipcMain);
  onboardingManager.setupIPC(ipcMain);
  pipelineManager.setupIPC(ipcMain);
  // Note: updaterManager.setupIPC() is called inside updaterManager.init()
  // because it needs app.isPackaged to be set first

  // What's New — read RELEASE_NOTES.md from app root
  ipcMain.handle(IPC.GET_RELEASE_NOTES, () => {
    const version: string = require('../../package.json').version;
    const notesPath = path.join(app.getAppPath(), 'RELEASE_NOTES.md');
    let content = '';
    try {
      content = fs.readFileSync(notesPath, 'utf8');
    } catch {
      content = `# SubFrame v${version}\n\nNo release notes available for this version.`;
    }
    return { version, content };
  });

  // Legacy single-terminal input handler
  ipcMain.on(IPC.TERMINAL_INPUT, (_event, data: string) => {
    pty.writeToPTY(data);
    promptLogger.logInput('legacy', data);
  });
}

/**
 * Initialize application
 */
function init(): void {
  // Initialize prompt logger with app paths
  promptLogger.init(app);

  // Setup IPC handlers
  setupAllIPC();
}

/**
 * Initialize modules that need window reference
 */
function initModulesWithWindow(window: BrowserWindow): void {
  workspace.init(app, window, settingsManager);
  frameProject.init(window);
  fileEditor.init(window);
  tasksManager.init(window);
  pluginsManager.init(window);
  githubManager.init(window);
  claudeUsageManager.init(window);
  overviewManager.init(window);
  gitBranchesManager.init(window);
  claudeSessionsManager.init(window);
  aiFilesManager.init(window);
  agentStateManager.init(window);
  onboardingManager.init(window);
  pipelineManager.init(window);
  updaterManager.init(window, app);
}

// App lifecycle
app.whenReady().then(() => {
  app.setName('SubFrame');

  init();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

export { createWindow };
