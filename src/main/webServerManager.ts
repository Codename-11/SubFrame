/**
 * Web Server Manager — serves SubFrame UI as a web app with WebSocket transport.
 *
 * HTTP server serves static assets (web build of React UI).
 * WebSocket server handles all IPC communication (invoke/send/event).
 * Single-session model with takeover support (like Google Messages for Web).
 *
 * Settings-driven: enable/disable via `server.enabled` setting.
 * Follows the standard manager pattern: init() + setupIPC() + shutdown().
 */

import * as http from 'http';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { IpcMain, IpcMainInvokeEvent } from 'electron';
import { WebSocketServer, WebSocket } from 'ws';
import type { RoutableIPC } from './ipcRouter';
import { routeInvoke, routeSend, hasInvokeHandler, hasSendHandler } from './ipcRouter';
import { addBridgeListener } from './eventBridge';
import { IPC } from '../shared/ipcChannels';
import type { ClientMessage, ServerMessage } from '../shared/wsProtocol';
import { WS_ERRORS } from '../shared/wsProtocol';

// ── State ──────────────────────────────────────────────────────────────────

let httpServer: http.Server | null = null;
let wss: WebSocketServer | null = null;
let authToken = '';
let serverPort = 0;
let enabled = false;
let removeBridgeListener: (() => void) | null = null;

interface WebSession {
  id: string;
  ws: WebSocket;
  connectedAt: string;
  userAgent: string;
  subscribedChannels: Set<string>;
  authenticated: boolean;
}

let activeSession: WebSession | null = null;
/** Pending takeover — WS waiting for user to confirm */
let pendingTakeoverWs: WebSocket | null = null;

// Pairing codes for quick-code auth
interface PairingCode {
  code: string;
  expiresAt: number;
}
let activePairingCode: PairingCode | null = null;

// Terminal output batching for WS clients
const terminalBatches = new Map<string, string[]>();
let batchTimer: ReturnType<typeof setTimeout> | null = null;
let batchIntervalMs = 16; // ~60fps default

// ── Service Discovery ──────────────────────────────────────────────────────

const CONFIG_DIR = path.join(os.homedir(), '.subframe');
const CONFIG_PATH = path.join(CONFIG_DIR, 'web-server.json');

function writeServiceConfig(): void {
  const appVersion = require('../../package.json').version;
  const config = { port: serverPort, token: authToken, pid: process.pid, version: appVersion };
  try {
    if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
  } catch (err) {
    console.error('[Web Server] Failed to write service config:', err);
  }
}

function removeServiceConfig(): void {
  try { if (fs.existsSync(CONFIG_PATH)) fs.unlinkSync(CONFIG_PATH); } catch { /* ignore */ }
}

// ── Static Asset Serving ───────────────────────────────────────────────────

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
};

function getDistDir(): string {
  // In development: project root dist/
  // In production: resources/app/dist/
  const devPath = path.join(__dirname, '..', '..', 'dist');
  if (fs.existsSync(devPath)) return devPath;
  return path.join(__dirname, '..', 'dist');
}

function getWebIndexPath(): string {
  // Check dist first (build output), then src (development)
  const distPath = path.join(getDistDir(), 'web-index.html');
  if (fs.existsSync(distPath)) return distPath;
  const srcPath = path.join(__dirname, '..', '..', 'src', 'renderer', 'web-index.html');
  if (fs.existsSync(srcPath)) return srcPath;
  return distPath; // Fallback (will 404)
}

function serveStatic(res: http.ServerResponse, urlPath: string): boolean {
  const distDir = getDistDir();

  // Map URL to filesystem
  let filePath: string;
  if (urlPath === '/' || urlPath === '/index.html') {
    filePath = getWebIndexPath();
  } else if (urlPath === '/manifest.json' || urlPath === '/sw.js') {
    // PWA files — resolve from src/renderer/ (development) or dist/ (production)
    const projectRoot = path.join(__dirname, '..', '..');
    const filename = urlPath.slice(1); // strip leading /
    const distPath = path.join(getDistDir(), filename);
    const srcPath = path.join(projectRoot, 'src', 'renderer', filename);
    filePath = fs.existsSync(distPath) ? distPath : srcPath;
  } else {
    // Resolve from project root for /node_modules/ and /assets/ paths, dist/ for /dist/
    const projectRoot = path.join(__dirname, '..', '..');
    const normalized = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
    if (urlPath.startsWith('/dist/')) {
      filePath = path.join(distDir, normalized.replace(/^dist[/\\]/, ''));
    } else if (urlPath.startsWith('/node_modules/') || urlPath.startsWith('/assets/')) {
      filePath = path.join(projectRoot, normalized);
    } else {
      filePath = path.join(distDir, normalized);
    }
    // Security: must stay within project root
    if (!filePath.startsWith(projectRoot)) {
      res.writeHead(403);
      res.end('Forbidden');
      return true;
    }
  }

  if (!fs.existsSync(filePath)) return false;

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': (ext === '.html' || urlPath === '/sw.js' || urlPath === '/manifest.json') ? 'no-cache' : 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(content);
    return true;
  } catch {
    return false;
  }
}

