/**
 * Pop-out Editor Manager
 * Manages detached editor windows for multi-monitor workflows.
 *
 * Follows the same pattern as popoutManager.ts but for file editors.
 * No prewarming needed — editor windows are created on demand.
 */

import { BrowserWindow, type IpcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import { IPC } from '../shared/ipcChannels';
import { broadcast } from './eventBridge';

const popoutWindows = new Map<string, BrowserWindow>();
let mainWindow: BrowserWindow | null = null;

// ─── Bounds persistence ──────────────────────────────────────────────────────

function getStatePath(): string {
  return path.join(app.getPath('userData'), 'editor-popout-bounds.json');
}

function loadBounds(key: string): Electron.Rectangle | null {
  try {
    const data = JSON.parse(fs.readFileSync(getStatePath(), 'utf8'));
    return data[key] ?? null;
  } catch { return null; }
}

function saveBounds(key: string, bounds: Electron.Rectangle): void {
  let data: Record<string, Electron.Rectangle> = {};
  try { data = JSON.parse(fs.readFileSync(getStatePath(), 'utf8')); } catch { /* ignore */ }
  data[key] = bounds;
  try { fs.writeFileSync(getStatePath(), JSON.stringify(data)); } catch { /* ignore */ }
}

// ─── Public API ──────────────────────────────────────────────────────────────

function init(window: BrowserWindow): void {
  mainWindow = window;
}

function popOutEditor(filePath: string): boolean {
  const key = encodeURIComponent(filePath);

  if (popoutWindows.has(key)) {
    const existing = popoutWindows.get(key)!;
    if (!existing.isDestroyed()) {
      existing.focus();
      return true;
    }
    popoutWindows.delete(key);
  }

  const saved = loadBounds(key);
  const fileName = path.basename(filePath);

  const win = new BrowserWindow({
    width: saved?.width ?? 900,
    height: saved?.height ?? 700,
    x: saved?.x,
    y: saved?.y,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    title: `${fileName} — SubFrame`,
    backgroundColor: '#0f0f10',
  });

  const indexPath = path.join(app.getAppPath(), 'index.html');
  win.loadFile(indexPath, { hash: `editor-popout?filePath=${key}` });

  popoutWindows.set(key, win);

  // Handle window close — save bounds
  win.on('close', () => {
    saveBounds(key, win.getBounds());
  });

  win.on('closed', () => {
    if (popoutWindows.get(key) === win) {
      popoutWindows.delete(key);
      // Notify that editor is docked again
      if (mainWindow && !mainWindow.isDestroyed()) {
        broadcast(IPC.EDITOR_POPOUT_STATUS, { filePath, popped: false });
      }
    }
  });

  // Notify main window that editor is popped out
  if (mainWindow && !mainWindow.isDestroyed()) {
    broadcast(IPC.EDITOR_POPOUT_STATUS, { filePath, popped: true });
  }

  return true;
}

function dockEditor(filePath: string): boolean {
  const key = encodeURIComponent(filePath);
  const win = popoutWindows.get(key);
  if (!win || win.isDestroyed()) return false;

  saveBounds(key, win.getBounds());
  win.close(); // This triggers the 'closed' handler which cleans up
  return true;
}

function isEditorPoppedOut(filePath: string): boolean {
  const key = encodeURIComponent(filePath);
  const win = popoutWindows.get(key);
  return !!win && !win.isDestroyed();
}

function closeAll(): void {
  for (const [key, win] of popoutWindows) {
    if (!win.isDestroyed()) {
      saveBounds(key, win.getBounds());
      win.destroy();
    }
  }
  popoutWindows.clear();
}

function getOpenCount(): number {
  let count = 0;
  for (const win of popoutWindows.values()) {
    if (!win.isDestroyed()) count++;
  }
  return count;
}

function setupIPC(ipcMain: IpcMain): void {
  ipcMain.handle(IPC.EDITOR_POPOUT, (_event, filePath: string) => {
    return { success: popOutEditor(filePath) };
  });

  ipcMain.handle(IPC.EDITOR_DOCK, (_event, filePath: string) => {
    return { success: dockEditor(filePath) };
  });
}

export { init, setupIPC, popOutEditor, dockEditor, isEditorPoppedOut, closeAll, getOpenCount };
