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
import * as outputChannelManager from './outputChannelManager';
import * as popoutManager from './popoutManager';
import * as apiServerManager from './apiServerManager';
import * as webServerManager from './webServerManager';
import { initEventBridge, broadcast } from './eventBridge';
import { createRoutableIPC } from './ipcRouter';
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

/** Open a file in a standalone pop-out editor window (does NOT touch the main instance) */
function sendCLIOpenFile(filePath: string): void {
  const indexPath = path.join(app.getAppPath(), 'index.html');
  const win = new BrowserWindow({
    width: 900,
    height: 650,
    title: `${path.basename(filePath)} — SubFrame`,
    backgroundColor: '#0f0f10',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(indexPath, { hash: `editor?filePath=${encodeURIComponent(filePath)}` });
}

/** Add a project to the workspace without switching — non-disruptive to running instance */
function sendCLIOpenProject(dirPath: string): void {
  // Add to workspace so it appears in the project list
  workspace.addProject(dirPath);
  if (mainWindow && !mainWindow.isDestroyed()) {
    const result = workspace.getProjectsWithScanned();
    broadcast(IPC.WORKSPACE_UPDATED, result);
    // Don't send CLI_OPEN_PROJECT — that would switch the active project
    // Just focus the window so the user sees it was added
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

  // Initialize event bridge BEFORE any modules so broadcast() works from the start
  initEventBridge(mainWindow);

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
    broadcast(IPC.WORKSPACE_UPDATED, result);
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

  // ── Graceful Shutdown State ───────────────────────────────────────────────
  let shutdownInProgress = false;
  let pendingShutdownReason: 'close' | 'update' | 'close-confirm' | null = null;
  let closeConfirmed = false; // Set after user confirms close — skips re-prompting

  /** Detect active work across all subsystems */
  function detectActiveWork() {
    const activeAgentTerminals = ptyManager.getTerminalIds().filter(id => ptyManager.isClaudeActive(id));
    const pipelineRunning = pipelineManager.hasActiveRuns();
    const analysisRunning = onboardingManager.hasActiveAnalyses();
    const activeStreams = activityManager.hasActiveStreams();
    const hasActiveWork = activeAgentTerminals.length > 0 || pipelineRunning || analysisRunning || activeStreams;
    return { activeAgentTerminals, pipelineRunning, analysisRunning, activeStreams, hasActiveWork };
  }

  /** Build terminal info list for the shutdown dialog */
  function buildTerminalInfoList(activeTerminalIds: string[]) {
    return ptyManager.getTerminalIds().map(id => ({
      terminalId: id,
      claudeActive: activeTerminalIds.includes(id),
      label: `Terminal ${id.replace('term-', '#')}`,
      status: 'waiting' as const,
    }));
  }

  /** Send graceful shutdown request to renderer */
  function requestGracefulShutdown(reason: 'close' | 'update' | 'close-confirm'): void {
    if (shutdownInProgress || !mainWindow || mainWindow.isDestroyed()) return;
    shutdownInProgress = true;
    pendingShutdownReason = reason;
    const { activeAgentTerminals, pipelineRunning, analysisRunning, activeStreams } = detectActiveWork();
    broadcast(IPC.GRACEFUL_SHUTDOWN_REQUEST, {
      reason,
      terminals: buildTerminalInfoList(activeAgentTerminals),
      pipelineRunning,
      analysisRunning,
      activeStreams,
    });
  }

  /** Perform the graceful shutdown — inject /exit, wait for terminals, then finish */
  async function performGracefulShutdown(): Promise<void> {
    const TIMEOUT_MS = 15_000;
    const activeTerminals = ptyManager.getTerminalIds().filter(id => ptyManager.isClaudeActive(id));

    // Inject /exit into each active Claude terminal
    for (const terminalId of activeTerminals) {
      ptyManager.writeToTerminal(terminalId, '/exit\n');
      if (mainWindow && !mainWindow.isDestroyed()) {
        broadcast(IPC.GRACEFUL_SHUTDOWN_STATUS, { terminalId, status: 'exiting' });
      }
    }

    // Wait for each active terminal to exit (with timeout)
    for (const terminalId of activeTerminals) {
      const result = await ptyManager.waitForExit(terminalId, TIMEOUT_MS);
      if (mainWindow && !mainWindow.isDestroyed()) {
        broadcast(IPC.GRACEFUL_SHUTDOWN_STATUS, { terminalId, status: result });
      }
    }

    // Now kill any remaining non-Claude terminals cleanly
    const remaining = ptyManager.getTerminalIds();
    for (const terminalId of remaining) {
      ptyManager.destroyTerminal(terminalId);
      if (mainWindow && !mainWindow.isDestroyed()) {
        broadcast(IPC.GRACEFUL_SHUTDOWN_STATUS, { terminalId, status: 'killed' });
      }
    }

    // Notify renderer that shutdown is complete
    if (mainWindow && !mainWindow.isDestroyed()) {
      broadcast(IPC.GRACEFUL_SHUTDOWN_COMPLETE, {
        reason: pendingShutdownReason,
        success: true,
      });
    }

    // Brief delay so the renderer can show completion state
    await new Promise(resolve => setTimeout(resolve, 800));

    // Finish based on reason
    if (pendingShutdownReason === 'update') {
      updaterManager.performQuitAndInstall();
    } else if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.destroy();
    }
    shutdownInProgress = false;
    pendingShutdownReason = null;
  }

  // ── Graceful Shutdown IPC Handlers ────────────────────────────────────────

  ipcMain.handle(IPC.GRACEFUL_SHUTDOWN_CONFIRM, async () => {
    if (pendingShutdownReason === 'close-confirm') {
      // Simple close confirmation — user said yes, close normally
      shutdownInProgress = false;
      pendingShutdownReason = null;
      closeConfirmed = true; // Skip re-prompting in the close handler
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close();
    } else {
      await performGracefulShutdown();
    }
  });

  ipcMain.handle(IPC.GRACEFUL_SHUTDOWN_CANCEL, () => {
    shutdownInProgress = false;
    pendingShutdownReason = null;
  });

  ipcMain.handle(IPC.GRACEFUL_SHUTDOWN_FORCE, () => {
    if (pendingShutdownReason === 'update') {
      updaterManager.performQuitAndInstall();
    } else if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.destroy();
    }
    shutdownInProgress = false;
    pendingShutdownReason = null;
  });

  // ── Updater Pre-Install Hook ──────────────────────────────────────────────
  // Route update installs through graceful shutdown when active work exists
  updaterManager.setBeforeInstallHook(() => {
    const { hasActiveWork } = detectActiveWork();
    if (hasActiveWork) {
      requestGracefulShutdown('update');
      return false; // Defer — graceful shutdown will call performQuitAndInstall when ready
    }
    return true; // No active work, proceed directly
  });

  // ── Save state before close — with active-work protection ─────────────────
  mainWindow.on('close', (event) => {
    saveWindowState();

    // User already confirmed via in-app dialog — let the close proceed
    if (closeConfirmed) { closeConfirmed = false; return; }

    // If a graceful shutdown is already in progress, just block the close
    if (shutdownInProgress) {
      event.preventDefault();
      return;
    }

    const { hasActiveWork } = detectActiveWork();
    const confirmBeforeClose = settingsManager.getSetting('general.confirmBeforeClose') as boolean ?? true;

    // If nothing is active and the setting is off, close immediately
    if (!hasActiveWork && !confirmBeforeClose) return;

    // If nothing is active but user wants confirmation on every close — in-app dialog
    if (!hasActiveWork && confirmBeforeClose) {
      event.preventDefault();
      requestGracefulShutdown('close-confirm');
      return;
    }

    // Active work detected — route through graceful shutdown UI dialog
    event.preventDefault();
    requestGracefulShutdown('close');
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
  const routedIpc = createRoutableIPC(ipcMain);

  // Setup module IPC handlers
  settingsManager.setupIPC(routedIpc as unknown as typeof ipcMain);
  aiToolManager.setupIPC(routedIpc as unknown as typeof ipcMain);
  pty.setupIPC(routedIpc as unknown as typeof ipcMain);
  ptyManager.setupIPC(routedIpc as unknown as typeof ipcMain);
  dialogs.setupIPC(routedIpc as unknown as typeof ipcMain);
  fileTree.setupIPC(routedIpc as unknown as typeof ipcMain);
  promptLogger.setupIPC(routedIpc as unknown as typeof ipcMain);
  workspace.setupIPC(routedIpc as unknown as typeof ipcMain);
  frameProject.setupIPC(routedIpc as unknown as typeof ipcMain);
  fileEditor.setupIPC(routedIpc as unknown as typeof ipcMain);
  tasksManager.setupIPC(routedIpc as unknown as typeof ipcMain);
  pluginsManager.setupIPC(routedIpc as unknown as typeof ipcMain);
  githubManager.setupIPC(routedIpc as unknown as typeof ipcMain);
  claudeUsageManager.setupIPC(routedIpc as unknown as typeof ipcMain);
  overviewManager.setupIPC(routedIpc as unknown as typeof ipcMain);
  gitBranchesManager.setupIPC(routedIpc as unknown as typeof ipcMain);
  claudeSessionsManager.setupIPC(routedIpc as unknown as typeof ipcMain);
  aiFilesManager.setupIPC(routedIpc as unknown as typeof ipcMain);
  agentStateManager.setupIPC(routedIpc as unknown as typeof ipcMain);
  skillsManager.setupIPC(routedIpc as unknown as typeof ipcMain);
  promptsManager.setupIPC(routedIpc as unknown as typeof ipcMain);
  onboardingManager.setupIPC(routedIpc as unknown as typeof ipcMain);
  pipelineManager.setupIPC(routedIpc as unknown as typeof ipcMain);
  activityManager.setupIPC(routedIpc as unknown as typeof ipcMain);
  outputChannelManager.setupIPC(routedIpc as unknown as typeof ipcMain);
  popoutManager.setupIPC(routedIpc as unknown as typeof ipcMain);
  apiServerManager.setupIPC(routedIpc as unknown as typeof ipcMain);
  webServerManager.setupIPC(routedIpc);
  updaterManager.setupIPC(routedIpc as unknown as typeof ipcMain);
  // Note: updaterManager.init() still owns updater lifecycle wiring because it
  // needs app.isPackaged to be set first.

  // What's New — read RELEASE_NOTES.md from app root
  routedIpc.handle(IPC.GET_RELEASE_NOTES, () => {
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
  routedIpc.handle(IPC.INSTALL_CLI, async () => {
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

  routedIpc.handle(IPC.UNINSTALL_CLI, async () => {
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

  // ─── CLI Status Check ────────────────────────────────────────────────────────

  routedIpc.handle(IPC.CHECK_CLI_STATUS, async () => {
    try {
      if (process.platform === 'win32') {
        const binDir = path.join(process.env.LOCALAPPDATA || '', 'SubFrame', 'bin');
        const cmdPath = path.join(binDir, 'subframe.cmd');
        const exists = fs.existsSync(cmdPath);
        // Check if binDir is in the user's persistent PATH
        const userPath = process.env.PATH || '';
        const inPath = userPath.split(';').some((p: string) => p.toLowerCase() === binDir.toLowerCase());
        return { installed: exists, inPath, path: exists ? cmdPath : null };
      } else {
        const symlinkPath = '/usr/local/bin/subframe';
        const exists = fs.existsSync(symlinkPath);
        return { installed: exists, inPath: exists, path: exists ? symlinkPath : null };
      }
    } catch {
      return { installed: false, inPath: false, path: null };
    }
  });

  // ─── Windows Context Menu Integration ────────────────────────────────────────

  routedIpc.handle(IPC.INSTALL_CONTEXT_MENU, async () => {
    if (process.platform !== 'win32') {
      return { success: false, message: 'Context menu integration is Windows-only' };
    }
    try {
      const exePath = process.execPath;
      const { execSync } = require('child_process');

      // Directory background context menu (right-click in empty space)
      execSync(`reg add "HKCU\\Software\\Classes\\Directory\\Background\\shell\\SubFrame" /ve /d "Open with SubFrame" /f`, { stdio: 'pipe' });
      execSync(`reg add "HKCU\\Software\\Classes\\Directory\\Background\\shell\\SubFrame" /v Icon /d "${exePath},0" /f`, { stdio: 'pipe' });
      execSync(`reg add "HKCU\\Software\\Classes\\Directory\\Background\\shell\\SubFrame\\command" /ve /d "\\"${exePath}\\" \\"%V\\"" /f`, { stdio: 'pipe' });

      // Directory context menu (right-click on folder)
      execSync(`reg add "HKCU\\Software\\Classes\\Directory\\shell\\SubFrame" /ve /d "Open with SubFrame" /f`, { stdio: 'pipe' });
      execSync(`reg add "HKCU\\Software\\Classes\\Directory\\shell\\SubFrame" /v Icon /d "${exePath},0" /f`, { stdio: 'pipe' });
      execSync(`reg add "HKCU\\Software\\Classes\\Directory\\shell\\SubFrame\\command" /ve /d "\\"${exePath}\\" \\"%1\\"" /f`, { stdio: 'pipe' });

      // File context menu (right-click on any file)
      execSync(`reg add "HKCU\\Software\\Classes\\*\\shell\\SubFrame" /ve /d "Open with SubFrame" /f`, { stdio: 'pipe' });
      execSync(`reg add "HKCU\\Software\\Classes\\*\\shell\\SubFrame" /v Icon /d "${exePath},0" /f`, { stdio: 'pipe' });
      execSync(`reg add "HKCU\\Software\\Classes\\*\\shell\\SubFrame\\command" /ve /d "\\"${exePath}\\" \\"%1\\"" /f`, { stdio: 'pipe' });

      return { success: true, message: 'Context menu registered' };
    } catch (err) {
      return { success: false, message: (err as Error).message };
    }
  });

  routedIpc.handle(IPC.UNINSTALL_CONTEXT_MENU, async () => {
    if (process.platform !== 'win32') {
      return { success: false, message: 'Context menu integration is Windows-only' };
    }
    try {
      const { execSync } = require('child_process');
      execSync('reg delete "HKCU\\Software\\Classes\\Directory\\Background\\shell\\SubFrame" /f', { stdio: 'pipe' });
      execSync('reg delete "HKCU\\Software\\Classes\\Directory\\shell\\SubFrame" /f', { stdio: 'pipe' });
      execSync('reg delete "HKCU\\Software\\Classes\\*\\shell\\SubFrame" /f', { stdio: 'pipe' });
      return { success: true, message: 'Context menu removed' };
    } catch (err) {
      return { success: false, message: (err as Error).message };
    }
  });

  routedIpc.handle(IPC.CHECK_CONTEXT_MENU, async () => {
    if (process.platform !== 'win32') return { installed: false };
    try {
      const { execSync } = require('child_process');
      execSync('reg query "HKCU\\Software\\Classes\\Directory\\shell\\SubFrame" /ve', { stdio: 'pipe' });
      return { installed: true };
    } catch {
      return { installed: false };
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
  outputChannelManager.init(window);
  agentStateManager.init(window);
  onboardingManager.init(window);
  pipelineManager.init(window);
  popoutManager.init(window);
  updaterManager.init(window, app);
  apiServerManager.init(window);
  webServerManager.init();
}

// ── Single instance lock — ensures only one SubFrame window ─────────────────

// Single-instance lock — only enforce in packaged builds.
// Dev mode needs to allow restarts without the previous instance blocking.
const gotTheLock = app.isPackaged ? app.requestSingleInstanceLock() : true;

if (!gotTheLock) {
  // Another instance is already running — it will receive our argv via 'second-instance'
  app.quit();
} else {
  // CLI forwarding: only register when single-instance lock is active (packaged builds).
  // In dev mode, no lock = no second-instance events = handler would be dead code.
  if (app.isPackaged) {
    app.on('second-instance', (_event, argv) => {
      // handleCLIArgs spawns new windows for `edit` (doesn't touch main)
      // and only focuses main for `open` (adds project to workspace)
      handleCLIArgs(argv);
    });
  }

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

  // Clean up API server on actual quit (not window-all-closed, which on macOS
  // fires when windows close but the app stays alive in the dock)
  app.on('before-quit', () => {
    apiServerManager.shutdown();
    webServerManager.shutdown();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}

export { createWindow };
