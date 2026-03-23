/**
 * Transport provider — global singleton for the active transport.
 *
 * Initialized once at app startup (index.tsx or web-entry.tsx)
 * before any React rendering occurs. All IPC calls route through
 * getTransport() to reach the active transport implementation.
 */

import type { Transport } from '../../shared/transport';

let activeTransport: Transport | null = null;

/** Set the active transport. Must be called before any IPC usage. */
export function setTransport(transport: Transport): void {
  activeTransport = transport;
}

/** Get the active transport. Throws if not initialized. */
export function getTransport(): Transport {
  if (!activeTransport) {
    throw new Error('Transport not initialized — call setTransport() before using IPC');
  }
  return activeTransport;
}
