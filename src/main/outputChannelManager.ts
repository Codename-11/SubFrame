/**
 * Output Channel Manager — Named log channels for system/integration output.
 * Like VS Code's Output panel — persistent named channels that collect logs
 * from different subsystems (System, GitHub, Git, Pipeline, Agent, etc.).
 */

import type { BrowserWindow, IpcMain } from 'electron';
import { IPC } from '../shared/ipcChannels';
import type { OutputChannel, OutputChannelCategory } from '../shared/activityTypes';
import { broadcast } from './eventBridge';

// ─── Internal State ──────────────────────────────────────────────────────────

interface InternalChannel {
  id: string;
  name: string;
  category: OutputChannelCategory;
  lines: string[];
  maxLines: number;
  createdAt: string;
  updatedAt: string;
}

const channels = new Map<string, InternalChannel>();
let mainWindow: BrowserWindow | null = null;

/** Pending output batches per channel, flushed every 100ms */
const pendingBatches = new Map<string, string[]>();
let flushTimer: ReturnType<typeof setInterval> | null = null;

// ─── Public API ──────────────────────────────────────────────────────────────

function init(window: BrowserWindow): void {
  mainWindow = window;

  // Start batch flush timer
  flushTimer = setInterval(flushPending, 100);

  // Create default channels
  getOrCreateChannel('system', 'System', 'system');
  getOrCreateChannel('git', 'Git', 'git');
  getOrCreateChannel('github', 'GitHub', 'github');
  getOrCreateChannel('agent', 'Agent', 'agent');
  getOrCreateChannel('api', 'API Server', 'api');
  getOrCreateChannel('pipeline', 'Pipeline', 'pipeline');
  getOrCreateChannel('extensions', 'Extensions', 'extension');

  append('system', `[${new Date().toLocaleTimeString()}] Output channels initialized`);
}

/** Get or create a channel by ID */
function getOrCreateChannel(id: string, name: string, category: OutputChannelCategory, maxLines: number = 1000): InternalChannel {
  let channel = channels.get(id);
  if (!channel) {
    channel = {
      id,
      name,
      category,
      lines: [],
      maxLines,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    channels.set(id, channel);
  }
  return channel;
}

/** Append line(s) to a channel — batched for IPC efficiency */
function append(channelId: string, ...lines: string[]): void {
  const channel = channels.get(channelId);
  if (!channel) return;

  for (const line of lines) {
    channel.lines.push(line);
    // Ring buffer trim
    if (channel.lines.length > channel.maxLines) {
      channel.lines.splice(0, channel.lines.length - channel.maxLines);
    }
  }
  channel.updatedAt = new Date().toISOString();

  // Batch for IPC
  if (!pendingBatches.has(channelId)) {
    pendingBatches.set(channelId, []);
  }
  pendingBatches.get(channelId)!.push(...lines);
}

/** Convenience: append a timestamped log line */
function log(channelId: string, message: string): void {
  append(channelId, `[${new Date().toLocaleTimeString()}] ${message}`);
}

/** Clear a channel's log */
function clear(channelId: string): boolean {
  const channel = channels.get(channelId);
  if (!channel) return false;
  channel.lines = [];
  channel.updatedAt = new Date().toISOString();
  broadcastUpdate(channel);
  return true;
}

/** Get all channels as public types */
function listChannels(): OutputChannel[] {
  return Array.from(channels.values()).map(toPublic);
}

/** Get log lines for a channel */
function getLog(channelId: string): string[] {
  return channels.get(channelId)?.lines ?? [];
}

// ─── Internal ────────────────────────────────────────────────────────────────

function toPublic(channel: InternalChannel): OutputChannel {
  return {
    id: channel.id,
    name: channel.name,
    category: channel.category,
    lineCount: channel.lines.length,
    updatedAt: channel.updatedAt,
  };
}

function broadcastUpdate(channel: InternalChannel): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  broadcast(IPC.OUTPUT_CHANNEL_UPDATED, toPublic(channel));
}

function flushPending(): void {
  if (pendingBatches.size === 0 || !mainWindow || mainWindow.isDestroyed()) return;

  for (const [channelId, lines] of pendingBatches) {
    if (lines.length > 0) {
      broadcast(IPC.OUTPUT_CHANNEL_OUTPUT, { channelId, lines });
    }
    const channel = channels.get(channelId);
    if (channel) broadcastUpdate(channel);
  }
  pendingBatches.clear();
}

// ─── IPC ─────────────────────────────────────────────────────────────────────

function setupIPC(ipcMain: IpcMain): void {
  ipcMain.handle(IPC.OUTPUT_CHANNEL_LIST, () => {
    return { channels: listChannels() };
  });

  ipcMain.handle(IPC.OUTPUT_CHANNEL_LOG, (_event, channelId: string) => {
    return { channelId, lines: getLog(channelId) };
  });

  ipcMain.handle(IPC.OUTPUT_CHANNEL_CLEAR, (_event, channelId: string) => {
    return { success: clear(channelId) };
  });
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────

function cleanup(): void {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
}

export { init, setupIPC, cleanup, append, log, clear, getOrCreateChannel, listChannels, getLog };
