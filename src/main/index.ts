/**
 * Main Process Entry Point
 * Initializes Electron app, creates window, loads modules
 */

import { app, BrowserWindow, dialog, ipcMain, screen } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
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
import * as activityManager from './activityManager';
import * as popoutManager from './popoutManager';
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

// ── CLI argument handling ──────────────────────────────────────────────────

/**
 * Parse and handle CLI arguments.
 * Supports:
 *   subframe edit <file>    — open file in editor
 *   subframe open <dir>     — open directory as project
 *   subframe <path>         — auto-detect file or directory
 *   subframe .              — open current directory as project
 */
function handleCLIArgs(argv: string[]): void {
  // Skip electron binary + main script path (in dev) or just the binary (when packaged)
  const args = argv.slice(app.isPackaged ? 1 : 2);
  if (args.length === 0) return;

  const command = args[0];

  if (command === 'edit' && args[1]) {
    // Explicit file open
    const filePath = path.resolve(args[1]);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      sendCLIOpenFile(filePath);
    }
  } else if (command === 'open' && args[1]) {
    // Explicit directory open
    const dirPath = path.resolve(args[1]);
    if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
      sendCLIOpenProject(dirPath);
    }
  } else {
    // Bare path — auto-detect file or directory
    const target = path.resolve(command);
    try {
      const stat = fs.statSync(target);
      if (stat.isDirectory()) {
        sendCLIOpenProject(target);
      } else if (stat.isFile()) {
        sendCLIOpenFile(target);
      }
    } catch {
      // Path doesn't exist — ignore silently
    }
  }
}

function sendCLIOpenFile(filePath: string): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(IPC.CLI_OPEN_FILE, filePath);
    mainWindow.focus();
  }
}

