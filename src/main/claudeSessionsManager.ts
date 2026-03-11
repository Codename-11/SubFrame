/**
 * Claude Sessions Manager Module
 * Reads Claude Code session history from ~/.claude/projects/
 * Scans individual .jsonl session files and extracts metadata
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { BrowserWindow, IpcMain } from 'electron';
import { IPC, type SessionSegment } from '../shared/ipcChannels';
import * as ptyManager from './ptyManager';

interface SessionEntry {
  sessionId?: string;
  slug?: string;
  gitBranch?: string;
  isSidechain?: boolean;
  timestamp?: string;
  type?: string;
  message?: unknown;
  customTitle?: string;
}

interface ContentBlock {
  type: string;
  text?: string;
}

interface ParsedSession {
  sessionId: string;
  customTitle: string;
  slug: string;
  gitBranch: string;
  isSidechain: boolean;
  firstPrompt: string;
  messageCount: number;
  modified: string;
  created: string;
  state: 'active' | 'recent' | 'inactive';
}

interface GroupedSession extends ParsedSession {
  segmentCount: number;
  friendlyName?: string;
  segments?: SessionSegment[];
}

/** SubFrame session metadata (stored per-project, not in Claude's JSONL files) */
interface SessionMeta {
  aliases: Record<string, string>; // sessionId → friendly name
}

const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects');

/**
 * Initialize sessions manager
 */
function init(_window: BrowserWindow): void {
}

/**
 * Encode project path to Claude's directory format
 */
function encodeProjectPath(projectPath: string): string {
  return projectPath.replace(/[\\/]/g, '-').replace(/:/g, '-');
}

/**
 * Extract readable text from a JSONL message field.
 */
function extractMessageText(message: unknown): string {
  if (!message) return '';
  if (typeof message === 'string') return message;
  if (typeof message !== 'object') return String(message);

  const msg = message as { content?: unknown };
  const content = msg.content;
  if (!content) return '';
  if (typeof content === 'string') return content;

  // Array of content blocks (Claude API format)
  if (Array.isArray(content)) {
    return (content as ContentBlock[])
      .filter(block => block.type === 'text' && block.text)
      .map(block => block.text!)
      .join(' ');
  }

  return String(content);
}

/**
 * Parse a single .jsonl session file and extract metadata
 */
function parseSessionFile(filePath: string): ParsedSession | null {
  const stat = fs.statSync(filePath);
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').filter(l => l.trim());

  if (lines.length === 0) return null;

  // First line contains session metadata
  const firstLine: SessionEntry = JSON.parse(lines[0]);

  let firstPrompt = '';
  let messageCount = 0;
  let customTitle = '';
  let slug = firstLine.slug || '';

  for (const line of lines) {
    try {
      const entry: SessionEntry = JSON.parse(line);

      if (entry.type === 'user' || entry.type === 'assistant') {
        messageCount++;
      }

      // Capture slug from the first line that has one
      if (!slug && entry.slug) {
        slug = entry.slug;
      }

      // Capture user-set session name (last one wins, in case of renames)
      if (entry.type === 'custom-title' && entry.customTitle) {
        customTitle = entry.customTitle;
      }

      // Find first real user message for summary
      if (!firstPrompt && entry.type === 'user') {
        const text = extractMessageText(entry.message);
        // Skip system-injected messages and command outputs
        if (text &&
            !text.includes('local-command-caveat') &&
            !text.includes('<command-name>') &&
            !text.includes('<local-command-stdout>') &&
            !text.includes('<local-command-stderr>') &&
            !text.includes('<system-reminder>')) {
          // Strip any remaining XML/HTML tags and clean whitespace
          const clean = text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
          if (clean) firstPrompt = clean.substring(0, 200);
        }
      }
    } catch {
      // Skip malformed lines
    }
  }

  // Determine session state based on modification recency
  const modifiedMs = stat.mtime.getTime();
  const nowMs = Date.now();
  const diffMin = (nowMs - modifiedMs) / 60000;
  let sessionState: 'active' | 'recent' | 'inactive' = 'inactive';
  if (diffMin < 2) sessionState = 'active';
  else if (diffMin < 60) sessionState = 'recent';

  return {
    sessionId: firstLine.sessionId || path.basename(filePath, '.jsonl'),
    customTitle,
    slug,
    gitBranch: firstLine.gitBranch || '',
    isSidechain: firstLine.isSidechain || false,
    firstPrompt,
    messageCount,
    modified: stat.mtime.toISOString(),
    created: new Date(firstLine.timestamp || stat.birthtime).toISOString(),
    state: sessionState
  };
}

