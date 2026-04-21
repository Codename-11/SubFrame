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
import type { TerminalStatus } from '../shared/agentStateTypes';
import * as promptLogger from './promptLogger';
import { getSetting } from './settingsManager';
import { broadcast } from './eventBridge';
import { log as outputLog } from './outputChannelManager';

interface PTYInstance {
  pty: IPty;
  cwd: string;
  projectPath: string | null;
  /**
   * @deprecated Use the formal `status` enum instead. This field is retained
   * only for back-compat with existing consumers (see GET_TERMINAL_STATE /
   * TERMINAL_RESYNC payloads) and is no longer set by any detection logic —
   * it is initialized to `false` and never flipped in the main process. The
   * renderer store derives its own `claudeActive` boolean from `status`
   * transitions (`working` / `needs-input` → true).
   */
  claudeActive: boolean;
  /** Formal 7-state terminal status (Maestro-style). Driven by AI tool hooks. */
  status: TerminalStatus;
  /** Optional human-readable status reason (e.g. "Running: Bash") */
  statusMessage?: string;
  shell: string;
  shellReady: boolean;
  shellReadyBuffer: string;
  lastOutputTimestamp: number;
  /** Keyboard input buffered while shell is still starting up (pre-shellReady) */
  pendingInput: string[];
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

// ── Shell Ready Detection ────────────────────────────────────────────────────
//
// Claude Code activity is no longer inferred from PTY output pattern matching.
// The formal 7-state `status` enum (populated by AI tool hooks via
// agentStateManager → ptyManager.setTerminalStatus) is the authoritative source
// of truth, and the renderer store derives the legacy `claudeActive` boolean
// from it. The pattern-matching detection, 4-second silence timer, and
// rolling output buffer were removed — they were fragile (false positives
// from non-Claude output, 4s lag on exit) and superseded by deterministic
// hook-driven state.

const SHELL_READY_BUFFER_MAX = 4096;

/**
 * Quiescence timers for shell-ready detection.
 * When prompt patterns don't match (e.g. oh-my-posh with custom glyphs), we fall
 * back to output quiescence: if the terminal has produced output but then goes
 * quiet for SHELL_READY_QUIET_MS, we consider the shell ready.
 */
const shellReadyQuiescenceTimers = new Map<string, ReturnType<typeof setTimeout>>();
const SHELL_READY_QUIET_MS = 250;
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

function stripTerminalControlSequences(text: string): string {
  return text
    .replace(
      // eslint-disable-next-line no-control-regex
      /\x1b\][^\x07]*(?:\x07|\x1b\\)/g,
      '',
    )
    .replace(
      // eslint-disable-next-line no-control-regex
      /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
      '',
    );
}

/**
 * Public status setter — updates the instance's formal `status` enum and
 * broadcasts `TERMINAL_STATUS_CHANGED` to the renderer. Used by the hook
 * bridge (agentStateManager → ptyManager) and any future internal caller
 * that wants to formally mark a terminal.
 */
function setTerminalStatus(
  terminalId: string,
  status: TerminalStatus,
  message?: string,
): void {
  const instance = ptyInstances.get(terminalId);
  if (!instance) return;
  if (instance.status === status && instance.statusMessage === message) return;
  instance.status = status;
  instance.statusMessage = message;
  broadcast(IPC.TERMINAL_STATUS_CHANGED, {
    terminalId,
    status,
    message,
    lastUpdated: Date.now(),
  });
}

