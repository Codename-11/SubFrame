/**
 * Typed IPC helpers for the renderer process.
 *
 * Delegates to the active transport (Electron IPC or WebSocket).
 * This file preserves the same API surface so existing callers
 * (hooks, components) continue to work without changes.
 */

import type { IPCHandleMap, IPCSendMap } from '../../shared/ipcChannels';
import { getTransport } from './transportProvider';

/**
 * Type-safe invoke — request/response via the active transport.
 */
export function typedInvoke<K extends keyof IPCHandleMap>(
  channel: K,
  ...args: IPCHandleMap[K]['args']
): Promise<IPCHandleMap[K]['return']> {
  return getTransport().invoke(channel, ...args);
}

/**
 * Type-safe send — fire-and-forget via the active transport.
 */
export function typedSend<K extends keyof IPCSendMap>(
  channel: K,
  ...args: IPCSendMap[K] extends void ? [] : [payload: IPCSendMap[K]]
): void {
  (getTransport().send as (...a: unknown[]) => void)(channel, ...args);
}

/**
 * Type-safe listener for main→renderer events.
 * Returns an unsubscribe function.
 */
export function typedOn<K extends string>(
  channel: K,
  handler: (event: unknown, ...args: unknown[]) => void
): () => void {
  return getTransport().on(channel, handler);
}
