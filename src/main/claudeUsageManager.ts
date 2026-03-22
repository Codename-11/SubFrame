/**
 * Claude Usage Manager — Hybrid 4-Layer Approach
 *
 * Layers (tried in order, first success wins):
 *   1. Local cache  — reads $TEMP/claude-statusline-usage-cache.json (written by Claude's statusline)
 *   2. OAuth API    — HTTPS GET api.anthropic.com/api/oauth/usage (with token refresh on 401)
 *   3. Credentials  — subscriptionType + rateLimitTier from ~/.claude/.credentials.json (always available)
 *   4. Fallback     — cached in-memory data from a previous successful fetch
 *
 * Polling is OFF by default (usagePollingInterval = 0). When enabled, uses
 * exponential backoff on consecutive failures and notifies the renderer to
 * suggest disabling polling after persistent errors.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as https from 'https';
import type { BrowserWindow, IpcMain } from 'electron';
import { IPC } from '../shared/ipcChannels';
import type { ClaudeUsageData, UsageWindow, ExtraUsageInfo, UsageSource } from '../shared/ipcChannels';
import { getSetting, onSettingChange } from './settingsManager';

// ── Raw API / cache response shape ──────────────────────────────────────────

interface RawUsageWindow {
  utilization?: number;
  resets_at?: string;
}

interface RawUsageResponse {
  five_hour?: RawUsageWindow;
  seven_day?: RawUsageWindow;
  seven_day_sonnet?: RawUsageWindow;
  seven_day_opus?: RawUsageWindow;
  seven_day_oauth_apps?: RawUsageWindow;
  seven_day_cowork?: RawUsageWindow;
  extra_usage?: {
    is_enabled?: boolean;
    monthly_limit?: number | null;
    used_credits?: number | null;
    utilization?: number | null;
  };
}

interface CredentialsData {
  claudeAiOauth?: {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    subscriptionType?: string;
    rateLimitTier?: string;
  };
  accessToken?: string;
}

// ── Constants ───────────────────────────────────────────────────────────────

/** Maximum backoff cap: 8 minutes */
const MAX_BACKOFF_MS = 480_000;
/** After this many consecutive failures, flag persistentFailure to the UI */
const PERSISTENT_FAILURE_THRESHOLD = 5;
/** Local cache considered fresh if younger than this (seconds) */
const LOCAL_CACHE_MAX_AGE_S = 120;
/** Path to Claude's statusline usage cache */
const LOCAL_CACHE_FILENAME = 'claude-statusline-usage-cache.json';

// ── Module state ────────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null;
let pollingTimeout: ReturnType<typeof setTimeout> | null = null;
let initialFetchTimeout: ReturnType<typeof setTimeout> | null = null;
let cachedUsage: ClaudeUsageData | null = null;
let consecutiveFailures = 0;

// ── Settings helpers ────────────────────────────────────────────────────────

function getPollingMs(): number {
  const raw = getSetting('general.usagePollingInterval');
  const seconds = typeof raw === 'number' ? raw : 0;
  if (seconds === 0) return 0;
  return Math.max(30, Math.min(600, seconds)) * 1000;
}

// ── Layer 3: Credentials metadata (always available) ────────────────────────

function readCredentials(): CredentialsData | null {
  try {
    const credPath = path.join(os.homedir(), '.claude', '.credentials.json');
    if (!fs.existsSync(credPath)) return null;
    return JSON.parse(fs.readFileSync(credPath, 'utf8')) as CredentialsData;
  } catch {
    return null;
  }
}

function getCredentialsMeta(): { subscriptionType: string | null; rateLimitTier: string | null } {
  const creds = readCredentials();
  return {
    subscriptionType: creds?.claudeAiOauth?.subscriptionType ?? null,
    rateLimitTier: creds?.claudeAiOauth?.rateLimitTier ?? null,
  };
}

// ── Token retrieval ─────────────────────────────────────────────────────────

function extractToken(credentials: CredentialsData): string | null {
  return credentials.claudeAiOauth?.accessToken || credentials.accessToken || null;
}

