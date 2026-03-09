/**
 * Claude Usage Manager Module
 * Fetches Claude Code usage data from OAuth API and provides periodic updates.
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
import { getSetting, onSettingChange } from './settingsManager';

interface UsageWindow {
  utilization: number;
  resetsAt: string | null;
}

interface UsageData {
  fiveHour: UsageWindow | null;
  sevenDay: UsageWindow | null;
  lastUpdated: string;
  error: string | null;
  persistentFailure?: boolean;
}

interface CredentialsData {
  claudeAiOauth?: { accessToken?: string };
  accessToken?: string;
}

/** Base polling interval when backoff is not active (from settings) */
const BASE_BACKOFF_MS = 30_000;
/** Maximum backoff cap: 8 minutes */
const MAX_BACKOFF_MS = 480_000;
/** After this many consecutive failures, flag persistentFailure to the UI */
const PERSISTENT_FAILURE_THRESHOLD = 5;

let mainWindow: BrowserWindow | null = null;
let pollingTimeout: ReturnType<typeof setTimeout> | null = null;
let initialFetchTimeout: ReturnType<typeof setTimeout> | null = null;
let cachedUsage: UsageData | null = null;

/** Exponential backoff state */
let consecutiveFailures = 0;
let currentBackoffMs = 0;

/**
 * Read the configured polling interval from settings (in seconds).
 * Returns 0 when polling is disabled, otherwise clamped to 30–600.
 */
function getPollingMs(): number {
  const raw = getSetting('general.usagePollingInterval');
  const seconds = typeof raw === 'number' ? raw : 0;
  if (seconds === 0) return 0; // Disabled
  const clamped = Math.max(30, Math.min(600, seconds));
  return clamped * 1000;
}

/**
 * Initialize the module with window reference
 */
function init(window: BrowserWindow): void {
  mainWindow = window;

  // Always fetch once on startup regardless of polling setting
  initialFetchTimeout = setTimeout(() => {
    initialFetchTimeout = null;
    sendUsageToRenderer();
  }, 2000);

  // Start periodic polling only if enabled
  const intervalMs = getPollingMs();
  if (intervalMs > 0) {
    scheduleNextPoll(intervalMs);
  }

  // React to setting changes
  onSettingChange((key) => {
    if (key === 'general.usagePollingInterval') {
      resetBackoff();
      restartPolling();
    }
  });
}

/**
 * Extract access token from a parsed credentials object
 */
function extractToken(credentials: CredentialsData): string | null {
  if (credentials.claudeAiOauth?.accessToken) {
    return credentials.claudeAiOauth.accessToken;
  }
  if (credentials.accessToken) {
    return credentials.accessToken;
  }
  return null;
}

/**
 * Read OAuth token from the Claude credentials file (~/.claude/.credentials.json)
 */
function getTokenFromCredentialsFile(): string | null {
  try {
    const credPath = path.join(os.homedir(), '.claude', '.credentials.json');
    if (!fs.existsSync(credPath)) return null;

    const raw = fs.readFileSync(credPath, 'utf8');
    const credentials: CredentialsData = JSON.parse(raw);
    return extractToken(credentials);
  } catch (err) {
    console.log('Claude usage: Could not read credentials file:', (err as Error).message);
    return null;
  }
}

/**
 * Read OAuth token from macOS Keychain
 */
function getTokenFromKeychain(): string | null {
  try {
    const result = execSync(
      'security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null',
      { encoding: 'utf8', timeout: 5000 }
    ).trim();

    if (!result) return null;

    const credentials: CredentialsData = JSON.parse(result);
    return extractToken(credentials);
  } catch (err) {
    console.log('Claude usage: Could not get token from Keychain:', (err as Error).message);
    return null;
  }
}

/**
 * Get OAuth token using platform-appropriate method
 */
function getOAuthToken(): string | null {
  let token: string | null = null;

  if (process.platform === 'darwin') {
    // macOS: try Keychain first, fall back to credentials file
    token = getTokenFromKeychain();
    if (!token) {
      token = getTokenFromCredentialsFile();
    }
  } else {
    // Windows and Linux: read from credentials file
    token = getTokenFromCredentialsFile();
  }

  // Final fallback: environment variable
  if (!token && process.env.ANTHROPIC_API_KEY) {
    token = process.env.ANTHROPIC_API_KEY;
  }

  if (!token) {
    console.log('Claude usage: No OAuth token found on platform:', process.platform);
  }

  return token;
}

/**
 * Fetch usage data from Claude OAuth API
 */
