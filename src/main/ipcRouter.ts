/**
 * IPC Router — dual-registration handler router.
 *
 * Wraps Electron's IpcMain so that every ipcMain.handle() and ipcMain.on()
 * call also registers in a parallel map. The WebSocket server can then call
 * routeInvoke() / routeSend() to reach the same handler functions without
 * going through Electron's internal dispatch.
 *
 * Usage in index.ts:
 *   const router = createRoutableIPC(ipcMain);
 *   someManager.setupIPC(router);  // instead of someManager.setupIPC(ipcMain)
 *
 * Usage in webServerManager.ts:
 *   const result = await routeInvoke('load-tasks', [projectPath]);
 *   routeSend('terminal-input-id', { terminalId, data });
 */

import type { IpcMain, IpcMainEvent, IpcMainInvokeEvent } from 'electron';

// ── Handler registries ──────────────────────────────────────────────────────

type InvokeHandler = (event: IpcMainInvokeEvent | null, ...args: unknown[]) => unknown | Promise<unknown>;
type OnHandler = (event: IpcMainEvent | null, ...args: unknown[]) => void;

const invokeHandlers = new Map<string, InvokeHandler>();
const onHandlers = new Map<string, OnHandler[]>();

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Create a routable IPC wrapper. Pass this to manager.setupIPC() instead of
 * raw ipcMain. Handlers are registered in both Electron IPC and the parallel map.
 */
export function createRoutableIPC(ipcMain: IpcMain): RoutableIPC {
  return {
    handle(channel: string, handler: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown): void {
      ipcMain.handle(channel, handler);
      invokeHandlers.set(channel, handler as InvokeHandler);
    },

    on(channel: string, handler: (event: IpcMainEvent, ...args: unknown[]) => void): void {
      ipcMain.on(channel, handler);
      if (!onHandlers.has(channel)) onHandlers.set(channel, []);
      onHandlers.get(channel)!.push(handler as OnHandler);
    },

    // Pass-through for removeHandler (used by some managers for hot-reload)
    removeHandler(channel: string): void {
      ipcMain.removeHandler(channel);
      invokeHandlers.delete(channel);
    },
  };
}

/**
 * Route an invoke-style call to the registered handler.
 * Used by WebSocket server for request/response messages.
 */
export async function routeInvoke(channel: string, args: unknown[]): Promise<unknown> {
  const handler = invokeHandlers.get(channel);
  if (!handler) throw new Error(`[IPC Router] No invoke handler for channel: ${channel}`);
  // Pass null as event — WS callers don't have an Electron IpcMainInvokeEvent
  return handler(null, ...args);
}

/**
 * Route a send-style call to the registered handler(s).
 * Used by WebSocket server for fire-and-forget messages.
 */
export function routeSend(channel: string, ...args: unknown[]): void {
  const handlers = onHandlers.get(channel);
  if (!handlers || handlers.length === 0) {
    console.warn(`[IPC Router] No send handler for channel: ${channel}`);
    return;
  }
  for (const handler of handlers) {
    handler(null as unknown as IpcMainEvent, ...args);
  }
}

/** Check if a handler is registered for an invoke channel */
export function hasInvokeHandler(channel: string): boolean {
  return invokeHandlers.has(channel);
}

/** Check if a handler is registered for a send channel */
export function hasSendHandler(channel: string): boolean {
  return onHandlers.has(channel) && onHandlers.get(channel)!.length > 0;
}

// ── Types ───────────────────────────────────────────────────────────────────

export interface RoutableIPC {
  handle(channel: string, handler: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown): void;
  on(channel: string, handler: (event: IpcMainEvent, ...args: unknown[]) => void): void;
  removeHandler(channel: string): void;
}