function getTokenFromCredentialsFile(): string | null {
  try {
    const creds = readCredentials();
    return creds ? extractToken(creds) : null;
  } catch (err) {
    console.log('Claude usage: Could not read credentials file:', (err as Error).message);
    return null;
  }
}

function getTokenFromKeychain(): string | null {
  try {
    const result = execSync(
      'security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null',
      { encoding: 'utf8', timeout: 5000 }
    ).trim();
    if (!result) return null;
    return extractToken(JSON.parse(result) as CredentialsData);
  } catch {
    return null;
  }
}

function getOAuthToken(): string | null {
  let token: string | null = null;

  if (process.platform === 'darwin') {
    token = getTokenFromKeychain();
    if (!token) token = getTokenFromCredentialsFile();
  } else {
    token = getTokenFromCredentialsFile();
  }

  if (!token && process.env.ANTHROPIC_API_KEY) {
    token = process.env.ANTHROPIC_API_KEY;
  }

  return token;
}

// ── Token refresh ───────────────────────────────────────────────────────────

function getRefreshToken(): string | null {
  const creds = readCredentials();
  return creds?.claudeAiOauth?.refreshToken ?? null;
}

function isTokenExpired(): boolean {
  const creds = readCredentials();
  const expiresAt = creds?.claudeAiOauth?.expiresAt;
  if (!expiresAt) return false;
  // Consider expired if within 5 minutes of expiry
  return Date.now() > expiresAt - 300_000;
}

/**
 * Attempt to refresh the OAuth access token.
 * Best-effort — returns new token on success, null on failure.
 */
function refreshAccessToken(): Promise<string | null> {
  return new Promise((resolve) => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      resolve(null);
      return;
    }

    const postData = JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    const options: https.RequestOptions = {
      hostname: 'api.anthropic.com',
      path: '/api/oauth/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'anthropic-beta': 'oauth-2025-04-20',
      },
      timeout: 10000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => { data += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const result = JSON.parse(data) as { access_token?: string; expires_at?: number; refresh_token?: string };
            if (result.access_token) {
              // Write updated credentials back to disk
              persistRefreshedToken(result.access_token, result.expires_at, result.refresh_token);
              console.log('Claude usage: Token refreshed successfully');
              resolve(result.access_token);
              return;
            }
          }
          console.log(`Claude usage: Token refresh returned ${res.statusCode}`);
          resolve(null);
        } catch {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end(postData);
  });
}

/**
 * Write refreshed token back to the credentials file so Claude Code picks it up too.
 */
function persistRefreshedToken(accessToken: string, expiresAt?: number, refreshToken?: string): void {
  try {
    const credPath = path.join(os.homedir(), '.claude', '.credentials.json');
    const raw = fs.readFileSync(credPath, 'utf8');
    const creds = JSON.parse(raw) as Record<string, unknown>;

    if (creds.claudeAiOauth && typeof creds.claudeAiOauth === 'object') {
      const oauth = creds.claudeAiOauth as Record<string, unknown>;
      oauth.accessToken = accessToken;
      if (expiresAt) oauth.expiresAt = expiresAt;
      if (refreshToken) oauth.refreshToken = refreshToken;
    }

    fs.writeFileSync(credPath, JSON.stringify(creds, null, 2), 'utf8');
  } catch (err) {
    console.log('Claude usage: Could not persist refreshed token:', (err as Error).message);
  }
}

// ── Raw response → normalized UsageWindow ───────────────────────────────────

function parseWindow(raw: RawUsageWindow | undefined | null): UsageWindow | null {
  if (!raw || raw.utilization === undefined || raw.utilization === null) return null;
  return { utilization: raw.utilization, resetsAt: raw.resets_at ?? null };
}

function parseExtraUsage(raw: RawUsageResponse['extra_usage']): ExtraUsageInfo | null {
  if (!raw) return null;
  return {
    isEnabled: raw.is_enabled ?? false,
    monthlyLimit: raw.monthly_limit ?? null,
    usedCredits: raw.used_credits ?? null,
    utilization: raw.utilization ?? null,
  };
}

