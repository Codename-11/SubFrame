/**
 * Agent State Manager Module
 * Watches .subframe/agent-state.json for changes and broadcasts
 * real-time agent state updates to the renderer via IPC.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { BrowserWindow, IpcMain } from 'electron';
import { IPC } from '../shared/ipcChannels';
import type { AgentStatePayload } from '../shared/agentStateTypes';

const AGENT_STATE_FILE = 'agent-state.json';
const SUBFRAME_DIR = '.subframe';
const DEBOUNCE_MS = 200;

let mainWindow: BrowserWindow | null = null;
let stateWatcher: fs.FSWatcher | null = null;
let watchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastUpdatedTimestamp: string | null = null; // Dedup: skip sending unchanged data
let lastUserMessageTimestamp: string | null = null; // Track user message signals

/**
 * Initialize agent state manager
 */
function init(window: BrowserWindow): void {
  mainWindow = window;
}

/**
 * Build an empty agent state payload for a project
 */
function emptyState(projectPath: string): AgentStatePayload {
  return {
    projectPath,
    sessions: [],
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Load and parse .subframe/agent-state.json.
 * Returns empty state if the file is missing or malformed.
 */
function loadAgentState(projectPath: string): AgentStatePayload {
  const filePath = path.join(projectPath, SUBFRAME_DIR, AGENT_STATE_FILE);

  try {
    if (!fs.existsSync(filePath)) {
      return emptyState(projectPath);
    }

    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw) as AgentStatePayload;

    // Ensure projectPath is set correctly
    data.projectPath = projectPath;

    return data;
  } catch {
    return emptyState(projectPath);
  }
}

/**
 * Start watching the .subframe/ directory for agent-state.json changes.
 */
function watchAgentState(projectPath: string): void {
  unwatchAgentState();

  const dirPath = path.join(projectPath, SUBFRAME_DIR);

  // If the .subframe/ directory doesn't exist yet, nothing to watch
  if (!fs.existsSync(dirPath)) return;

  try {
    stateWatcher = fs.watch(dirPath, (_eventType, filename) => {
      // filename can be null on Linux/macOS — fall through and let dedup handle it
      if (filename !== null && filename !== AGENT_STATE_FILE) return;

      // Debounce — 200ms for near-real-time visualization
      if (watchDebounceTimer) clearTimeout(watchDebounceTimer);
      watchDebounceTimer = setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          const state = loadAgentState(projectPath);

          // Deduplicate: only send if data actually changed
          if (state.lastUpdated && state.lastUpdated === lastUpdatedTimestamp) return;
          lastUpdatedTimestamp = state.lastUpdated;

          mainWindow.webContents.send(IPC.AGENT_STATE_DATA, state);

          // Emit dedicated user message signal when a new one is detected
          if (state.lastUserMessage?.timestamp &&
              state.lastUserMessage.timestamp !== lastUserMessageTimestamp) {
            lastUserMessageTimestamp = state.lastUserMessage.timestamp;
            mainWindow.webContents.send(IPC.USER_MESSAGE_SIGNAL, {
              terminalId: state.lastUserMessage.terminalId,
              timestamp: state.lastUserMessage.timestamp,
              promptPreview: state.lastUserMessage.promptPreview,
            });
          }
        }
      }, DEBOUNCE_MS);
    });
    stateWatcher.on('error', (err) => {
      console.warn('[AgentState] Watcher error (path may have been deleted):', (err as NodeJS.ErrnoException).code);
      unwatchAgentState();
    });
  } catch (err) {
    console.error('Error watching agent state directory:', err);
  }
}

/**
 * Stop watching agent state
 */
function unwatchAgentState(): void {
  if (watchDebounceTimer) clearTimeout(watchDebounceTimer);
  watchDebounceTimer = null;
  if (stateWatcher) {
    stateWatcher.close();
    stateWatcher = null;
  }
  lastUpdatedTimestamp = null;
  lastUserMessageTimestamp = null;
}

/**
 * Setup IPC handlers
 */
function setupIPC(ipc: IpcMain): void {
  ipc.on(IPC.LOAD_AGENT_STATE, (_event, projectPath: string) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const state = loadAgentState(projectPath);
      lastUpdatedTimestamp = state.lastUpdated; // Keep dedup in sync
      mainWindow.webContents.send(IPC.AGENT_STATE_DATA, state);
    }
  });

  ipc.on(IPC.WATCH_AGENT_STATE, (_event, projectPath: string) => {
    watchAgentState(projectPath);
  });

  ipc.on(IPC.UNWATCH_AGENT_STATE, () => {
    unwatchAgentState();
  });
}

export { init, loadAgentState, watchAgentState, unwatchAgentState, setupIPC };
