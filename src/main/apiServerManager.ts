/**
 * Local API Server — exposes SubFrame terminal state to external tools.
 *
 * Runs an HTTP server on localhost with token-based auth. External tools
 * (Conjure TTS, Stream Deck, custom scripts) can query terminal selection,
 * buffer content, process context, and subscribe to events via SSE.
 *
 * Service discovery: writes port + token to ~/.subframe/api.json on startup.
 * Auth: Bearer token in Authorization header, or ?token= query parameter.
 */

import * as http from 'http';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { IpcMain, BrowserWindow } from 'electron';
import { IPC } from '../shared/ipcChannels';

// ── State ──────────────────────────────────────────────────────────────────

let server: http.Server | null = null;
let mainWindow: BrowserWindow | null = null;
let authToken = '';
let serverPort = 0;
let enabled = false;
let requestCount = 0;

/** Per-terminal selection text, synced from renderer on selection change */
const terminalSelections = new Map<string, string>();

/** SSE clients — kept alive for event broadcasting */
const sseClients = new Set<http.ServerResponse>();

/** Pending renderer requests (main→renderer request-response bridge) */
const pendingRequests = new Map<string, {
  resolve: (data: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
}>();

// ── Service discovery ──────────────────────────────────────────────────────

const API_CONFIG_DIR = path.join(os.homedir(), '.subframe');
const API_CONFIG_PATH = path.join(API_CONFIG_DIR, 'api.json');

// DTSP (Desktop Text Source Protocol) — generic discovery for text-source consumers like Conjure
const DTSP_DIR = path.join(os.homedir(), '.dtsp', 'sources');
const DTSP_PATH = path.join(DTSP_DIR, 'subframe.json');

function writeServiceConfig(): void {
  const appVersion = require('../../package.json').version;
  const config = { port: serverPort, token: authToken, pid: process.pid, version: appVersion };

  // SubFrame-specific discovery
  try {
    if (!fs.existsSync(API_CONFIG_DIR)) fs.mkdirSync(API_CONFIG_DIR, { recursive: true });
    fs.writeFileSync(API_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
  } catch (err) {
    console.error('[API Server] Failed to write service config:', err);
  }

  // DTSP source registration
  try {
    if (!fs.existsSync(DTSP_DIR)) fs.mkdirSync(DTSP_DIR, { recursive: true });
    fs.writeFileSync(DTSP_PATH, JSON.stringify({
      name: 'SubFrame',
      port: serverPort,
      token: authToken,
      pid: process.pid,
      version: '1.0',
      capabilities: ['selection', 'context', 'buffer', 'events'],
    }, null, 2), 'utf8');
  } catch { /* DTSP dir may not exist yet — non-critical */ }
}

function removeServiceConfig(): void {
  try { if (fs.existsSync(API_CONFIG_PATH)) fs.unlinkSync(API_CONFIG_PATH); } catch { /* ignore */ }
  try { if (fs.existsSync(DTSP_PATH)) fs.unlinkSync(DTSP_PATH); } catch { /* ignore */ }
}

// ── Auth ───────────────────────────────────────────────────────────────────

function authenticate(req: http.IncomingMessage): boolean {
  // Check Authorization: Bearer <token>
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7) === authToken;
  }
  // Check ?token=<token> query parameter
  const url = new URL(req.url || '/', `http://localhost:${serverPort}`);
  return url.searchParams.get('token') === authToken;
}

// ── Renderer bridge (main→renderer request-response) ───────────────────────

function requestFromRenderer(channel: string, data?: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      reject(new Error('No main window'));
      return;
    }
    const requestId = crypto.randomUUID();
    const timer = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error('Renderer response timeout'));
    }, 3000);

    pendingRequests.set(requestId, { resolve, timer });
    mainWindow.webContents.send(channel, { requestId, ...((data as object) ?? {}) });
  });
}

// ── Route handling ─────────────────────────────────────────────────────────

function sendJSON(res: http.ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(data));
}

function sendError(res: http.ServerResponse, status: number, message: string): void {
  sendJSON(res, status, { error: message });
}

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  requestCount++;
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization',
    });
    res.end();
    return;
  }

  // Auth check (except /api/health which is public for service discovery)
  const url = new URL(req.url || '/', `http://localhost:${serverPort}`);
  const pathname = url.pathname;

  if (pathname !== '/api/health' && !authenticate(req)) {
    sendError(res, 401, 'Unauthorized — pass token via Authorization: Bearer <token> or ?token=<token>');
    return;
  }

  try {
    // ── GET /api/health — public, for service discovery ──
    if (pathname === '/api/health') {
      sendJSON(res, 200, { status: 'ok', name: 'SubFrame', version: require('../../package.json').version });
      return;
    }

    // ── GET /api/terminals — list all terminals ──
    if (pathname === '/api/terminals') {
      const data = await requestFromRenderer(IPC.API_GET_TERMINALS) as unknown[];
      sendJSON(res, 200, { terminals: data });
      return;
    }

    // ── GET /api/terminals/:id/selection — current selection text ──
    const selMatch = pathname.match(/^\/api\/terminals\/([^/]+)\/selection$/);
    if (selMatch) {
      const terminalId = decodeURIComponent(selMatch[1]);
      const text = terminalSelections.get(terminalId) ?? '';
      sendJSON(res, 200, { terminalId, text, hasSelection: text.length > 0 });
      return;
    }

    // ── GET /api/terminals/:id/buffer — visible buffer content ──
    const bufMatch = pathname.match(/^\/api\/terminals\/([^/]+)\/buffer$/);
    if (bufMatch) {
      const terminalId = decodeURIComponent(bufMatch[1]);
      const data = await requestFromRenderer(IPC.API_GET_BUFFER, { terminalId });
      sendJSON(res, 200, data);
      return;
    }

    // ── GET /api/selection — active terminal's selection (convenience) ──
    if (pathname === '/api/selection') {
      const data = await requestFromRenderer(IPC.API_GET_ACTIVE_SELECTION) as { terminalId: string; text: string };
      sendJSON(res, 200, { ...data, hasSelection: (data?.text?.length ?? 0) > 0 });
      return;
    }

    // ── GET /api/context — active terminal context ──
    if (pathname === '/api/context') {
      const data = await requestFromRenderer(IPC.API_GET_CONTEXT);
      sendJSON(res, 200, data);
      return;
    }

    // ── GET /api/events — SSE event stream ──
    if (pathname === '/api/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });
      res.write('event: connected\ndata: {}\n\n');
      sseClients.add(res);
      req.on('close', () => sseClients.delete(res));
      return; // Keep connection open
    }

    sendError(res, 404, 'Unknown endpoint');
  } catch (err) {
    sendError(res, 500, (err as Error).message);
  }
}

