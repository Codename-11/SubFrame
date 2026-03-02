/**
 * Prompt Logger Module
 * Logs terminal input to history file
 */

import * as fs from 'fs';
import * as path from 'path';
import type { App, IpcMain } from 'electron';
import { IPC } from '../shared/ipcChannels';

let logFilePath: string | null = null;
let inputBuffer: string = '';

/**
 * Initialize prompt logger
 */
function init(app: App): void {
  logFilePath = path.join(app.getPath('userData'), 'prompts-history.txt');
}

/**
 * Get log file path
 */
function getLogFilePath(): string | null {
  return logFilePath;
}

/**
 * Process and log input data
 */
function logInput(data: string): void {
  if (!logFilePath) return;

  for (const char of data) {
    if (char === '\r' || char === '\n') {
      // Enter pressed - save the line
      if (inputBuffer.trim().length > 0) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${inputBuffer}\n`;
        fs.appendFileSync(logFilePath, logEntry, 'utf8');
      }
      inputBuffer = '';
    } else if (char === '\x7f' || char === '\b') {
      // Backspace - remove last char
      inputBuffer = inputBuffer.slice(0, -1);
    } else if (char.charCodeAt(0) >= 32 && char !== '\x7f') {
      // Printable character (including Unicode)
      inputBuffer += char;
    }
  }
}

/**
 * Get prompt history
 */
function getHistory(): string {
  try {
    if (logFilePath && fs.existsSync(logFilePath)) {
      return fs.readFileSync(logFilePath, 'utf8');
    }
  } catch (err) {
    console.error('Error reading prompt history:', err);
  }
  return '';
}

/**
 * Setup IPC handlers
 */
function setupIPC(ipcMain: IpcMain): void {
  ipcMain.on(IPC.LOAD_PROMPT_HISTORY, (event) => {
    const data = getHistory();
    event.sender.send(IPC.PROMPT_HISTORY_DATA, data);
  });
}

export { init, logInput, getHistory, getLogFilePath, setupIPC };
