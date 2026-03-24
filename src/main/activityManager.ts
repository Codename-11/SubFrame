/**
 * Activity Manager — Centralized execution/output manager for SubFrame.
 * Every long-running operation creates an ActivityStream that routes output
 * through a unified channel with throttled IPC broadcasts.
 */

import * as crypto from 'crypto';
import type { BrowserWindow, IpcMain } from 'electron';
import { IPC } from '../shared/ipcChannels';
import { broadcast as bridgeBroadcast } from './eventBridge';
import type {
  ActivityStream,
  ActivityStatus,
  ActivityOutputEvent,
  ActivityStatusEvent,
  ActivityListPayload,
  CreateStreamOptions,
} from '../shared/activityTypes';

// ─── Internal Types ──────────────────────────────────────────────────────────

interface InternalStream extends ActivityStream {
  /** Full output buffer (not just tail) */
  outputBuffer: string[];
  /** Max lines to keep in outputTail when broadcasting */
  maxOutputLines: number;
  /** AbortController for cancellation */
  abortController: AbortController;
  /** Heartbeat interval timer */
  heartbeatTimer: ReturnType<typeof setInterval> | null;
  /** Timeout timer */
  timeoutTimer: ReturnType<typeof setTimeout> | null;
  /** Heartbeat interval in ms */
  heartbeatInterval: number;
  /** Timeout duration in ms */
  timeout: number;
  /** Batched output lines waiting to be flushed */
  pendingBatch: string[];
  /** Flush timer for output batching */
  flushTimer: ReturnType<typeof setTimeout> | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_HISTORY = 20;
const FLUSH_INTERVAL_MS = 100;
const DEFAULT_HEARTBEAT_INTERVAL = 10000;
const DEFAULT_MAX_OUTPUT_LINES = 500;

// ─── State ───────────────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null;

/** Active streams keyed by stream ID */
const activeStreams = new Map<string, InternalStream>();

/** Recently completed streams (ring buffer, newest last) */
const history: InternalStream[] = [];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Format elapsed seconds into a human-readable string.
 */
function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

/**
 * Check if a status is terminal (no more updates expected).
 */
function isTerminalStatus(status: ActivityStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled';
}

/**
 * Convert an InternalStream to an ActivityStream for IPC transport.
 * Only includes the last N lines as outputTail instead of full buffer.
 */
function toActivityStream(internal: InternalStream): ActivityStream {
  const tail = internal.outputBuffer.length > internal.maxOutputLines
    ? internal.outputBuffer.slice(-internal.maxOutputLines)
    : [...internal.outputBuffer];

  return {
    id: internal.id,
    name: internal.name,
    type: internal.type,
    source: internal.source,
    status: internal.status,
    createdAt: internal.createdAt,
    startedAt: internal.startedAt,
    completedAt: internal.completedAt,
    progress: internal.progress,
    outputTail: tail,
    outputLineCount: internal.outputBuffer.length,
    error: internal.error,
  };
}

/**
 * Send an event to the renderer if the window is available.
 */
function send(channel: string, data: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    bridgeBroadcast(channel, data);
  }
}

/**
 * Broadcast the current status of a stream to the renderer.
 */
function broadcastStatus(internal: InternalStream): void {
  const event: ActivityStatusEvent = { stream: toActivityStream(internal) };
  send(IPC.ACTIVITY_STATUS, event);
}

/**
 * Flush pending output batch for a stream.
 */
function flushBatch(internal: InternalStream): void {
  if (internal.pendingBatch.length === 0) return;

  const lines = internal.pendingBatch.splice(0);
  const event: ActivityOutputEvent = { streamId: internal.id, lines };
  send(IPC.ACTIVITY_OUTPUT, event);

  internal.flushTimer = null;
}

/**
 * Clear all timers for a stream.
 */
function clearTimers(internal: InternalStream): void {
  if (internal.heartbeatTimer) {
    clearInterval(internal.heartbeatTimer);
    internal.heartbeatTimer = null;
  }
  if (internal.timeoutTimer) {
    clearTimeout(internal.timeoutTimer);
    internal.timeoutTimer = null;
  }
  if (internal.flushTimer) {
    clearTimeout(internal.flushTimer);
    // Flush any remaining lines before clearing
    flushBatch(internal);
    internal.flushTimer = null;
  }
}

/**
 * Move a stream from active to history (ring buffer).
 */
