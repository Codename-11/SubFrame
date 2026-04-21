/**
 * Agent State Manager Module
 * Watches .subframe/agent-state.json for changes and broadcasts
 * real-time agent state updates to the renderer via IPC.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { BrowserWindow, IpcMain } from 'electron';
import { IPC } from '../shared/ipcChannels';
import type { AgentStatePayload, TerminalStatusEntry } from '../shared/agentStateTypes';
import { broadcast } from './eventBridge';
import { log as outputLog } from './outputChannelManager';

const AGENT_STATE_FILE = 'agent-state.json';
const SUBFRAME_DIR = '.subframe';
const DEBOUNCE_MS = 200;

let mainWindow: BrowserWindow | null = null;
let stateWatcher: fs.FSWatcher | null = null;
let watchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastUpdatedTimestamp: string | null = null; // Dedup: skip sending unchanged data
let lastUserMessageTimestamp: string | null = null; // Track user message signals
/** Per-terminal last-forwarded status entry — dedup before calling ptyManager.setTerminalStatus */
const lastForwardedTerminalStatus = new Map<string, number>();

/**
 * Forward the terminalStatus map from agent-state.json into ptyManager.
 * Called on every debounced file-watch tick. Lazy-required to avoid the
 * agentStateManager ↔ ptyManager import cycle.
 */
function forwardTerminalStatus(status: Record<string, TerminalStatusEntry> | undefined): void {
  if (!status) return;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ptyManager = require('./ptyManager') as typeof import('./ptyManager');
  if (typeof ptyManager.setTerminalStatus !== 'function') return;
  for (const [terminalId, entry] of Object.entries(status)) {
    if (!entry || typeof entry.status !== 'string') continue;
    const lastTs = lastForwardedTerminalStatus.get(terminalId) ?? 0;
    if (entry.lastUpdated && entry.lastUpdated <= lastTs) continue;
    lastForwardedTerminalStatus.set(terminalId, entry.lastUpdated ?? Date.now());
    try {
      ptyManager.setTerminalStatus(terminalId, entry.status, entry.message);
    } catch (err) {
      outputLog('agent', `setTerminalStatus failed for ${terminalId}: ${(err as Error).message}`);
    }
  }
}

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

          // Mirror hook-written terminalStatus into ptyManager → IPC broadcast.
          forwardTerminalStatus(state.terminalStatus);

          broadcast(IPC.AGENT_STATE_DATA, state);

          // Emit dedicated user message signal when a new one is detected
          if (state.lastUserMessage?.timestamp &&
              state.lastUserMessage.timestamp !== lastUserMessageTimestamp) {
            lastUserMessageTimestamp = state.lastUserMessage.timestamp;
            broadcast(IPC.USER_MESSAGE_SIGNAL, {
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
      outputLog('agent', `Agent state watcher error: ${(err as NodeJS.ErrnoException).code}`);
      unwatchAgentState();
    });
  } catch (err) {
    console.error('Error watching agent state directory:', err);
    outputLog('agent', `Failed to watch agent state: ${(err as Error).message}`);
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
  lastForwardedTerminalStatus.clear();
}

/**
 * Setup IPC handlers
 */
function setupIPC(ipc: IpcMain): void {
  ipc.on(IPC.LOAD_AGENT_STATE, (_event, projectPath: string) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const state = loadAgentState(projectPath);
      lastUpdatedTimestamp = state.lastUpdated; // Keep dedup in sync
      forwardTerminalStatus(state.terminalStatus);
      broadcast(IPC.AGENT_STATE_DATA, state);
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
