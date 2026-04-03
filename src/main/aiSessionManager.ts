import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { IpcMain } from 'electron';
import * as activityManager from './activityManager';
import * as ptyManager from './ptyManager';
import { broadcast } from './eventBridge';
import {
  buildInteractiveAICommand,
  getInteractiveToolConfig,
  type AIInteractiveInputMethod,
  type AIInteractiveToolConfig,
} from './aiExecutionManager';
import { extractMarkedBlock, type StructuredResultMarkers } from './aiOutputParser';
import {
  IPC,
  type AISessionSummary,
  type AISessionsPayload,
} from '../shared/ipcChannels';
import type { ActivitySource } from '../shared/activityTypes';
import { appendTerminalTranscriptChunk, renderTerminalTranscript } from '../shared/terminalTranscript';
import { log as outputLog } from './outputChannelManager';

export type AISessionStatus = 'starting' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface AISession {
  id: string;
  name: string;
  toolId: string;
  source: ActivitySource;
  projectPath: string;
  terminalId: string;
  activityStreamId: string | null;
  outputHandlerId: string;
  transcriptRaw: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  lastOutputAt: number;
  status: AISessionStatus;
  startCommand: string | null;
  error: string | null;
}

interface CreateAISessionOptions {
  name: string;
  toolId: string;
  source: ActivitySource;
  projectPath: string;
  activityStreamId?: string | null;
  workingDirectory?: string | null;
  shellPath?: string | null;
  /** Spawn a command directly instead of through a shell (bypasses ConPTY buffering on Windows). */
  directSpawn?: { command: string; args: string[] };
  /** Set false to disable conptyInheritCursor (fixes output delay for background terminals). */
  conptyInheritCursor?: boolean;
}

interface RunInteractivePromptOptions {
  name: string;
  toolId: string;
  source: ActivitySource;
  command: string;
  shellCommand?: string;
  prompt: string;
  projectPath: string;
  activityStreamId?: string | null;
  workingDirectory?: string | null;
  shellPath?: string | null;
  inactivityTimeoutMs?: number;
  hardTimeoutMs?: number;
  completionQuietMs?: number;
  renderMaxLines?: number;
  resultMarkers?: StructuredResultMarkers | null;
  destroyTerminalOnFinish?: boolean;
  abortSignal?: AbortSignal;
  onVisibleLines?: (lines: string[], renderedText: string) => void;
}

interface InteractivePromptResult {
  sessionId: string;
  terminalId: string;
  renderedText: string;
  resultText: string | null;
}

const sessions = new Map<string, AISession>();
const dataListeners = new Map<string, Map<string, (data: string) => void>>();

function getDefaultAIShell(): string | null {
  if (process.platform === 'win32') {
    return process.env.COMSPEC || 'cmd.exe';
  }
  return process.env.SHELL || '/bin/bash';
}

function nowIso(): string {
  return new Date().toISOString();
}

function toSummary(session: AISession): AISessionSummary {
  return {
    id: session.id,
    name: session.name,
    toolId: session.toolId,
    source: session.source,
    projectPath: session.projectPath,
    terminalId: session.terminalId,
    activityStreamId: session.activityStreamId,
    createdAt: session.createdAt,
    startedAt: session.startedAt,
    completedAt: session.completedAt,
    status: session.status,
    startCommand: session.startCommand,
    error: session.error,
  };
}

function listSessions(projectPath?: string | null): AISessionSummary[] {
  return Array.from(sessions.values())
    .filter((session) => !projectPath || session.projectPath === projectPath)
    .sort((left, right) => {
      const runningWeight = left.status === 'running' ? -1 : right.status === 'running' ? 1 : 0;
      if (runningWeight !== 0) return runningWeight;
      return right.createdAt.localeCompare(left.createdAt);
    })
    .map(toSummary);
}

function broadcastSessionsUpdated(): void {
  const payload: AISessionsPayload = { sessions: listSessions() };
  broadcast(IPC.AI_SESSIONS_UPDATED, payload);
}

function getSession(sessionId: string): AISession | null {
  return sessions.get(sessionId) ?? null;
}

function getSessionByTerminalId(terminalId: string): AISession | null {
  for (const session of sessions.values()) {
    if (session.terminalId === terminalId) return session;
  }
  return null;
}