function markShellReady(terminalId: string): void {
  const instance = ptyInstances.get(terminalId);
  if (!instance || instance.shellReady) return;

  instance.shellReady = true;
  instance.shellReadyBuffer = '';
  // Transition from 'starting' to 'idle' — the shell is up and awaiting input.
  if (instance.status === 'starting') {
    setTerminalStatus(terminalId, 'idle');
  }

  // Flush any keyboard input that arrived before the shell was ready.
  // Uses a brief quiescence wait to ensure ConPTY has fully settled before
  // writing, preventing the first-byte-drop bug on Windows.
  if (instance.pendingInput.length > 0) {
    const pending = instance.pendingInput;
    instance.pendingInput = [];
    waitForOutputQuiet(terminalId, 50, 2000).then(() => {
      const inst = ptyInstances.get(terminalId);
      if (inst) {
        for (const data of pending) {
          inst.pty.write(data);
        }
      }
    });
  }

  broadcast(IPC.TERMINAL_SHELL_READY, { terminalId });
}

function detectShellReady(terminalId: string, data: string): void {
  const instance = ptyInstances.get(terminalId);
  if (!instance || instance.shellReady) return;

  instance.shellReadyBuffer = (instance.shellReadyBuffer + data).slice(-SHELL_READY_BUFFER_MAX);
  const promptCandidates = stripTerminalControlSequences(instance.shellReadyBuffer)
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)
    .slice(-4);

  // Fast path: prompt pattern matches immediately
  if (promptCandidates.some((line) => SHELL_PROMPT_PATTERNS.some((pattern) => pattern.test(line.trim())))) {
    const existing = shellReadyQuiescenceTimers.get(terminalId);
    if (existing) { clearTimeout(existing); shellReadyQuiescenceTimers.delete(terminalId); }
    markShellReady(terminalId);
    return;
  }

  // Slow path: quiescence fallback for non-standard prompts (oh-my-posh, etc.).
  // If the terminal has produced output but goes quiet for SHELL_READY_QUIET_MS,
  // assume the shell has finished rendering its prompt.
  const existing = shellReadyQuiescenceTimers.get(terminalId);
  if (existing) clearTimeout(existing);
  shellReadyQuiescenceTimers.set(
    terminalId,
    setTimeout(() => {
      shellReadyQuiescenceTimers.delete(terminalId);
      const inst = ptyInstances.get(terminalId);
      if (inst && !inst.shellReady) {
        markShellReady(terminalId);
      }
    }, SHELL_READY_QUIET_MS),
  );
}

/**
 * Maps terminalId → sessionId for jump-to-terminal correlation.
 * Historically populated by the pattern-matching detection path; that path is
 * gone. The map is now only written by the public `setClaudeSessionId` helper
 * (currently unused from the main process — hooks that know a session ID can
 * wire it through) and remains present so `GET_TERMINAL_STATE` / `TERMINAL_RESYNC`
 * payloads still carry the field. Consumers tolerate `null` here.
 */