function fetchUsage(): Promise<UsageData> {
  return new Promise((resolve) => {
    const token = getOAuthToken();

    if (!token) {
      resolve({
        error: 'No OAuth token found',
        fiveHour: null,
        sevenDay: null,
        lastUpdated: new Date().toISOString()
      });
      return;
    }

    const options: https.RequestOptions = {
      hostname: 'api.anthropic.com',
      path: '/api/oauth/usage',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'anthropic-beta': 'oauth-2025-04-20',
        'Content-Type': 'application/json'
      },
      timeout: 10000
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk: Buffer) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const usage = JSON.parse(data) as {
              five_hour?: { utilization?: number; resets_at?: string };
              seven_day?: { utilization?: number; resets_at?: string };
            };
            const result: UsageData = {
              fiveHour: {
                utilization: usage.five_hour?.utilization || 0,
                resetsAt: usage.five_hour?.resets_at || null
              },
              sevenDay: {
                utilization: usage.seven_day?.utilization || 0,
                resetsAt: usage.seven_day?.resets_at || null
              },
              lastUpdated: new Date().toISOString(),
              error: null
            };
            cachedUsage = result;
            resolve(result);
          } else if (res.statusCode === 401) {
            resolve({
              error: 'Token expired or invalid',
              fiveHour: cachedUsage?.fiveHour || null,
              sevenDay: cachedUsage?.sevenDay || null,
              lastUpdated: cachedUsage?.lastUpdated || new Date().toISOString()
            });
          } else {
            resolve({
              error: `API error: ${res.statusCode}`,
              fiveHour: cachedUsage?.fiveHour || null,
              sevenDay: cachedUsage?.sevenDay || null,
              lastUpdated: cachedUsage?.lastUpdated || new Date().toISOString()
            });
          }
        } catch (_parseErr) {
          resolve({
            error: 'Failed to parse response',
            fiveHour: cachedUsage?.fiveHour || null,
            sevenDay: cachedUsage?.sevenDay || null,
            lastUpdated: cachedUsage?.lastUpdated || new Date().toISOString()
          });
        }
      });
    });

    req.on('error', (err: Error) => {
      resolve({
        error: `Network error: ${err.message}`,
        fiveHour: cachedUsage?.fiveHour || null,
        sevenDay: cachedUsage?.sevenDay || null,
        lastUpdated: cachedUsage?.lastUpdated || new Date().toISOString()
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        error: 'Request timeout',
        fiveHour: cachedUsage?.fiveHour || null,
        sevenDay: cachedUsage?.sevenDay || null,
        lastUpdated: cachedUsage?.lastUpdated || new Date().toISOString()
      });
    });

    req.end();
  });
}

/**
 * Reset exponential backoff state (on success or setting change)
 */
function resetBackoff(): void {
  consecutiveFailures = 0;
  currentBackoffMs = 0;
}

/**
 * Compute next backoff delay: doubles from base up to MAX_BACKOFF_MS
 */
function computeBackoff(baseMs: number): number {
  if (consecutiveFailures === 0) return baseMs;
  const backoff = Math.min(baseMs * Math.pow(2, consecutiveFailures), MAX_BACKOFF_MS);
  return backoff;
}

/**
 * Send usage data to renderer. Tracks consecutive failures for backoff.
 */
async function sendUsageToRenderer(): Promise<void> {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const usage = await fetchUsage();

  if (usage.error) {
    consecutiveFailures++;
    console.log(`Claude usage: fetch failed (${consecutiveFailures} consecutive): ${usage.error}`);

    // Flag persistent failure after threshold
    if (consecutiveFailures >= PERSISTENT_FAILURE_THRESHOLD) {
      usage.persistentFailure = true;
    }
  } else {
    resetBackoff();
  }

  mainWindow.webContents.send(IPC.CLAUDE_USAGE_DATA, usage);
}

/**
 * Schedule the next polling fetch with backoff-aware delay.
 * Uses setTimeout (not setInterval) so each cycle can adjust its delay.
 */
function scheduleNextPoll(baseMs: number): void {
  if (pollingTimeout) {
    clearTimeout(pollingTimeout);
    pollingTimeout = null;
  }

  const delay = computeBackoff(baseMs);
  currentBackoffMs = delay;

  pollingTimeout = setTimeout(async () => {
    pollingTimeout = null;
    await sendUsageToRenderer();

    // Continue polling only if still enabled
    const intervalMs = getPollingMs();
    if (intervalMs > 0) {
      scheduleNextPoll(intervalMs);
    }
  }, delay);
}

/**
 * Start periodic polling for usage updates (only when enabled).
 * Uses setTimeout chains with exponential backoff instead of fixed setInterval.
 */
function startPolling(): void {
  stopPolling();

  const intervalMs = getPollingMs();
  if (intervalMs === 0) return; // Polling disabled

  scheduleNextPoll(intervalMs);
}

/**
 * Stop polling
 */
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

/**
 * Restart polling (called when the setting changes)
 */
function restartPolling(): void {
  stopPolling();

  const intervalMs = getPollingMs();
  if (intervalMs > 0) {
    // Fetch immediately on re-enable, then schedule
    sendUsageToRenderer();
    scheduleNextPoll(intervalMs);
  }
}

/**
 * Setup IPC handlers
 */
function setupIPC(ipcMain: IpcMain): void {
  // Handle initial load request
  ipcMain.on(IPC.LOAD_CLAUDE_USAGE, async (event) => {
    const usage = await fetchUsage();
    event.sender.send(IPC.CLAUDE_USAGE_DATA, usage);
  });

  // Handle manual refresh — always works regardless of polling setting
  ipcMain.on(IPC.REFRESH_CLAUDE_USAGE, async (event) => {
    resetBackoff(); // Manual refresh clears backoff state
    const usage = await fetchUsage();
    if (!usage.error) {
      resetBackoff();
    }
    event.sender.send(IPC.CLAUDE_USAGE_DATA, usage);
  });
}

/**
 * Cleanup on app quit
 */
function cleanup(): void {
  stopPolling();
  mainWindow = null;
}

export { init, setupIPC, cleanup, fetchUsage, startPolling, stopPolling, restartPolling };
