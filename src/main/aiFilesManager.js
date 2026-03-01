/**
 * AI Files Manager Module
 * Handles native AI instruction file operations (CLAUDE.md, GEMINI.md)
 * Manages backlink injection, removal, symlink migration, and status checks
 */

const fs = require('fs');
const path = require('path');
const { IPC } = require('../shared/ipcChannels');
const { FRAME_FILES, FRAME_DIR, FRAME_BIN_DIR, FRAME_CONFIG_FILE } = require('../shared/frameConstants');
const {
  getNativeFileStatus,
  getClaudeNativeStatus,
  injectBacklink,
  updateBacklink,
  removeBacklink,
  hasBacklink,
  isSymlinkFile,
  verifyBacklinks
} = require('../shared/backlinkUtils');

let mainWindow = null;

/**
 * Initialize AI files manager
 */
function init(window) {
  mainWindow = window;
}

/**
 * Get status of all AI-related files in a project
 * @param {string} projectPath - Project root path
 * @returns {object} Status for each AI file
 */
function getAIFilesStatus(projectPath) {
  const codexPath = path.join(projectPath, FRAME_DIR, FRAME_BIN_DIR, 'codex');

  return {
    claude: getNativeFileStatus(projectPath, FRAME_FILES.CLAUDE),
    gemini: getNativeFileStatus(projectPath, FRAME_FILES.GEMINI),
    agents: {
      exists: fs.existsSync(path.join(projectPath, FRAME_FILES.AGENTS)),
      isSymlink: false,
      hasBacklink: false,
      hasUserContent: true
    },
    codexWrapper: {
      exists: fs.existsSync(codexPath)
    },
    claudeSettings: getClaudeNativeStatus(projectPath)
  };
}

/**
 * Inject backlink into a native AI file
 * @param {string} projectPath - Project root path
 * @param {string} filename - File name (e.g. 'CLAUDE.md')
 * @returns {boolean}
 */
function handleInjectBacklink(projectPath, filename) {
  const filePath = path.join(projectPath, filename);
  return injectBacklink(filePath);
}

/**
 * Remove backlink from a native AI file
 * @param {string} projectPath - Project root path
 * @param {string} filename - File name (e.g. 'CLAUDE.md')
 * @returns {boolean}
 */
function handleRemoveBacklink(projectPath, filename) {
  const filePath = path.join(projectPath, filename);
  return removeBacklink(filePath);
}

/**
 * Create a new native AI file with backlink
 * @param {string} projectPath - Project root path
 * @param {string} filename - File name (e.g. 'CLAUDE.md')
 * @returns {boolean}
 */
function handleCreateNativeFile(projectPath, filename) {
  const filePath = path.join(projectPath, filename);
  if (fs.existsSync(filePath)) {
    return injectBacklink(filePath);
  }
  return injectBacklink(filePath);
}

/**
 * Migrate a symlink to a real file with backlink
 * @param {string} projectPath - Project root path
 * @param {string} filename - File name (e.g. 'CLAUDE.md')
 * @returns {boolean}
 */
function handleMigrateSymlink(projectPath, filename) {
  const filePath = path.join(projectPath, filename);
  try {
    if (fs.existsSync(filePath) && isSymlinkFile(filePath)) {
      fs.unlinkSync(filePath);
    }
    return injectBacklink(filePath);
  } catch (err) {
    console.error(`Error migrating symlink for ${filename}:`, err);
    return false;
  }
}

/**
 * Auto-verify backlinks when a project is opened
 * Non-blocking — sends results to the renderer for display
 * @param {string} projectPath - Project root path
 */
function handleVerifyOnProjectOpen(projectPath) {
  if (!mainWindow || !projectPath) return;

  // Check if it's a SubFrame project first
  const configPath = path.join(projectPath, FRAME_DIR, FRAME_CONFIG_FILE);
  if (!fs.existsSync(configPath)) return;

  try {
    const result = verifyBacklinks(projectPath);
    mainWindow.webContents.send(IPC.BACKLINK_VERIFICATION_RESULT, { projectPath, result });
  } catch (err) {
    console.error('Error auto-verifying backlinks:', err);
  }
}

/**
 * Read backlink customization config from .subframe/config.json
 * @param {string} projectPath - Project root path
 * @returns {{ customMessage: string, additionalRefs: string[] } | null}
 */
function getBacklinkConfig(projectPath) {
  try {
    const configPath = path.join(projectPath, FRAME_DIR, FRAME_CONFIG_FILE);
    if (!fs.existsSync(configPath)) return null;
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return config.backlink || null;
  } catch (err) {
    console.error('Error reading backlink config:', err);
    return null;
  }
}

/**
 * Save backlink customization config to .subframe/config.json
 * @param {string} projectPath - Project root path
 * @param {{ customMessage: string, additionalRefs: string[] }} backlinkConfig
 * @returns {boolean}
 */
