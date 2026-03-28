/**
 * PTY Manager Module
 * Manages multiple PTY instances for multi-terminal support
 */

import * as pty from 'node-pty';
import type { IPty } from 'node-pty';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import type { BrowserWindow, IpcMain, WebContents } from 'electron';
import { IPC } from '../shared/ipcChannels';
import * as promptLogger from './promptLogger';
import * as agentStateManager from './agentStateManager';
import { getSetting } from './settingsManager';
import { broadcast } from './eventBridge';

interface PTYInstance {
  pty: IPty;
  cwd: string;
  projectPath: string | null;
  claudeActive: boolean;
  shell: string;
  lastOutputTimestamp: number;
}

// ── Pop-out Window WebContents ────────────────────────────────────────────────
const popoutWebContents = new Map<string, WebContents>();

// ── OSC 7 Working Directory Detection ────────────────────────────────────────

/**
 * Parse OSC 7 escape sequence to extract the current working directory.
 * Many modern shells (bash, zsh, fish, PowerShell w/ starship) emit
 * `\x1b]7;file://hostname/path\x07` or `\x1b]7;file://hostname/path\x1b\\`
 * on every directory change.
 */
function parseOSC7(data: string): string | null {
  // Match OSC 7 with either BEL (\x07) or ST (\x1b\\) terminator
  // eslint-disable-next-line no-control-regex
  const match = data.match(/\x1b\]7;file:\/\/[^/]*([^\x07\x1b]+)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

// ── Claude Code Detection ────────────────────────────────────────────────────

/**
 * Lightweight detector for Claude Code TUI activity in a PTY.
 * Watches recent output for known patterns that indicate Claude Code is running.
 *
 * Detection uses a rolling buffer of recent output (last ~2KB) per terminal.
 * A terminal is marked active when patterns match and inactive after a
 * configurable timeout with no further matches.
 */

const CLAUDE_OUTPUT_BUFFERS = new Map<string, string>();
const CLAUDE_TIMEOUT_HANDLES = new Map<string, ReturnType<typeof setTimeout>>();
const CLAUDE_BUFFER_MAX = 2048;
const TERMINAL_BACKLOG_MAX_CHARS = 256 * 1024;

// ─── Output Capture ──────────────────────────────────────────────────────────
// Allows other main-process modules (e.g. onboardingManager) to accumulate
// raw PTY output for a specific terminal without piping.
const captureBuffers = new Map<string, string[]>();
const terminalBacklogs = new Map<string, string>();

// ─── Output Handlers ─────────────────────────────────────────────────────────
// Per-terminal callbacks for real-time output monitoring (e.g. trust prompt detection).
/** Per-terminal output handlers — supports multiple named handlers per terminal */
const outputHandlers = new Map<string, Map<string, (data: string) => void>>();
/** How long (ms) after the last Claude pattern match before marking inactive */
const CLAUDE_INACTIVE_DELAY = 4000;

/** Read the user-configurable agent exit timeout, falling back to the constant */
function getAgentExitTimeout(): number {
  const val = getSetting('terminal.agentExitTimeout') as number | undefined;
  if (typeof val === 'number' && val >= 1000 && val <= 30000) return val;
  return CLAUDE_INACTIVE_DELAY;
}

/** Tracks the current claude-active state per terminal for shell-prompt exit detection */
const claudeActiveFlags = new Map<string, boolean>();

/** Handle for periodic stale-session check interval (cancellable) */
let staleSessionTimer: ReturnType<typeof setInterval> | null = null;

/** Handle for periodic TUI stall check interval (cancellable) */
let stallCheckTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Shell prompt patterns — when one of these appears as the last line of output
 * while the agent was active (and no Claude patterns matched), the agent has exited.
 */
const SHELL_PROMPT_PATTERNS: RegExp[] = [
  /\$\s*$/,                              // bash: "user@host:~$ "
  /❯\s*$/,                               // zsh with starship/pure
  />\s*$/,                                // PowerShell: "PS C:\> "
  /\w+@[\w.-]+[:#~]\S*\s*\$\s*$/,        // full bash prompt: "user@host:~/dir$ "
  /PS\s+[A-Z]:\\[^>]*>\s*$/,             // PowerShell full: "PS C:\Users\foo> "
];

/**
 * Patterns that strongly indicate Claude Code TUI is active.
 * Tested against a rolling buffer of recent raw terminal output (includes ANSI).
 */
const CLAUDE_PATTERNS: RegExp[] = [
  // ANSI terminal title set to something containing "claude"
  // eslint-disable-next-line no-control-regex
  /\x1b\]0;[^\x07]*claude/i,
  // eslint-disable-next-line no-control-regex
  /\x1b\]2;[^\x07]*claude/i,
  // Claude banner / status lines
  /\bclaude[\s-]?code\b/i,
  // Tool-use indicators unique to Claude Code TUI (Braille spinner characters)
  /⠋|⠙|⠹|⠸|⠼|⠴|⠦|⠧|⠇|⠏/,
  // Cost display pattern from Claude Code
  /\$\d+\.\d{2}\s+[│|]/,
  // Claude's "Thinking" indicator
  /\bThinking\.\.\./,
  // Subagent / slash command output (e.g. "feature-dev:code-reviewer(...)")
  /\b\w+(?::\w+)?\([^)]*\)/,
  // Claude status line patterns: "Mustering...", "Crunched for", "Done ("
  /\b(?:Mustering|Crunched for|Done \()/,
  // Tool use count indicators (e.g. "30 tool uses", "50.9k tokens")
  /\d+\s+tool\s+uses/i,
];