function createSession(options: CreateAISessionOptions): AISession {
  const terminalId = options.directSpawn
    ? ptyManager.spawnDirect(
        options.directSpawn.command,
        options.directSpawn.args,
        options.workingDirectory ?? options.projectPath,
        options.projectPath,
        200,
        50,
      )
    : ptyManager.createTerminal(
        options.workingDirectory ?? options.projectPath,
        options.projectPath,
        options.shellPath ?? getDefaultAIShell(),
        200,
        50,
        { conptyInheritCursor: options.conptyInheritCursor },
      );
  const id = crypto.randomUUID();
  const outputHandlerId = `ai-session-${id}`;
  const session: AISession = {
    id,
    name: options.name,
    toolId: options.toolId,
    source: options.source,
    projectPath: options.projectPath,
    terminalId,
    activityStreamId: options.activityStreamId ?? null,
    outputHandlerId,
    transcriptRaw: '',
    createdAt: nowIso(),
    startedAt: null,
    completedAt: null,
    lastOutputAt: Date.now(),
    status: 'starting',
    startCommand: null,
    error: null,
  };

  ptyManager.addOutputHandler(terminalId, (data) => {
    const current = sessions.get(id);
    if (!current) return;
    current.transcriptRaw = appendTerminalTranscriptChunk(current.transcriptRaw, data, 256 * 1024);
    current.lastOutputAt = Date.now();
    const listeners = dataListeners.get(id);
    if (listeners) {
      listeners.forEach((listener) => listener(data));
    }
  }, outputHandlerId);

  sessions.set(id, session);
  outputLog('agent', `AI session created: "${options.name}" (${options.toolId})`);
  broadcastSessionsUpdated();
  return session;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function translateKeySequence(keys: string): string {
  const parts = keys.trim().split(/\s+/);
  let result = '';

  for (const part of parts) {
    switch (part) {
      case 'C-c':
        result += '\x03';
        break;
      case 'C-d':
        result += '\x04';
        break;
      case 'C-m':
      case 'Enter':
        result += '\r';
        break;
      case 'C-a':
        result += '\x01';
        break;
      case 'C-e':
        result += '\x05';
        break;
      case 'C-l':
        result += '\x0c';
        break;
      case 'C-z':
        result += '\x1a';
        break;
      case 'Escape':
        result += '\x1b';
        break;
      case 'Tab':
        result += '\t';
        break;
      case 'Space':
        result += ' ';
        break;
      case 'BSpace':
        result += '\x7f';
        break;
      case 'Up':
        result += '\x1b[A';
        break;
      case 'Down':
        result += '\x1b[B';
        break;
      case 'Right':
        result += '\x1b[C';
        break;
      case 'Left':
        result += '\x1b[D';
        break;
      default:
        if (/^C-[a-z]$/.test(part)) {
          const charCode = part.charCodeAt(2) - 96;
          result += String.fromCharCode(charCode);
        } else {
          result += part;
        }
    }
  }

  return result;
}

// Bracketed paste escape sequences — tells the TUI "this is a paste, not typing"
// so newlines stay in the input area instead of triggering submit.
const BRACKETED_PASTE_START = '\x1b[200~';
const BRACKETED_PASTE_END = '\x1b[201~';

function sendKeys(
  sessionId: string,
  keys: string,
  opts: { literal?: boolean; enter?: boolean; bracketedPaste?: boolean } = {},
): AISession {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error(`AI session "${sessionId}" not found`);
  }
  const { literal = false, enter = false, bracketedPaste = false } = opts;
  const payload = literal ? keys : translateKeySequence(keys);
  if (payload.length > 0) {
    if (bracketedPaste) {
      ptyManager.writeToTerminal(session.terminalId, BRACKETED_PASTE_START + payload + BRACKETED_PASTE_END);
    } else {
      ptyManager.writeToTerminal(session.terminalId, payload);
    }
  }
  if (enter) {
    ptyManager.writeToTerminal(session.terminalId, '\r');
  }
  session.lastOutputAt = Date.now();
  return session;
}

function startSessionCommand(sessionId: string, command: string): AISession {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error(`AI session "${sessionId}" not found`);
  }
  session.startCommand = command;
  session.startedAt = nowIso();
  session.status = 'running';
  broadcastSessionsUpdated();
  return sendKeys(sessionId, command, { literal: true, enter: true });
}

async function pasteFromFile(sessionId: string, filePath: string): Promise<AISession> {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error(`AI session "${sessionId}" not found`);
  }
  const content = fs.readFileSync(filePath, 'utf8');
  // Use bracketed paste so multi-line content stays in the TUI's input area
  // instead of each newline triggering a submit.
  ptyManager.writeToTerminal(session.terminalId, BRACKETED_PASTE_START + content + BRACKETED_PASTE_END);
  await delay(1000);
  ptyManager.writeToTerminal(session.terminalId, '\r');
  await delay(300);
  ptyManager.writeToTerminal(session.terminalId, '\r');
  session.lastOutputAt = Date.now();
  return session;
}

