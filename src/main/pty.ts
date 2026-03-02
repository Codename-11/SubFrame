/**
 * PTY Management Module
 * Handles shell spawning, input/output, and resize (single legacy terminal)
 */

import * as pty from 'node-pty';
import type { IPty } from 'node-pty';
import type { BrowserWindow, IpcMain } from 'electron';
import { IPC } from '../shared/ipcChannels';

let ptyProcess: IPty | null = null;
let mainWindow: BrowserWindow | null = null;
let currentProjectPath: string | null = null;

/**
 * Initialize PTY module with window reference
 */
function init(window: BrowserWindow): void {
  mainWindow = window;
}

/**
 * Get current project path
 */
function getProjectPath(): string | null {
  return currentProjectPath;
}

/**
 * Set current project path
 */
function setProjectPath(projectPath: string): void {
  currentProjectPath = projectPath;
}

/**
 * Determine shell based on platform
 */
function getShell(): string {
  if (process.platform === 'win32') {
    try {
      require('child_process').execSync('where pwsh', { stdio: 'ignore' });
      console.log('Using PowerShell Core (pwsh)');
      return 'pwsh.exe';
    } catch {
      console.log('Using Windows PowerShell');
      return 'powershell.exe';
    }
  } else {
    const shell = process.env.SHELL || '/bin/zsh';
    console.log('Using shell:', shell);
    return shell;
  }
}

/**
 * Start PTY process
 */
function startPTY(workingDir: string | null = null): IPty {
  // Kill existing process if any
  if (ptyProcess) {
    ptyProcess.kill();
  }

  const shell = getShell();
  const cwd = workingDir || currentProjectPath || process.env.HOME || process.env.USERPROFILE || '';

  // Spawn PTY with interactive and login flags
  const shellArgs: string[] = process.platform === 'win32' ? [] : ['-i', '-l'];

  ptyProcess = pty.spawn(shell, shellArgs, {
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

  // Send PTY output to renderer
  ptyProcess.onData((data: string) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC.TERMINAL_OUTPUT, data);
    }
  });

  // Handle PTY exit
  ptyProcess.onExit(({ exitCode, signal }) => {
    console.log('PTY exited:', exitCode, signal);
  });

  return ptyProcess;
}

/**
 * Write data to PTY
 */
function writeToPTY(data: string): void {
  if (ptyProcess) {
    ptyProcess.write(data);
  }
}

/**
 * Resize PTY
 */
function resizePTY(cols: number, rows: number): void {
  if (ptyProcess) {
    ptyProcess.resize(cols, rows);
  }
}

/**
 * Kill PTY process
 */
function killPTY(): void {
  if (ptyProcess) {
    ptyProcess.kill();
    ptyProcess = null;
  }
}

/**
 * Get current PTY process
 */
function getCurrentPTY(): IPty | null {
  return ptyProcess;
}

/**
 * Setup IPC handlers
 */
function setupIPC(ipcMain: IpcMain): void {
  ipcMain.on(IPC.START_TERMINAL, () => {
    startPTY();
  });

  ipcMain.on(IPC.RESTART_TERMINAL, (_event, projectPath: string) => {
    currentProjectPath = projectPath;
    startPTY(projectPath);
  });

  ipcMain.on(IPC.TERMINAL_RESIZE, (_event, { cols, rows }: { cols: number; rows: number }) => {
    resizePTY(cols, rows);
  });
}

export { init, startPTY, writeToPTY, resizePTY, killPTY, getCurrentPTY, getProjectPath, setProjectPath, setupIPC };
