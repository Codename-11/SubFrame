/**
 * Activity Streams — Shared types for the centralized execution/output system.
 * Every long-running operation (AI tool, pipeline stage, onboarding, script)
 * creates an ActivityStream that routes output through a unified channel.
 */

// ─── Activity Stream Types ──────────────────────────────────────────────────

export type ActivityStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/** What kind of executor is running */
export type ActivityType = 'spawn' | 'agent' | 'pty' | 'script' | 'plugin';

/** Which system created the stream */
export type ActivitySource = 'onboarding' | 'pipeline' | 'tasks' | 'plugin' | 'system';

/** A single execution stream — the core abstraction */
export interface ActivityStream {
  id: string;
  name: string;
  type: ActivityType;
  source: ActivitySource;
  terminalId?: string;
  status: ActivityStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  /** Optional progress 0-100 */
  progress?: number;
  /** Recent output lines (capped ring buffer, main process holds full buffer) */
  outputTail: string[];
  /** Total line count (may exceed outputTail.length) */
  outputLineCount: number;
  /** Error message if status === 'failed' */
  error?: string;
}

// ─── IPC Event Payloads ─────────────────────────────────────────────────────

/** Emitted per output line (or batch of lines) */
export interface ActivityOutputEvent {
  streamId: string;
  lines: string[];
}

/** Emitted on status/progress changes */
export interface ActivityStatusEvent {
  stream: ActivityStream;
}

/** Request to get all active + recent streams */
export interface ActivityListPayload {
  streams: ActivityStream[];
}

// ─── Output Channels ─────────────────────────────────────────────────────────

export type OutputChannelCategory = 'system' | 'git' | 'github' | 'pipeline' | 'agent' | 'extension' | 'api';

export interface OutputChannel {
  id: string;
  name: string;
  category: OutputChannelCategory;
  lineCount: number;
  updatedAt: string;
}

export interface OutputChannelEvent {
  channelId: string;
  lines: string[];
}

export interface OutputChannelListPayload {
  channels: OutputChannel[];
}

export interface OutputChannelLogPayload {
  channelId: string;
  lines: string[];
}

// ─── Executor Options (main process) ────────────────────────────────────────

export interface CreateStreamOptions {
  name: string;
  type: ActivityType;
  source: ActivitySource;
  terminalId?: string;
  /** Timeout in ms (0 = no timeout) */
  timeout?: number;
  /** Heartbeat interval in ms (0 = no heartbeat). Default: 10000 */
  heartbeatInterval?: number;
  /** Max output lines to keep in ring buffer. Default: 500 */
  maxOutputLines?: number;
}