/** Maps terminalId → sessionId for jump-to-terminal correlation */
const terminalSessionMap = new Map<string, string>();

/** Max age (ms) for a session to be considered "fresh" — matches claudeSessionsManager's 2-min active threshold */
const SESSION_STALE_MS = 2 * 60 * 1000;

/** Check if a session's lastActivityAt is recent enough to be from the current run */
function isSessionFresh(lastActivityAt: string): boolean {
  return (Date.now() - new Date(lastActivityAt).getTime()) < SESSION_STALE_MS;
}

/**
 * When a terminal becomes claude-active, try to correlate it with
 * a session in agent-state.json.
 *
 * Priority:
 * 1. Direct match by terminalId (written by hooks via SUBFRAME_TERMINAL_ID env var)
 * 2. Heuristic: most recently active unclaimed session (fresh only, <2 min)
 */
function correlateSession(terminalId: string): string | undefined {
  const instance = ptyInstances.get(terminalId);
  if (!instance?.projectPath) return undefined;

  try {
    const state = agentStateManager.loadAgentState(instance.projectPath);
    if (!state.sessions.length) return undefined;

    // 1. Direct match — hooks wrote our SUBFRAME_TERMINAL_ID into the session
    //    Must also be fresh (prevents cross-session ID reuse after app restart)
    //    Sort by lastActivityAt to handle subagents sharing the same terminalId
    const directMatches = state.sessions
      .filter((s) =>
        s.terminalId === terminalId &&
        (s.status === 'active' || s.status === 'busy') &&
        isSessionFresh(s.lastActivityAt)
      )
      .sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime());
    if (directMatches.length > 0) return directMatches[0].sessionId;

    // 2. Heuristic fallback — most recently active unclaimed fresh session
    const claimed = new Set<string>();
    for (const [tid, sid] of terminalSessionMap) {
      if (tid !== terminalId) claimed.add(sid);
    }

    const candidates = state.sessions
      .filter((s) =>
        (s.status === 'active' || s.status === 'busy') &&
        !claimed.has(s.sessionId) &&
        !s.terminalId && // Skip sessions already bound to a terminal
        isSessionFresh(s.lastActivityAt)
      )
      .sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime());

    return candidates[0]?.sessionId;
  } catch {
    return undefined;
  }
}

function broadcastClaudeStatus(terminalId: string, active: boolean): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  let sessionId: string | undefined;
  if (active) {
    // Check if we already have a valid mapping for this terminal
    const existingId = terminalSessionMap.get(terminalId);
    if (existingId) {
      // Validate: is the mapped session still active/busy? If so, keep it.
      // If it's gone idle/completed, the user may have started a new session — re-correlate.
      const instance = ptyInstances.get(terminalId);
      if (instance?.projectPath) {
        try {
          const state = agentStateManager.loadAgentState(instance.projectPath);
          const mapped = state.sessions.find((s) => s.sessionId === existingId);
          if (mapped && (mapped.status === 'active' || mapped.status === 'busy') && isSessionFresh(mapped.lastActivityAt)) {
            sessionId = existingId; // Existing mapping is still valid and fresh
          } else {
            // Mapped session went idle — may be a new Claude session in this terminal
            sessionId = correlateSession(terminalId);
          }
        } catch {
          sessionId = existingId; // On error, keep existing mapping
        }
      } else {
        sessionId = existingId;
      }
    } else {
      sessionId = correlateSession(terminalId);
    }

    if (sessionId) {
      terminalSessionMap.set(terminalId, sessionId);
    } else if (!terminalSessionMap.has(terminalId)) {
      // Session may not be written yet — retry once after hooks have had time to fire
      setTimeout(() => {
        if (!terminalSessionMap.has(terminalId)) {
          const retryId = correlateSession(terminalId);
          if (retryId && mainWindow && !mainWindow.isDestroyed()) {
            terminalSessionMap.set(terminalId, retryId);
            broadcast(IPC.CLAUDE_ACTIVE_STATUS, { terminalId, active: true, sessionId: retryId });
          }
        }
      }, 5000);
    }
  }
  // Don't delete the mapping when going inactive — preserve terminal↔session association
  // across idle transitions to prevent cross-contamination. Mapping is cleared only when
  // the terminal is destroyed (PTY exit handler / destroyTerminal).

  // When inactive, include the existing mapping so the renderer retains the session name
  sessionId = sessionId ?? terminalSessionMap.get(terminalId);
  broadcast(IPC.CLAUDE_ACTIVE_STATUS, { terminalId, active, sessionId });

  // Also send to pop-out window if one exists for this terminal
  const popoutWC = popoutWebContents.get(terminalId);
  if (popoutWC && !popoutWC.isDestroyed()) {
    popoutWC.send(IPC.CLAUDE_ACTIVE_STATUS, { terminalId, active, sessionId });
  }
}

