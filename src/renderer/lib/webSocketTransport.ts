/**
 * WebSocket transport — connects to SubFrame Server via WebSocket.
 *
 * Used in browser/mobile mode (web-entry.tsx) as the Transport implementation.
 * Implements the same invoke/send/on interface as ElectronTransport.
 */

import type { Transport, TransportPlatform } from '../../shared/transport';
import type { IPCHandleMap, IPCSendMap } from '../../shared/ipcChannels';
import type { ClientMessage, ServerMessage } from '../../shared/wsProtocol';

const INVOKE_TIMEOUT_MS = 15_000;
const HEARTBEAT_INTERVAL_MS = 30_000;
const MAX_RECONNECT_DELAY_MS = 30_000;

interface PendingInvoke {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class WebSocketTransport implements Transport {
  private ws: WebSocket | null = null;
  private pendingInvokes = new Map<string, PendingInvoke>();
  private eventListeners = new Map<string, Set<(...args: unknown[]) => void>>();
  private subscriptions = new Set<string>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private authenticated = false;
  private url: string;
  private token: string;
  private onSessionTakeover?: (message: string) => void;
  private onSessionInUse?: (currentDevice: string, connectedAt: string) => void;
  private onDisconnect?: () => void;
  private onReconnect?: () => void;

  constructor(options: {
    url: string;
    token: string;
    onSessionTakeover?: (message: string) => void;
    onSessionInUse?: (currentDevice: string, connectedAt: string) => void;
    onDisconnect?: () => void;
    onReconnect?: () => void;
  }) {
    this.url = options.url;
    this.token = options.token;
    this.onSessionTakeover = options.onSessionTakeover;
    this.onSessionInUse = options.onSessionInUse;
    this.onDisconnect = options.onDisconnect;
    this.onReconnect = options.onReconnect;
  }

  /** Connect and authenticate. Resolves when auth succeeds. */
  async connect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);
      } catch (err) {
        reject(new Error(`WebSocket connection failed: ${err}`));
        return;
      }

      this.ws.onopen = () => {
        this.sendRaw({ type: 'auth', token: this.token });
      };

      this.ws.onmessage = (event) => {
        let msg: ServerMessage;
        try {
          msg = JSON.parse(event.data as string) as ServerMessage;
        } catch {
          return;
        }

        if (msg.type === 'auth-ok') {
          this.authenticated = true;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          // Restore subscriptions after reconnect
          if (this.subscriptions.size > 0) {
            this.sendRaw({ type: 'subscribe', channels: [...this.subscriptions] });
          }
          if (this.reconnectAttempts > 0) this.onReconnect?.();
          resolve();
          return;
        }

        if (msg.type === 'auth-fail') {
          reject(new Error(msg.message));
          return;
        }

        this.handleMessage(msg);
      };

      this.ws.onclose = () => {
        this.authenticated = false;
        this.stopHeartbeat();
        this.onDisconnect?.();
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        if (!this.authenticated) {
          reject(new Error('WebSocket connection error'));
        }
      };
    });
  }

  // ── Transport interface ─────────────────────────────────────────────────

  invoke<K extends keyof IPCHandleMap>(
    channel: K,
    ...args: IPCHandleMap[K]['args']
  ): Promise<IPCHandleMap[K]['return']> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.authenticated) {
        reject(new Error(`Cannot invoke ${String(channel)}: not connected`));
        return;
      }

      const id = crypto.randomUUID();
      const timer = setTimeout(() => {
        this.pendingInvokes.delete(id);
        reject(new Error(`Invoke timeout: ${String(channel)}`));
      }, INVOKE_TIMEOUT_MS);

      this.pendingInvokes.set(id, {
        resolve: resolve as (result: unknown) => void,
        reject,
        timer,
      });

      this.sendRaw({ type: 'invoke', id, channel: channel as string, args: [...args] });
    });
  }

  send<K extends keyof IPCSendMap>(
    channel: K,
    ...args: IPCSendMap[K] extends void ? [] : [payload: IPCSendMap[K]]
  ): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.authenticated) return;
    this.sendRaw({ type: 'send', channel: channel as string, payload: args[0] });
  }

  on(
    channel: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler: (event: unknown, ...args: any[]) => void
  ): () => void {
    if (!this.eventListeners.has(channel)) {
      this.eventListeners.set(channel, new Set());
      // Auto-subscribe on server
      this.subscriptions.add(channel);
      if (this.ws && this.ws.readyState === WebSocket.OPEN && this.authenticated) {
        this.sendRaw({ type: 'subscribe', channels: [channel] });
      }
    }
    this.eventListeners.get(channel)!.add(handler);

    return () => {
      const set = this.eventListeners.get(channel);
      if (set) {
        set.delete(handler);
        if (set.size === 0) {
          this.eventListeners.delete(channel);
          this.subscriptions.delete(channel);
          if (this.ws && this.ws.readyState === WebSocket.OPEN && this.authenticated) {
            this.sendRaw({ type: 'unsubscribe', channels: [channel] });
          }
        }
      }
    };
  }

  readonly platform: TransportPlatform = {
    isElectron: false,
    osPlatform: navigator.platform?.includes('Mac') ? 'darwin'
      : navigator.platform?.includes('Win') ? 'win32'
      : 'linux',
    openExternal: (url: string) => window.open(url, '_blank'),
    openPath: () => { /* no-op in browser */ },
    showItemInFolder: () => { /* no-op in browser */ },
    writeClipboard: (text: string) => { navigator.clipboard.writeText(text).catch(() => {}); },
    readClipboard: () => navigator.clipboard.readText(),
  };

  // ── Internal ────────────────────────────────────────────────────────────

  private handleMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case 'response': {
        const pending = this.pendingInvokes.get(msg.id);
        if (pending) {
          clearTimeout(pending.timer);
          this.pendingInvokes.delete(msg.id);
          pending.resolve(msg.result);
        }
        break;
      }

      case 'error': {
        const pending = this.pendingInvokes.get(msg.id);
        if (pending) {
          clearTimeout(pending.timer);
          this.pendingInvokes.delete(msg.id);
          pending.reject(new Error(msg.message));
        }
        break;
      }

      case 'event': {
        const handlers = this.eventListeners.get(msg.channel);
        if (handlers) {
          for (const handler of handlers) {
            try {
              // null for the 'event' arg to match ipcRenderer.on signature
              handler(null, msg.payload);
            } catch (err) {
              console.error(`[WS Transport] Event handler error for ${msg.channel}:`, err);
            }
          }
        }
        break;
      }

      case 'session-takeover':
        this.onSessionTakeover?.(msg.message);
        break;

      case 'session-in-use':
        this.onSessionInUse?.(msg.currentDevice, msg.connectedAt);
        break;

      case 'pong':
        break;
    }
  }

  private sendRaw(msg: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.sendRaw({ type: 'ping' });
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), MAX_RECONNECT_DELAY_MS);
    console.log(`[WS Transport] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch(() => {
        // Will retry via onclose handler
      });
    }, delay);
  }

  /** Disconnect and stop reconnecting. */
  dispose(): void {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    for (const [, pending] of this.pendingInvokes) {
      clearTimeout(pending.timer);
      pending.reject(new Error('Transport disposed'));
    }
    this.pendingInvokes.clear();
    if (this.ws) {
      this.ws.onclose = null; // Prevent reconnect
      this.ws.close();
      this.ws = null;
    }
  }
}
