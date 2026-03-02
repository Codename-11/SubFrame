/**
 * SubFrame Constants
 * Configuration constants for SubFrame project management
 */

import * as path from 'path';

/** SubFrame project folder name (inside each project) */
export const FRAME_DIR: string = '.subframe';

/** SubFrame config file name */
export const FRAME_CONFIG_FILE: string = 'config.json';

/** Workspace directory name (in user home: ~/.subframe/) */
export const WORKSPACE_DIR: string = '.subframe';

/** Workspace file name */
export const WORKSPACE_FILE: string = 'workspaces.json';

/** SubFrame hooks directory (inside .subframe/) */
export const SUBFRAME_HOOKS_DIR: string = path.join('.subframe', 'hooks');

/** SubFrame auto-generated files — native AI tool files stay at root; project files live inside .subframe/ */
export const FRAME_FILES = {
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
} as const;

/** SubFrame bin directory for AI tool wrappers */
export const FRAME_BIN_DIR: string = 'bin';

/** Git hooks directory name (created in user projects) */
export const GITHOOKS_DIR: string = '.githooks';

/** Tasks directory for individual markdown task files */
export const FRAME_TASKS_DIR: string = path.join('.subframe', 'tasks');

/** SubFrame version — single source of truth is package.json */
export const FRAME_VERSION: string = require('../../package.json').version;
