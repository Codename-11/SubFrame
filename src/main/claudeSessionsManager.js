/**
 * Claude Sessions Manager Module
 * Reads Claude Code session history from ~/.claude/projects/
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
 * e.g. /Users/kaanozhan/MyProject -> -Users-kaanozhan-MyProject
 */
function encodeProjectPath(projectPath) {
  return projectPath.replace(/\//g, '-');
}

/**
 * Get sessions for a given project path
 */
function getSessionsForProject(projectPath) {
  if (!projectPath) return [];

  const encodedPath = encodeProjectPath(projectPath);
  const sessionsFile = path.join(PROJECTS_DIR, encodedPath, 'sessions-index.json');

  try {
    if (!fs.existsSync(sessionsFile)) {
      return [];
    }

    const data = JSON.parse(fs.readFileSync(sessionsFile, 'utf8'));

    // Support both { entries: [...] } and plain array formats
    const entries = Array.isArray(data) ? data : (data.entries || []);
    if (!Array.isArray(entries)) return [];

    // Sort by modified date descending (most recent first)
    return entries.sort((a, b) => {
      const dateA = new Date(a.modified || a.created || 0);
      const dateB = new Date(b.modified || b.created || 0);
      return dateB - dateA;
    });
  } catch (err) {
    console.error('Error reading sessions file:', err);
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