/**
 * Group parsed sessions by slug (conversation chain).
 */
function groupSessionsBySlug(sessions: ParsedSession[]): GroupedSession[] {
  const slugGroups = new Map<string, ParsedSession[]>();
  const standalone: ParsedSession[] = [];

  for (const session of sessions) {
    if (session.slug) {
      if (!slugGroups.has(session.slug)) {
        slugGroups.set(session.slug, []);
      }
      slugGroups.get(session.slug)!.push(session);
    } else {
      standalone.push(session);
    }
  }

  const STATE_PRIORITY: Record<string, number> = { active: 2, recent: 1, inactive: 0 };

  const grouped: GroupedSession[] = [];
  for (const [slug, group] of slugGroups) {
    // Sort segments: most recently modified first
    group.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());

    const newest = group[0];
    const oldest = group.reduce((o, s) =>
      new Date(s.created).getTime() < new Date(o.created).getTime() ? s : o, group[0]);

    // Pick the best firstPrompt — from the oldest (root) segment
    const firstPrompt = oldest.firstPrompt ||
      group.find(s => s.firstPrompt)?.firstPrompt || '';

    // customTitle: last set across the chain (newest file first, so first non-empty wins)
    const customTitle = group.find(s => s.customTitle)?.customTitle || '';

    // Most active state in the group
    const bestState = group.reduce((best, s) =>
      (STATE_PRIORITY[s.state] || 0) > (STATE_PRIORITY[best] || 0) ? s.state : best,
      'inactive' as 'active' | 'recent' | 'inactive');

    // Build segments array for multi-segment chains (sorted oldest→newest for chronological timeline)
    const segments: SessionSegment[] | undefined = group.length > 1
      ? [...group]
          .sort((a, b) => new Date(a.created).getTime() - new Date(b.created).getTime())
          .map(s => ({
            sessionId: s.sessionId,
            firstPrompt: s.firstPrompt,
            messageCount: s.messageCount,
            created: s.created,
            modified: s.modified,
            state: s.state,
            gitBranch: s.gitBranch,
          }))
      : undefined;

    grouped.push({
      sessionId: newest.sessionId,
      customTitle,
      slug,
      gitBranch: newest.gitBranch,
      isSidechain: group.some(s => s.isSidechain),
      firstPrompt,
      messageCount: group.reduce((sum, s) => sum + s.messageCount, 0),
      segmentCount: group.length,
      modified: newest.modified,
      created: oldest.created,
      state: bestState,
      segments,
    });
  }

  // Standalone sessions get segmentCount: 1
  for (const s of standalone) {
    grouped.push({ ...s, segmentCount: 1 });
  }

  return grouped;
}

/**
 * Get sessions for a given project path
 */
function getSessionsForProject(projectPath: string): GroupedSession[] {
  if (!projectPath) return [];

  const encodedPath = encodeProjectPath(projectPath);
  const projectDir = path.join(PROJECTS_DIR, encodedPath);

  try {
    if (!fs.existsSync(projectDir)) return [];

    const files = fs.readdirSync(projectDir).filter(f => f.endsWith('.jsonl'));
    const sessions: ParsedSession[] = [];

    for (const file of files) {
      try {
        const session = parseSessionFile(path.join(projectDir, file));
        if (session) sessions.push(session);
      } catch (err) {
        console.error(`Error parsing session file ${file}:`, (err as Error).message);
      }
    }

    // Group by conversation chain, apply friendly names, then sort by most recent activity
    const grouped = groupSessionsBySlug(sessions);
    applyFriendlyNames(grouped, projectPath);
    return grouped.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
  } catch (err) {
    console.error('Error reading sessions directory:', err);
    return [];
  }
}