function detectClaudeOutput(terminalId: string, data: string): void {
  // Append to rolling buffer
  let buf = (CLAUDE_OUTPUT_BUFFERS.get(terminalId) || '') + data;
  if (buf.length > CLAUDE_BUFFER_MAX) {
    buf = buf.slice(buf.length - CLAUDE_BUFFER_MAX);
  }
  CLAUDE_OUTPUT_BUFFERS.set(terminalId, buf);

  // Check patterns against the buffer
  const matched = CLAUDE_PATTERNS.some((re) => re.test(buf));

  if (matched) {
    const instance = ptyInstances.get(terminalId);
    if (!instance) return;

    // Clear any pending inactive timeout
    const existing = CLAUDE_TIMEOUT_HANDLES.get(terminalId);
    if (existing) clearTimeout(existing);

    // Broadcast on transition to active
    const wasActive = instance.claudeActive;
    instance.claudeActive = true;
    claudeActiveFlags.set(terminalId, true);
    if (!wasActive) {
      broadcastClaudeStatus(terminalId, true);
    }

    // Schedule inactive transition (use configurable timeout)
    const timeout = getAgentExitTimeout();
    CLAUDE_TIMEOUT_HANDLES.set(
      terminalId,
      setTimeout(() => {
        const inst = ptyInstances.get(terminalId);
        if (inst && inst.claudeActive) {
          inst.claudeActive = false;
          claudeActiveFlags.set(terminalId, false);
          broadcastClaudeStatus(terminalId, false);
        }
        CLAUDE_TIMEOUT_HANDLES.delete(terminalId);
      }, timeout)
    );
    return;
  }

  // If agent is active and we see a shell prompt, agent likely exited
  if (claudeActiveFlags.get(terminalId) && !matched) {
    const lastLine = data.split('\n').pop()?.trim() ?? '';
    if (SHELL_PROMPT_PATTERNS.some((p) => p.test(lastLine))) {
      // Shell prompt appeared without any Claude patterns — agent exited
      const pendingTimeout = CLAUDE_TIMEOUT_HANDLES.get(terminalId);
      if (pendingTimeout) clearTimeout(pendingTimeout);
      CLAUDE_TIMEOUT_HANDLES.delete(terminalId);
      const instance = ptyInstances.get(terminalId);
      if (instance) {
        instance.claudeActive = false;
      }
      claudeActiveFlags.set(terminalId, false);
      broadcastClaudeStatus(terminalId, false);
    }
  }
}

function appendTerminalBacklog(terminalId: string, data: string): void {
  const next = (terminalBacklogs.get(terminalId) || '') + data;
  terminalBacklogs.set(
    terminalId,
    next.length > TERMINAL_BACKLOG_MAX_CHARS ? next.slice(-TERMINAL_BACKLOG_MAX_CHARS) : next,
  );
}

function handleTerminalOutput(terminalId: string, data: string): void {
  appendTerminalBacklog(terminalId, data);
  if (mainWindow && !mainWindow.isDestroyed()) {
    broadcast(IPC.TERMINAL_OUTPUT_ID, { terminalId, data });
  }
  detectClaudeOutput(terminalId, data);

  const instForStall = ptyInstances.get(terminalId);
  if (instForStall) {
    instForStall.lastOutputTimestamp = Date.now();
    if (instForStall.claudeActive && mainWindow && !mainWindow.isDestroyed()) {
      broadcast(IPC.TERMINAL_STALL_CLEARED, { terminalId });
    }
  }

  const osc7Path = parseOSC7(data);
  if (osc7Path) {
    const inst = ptyInstances.get(terminalId);
    if (inst) inst.cwd = osc7Path;
  }

  const captureBuf = captureBuffers.get(terminalId);
  if (captureBuf) captureBuf.push(data);

  const handlers = outputHandlers.get(terminalId);
  if (handlers) handlers.forEach(handler => handler(data));
}

function handleTerminalExit(terminalId: string, exitCode: number | undefined): void {
  console.log(`Terminal ${terminalId} exited:`, exitCode);
  ptyInstances.delete(terminalId);
  CLAUDE_OUTPUT_BUFFERS.delete(terminalId);
  captureBuffers.delete(terminalId);
  outputHandlers.delete(terminalId);
  terminalBacklogs.delete(terminalId);
  terminalSessionMap.delete(terminalId);
  claudeActiveFlags.delete(terminalId);
  const timeout = CLAUDE_TIMEOUT_HANDLES.get(terminalId);
  if (timeout) { clearTimeout(timeout); CLAUDE_TIMEOUT_HANDLES.delete(terminalId); }
  if (mainWindow && !mainWindow.isDestroyed()) {
    broadcast(IPC.TERMINAL_DESTROYED, { terminalId, exitCode });
  }
  const popoutWC = popoutWebContents.get(terminalId);
  if (popoutWC && !popoutWC.isDestroyed()) {
    popoutWC.send(IPC.TERMINAL_DESTROYED, { terminalId, exitCode });
  }
  popoutWebContents.delete(terminalId);
}