// ── HTTP Request Handler ───────────────────────────────────────────────────

function handleHTTP(req: http.IncomingMessage, res: http.ServerResponse): void {
  const url = new URL(req.url || '/', `http://localhost:${serverPort}`);
  const pathname = url.pathname;

  // Health check (public)
  if (pathname === '/api/health') {
    const version = require('../../package.json').version;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', name: 'SubFrame Server', version }));
    return;
  }

  // Pairing endpoint
  if (pathname === '/api/pair' && req.method === 'POST') {
    handlePairing(req, res);
    return;
  }

  // Static asset serving
  if (serveStatic(res, pathname)) return;

  // Fallback to index.html for SPA routing
  if (!pathname.startsWith('/api/')) {
    const indexPath = getWebIndexPath();
    if (fs.existsSync(indexPath)) {
      const content = fs.readFileSync(indexPath);
      res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-cache' });
      res.end(content);
      return;
    }
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
}

// ── Pairing ────────────────────────────────────────────────────────────────

function handlePairing(req: http.IncomingMessage, res: http.ServerResponse): void {
  let body = '';
  req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
  req.on('end', () => {
    try {
      const { code } = JSON.parse(body) as { code?: string };
      if (!code || !activePairingCode || code.toUpperCase() !== activePairingCode.code) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid or expired pairing code' }));
        return;
      }
      if (Date.now() > activePairingCode.expiresAt) {
        activePairingCode = null;
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Pairing code expired' }));
        return;
      }
      // Valid — return the auth token
      activePairingCode = null;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ token: authToken }));
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    }
  });
}

// ── WebSocket Handler ──────────────────────────────────────────────────────

function handleWsConnection(ws: WebSocket, req: http.IncomingMessage): void {
  const userAgent = req.headers['user-agent'] || 'unknown';
  let session: WebSession | null = null;

  ws.on('message', async (raw) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw.toString()) as ClientMessage;
    } catch {
      wsSend(ws, { type: 'error', id: '', code: WS_ERRORS.INVALID_MESSAGE, message: 'Invalid JSON' });
      return;
    }

    // Auth must happen first
    if (msg.type === 'auth') {
      if (msg.token !== authToken) {
        wsSend(ws, { type: 'auth-fail', message: 'Invalid token' });
        ws.close(4001, 'Invalid token');
        return;
      }

      // Check for existing session
      if (activeSession && activeSession.ws.readyState === WebSocket.OPEN) {
        // Session in use — offer takeover
        pendingTakeoverWs = ws;
        wsSend(ws, {
          type: 'session-in-use',
          currentDevice: activeSession.userAgent,
          connectedAt: activeSession.connectedAt,
        });
        return;
      }

      // No active session — accept
      session = createSession(ws, userAgent);
      activeSession = session;
      wsSend(ws, { type: 'auth-ok', sessionId: session.id });
      broadcastIPC(IPC.WEB_CLIENT_CONNECTED, { userAgent, connectedAt: session.connectedAt });
      return;
    }

    // Takeover confirmation
    if (msg.type === 'takeover') {
      if (pendingTakeoverWs === ws) {
        // Notify old client
        if (activeSession && activeSession.ws.readyState === WebSocket.OPEN) {
          wsSend(activeSession.ws, { type: 'session-takeover', message: 'Session moved to another device' });
          activeSession.ws.close(4002, 'Session taken over');
        }
        // Accept new session
        session = createSession(ws, userAgent);
        activeSession = session;
        pendingTakeoverWs = null;
        wsSend(ws, { type: 'auth-ok', sessionId: session.id });
        broadcastIPC(IPC.WEB_CLIENT_CONNECTED, { userAgent, connectedAt: session.connectedAt });
      }
      return;
    }

    // All other messages require authentication
    if (!session || !session.authenticated) {
      wsSend(ws, { type: 'error', id: (msg as { id?: string }).id || '', code: WS_ERRORS.AUTH_REQUIRED, message: 'Not authenticated' });
      return;
    }

    switch (msg.type) {
      case 'invoke': {
        try {
          const result = await routeInvoke(msg.channel, msg.args);
          wsSend(ws, { type: 'response', id: msg.id, result });
        } catch (err) {
          wsSend(ws, {
            type: 'error',
            id: msg.id,
            code: hasInvokeHandler(msg.channel) ? WS_ERRORS.HANDLER_ERROR : WS_ERRORS.UNKNOWN_CHANNEL,
            message: (err as Error).message,
          });
        }
        break;
      }

      case 'send': {
        try {
          if (msg.payload !== undefined) {
            routeSend(msg.channel, msg.payload);
          } else {
            routeSend(msg.channel);
          }
        } catch (err) {
          console.warn(`[Web Server] Send error on ${msg.channel}:`, (err as Error).message);
        }
        break;
      }

      case 'subscribe':
        for (const ch of msg.channels) {
          session.subscribedChannels.add(ch);
        }
        break;

      case 'unsubscribe':
        for (const ch of msg.channels) {
          session.subscribedChannels.delete(ch);
        }
        break;

      case 'ping':
        wsSend(ws, { type: 'pong' });
        break;
    }
  });

  ws.on('close', () => {
    if (activeSession && activeSession.ws === ws) {
      activeSession = null;
      broadcastIPC(IPC.WEB_CLIENT_DISCONNECTED, undefined);
    }
    if (pendingTakeoverWs === ws) {
      pendingTakeoverWs = null;
    }
  });
}

