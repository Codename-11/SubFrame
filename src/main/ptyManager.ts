/**
 * PTY Manager Module
 * Manages multiple PTY instances for multi-terminal support
 */

import * as pty from 'node-pty';
import type { IPty } from 'node-pty';
import * as fs from 'fs';
import { execSync } from 'child_process';
import type { BrowserWindow, IpcMain } from 'electron';
import { IPC } from '../shared/ipcChannels';
import * as promptLogger from './promptLogger';

interface PTYInstance {
  pty: IPty;
  cwd: string;
  projectPath: string | null;
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
const MAX_TERMINALS = 9;

/**
 * Initialize PTY manager with window reference
 */
function init(window: BrowserWindow): void {
  mainWindow = window;
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
function createTerminal(workingDir: string | null = null, projectPath: string | null = null, shellPath: string | null = null): string {
  if (ptyInstances.size >= MAX_TERMINALS) {
    throw new Error(`Maximum terminal limit (${MAX_TERMINALS}) reached`);
  }

  const terminalId = `term-${++terminalCounter}`;
  const cwd = workingDir || process.env.HOME || process.env.USERPROFILE || '';
  const shell = shellPath || getDefaultShell();

  // Determine shell arguments based on shell type
  let shellArgs: string[] = [];
  if (process.platform !== 'win32') {
    const shellName = shell.split('/').pop();
    if (shellName === 'fish') {
      shellArgs = ['-i'];
    } else if (shellName === 'nu') {
      shellArgs = ['-l'];
    } else {
      shellArgs = ['-i', '-l'];
    }
  }

  const ptyProcess = pty.spawn(shell, shellArgs, {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd: cwd,
    env: {
      ...process.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor'
    } as Record<string, string>
  });

  // Handle PTY output - send with terminal ID
  ptyProcess.onData((data: string) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC.TERMINAL_OUTPUT_ID, { terminalId, data });
    }
  });

  // Handle PTY exit
  ptyProcess.onExit(({ exitCode }) => {
    console.log(`Terminal ${terminalId} exited:`, exitCode);
    ptyInstances.delete(terminalId);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC.TERMINAL_DESTROYED, { terminalId, exitCode });
    }
  });

  ptyInstances.set(terminalId, { pty: ptyProcess, cwd, projectPath });
  console.log(`Created terminal ${terminalId} in ${cwd} (project: ${projectPath || 'global'})`);

  return terminalId;
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
function getTerminalInfo(terminalId: string): { cwd: string; projectPath: string | null } | null {
  const instance = ptyInstances.get(terminalId);
  if (instance) {
    return { cwd: instance.cwd, projectPath: instance.projectPath };
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

  // Input to specific terminal
  ipcMain.on(IPC.TERMINAL_INPUT_ID, (_event, { terminalId, data }: { terminalId: string; data: string }) => {
    writeToTerminal(terminalId, data);
    promptLogger.logInput(data);
  });

  // Resize specific terminal
  ipcMain.on(IPC.TERMINAL_RESIZE_ID, (_event, { terminalId, cols, rows }: { terminalId: string; cols: number; rows: number }) => {
    resizeTerminal(terminalId, cols, rows);
  });
}

export {
  init, createTerminal, writeToTerminal, resizeTerminal,
  destroyTerminal, destroyAll, getTerminalCount, getTerminalIds,
  hasTerminal, getTerminalsByProject, getTerminalInfo,
  getAvailableShells, setupIPC
};