function sendCLIOpenProject(dirPath: string): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    // Add to workspace so it appears in the project list
    workspace.addProject(dirPath);
    const result = workspace.getProjectsWithScanned();
    mainWindow.webContents.send(IPC.WORKSPACE_UPDATED, result);
    mainWindow.webContents.send(IPC.CLI_OPEN_PROJECT, dirPath);
    mainWindow.focus();
  }
}

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
      .st { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 11px; color: #a8a29e; letter-spacing: 0.2px; }
    </style></head><body>
      <div class="c">
        ${logoSVG}
        <span class="t">SubFrame</span>
        <div class="bar"><div class="fill"></div></div>
        <span class="st">Loading workspace...</span>
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

    const safeWatch = (filePath: string, label: string) => {
      try {
        const w = fs.watch(filePath, () => scheduleReload(label));
        w.on('error', () => { /* watched file may be deleted/rebuilt */ });
        devWatchers.push(w);
      } catch { /* file may not exist yet */ }
    };

    // Watch JS bundle
    safeWatch(path.join(__dirname, '..', '..', 'dist', 'renderer.js'), 'Bundle');

    // Watch CSS bundle (esbuild extracts Tailwind CSS to a separate file)
    safeWatch(path.join(__dirname, '..', '..', 'dist', 'renderer.css'), 'CSS');

    // Watch index.html
    safeWatch(path.join(__dirname, '..', '..', 'index.html'), 'HTML');

    mainWindow.on('closed', () => devWatchers.forEach(w => w.close()));
  }

  // Track normal bounds so we can save them even when maximized
  mainWindow.on('move', () => {
    if (!mainWindow!.isMaximized()) (mainWindow as any)._normalBounds = mainWindow!.getBounds();
  });
  mainWindow.on('resize', () => {
    if (!mainWindow!.isMaximized()) (mainWindow as any)._normalBounds = mainWindow!.getBounds();
  });

  // Save state before close — with active-work protection
  mainWindow.on('close', (event) => {
    saveWindowState();

    // Detect active work across all subsystems
    const activeAgentTerminals = ptyManager.getTerminalIds().filter(id => ptyManager.isClaudeActive(id));
    const pipelineRunning = pipelineManager.hasActiveRuns();
    const analysisRunning = onboardingManager.hasActiveAnalyses();
    const hasActiveWork = activeAgentTerminals.length > 0 || pipelineRunning || analysisRunning || activityManager.hasActiveStreams();

    const confirmBeforeClose = settingsManager.getSetting('general.confirmBeforeClose') as boolean ?? true;

    // If nothing is active and the setting is off, close immediately
    if (!hasActiveWork && !confirmBeforeClose) return;

    // If nothing is active but user wants confirmation on every close
    if (!hasActiveWork && confirmBeforeClose) {
      event.preventDefault();
      const result = dialog.showMessageBoxSync(mainWindow!, {
        type: 'question',
        buttons: ['Cancel', 'Close'],
        defaultId: 0,
        cancelId: 0,
        title: 'Close SubFrame',
        message: 'Are you sure you want to close SubFrame?',
      });
      if (result === 1) {
        mainWindow!.destroy();
      }
      return;
    }

    // Active work detected — always warn, regardless of setting
    const parts: string[] = [];
    if (activeAgentTerminals.length > 0) {
      parts.push(`An AI agent is currently running in ${activeAgentTerminals.length} terminal(s).`);
    }
    if (pipelineRunning) {
      parts.push('A pipeline is currently running.');
    }
    if (analysisRunning) {
      parts.push('Project analysis is in progress.');
    }
    if (activityManager.hasActiveStreams()) {
      parts.push('Background operations are in progress.');
    }
    const detailMessage = parts.join(' ') + '\nClosing will terminate all running processes.';

    event.preventDefault();
    const result = dialog.showMessageBoxSync(mainWindow!, {
      type: 'warning',
      buttons: ['Cancel', 'Close Anyway'],
      defaultId: 0,
      cancelId: 0,
      title: 'Active Work in Progress',
      message: 'Are you sure you want to close SubFrame?',
      detail: detailMessage,
    });
    if (result === 1) {
      mainWindow!.destroy();
    }
  });

  mainWindow.on('closed', () => {
    gitBranchesManager.stopAutoFetch();
    popoutManager.closeAll();
    pty.killPTY();
    ptyManager.destroyAll();
    mainWindow = null;
  });

  // Create application menu (rebuild when AI tool changes)
  void menu.createMenu();
  aiToolManager.onActiveToolChanged(() => void menu.createMenu());

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
  activityManager.setupIPC(ipcMain);
  popoutManager.setupIPC(ipcMain);
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

  // CLI install — create a shell wrapper in a PATH-accessible location
  ipcMain.handle(IPC.INSTALL_CLI, async () => {
    try {
      const cliSource = path.join(__dirname, '..', 'scripts', 'subframe-cli.js');

      if (process.platform === 'win32') {
        // Windows: create a batch file in a common PATH location
        const appData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
        const binDir = path.join(appData, 'SubFrame', 'bin');
        if (!fs.existsSync(binDir)) fs.mkdirSync(binDir, { recursive: true });

        const batPath = path.join(binDir, 'subframe.cmd');
        const scriptPath = app.isPackaged
          ? path.join(process.resourcesPath!, 'scripts', 'subframe-cli.js')
          : cliSource;
        fs.writeFileSync(batPath, `@echo off\nnode "${scriptPath}" %*\n`, 'utf8');

        // Add to user PATH if not already present
        try {
          const { execSync } = require('child_process');
          const currentPath = execSync(
            'powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable(\'Path\', \'User\')"',
            { encoding: 'utf8' }
          ).trim();
          if (!currentPath.split(';').some((p: string) => p.replace(/[\\/]+$/, '') === binDir.replace(/[\\/]+$/, ''))) {
            const newPath = currentPath ? `${currentPath};${binDir}` : binDir;
            execSync(
              `powershell -NoProfile -Command "[Environment]::SetEnvironmentVariable('Path', '${newPath.replace(/'/g, "''")}', 'User')"`,
              { encoding: 'utf8' }
            );
          }
        } catch {
          // PATH update failed — user can add manually
          return {
            success: true,
            path: binDir,
            message: `CLI installed to ${binDir}. Could not update PATH automatically — add this directory to your PATH manually.`
          };
        }

        return {
          success: true,
          path: binDir,
          message: `CLI installed. Restart your terminal to use the "subframe" command.`
        };
      } else {
        // macOS/Linux: symlink to /usr/local/bin
        const linkPath = '/usr/local/bin/subframe';
        const scriptPath = app.isPackaged
          ? path.join(process.resourcesPath!, 'scripts', 'subframe-cli.js')
          : cliSource;

        // Remove existing symlink if present
        try { fs.unlinkSync(linkPath); } catch { /* ignore */ }
        fs.symlinkSync(scriptPath, linkPath);
        // Make executable
        fs.chmodSync(scriptPath, '755');

        return { success: true, path: linkPath, message: `CLI installed to ${linkPath}` };
      }
    } catch (err) {
      return {
        success: false,
        message: `Failed to install CLI: ${(err as Error).message}. You may need to run with elevated permissions.`
      };
    }
  });

  ipcMain.handle(IPC.UNINSTALL_CLI, async () => {
    try {
      if (process.platform === 'win32') {
        const appData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
        const binDir = path.join(appData, 'SubFrame', 'bin');
        const batPath = path.join(binDir, 'subframe.cmd');

        // Remove the batch file
        try { fs.unlinkSync(batPath); } catch { /* ignore if already gone */ }

        // Remove from user PATH
        try {
          const { execSync } = require('child_process');
          const currentPath = execSync(
            'powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable(\'Path\', \'User\')"',
            { encoding: 'utf8' }
          ).trim();
          const filtered = currentPath.split(';').filter((p: string) =>
            p.replace(/[\\/]+$/, '') !== binDir.replace(/[\\/]+$/, '')
          ).join(';');
          if (filtered !== currentPath) {
            execSync(
              `powershell -NoProfile -Command "[Environment]::SetEnvironmentVariable('Path', '${filtered.replace(/'/g, "''")}', 'User')"`,
              { encoding: 'utf8' }
            );
          }
        } catch { /* PATH cleanup failed — not critical */ }

        return { success: true, message: 'CLI uninstalled. Restart your terminal for changes to take effect.' };
      } else {
        const linkPath = '/usr/local/bin/subframe';
        try { fs.unlinkSync(linkPath); } catch { /* ignore */ }
        return { success: true, message: 'CLI uninstalled.' };
      }
    } catch (err) {
      return { success: false, message: `Failed to uninstall CLI: ${(err as Error).message}` };
    }
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
  activityManager.init(window); // must be first — other managers create activity streams on init
  agentStateManager.init(window);
  onboardingManager.init(window);
  pipelineManager.init(window);
  popoutManager.init(window);
  updaterManager.init(window, app);
}

// ── Single instance lock — ensures only one SubFrame window ─────────────────

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Another instance is already running — it will receive our argv via 'second-instance'
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    // Focus the existing window and handle CLI args from the second launch
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    handleCLIArgs(argv);
  });

  // macOS: handle files opened via Finder / `open` command
  // Queue the path if the window isn't ready yet (open-file can fire before app.whenReady)
  let pendingOpenFilePath: string | null = null;
  app.on('open-file', (event, filePath) => {
    event.preventDefault();
    if (mainWindow && !mainWindow.isDestroyed()) {
      sendCLIOpenFile(filePath);
      mainWindow.focus();
    } else {
      pendingOpenFilePath = filePath;
    }
  });

  // App lifecycle
  app.whenReady().then(() => {
    app.setName('SubFrame');

    init();
    createWindow();

    // Process CLI args from the initial launch (after window is ready)
    mainWindow?.once('ready-to-show', () => {
      handleCLIArgs(process.argv);
      // Flush any macOS open-file event that arrived before the window was ready
      if (pendingOpenFilePath) {
        sendCLIOpenFile(pendingOpenFilePath);
        pendingOpenFilePath = null;
      }
    });
  });

  app.on('window-all-closed', () => {
    // Don't quit if only a pop-out window closed — the main window is still running
    if (process.platform !== 'darwin' && popoutManager.getOpenCount() === 0) {
      app.quit();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}

export { createWindow };
