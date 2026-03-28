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
import { routeInvoke, routeSend, hasInvokeHandler, hasSendHandler, isWSEvent } from './ipcRouter';
import { addBridgeListener } from './eventBridge';
import { IPC, type WebRemotePointerState, type WebSessionState } from '../shared/ipcChannels';
import type { ClientMessage, ServerMessage } from '../shared/wsProtocol';
import { WS_ERRORS } from '../shared/wsProtocol';

// ── State ──────────────────────────────────────────────────────────────────

let httpServer: http.Server | null = null;
let wss: WebSocketServer | null = null;
let authToken = '';
let serverPort = 0;
let enabled = false;
let startOnLaunch = false;
let lanMode = false;
let configuredPort = 0;
let removeBridgeListener: (() => void) | null = null;
let liveSessionState: Pick<WebSessionState, 'currentProjectPath' | 'session' | 'ui'> | null = null;
let lastStartError: string | null = null;

// ── Session Control ─────────────────────────────────────────────────────────
const sessionControl = {
  controller: 'electron' as 'electron' | 'web' | null,
  controlRequestPending: false,
  controlRequestFrom: null as 'electron' | 'web' | null,
  lastElectronActivity: Date.now(),
  lastWebActivity: 0,
  idleTimeoutMs: 30_000,
};

function getSessionControlState(): import('../shared/ipcChannels').SessionControlState {
  return {
    controller: sessionControl.controller,
    webClientConnected: !!activeSession,
    webClientDevice: activeSession ? buildDeviceLabel(activeSession.userAgent) : null,
    controlRequestPending: sessionControl.controlRequestPending,
    controlRequestFrom: sessionControl.controlRequestFrom,
    lastElectronActivity: sessionControl.lastElectronActivity,
    lastWebActivity: sessionControl.lastWebActivity,
    idleTimeoutMs: sessionControl.idleTimeoutMs,
  };
}

let controlStateBroadcastTimer: ReturnType<typeof setTimeout> | null = null;
function broadcastControlState(): void {
  // Debounce to prevent rapid-fire broadcasts (e.g. take + activity timestamp in quick succession)
  if (controlStateBroadcastTimer) clearTimeout(controlStateBroadcastTimer);
  controlStateBroadcastTimer = setTimeout(() => {
    controlStateBroadcastTimer = null;
    const state = getSessionControlState();
    console.log(`[Session Control] Broadcasting: controller=${state.controller}, webConnected=${state.webClientConnected}`);
    broadcastIPC(IPC.SESSION_CONTROL_STATE, state);
  }, 50);
}

function buildDeviceLabel(userAgent: string): string {
  if (/android/i.test(userAgent)) return 'Android';
  if (/iphone/i.test(userAgent)) return 'iPhone';
  if (/ipad/i.test(userAgent)) return 'iPad';
  if (/macintosh/i.test(userAgent)) return 'Mac';
  if (/windows/i.test(userAgent)) return 'Windows';
  if (/linux/i.test(userAgent)) return 'Linux';
  return 'Remote';
}

// ── Network Utilities ──────────────────────────────────────────────────────

function isPrivateIpv4(address: string): boolean {
  return (
    address.startsWith('10.') ||
    address.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(address)
  );
}

/** Return external IPv4 addresses, preferring RFC1918 LAN addresses first. */
function getLanIps(): string[] {
  const interfaces = os.networkInterfaces();
  const addresses = new Set<string>();

  for (const ifaces of Object.values(interfaces)) {
    for (const iface of ifaces ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.add(iface.address);
      }
    }
  }

  return [...addresses].sort((a, b) => {
    const aPrivate = isPrivateIpv4(a);
    const bPrivate = isPrivateIpv4(b);
    if (aPrivate !== bPrivate) return aPrivate ? -1 : 1;
    return a.localeCompare(b);
  });
}

function getLanIp(): string | null {
  return getLanIps()[0] ?? null;
}

function normalizePort(value: unknown): number {
  const numeric = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(numeric) || Number.isNaN(numeric)) return 0;
  if (numeric < 0) return 0;
  if (numeric > 65535) return 65535;
  return numeric;
}

function getStoredLastPort(): number {
  try {
    const settingsManager = require('./settingsManager');
    return normalizePort(settingsManager.getSetting('server.lastPort'));
  } catch {
    return 0;
  }
}