function createSession(ws: WebSocket, userAgent: string): WebSession {
  return {
    id: crypto.randomUUID(),
    ws,
    connectedAt: new Date().toISOString(),
    userAgent,
    subscribedChannels: new Set(),
    authenticated: true,
  };
}

function wsSend(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

// ── Event Bridge → WebSocket ───────────────────────────────────────────────

function onBridgeEvent(channel: string, data: unknown): void {
  if (!activeSession || activeSession.ws.readyState !== WebSocket.OPEN) return;
  if (!activeSession.subscribedChannels.has(channel)) return;

  // Terminal output batching — merge rapid chunks into ~16ms frames
  if (channel === IPC.TERMINAL_OUTPUT_ID && typeof data === 'object' && data !== null) {
    const payload = data as { terminalId: string; data: string };
    batchTerminalOutput(payload.terminalId, payload.data);
    return;
  }

  wsSend(activeSession.ws, { type: 'event', channel, payload: data });
}

function batchTerminalOutput(terminalId: string, chunk: string): void {
  let batch = terminalBatches.get(terminalId);
  if (!batch) { batch = []; terminalBatches.set(terminalId, batch); }
  batch.push(chunk);

  if (!batchTimer) {
    batchTimer = setTimeout(flushTerminalBatches, batchIntervalMs);
  }
}

function flushTerminalBatches(): void {
  batchTimer = null;
  if (!activeSession || activeSession.ws.readyState !== WebSocket.OPEN) {
    terminalBatches.clear();
    return;
  }
  for (const [terminalId, chunks] of terminalBatches) {
    const merged = chunks.join('');
    wsSend(activeSession.ws, {
      type: 'event',
      channel: IPC.TERMINAL_OUTPUT_ID,
      payload: { terminalId, data: merged },
    });
  }
  terminalBatches.clear();
}

// Convenience: send IPC event to Electron window (for UI indicators)
function broadcastIPC(channel: string, data: unknown): void {
  try {
    const { broadcast } = require('./eventBridge');
    broadcast(channel, data);
  } catch { /* eventBridge not ready */ }
}

// ── Server Start/Stop ──────────────────────────────────────────────────────

function startServer(): void {
  if (httpServer) return;
  authToken = authToken || crypto.randomBytes(24).toString('hex');

  httpServer = http.createServer((req, res) => {
    try {
      handleHTTP(req, res);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
  });

  wss = new WebSocketServer({ server: httpServer });
  wss.on('connection', handleWsConnection);

  httpServer.listen(0, '127.0.0.1', () => {
    const addr = httpServer!.address();
    serverPort = typeof addr === 'object' && addr ? addr.port : 0;
    console.log(`[Web Server] Listening on http://127.0.0.1:${serverPort}`);
    writeServiceConfig();
  });

  httpServer.on('error', (err) => {
    console.error('[Web Server] Server error:', err);
  });

  // Subscribe to event bridge for WS forwarding
  removeBridgeListener = addBridgeListener(onBridgeEvent);
}

function stopServer(): void {
  // Flush pending batches
  if (batchTimer) { clearTimeout(batchTimer); batchTimer = null; }
  terminalBatches.clear();

  // Close active session
  if (activeSession?.ws.readyState === WebSocket.OPEN) {
    activeSession.ws.close(1001, 'Server shutting down');
  }
  activeSession = null;
  pendingTakeoverWs = null;

  // Unsubscribe from event bridge
  removeBridgeListener?.();
  removeBridgeListener = null;

  // Close WebSocket server
  if (wss) { wss.close(); wss = null; }

  // Close HTTP server
  if (httpServer) { httpServer.close(); httpServer = null; }
  serverPort = 0;

  removeServiceConfig();
}

// ── Manager Lifecycle ──────────────────────────────────────────────────────

function init(): void {
  // Check settings
  try {
    const settingsManager = require('./settingsManager');
    enabled = settingsManager.getSetting('server.enabled') === true;
    batchIntervalMs = settingsManager.getSetting('server.terminalBatchIntervalMs') ?? 16;
  } catch {
    enabled = false;
  }

  if (!enabled) {
    console.log('[Web Server] Disabled via settings');
    return;
  }

  startServer();
}

function setupIPC(router: RoutableIPC | IpcMain): void {
  // React to settings changes
  try {
    const settingsManager = require('./settingsManager');
    if (typeof settingsManager.onSettingChange === 'function') {
      settingsManager.onSettingChange((key: string, value: unknown) => {
        if (key === 'server.enabled') {
          const enable = value === true;
          if (enable && !httpServer) { enabled = true; startServer(); }
          else if (!enable && httpServer) { enabled = false; stopServer(); }
        } else if (key === 'server.terminalBatchIntervalMs') {
          batchIntervalMs = (value as number) ?? 16;
        }
      });
    }
  } catch { /* settingsManager not available */ }

  // IPC: get server info
  router.handle(IPC.WEB_SERVER_INFO, () => {
    return {
      enabled,
      port: serverPort,
      token: authToken,
      clientConnected: !!activeSession,
      clientInfo: activeSession ? {
        userAgent: activeSession.userAgent,
        connectedAt: activeSession.connectedAt,
      } : null,
    };
  });

  // IPC: toggle server
  router.handle(IPC.WEB_SERVER_TOGGLE, (_event: IpcMainInvokeEvent | null, enable: boolean) => {
    if (enable && !httpServer) {
      enabled = true;
      startServer();
      try {
        const settingsManager = require('./settingsManager');
        settingsManager.updateSetting('server.enabled', true);
      } catch { /* ignore */ }
    } else if (!enable && httpServer) {
      enabled = false;
      stopServer();
      try {
        const settingsManager = require('./settingsManager');
        settingsManager.updateSetting('server.enabled', false);
      } catch { /* ignore */ }
    }
    return { enabled, port: serverPort, token: authToken };
  });

  // IPC: regenerate token
  router.handle(IPC.WEB_SERVER_REGEN_TOKEN, () => {
    authToken = crypto.randomBytes(24).toString('hex');
    // Disconnect current session (token changed)
    if (activeSession?.ws.readyState === WebSocket.OPEN) {
      wsSend(activeSession.ws, { type: 'auth-fail', message: 'Token regenerated' });
      activeSession.ws.close(4003, 'Token regenerated');
    }
    activeSession = null;
    if (httpServer) writeServiceConfig();
    return { token: authToken };
  });

  // IPC: generate pairing code
  router.handle(IPC.WEB_SERVER_GENERATE_PAIRING, () => {
    const code = crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 6);
    activePairingCode = { code, expiresAt: Date.now() + 5 * 60 * 1000 };
    return { code, expiresIn: 300 };
  });

  // IPC: get SSH command
  router.handle(IPC.WEB_SERVER_GET_SSH_COMMAND, () => {
    const port = serverPort || '<port>';
    return {
      command: `ssh -L 8080:localhost:${port} user@hostname`,
      sshAvailable: true, // Could check `which ssh` but keep simple for now
    };
  });
}

function shutdown(): void {
  stopServer();
}

export { init, setupIPC, shutdown, startServer, stopServer };
