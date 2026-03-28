/**
 * SubFrame Constants
 * Configuration constants for SubFrame project management
 */

import * as path from 'path';

/** True when running via `npm run dev` (unpackaged Electron). */
export const IS_DEV_MODE: boolean = typeof process !== 'undefined'
  && (process.env.NODE_ENV === 'development' || process.env.ELECTRON_DEV === '1');

/** SubFrame project folder name (inside each project) */
export const FRAME_DIR: string = '.subframe';

/** SubFrame config file name */
export const FRAME_CONFIG_FILE: string = 'config.json';

/** Workspace directory name (in user home: ~/.subframe/ or ~/.subframe-dev/) */
export const WORKSPACE_DIR: string = IS_DEV_MODE ? '.subframe-dev' : '.subframe';

/** Production workspace directory (always ~/.subframe/, used for dev sync) */
export const WORKSPACE_DIR_PROD: string = '.subframe';

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
  SKILLS_ONBOARD: path.join('.claude', 'skills', 'onboard', 'SKILL.md'),
  HOOKS_PRE_PUSH: path.join('.githooks', 'pre-push'),
} as const;

/** SubFrame bin directory for AI tool wrappers */
export const FRAME_BIN_DIR: string = 'bin';

/** Git hooks directory name (created in user projects) */
export const GITHOOKS_DIR: string = '.githooks';

/** Tasks directory for individual markdown task files */
export const FRAME_TASKS_DIR: string = path.join('.subframe', 'tasks');

/** Private tasks directory (gitignored) */
export const FRAME_TASKS_PRIVATE_DIR: string = path.join('.subframe', 'tasks', 'private');

/** Pipeline workflows directory */
export const FRAME_WORKFLOWS_DIR: string = path.join('.subframe', 'workflows');

/** Pipeline runtime state directory */
export const FRAME_PIPELINES_DIR: string = path.join('.subframe', 'pipelines');

/** SubFrame version — single source of truth is package.json */
export const FRAME_VERSION: string = require('../../package.json').version;

/**
 * Intelligence files to detect during project onboarding.
 * Categorized by type for display in the onboarding dialog.
 */
export const INTELLIGENCE_FILES: Record<string, { category: 'ai-config' | 'project-metadata' | 'documentation' | 'dev-config'; label: string; paths: string[] }> = {
  // AI config files
  claudeMd: { category: 'ai-config', label: 'CLAUDE.md', paths: ['CLAUDE.md', '.claude/CLAUDE.md'] },
  geminiMd: { category: 'ai-config', label: 'GEMINI.md', paths: ['GEMINI.md'] },
  cursorRules: { category: 'ai-config', label: 'Cursor Rules', paths: ['.cursorrules', '.cursor/rules'] },
  copilotInstructions: { category: 'ai-config', label: 'Copilot Instructions', paths: ['.github/copilot-instructions.md'] },

  // Project metadata
  packageJson: { category: 'project-metadata', label: 'package.json', paths: ['package.json'] },
  pyprojectToml: { category: 'project-metadata', label: 'pyproject.toml', paths: ['pyproject.toml'] },
  cargoToml: { category: 'project-metadata', label: 'Cargo.toml', paths: ['Cargo.toml'] },
  goMod: { category: 'project-metadata', label: 'go.mod', paths: ['go.mod'] },
  pomXml: { category: 'project-metadata', label: 'pom.xml', paths: ['pom.xml'] },
  composerJson: { category: 'project-metadata', label: 'composer.json', paths: ['composer.json'] },
  gemfile: { category: 'project-metadata', label: 'Gemfile', paths: ['Gemfile'] },

  // Documentation
  readme: { category: 'documentation', label: 'README.md', paths: ['README.md', 'readme.md', 'README'] },
  contributing: { category: 'documentation', label: 'CONTRIBUTING.md', paths: ['CONTRIBUTING.md'] },
  architecture: { category: 'documentation', label: 'Architecture docs', paths: ['ARCHITECTURE.md', 'docs/architecture.md'] },

  // Dev config
  tsconfig: { category: 'dev-config', label: 'tsconfig.json', paths: ['tsconfig.json'] },
  eslintConfig: { category: 'dev-config', label: 'ESLint config', paths: ['eslint.config.mjs', 'eslint.config.js', '.eslintrc.json', '.eslintrc.js'] },
  makefile: { category: 'dev-config', label: 'Makefile', paths: ['Makefile'] },
  dockerCompose: { category: 'dev-config', label: 'Docker Compose', paths: ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml'] },
  gitDir: { category: 'dev-config', label: 'Git repository', paths: ['.git'] },
};