function bindPtyLifecycle(terminalId: string, ptyProcess: IPty): void {
  ptyProcess.onData((data: string) => {
    handleTerminalOutput(terminalId, data);
  });

  ptyProcess.onExit(({ exitCode }) => {
    handleTerminalExit(terminalId, exitCode);
  });
}

interface ShellInfo {
  id: string;
  name: string;
  path: string;
  isDefault?: boolean;
}

// Store multiple PTY instances
const ptyInstances = new Map<string, PTYInstance>();
let mainWindow: BrowserWindow | null = null;
let terminalCounter = 0;
const DEFAULT_MAX_TERMINALS = 9;

/** Read max terminals from settings (falls back to default if unconfigured) */
function getMaxTerminals(): number {
  const val = getSetting('terminal.maxTerminals') as number | undefined;
  if (typeof val === 'number' && val >= 1 && val <= 20) return val;
  return DEFAULT_MAX_TERMINALS;
}

/**
 * Initialize PTY manager with window reference
 */
function init(window: BrowserWindow): void {
  mainWindow = window;

  // Periodic stale-session check: if agent-state.json shows a correlated session
  // as idle/completed, immediately mark the terminal as inactive.
  staleSessionTimer = setInterval(() => {
    for (const [terminalId, sessionId] of terminalSessionMap.entries()) {
      if (!claudeActiveFlags.get(terminalId)) continue;
      const instance = ptyInstances.get(terminalId);
      if (!instance?.projectPath) continue;
      try {
        const state = agentStateManager.loadAgentState(instance.projectPath);
        const session = state.sessions.find((s) => s.sessionId === sessionId);
        if (session && (session.status === 'idle' || session.status === 'completed')) {
          instance.claudeActive = false;
          claudeActiveFlags.set(terminalId, false);
          // Clear any pending inactivity timeout since we know the agent exited
          const pending = CLAUDE_TIMEOUT_HANDLES.get(terminalId);
          if (pending) { clearTimeout(pending); CLAUDE_TIMEOUT_HANDLES.delete(terminalId); }
          broadcastClaudeStatus(terminalId, false);
        }
      } catch { /* ignore read errors */ }
    }
  }, 3000);

  // Periodic TUI stall check (every 2 seconds) — experimental feature
  stallCheckTimer = setInterval(() => {
    const enabled = getSetting('experimental.tuiRecovery');
    if (!enabled) return;

    const threshold = ((getSetting('experimental.tuiRecoveryThreshold') as number) || 15) * 1000;
    const now = Date.now();

    for (const [terminalId, instance] of ptyInstances) {
      if (!instance.claudeActive) continue;
      const stallDuration = now - instance.lastOutputTimestamp;
      if (stallDuration > threshold) {
        if (mainWindow && !mainWindow.isDestroyed()) {
          broadcast(IPC.TERMINAL_STALL_DETECTED, { terminalId, stallDurationMs: stallDuration });
        }

        // Auto-recovery mode: send SIGWINCH automatically
        const mode = getSetting('experimental.tuiRecoveryMode');
        if (mode === 'auto') {
          try { instance.pty.resize(instance.pty.cols, instance.pty.rows); } catch { /* ignore */ }
        }
      }
    }
  }, 2000);
}

/**
 * Get default shell based on platform
 */
function getDefaultShell(): string {
  if (process.platform === 'win32') {
    try {
      execSync('where pwsh', { stdio: 'ignore' });
      return 'pwsh.exe';
    } catch {
      return 'powershell.exe';
    }
  } else {
    return process.env.SHELL || '/bin/zsh';
  }
}

/**
 * Get available shells on the system
 */