function rawToUsageData(raw: RawUsageResponse, source: UsageSource, cacheAgeSeconds: number | null): ClaudeUsageData {
  const meta = getCredentialsMeta();
  return {
    fiveHour: parseWindow(raw.five_hour),
    sevenDay: parseWindow(raw.seven_day),
    sevenDaySonnet: parseWindow(raw.seven_day_sonnet),
    sevenDayOpus: parseWindow(raw.seven_day_opus),
    extraUsage: parseExtraUsage(raw.extra_usage),
    source,
    cacheAgeSeconds,
    subscriptionType: meta.subscriptionType,
    rateLimitTier: meta.rateLimitTier,
    lastUpdated: new Date().toISOString(),
    error: null,
  };
}

// ── Layer 1: Local cache ────────────────────────────────────────────────────

function readLocalCache(): ClaudeUsageData | null {
  try {
    const cachePath = path.join(os.tmpdir(), LOCAL_CACHE_FILENAME);
    if (!fs.existsSync(cachePath)) return null;

    const stat = fs.statSync(cachePath);
    const ageSeconds = (Date.now() - stat.mtimeMs) / 1000;

    if (ageSeconds > LOCAL_CACHE_MAX_AGE_S) return null; // Stale

    const raw: RawUsageResponse = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    // Sanity check: must have at least five_hour or seven_day
    if (!raw.five_hour && !raw.seven_day) return null;

    return rawToUsageData(raw, 'local-cache', Math.round(ageSeconds));
  } catch {
    return null;
  }
}

// ── Layer 2: OAuth API ──────────────────────────────────────────────────────