async function waitForReady(
  sessionId: string,
  config: Pick<AIInteractiveToolConfig, 'readyMarkers' | 'readyTimeoutMs' | 'settleDelayMs' | 'fallbackQuietMs'>,
): Promise<{ matchedMarker: string | null }> {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error(`AI session "${sessionId}" not found`);
  }

  const start = Date.now();
  let lastRendered = '';
  let lastChangeAt = Date.now();

  while (Date.now() - start < config.readyTimeoutMs) {
    const current = sessions.get(sessionId);
    if (!current) {
      throw new Error(`AI session "${sessionId}" not found`);
    }

    const rendered = renderTerminalTranscript(current.transcriptRaw, { maxLines: 200 }).text;
    if (rendered !== lastRendered) {
      lastRendered = rendered;
      lastChangeAt = Date.now();
    }

    const matchedMarker = config.readyMarkers.find((marker) => rendered.includes(marker));
    if (matchedMarker && Date.now() - lastChangeAt >= config.fallbackQuietMs) {
      await delay(config.settleDelayMs);
      return { matchedMarker };
    }

    if (config.readyMarkers.length > 0) {
      await delay(250);
      continue;
    }

    if (
      rendered.trim().length > 0 &&
      Date.now() - lastChangeAt >= config.fallbackQuietMs
    ) {
      await delay(Math.min(config.settleDelayMs, 1000));
      return { matchedMarker: null };
    }

    await delay(250);
  }

  return { matchedMarker: null };
}

async function sendPromptFromFile(
  sessionId: string,
  filePath: string,
  inputMethod: AIInteractiveInputMethod,
): Promise<AISession> {
  if (inputMethod === 'pasteFromFile') {
    return pasteFromFile(sessionId, filePath);
  }

  // Use bracketed paste for multi-line prompts so newlines stay in the TUI
  // input area instead of each newline triggering a submit.
  const prompt = fs.readFileSync(filePath, 'utf8');
  const isMultiLine = prompt.includes('\n');
  return sendKeys(sessionId, prompt, { literal: true, enter: true, bracketedPaste: isMultiLine });
}

async function launchInteractiveSession(
  sessionId: string,
  command: string,
  promptFilePath: string,
  config: AIInteractiveToolConfig,
): Promise<void> {
  await delay(config.startupDelayMs);
  const session = getSession(sessionId);
  if (session) {
    try {
      ptyManager.resizeTerminal(session.terminalId, 200, 50);
      await delay(50);
    } catch {
      // Ignore geometry nudge failures; the session can still continue.
    }
  }
  startSessionCommand(sessionId, command);
  await waitForReady(sessionId, config);
  await sendPromptFromFile(sessionId, promptFilePath, config.inputMethod);
}

function markSessionStatus(sessionId: string, status: AISessionStatus, error?: string): AISession | null {
  const session = sessions.get(sessionId);
  if (!session) return null;
  session.status = status;
  if (status === 'completed' || status === 'failed' || status === 'cancelled') {
    session.completedAt = nowIso();
  }
  session.error = error ?? null;
  if (status === 'failed' || status === 'cancelled') {
    outputLog('agent', `AI session ${status}: "${session.name}" (${session.toolId})${error ? ` — ${error}` : ''}`);
  } else if (status === 'completed') {
    outputLog('agent', `AI session completed: "${session.name}" (${session.toolId})`);
  }
  broadcastSessionsUpdated();
  return session;
}

function getTranscript(sessionId: string): string {
  return sessions.get(sessionId)?.transcriptRaw ?? '';
}

function capturePane(sessionId: string): string {
  return getTranscript(sessionId);
}

function addDataListener(sessionId: string, listener: (data: string) => void): string {
  if (!sessions.has(sessionId)) {
    throw new Error(`AI session "${sessionId}" not found`);
  }
  const listenerId = crypto.randomUUID();
  let listeners = dataListeners.get(sessionId);
  if (!listeners) {
    listeners = new Map();
    dataListeners.set(sessionId, listeners);
  }
  listeners.set(listenerId, listener);
  return listenerId;
}

