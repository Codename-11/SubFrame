/**
 * Electron transport — wraps ipcRenderer, shell, and clipboard.
 *
 * This is the ONLY file in the renderer that imports from 'electron'.
 * All other renderer code accesses Electron APIs through getTransport().
 */

import type { Transport, TransportPlatform } from '../../shared/transport';
import type { IPCHandleMap, IPCSendMap } from '../../shared/ipcChannels';

const { ipcRenderer, shell, clipboard } = require('electron');

/**
 * Strip `undefined` values from a plain object to prevent Electron structured clone errors.
 * Only sanitizes plain objects (Object.getPrototypeOf === Object.prototype or null).
 * Does NOT recurse into class instances, Maps, Sets, etc. to avoid infinite loops.
 */
function sanitizeForIPC<T>(value: T): T {
  if (value === null || value === undefined || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value as T;
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return value;
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v !== undefined) clean[k] = v;
  }
  return clean as T;
}

export class ElectronTransport implements Transport {
  invoke<K extends keyof IPCHandleMap>(
    channel: K,
    ...args: IPCHandleMap[K]['args']
  ): Promise<IPCHandleMap[K]['return']> {
    return ipcRenderer.invoke(channel, ...args.map(sanitizeForIPC));
  }

  send<K extends keyof IPCSendMap>(
    channel: K,
    ...args: IPCSendMap[K] extends void ? [] : [payload: IPCSendMap[K]]
  ): void {
    if (args.length > 0) {
      ipcRenderer.send(channel, sanitizeForIPC(args[0]));
    } else {
      ipcRenderer.send(channel);
    }
  }

  on(
    channel: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler: (event: unknown, ...args: any[]) => void
  ): () => void {
    ipcRenderer.on(channel, handler);
    return () => {
      ipcRenderer.removeListener(channel, handler);
    };
  }

  readonly platform: TransportPlatform = {
    isElectron: true,
    openExternal: (url: string) => shell.openExternal(url),
    openPath: (filePath: string) => shell.openPath(filePath),
    showItemInFolder: (filePath: string) => shell.showItemInFolder(filePath),
    writeClipboard: (text: string) => clipboard.writeText(text),
    readClipboard: () => Promise.resolve(clipboard.readText()),
    osPlatform: process.platform,
  };
}
