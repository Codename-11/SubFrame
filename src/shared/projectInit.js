/**
 * SubFrame Project Initialization (Pure Node.js)
 * Core init logic shared between the Electron app and the CLI.
 * No Electron dependencies — safe to require from plain Node.js.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { FRAME_DIR, FRAME_CONFIG_FILE, FRAME_FILES, FRAME_BIN_DIR, GITHOOKS_DIR, SUBFRAME_HOOKS_DIR } = require('./frameConstants');
const templates = require('./frameTemplates');
const { injectBacklink, isSymlinkFile } = require('./backlinkUtils');
const { readClaudeSettings, mergeSubFrameHooks, writeClaudeSettings } = require('./claudeSettingsUtils');

/**
 * Create file if it doesn't exist
 * @returns {boolean} true if the file was created, false if it already existed
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
 * Create or migrate a native AI file with backlink injection
 * Handles symlink migration and idempotent backlink injection.
 * @returns {boolean}
 */
function createOrMigrateNativeFile(filePath) {
  try {
    if (fs.existsSync(filePath) && isSymlinkFile(filePath)) {
      fs.unlinkSync(filePath);
    }
    return injectBacklink(filePath);
  } catch (err) {
    console.error(`Error creating/migrating native file ${filePath}:`, err);
    return false;
  }
}

/**
 * Check which SubFrame files already exist in the project
 * @returns {string[]} list of existing file names
 */
function checkExistingFiles(projectPath) {
  const existingFiles = [];
  const filesToCheck = [
    { name: 'AGENTS.md', path: path.join(projectPath, FRAME_FILES.AGENTS) },
    { name: 'CLAUDE.md', path: path.join(projectPath, FRAME_FILES.CLAUDE) },
    { name: 'GEMINI.md', path: path.join(projectPath, FRAME_FILES.GEMINI) },
    { name: 'STRUCTURE.json', path: path.join(projectPath, FRAME_FILES.STRUCTURE) },
    { name: 'PROJECT_NOTES.md', path: path.join(projectPath, FRAME_FILES.NOTES) },
    { name: 'tasks.json', path: path.join(projectPath, FRAME_FILES.TASKS) },
    { name: 'QUICKSTART.md', path: path.join(projectPath, FRAME_FILES.QUICKSTART) },
    { name: '.subframe/docs-internal/', path: path.join(projectPath, FRAME_FILES.DOCS_INTERNAL) },
    { name: '.claude/skills/sub-tasks/', path: path.join(projectPath, '.claude', 'skills', 'sub-tasks') },
    { name: '.claude/skills/sub-docs/', path: path.join(projectPath, '.claude', 'skills', 'sub-docs') },
    { name: '.claude/skills/sub-audit/', path: path.join(projectPath, '.claude', 'skills', 'sub-audit') },
    { name: '.subframe/', path: path.join(projectPath, FRAME_DIR) }
  ];

  for (const file of filesToCheck) {
    if (fs.existsSync(file.path)) {
      existingFiles.push(file.name);
    }
  }

  return existingFiles;
}

/**
 * Initialize a project as a SubFrame project.
 *
 * @param {string} projectPath - Absolute path to the project root
 * @param {object} [options]
 * @param {string}  [options.name]    - Project name (defaults to directory basename)
 * @param {boolean} [options.hooks]   - Create git hooks (default: true)
 * @returns {{ config: object, created: string[], skipped: string[] }}
 */