function fetchFromApi(token: string): Promise<ClaudeUsageData | null> {
  return new Promise((resolve) => {
    const options: https.RequestOptions = {
      hostname: 'api.anthropic.com',
      path: '/api/oauth/usage',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'anthropic-beta': 'oauth-2025-04-20',
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => { data += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const raw: RawUsageResponse = JSON.parse(data);
            resolve(rawToUsageData(raw, 'api', null));
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end();
  });
}

// ── Orchestrator: tries all layers ──────────────────────────────────────────

async function getUsage(forceApi = false): Promise<ClaudeUsageData> {
  const meta = getCredentialsMeta();

  // Helper to build a credentials-only or error result
  function makeResult(error: string | null, source: UsageSource): ClaudeUsageData {
    return {
      fiveHour: cachedUsage?.fiveHour ?? null,
      sevenDay: cachedUsage?.sevenDay ?? null,
      sevenDaySonnet: cachedUsage?.sevenDaySonnet ?? null,
      sevenDayOpus: cachedUsage?.sevenDayOpus ?? null,
      extraUsage: cachedUsage?.extraUsage ?? null,
      source,
      cacheAgeSeconds: null,
      subscriptionType: meta.subscriptionType,
      rateLimitTier: meta.rateLimitTier,
      lastUpdated: cachedUsage?.lastUpdated ?? new Date().toISOString(),
      error,
    };
  }

  // Layer 1: Local cache (skip if force-refreshing)
  if (!forceApi) {
    const local = readLocalCache();
    if (local) {
      cachedUsage = local;
      return local;
    }
  }

  // Layer 2: OAuth API
  let token = getOAuthToken();

  if (!token) {
    // No token at all — return credentials-only (Layer 3)
    return makeResult('No OAuth token found', meta.subscriptionType ? 'credentials-only' : 'none');
  }

  // Pre-emptive refresh if token is about to expire
  if (isTokenExpired()) {
    console.log('Claude usage: Token near expiry, attempting refresh...');
    const newToken = await refreshAccessToken();
    if (newToken) token = newToken;
  }

  // Try API
  let result = await fetchFromApi(token);

  // If API failed, try token refresh (handles 401 indirectly — null result means non-200)
  if (!result) {
    const newToken = await refreshAccessToken();
    if (newToken && newToken !== token) {
      result = await fetchFromApi(newToken);
    }
  }

  if (result) {
    cachedUsage = result;
    return result;
  }

  // Layer 3/4: Credentials metadata + any in-memory cache
  if (cachedUsage && (cachedUsage.fiveHour || cachedUsage.sevenDay)) {
    return {
      ...cachedUsage,
      source: 'cached',
      error: null,
      subscriptionType: meta.subscriptionType,
      rateLimitTier: meta.rateLimitTier,
    };
  }

  return makeResult('Usage unavailable', meta.subscriptionType ? 'credentials-only' : 'none');
}

// ── Legacy compat wrapper (used by sendUsageToRenderer) ─────────────────────

async function fetchUsage(): Promise<ClaudeUsageData> {
  return getUsage(false);
}

// ── Backoff ─────────────────────────────────────────────────────────────────

function resetBackoff(): void {
  consecutiveFailures = 0;
}

function computeBackoff(baseMs: number): number {
  if (consecutiveFailures === 0) return baseMs;
  return Math.min(baseMs * Math.pow(2, consecutiveFailures), MAX_BACKOFF_MS);
}

// ── Renderer communication ──────────────────────────────────────────────────

async function sendUsageToRenderer(): Promise<void> {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const usage = await fetchUsage();

  if (usage.error) {
    consecutiveFailures++;
    console.log(`Claude usage: [${usage.source}] failed (${consecutiveFailures}×): ${usage.error}`);
    if (consecutiveFailures >= PERSISTENT_FAILURE_THRESHOLD) {
      usage.persistentFailure = true;
    }
  } else {
    resetBackoff();
  }

  mainWindow.webContents.send(IPC.CLAUDE_USAGE_DATA, usage);
}

// ── Polling ─────────────────────────────────────────────────────────────────

function scheduleNextPoll(baseMs: number): void {
  if (pollingTimeout) {
    clearTimeout(pollingTimeout);
    pollingTimeout = null;
  }

  const delay = computeBackoff(baseMs);

  pollingTimeout = setTimeout(async () => {
    pollingTimeout = null;
    await sendUsageToRenderer();

    const intervalMs = getPollingMs();
    if (intervalMs > 0) {
      scheduleNextPoll(intervalMs);
    }
  }, delay);
}

function startPolling(): void {
  stopPolling();
  const intervalMs = getPollingMs();
  if (intervalMs === 0) return;
  scheduleNextPoll(intervalMs);
}

function stopPolling(): void {
  if (initialFetchTimeout) {
    clearTimeout(initialFetchTimeout);
    initialFetchTimeout = null;
  }
  if (pollingTimeout) {
    clearTimeout(pollingTimeout);
    pollingTimeout = null;
  }
}

function restartPolling(): void {
  stopPolling();
  const intervalMs = getPollingMs();
  if (intervalMs > 0) {
    sendUsageToRenderer();
    scheduleNextPoll(intervalMs);
  }
}

// ── Init & IPC ──────────────────────────────────────────────────────────────

function init(window: BrowserWindow): void {
  mainWindow = window;

  // Always fetch once on startup (local cache makes this near-instant)
  initialFetchTimeout = setTimeout(() => {
    initialFetchTimeout = null;
    sendUsageToRenderer();
  }, 1000); // Reduced from 2s — local cache is fast

  const intervalMs = getPollingMs();
  if (intervalMs > 0) {
    scheduleNextPoll(intervalMs);
  }

  onSettingChange((key) => {
    if (key === 'general.usagePollingInterval') {
      resetBackoff();
      restartPolling();
    }
  });
}

function setupIPC(ipcMain: IpcMain): void {
  ipcMain.on(IPC.LOAD_CLAUDE_USAGE, async (event) => {
    const usage = await getUsage(false);
    event.sender.send(IPC.CLAUDE_USAGE_DATA, usage);
  });

  // Manual refresh bypasses local cache (forceApi=true)
  ipcMain.on(IPC.REFRESH_CLAUDE_USAGE, async (event) => {
    resetBackoff();
    const usage = await getUsage(true);
    if (!usage.error) resetBackoff();
    event.sender.send(IPC.CLAUDE_USAGE_DATA, usage);
  });
}

function cleanup(): void {
  stopPolling();
  mainWindow = null;
}

export { init, setupIPC, cleanup, fetchUsage, startPolling, stopPolling, restartPolling };