function getAvailableShells(): ShellInfo[] {
  const shells: ShellInfo[] = [];
  const defaultShell = getDefaultShell();

  if (process.platform === 'win32') {
    // Windows shells
    const windowsShells: ShellInfo[] = [
      { id: 'powershell', name: 'PowerShell', path: 'powershell.exe' },
      { id: 'cmd', name: 'Command Prompt', path: 'cmd.exe' }
    ];

    // Check for PowerShell Core (pwsh)
    try {
      execSync('where pwsh', { stdio: 'ignore' });
      windowsShells.unshift({ id: 'pwsh', name: 'PowerShell Core', path: 'pwsh.exe' });
    } catch { /* not available */ }

    // Check for Git Bash
    const gitBashPaths = [
      'C:\\Program Files\\Git\\bin\\bash.exe',
      'C:\\Program Files (x86)\\Git\\bin\\bash.exe'
    ];
    for (const gitBash of gitBashPaths) {
      if (fs.existsSync(gitBash)) {
        windowsShells.push({ id: 'gitbash', name: 'Git Bash', path: gitBash });
        break;
      }
    }

    // Check for WSL
    try {
      execSync('where wsl', { stdio: 'ignore' });
      windowsShells.push({ id: 'wsl', name: 'WSL', path: 'wsl.exe' });
    } catch { /* not available */ }

    shells.push(...windowsShells);
  } else {
    // Unix-like shells (macOS, Linux)
    const unixShells: ShellInfo[] = [
      { id: 'zsh', name: 'Zsh', path: '/bin/zsh' },
      { id: 'bash', name: 'Bash', path: '/bin/bash' },
      { id: 'sh', name: 'Shell', path: '/bin/sh' }
    ];

    // Check for fish shell
    try {
      execSync('which fish', { stdio: 'ignore' });
      const fishPath = execSync('which fish', { encoding: 'utf8' }).trim();
      unixShells.push({ id: 'fish', name: 'Fish', path: fishPath });
    } catch { /* not available */ }

    // Check for nushell
    try {
      execSync('which nu', { stdio: 'ignore' });
      const nuPath = execSync('which nu', { encoding: 'utf8' }).trim();
      unixShells.push({ id: 'nu', name: 'Nushell', path: nuPath });
    } catch { /* not available */ }

    // Filter to only existing shells and mark default
    for (const shell of unixShells) {
      if (fs.existsSync(shell.path)) {
        shell.isDefault = shell.path === defaultShell;
        shells.push(shell);
      }
    }
  }

  // Sort so default shell is first
  shells.sort((a, b) => {
    if (a.isDefault) return -1;
    if (b.isDefault) return 1;
    return 0;
  });

  return shells;
}

/**
 * Create a new terminal instance
 */
function createTerminal(
  workingDir: string | null = null,
  projectPath: string | null = null,
  shellPath: string | null = null,
  initialCols = 80,
  initialRows = 24,
  options?: { conptyInheritCursor?: boolean },
): string {
  const maxTerminals = getMaxTerminals();
  if (ptyInstances.size >= maxTerminals) {
    throw new Error(`Maximum terminal limit (${maxTerminals}) reached`);
  }

  const terminalId = `term-${++terminalCounter}`;
  const cwd = workingDir || process.env.HOME || process.env.USERPROFILE || '';
  const configuredShell = (getSetting('terminal.defaultShell') as string) || '';
  const shell = shellPath || configuredShell || getDefaultShell();

  // Determine shell arguments based on shell type
  const shellArgs = getShellArgs(shell);

  const isWindows = process.platform === 'win32';
  // conptyInheritCursor: true is needed for oh-my-posh/starship prompts in
  // normal terminals, but causes ConPTY to defer output in background terminals
  // (like AI analysis sessions) where no renderer is immediately attached.
  const inheritCursor = options?.conptyInheritCursor ?? true;
  const ptyProcess = pty.spawn(shell, shellArgs, {
    name: 'xterm-256color',
    cols: initialCols,
    rows: initialRows,
    cwd: cwd,
    ...(isWindows ? { useConpty: true, conptyInheritCursor: inheritCursor } : {}),
    env: {
      ...process.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      TERM_PROGRAM: 'SubFrame',
      TERM_PROGRAM_VERSION: require('../../package.json').version,
      SUBFRAME_TERMINAL_ID: terminalId,
    } as Record<string, string>
  });
  terminalBacklogs.set(terminalId, '');

  bindPtyLifecycle(terminalId, ptyProcess);

  ptyInstances.set(terminalId, { pty: ptyProcess, cwd, projectPath, claudeActive: false, shell, lastOutputTimestamp: Date.now() });
  console.log(`Created terminal ${terminalId} in ${cwd} (shell: ${shell}, project: ${projectPath || 'global'})`);

  return terminalId;
}

/**
 * Create a terminal that runs a specific command directly — no interactive shell.
 * On Windows: uses `cmd.exe /c <command> <args>` for PATH resolution of .cmd/.exe wrappers.
 * On Unix: spawns the command directly.
 *
 * Unlike createTerminal (which opens an interactive shell), this executes the
 * command immediately — avoiding the ConPTY buffering caused by typing a command
 * into an interactive shell and waiting for it to echo/execute.
 */
function spawnDirect(
  command: string,
  args: string[],
  workingDir: string,
  projectPath: string | null = null,
  initialCols = 80,
  initialRows = 24,
): string {
  const maxTerminals = getMaxTerminals();
  if (ptyInstances.size >= maxTerminals) {
    throw new Error(`Maximum terminal limit (${maxTerminals}) reached`);
  }

  const terminalId = `term-${++terminalCounter}`;
  const cwd = workingDir || process.env.HOME || process.env.USERPROFILE || '';
  const isWindows = process.platform === 'win32';

  // On Windows, wrap in cmd.exe /c for PATH resolution (.cmd, .exe, .bat wrappers).
  // On Unix, spawn directly.
  const spawnCmd = isWindows ? (process.env.COMSPEC || 'cmd.exe') : command;
  const spawnArgs = isWindows ? ['/c', command, ...args] : args;

  const ptyProcess = pty.spawn(spawnCmd, spawnArgs, {
    name: 'xterm-256color',
    cols: initialCols,
    rows: initialRows,
    cwd,
    ...(isWindows ? { useConpty: true, conptyInheritCursor: true } : {}),
    env: {
      ...process.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      TERM_PROGRAM: 'SubFrame',
      TERM_PROGRAM_VERSION: require('../../package.json').version,
      SUBFRAME_TERMINAL_ID: terminalId,
    } as Record<string, string>,
  });
  terminalBacklogs.set(terminalId, '');

  bindPtyLifecycle(terminalId, ptyProcess);

  ptyInstances.set(terminalId, { pty: ptyProcess, cwd, projectPath, claudeActive: false, shell: spawnCmd, lastOutputTimestamp: Date.now() });
  console.log(`Spawned direct terminal ${terminalId} in ${cwd} (command: ${command} ${args.join(' ')}, project: ${projectPath || 'global'})`);

  return terminalId;
}