function removeDataListener(sessionId: string, listenerId: string): void {
  const listeners = dataListeners.get(sessionId);
  if (!listeners) return;
  listeners.delete(listenerId);
  if (listeners.size === 0) {
    dataListeners.delete(sessionId);
  }
}

function destroySession(sessionId: string, options?: { destroyTerminal?: boolean }): void {
  const session = sessions.get(sessionId);
  if (!session) return;
  ptyManager.removeOutputHandler(session.terminalId, session.outputHandlerId);
  dataListeners.delete(sessionId);
  if (options?.destroyTerminal) {
    try {
      ptyManager.destroyTerminal(session.terminalId);
    } catch {
      // ignore terminal teardown failures
    }
  }
  sessions.delete(sessionId);
  broadcastSessionsUpdated();
}

function looksLikeShellPrompt(line: string): boolean {
  const trimmed = line.trimEnd();
  if (!trimmed) return false;
  if (!/[>$#]$/.test(trimmed)) return false;
  if (/^\$\s+\S+/.test(trimmed)) return false;
  if (/^>\s_/.test(trimmed)) return false;
  return /(?:[A-Za-z]:\\|~\/|\/|\\|@|PS\s)/.test(trimmed) || /\([^)]+\)[>$#]$/.test(trimmed);
}

async function runInteractivePrompt(
  options: RunInteractivePromptOptions,
): Promise<InteractivePromptResult> {
  const promptFile = path.join(
    os.tmpdir(),
    `sf-ai-session-prompt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.txt`,
  );
  fs.writeFileSync(promptFile, options.prompt, 'utf8');

  const interactiveConfig = getInteractiveToolConfig(options.toolId);
  const shellCommand = options.shellCommand ?? buildInteractiveAICommand(options.toolId, options.command);
  const session = createSession({
    name: options.name,
    toolId: options.toolId,
    source: options.source,
    projectPath: options.projectPath,
    activityStreamId: options.activityStreamId ?? null,
    workingDirectory: options.workingDirectory ?? options.projectPath,
    shellPath: options.shellPath ?? null,
    // conptyInheritCursor: false — prevents ConPTY from deferring output on Windows
    // when no renderer is immediately attached (background AI sessions).
    conptyInheritCursor: false,
  });

  const { id: sessionId, terminalId } = session;
  if (options.activityStreamId) {
    activityManager.attachTerminal(options.activityStreamId, terminalId);
  }

  broadcast(IPC.TERMINAL_CREATED, {
    terminalId,
    success: true,
    projectPath: options.projectPath,
    name: options.name,
    background: true,
  });

  return new Promise<InteractivePromptResult>((resolve, reject) => {
    let settled = false;
    let emittedTranscriptLines = 0;
    let sawInteractiveOutput = false;
    let lastOutputAt = Date.now();
    let abortListener: (() => void) | null = null;
    let stallTimer: ReturnType<typeof setInterval> | null = null;
    let completionTimer: ReturnType<typeof setInterval> | null = null;

    const listenerId = addDataListener(sessionId, () => {
      if (settled) return;
      const fullRendered = renderTerminalTranscript(getTranscript(sessionId));
      const visibleLines = options.renderMaxLines && options.renderMaxLines > 0
        ? fullRendered.lines.slice(-options.renderMaxLines)
        : fullRendered.lines;
      const visibleText = visibleLines.join('\n');
      const freshLines = fullRendered.lines
        .slice(emittedTranscriptLines)
        .filter((line) => line.trim().length > 0);
      const filteredFreshLines = options.resultMarkers
        ? freshLines.filter((line) => {
            const trimmed = line.trim();
            return trimmed !== options.resultMarkers?.startMarker
              && trimmed !== options.resultMarkers?.endMarker
              && trimmed !== options.resultMarkers?.afterMarker;
          })
        : freshLines;

      if (freshLines.length > 0 || visibleText.trim().length > 0) {
        lastOutputAt = Date.now();
      }

      if (filteredFreshLines.length > 0) {
        if (options.activityStreamId) {
          for (const line of filteredFreshLines) {
            activityManager.emit(options.activityStreamId, line);
          }
        }
        options.onVisibleLines?.(filteredFreshLines, visibleText);
        if (filteredFreshLines.some((line) => !looksLikeShellPrompt(line))) {
          sawInteractiveOutput = true;
        }
      }

      emittedTranscriptLines = fullRendered.lines.length;
    });

    const cleanup = () => {
      if (stallTimer) {
        clearInterval(stallTimer);
        stallTimer = null;
      }
      if (completionTimer) {
        clearInterval(completionTimer);
        completionTimer = null;
      }
      if (abortListener && options.abortSignal) {
        options.abortSignal.removeEventListener('abort', abortListener);
        abortListener = null;
      }
      removeDataListener(sessionId, listenerId);
      try {
        fs.unlinkSync(promptFile);
      } catch {
        // ignore temp file cleanup failures
      }
    };

    const finish = (renderedText: string, resultText: string | null = null) => {
      if (settled) return;
      settled = true;
      markSessionStatus(sessionId, 'completed');
      cleanup();
      destroySession(sessionId, { destroyTerminal: options.destroyTerminalOnFinish ?? true });
      resolve({ sessionId, terminalId, renderedText, resultText });
    };

    const fail = (error: Error, status: 'failed' | 'cancelled' = 'failed') => {
      if (settled) return;
      settled = true;
      try {
        ptyManager.writeToTerminal(terminalId, '\x03');
      } catch {
        // ignore
      }
      markSessionStatus(sessionId, status, error.message);
      cleanup();
      destroySession(sessionId, { destroyTerminal: options.destroyTerminalOnFinish ?? true });
      (error as Error & { terminalId?: string; sessionId?: string }).terminalId = terminalId;
      (error as Error & { terminalId?: string; sessionId?: string }).sessionId = sessionId;
      reject(error);
    };

    if (options.abortSignal) {
      abortListener = () => {
        const reason = typeof options.abortSignal?.reason === 'string'
          ? options.abortSignal.reason
          : 'AI session cancelled.';
        fail(new Error(reason), /cancelled/i.test(reason) ? 'cancelled' : 'failed');
      };
      options.abortSignal.addEventListener('abort', abortListener, { once: true });
    }

    const inactivityTimeoutMs = options.inactivityTimeoutMs ?? 3 * 60_000;
    const hardTimeoutMs = options.hardTimeoutMs ?? Math.max(inactivityTimeoutMs * 4, 10 * 60_000);
    const completionQuietMs = options.completionQuietMs ?? 1_200;
    const startedAt = Date.now();

    stallTimer = setInterval(() => {
      if (settled) return;
      const inactivityMs = Date.now() - lastOutputAt;
      const elapsedMs = Date.now() - startedAt;
      if (inactivityMs >= inactivityTimeoutMs) {
        fail(new Error(`AI session timed out after ${Math.floor(inactivityTimeoutMs / 1000)} seconds without output.`));
        return;
      }
      if (elapsedMs >= hardTimeoutMs) {
        fail(new Error(`AI session timed out after ${Math.floor(hardTimeoutMs / 1000)} seconds total runtime.`));
      }
    }, 5_000);

    completionTimer = setInterval(() => {
      if (settled) return;
      const rendered = renderTerminalTranscript(getTranscript(sessionId));
      const resultText = options.resultMarkers
        ? extractMarkedBlock(rendered.text, options.resultMarkers)
        : null;
      const trimmedLines = rendered.lines.map((line) => line.trimEnd()).filter(Boolean);
      const lastLine = trimmedLines[trimmedLines.length - 1] ?? '';
      const quietMs = Date.now() - lastOutputAt;

      if (resultText) {
        finish(rendered.text, resultText);
        return;
      }

      if (sawInteractiveOutput && quietMs >= completionQuietMs && looksLikeShellPrompt(lastLine)) {
        finish(rendered.text, null);
        return;
      }

      if (!ptyManager.hasTerminal(terminalId)) {
        if (rendered.text.trim().length > 0) {
          finish(rendered.text, resultText);
        } else {
          fail(new Error('AI session exited before producing output.'));
        }
      }
    }, 750);

    void launchInteractiveSession(sessionId, shellCommand, promptFile, interactiveConfig).catch((err) => {
      fail(new Error(`Failed to launch AI session: ${(err as Error).message}`));
    });
  });
}

function setupIPC(ipcMain: IpcMain): void {
  ipcMain.handle(IPC.LIST_AI_SESSIONS, (_event, projectPath: string | null) => ({
    sessions: listSessions(projectPath),
  }));
}

export {
  addDataListener,
  capturePane,
  createSession,
  destroySession,
  getSession,
  getSessionByTerminalId,
  getTranscript,
  launchInteractiveSession,
  listSessions,
  markSessionStatus,
  pasteFromFile,
  removeDataListener,
  runInteractivePrompt,
  sendKeys,
  sendPromptFromFile,
  setupIPC,
  startSessionCommand,
  waitForReady,
};
