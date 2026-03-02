/**
 * SubFrame Constants
 * Configuration constants for SubFrame project management
 */

// SubFrame project folder name (inside each project)
const FRAME_DIR = '.subframe';

// SubFrame config file name
const FRAME_CONFIG_FILE = 'config.json';

// Workspace directory name (in user home: ~/.subframe/)
const WORKSPACE_DIR = '.subframe';

// Workspace file name
const WORKSPACE_FILE = 'workspaces.json';

const path = require('path');

// SubFrame hooks directory (inside .subframe/)
const SUBFRAME_HOOKS_DIR = path.join('.subframe', 'hooks');

// SubFrame auto-generated files — native AI tool files stay at root; project files live inside .subframe/
const FRAME_FILES = {
  AGENTS: 'AGENTS.md',
  CLAUDE: 'CLAUDE.md',
  GEMINI: 'GEMINI.md',
  STRUCTURE: path.join('.subframe', 'STRUCTURE.json'),
  NOTES: path.join('.subframe', 'PROJECT_NOTES.md'),
  TASKS: path.join('.subframe', 'tasks.json'),
  QUICKSTART: path.join('.subframe', 'QUICKSTART.md'),
  DOCS_INTERNAL: path.join('.subframe', 'docs-internal'),
  HOOKS_SESSION_START: path.join('.subframe', 'hooks', 'session-start.js'),
  HOOKS_PROMPT_SUBMIT: path.join('.subframe', 'hooks', 'prompt-submit.js'),
  HOOKS_STOP: path.join('.subframe', 'hooks', 'stop.js'),
  HOOKS_PRE_TOOL_USE: path.join('.subframe', 'hooks', 'pre-tool-use.js'),
  HOOKS_POST_TOOL_USE: path.join('.subframe', 'hooks', 'post-tool-use.js'),
  CLAUDE_SETTINGS: path.join('.claude', 'settings.json'),
  SKILLS_SUB_TASKS: path.join('.claude', 'skills', 'sub-tasks', 'SKILL.md'),
  SKILLS_SUB_DOCS: path.join('.claude', 'skills', 'sub-docs', 'SKILL.md'),
  SKILLS_SUB_AUDIT: path.join('.claude', 'skills', 'sub-audit', 'SKILL.md'),
};

// SubFrame bin directory for AI tool wrappers
const FRAME_BIN_DIR = 'bin';

// Git hooks directory name (created in user projects)
const GITHOOKS_DIR = '.githooks';

// SubFrame version — single source of truth is package.json
const FRAME_VERSION = require('../../package.json').version;

module.exports = {
  FRAME_DIR,
  FRAME_CONFIG_FILE,
  WORKSPACE_DIR,
  WORKSPACE_FILE,
  SUBFRAME_HOOKS_DIR,
  FRAME_FILES,
  FRAME_BIN_DIR,
  GITHOOKS_DIR,
  FRAME_VERSION
};
