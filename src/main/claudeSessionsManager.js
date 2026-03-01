/**
 * Claude Sessions Manager Module
 * Reads Claude Code session history from ~/.claude/projects/
 * Scans individual .jsonl session files and extracts metadata
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { IPC } = require('../shared/ipcChannels');

let mainWindow = null;

const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects');

/**
 * Initialize sessions manager
 */
function init(window) {
  mainWindow = window;
}

/**
 * Encode project path to Claude's directory format
 * e.g. /Users/dev/MyProject -> -Users-dev-MyProject
 * e.g. C:\Users\Bailey\MyProject  -> C--Users-Bailey-MyProject
 */
function encodeProjectPath(projectPath) {
  return projectPath.replace(/[\\/]/g, '-').replace(/:/g, '-');
}

/**
 * Extract readable text from a JSONL message field.
 * Handles string messages, {content: string}, and {content: [{type, text}]} formats.
 */
function extractMessageText(message) {
  if (!message) return '';
  if (typeof message === 'string') return message;
  if (typeof message !== 'object') return String(message);

  const content = message.content;
  if (!content) return '';
  if (typeof content === 'string') return content;

  // Array of content blocks (Claude API format)
  if (Array.isArray(content)) {
    return content
      .filter(block => block.type === 'text' && block.text)
      .map(block => block.text)
      .join(' ');
  }

  return String(content);
}

/**
 * Parse a single .jsonl session file and extract metadata
 */
function parseSessionFile(filePath) {
  const stat = fs.statSync(filePath);
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').filter(l => l.trim());

  if (lines.length === 0) return null;

  // First line contains session metadata
  const firstLine = JSON.parse(lines[0]);

  let firstPrompt = '';
  let messageCount = 0;

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);

      if (entry.type === 'user' || entry.type === 'assistant') {
        messageCount++;
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
  let sessionState = 'inactive';
  if (diffMin < 2) sessionState = 'active';
  else if (diffMin < 60) sessionState = 'recent';

  return {
    sessionId: firstLine.sessionId || path.basename(filePath, '.jsonl'),
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
 * Get sessions for a given project path
 */
function getSessionsForProject(projectPath) {
  if (!projectPath) return [];

  const encodedPath = encodeProjectPath(projectPath);
  const projectDir = path.join(PROJECTS_DIR, encodedPath);

  try {
    if (!fs.existsSync(projectDir)) return [];

    const files = fs.readdirSync(projectDir).filter(f => f.endsWith('.jsonl'));
    const sessions = [];

    for (const file of files) {
      try {
        const session = parseSessionFile(path.join(projectDir, file));
        if (session) sessions.push(session);
      } catch (err) {
        console.error(`Error parsing session file ${file}:`, err.message);
      }
    }

    // Sort by modified date descending (most recent first)
    return sessions.sort((a, b) => new Date(b.modified) - new Date(a.modified));
  } catch (err) {
    console.error('Error reading sessions directory:', err);
    return [];
  }
}

/**
 * Setup IPC handlers
 */
function setupIPC(ipcMain) {
  ipcMain.handle(IPC.LOAD_CLAUDE_SESSIONS, async (event, projectPath) => {
    return getSessionsForProject(projectPath);
  });

  ipcMain.handle(IPC.REFRESH_CLAUDE_SESSIONS, async (event, projectPath) => {
    return getSessionsForProject(projectPath);
  });
}

module.exports = {
  init,
  setupIPC,
  getSessionsForProject
};