/**
 * Get shell arguments based on shell type (reusable helper).
 */
function getShellArgs(shell: string): string[] {
  if (process.platform !== 'win32') {
    const shellName = shell.split('/').pop();
    if (shellName === 'fish') return ['-i'];
    if (shellName === 'nu') return ['-l'];
    return ['-i', '-l'];
  }
  return [];
}

/**
 * Restart a terminal's shell process in-place.
 * The terminal ID stays the same — only the PTY process is replaced.
 * The renderer xterm instance keeps running; it receives output from the new PTY.
 */
function restartTerminal(terminalId: string): { success: boolean; error?: string } {
  const instance = ptyInstances.get(terminalId);
  if (!instance) return { success: false, error: 'Terminal not found' };

  const { cwd, shell, projectPath } = instance;
  const oldCols = instance.pty.cols;
  const oldRows = instance.pty.rows;

  // Kill the old PTY
  try { instance.pty.kill(); } catch { /* ignore */ }

  // Clean up detection state
  CLAUDE_OUTPUT_BUFFERS.delete(terminalId);
  claudeActiveFlags.delete(terminalId);
  const timeout = CLAUDE_TIMEOUT_HANDLES.get(terminalId);
  if (timeout) { clearTimeout(timeout); CLAUDE_TIMEOUT_HANDLES.delete(terminalId); }
  terminalSessionMap.delete(terminalId);

  // Spawn new PTY with fresh environment
  const newShellArgs = getShellArgs(shell);
  const isWindows = process.platform === 'win32';
  const newPty = pty.spawn(shell, newShellArgs, {
    name: 'xterm-256color',
    cols: oldCols,
    rows: oldRows,
    cwd: cwd,
    ...(isWindows ? { useConpty: true, conptyInheritCursor: true } : {}),
    env: {
      ...process.env,  // FRESH env — picks up PATH changes
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      TERM_PROGRAM: 'SubFrame',
      TERM_PROGRAM_VERSION: require('../../package.json').version,
      SUBFRAME_TERMINAL_ID: terminalId,
    } as Record<string, string>
  });

  bindPtyLifecycle(terminalId, newPty);

  // Update the instance in-place
  instance.pty = newPty;
  instance.claudeActive = false;
  instance.lastOutputTimestamp = Date.now();

  console.log(`Restarted terminal ${terminalId} shell (${shell}) in ${cwd}`);
  return { success: true };
}

/**
 * Get terminals for a specific project
 */
function getTerminalsByProject(projectPath: string | null): string[] {
  const result: string[] = [];
  for (const [terminalId, instance] of ptyInstances) {
    if (instance.projectPath === projectPath) {
      result.push(terminalId);
    }
  }
  return result;
}

/**
 * Get terminal info
 */
function getTerminalInfo(terminalId: string): { cwd: string; projectPath: string | null; shell: string } | null {
  const instance = ptyInstances.get(terminalId);
  if (instance) {
    return { cwd: instance.cwd, projectPath: instance.projectPath, shell: instance.shell };
  }
  return null;
}

/**
 * Write data to specific terminal
 */
function writeToTerminal(terminalId: string, data: string): void {
  const instance = ptyInstances.get(terminalId);
  if (instance) {
    instance.pty.write(data);
  }
}

/**
 * Inject synthetic output into a terminal stream.
 * Used when SubFrame needs the shared transcript to reflect a command launch
 * before the shell has echoed anything back.
 */
function injectTerminalOutput(terminalId: string, data: string): void {
  if (!ptyInstances.has(terminalId)) return;
  handleTerminalOutput(terminalId, data);
}

/**
 * Resize specific terminal
 */
function resizeTerminal(terminalId: string, cols: number, rows: number): void {
  const instance = ptyInstances.get(terminalId);
  if (instance) {
    instance.pty.resize(cols, rows);
  }
}

/**
 * Destroy specific terminal
 */
