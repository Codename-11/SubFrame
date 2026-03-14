/**
 * Pop-out Terminal Manager
 * Manages detached terminal windows for multi-monitor workflows.
 *
 * Uses a prewarmed hidden window to eliminate cold-start latency.
 * The prewarmed window loads the full renderer bundle in standby mode
 * (no terminal mounted). When the user pops out, we activate the
 * prewarmed window instantly and spin up a new one in the background.
 */

import { BrowserWindow, type IpcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import { IPC } from '../shared/ipcChannels';
import * as ptyManager from './ptyManager';

const popoutWindows = new Map<string, BrowserWindow>();
let mainWindow: BrowserWindow | null = null;
let prewarmedWindow: BrowserWindow | null = null;
let prewarmTimer: ReturnType<typeof setTimeout> | null = null;

// ─── Bounds persistence ──────────────────────────────────────────────────────

function getStatePath(): string {
  return path.join(app.getPath('userData'), 'popout-state.json');
}

function loadBounds(terminalId: string): Electron.Rectangle | null {
  try {
    const data = JSON.parse(fs.readFileSync(getStatePath(), 'utf8'));
    return data[terminalId] ?? null;
  } catch { return null; }
}

function saveBounds(terminalId: string, bounds: Electron.Rectangle): void {
  let data: Record<string, Electron.Rectangle> = {};
  try { data = JSON.parse(fs.readFileSync(getStatePath(), 'utf8')); } catch { /* ignore */ }
  data[terminalId] = bounds;
  try { fs.writeFileSync(getStatePath(), JSON.stringify(data)); } catch { /* ignore */ }
}

// ─── Prewarming ──────────────────────────────────────────────────────────────

/** Create a hidden BrowserWindow with the renderer loaded in standby mode */
function prewarm(): void {
  if (prewarmedWindow && !prewarmedWindow.isDestroyed()) return;

  const win = new BrowserWindow({
    width: 800,
    height: 500,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    title: 'Terminal — SubFrame',
    backgroundColor: '#0f0f10',
  });

  const indexPath = path.join(app.getAppPath(), 'index.html');
  win.loadFile(indexPath, { hash: 'popout-standby' });

  // If the prewarmed window is somehow closed before use, clear the reference
  win.on('closed', () => {
    if (prewarmedWindow === win) {
      prewarmedWindow = null;
    }
  });

  prewarmedWindow = win;
}

/** Schedule prewarming after a delay (avoids blocking app startup) */
function schedulePrewarm(delayMs = 2000): void {
  if (prewarmTimer) clearTimeout(prewarmTimer);
  prewarmTimer = setTimeout(() => {
    prewarmTimer = null;
    prewarm();
  }, delayMs);
}

// ─── Window setup helpers ────────────────────────────────────────────────────

/** Wire up output forwarding, event listeners, and close handlers for a pop-out window */
function setupPopoutWindow(win: BrowserWindow, terminalId: string): void {
  popoutWindows.set(terminalId, win);

  // Forward terminal output to pop-out window
  ptyManager.addOutputHandler(terminalId, (data) => {
    if (!win.isDestroyed()) {
      win.webContents.send(IPC.TERMINAL_OUTPUT_ID, { terminalId, data });
    }
  }, `popout-${terminalId}`);

  // Register for claude status + terminal destroyed broadcasts
  ptyManager.registerPopoutWebContents(terminalId, win.webContents);

  // Handle window close — save bounds
  win.on('close', () => {
    saveBounds(terminalId, win.getBounds());
  });

  win.on('closed', () => {
    // Only clean up if this window is still the tracked one for this terminalId.
    // A stale 'closed' event from a destroyed window must not delete a newer entry.
    if (popoutWindows.get(terminalId) === win) {
      popoutWindows.delete(terminalId);
      ptyManager.removeOutputHandler(terminalId, `popout-${terminalId}`);
      ptyManager.unregisterPopoutWebContents(terminalId);
      // Notify main window that terminal is docked again
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IPC.TERMINAL_POPOUT_STATUS, { terminalId, poppedOut: false });
      }
    }
  });

  // Notify main window that terminal is popped out
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(IPC.TERMINAL_POPOUT_STATUS, { terminalId, poppedOut: true });
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