// ── SSE broadcasting ───────────────────────────────────────────────────────

/** Broadcast an event to all connected SSE clients */
export function broadcastEvent(eventType: string, data: unknown): void {
  if (sseClients.size === 0) return;
  const safeName = eventType.replace(/[\r\n]/g, '');
  const payload = `event: ${safeName}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try { client.write(payload); } catch { sseClients.delete(client); }
  }
}

// ── Server start/stop ─────────────────────────────────────────────────────

function startServer(): void {
  if (server) return; // Already running
  authToken = authToken || crypto.randomBytes(24).toString('hex');

  server = http.createServer((req, res) => {
    handleRequest(req, res).catch((err) => {
      sendError(res, 500, (err as Error).message);
    });
  });

  server.listen(0, '127.0.0.1', () => {
    const addr = server!.address();
    serverPort = typeof addr === 'object' && addr ? addr.port : 0;
    console.log(`[API Server] Listening on http://127.0.0.1:${serverPort}`);
    writeServiceConfig();
  });

  server.on('error', (err) => {
    console.error('[API Server] Server error:', err);
  });
}

function stopServer(): void {
  for (const [id, req] of pendingRequests) {
    clearTimeout(req.timer);
    pendingRequests.delete(id);
  }
  for (const client of sseClients) {
    try { client.end(); } catch { /* ignore */ }
  }
  sseClients.clear();
  if (server) {
    server.close();
    server = null;
  }
  serverPort = 0;
  removeServiceConfig();
}

// ── Lifecycle ──────────────────────────────────────────────────────────────

function init(window: BrowserWindow): void {
  mainWindow = window;

  // Clean up stale api.json from a previous crash (pid no longer running)
  try {
    const raw = fs.readFileSync(API_CONFIG_PATH, 'utf8');
    const existing = JSON.parse(raw) as { pid?: number };
    if (existing.pid) {
      try { process.kill(existing.pid, 0); } catch { removeServiceConfig(); }
    }
  } catch { /* no existing file or parse error — ok */ }

  // Check if API server is enabled in settings
  try {
    const settingsManager = require('./settingsManager');
    enabled = settingsManager.getSetting('integrations.apiServer') !== false;
  } catch {
    enabled = true; // Default: enabled
  }

  if (!enabled) {
    console.log('[API Server] Disabled via settings');
    return;
  }

  startServer();
}

function setupIPC(ipcMain: IpcMain): void {
  // Renderer syncs terminal selection changes
  ipcMain.on(IPC.API_SELECTION_SYNC, (_event, data: { terminalId: string; text: string }) => {
    terminalSelections.set(data.terminalId, data.text);
    broadcastEvent('selection-changed', data);
  });

  // Renderer responds to main→renderer requests
  ipcMain.on(IPC.API_RENDERER_RESPONSE, (_event, data: { requestId: string; payload: unknown }) => {
    const pending = pendingRequests.get(data.requestId);
    if (pending) {
      clearTimeout(pending.timer);
      pendingRequests.delete(data.requestId);
      pending.resolve(data.payload);
    }
  });

  // IPC handler to get current server info
  ipcMain.handle(IPC.API_SERVER_INFO, () => {
    return {
      enabled,
      port: serverPort,
      token: authToken,
      connectedClients: sseClients.size,
      totalRequests: requestCount,
    };
  });

  // Toggle API server on/off
  ipcMain.handle(IPC.API_SERVER_TOGGLE, (_event, enable: boolean) => {
    if (enable && !server) {
      enabled = true;
      startServer();
      try {
        const settingsManager = require('./settingsManager');
        settingsManager.updateSetting('integrations.apiServer', true);
      } catch { /* ignore */ }
    } else if (!enable && server) {
      enabled = false;
      stopServer();
      try {
        const settingsManager = require('./settingsManager');
        settingsManager.updateSetting('integrations.apiServer', false);
      } catch { /* ignore */ }
    }
    return { enabled, port: serverPort, token: authToken };
  });

  // Regenerate auth token
  ipcMain.handle(IPC.API_SERVER_REGEN_TOKEN, () => {
    authToken = crypto.randomBytes(24).toString('hex');
    if (server) writeServiceConfig(); // Update api.json with new token
    return { token: authToken };
  });
}

function shutdown(): void {
  stopServer();
}

export { init, setupIPC, shutdown, startServer, stopServer };