// ─── Session metadata (SubFrame-managed, stored alongside Claude's project dir) ──

const META_FILENAME = '.subframe-session-meta.json';

function getMetaPath(projectPath: string): string {
  const encodedPath = encodeProjectPath(projectPath);
  return path.join(PROJECTS_DIR, encodedPath, META_FILENAME);
}

function loadMeta(projectPath: string): SessionMeta {
  try {
    const metaPath = getMetaPath(projectPath);
    if (fs.existsSync(metaPath)) {
      return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    }
  } catch {
    // Corrupted or missing
  }
  return { aliases: {} };
}

function saveMeta(projectPath: string, meta: SessionMeta): void {
  try {
    const metaPath = getMetaPath(projectPath);
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving session metadata:', err);
  }
}

/**
 * Apply friendly names from SubFrame metadata to grouped sessions
 */
function applyFriendlyNames(sessions: GroupedSession[], projectPath: string): GroupedSession[] {
  const meta = loadMeta(projectPath);
  for (const session of sessions) {
    const alias = meta.aliases[session.sessionId] || meta.aliases[session.slug];
    if (alias) {
      session.friendlyName = alias;
    }
  }
  return sessions;
}

/**
 * Set a friendly name for a session.
 * Stores alias under BOTH sessionId and slug so the name survives
 * session compaction (which creates a new segment with a new sessionId
 * but the same slug).
 */
function renameSession(projectPath: string, sessionId: string, name: string): boolean {
  try {
    const meta = loadMeta(projectPath);
    const trimmed = name.trim();

    // Find the slug for this session so we can key by slug too
    const sessions = getSessionsForProject(projectPath);
    const session = sessions.find(s => s.sessionId === sessionId);
    const slug = session?.slug;

    if (trimmed) {
      meta.aliases[sessionId] = trimmed;
      if (slug) meta.aliases[slug] = trimmed;
    } else {
      delete meta.aliases[sessionId];
      if (slug) delete meta.aliases[slug];
    }
    saveMeta(projectPath, meta);
    return true;
  } catch (err) {
    console.error('Error renaming session:', err);
    return false;
  }
}

/**
 * Delete a session and all its JSONL segments (by slug or sessionId)
 */
