/**
 * Claude Usage Manager Module
 * Fetches Claude Code usage data from OAuth API and provides periodic updates
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
}

interface CredentialsData {
  claudeAiOauth?: { accessToken?: string };
  accessToken?: string;
}

/** Default polling interval in seconds (5 minutes) */
const DEFAULT_POLLING_SECONDS = 300;

let mainWindow: BrowserWindow | null = null;
let pollingInterval: ReturnType<typeof setInterval> | null = null;
let initialFetchTimeout: ReturnType<typeof setTimeout> | null = null;
let cachedUsage: UsageData | null = null;

/**
 * Read the configured polling interval from settings (in seconds), clamped to 30–600.
 */
function getPollingMs(): number {
  const raw = getSetting('general.usagePollingInterval');
  const seconds = typeof raw === 'number' ? raw : DEFAULT_POLLING_SECONDS;
  const clamped = Math.max(30, Math.min(600, seconds));
  return clamped * 1000;
}

/**
 * Initialize the module with window reference
 */
function init(window: BrowserWindow): void {
  mainWindow = window;
  // Start polling when window is ready
  startPolling();

  // Restart polling when the interval setting changes
  onSettingChange((key) => {
    if (key === 'general.usagePollingInterval') {
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
 * Send usage data to renderer, with retry on transient errors (429, network)
 */
async function sendUsageToRenderer(retries = 2, delay = 5000): Promise<void> {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const usage = await fetchUsage();
  mainWindow.webContents.send(IPC.CLAUDE_USAGE_DATA, usage);

  // Retry on transient errors if we have no cached data yet
  if (usage.error && !cachedUsage && retries > 0) {
    setTimeout(() => sendUsageToRenderer(retries - 1, delay * 2), delay);
  }
}

/**
 * Start periodic polling for usage updates.
 * Reads interval from settings (general.usagePollingInterval).
 */
function startPolling(): void {
  // Stop any existing polling
  stopPolling();

  const intervalMs = getPollingMs();

  // Initial fetch after a short delay
  initialFetchTimeout = setTimeout(() => {
    initialFetchTimeout = null;
    sendUsageToRenderer();
  }, 2000);

  // Start periodic updates
  pollingInterval = setInterval(() => {
    sendUsageToRenderer();
  }, intervalMs);
}

/**
 * Stop polling
 */
function stopPolling(): void {
  if (initialFetchTimeout) {
    clearTimeout(initialFetchTimeout);
    initialFetchTimeout = null;
  }
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

/**
 * Restart polling (called when the setting changes)
 */
function restartPolling(): void {
  startPolling();
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

  // Handle manual refresh request
  ipcMain.on(IPC.REFRESH_CLAUDE_USAGE, async (event) => {
    const usage = await fetchUsage();
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