function moveToHistory(internal: InternalStream): void {
  activeStreams.delete(internal.id);
  // Trim memory: keep only the tail that would be sent over IPC
  if (internal.outputBuffer.length > internal.maxOutputLines) {
    internal.outputBuffer = internal.outputBuffer.slice(-internal.maxOutputLines);
  }
  history.push(internal);
  while (history.length > MAX_HISTORY) {
    history.shift();
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Initialize the activity manager with the main window reference.
 */
function init(window: BrowserWindow): void {
  mainWindow = window;
}

/**
 * Create a new activity stream. Returns the stream ID.
 */
function createStream(options: CreateStreamOptions): string {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const internal: InternalStream = {
    id,
    name: options.name,
    type: options.type,
    source: options.source,
    status: 'pending',
    createdAt: now,
    outputTail: [],
    outputLineCount: 0,
    outputBuffer: [],
    maxOutputLines: options.maxOutputLines ?? DEFAULT_MAX_OUTPUT_LINES,
    abortController: new AbortController(),
    heartbeatTimer: null,
    timeoutTimer: null,
    heartbeatInterval: options.heartbeatInterval ?? DEFAULT_HEARTBEAT_INTERVAL,
    timeout: options.timeout ?? 0,
    pendingBatch: [],
    flushTimer: null,
  };

  activeStreams.set(id, internal);
  broadcastStatus(internal);

  return id;
}

/**
 * Append an output line to a stream. Broadcasts in throttled batches.
 */
function emit(streamId: string, line: string): void {
  const internal = activeStreams.get(streamId);
  if (!internal) return;

  internal.outputBuffer.push(line);
  internal.outputLineCount = internal.outputBuffer.length;
  internal.pendingBatch.push(line);

  // Schedule a flush if not already pending
  if (!internal.flushTimer) {
    internal.flushTimer = setTimeout(() => flushBatch(internal), FLUSH_INTERVAL_MS);
  }
}

/**
 * Update the status of a stream and broadcast the change.
 */
function updateStatus(streamId: string, status: ActivityStatus, error?: string): void {
  const internal = activeStreams.get(streamId);
  if (!internal) return;

  internal.status = status;

  if (status === 'running' && !internal.startedAt) {
    internal.startedAt = new Date().toISOString();
  }

  if (error !== undefined) {
    internal.error = error;
  }

  if (isTerminalStatus(status)) {
    internal.completedAt = new Date().toISOString();
    clearTimers(internal);
    broadcastStatus(internal);
    moveToHistory(internal);
  } else {
    broadcastStatus(internal);
  }
}

/**
 * Update progress percentage for a stream and broadcast the change.
 */
function updateProgress(streamId: string, progress: number): void {
  const internal = activeStreams.get(streamId);
  if (!internal) return;

  internal.progress = Math.max(0, Math.min(100, progress));
  broadcastStatus(internal);
}

/**
 * Start a heartbeat timer that emits elapsed time at the configured interval.
 */
function startHeartbeat(streamId: string): void {
  const internal = activeStreams.get(streamId);
  if (!internal || internal.heartbeatInterval <= 0) return;

  // Clear any existing heartbeat
  if (internal.heartbeatTimer) {
    clearInterval(internal.heartbeatTimer);
  }

  const startTime = Date.now();

  internal.heartbeatTimer = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    emit(streamId, `[Heartbeat] ${formatElapsed(elapsed)}s elapsed`);
  }, internal.heartbeatInterval);
}

/**
 * Start a timeout timer. When it fires, the stream fails with a timeout error.
 */
function startTimeout(streamId: string): void {
  const internal = activeStreams.get(streamId);
  if (!internal || internal.timeout <= 0) return;

  // Clear any existing timeout
  if (internal.timeoutTimer) {
    clearTimeout(internal.timeoutTimer);
  }

  internal.timeoutTimer = setTimeout(() => {
    const seconds = Math.floor(internal.timeout / 1000);
    updateStatus(streamId, 'failed', `Timed out after ${seconds}s`);
  }, internal.timeout);
}

/**
 * Get the AbortSignal for a stream so executors can listen for cancellation.
 */
function getAbortSignal(streamId: string): AbortSignal | undefined {
  const internal = activeStreams.get(streamId);
  return internal?.abortController.signal;
}

/**
 * Cancel a stream — aborts the AbortController and sets status to cancelled.
 */
function cancelStream(streamId: string): void {
  const internal = activeStreams.get(streamId);
  if (!internal) return;

  internal.abortController.abort();
  updateStatus(streamId, 'cancelled');
}

/**
 * Remove a completed stream from history.
 */
function clearStream(streamId: string): void {
  const idx = history.findIndex(s => s.id === streamId);
  if (idx >= 0) {
    history.splice(idx, 1);
  }
}

// ─── IPC ─────────────────────────────────────────────────────────────────────

/**
 * Setup IPC handlers for activity stream operations.
 */
function setupIPC(ipc: IpcMain): void {
  // ACTIVITY_LIST — return all active + recent completed streams
  ipc.handle(IPC.ACTIVITY_LIST, (): ActivityListPayload => {
    const streams: ActivityStream[] = [];

    // Active streams
    for (const internal of activeStreams.values()) {
      streams.push(toActivityStream(internal));
    }

    // Recent history
    for (const internal of history) {
      streams.push(toActivityStream(internal));
    }

    return { streams };
  });

  // ACTIVITY_CANCEL — cancel an active stream
  ipc.handle(IPC.ACTIVITY_CANCEL, (_event, streamId: string): { success: boolean } => {
    if (!activeStreams.has(streamId)) {
      return { success: false };
    }
    cancelStream(streamId);
    return { success: true };
  });

  // ACTIVITY_CLEAR — remove a completed stream from history
  ipc.on(IPC.ACTIVITY_CLEAR, (_event, streamId: string) => {
    clearStream(streamId);
  });
}

/** Check if any activity streams are currently running */
function hasActiveStreams(): boolean {
  for (const stream of activeStreams.values()) {
    if (stream.status === 'running') return true;
  }
  return false;
}

export {
  init,
  setupIPC,
  createStream,
  emit,
  updateStatus,
  updateProgress,
  startHeartbeat,
  startTimeout,
  getAbortSignal,
  cancelStream,
  clearStream,
  hasActiveStreams,
};
