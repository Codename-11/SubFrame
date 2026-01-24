/**
 * Frame Project Module
 * Handles Frame project initialization and detection
 */

const fs = require('fs');
const path = require('path');
const { IPC } = require('../shared/ipcChannels');
const { FRAME_DIR, FRAME_CONFIG_FILE, FRAME_FILES } = require('../shared/frameConstants');
const templates = require('../shared/frameTemplates');
const workspace = require('./workspace');

let mainWindow = null;

/**
 * Initialize frame project module
 */
function init(window) {
  mainWindow = window;
}

/**
 * Check if a project is a Frame project
 */
function isFrameProject(projectPath) {
  const configPath = path.join(projectPath, FRAME_DIR, FRAME_CONFIG_FILE);
  return fs.existsSync(configPath);
}

/**
 * Get Frame config from project
 */
function getFrameConfig(projectPath) {
  const configPath = path.join(projectPath, FRAME_DIR, FRAME_CONFIG_FILE);
  try {
    const data = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return null;
  }
}

/**
 * Create file if it doesn't exist
 */
function createFileIfNotExists(filePath, content) {
  if (!fs.existsSync(filePath)) {
    const contentStr = typeof content === 'string'
      ? content
      : JSON.stringify(content, null, 2);
    fs.writeFileSync(filePath, contentStr, 'utf8');
    return true;
  }
  return false;
}

/**
 * Initialize a project as Frame project
 */
function initializeFrameProject(projectPath, projectName) {
  const name = projectName || path.basename(projectPath);
  const frameDirPath = path.join(projectPath, FRAME_DIR);

  // Create .frame directory
  if (!fs.existsSync(frameDirPath)) {
    fs.mkdirSync(frameDirPath, { recursive: true });
  }

  // Create .frame/config.json
  const config = templates.getFrameConfigTemplate(name);
  fs.writeFileSync(
    path.join(frameDirPath, FRAME_CONFIG_FILE),
    JSON.stringify(config, null, 2),
    'utf8'
  );

  // Create root-level Frame files (only if they don't exist)

  // CLAUDE.md - Main instructions file for Claude Code
  createFileIfNotExists(
    path.join(projectPath, FRAME_FILES.CLAUDE),
    templates.getClaudeTemplate(name)
  );

  createFileIfNotExists(
    path.join(projectPath, FRAME_FILES.STRUCTURE),
    templates.getStructureTemplate(name)
  );

  createFileIfNotExists(
    path.join(projectPath, FRAME_FILES.NOTES),
    templates.getNotesTemplate(name)
  );

  createFileIfNotExists(
    path.join(projectPath, FRAME_FILES.TASKS),
    templates.getTasksTemplate(name)
  );

  createFileIfNotExists(
    path.join(projectPath, FRAME_FILES.QUICKSTART),
    templates.getQuickstartTemplate(name)
  );

  // Update workspace to mark as Frame project
  workspace.updateProjectFrameStatus(projectPath, true);

  return config;
}

/**
 * Setup IPC handlers
 */
function setupIPC(ipcMain) {
  ipcMain.on(IPC.CHECK_IS_FRAME_PROJECT, (event, projectPath) => {
    const isFrame = isFrameProject(projectPath);
    event.sender.send(IPC.IS_FRAME_PROJECT_RESULT, { projectPath, isFrame });
  });

  ipcMain.on(IPC.INITIALIZE_FRAME_PROJECT, (event, { projectPath, projectName }) => {
    try {
      const config = initializeFrameProject(projectPath, projectName);
      event.sender.send(IPC.FRAME_PROJECT_INITIALIZED, {
        projectPath,
        config,
        success: true
      });

      // Also send updated workspace
      const projects = workspace.getProjects();
      event.sender.send(IPC.WORKSPACE_UPDATED, projects);
    } catch (err) {
      console.error('Error initializing Frame project:', err);
      event.sender.send(IPC.FRAME_PROJECT_INITIALIZED, {
        projectPath,
        success: false,
        error: err.message
      });
    }
  });

  ipcMain.on(IPC.GET_FRAME_CONFIG, (event, projectPath) => {
    const config = getFrameConfig(projectPath);
    event.sender.send(IPC.FRAME_CONFIG_DATA, { projectPath, config });
  });
}

module.exports = {
  init,
  isFrameProject,
  getFrameConfig,
  initializeFrameProject,
  setupIPC
};
