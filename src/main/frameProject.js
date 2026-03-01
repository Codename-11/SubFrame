/**
 * SubFrame Project Module
 * Handles SubFrame project initialization and detection
 */

const fs = require('fs');
const path = require('path');
const { dialog } = require('electron');
const { IPC } = require('../shared/ipcChannels');
const { FRAME_DIR, FRAME_CONFIG_FILE, FRAME_FILES } = require('../shared/frameConstants');
const workspace = require('./workspace');
const { initializeProject, checkExistingFiles } = require('../shared/projectInit');
const { getNativeFileStatus, getClaudeNativeStatus } = require('../shared/backlinkUtils');

let mainWindow = null;

/**
 * Initialize frame project module
 */
function init(window) {
  mainWindow = window;
}

/**
 * Check if a project is a SubFrame project
 */
function isFrameProject(projectPath) {
  const configPath = path.join(projectPath, FRAME_DIR, FRAME_CONFIG_FILE);
  return fs.existsSync(configPath);
}

/**
 * Get SubFrame config from project
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
 * Show confirmation dialog before initializing SubFrame project
 * Provides enhanced messaging when CLAUDE.md/GEMINI.md have existing content
 * or when .claude/ directory is present.
 */
async function showInitializeConfirmation(projectPath) {
  const existingFiles = checkExistingFiles(projectPath);

  const hasGitDir = fs.existsSync(path.join(projectPath, '.git'));
  const claudeStatus = getNativeFileStatus(projectPath, FRAME_FILES.CLAUDE);
  const geminiStatus = getNativeFileStatus(projectPath, FRAME_FILES.GEMINI);
  const claudeNative = getClaudeNativeStatus(projectPath);

  let message = 'This will create the following files in your project:\n\n';
  message += '  • .subframe/ (config directory)\n';
  message += '  • .subframe/bin/ (AI tool wrappers)\n';
  message += '  • AGENTS.md (AI instructions)\n';
  message += '  • CLAUDE.md (references AGENTS.md)\n';
  message += '  • STRUCTURE.json (module map)\n';
  message += '  • PROJECT_NOTES.md (session notes)\n';
  message += '  • tasks.json (task tracking)\n';
  message += '  • QUICKSTART.md (getting started)\n';

  if (hasGitDir) {
    message += '  • .githooks/pre-commit (auto-updates STRUCTURE.json on commit)\n';
  }

  if (existingFiles.length > 0) {
    message += '\n⚠️ These files already exist and will NOT be overwritten:\n';
    message += existingFiles.map(f => `  • ${f}`).join('\n');
  }

  // Enhanced messaging for existing CLAUDE.md with user content
  if (claudeStatus.exists && claudeStatus.hasUserContent && !claudeStatus.hasBacklink) {
    message += '\n\n📝 CLAUDE.md already has content. SubFrame will add a small reference to AGENTS.md at the top. Your existing content will be preserved.';
  }

  // Enhanced messaging for existing GEMINI.md with user content
  if (geminiStatus.exists && geminiStatus.hasUserContent && !geminiStatus.hasBacklink) {
    message += '\n\n📝 GEMINI.md already has content. SubFrame will add a small reference to AGENTS.md at the top. Your existing content will be preserved.';
  }

  // Note about .claude/ directory (Claude Code's native settings)
  if (claudeNative.exists) {
    message += '\n\nℹ️ .claude/ directory detected (Claude Code settings). SubFrame will not touch this directory — it is managed by Claude Code.';
  }

  message += '\n\nDo you want to continue?';

  const hasWarnings = existingFiles.length > 0 ||
    (claudeStatus.exists && claudeStatus.hasUserContent) ||
    (geminiStatus.exists && geminiStatus.hasUserContent);

  const result = await dialog.showMessageBox(mainWindow, {
    type: hasWarnings ? 'warning' : 'question',
    buttons: ['Cancel', 'Initialize'],
    defaultId: 0,
    cancelId: 0,
    title: 'Initialize as SubFrame Project',
    message: 'Initialize as SubFrame Project?',
    detail: message
  });

  return result.response === 1; // 1 = "Initialize" button
}

/**
 * Initialize a project as SubFrame project
 * Delegates to the shared projectInit module, then updates workspace state.
 */
function initializeFrameProject(projectPath, projectName) {
  const result = initializeProject(projectPath, { name: projectName });

  // Update workspace to mark as SubFrame project (Electron-only concern)
  workspace.updateProjectFrameStatus(projectPath, true);

  return result.config;
}

/**
 * Setup IPC handlers
 */
function setupIPC(ipcMain) {
  ipcMain.on(IPC.CHECK_IS_FRAME_PROJECT, (event, projectPath) => {
    const isFrame = isFrameProject(projectPath);
    event.sender.send(IPC.IS_FRAME_PROJECT_RESULT, { projectPath, isFrame });
  });

  ipcMain.on(IPC.INITIALIZE_FRAME_PROJECT, async (event, { projectPath, projectName, confirmed }) => {
    try {
      // If not already confirmed by renderer modal, show native dialog as fallback
      if (!confirmed) {
        const userConfirmed = await showInitializeConfirmation(projectPath);
        if (!userConfirmed) {
          event.sender.send(IPC.FRAME_PROJECT_INITIALIZED, {
            projectPath,
            success: false,
            cancelled: true
          });
          return;
        }
      }

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
      console.error('Error initializing SubFrame project:', err);
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