function deleteSession(projectPath: string, sessionId: string, slug: string): boolean {
  if (!projectPath) return false;

  const encodedPath = encodeProjectPath(projectPath);
  const projectDir = path.join(PROJECTS_DIR, encodedPath);

  try {
    if (!fs.existsSync(projectDir)) return false;

    const files = fs.readdirSync(projectDir).filter(f => f.endsWith('.jsonl'));
    let deleted = false;

    for (const file of files) {
      try {
        const filePath = path.join(projectDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const firstLine = content.split('\n')[0];
        if (!firstLine) continue;

        const entry: SessionEntry = JSON.parse(firstLine);
        const fileSessionId = entry.sessionId || path.basename(file, '.jsonl');
        const fileSlug = entry.slug || '';

        // Match by sessionId or by slug (to delete entire conversation chain)
        if (fileSessionId === sessionId || (slug && fileSlug === slug)) {
          fs.unlinkSync(filePath);
          deleted = true;
        }
      } catch {
        // Skip unreadable files
      }
    }

    // Clean up alias
    if (deleted) {
      const meta = loadMeta(projectPath);
      delete meta.aliases[sessionId];
      if (slug) delete meta.aliases[slug];
      saveMeta(projectPath, meta);
    }

    return deleted;
  } catch (err) {
    console.error('Error deleting session:', err);
    return false;
  }
}

/**
 * Delete all sessions for a project
 */
function deleteAllSessions(projectPath: string): { deleted: number } {
  if (!projectPath) return { deleted: 0 };

  const encodedPath = encodeProjectPath(projectPath);
  const projectDir = path.join(PROJECTS_DIR, encodedPath);

  try {
    if (!fs.existsSync(projectDir)) return { deleted: 0 };

    const files = fs.readdirSync(projectDir).filter(f => f.endsWith('.jsonl'));
    let count = 0;

    for (const file of files) {
      try {
        fs.unlinkSync(path.join(projectDir, file));
        count++;
      } catch {
        // Skip undeletable files
      }
    }

    // Clear all aliases
    saveMeta(projectPath, { aliases: {} });

    return { deleted: count };
  } catch (err) {
    console.error('Error deleting all sessions:', err);
    return { deleted: 0 };
  }
}

/**
 * Lightweight check: does the project have any active Claude session?
 */
function hasActiveSession(projectPath: string): boolean {
  if (!projectPath) return false;

  const encodedPath = encodeProjectPath(projectPath);
  const projectDir = path.join(PROJECTS_DIR, encodedPath);

  try {
    if (!fs.existsSync(projectDir)) return false;

    const files = fs.readdirSync(projectDir).filter(f => f.endsWith('.jsonl'));
    const nowMs = Date.now();

    for (const file of files) {
      try {
        const stat = fs.statSync(path.join(projectDir, file));
        const diffMin = (nowMs - stat.mtime.getTime()) / 60000;
        if (diffMin < 2) return true;
      } catch {
        // Skip unreadable files
      }
    }
  } catch {
    // Directory read error
  }

  return false;
}

/**
 * Get the best display name for a terminal's active Claude session.
 * Priority: friendlyName > customTitle > firstPrompt > slug
 *
 * When sessionId is provided, we look for that specific session to avoid
 * "name bleed" where all terminals in a project get the same name.
 * Returns null if sessionId is not provided or doesn't match — never
 * falls back to an unrelated session.
 */
function getSessionNameForTerminal(terminalId: string, sessionId?: string): string | null {
  if (!sessionId) return null;

  const info = ptyManager.getTerminalInfo(terminalId);
  if (!info?.projectPath) return null;

  const sessions = getSessionsForProject(info.projectPath);
  if (sessions.length === 0) return null;

  // Only use the specific correlated session — no fallback to prevent cross-contamination
  const session = sessions.find(s => s.sessionId === sessionId);
  if (!session) {
    if (sessions.length > 0) {
      console.warn(`[sessions] sessionId "${sessionId}" not found among ${sessions.length} sessions for terminal ${terminalId}`);
    }
    return null;
  }

  const name = session.friendlyName || session.customTitle || session.firstPrompt || session.slug;
  if (!name) return null;

  // Truncate long first-prompt names
  const maxLen = 40;
  return name.length > maxLen ? name.slice(0, maxLen - 1) + '\u2026' : name;
}

/**
 * Setup IPC handlers
 */
function setupIPC(ipcMain: IpcMain): void {
  ipcMain.handle(IPC.LOAD_CLAUDE_SESSIONS, async (_event, projectPath: string) => {
    return getSessionsForProject(projectPath);
  });

  ipcMain.handle(IPC.REFRESH_CLAUDE_SESSIONS, async (_event, projectPath: string) => {
    return getSessionsForProject(projectPath);
  });

  ipcMain.handle(IPC.CHECK_ACTIVE_CLAUDE_SESSION, async (_event, projectPath: string) => {
    return hasActiveSession(projectPath);
  });

  ipcMain.handle(IPC.RENAME_CLAUDE_SESSION, async (_event, payload: { projectPath: string; sessionId: string; name: string }) => {
    return renameSession(payload.projectPath, payload.sessionId, payload.name);
  });

  ipcMain.handle(IPC.DELETE_CLAUDE_SESSION, async (_event, payload: { projectPath: string; sessionId: string; slug: string }) => {
    return deleteSession(payload.projectPath, payload.sessionId, payload.slug);
  });

  ipcMain.handle(IPC.DELETE_ALL_CLAUDE_SESSIONS, async (_event, projectPath: string) => {
    return deleteAllSessions(projectPath);
  });

  ipcMain.handle(IPC.GET_TERMINAL_SESSION_NAME, async (_event, payload: { terminalId: string; sessionId?: string }) => {
    return { name: getSessionNameForTerminal(payload.terminalId, payload.sessionId) };
  });
}

export { init, setupIPC, getSessionsForProject };
