/**
 * Typed IPC helpers for the renderer process.
 * Wraps Electron's ipcRenderer with type-safe invoke/send functions.
 */

import type { IPCHandleMap, IPCSendMap } from '../../shared/ipcChannels';

const { ipcRenderer } = require('electron');

/**
 * Type-safe ipcRenderer.invoke — maps channel to args and return type.
 */
export function typedInvoke<K extends keyof IPCHandleMap>(
  channel: K,
  ...args: IPCHandleMap[K]['args']
): Promise<IPCHandleMap[K]['return']> {
  return ipcRenderer.invoke(channel, ...args.map(sanitizeForIPC));
}

/**
 * Strip `undefined` values from a plain object to prevent Electron structured clone errors.
 * Only sanitizes plain objects (Object.getPrototypeOf === Object.prototype or null).
 * Does NOT recurse into class instances, Maps, Sets, etc. to avoid infinite loops.
 */
function sanitizeForIPC<T>(value: T): T {
  if (value === null || value === undefined || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value as T;
  // Only sanitize plain objects — skip class instances, Maps, Dates, etc.
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return value;
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v !== undefined) clean[k] = v;
  }
  return clean as T;
}

/**
 * Type-safe ipcRenderer.send — maps channel to payload type.
 */
export function typedSend<K extends keyof IPCSendMap>(
  channel: K,
  ...args: IPCSendMap[K] extends void ? [] : [payload: IPCSendMap[K]]
): void {
  if (args.length > 0) {
    ipcRenderer.send(channel, sanitizeForIPC(args[0]));
  } else {
    ipcRenderer.send(channel);
  }
}

/**
 * Type-safe listener for main→renderer events.
 * Returns an unsubscribe function.
 */
export function typedOn<K extends string>(
  channel: K,
  handler: (event: unknown, ...args: unknown[]) => void
): () => void {
  ipcRenderer.on(channel, handler);
  return () => {
    ipcRenderer.removeListener(channel, handler);
  };
}
