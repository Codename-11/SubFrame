/**
 * Transport abstraction — unifies Electron IPC and WebSocket communication.
 *
 * Three patterns matching Electron's IPC model:
 *   invoke  → request/response (Promise-based)
 *   send    → fire-and-forget (no response)
 *   on      → event subscription (returns unsubscribe fn)
 *
 * Implementations: ElectronTransport (ipcRenderer), WebSocketTransport (future).
 */

import type { IPCHandleMap, IPCSendMap } from './ipcChannels';

export interface Transport {
  /** Request/response — maps to ipcRenderer.invoke / ws invoke. */
  invoke<K extends keyof IPCHandleMap>(
    channel: K,
    ...args: IPCHandleMap[K]['args']
  ): Promise<IPCHandleMap[K]['return']>;

  /** Fire-and-forget — maps to ipcRenderer.send / ws send. */
  send<K extends keyof IPCSendMap>(
    channel: K,
    ...args: IPCSendMap[K] extends void ? [] : [payload: IPCSendMap[K]]
  ): void;

  /** Event subscription — returns an unsubscribe function. */
  on(
    channel: string,
    handler: (event: unknown, ...args: unknown[]) => void
  ): () => void;

  /** Platform-specific utilities (shell, clipboard, etc.). */
  readonly platform: TransportPlatform;
}

export interface TransportPlatform {
  /** Open a URL in the system browser. */
  openExternal(url: string): void;
  /** Open a file/folder in the OS default handler. */
  openPath(filePath: string): void;
  /** Copy text to clipboard. */
  writeClipboard(text: string): void;
  /** Read text from clipboard. */
  readClipboard(): Promise<string>;
  /** Whether this is running inside Electron. */
  readonly isElectron: boolean;
}

export type TransportType = 'electron' | 'websocket';
