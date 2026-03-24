/**
 * Event Bridge — fan-out for main→renderer broadcasts.
 *
 * Replaces direct mainWindow.webContents.send() calls across managers.
 * Events are sent to both the Electron window AND any registered bridge
 * listeners (e.g., WebSocket server for remote clients).
 *
 * Usage in managers:
 *   import { broadcast } from './eventBridge';
 *   broadcast(IPC.SOME_EVENT, data);  // instead of mainWindow.webContents.send(...)
 *
 * Usage in webServerManager:
 *   import { addBridgeListener } from './eventBridge';
 *   addBridgeListener((channel, data) => { sendToWsClient(channel, data); });
 */

import type { BrowserWindow } from 'electron';

// ── State ───────────────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null;

type BridgeListener = (channel: string, data: unknown) => void;
const bridgeListeners = new Set<BridgeListener>();

// ── Public API ──────────────────────────────────────────────────────────────

/** Initialize with the main BrowserWindow. Call once at app startup. */
export function initEventBridge(window: BrowserWindow): void {
  mainWindow = window;
}

/**
 * Broadcast an event to the Electron window AND all bridge listeners.
 * Drop-in replacement for mainWindow.webContents.send().
 */
export function broadcast(channel: string, data?: unknown): void {
  // Send to Electron renderer
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (data !== undefined) {
      mainWindow.webContents.send(channel, data);
    } else {
      mainWindow.webContents.send(channel);
    }
  }

  // Fan-out to bridge listeners (WebSocket server, etc.)
  for (const listener of bridgeListeners) {
    try {
      listener(channel, data);
    } catch (err) {
      console.error('[EventBridge] Listener error:', err);
    }
  }
}

/** Register a bridge listener. Returns an unsubscribe function. */
export function addBridgeListener(listener: BridgeListener): () => void {
  bridgeListeners.add(listener);
  return () => { bridgeListeners.delete(listener); };
}

/** Get the main BrowserWindow reference (for pop-out windows, etc.). */
export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

/** Get the number of registered bridge listeners. */
export function getBridgeListenerCount(): number {
  return bridgeListeners.size;
}