function saveBacklinkConfig(projectPath, backlinkConfig) {
  try {
    const configPath = path.join(projectPath, FRAME_DIR, FRAME_CONFIG_FILE);
    if (!fs.existsSync(configPath)) return false;
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    config.backlink = {
      customMessage: backlinkConfig.customMessage || '',
      additionalRefs: backlinkConfig.additionalRefs || []
    };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error saving backlink config:', err);
    return false;
  }
}

/**
 * Build backlink options from config (returns undefined if no customization)
 * @param {{ customMessage: string, additionalRefs: string[] } | null} backlinkConfig
 * @returns {object | undefined}
 */
function buildBacklinkOptions(backlinkConfig) {
  if (!backlinkConfig) return undefined;
  const hasCustom = (backlinkConfig.customMessage && backlinkConfig.customMessage.trim()) ||
    (backlinkConfig.additionalRefs && backlinkConfig.additionalRefs.some(r => r.trim()));
  return hasCustom ? backlinkConfig : undefined;
}

/**
 * Update all existing backlinks in a project with current config
 * @param {string} projectPath - Project root path
 * @returns {{ updated: string[], failed: string[] }}
 */
function handleUpdateAllBacklinks(projectPath) {
  const backlinkConfig = getBacklinkConfig(projectPath);
  const options = buildBacklinkOptions(backlinkConfig);
  const nativeFiles = [FRAME_FILES.CLAUDE, FRAME_FILES.GEMINI];
  const updated = [];
  const failed = [];

  for (const filename of nativeFiles) {
    const filePath = path.join(projectPath, filename);
    if (!fs.existsSync(filePath)) continue;
    if (!hasBacklink(filePath)) continue;

    const success = updateBacklink(filePath, options);
    if (success) {
      updated.push(filename);
    } else {
      failed.push(filename);
    }
  }

  return { updated, failed };
}

/**
 * Setup IPC handlers for AI file operations
 */
function setupIPC(ipcMain) {
  ipcMain.on(IPC.GET_AI_FILES_STATUS, (event, projectPath) => {
    try {
      const status = getAIFilesStatus(projectPath);
      event.sender.send(IPC.AI_FILES_STATUS_DATA, { projectPath, status });
    } catch (err) {
      console.error('Error getting AI files status:', err);
      event.sender.send(IPC.AI_FILES_STATUS_DATA, { projectPath, status: null, error: err.message });
    }
  });

  ipcMain.on(IPC.INJECT_BACKLINK, (event, { projectPath, filename }) => {
    const success = handleInjectBacklink(projectPath, filename);
    event.sender.send(IPC.AI_FILE_UPDATED, { projectPath, filename, action: 'inject', success });
  });

  ipcMain.on(IPC.REMOVE_BACKLINK, (event, { projectPath, filename }) => {
    const success = handleRemoveBacklink(projectPath, filename);
    event.sender.send(IPC.AI_FILE_UPDATED, { projectPath, filename, action: 'remove', success });
  });

  ipcMain.on(IPC.CREATE_NATIVE_FILE, (event, { projectPath, filename }) => {
    const success = handleCreateNativeFile(projectPath, filename);
    event.sender.send(IPC.AI_FILE_UPDATED, { projectPath, filename, action: 'create', success });
  });

  ipcMain.on(IPC.MIGRATE_SYMLINK, (event, { projectPath, filename }) => {
    const success = handleMigrateSymlink(projectPath, filename);
    event.sender.send(IPC.AI_FILE_UPDATED, { projectPath, filename, action: 'migrate', success });
  });

  ipcMain.on(IPC.VERIFY_BACKLINKS, (event, projectPath) => {
    try {
      const result = verifyBacklinks(projectPath);
      event.sender.send(IPC.BACKLINK_VERIFICATION_RESULT, { projectPath, result });
    } catch (err) {
      console.error('Error verifying backlinks:', err);
      event.sender.send(IPC.BACKLINK_VERIFICATION_RESULT, { projectPath, result: null, error: err.message });
    }
  });

  ipcMain.on(IPC.GET_BACKLINK_CONFIG, (event, projectPath) => {
    const config = getBacklinkConfig(projectPath);
    event.sender.send(IPC.BACKLINK_CONFIG_DATA, { projectPath, config });
  });

  ipcMain.on(IPC.SAVE_BACKLINK_CONFIG, (event, { projectPath, backlinkConfig }) => {
    const success = saveBacklinkConfig(projectPath, backlinkConfig);
    event.sender.send(IPC.BACKLINK_CONFIG_SAVED, { projectPath, success });
  });

  ipcMain.on(IPC.UPDATE_ALL_BACKLINKS, (event, projectPath) => {
    const result = handleUpdateAllBacklinks(projectPath);
    event.sender.send(IPC.ALL_BACKLINKS_UPDATED, { projectPath, result });
  });
}

module.exports = {
  init,
  setupIPC,
  getAIFilesStatus,
  handleInjectBacklink,
  handleRemoveBacklink,
  handleCreateNativeFile,
  handleMigrateSymlink,
  handleVerifyOnProjectOpen,
  getBacklinkConfig,
  saveBacklinkConfig,
  handleUpdateAllBacklinks
};