function persistLastPort(port: number): void {
  try {
    const settingsManager = require('./settingsManager');
    settingsManager.updateSetting('server.lastPort', port);
  } catch {
    // ignore
  }
}

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

// Per-connection rate limiting
const MAX_MESSAGE_SIZE = 1_000_000; // 1MB
const MAX_MESSAGES_PER_SECOND = 100;
const rateLimitCounters = new WeakMap<WebSocket, number>();
let rateLimitResetTimer: ReturnType<typeof setInterval> | null = null;

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

function getRemoteCursorEnabled(): boolean {
  try {
    const settingsManager = require('./settingsManager') as typeof import('./settingsManager');
    return settingsManager.getSetting('server.showRemoteCursor') === true;
  } catch {
    return false;
  }
}

function buildRemotePointerLabel(userAgent: string): string {
  const lower = userAgent.toLowerCase();
  if (lower.includes('android')) return 'Remote Android';
  if (lower.includes('iphone') || lower.includes('ipad') || lower.includes('ios')) return 'Remote iPhone';
  if (lower.includes('mobile')) return 'Remote Mobile';
  if (lower.includes('tablet')) return 'Remote Tablet';
  return 'Remote Web';
}

function clearRemotePointer(): void {
  broadcastIPC(IPC.WEB_REMOTE_POINTER_CLEARED, undefined);
}

function getSessionContext(): { workspaceName: string; projectPath: string | null; projectName: string | null } {
  const workspace = require('./workspace') as typeof import('./workspace');
  const workspaceData = workspace.getProjectsWithScanned();
  const sessionProjectPath = liveSessionState?.currentProjectPath
    ?? workspaceData.projects.find((project: { source?: string }) => project.source !== 'scanned')?.path
    ?? workspaceData.projects[0]?.path
    ?? null;
  const sessionProject = workspaceData.projects.find((project) => project.path === sessionProjectPath) ?? null;

  return {
    workspaceName: workspaceData.workspaceName,
    projectPath: sessionProjectPath,
    projectName: sessionProject?.name ?? null,
  };
}

