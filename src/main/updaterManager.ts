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

  // Wire autoUpdater events → renderer
  autoUpdater.on('checking-for-update', () => {
    sendStatus({ status: 'checking' });
  });

  autoUpdater.on('update-available', (info: { version?: string }) => {
    sendStatus({ status: 'available', version: info.version });
  });

  autoUpdater.on('update-not-available', () => {
    sendStatus({ status: 'not-available' });
  });

  autoUpdater.on('download-progress', (progress: UpdaterProgress) => {
    sendStatus({ status: 'downloading' });
    sendProgress(progress);
  });

  autoUpdater.on('update-downloaded', (info: { version?: string }) => {
    sendStatus({ status: 'downloaded', version: info.version });
  });

  autoUpdater.on('error', (err: Error) => {
    sendStatus({ status: 'error', error: err.message });
  });

  // Register IPC handlers (must happen inside init so isPackaged is set)
  setupIPC();

  // Check if auto-checking is enabled
  const autoCheck = getSetting('updater.autoCheck');
  if (autoCheck === false) {
    return;
  }

  const checkIntervalHours = (getSetting('updater.checkIntervalHours') as number) || 4;
  const checkIntervalMs = checkIntervalHours * 3600000;

  // Initial check (delayed to not block startup)
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err: Error) => {
      console.error('[updater] Check failed:', err.message);
    });
  }, 10_000);

  // Periodic checks
  checkInterval = setInterval(() => {
    autoUpdater.checkForUpdates().catch((err: Error) => {
      console.error('[updater] Periodic check failed:', err.message);
    });
  }, checkIntervalMs);
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
    autoUpdater.quitAndInstall();
  });
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

export { init, setupIPC, destroy };