function destroyTerminal(terminalId: string): void {
  const instance = ptyInstances.get(terminalId);
  if (instance) {
    instance.pty.kill();
    ptyInstances.delete(terminalId);
    // Clean up Claude detection + capture + session correlation state
    CLAUDE_OUTPUT_BUFFERS.delete(terminalId);
    captureBuffers.delete(terminalId);
    outputHandlers.delete(terminalId);
    terminalBacklogs.delete(terminalId);
    terminalSessionMap.delete(terminalId);
    claudeActiveFlags.delete(terminalId);
    const timeout = CLAUDE_TIMEOUT_HANDLES.get(terminalId);
    if (timeout) { clearTimeout(timeout); CLAUDE_TIMEOUT_HANDLES.delete(terminalId); }
    console.log(`Destroyed terminal ${terminalId}`);
  }
}

/**
 * Destroy all terminals
 */
function destroyAll(): void {
  for (const [terminalId, instance] of ptyInstances) {
    instance.pty.kill();
    console.log(`Destroyed terminal ${terminalId}`);
  }
  ptyInstances.clear();
  // Clean up all detection + capture + session correlation state
  CLAUDE_OUTPUT_BUFFERS.clear();
  captureBuffers.clear();
  outputHandlers.clear();
  terminalBacklogs.clear();
  terminalSessionMap.clear();
  claudeActiveFlags.clear();
  for (const timeout of CLAUDE_TIMEOUT_HANDLES.values()) clearTimeout(timeout);
  CLAUDE_TIMEOUT_HANDLES.clear();
  if (staleSessionTimer) { clearInterval(staleSessionTimer); staleSessionTimer = null; }
  if (stallCheckTimer) { clearInterval(stallCheckTimer); stallCheckTimer = null; }
}

/**
 * Get terminal count
 */
function getTerminalCount(): number {
  return ptyInstances.size;
}

/**
 * Get all terminal IDs
 */
function getTerminalIds(): string[] {
  return Array.from(ptyInstances.keys());
}

/**
 * Check if terminal exists
 */
function hasTerminal(terminalId: string): boolean {
  return ptyInstances.has(terminalId);
}

/**
 * Check if Claude Code is currently active in a terminal
 */
function isClaudeActive(terminalId: string): boolean {
  const instance = ptyInstances.get(terminalId);
  return instance?.claudeActive ?? false;
}

/**
 * Wait for a terminal to exit, with timeout.
 * Returns 'exited' if the terminal process ends, or 'timeout' if the deadline passes.
 */
function waitForExit(terminalId: string, timeoutMs: number): Promise<'exited' | 'timeout'> {
  return new Promise((resolve) => {
    if (!ptyInstances.has(terminalId)) {
      resolve('exited');
      return;
    }
    const startTime = Date.now();
    const check = setInterval(() => {
      if (!ptyInstances.has(terminalId)) {
        clearInterval(check);
        resolve('exited');
      } else if (Date.now() - startTime >= timeoutMs) {
        clearInterval(check);
        resolve('timeout');
      }
    }, 300);
  });
}

/**
 * Setup IPC handlers for multi-terminal
 */