const terminalSessionMap = new Map<string, string>();

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
  detectShellReady(terminalId, data);

  const instForStall = ptyInstances.get(terminalId);
  if (instForStall) {
    instForStall.lastOutputTimestamp = Date.now();
    // Clear any active stall indicator — if the terminal is in 'working' status
    // and was flagged as stalled, fresh output means it's no longer stalled.
    if (
      (instForStall.status === 'working' || instForStall.status === 'needs-input') &&
      mainWindow &&
      !mainWindow.isDestroyed()
    ) {
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
  outputLog('agent', `Terminal exited: ${terminalId} (code: ${exitCode ?? 'unknown'})`);
  ptyInstances.delete(terminalId);
  captureBuffers.delete(terminalId);
  outputHandlers.delete(terminalId);
  terminalBacklogs.delete(terminalId);
  terminalSessionMap.delete(terminalId);
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

  // Periodic TUI stall check (every 2 seconds) — experimental feature.
  // Only considers terminals whose formal status indicates active work
  // ('working' or 'needs-input'); idle terminals cannot be "stalled".
  stallCheckTimer = setInterval(() => {
    const enabled = getSetting('experimental.tuiRecovery');
    if (!enabled) return;

    const threshold = ((getSetting('experimental.tuiRecoveryThreshold') as number) || 15) * 1000;
    const now = Date.now();

    for (const [terminalId, instance] of ptyInstances) {
      if (instance.status !== 'working' && instance.status !== 'needs-input') continue;
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
  ptyInstances.set(terminalId, {
    pty: ptyProcess,
    cwd,
    projectPath,
    claudeActive: false,
    status: 'starting',
    shell,
    shellReady: false,
    shellReadyBuffer: '',
    lastOutputTimestamp: Date.now(),
    pendingInput: [],
  });
  bindPtyLifecycle(terminalId, ptyProcess);
  console.log(`Created terminal ${terminalId} in ${cwd} (shell: ${shell}, project: ${projectPath || 'global'})`);
  outputLog('agent', `Terminal created: ${terminalId} in ${cwd} (${shell})`);

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
  ptyInstances.set(terminalId, {
    pty: ptyProcess,
    cwd,
    projectPath,
    claudeActive: false,
    status: 'starting',
    shell: spawnCmd,
    shellReady: false,
    shellReadyBuffer: '',
    lastOutputTimestamp: Date.now(),
    pendingInput: [],
  });
  bindPtyLifecycle(terminalId, ptyProcess);
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

  // Clean up session correlation state
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

  // Update the instance in-place
  instance.pty = newPty;
  instance.claudeActive = false;
  instance.shellReady = false;
  instance.shellReadyBuffer = '';
  instance.lastOutputTimestamp = Date.now();
  instance.pendingInput = [];
  // Force-broadcast a 'starting' transition (reset message + notify renderer).
  instance.status = 'idle'; // Ensure setTerminalStatus doesn't dedup.
  setTerminalStatus(terminalId, 'starting');
  bindPtyLifecycle(terminalId, newPty);

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
function getTerminalInfo(terminalId: string): { cwd: string; projectPath: string | null; shell: string; cols: number; rows: number } | null {
  const instance = ptyInstances.get(terminalId);
  if (instance) {
    return { cwd: instance.cwd, projectPath: instance.projectPath, shell: instance.shell, cols: instance.pty.cols, rows: instance.pty.rows };
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
 * Wait until a terminal's PTY output has been quiet for `quietMs` milliseconds.
 * On Windows ConPTY, writing input while the PTY is still emitting output
 * (prompt escape sequences, oh-my-posh cursor positioning, etc.) can cause the
 * first byte of input to be dropped. This helper polls `lastOutputTimestamp`
 * and resolves once a sufficient gap is observed, or after `timeoutMs` total.
 */
function waitForOutputQuiet(terminalId: string, quietMs = 100, timeoutMs = 5000): Promise<void> {
  return new Promise((resolve) => {
    const instance = ptyInstances.get(terminalId);
    if (!instance) { resolve(); return; }
    const startTime = Date.now();
    const check = () => {
      const inst = ptyInstances.get(terminalId);
      if (!inst) { resolve(); return; }
      if (Date.now() - startTime >= timeoutMs) { resolve(); return; }
      const gap = Date.now() - inst.lastOutputTimestamp;
      if (gap >= quietMs) { resolve(); return; }
      setTimeout(check, Math.min(25, quietMs - gap + 5));
    };
    check();
  });
}

/**
 * Write data to a terminal after ensuring PTY output has settled.
 * Combines waitForOutputQuiet + pty.write for safe programmatic command entry.
 */
async function writeWhenQuiet(
  terminalId: string,
  data: string,
  quietMs = 100,
  timeoutMs = 5000,
): Promise<void> {
  await waitForOutputQuiet(terminalId, quietMs, timeoutMs);
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
    // Clean up capture + session correlation + shell-ready state
    captureBuffers.delete(terminalId);
    outputHandlers.delete(terminalId);
    terminalBacklogs.delete(terminalId);
    terminalSessionMap.delete(terminalId);
    const qt = shellReadyQuiescenceTimers.get(terminalId);
    if (qt) { clearTimeout(qt); shellReadyQuiescenceTimers.delete(terminalId); }
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
  // Clean up capture + session correlation + shell-ready state
  captureBuffers.clear();
  outputHandlers.clear();
  terminalBacklogs.clear();
  terminalSessionMap.clear();
  for (const qt of shellReadyQuiescenceTimers.values()) clearTimeout(qt);
  shellReadyQuiescenceTimers.clear();
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
 * Check if Claude Code is currently active in a terminal.
 * Derived from the formal `status` enum: a terminal is considered "claude active"
 * when it's in `working` or `needs-input` state (driven by AI tool hooks).
 * The legacy `instance.claudeActive` field is no longer written in this module
 * and is preserved only for external consumers still reading it via payloads.
 */
function isClaudeActive(terminalId: string): boolean {
  const instance = ptyInstances.get(terminalId);
  if (!instance) return false;
  return instance.status === 'working' || instance.status === 'needs-input';
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

  // Input to specific terminal — buffer until shell is ready to prevent
  // ConPTY first-byte-drop on Windows. Only log prompts when Claude is active.
  ipcMain.on(IPC.TERMINAL_INPUT_ID, (_event, { terminalId, data }: { terminalId: string; data: string }) => {
    const instance = ptyInstances.get(terminalId);
    if (instance && !instance.shellReady) {
      instance.pendingInput.push(data);
      return;
    }
    writeToTerminal(terminalId, data);
    if (isClaudeActive(terminalId)) {
      promptLogger.logInput(terminalId, data);
    }
  });

  // Safe write: wait for PTY output quiescence before writing.
  // Prevents ConPTY first-byte-drop when output (prompt escape sequences,
  // oh-my-posh cursor positioning, etc.) is still being processed.
  ipcMain.handle(IPC.TERMINAL_WRITE_SAFE, async (_event, { terminalId, data, quietMs, timeoutMs }: { terminalId: string; data: string; quietMs?: number; timeoutMs?: number }) => {
    await writeWhenQuiet(terminalId, data, quietMs, timeoutMs);
    return { success: true };
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
        // Derive from the formal status enum so the payload is consistent with
        // the renderer store's derived `claudeActive` (see useTerminalStore).
        claudeActive: instance.status === 'working' || instance.status === 'needs-input',
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

  // ── Renderer Hot Reload: Terminal Resync ──────────────────────────────────
  // After a renderer reload, the renderer calls this to discover all active PTY
  // instances and replay their backlogs so xterm can catch up.
  ipcMain.handle(IPC.TERMINAL_RESYNC, () => {
    const terminals: Array<{
      terminalId: string;
      cwd: string;
      shell: string;
      projectPath: string | null;
      claudeActive: boolean;
      cols: number;
      rows: number;
      sessionId: string | null;
      backlog: string;
    }> = [];
    for (const [id, instance] of ptyInstances) {
      terminals.push({
        terminalId: id,
        cwd: instance.cwd,
        shell: instance.shell,
        projectPath: instance.projectPath,
        claudeActive: instance.status === 'working' || instance.status === 'needs-input',
        cols: instance.pty.cols,
        rows: instance.pty.rows,
        sessionId: terminalSessionMap.get(id) ?? null,
        backlog: terminalBacklogs.get(id) || '',
      });
    }
    return { terminals };
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
  init, createTerminal, spawnDirect, restartTerminal, writeToTerminal, writeWhenQuiet, waitForOutputQuiet,
  injectTerminalOutput, resizeTerminal,
  destroyTerminal, destroyAll, getTerminalCount, getTerminalIds,
  hasTerminal, isClaudeActive, getTerminalsByProject, getTerminalInfo,
  getAvailableShells, setupIPC, waitForExit,
  startCapturing, stopCapturing,
  addOutputHandler, removeOutputHandler,
  registerPopoutWebContents, unregisterPopoutWebContents,
  getTerminalBacklog,
  setTerminalStatus,
};
