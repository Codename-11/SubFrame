/**
 * Updater Manager
 * Handles automatic update checks, downloads, and installation via electron-updater.
 * In dev mode (app.isPackaged === false), all operations are no-ops.
 */

import { ipcMain, type App, type BrowserWindow, type IpcMain } from 'electron';
import { IPC } from '../shared/ipcChannels';
import type { UpdaterStatus, UpdaterProgress } from '../shared/ipcChannels';
import { getSetting } from './settingsManager';
import { broadcast } from './eventBridge';
import { log as outputLog } from './outputChannelManager';
import type { RoutableIPC } from './ipcRouter';

let mainWindow: BrowserWindow | null = null;
let isPackaged = false;
let checkInterval: ReturnType<typeof setInterval> | null = null;
/** True while a user-initiated check is in flight — included in status events so the UI can show feedback */
let isManualCheck = false;
/** Timestamp of last check — used to debounce focus-triggered checks */
let lastCheckTime = 0;
/** Once an update is downloaded, stop all automatic checks */
let updateDownloaded = false;
/** Minimum gap between focus-triggered checks (5 minutes) */
const FOCUS_CHECK_DEBOUNCE_MS = 5 * 60_000;
/** Optional hook called before install — returns false to defer (e.g. for graceful shutdown) */
let beforeInstallHook: (() => boolean) | null = null;
/** Last status sent — re-broadcast on renderer reload so the UI doesn't lose state */
let lastStatus: UpdaterStatus | null = null;

/**
 * Send updater status to the renderer process
 */
function sendStatus(status: UpdaterStatus): void {
  lastStatus = status;
  if (mainWindow && !mainWindow.isDestroyed()) {
    broadcast(IPC.UPDATER_STATUS, status);
  }
}

/**
 * Send download progress to the renderer process
 */
function sendProgress(progress: UpdaterProgress): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    broadcast(IPC.UPDATER_PROGRESS, progress);
  }
}

/**
 * Initialize the updater manager.
 * Must be called after the main window is created.
 */
function init(window: BrowserWindow, app: App): void {
  mainWindow = window;
  isPackaged = app.isPackaged;

  if (!isPackaged) {
    console.log('[updater] Dev mode — auto-updater disabled');
    return;
  }

  // Dynamic import to avoid issues in dev mode
  const { autoUpdater } = require('electron-updater');

  // User must opt-in to download
  autoUpdater.autoDownload = false;
  // Install on quit if update was downloaded
  autoUpdater.autoInstallOnAppQuit = true;
  // Allow prerelease updates based on settings
  const allowPrereleaseSetting = getSetting('updater.allowPrerelease') as string || 'auto';
  if (allowPrereleaseSetting === 'always') {
    autoUpdater.allowPrerelease = true;
  } else if (allowPrereleaseSetting === 'never') {
    autoUpdater.allowPrerelease = false;
  } else {
    // 'auto' — derive from current version
    const currentVersion: string = require('../../package.json').version;
    autoUpdater.allowPrerelease = currentVersion.includes('-');
  }

  // Wire autoUpdater events → renderer (include manual flag so UI knows when to show feedback)
  autoUpdater.on('checking-for-update', () => {
    outputLog('system', `Checking for updates${isManualCheck ? ' (manual)' : ''}...`);
    sendStatus({ status: 'checking', manual: isManualCheck });
  });

  autoUpdater.on('update-available', (info: { version?: string }) => {
    outputLog('system', `Update available: v${info.version ?? '?'}`);
    sendStatus({ status: 'available', version: info.version, manual: isManualCheck });
    isManualCheck = false;
  });

  autoUpdater.on('update-not-available', () => {
    outputLog('system', 'No updates available');
    sendStatus({ status: 'not-available', manual: isManualCheck });
    isManualCheck = false;
  });

  autoUpdater.on('download-progress', (progress: UpdaterProgress) => {
    sendStatus({ status: 'downloading', manual: true });
    sendProgress(progress);
  });

  autoUpdater.on('update-downloaded', (info: { version?: string }) => {
    updateDownloaded = true;
    outputLog('system', `Update v${info.version ?? '?'} downloaded — ready to install`);
    sendStatus({ status: 'downloaded', version: info.version, manual: true });
    // Stop periodic checks — update is ready, no need to keep checking
    if (checkInterval) { clearInterval(checkInterval); checkInterval = null; }
  });

  autoUpdater.on('error', (err: Error) => {
    // 404s during silent background checks are transient (e.g. CI still uploading artifacts) — swallow them
    const is404 = err.message?.includes('404') || err.message?.includes('HttpError');
    if (!isManualCheck && is404) {
      console.log('[updater] Background check got 404 — artifacts not ready yet, will retry later');
    } else {
      // For manual checks or non-404 errors, report to renderer
      const friendlyError = is404
        ? 'Update artifacts not available yet — try again in a few minutes'
        : err.message;
      outputLog('system', `Update error: ${friendlyError}`);
      sendStatus({ status: 'error', error: friendlyError, manual: isManualCheck });
    }
    isManualCheck = false;
  });

  // Check if auto-checking is enabled
  const autoCheck = getSetting('updater.autoCheck');
  if (autoCheck === false) {
    return;
  }

  const checkIntervalHours = (getSetting('updater.checkIntervalHours') as number) || 1;
  const checkIntervalMs = checkIntervalHours * 3600000;

  /** Silent background check with debounce tracking */
  const silentCheck = () => {
    if (updateDownloaded) return; // Update already staged — don't re-check
    lastCheckTime = Date.now();
    autoUpdater.checkForUpdates().catch((err: Error) => {
      console.error('[updater] Check failed:', err.message);
    });
  };

  // Initial check (delayed to not block startup)
  setTimeout(silentCheck, 10_000);

  // Periodic checks
  checkInterval = setInterval(silentCheck, checkIntervalMs);

  // Check on window focus — catches updates quickly when user returns
  // Debounced to avoid hammering the update server on rapid focus changes
  window.on('focus', () => {
    if (Date.now() - lastCheckTime >= FOCUS_CHECK_DEBOUNCE_MS) {
      silentCheck();
    }
  });
}

