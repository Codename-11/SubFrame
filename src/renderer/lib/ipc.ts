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
  return ipcRenderer.invoke(channel, ...args);
}

/**
 * Type-safe ipcRenderer.send — maps channel to payload type.
 */
export function typedSend<K extends keyof IPCSendMap>(
  channel: K,
  ...args: IPCSendMap[K] extends void ? [] : [payload: IPCSendMap[K]]
): void {
  if (args.length > 0) {
    ipcRenderer.send(channel, args[0]);
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