function getWebBootstrapPayload(): {
  workspaceName: string;
  projectName: string | null;
  appearance: {
    activeThemeId: string;
    customThemes: unknown[];
    enableNeonTraces?: boolean;
    enableScanlines?: boolean;
    enableLogoGlow?: boolean;
  };
} {
  const settingsManager = require('./settingsManager') as typeof import('./settingsManager');
  const appearance = (settingsManager.getSetting('appearance') as Record<string, unknown> | undefined) ?? {};
  const sessionContext = getSessionContext();

  return {
    workspaceName: sessionContext.workspaceName,
    projectName: sessionContext.projectName,
    appearance: {
      activeThemeId: typeof appearance.activeThemeId === 'string' ? appearance.activeThemeId : 'classic-amber',
      customThemes: Array.isArray(appearance.customThemes) ? appearance.customThemes : [],
      enableNeonTraces: typeof appearance.enableNeonTraces === 'boolean' ? appearance.enableNeonTraces : undefined,
      enableScanlines: typeof appearance.enableScanlines === 'boolean' ? appearance.enableScanlines : undefined,
      enableLogoGlow: typeof appearance.enableLogoGlow === 'boolean' ? appearance.enableLogoGlow : undefined,
    },
  };
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
    const relativeUrlPath = urlPath.replace(/^\/+/, '');
    const normalized = path.normalize(relativeUrlPath).replace(/^(\.\.[/\\])+/, '');
    if (relativeUrlPath.startsWith('dist/')) {
      filePath = path.join(distDir, normalized.replace(/^dist[/\\]/, ''));
    } else if (relativeUrlPath.startsWith('node_modules/') || relativeUrlPath.startsWith('assets/')) {
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

  if (!fs.existsSync(filePath)) {
    console.warn(`[Web Server] serveStatic miss: ${urlPath} → ${filePath} (not found)`);
    return false;
  }

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
  } catch (err) {
    console.warn(`[Web Server] serveStatic read error: ${urlPath} → ${filePath}:`, (err as Error).message);
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

  // WS health endpoint (public)
  if (pathname === '/api/ws-health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      wsConnections: wss?.clients.size ?? 0,
      activeSession: activeSession ? { userAgent: activeSession.userAgent, connectedAt: activeSession.connectedAt } : null,
      uptime: process.uptime(),
    }));
    return;
  }

  // Public bootstrap info for the unauthenticated access screen
  if (pathname === '/api/bootstrap') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
    res.end(JSON.stringify(getWebBootstrapPayload()));
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

  // Auth timeout — close if no successful auth within 5 seconds
  const authTimer = setTimeout(() => {
    if (!session) {
      ws.close(4000, 'Auth timeout');
    }
  }, 5000);

  // Initialize rate limit counter for this connection
  rateLimitCounters.set(ws, 0);

  ws.on('message', async (raw) => {
    // Message size check
    const rawStr = raw.toString();
    if (rawStr.length > MAX_MESSAGE_SIZE) {
      wsSend(ws, { type: 'error', id: '', code: WS_ERRORS.INVALID_MESSAGE, message: 'Message too large' });
      ws.close(4004, 'Message too large');
      return;
    }

    // Rate limiting — track messages per second
    const count = (rateLimitCounters.get(ws) ?? 0) + 1;
    rateLimitCounters.set(ws, count);
    if (count > MAX_MESSAGES_PER_SECOND) {
      wsSend(ws, { type: 'error', id: '', code: WS_ERRORS.INVALID_MESSAGE, message: 'Rate limit exceeded' });
      ws.close(4005, 'Rate limit exceeded');
      return;
    }

    let msg: ClientMessage;
    try {
      msg = JSON.parse(rawStr) as ClientMessage;
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

      // Stale session cleanup — if existing session's WS is not open, clear it
      if (activeSession && activeSession.ws.readyState !== WebSocket.OPEN) {
        activeSession = null;
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
      clearTimeout(authTimer);
      session = createSession(ws, userAgent);
      activeSession = session;
      wsSend(ws, { type: 'auth-ok', sessionId: session.id });
      broadcastIPC(IPC.WEB_CLIENT_CONNECTED, { userAgent, connectedAt: session.connectedAt });
      // Reset control: Electron has control by default
      sessionControl.controller = 'electron';
      sessionControl.controlRequestPending = false;
      sessionControl.controlRequestFrom = null;
      sessionControl.lastWebActivity = 0;
      broadcastControlState();
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
        clearTimeout(authTimer);
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
          const sendToRequester = (replyChannel: string, payload?: unknown) => {
            wsSend(ws, { type: 'event', channel: replyChannel, payload });
          };
          const reply = (replyChannel: string, payload?: unknown) => {
            sendToRequester(replyChannel, payload);
            if (replyChannel === IPC.TERMINAL_CREATED) {
              broadcastIPC(replyChannel, payload);
            }
          };
          routeSend(msg.channel, msg.payload !== undefined ? [msg.payload] : [], {
            sendToSender: sendToRequester,
            reply,
          });
          // Track web-side terminal input activity
          if (msg.channel === IPC.TERMINAL_INPUT_ID) {
            sessionControl.lastWebActivity = Date.now();
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
    clearTimeout(authTimer);
    if (activeSession && activeSession.ws === ws) {
      activeSession = null;
      clearRemotePointer();
      broadcastIPC(IPC.WEB_CLIENT_DISCONNECTED, undefined);
      // Reset control: Electron regains control
      sessionControl.controller = 'electron';
      sessionControl.controlRequestPending = false;
      sessionControl.controlRequestFrom = null;
      broadcastControlState();
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

  // Notification-worthy events — sent regardless of channel subscription
  const notification = buildNotification(channel, data);
  if (notification) {
    wsSend(activeSession.ws, notification);
  }

  if (!activeSession.subscribedChannels.has(channel)) return;

  // Terminal output batching — merge rapid chunks into ~16ms frames
  if (channel === IPC.TERMINAL_OUTPUT_ID && typeof data === 'object' && data !== null) {
    const payload = data as { terminalId: string; data: string };
    batchTerminalOutput(payload.terminalId, payload.data);
    return;
  }

  wsSend(activeSession.ws, { type: 'event', channel, payload: data });
}

/** Build a push notification for notable events, or null if not notification-worthy. */
function buildNotification(channel: string, data: unknown): ServerMessage | null {
  if (!data || typeof data !== 'object') return null;

  if (channel === IPC.PIPELINE_RUN_UPDATED) {
    const run = data as { status?: string; workflowId?: string };
    if (run.status === 'completed') return { type: 'notification', title: 'Pipeline Complete', body: `Workflow ${run.workflowId || 'run'} finished successfully.` };
    if (run.status === 'failed') return { type: 'notification', title: 'Pipeline Failed', body: `Workflow ${run.workflowId || 'run'} failed.`, tag: 'pipeline-error' };
    if (run.status === 'paused') return { type: 'notification', title: 'Approval Needed', body: `Workflow ${run.workflowId || 'run'} is waiting for approval.`, tag: 'pipeline-approval' };
  }

  if (channel === IPC.ACTIVITY_STATUS) {
    const event = data as { stream?: { status?: string; name?: string } };
    if (event.stream?.status === 'completed') return { type: 'notification', title: 'Task Complete', body: `${event.stream.name || 'Activity'} finished.` };
    if (event.stream?.status === 'failed') return { type: 'notification', title: 'Task Failed', body: `${event.stream.name || 'Activity'} failed.`, tag: 'activity-error' };
  }

  return null;
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
  lastStartError = null;

  httpServer = http.createServer((req, res) => {
    try {
      handleHTTP(req, res);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
  });

  // WS upgrade path filtering — only accept connections on /ws
  wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url || '/', `http://localhost`).pathname;
    if (pathname === '/ws') {
      wss!.handleUpgrade(request, socket, head, (ws) => {
        wss!.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', handleWsConnection);

  const bindAddress = lanMode ? '0.0.0.0' : '127.0.0.1';
  const lastPort = getStoredLastPort();
  const desiredPort = configuredPort > 0 ? configuredPort : lastPort;
  const allowFallback = configuredPort === 0 && desiredPort > 0;

  const listen = (portToTry: number, fallbackReason?: string) => {
    const handleListening = () => {
      cleanupStartupListeners();
      const addr = httpServer!.address();
      serverPort = typeof addr === 'object' && addr ? addr.port : 0;
      const displayAddr = lanMode ? `0.0.0.0 (LAN)` : '127.0.0.1';
      if (fallbackReason) {
        console.warn(`[Web Server] ${fallbackReason}`);
      }
      console.log(`[Web Server] Listening on http://${displayAddr}:${serverPort}`);
      persistLastPort(serverPort);
      lastStartError = null;
      writeServiceConfig();
    };

    const handleStartupError = (err: NodeJS.ErrnoException) => {
      cleanupStartupListeners();
      if (allowFallback && portToTry !== 0 && (err.code === 'EADDRINUSE' || err.code === 'EACCES')) {
        listen(0, `Preferred auto port ${portToTry} unavailable, falling back to an open port.`);
        return;
      }

      const portLabel = portToTry > 0 ? `port ${portToTry}` : 'an available port';
      lastStartError = `Failed to bind ${portLabel}: ${err.code || err.message}`;
      console.error('[Web Server] Failed to start:', err);
      stopServer();
    };

    const cleanupStartupListeners = () => {
      httpServer?.off('listening', handleListening);
      httpServer?.off('error', handleStartupError);
    };

    httpServer!.once('listening', handleListening);
    httpServer!.once('error', handleStartupError);
    httpServer!.listen(portToTry, bindAddress);
  };

  listen(desiredPort);

  httpServer.on('error', (err) => {
    if (httpServer?.listening) {
      console.error('[Web Server] Server error:', err);
    }
  });

  // Rate limit counter reset — clear counters every second
  rateLimitResetTimer = setInterval(() => {
    if (wss) {
      for (const client of wss.clients) {
        rateLimitCounters.set(client, 0);
      }
    }
  }, 1000);

  // Subscribe to event bridge for WS forwarding
  removeBridgeListener = addBridgeListener(onBridgeEvent);
}

function stopServer(): void {
  // Flush pending batches
  if (batchTimer) { clearTimeout(batchTimer); batchTimer = null; }
  terminalBatches.clear();

  // Stop rate limit reset timer
  if (rateLimitResetTimer) { clearInterval(rateLimitResetTimer); rateLimitResetTimer = null; }

  // Graceful shutdown — send close frames to all connected WS clients
  if (wss) {
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.close(1001, 'Server shutting down');
      }
    }
  }
  activeSession = null;
  pendingTakeoverWs = null;
  clearRemotePointer();

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
    startOnLaunch = settingsManager.getSetting('server.startOnLaunch') === true;
    enabled = startOnLaunch;
    configuredPort = normalizePort(settingsManager.getSetting('server.port'));
    batchIntervalMs = settingsManager.getSetting('server.terminalBatchIntervalMs') ?? 16;
    lanMode = settingsManager.getSetting('server.lanMode') === true;
  } catch {
    enabled = false;
    startOnLaunch = false;
    configuredPort = 0;
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
          else if (!enable) {
            enabled = false;
            lastStartError = null;
            if (httpServer) stopServer();
          }
        } else if (key === 'server.startOnLaunch') {
          startOnLaunch = value === true;
        } else if (key === 'server.port') {
          const nextPort = normalizePort(value);
          if (nextPort !== configuredPort) {
            configuredPort = nextPort;
            if (enabled) {
              if (httpServer) stopServer();
              startServer();
            }
          }
        } else if (key === 'server.terminalBatchIntervalMs') {
          batchIntervalMs = (value as number) ?? 16;
        } else if (key === 'server.lanMode') {
          const newLanMode = value === true;
          if (newLanMode !== lanMode) {
            lanMode = newLanMode;
            // Restart server so it rebinds to the correct address
            if (enabled) {
              if (httpServer) stopServer();
              startServer();
            }
          }
        } else if (key === 'server.showRemoteCursor' && value !== true) {
          clearRemotePointer();
        }
      });
    }
  } catch { /* settingsManager not available */ }

  // IPC: get server info
  router.handle(IPC.WEB_SERVER_INFO, () => {
    const sessionContext = getSessionContext();

    return {
      enabled,
      startOnLaunch,
      port: serverPort,
      token: authToken,
      configuredPort,
      lanMode,
      lanIp: lanMode ? getLanIp() : null,
      lanIps: lanMode ? getLanIps() : [],
      clientConnected: !!activeSession,
      clientInfo: activeSession ? {
        userAgent: activeSession.userAgent,
        connectedAt: activeSession.connectedAt,
      } : null,
      sessionContext,
      lastStartError,
    };
  });

  // ── Session Control ────────────────────────────────────────────────────
  router.handle(IPC.SESSION_CONTROL_STATE, () => getSessionControlState());

  router.on(IPC.SESSION_CONTROL_REQUEST, (_event: unknown) => {
    const requester: 'electron' | 'web' = isWSEvent(_event) ? 'web' : 'electron';
    if (sessionControl.controller === requester) return;

    const lastActivity = sessionControl.controller === 'electron'
      ? sessionControl.lastElectronActivity
      : sessionControl.lastWebActivity;
    const idle = Date.now() - lastActivity > sessionControl.idleTimeoutMs;

    if (idle || sessionControl.controller === null) {
      sessionControl.controller = requester;
      sessionControl.controlRequestPending = false;
      sessionControl.controlRequestFrom = null;
    } else {
      sessionControl.controlRequestPending = true;
      sessionControl.controlRequestFrom = requester;
    }
    broadcastControlState();
  });

  router.on(IPC.SESSION_CONTROL_GRANT, (_event: unknown) => {
    if (!sessionControl.controlRequestPending || !sessionControl.controlRequestFrom) return;
    const granter: 'electron' | 'web' = isWSEvent(_event) ? 'web' : 'electron';
    if (sessionControl.controller !== granter) return;

    sessionControl.controller = sessionControl.controlRequestFrom;
    sessionControl.controlRequestPending = false;
    sessionControl.controlRequestFrom = null;
    broadcastControlState();
  });

  router.on(IPC.SESSION_CONTROL_TAKE, (_event: unknown) => {
    const wsRouted = isWSEvent(_event);
    const taker: 'electron' | 'web' = wsRouted ? 'web' : 'electron';
    console.log(`[Session Control] TAKE — isWSEvent=${wsRouted}, taker=${taker}, event type=${typeof _event}, event keys=${_event ? Object.keys(_event as object).join(',') : 'null'}`);
    sessionControl.controller = taker;
    sessionControl.controlRequestPending = false;
    sessionControl.controlRequestFrom = null;
    broadcastControlState();
  });

  router.on(IPC.SESSION_CONTROL_RELEASE, (_event: unknown) => {
    const releaser: 'electron' | 'web' = isWSEvent(_event) ? 'web' : 'electron';
    if (sessionControl.controller === releaser) {
      sessionControl.controller = null;
      sessionControl.controlRequestPending = false;
      sessionControl.controlRequestFrom = null;
      broadcastControlState();
    }
  });

  // Track Electron terminal input activity
  router.on(IPC.TERMINAL_INPUT_ID, (_event: unknown) => {
    if (!isWSEvent(_event)) {
      sessionControl.lastElectronActivity = Date.now();
    }
  });

  // ── Web Session ────────────────────────────────────────────────────────
  router.handle(IPC.WEB_SESSION_STATE, async () => {
    const workspace = require('./workspace') as typeof import('./workspace');
    const workspaceData = workspace.getProjectsWithScanned();
    const terminalState = await routeInvoke(IPC.GET_TERMINAL_STATE, []) as {
      terminals: WebSessionState['terminals'];
    };

    const fallbackProjectPath =
      liveSessionState?.currentProjectPath
      ?? terminalState.terminals.find((terminal) => terminal.projectPath)?.projectPath
      ?? workspaceData.projects.find((project: { source?: string }) => project.source !== 'scanned')?.path
      ?? workspaceData.projects[0]?.path
      ?? null;

    return {
      currentProjectPath: fallbackProjectPath,
      workspaceName: workspaceData.workspaceName,
      projects: workspaceData.projects,
      session: liveSessionState?.session ?? null,
      ui: liveSessionState?.ui ?? null,
      terminals: terminalState.terminals,
    } satisfies WebSessionState;
  });

  router.on(IPC.WEB_SESSION_SYNC, (_event, payload) => {
    if (!payload || typeof payload !== 'object') return;
    const data = payload as {
      origin?: 'electron' | 'web';
      currentProjectPath?: string | null;
      session?: WebSessionState['session'];
      ui?: WebSessionState['ui'];
    };
    const nextState = liveSessionState ?? {
      currentProjectPath: null,
      session: null,
      ui: null,
    };

    if ('currentProjectPath' in data) {
      nextState.currentProjectPath = data.currentProjectPath ?? null;
    }
    if ('session' in data) {
      nextState.session = data.session ?? null;
    }
    if ('ui' in data) {
      nextState.ui = data.ui ?? null;
    }

    liveSessionState = nextState;
    // Preserve origin so receivers can filter (e.g. Electron ignores electron-origin syncs)
    broadcastIPC(IPC.WEB_SESSION_SYNC, { ...liveSessionState, origin: data.origin });
  });

  router.on(IPC.WEB_REMOTE_POINTER_SYNC, (_event, payload) => {
    if (!getRemoteCursorEnabled()) return;
    if (!payload || typeof payload !== 'object' || !activeSession) return;

    const data = payload as {
      normalizedX?: number;
      normalizedY?: number;
      pointerType?: 'mouse' | 'touch' | 'pen';
      phase?: 'move' | 'down' | 'up' | 'leave';
      viewportWidth?: number;
      viewportHeight?: number;
      timestamp?: number;
    };

    if (data.phase === 'leave') {
      clearRemotePointer();
      return;
    }

    const normalizedX = typeof data.normalizedX === 'number' ? Math.max(0, Math.min(1, data.normalizedX)) : null;
    const normalizedY = typeof data.normalizedY === 'number' ? Math.max(0, Math.min(1, data.normalizedY)) : null;
    if (normalizedX === null || normalizedY === null) return;

    const event: WebRemotePointerState = {
      normalizedX,
      normalizedY,
      pointerType: data.pointerType ?? 'mouse',
      phase: data.phase ?? 'move',
      viewportWidth: Math.max(1, Math.round(data.viewportWidth ?? 1)),
      viewportHeight: Math.max(1, Math.round(data.viewportHeight ?? 1)),
      label: buildRemotePointerLabel(activeSession.userAgent),
      timestamp: typeof data.timestamp === 'number' ? data.timestamp : Date.now(),
    };

    broadcastIPC(IPC.WEB_REMOTE_POINTER_UPDATED, event);
  });

  // IPC: toggle server
  router.handle(IPC.WEB_SERVER_TOGGLE, (_event: IpcMainInvokeEvent | null, enable: boolean) => {
    if (enable && !httpServer) {
      enabled = true;
      startServer();
    } else if (!enable && httpServer) {
      enabled = false;
      stopServer();
    } else if (!enable) {
      enabled = false;
      lastStartError = null;
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