/**
 * Reload the renderer process without restarting the main process.
 * PTY instances survive because they live in the main process — the renderer
 * re-syncs via TERMINAL_RESYNC after remounting.
 *
 * Returns true if reload was triggered, false if no window is available.
 */
function reloadRenderer(): boolean {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  console.log('[updater] Reloading renderer (hot reload) — PTYs preserved');
  mainWindow.webContents.reloadIgnoringCache();
  return true;
}

/**
 * Setup IPC handlers for updater actions.
 */
function setupIPC(ipc: RoutableIPC | IpcMain = ipcMain): void {
  // Renderer hot reload — works in both dev and packaged mode
  ipc.handle(IPC.RENDERER_HOT_RELOAD, () => {
    const success = reloadRenderer();
    return { success };
  });

  // Renderer sends this after remounting post-reload to signal readiness.
  // Re-broadcast the last updater status so the UI doesn't lose state (e.g. a
  // pending download or ready-to-install notification that was sent while React
  // was mid-remount and hadn't registered its IPC event listeners yet).
  ipcMain.on(IPC.RENDERER_RELOADED, () => {
    console.log('[updater] Renderer reloaded and re-synced successfully');
    if (lastStatus) {
      sendStatus(lastStatus);
    }
  });

  if (!isPackaged) {
    // Dev mode stubs — return safe defaults
    ipc.handle(IPC.UPDATER_CHECK, () => ({
      updateAvailable: false,
    }));
    ipc.handle(IPC.UPDATER_DOWNLOAD, () => {});
    ipc.handle(IPC.UPDATER_INSTALL, () => {});
    return;
  }

  const { autoUpdater } = require('electron-updater');

  ipc.handle(IPC.UPDATER_CHECK, async () => {
    try {
      isManualCheck = true;
      const result = await autoUpdater.checkForUpdates();
      if (result?.updateInfo) {
        return {
          updateAvailable: true,
          version: result.updateInfo.version,
          releaseNotes: typeof result.updateInfo.releaseNotes === 'string'
            ? result.updateInfo.releaseNotes
            : undefined,
        };
      }
      return { updateAvailable: false };
    } catch (err) {
      console.error('[updater] Check failed:', err);
      return { updateAvailable: false };
    }
  });

  ipc.handle(IPC.UPDATER_DOWNLOAD, async () => {
    try {
      outputLog('system', 'Starting update download...');
      sendStatus({ status: 'downloading', manual: true });
      await autoUpdater.downloadUpdate();
    } catch (err) {
      console.error('[updater] Download failed:', err);
      const msg = err instanceof Error ? err.message : 'Download failed';
      const friendly = msg.includes('404') ? 'Update not available yet — try again shortly' : msg;
      outputLog('system', `Download error: ${friendly}`);
      sendStatus({ status: 'error', error: friendly, manual: true });
    }
  });

  ipc.handle(IPC.UPDATER_INSTALL, () => {
    // If a before-install hook is set and returns false, defer to graceful shutdown
    if (beforeInstallHook && !beforeInstallHook()) {
      return;
    }
    autoUpdater.quitAndInstall();
  });
}

/**
 * Trigger an update check from within the main process (e.g. menu click).
 * In dev mode, sends a no-op status to the renderer.
 */
async function checkForUpdates(): Promise<void> {
  if (!isPackaged) {
    sendStatus({ status: 'checking', manual: true });
    sendStatus({ status: 'not-available', manual: true });
    return;
  }
  const { autoUpdater } = require('electron-updater');
  try {
    isManualCheck = true;
    await autoUpdater.checkForUpdates();
  } catch (err) {
    isManualCheck = false;
    console.error('[updater] Manual check failed:', err);
  }
}

/**
 * Cleanup on shutdown
 */
function destroy(): void {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
}

/**
 * Set a hook that runs before quitAndInstall.
 * Return false to defer install (e.g. to perform graceful shutdown first).
 */
function setBeforeInstallHook(hook: () => boolean): void {
  beforeInstallHook = hook;
}

/**
 * Programmatically call quitAndInstall (e.g. after graceful shutdown completes).
 */
function performQuitAndInstall(): void {
  if (!isPackaged) return;
  const { autoUpdater } = require('electron-updater');
  autoUpdater.quitAndInstall();
}

export { init, setupIPC, destroy, checkForUpdates, setBeforeInstallHook, performQuitAndInstall, reloadRenderer };
