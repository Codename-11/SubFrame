/**
 * Session Snapshot Manager
 * Serializes and restores terminal sessions across app restarts (e.g. hot updates).
 *
 * On quit/update: captures each active terminal's CWD, shell, dimensions, scrollback,
 * AI agent state, and project association. Saves to userData/session-snapshot.json.
 *
 * On startup: reads snapshot, recreates terminals, replays scrollback, and optionally
 * resumes AI agents (respecting user settings: auto/prompt/never).
 */

import * as fs from 'fs';
import * as path from 'path';
import type { App, BrowserWindow, IpcMain } from 'electron';
import { ipcMain } from 'electron';
import { IPC } from '../shared/ipcChannels';
import { broadcast } from './eventBridge';
import { getSetting } from './settingsManager';
import * as ptyManager from './ptyManager';
import type { RoutableIPC } from './ipcRouter';

// ── Types ──────────────────────────────────────────────────────────────────

/** Serialized state for a single terminal session */
export interface TerminalSnapshot {
  terminalId: string;
  cwd: string;
  shell: string;
  projectPath: string | null;
  scrollback: string;
  claudeActive: boolean;
  aiTool: string | null;
  aiFlags: string | null;
  env: Record<string, string>;
  cols: number;
  rows: number;
}

/** Top-level snapshot file structure */
export interface SessionSnapshot {
  version: 1;
  timestamp: string;
  reason: 'update' | 'quit' | 'manual';
  terminals: TerminalSnapshot[];
}

/** Restore result sent to renderer */
export interface SessionRestoreStatus {
  restored: number;
  total: number;
  terminals: Array<{
    oldId: string;
    newId: string;
    cwd: string;
    projectPath: string | null;
    scrollbackReplayed: boolean;
    agentResumed: boolean;
  }>;
  reason: string | null;
}

// ── State ──────────────────────────────────────────────────────────────────

let snapshotPath: string | null = null;
let mainWindow: BrowserWindow | null = null;
/** Flag: set to true when snapshot was taken for an update (detected on next launch) */
let wasUpdateRestart = false;
/** Track whether restore has already run this session */
let restoreCompleted = false;

// ── Allowlisted env vars — only these are serialized for security ──────────

const ENV_ALLOWLIST = [
  'PATH', 'Path',
  'NODE_ENV',
  'HOME', 'USERPROFILE',
  'SHELL',
  'TERM',
  'LANG',
  'EDITOR',
  'VISUAL',
  'GOPATH',
  'GOROOT',
  'JAVA_HOME',
  'PYTHON',
  'VIRTUAL_ENV',
  'NVM_DIR',
  'CONDA_PREFIX',
];

// ── Helpers ────────────────────────────────────────────────────────────────

function pickEnvVars(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of ENV_ALLOWLIST) {
    const val = process.env[key];
    if (val !== undefined) {
      result[key] = val;
    }
  }
  return result;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Initialize the snapshot manager.
 * Must be called after settingsManager and ptyManager are initialized.
 */
function init(window: BrowserWindow, app: App): void {
  mainWindow = window;
  snapshotPath = path.join(app.getPath('userData'), 'session-snapshot.json');
  console.log(`[session-snapshot] Path: ${snapshotPath}`);
}

/**
 * Take a snapshot of all active terminals.
 * @param reason Why the snapshot is being taken
 * @returns The snapshot object (also written to disk)
 */
function saveSnapshot(reason: 'update' | 'quit' | 'manual' = 'manual'): SessionSnapshot {
  const terminalIds = ptyManager.getTerminalIds();
  const terminals: TerminalSnapshot[] = [];
  const envVars = pickEnvVars();

  for (const terminalId of terminalIds) {
    const info = ptyManager.getTerminalInfo(terminalId);
    if (!info) continue;

    const backlog = ptyManager.getTerminalBacklog(terminalId);
    const claudeActive = ptyManager.isClaudeActive(terminalId);

    terminals.push({
      terminalId,
      cwd: info.cwd,
      shell: info.shell,
      projectPath: info.projectPath,
      scrollback: backlog,
      claudeActive,
      aiTool: null,     // Populated by caller if known
      aiFlags: null,     // Populated by caller if known
      env: envVars,
      cols: info.cols,
      rows: info.rows,
    });
  }

  const snapshot: SessionSnapshot = {
    version: 1,
    timestamp: new Date().toISOString(),
    reason,
    terminals,
  };

  // Write to disk (atomic: write tmp file, then rename)
  if (snapshotPath) {
    try {
      const tmpPath = snapshotPath + '.tmp';
      fs.writeFileSync(tmpPath, JSON.stringify(snapshot, null, 2), 'utf-8');
      fs.renameSync(tmpPath, snapshotPath);
      console.log(`[session-snapshot] Saved ${terminals.length} terminal(s) — reason: ${reason}`);
    } catch (err) {
      console.error('[session-snapshot] Failed to save snapshot:', err);
    }
  }

  return snapshot;
}

/**
 * Read a snapshot from disk (if it exists).
 * Does NOT delete the file — call clearSnapshot() after successful restore.
 */
function readSnapshot(): SessionSnapshot | null {
  if (!snapshotPath || !fs.existsSync(snapshotPath)) return null;

  try {
    const raw = fs.readFileSync(snapshotPath, 'utf-8');
    const parsed = JSON.parse(raw) as SessionSnapshot;

    // Basic validation
    if (parsed.version !== 1 || !Array.isArray(parsed.terminals)) {
      console.warn('[session-snapshot] Invalid snapshot format — ignoring');
      return null;
    }

    return parsed;
  } catch (err) {
    console.error('[session-snapshot] Failed to read snapshot:', err);
    // Delete corrupted/malformed snapshot to prevent repeated failures
    try { fs.unlinkSync(snapshotPath!); } catch { /* ignore */ }
    return null;
  }
}

