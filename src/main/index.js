/**
 * Main Process Entry Point
 * Initializes Electron app, creates window, loads modules
 */

const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { IPC } = require('../shared/ipcChannels');

// Import modules
const pty = require('./pty');
const ptyManager = require('./ptyManager');
const menu = require('./menu');
const dialogs = require('./dialogs');
const fileTree = require('./fileTree');
const promptLogger = require('./promptLogger');
const workspace = require('./workspace');
const frameProject = require('./frameProject');
const fileEditor = require('./fileEditor');
const tasksManager = require('./tasksManager');
const pluginsManager = require('./pluginsManager');
const githubManager = require('./githubManager');
const claudeUsageManager = require('./claudeUsageManager');
const overviewManager = require('./overviewManager');
const gitBranchesManager = require('./gitBranchesManager');
const aiToolManager = require('./aiToolManager');
const claudeSessionsManager = require('./claudeSessionsManager');
const settingsManager = require('./settingsManager');
const aiFilesManager = require('./aiFilesManager');
const { getLogoSVG, LOGO_COLORS } = require('../shared/logoSVG');

let mainWindow = null;
let splashWindow = null;

/**
 * Get path for persisted window state
 */
function getWindowStatePath() {
  return path.join(app.getPath('userData'), 'window-state.json');
}

/**
 * Load saved window state (bounds + maximized)
 */
function loadWindowState() {
  try {
    const data = fs.readFileSync(getWindowStatePath(), 'utf8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Save current window state
 */
function saveWindowState() {
  if (!mainWindow) return;
  const isMaximized = mainWindow.isMaximized();
  // Save the normal (non-maximized) bounds so we can restore properly
  const bounds = isMaximized ? (mainWindow._normalBounds || mainWindow.getBounds()) : mainWindow.getBounds();
  try {
    fs.writeFileSync(getWindowStatePath(), JSON.stringify({ bounds, isMaximized }));
  } catch {}
}

/**
 * Create a lightweight splash window that appears instantly.
 * Uses a data URL with inline HTML/CSS — no file I/O, no network, no blocking.
 */
function createSplash(bounds, isMaximized) {
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
function createWindow() {
  const saved = loadWindowState();
  const defaults = { width: 1000, height: 700 };
  const bounds = saved?.bounds || defaults;

  // Validate bounds are on a visible display
  if (saved?.bounds) {
    const displays = screen.getAllDisplays();
    const visible = displays.some(d => {
      const b = d.bounds;
      return bounds.x >= b.x && bounds.y >= b.y &&
             bounds.x < b.x + b.width && bounds.y < b.y + b.height;
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
      contextIsolation: false
    },
    backgroundColor: '#0f0f10',
    title: 'SubFrame'
  });

  // When main window is ready, swap it in and close splash
  mainWindow.once('ready-to-show', () => {
    if (saved?.isMaximized) {
      mainWindow.maximize();
    }
    mainWindow.show();

    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }
  });

  mainWindow.loadFile('index.html');

  // Open DevTools only in development mode
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Track normal bounds so we can save them even when maximized
  mainWindow.on('move', () => {
    if (!mainWindow.isMaximized()) mainWindow._normalBounds = mainWindow.getBounds();
  });
  mainWindow.on('resize', () => {
    if (!mainWindow.isMaximized()) mainWindow._normalBounds = mainWindow.getBounds();
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

  // Initialize modules with window reference
  pty.init(mainWindow);
  ptyManager.init(mainWindow);
  settingsManager.init(mainWindow, app);
  aiToolManager.init(mainWindow, app);
  menu.init(mainWindow, app, aiToolManager);
  dialogs.init(mainWindow, (projectPath) => {
    pty.setProjectPath(projectPath);
  });
  initModulesWithWindow(mainWindow);

  // Create application menu
  menu.createMenu();

  return mainWindow;
}

/**
 * Setup all IPC handlers
 */
function setupAllIPC() {
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

  // Terminal input handler (needs prompt logger integration)
  ipcMain.on(IPC.TERMINAL_INPUT, (event, data) => {
    pty.writeToPTY(data);
    promptLogger.logInput(data);
  });
}

/**
 * Initialize application
 */
function init() {
  // Initialize prompt logger with app paths
  promptLogger.init(app);

  // Setup IPC handlers
  setupAllIPC();
}

/**
 * Initialize modules that need window reference
 */
function initModulesWithWindow(window) {
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
}

// App lifecycle
app.whenReady().then(() => {
  // macOS'ta menü bar'da "SubFrame" görünsün
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

module.exports = { createWindow };
