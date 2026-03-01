/**
 * Claude Usage Manager Module
 * Fetches Claude Code usage data from OAuth API and provides periodic updates
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const { IPC } = require('../shared/ipcChannels');

let mainWindow = null;
let pollingInterval = null;
let cachedUsage = null;
let lastFetchTime = null;

/**
 * Initialize the module with window reference
 */
function init(window) {
  mainWindow = window;
  // Start polling when window is ready
  startPolling();
}

/**
 * Extract access token from a parsed credentials object
 * @param {Object} credentials - Parsed credentials JSON
 * @returns {string|null} Access token or null
 */
function extractToken(credentials) {
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
 * Used on Windows and Linux where macOS Keychain is unavailable
 * @returns {string|null} Access token or null if not found
 */
function getTokenFromCredentialsFile() {
  try {
    const credPath = path.join(os.homedir(), '.claude', '.credentials.json');
    if (!fs.existsSync(credPath)) return null;

    const raw = fs.readFileSync(credPath, 'utf8');
    const credentials = JSON.parse(raw);
    return extractToken(credentials);
  } catch (err) {
    console.log('Claude usage: Could not read credentials file:', err.message);
    return null;
  }
}

/**
 * Read OAuth token from macOS Keychain
 * @returns {string|null} Access token or null if not found
 */
function getTokenFromKeychain() {
  try {
    const result = execSync(
      'security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null',
      { encoding: 'utf8', timeout: 5000 }
    ).trim();

    if (!result) return null;

    const credentials = JSON.parse(result);
    return extractToken(credentials);
  } catch (err) {
    console.log('Claude usage: Could not get token from Keychain:', err.message);
    return null;
  }
}

/**
 * Get OAuth token using platform-appropriate method
 * - macOS: Keychain first, then credentials file fallback
 * - Windows/Linux: Credentials file (~/.claude/.credentials.json)
 * - All platforms: ANTHROPIC_API_KEY env var as final fallback
 * @returns {string|null} Access token or null if not found
 */
function getOAuthToken() {
  let token = null;

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
 * @returns {Promise<Object>} Usage data or error
 */
function fetchUsage() {
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

    const options = {
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

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const usage = JSON.parse(data);
            const result = {
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
            lastFetchTime = Date.now();
            resolve(result);
          } else if (res.statusCode === 401) {
            resolve({
              error: 'Token expired or invalid',
              fiveHour: null,
              sevenDay: null,
              lastUpdated: new Date().toISOString()
            });
          } else {
            resolve({
              error: `API error: ${res.statusCode}`,
              fiveHour: null,
              sevenDay: null,
              lastUpdated: new Date().toISOString()
            });
          }
        } catch (parseErr) {
          resolve({
            error: 'Failed to parse response',
            fiveHour: null,
            sevenDay: null,
            lastUpdated: new Date().toISOString()
          });
        }
      });
    });

    req.on('error', (err) => {
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
 * Send usage data to renderer
 */
async function sendUsageToRenderer() {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const usage = await fetchUsage();
  mainWindow.webContents.send(IPC.CLAUDE_USAGE_DATA, usage);
}

/**
 * Start periodic polling for usage updates
 * @param {number} interval - Polling interval in ms (default: 60000 = 1 minute)
 */
function startPolling(interval = 60000) {
  // Stop any existing polling
  stopPolling();

  // Initial fetch after a short delay
  setTimeout(() => {
    sendUsageToRenderer();
  }, 2000);

  // Start periodic updates
  pollingInterval = setInterval(() => {
    sendUsageToRenderer();
  }, interval);
}

/**
 * Stop polling
 */
function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

/**
 * Setup IPC handlers
 * @param {Electron.IpcMain} ipcMain
 */
function setupIPC(ipcMain) {
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
function cleanup() {
  stopPolling();
  mainWindow = null;
}

module.exports = {
  init,
  setupIPC,
  cleanup,
  fetchUsage,
  startPolling,
  stopPolling
};