/**
 * Delete the snapshot file after successful restore.
 */
function clearSnapshot(): void {
  if (snapshotPath && fs.existsSync(snapshotPath)) {
    try {
      fs.unlinkSync(snapshotPath);
      console.log('[session-snapshot] Snapshot file cleaned up');
    } catch (err) {
      console.error('[session-snapshot] Failed to clear snapshot:', err);
    }
  }
}

/**
 * Restore terminals from a snapshot.
 * Respects user settings: restoreOnStartup, restoreScrollback, autoResumeAgent.
 *
 * @returns Restore result with details of each terminal
 */
function restoreFromSnapshot(): SessionRestoreStatus | null {
  if (restoreCompleted) return null;

  const restoreOnStartup = getSetting('terminal.restoreOnStartup') as boolean ?? true;
  if (!restoreOnStartup) {
    console.log('[session-snapshot] Restore disabled by settings — skipping');
    clearSnapshot();
    restoreCompleted = true;
    return null;
  }

  const snapshot = readSnapshot();
  if (!snapshot || snapshot.terminals.length === 0) {
    restoreCompleted = true;
    return null;
  }

  const restoreScrollback = getSetting('terminal.restoreScrollback') as boolean ?? false;
  const autoResumeAgent = (getSetting('terminal.autoResumeAgent') as string) ?? 'prompt';

  wasUpdateRestart = snapshot.reason === 'update';
  const result: SessionRestoreStatus = {
    restored: 0,
    total: snapshot.terminals.length,
    terminals: [],
    reason: snapshot.reason,
  };

  for (const snap of snapshot.terminals) {
    try {
      // Verify CWD still exists
      const cwd = fs.existsSync(snap.cwd) ? snap.cwd : (process.env.HOME || process.env.USERPROFILE || '');

      // Create a new terminal with the saved configuration
      const newId = ptyManager.createTerminal(
        cwd,
        snap.projectPath,
        snap.shell,
        snap.cols,
        snap.rows,
      );

      const terminalResult = {
        oldId: snap.terminalId,
        newId,
        cwd,
        projectPath: snap.projectPath,
        scrollbackReplayed: false,
        agentResumed: false,
      };

      // Replay scrollback if enabled and data exists
      if (restoreScrollback && snap.scrollback && snap.scrollback.length > 0) {
        // Inject scrollback as synthetic terminal output so xterm renders it
        // Use a small delay to ensure the renderer has attached the terminal
        setTimeout(() => {
          if (ptyManager.hasTerminal(newId)) {
            ptyManager.injectTerminalOutput(newId, snap.scrollback);
          }
        }, 500);
        terminalResult.scrollbackReplayed = true;
      }

      // Auto-resume AI agent if it was active
      if (snap.claudeActive && autoResumeAgent === 'auto') {
        // Wait for shell to be ready before launching agent
        // Use SHELL_READY signal if available, else fallback to delay
        const resumeAgent = () => {
          if (!ptyManager.hasTerminal(newId)) return;
          // Claude Code supports --continue to resume previous session
          // Other tools (codex, gemini) don't have resume — just relaunch
          const cmd = snap.aiTool === 'codex' ? 'codex'
            : snap.aiTool === 'gemini' ? 'gemini'
            : 'claude --continue';
          ptyManager.writeToTerminal(newId, cmd + '\n');
          terminalResult.agentResumed = true;
        };
        setTimeout(resumeAgent, 2000);
      }

      result.terminals.push(terminalResult);
      result.restored++;
    } catch (err) {
      console.error(`[session-snapshot] Failed to restore terminal ${snap.terminalId}:`, err);
    }
  }

  // Clear the snapshot file after restore
  clearSnapshot();
  restoreCompleted = true;

  console.log(`[session-snapshot] Restored ${result.restored}/${result.total} terminal(s)`);

  // Broadcast restore status to renderer
  if (mainWindow && !mainWindow.isDestroyed()) {
    broadcast(IPC.SESSION_SNAPSHOT_STATUS, result);
  }

  return result;
}

/**
 * Whether this session was started after an update (snapshot reason was 'update').
 */
function isUpdateRestart(): boolean {
  return wasUpdateRestart;
}

/**
 * Whether a pending snapshot exists (check before restore).
 */
function hasPendingSnapshot(): boolean {
  return snapshotPath !== null && fs.existsSync(snapshotPath);
}

/**
 * Setup IPC handlers for session snapshot.
 */
function setupIPC(ipc: RoutableIPC | IpcMain = ipcMain): void {
  // Manual snapshot trigger
  ipc.handle(IPC.SESSION_SNAPSHOT_SAVE, () => {
    const snapshot = saveSnapshot('manual');
    return { success: true, terminalCount: snapshot.terminals.length };
  });

  // Manual restore trigger
  ipc.handle(IPC.SESSION_SNAPSHOT_RESTORE, () => {
    const result = restoreFromSnapshot();
    return result ?? { restored: 0, total: 0, terminals: [], reason: null };
  });
}

export {
  init,
  setupIPC,
  saveSnapshot,
  readSnapshot,
  clearSnapshot,
  restoreFromSnapshot,
  isUpdateRestart,
  hasPendingSnapshot,
};
