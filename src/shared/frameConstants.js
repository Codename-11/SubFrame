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

// SubFrame auto-generated files
const FRAME_FILES = {
  AGENTS: 'AGENTS.md',
  CLAUDE: 'CLAUDE.md',
  GEMINI: 'GEMINI.md',
  STRUCTURE: 'STRUCTURE.json',
  NOTES: 'PROJECT_NOTES.md',
  TASKS: 'tasks.json',
  QUICKSTART: 'QUICKSTART.md'
};

// SubFrame bin directory for AI tool wrappers
const FRAME_BIN_DIR = 'bin';

// Git hooks directory name (created in user projects)
const GITHOOKS_DIR = '.githooks';

// SubFrame version
const FRAME_VERSION = '1.0';

module.exports = {
  FRAME_DIR,
  FRAME_CONFIG_FILE,
  WORKSPACE_DIR,
  WORKSPACE_FILE,
  FRAME_FILES,
  FRAME_BIN_DIR,
  GITHOOKS_DIR,
  FRAME_VERSION
};