function setupIPC(ipcMain: IpcMain): void {
  // Get available shells
  ipcMain.on(IPC.GET_AVAILABLE_SHELLS, (event) => {
    try {
      const shells = getAvailableShells();
      event.reply(IPC.AVAILABLE_SHELLS_DATA, { shells, success: true });
    } catch (error) {
      event.reply(IPC.AVAILABLE_SHELLS_DATA, { shells: [], success: false, error: (error as Error).message });
    }
  });

  // Create new terminal
  ipcMain.on(IPC.TERMINAL_CREATE, (event, data: string | { cwd?: string; projectPath?: string; shell?: string }) => {
    try {
      let workingDir: string | null = null;
      let projectPath: string | null = null;
      let shellPath: string | null = null;

      if (typeof data === 'string') {
        workingDir = data;
      } else if (data && typeof data === 'object') {
        workingDir = data.cwd || null;
        projectPath = data.projectPath || null;
        shellPath = data.shell || null;
      }

      const terminalId = createTerminal(workingDir, projectPath, shellPath);
      event.reply(IPC.TERMINAL_CREATED, { terminalId, success: true });
    } catch (error) {
      event.reply(IPC.TERMINAL_CREATED, { success: false, error: (error as Error).message });
    }
  });

  // Destroy terminal
  ipcMain.on(IPC.TERMINAL_DESTROY, (_event, terminalId: string) => {
    destroyTerminal(terminalId);
  });

  // Query whether Claude is active in a specific terminal
  ipcMain.handle(IPC.IS_TERMINAL_CLAUDE_ACTIVE, (_event, terminalId: string) => {
    return isClaudeActive(terminalId);
  });

  // Input to specific terminal — only log prompts when Claude is active
  ipcMain.on(IPC.TERMINAL_INPUT_ID, (_event, { terminalId, data }: { terminalId: string; data: string }) => {
    writeToTerminal(terminalId, data);
    if (isClaudeActive(terminalId)) {
      promptLogger.logInput(terminalId, data);
    }
  });

  // Resize specific terminal
  ipcMain.on(IPC.TERMINAL_RESIZE_ID, (_event, { terminalId, cols, rows }: { terminalId: string; cols: number; rows: number }) => {
    resizeTerminal(terminalId, cols, rows);
  });

  // Get terminal state (cwd, shell, session) for save/restore
  ipcMain.handle(IPC.GET_TERMINAL_STATE, () => {
    const terminals: Array<{ id: string; cwd: string; shell: string; claudeActive: boolean; sessionId: string | null; projectPath: string | null }> = [];
    for (const [id, instance] of ptyInstances) {
      terminals.push({
        id,
        cwd: instance.cwd,
        shell: instance.shell,
        claudeActive: instance.claudeActive,
        sessionId: terminalSessionMap.get(id) ?? null,
        projectPath: instance.projectPath ?? null,
      });
    }
    return { terminals };
  });

  ipcMain.handle(IPC.GET_TERMINAL_BACKLOG, (_event, { terminalId }: { terminalId: string }) => {
    return { data: terminalBacklogs.get(terminalId) || '' };
  });

  // Save scrollback to .subframe/scrollback/<terminalId>.txt
  ipcMain.handle(IPC.SAVE_TERMINAL_SCROLLBACK, (_event, { projectPath, terminalId, lines }: { projectPath: string; terminalId: string; lines: string[] }) => {
    try {
      const dir = path.join(projectPath, '.subframe', 'scrollback');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${terminalId}.txt`), lines.join('\n'), 'utf-8');
      return { success: true };
    } catch {
      return { success: false };
    }
  });

  // Load scrollback from .subframe/scrollback/<terminalId>.txt
  ipcMain.handle(IPC.LOAD_TERMINAL_SCROLLBACK, (_event, { projectPath, terminalId }: { projectPath: string; terminalId: string }) => {
    try {
      const filePath = path.join(projectPath, '.subframe', 'scrollback', `${terminalId}.txt`);
      if (!fs.existsSync(filePath)) return { lines: [] };
      const content = fs.readFileSync(filePath, 'utf-8');
      return { lines: content.split('\n') };
    } catch {
      return { lines: [] };
    }
  });

  // TUI stall recovery actions (experimental)
  ipcMain.handle(IPC.TERMINAL_STALL_RECOVER, (_event, { terminalId, action }: { terminalId: string; action: string }) => {
    const instance = ptyInstances.get(terminalId);
    if (!instance) return { success: false };
    try {
      if (action === 'sigwinch') {
        instance.pty.resize(instance.pty.cols, instance.pty.rows);
      } else if (action === 'ctrl-c') {
        instance.pty.write('\x03');
      } else if (action === 'sigcont') {
        instance.pty.kill('SIGCONT');
      }
      return { success: true };
    } catch {
      return { success: false };
    }
  });

  // Restart terminal shell (kills old PTY, spawns new one with fresh env)
  ipcMain.handle(IPC.TERMINAL_RESTART, async (_event, terminalId: string) => {
    return restartTerminal(terminalId);
  });
}

// ─── Output Capture API ──────────────────────────────────────────────────────

/** Start accumulating raw PTY output for a terminal. */
function startCapturing(terminalId: string): void {
  captureBuffers.set(terminalId, []);
}

/** Get all accumulated output and stop capturing. Returns raw PTY data. */
function stopCapturing(terminalId: string): string {
  const chunks = captureBuffers.get(terminalId);
  captureBuffers.delete(terminalId);
  return chunks ? chunks.join('') : '';
}

/** Register a pop-out window's WebContents for broadcast forwarding. */
function registerPopoutWebContents(terminalId: string, wc: WebContents): void {
  popoutWebContents.set(terminalId, wc);
}

/** Unregister a pop-out window's WebContents. */
function unregisterPopoutWebContents(terminalId: string): void {
  popoutWebContents.delete(terminalId);
}

/** Register a named callback invoked on each PTY data chunk for a terminal. */
function addOutputHandler(terminalId: string, handler: (data: string) => void, handlerId = 'default'): void {
  let handlers = outputHandlers.get(terminalId);
  if (!handlers) {
    handlers = new Map();
    outputHandlers.set(terminalId, handlers);
  }
  handlers.set(handlerId, handler);
}

/** Remove a named output handler (or all handlers) for a terminal. */
function removeOutputHandler(terminalId: string, handlerId?: string): void {
  if (!handlerId) {
    outputHandlers.delete(terminalId);
  } else {
    const handlers = outputHandlers.get(terminalId);
    if (handlers) {
      handlers.delete(handlerId);
      if (handlers.size === 0) outputHandlers.delete(terminalId);
    }
  }
}

/**
 * Get the raw backlog for a terminal (used by onboardingManager for MCP analysis output).
 */
function getTerminalBacklog(terminalId: string): string {
  return terminalBacklogs.get(terminalId) || '';
}

export {
  init, createTerminal, spawnDirect, restartTerminal, writeToTerminal, injectTerminalOutput, resizeTerminal,
  destroyTerminal, destroyAll, getTerminalCount, getTerminalIds,
  hasTerminal, isClaudeActive, getTerminalsByProject, getTerminalInfo,
  getAvailableShells, setupIPC, waitForExit,
  startCapturing, stopCapturing,
  addOutputHandler, removeOutputHandler,
  registerPopoutWebContents, unregisterPopoutWebContents,
  getTerminalBacklog
};
