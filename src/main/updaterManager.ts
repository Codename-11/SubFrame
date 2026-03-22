/**
 * Updater Manager
 * Handles automatic update checks, downloads, and installation via electron-updater.
 * In dev mode (app.isPackaged === false), all operations are no-ops.
 */

import { ipcMain, type App, type BrowserWindow } from 'electron';
import { IPC } from '../shared/ipcChannels';
import type { UpdaterStatus, UpdaterProgress } from '../shared/ipcChannels';
import { getSetting } from './settingsManager';

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

/**
 * Send updater status to the renderer process
 */
function sendStatus(status: UpdaterStatus): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(IPC.UPDATER_STATUS, status);
  }
}

/**
 * Send download progress to the renderer process
 */
function sendProgress(progress: UpdaterProgress): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(IPC.UPDATER_PROGRESS, progress);
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
    setupIPC();
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
    sendStatus({ status: 'checking', manual: isManualCheck });
  });

  autoUpdater.on('update-available', (info: { version?: string }) => {
    sendStatus({ status: 'available', version: info.version, manual: isManualCheck });
    isManualCheck = false;
  });

  autoUpdater.on('update-not-available', () => {
    sendStatus({ status: 'not-available', manual: isManualCheck });
    isManualCheck = false;
  });

  autoUpdater.on('download-progress', (progress: UpdaterProgress) => {
    sendStatus({ status: 'downloading' });
    sendProgress(progress);
  });

  autoUpdater.on('update-downloaded', (info: { version?: string }) => {
    updateDownloaded = true;
    sendStatus({ status: 'downloaded', version: info.version });
    // Stop periodic checks — update is ready, no need to keep checking
    if (checkInterval) { clearInterval(checkInterval); checkInterval = null; }
  });

  autoUpdater.on('error', (err: Error) => {
    sendStatus({ status: 'error', error: err.message, manual: isManualCheck });
    isManualCheck = false;
  });

  // Register IPC handlers (must happen inside init so isPackaged is set)
  setupIPC();

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
 * Setup IPC handlers for updater actions.
 */
function setupIPC(): void {
  if (!isPackaged) {
    // Dev mode stubs — return safe defaults
    ipcMain.handle(IPC.UPDATER_CHECK, () => ({
      updateAvailable: false,
    }));
    ipcMain.handle(IPC.UPDATER_DOWNLOAD, () => {});
    ipcMain.handle(IPC.UPDATER_INSTALL, () => {});
    return;
  }

  const { autoUpdater } = require('electron-updater');

  ipcMain.handle(IPC.UPDATER_CHECK, async () => {
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

  ipcMain.handle(IPC.UPDATER_DOWNLOAD, async () => {
    try {
      await autoUpdater.downloadUpdate();
    } catch (err) {
      console.error('[updater] Download failed:', err);
      // Error event on autoUpdater will also fire and send status to renderer
    }
  });

  ipcMain.handle(IPC.UPDATER_INSTALL, () => {
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

export { init, setupIPC, destroy, checkForUpdates, setBeforeInstallHook, performQuitAndInstall };