function init(window: BrowserWindow): void {
  mainWindow = window;
  // Start prewarming after the main window has had time to load
  schedulePrewarm(3000);
}

function popOutTerminal(terminalId: string): boolean {
  if (popoutWindows.has(terminalId)) {
    const existing = popoutWindows.get(terminalId)!;
    if (!existing.isDestroyed()) {
      // Already popped out — focus it
      existing.focus();
      return true;
    }
    // Stale entry from a destroyed window — clean up synchronously
    popoutWindows.delete(terminalId);
    ptyManager.removeOutputHandler(terminalId, `popout-${terminalId}`);
    ptyManager.unregisterPopoutWebContents(terminalId);
  }

  const saved = loadBounds(terminalId);
  let win: BrowserWindow;

  if (prewarmedWindow && !prewarmedWindow.isDestroyed()) {
    // ── Fast path: use prewarmed window ──────────────────────────────────
    win = prewarmedWindow;
    prewarmedWindow = null;

    // Position and size from saved bounds
    if (saved) {
      win.setBounds(saved);
    }

    // Activate the renderer — sends terminalId so it mounts the Terminal component
    win.webContents.send(IPC.POPOUT_ACTIVATE, { terminalId });
    win.show();
    win.focus();

    // Prewarm next window in background
    schedulePrewarm(1000);
  } else {
    // ── Cold path: create window from scratch (fallback) ─────────────────
    win = new BrowserWindow({
      width: saved?.width ?? 800,
      height: saved?.height ?? 500,
      x: saved?.x,
      y: saved?.y,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
      title: 'Terminal — SubFrame',
      backgroundColor: '#0f0f10',
    });

    const indexPath = path.join(app.getAppPath(), 'index.html');
    win.loadFile(indexPath, { hash: `popout?terminalId=${terminalId}` });

    // Prewarm for next time
    schedulePrewarm(1000);
  }

  setupPopoutWindow(win, terminalId);
  return true;
}

function dockTerminal(terminalId: string): boolean {
  const win = popoutWindows.get(terminalId);
  if (!win || win.isDestroyed()) return false;

  saveBounds(terminalId, win.getBounds());
  win.close(); // This triggers the 'closed' handler which cleans up
  return true;
}

function isTerminalPoppedOut(terminalId: string): boolean {
  const win = popoutWindows.get(terminalId);
  return !!win && !win.isDestroyed();
}

function focusPopout(terminalId: string): void {
  const win = popoutWindows.get(terminalId);
  if (win && !win.isDestroyed()) {
    win.focus();
  }
}

function closeAll(): void {
  // Cancel any pending prewarm
  if (prewarmTimer) { clearTimeout(prewarmTimer); prewarmTimer = null; }

  // Destroy prewarmed window
  if (prewarmedWindow && !prewarmedWindow.isDestroyed()) {
    prewarmedWindow.destroy();
    prewarmedWindow = null;
  }

  // Destroy all active pop-out windows
  for (const [terminalId, win] of popoutWindows) {
    if (!win.isDestroyed()) {
      saveBounds(terminalId, win.getBounds());
      win.destroy();
    }
  }
  popoutWindows.clear();
}

/** Number of open (non-destroyed) pop-out windows */
function getOpenCount(): number {
  let count = 0;
  for (const win of popoutWindows.values()) {
    if (!win.isDestroyed()) count++;
  }
  return count;
}

function setupIPC(ipcMain: IpcMain): void {
  ipcMain.handle(IPC.TERMINAL_POPOUT, (_event, terminalId: string) => {
    return { success: popOutTerminal(terminalId) };
  });

  ipcMain.handle(IPC.TERMINAL_DOCK, (_event, terminalId: string) => {
    return { success: dockTerminal(terminalId) };
  });
}

export { init, setupIPC, popOutTerminal, dockTerminal, isTerminalPoppedOut, focusPopout, closeAll, getOpenCount };