function initializeProject(projectPath, options = {}) {
  const name = options.name || path.basename(projectPath);
  const hooks = options.hooks !== false;
  const frameDirPath = path.join(projectPath, FRAME_DIR);

  const created = [];
  const skipped = [];

  function track(label, wasCreated) {
    if (wasCreated) {
      created.push(label);
    } else {
      skipped.push(label);
    }
  }

  // Create .subframe directory
  if (!fs.existsSync(frameDirPath)) {
    fs.mkdirSync(frameDirPath, { recursive: true });
    created.push('.subframe/');
  } else {
    skipped.push('.subframe/');
  }

  // Create .subframe/config.json (always overwritten with current settings)
  const config = templates.getFrameConfigTemplate(name);
  fs.writeFileSync(
    path.join(frameDirPath, FRAME_CONFIG_FILE),
    JSON.stringify(config, null, 2),
    'utf8'
  );
  created.push('.subframe/config.json');

  // AGENTS.md
  track('AGENTS.md', createFileIfNotExists(
    path.join(projectPath, FRAME_FILES.AGENTS),
    templates.getAgentsTemplate(name)
  ));

  // CLAUDE.md — native file with backlink
  track('CLAUDE.md (backlink)', createOrMigrateNativeFile(
    path.join(projectPath, FRAME_FILES.CLAUDE)
  ));

  // GEMINI.md — native file with backlink
  track('GEMINI.md (backlink)', createOrMigrateNativeFile(
    path.join(projectPath, FRAME_FILES.GEMINI)
  ));

  // STRUCTURE.json
  track('STRUCTURE.json', createFileIfNotExists(
    path.join(projectPath, FRAME_FILES.STRUCTURE),
    templates.getStructureTemplate(name)
  ));

  // PROJECT_NOTES.md
  track('PROJECT_NOTES.md', createFileIfNotExists(
    path.join(projectPath, FRAME_FILES.NOTES),
    templates.getNotesTemplate(name)
  ));

  // tasks.json
  track('tasks.json', createFileIfNotExists(
    path.join(projectPath, FRAME_FILES.TASKS),
    templates.getTasksTemplate(name)
  ));

  // QUICKSTART.md
  track('QUICKSTART.md', createFileIfNotExists(
    path.join(projectPath, FRAME_FILES.QUICKSTART),
    templates.getQuickstartTemplate(name)
  ));

  // .subframe/bin directory + codex wrapper
  const binDirPath = path.join(frameDirPath, FRAME_BIN_DIR);
  if (!fs.existsSync(binDirPath)) {
    fs.mkdirSync(binDirPath, { recursive: true });
  }
  const codexWrapperPath = path.join(binDirPath, 'codex');
  if (!fs.existsSync(codexWrapperPath)) {
    fs.writeFileSync(codexWrapperPath, templates.getCodexWrapperTemplate(), { mode: 0o755 });
    created.push('.subframe/bin/codex');
  } else {
    skipped.push('.subframe/bin/codex');
  }

  // Git hooks (only if --no-hooks wasn't passed and .git/ exists)
  const gitDirPath = path.join(projectPath, '.git');
  if (hooks && fs.existsSync(gitDirPath)) {
    const hooksDirPath = path.join(projectPath, GITHOOKS_DIR);
    const hookPath = path.join(hooksDirPath, 'pre-commit');
    const updaterPath = path.join(hooksDirPath, 'update-structure.js');

    if (!fs.existsSync(hookPath)) {
      if (!fs.existsSync(hooksDirPath)) {
        fs.mkdirSync(hooksDirPath, { recursive: true });
      }
      fs.writeFileSync(hookPath, templates.getPreCommitHookTemplate(), { mode: 0o755 });
      fs.writeFileSync(updaterPath, templates.getHookUpdaterScript(), { mode: 0o644 });

      try {
        execSync('git config core.hooksPath .githooks', {
          cwd: projectPath,
          stdio: 'ignore'
        });
      } catch (err) {
        // Non-fatal — just warn
      }
      created.push('.githooks/pre-commit');
      created.push('.githooks/update-structure.js');
    } else {
      skipped.push('.githooks/pre-commit');
    }
  }

  // Claude Code skills (.claude/skills/sub-tasks/, sub-docs/, sub-audit/)
  const skillDirs = ['sub-tasks', 'sub-docs', 'sub-audit'];
  const skillTemplates = {
    'sub-tasks': templates.getSubTasksSkillTemplate,
    'sub-docs': templates.getSubDocsSkillTemplate,
    'sub-audit': templates.getSubAuditSkillTemplate,
  };
  for (const skillName of skillDirs) {
    const skillDir = path.join(projectPath, '.claude', 'skills', skillName);
    if (!fs.existsSync(skillDir)) {
      fs.mkdirSync(skillDir, { recursive: true });
    }
    track(`.claude/skills/${skillName}/SKILL.md`, createFileIfNotExists(
      path.join(skillDir, 'SKILL.md'),
      skillTemplates[skillName]()
    ));
  }

  // Claude Code hooks (.subframe/hooks/ + .claude/settings.json merge)
  const claudeHooks = options.claudeHooks !== false;
  if (claudeHooks) {
    // Create .subframe/hooks/ directory
    const subframeHooksDir = path.join(projectPath, SUBFRAME_HOOKS_DIR);
    if (!fs.existsSync(subframeHooksDir)) {
      fs.mkdirSync(subframeHooksDir, { recursive: true });
    }

    // Deploy hook scripts
    track('.subframe/hooks/session-start.js', createFileIfNotExists(
      path.join(projectPath, FRAME_FILES.HOOKS_SESSION_START),
      templates.getSessionStartHookTemplate()
    ));
    track('.subframe/hooks/prompt-submit.js', createFileIfNotExists(
      path.join(projectPath, FRAME_FILES.HOOKS_PROMPT_SUBMIT),
      templates.getPromptSubmitHookTemplate()
    ));
    track('.subframe/hooks/stop.js', createFileIfNotExists(
      path.join(projectPath, FRAME_FILES.HOOKS_STOP),
      templates.getStopHookTemplate()
    ));
    track('.subframe/hooks/pre-tool-use.js', createFileIfNotExists(
      path.join(projectPath, FRAME_FILES.HOOKS_PRE_TOOL_USE),
      templates.getPreToolUseHookTemplate()
    ));
    track('.subframe/hooks/post-tool-use.js', createFileIfNotExists(
      path.join(projectPath, FRAME_FILES.HOOKS_POST_TOOL_USE),
      templates.getPostToolUseHookTemplate()
    ));

    // Merge hooks into .claude/settings.json (preserves existing settings)
    try {
      const existing = readClaudeSettings(projectPath);
      const subframeHooksConfig = templates.getClaudeSettingsHooksTemplate();
      const merged = mergeSubFrameHooks(existing, subframeHooksConfig);
      writeClaudeSettings(projectPath, merged);
      created.push('.claude/settings.json (hooks merged)');
    } catch (err) {
      console.error('Error merging Claude settings:', err);
      skipped.push('.claude/settings.json (merge failed)');
    }
  }

  return { config, created, skipped };
}

module.exports = {
  initializeProject,
  checkExistingFiles,
  createFileIfNotExists,
  createOrMigrateNativeFile
};
