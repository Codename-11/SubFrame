/**
 * SubFrame Project Module
 * Handles SubFrame project initialization and detection
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { dialog } from 'electron';
import type { BrowserWindow, IpcMain } from 'electron';
import { IPC } from '../shared/ipcChannels';
import { FRAME_DIR, FRAME_CONFIG_FILE, FRAME_FILES, FRAME_VERSION, GITHOOKS_DIR } from '../shared/frameConstants';
import type { UninstallOptions, UninstallResult } from '../shared/ipcChannels';
import * as workspace from './workspace';
import { initializeProject, checkExistingFiles } from '../shared/projectInit';
import { getNativeFileStatus, getClaudeNativeStatus, removeBacklink } from '../shared/backlinkUtils';
import { getSubFrameHealth, getComponentRegistry } from '../shared/subframeHealth';
import { readClaudeSettings, writeClaudeSettings, mergeSubFrameHooks, removeSubFrameHooks } from '../shared/claudeSettingsUtils';
import * as templates from '../shared/frameTemplates';
import { SUBFRAME_VERSION_REGEX, SUBFRAME_MANAGED_REGEX } from '../shared/frameTemplates';

let mainWindow: BrowserWindow | null = null;

/**
 * Initialize frame project module
 */
function init(window: BrowserWindow): void {
  mainWindow = window;
}

/**
 * Check if a project is a SubFrame project
 */
function isFrameProject(projectPath: string): boolean {
  const configPath = path.join(projectPath, FRAME_DIR, FRAME_CONFIG_FILE);
  return fs.existsSync(configPath);
}

/**
 * Get SubFrame config from project
 */
function getFrameConfig(projectPath: string): Record<string, unknown> | null {
  const configPath = path.join(projectPath, FRAME_DIR, FRAME_CONFIG_FILE);
  try {
    const data = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(data);
  } catch (_err) {
    return null;
  }
}

/**
 * Show confirmation dialog before initializing SubFrame project
 */
async function showInitializeConfirmation(projectPath: string): Promise<boolean> {
  const existingFiles = checkExistingFiles(projectPath);

  const hasGitDir = fs.existsSync(path.join(projectPath, '.git'));
  const claudeStatus = getNativeFileStatus(projectPath, FRAME_FILES.CLAUDE);
  const geminiStatus = getNativeFileStatus(projectPath, FRAME_FILES.GEMINI);
  const claudeNative = getClaudeNativeStatus(projectPath);

  let message = 'This will create the following files in your project:\n\n';
  message += '  \u2022 .subframe/ (project files directory)\n';
  message += '  \u2022 .subframe/bin/ (AI tool wrappers)\n';
  message += '  \u2022 AGENTS.md (AI instructions)\n';
  message += '  \u2022 CLAUDE.md (references AGENTS.md)\n';
  message += '  \u2022 .subframe/STRUCTURE.json (module map)\n';
  message += '  \u2022 .subframe/PROJECT_NOTES.md (session notes)\n';
  message += '  \u2022 .subframe/tasks.json (task tracking)\n';
  message += '  \u2022 .subframe/QUICKSTART.md (getting started)\n';

  if (hasGitDir) {
    message += '  \u2022 .githooks/pre-commit (auto-updates STRUCTURE.json on commit)\n';
  }

  if (existingFiles.length > 0) {
    message += '\n\u26A0\uFE0F These files already exist and will NOT be overwritten:\n';
    message += existingFiles.map(f => `  \u2022 ${f}`).join('\n');
  }

  if (claudeStatus.exists && claudeStatus.hasUserContent && !claudeStatus.hasBacklink) {
    message += '\n\n\uD83D\uDCDD CLAUDE.md already has content. SubFrame will add a small reference to AGENTS.md at the top. Your existing content will be preserved.';
  }

  if (geminiStatus.exists && geminiStatus.hasUserContent && !geminiStatus.hasBacklink) {
    message += '\n\n\uD83D\uDCDD GEMINI.md already has content. SubFrame will add a small reference to AGENTS.md at the top. Your existing content will be preserved.';
  }

  message += '  \u2022 .claude/skills/ (sub-tasks, sub-docs, sub-audit slash commands)\n';
  message += '  \u2022 .subframe/hooks/ (Claude Code hook scripts)\n';
  message += '  \u2022 .claude/settings.json (hook configuration, merged with existing)\n';

  if (claudeNative.exists) {
    message += '\n\n\u2139\uFE0F .claude/ directory detected. SubFrame will add hook configuration to .claude/settings.json (merged, not overwritten).';
  }

  message += '\n\nDo you want to continue?';

  const hasWarnings = existingFiles.length > 0 ||
    (claudeStatus.exists && claudeStatus.hasUserContent) ||
    (geminiStatus.exists && geminiStatus.hasUserContent);

  const result = await dialog.showMessageBox(mainWindow!, {
    type: hasWarnings ? 'warning' : 'question',
    buttons: ['Cancel', 'Initialize'],
    defaultId: 0,
    cancelId: 0,
    title: 'Initialize as SubFrame Project',
    message: 'Initialize as SubFrame Project?',
    detail: message
  });

  return result.response === 1;
}

/**
 * Initialize a project as SubFrame project
 */
function initializeFrameProject(projectPath: string, projectName?: string): unknown {
  const result = initializeProject(projectPath, { name: projectName });

  // Update workspace to mark as SubFrame project (Electron-only concern)
  workspace.updateProjectFrameStatus(projectPath, true);

  return result.config;
}

/**
 * Clean up .bak files from previous updates.
 * Called at the start of each update cycle so only the most recent backups survive.
 */
function cleanupBackups(projectPath: string): number {
  let deleted = 0;
  const dirsToScan = [
    path.join(projectPath, FRAME_DIR),
    path.join(projectPath, GITHOOKS_DIR),
    path.join(projectPath, '.claude', 'skills'),
  ];

  function walkAndClean(dir: string): void {
    if (!fs.existsSync(dir)) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkAndClean(fullPath);
      } else if (entry.name.endsWith('.bak')) {
        try {
          fs.unlinkSync(fullPath);
          deleted++;
        } catch {
          // Non-fatal — skip files we can't delete
        }
      }
    }
  }

  for (const dir of dirsToScan) {
    walkAndClean(dir);
  }

  return deleted;
}

/**
 * Update SubFrame components in a project. Extracted from the IPC handler for testability.
 */
function updateSubFrameComponents(
  projectPath: string,
  componentIds: string[]
): { updated: string[]; failed: string[]; skipped: string[] } {
  const updated: string[] = [];
  const failed: string[] = [];
  const skipped: string[] = [];

  // Clean up old .bak files before creating new ones
  cleanupBackups(projectPath);

  const registry = getComponentRegistry();

  for (const id of componentIds) {
    const entry = registry.find((r) => r.id === id);
    if (!entry) {
      failed.push(id);
      continue;
    }

    try {
      const fullPath = path.join(projectPath, entry.path);

      // Check for user opt-out before any write (skip claude-settings which has no file header)
      if (entry.specialCheck !== 'claude-settings' && fs.existsSync(fullPath)) {
        try {
          const existingContent = fs.readFileSync(fullPath, 'utf8');
          if (SUBFRAME_MANAGED_REGEX.test(existingContent)) {
            skipped.push(id);
            continue;
          }
        } catch { /* unreadable file — proceed with update */ }
      }

      if (entry.specialCheck === 'claude-settings') {
        // Re-merge Claude hooks
        const existing = readClaudeSettings(projectPath);
        const subframeHooksConfig = templates.getClaudeSettingsHooksTemplate();
        const merged = mergeSubFrameHooks(existing, subframeHooksConfig);
        writeClaudeSettings(projectPath, merged);
        updated.push(id);
      } else if (entry.templateVersion !== undefined) {
        // Version-stamped template (e.g., AGENTS.md) — backup existing, regenerate

        // Backup existing file before overwriting
        if (fs.existsSync(fullPath)) {
          fs.copyFileSync(fullPath, fullPath + '.bak');
        }

        // Resolve project name from config, fallback to directory name
        let projectName = path.basename(projectPath);
        try {
          const config = JSON.parse(fs.readFileSync(
            path.join(projectPath, FRAME_DIR, 'config.json'), 'utf8'
          ));
          if (config.name && typeof config.name === 'string') {
            projectName = config.name;
          }
        } catch { /* use fallback */ }

        // Dispatch by component ID for templates that need parameters
        let content: string | null = null;
        if (entry.id === 'agents') {
          content = templates.getAgentsTemplate(projectName);
        }
        // Generic fallback: if the entry also has getTemplate(), use that
        if (content === null && entry.getTemplate) {
          content = entry.getTemplate();
        }

        if (content !== null) {
          const dir = path.dirname(fullPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          const writeOpts: fs.WriteFileOptions = entry.executable
            ? { encoding: 'utf8', mode: 0o755 }
            : 'utf8';
          fs.writeFileSync(fullPath, content, writeOpts);
          updated.push(id);
        } else {
          failed.push(id);
        }
      } else if (entry.getTemplate) {
        // Content-compared template — backup and regenerate

        // Always backup before overwriting (including legacy files)
        if (fs.existsSync(fullPath)) {
          fs.copyFileSync(fullPath, fullPath + '.bak');
        }

        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        const content = entry.getTemplate();
        const writeOpts: fs.WriteFileOptions = entry.executable
          ? { encoding: 'utf8', mode: 0o755 }
          : 'utf8';
        fs.writeFileSync(fullPath, content, writeOpts);
        updated.push(id);
      } else {
        // Existence-only components can't be "updated" (they contain user data)
        failed.push(id);
      }
    } catch (err) {
      console.error(`Error updating component ${id}:`, err);
      failed.push(id);
    }
  }

  return { updated, failed, skipped };
}

/**
 * Setup IPC handlers
 */
function setupIPC(ipcMain: IpcMain): void {
  ipcMain.on(IPC.CHECK_IS_FRAME_PROJECT, (event, projectPath: string) => {
    const isFrame = isFrameProject(projectPath);
    event.sender.send(IPC.IS_FRAME_PROJECT_RESULT, { projectPath, isFrame });
  });

  ipcMain.on(IPC.INITIALIZE_FRAME_PROJECT, async (event, { projectPath, projectName, confirmed }: { projectPath: string; projectName?: string; confirmed?: boolean }) => {
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
        error: (err as Error).message
      });
    }
  });

  ipcMain.on(IPC.GET_FRAME_CONFIG, (event, projectPath: string) => {
    const config = getFrameConfig(projectPath);
    event.sender.send(IPC.FRAME_CONFIG_DATA, { projectPath, config });
  });

  // ── SubFrame Health ──────────────────────────────────────────────────────

  ipcMain.on(IPC.GET_SUBFRAME_HEALTH, (event, projectPath: string) => {
    try {
      const health = getSubFrameHealth(projectPath);
      event.sender.send(IPC.SUBFRAME_HEALTH_DATA, { projectPath, health });
    } catch (err) {
      console.error('Error getting SubFrame health:', err);
      event.sender.send(IPC.SUBFRAME_HEALTH_DATA, {
        projectPath,
        health: null,
        error: (err as Error).message,
      });
    }
  });

  ipcMain.on(IPC.UPDATE_SUBFRAME_COMPONENTS, (event, { projectPath, componentIds }: { projectPath: string; componentIds: string[] }) => {
    const result = updateSubFrameComponents(projectPath, componentIds);
    event.sender.send(IPC.SUBFRAME_COMPONENTS_UPDATED, {
      projectPath,
      ...result,
      skipped: result.skipped.length > 0 ? result.skipped : undefined,
    });
  });

  ipcMain.on(IPC.UNINSTALL_SUBFRAME, (event, { projectPath, options }: { projectPath: string; options: UninstallOptions }) => {
    try {
      const result = uninstallSubFrame(projectPath, options);
      event.sender.send(IPC.SUBFRAME_UNINSTALLED, { projectPath, result });

      // If not dry run and we removed the .subframe dir, update workspace status
      if (!options.dryRun && options.removeSubframeDir) {
        workspace.updateProjectFrameStatus(projectPath, false);
        const projects = workspace.getProjects();
        event.sender.send(IPC.WORKSPACE_UPDATED, projects);
      }
    } catch (err) {
      console.error('Error uninstalling SubFrame:', err);
      event.sender.send(IPC.SUBFRAME_UNINSTALLED, {
        projectPath,
        result: null,
        error: (err as Error).message,
      });
    }
  });
}

/**
 * Safe uninstall of SubFrame from a project. Supports dry-run mode.
 */
function uninstallSubFrame(projectPath: string, options: UninstallOptions): UninstallResult {
  const removed: string[] = [];
  const preserved: string[] = [];
  const errors: string[] = [];

  const perform = !options.dryRun;

  // 1. Remove SubFrame hooks from .claude/settings.json
  if (options.removeClaudeHooks) {
    try {
      const settings = readClaudeSettings(projectPath);
      const cleaned = removeSubFrameHooks(settings);
      if (perform) {
        writeClaudeSettings(projectPath, cleaned);
      }
      removed.push('.claude/settings.json (SubFrame hooks removed)');
    } catch (err) {
      errors.push(`.claude/settings.json: ${(err as Error).message}`);
    }
  }

  // 2. Remove .githooks SubFrame files
  if (options.removeGitHooks) {
    const hookFiles = ['pre-commit', 'pre-push', 'update-structure.js'];
    const hooksDirPath = path.join(projectPath, GITHOOKS_DIR);

    for (const file of hookFiles) {
      const filePath = path.join(hooksDirPath, file);
      if (fs.existsSync(filePath)) {
        if (perform) {
          try { fs.unlinkSync(filePath); } catch (err) {
            errors.push(`${GITHOOKS_DIR}/${file}: ${(err as Error).message}`);
            continue;
          }
        }
        removed.push(`${GITHOOKS_DIR}/${file}`);
      }
    }

    // Reset git hooks path if directory is now empty
    if (perform && fs.existsSync(hooksDirPath)) {
      try {
        const remaining = fs.readdirSync(hooksDirPath);
        if (remaining.length === 0) {
          fs.rmdirSync(hooksDirPath);
          removed.push(`${GITHOOKS_DIR}/ (empty, removed)`);
          // Reset git config
          try {
            execSync('git config --unset core.hooksPath', {
              cwd: projectPath,
              stdio: 'ignore',
            });
          } catch { /* non-fatal */ }
        }
      } catch { /* non-fatal */ }
    }
  }

  // 3. Remove backlinks from CLAUDE.md and GEMINI.md
  if (options.removeBacklinks) {
    for (const filename of [FRAME_FILES.CLAUDE, FRAME_FILES.GEMINI]) {
      const filePath = path.join(projectPath, filename);
      if (fs.existsSync(filePath)) {
        if (perform) {
          removeBacklink(filePath);
        }
        removed.push(`${filename} (backlink removed, user content preserved)`);
      }
    }
  }

  // 4. Optionally remove AGENTS.md (only if it looks SubFrame-generated)
  if (options.removeAgentsMd) {
    const agentsPath = path.join(projectPath, FRAME_FILES.AGENTS);
    if (fs.existsSync(agentsPath)) {
      try {
        const content = fs.readFileSync(agentsPath, 'utf8');
        const isSubFrameGenerated = content.includes('SubFrame Project') && content.includes('Sub-Task Management');
        if (isSubFrameGenerated) {
          if (perform) fs.unlinkSync(agentsPath);
          removed.push('AGENTS.md');
        } else {
          preserved.push('AGENTS.md (modified by user, preserved)');
        }
      } catch (err) {
        errors.push(`AGENTS.md: ${(err as Error).message}`);
      }
    }
  }

  // 5. Optionally remove Claude Code skills
  if (options.removeClaudeSkills) {
    for (const skillDir of ['sub-tasks', 'sub-docs', 'sub-audit', 'onboard']) {
      const skillPath = path.join(projectPath, '.claude', 'skills', skillDir);
      if (fs.existsSync(skillPath)) {
        if (perform) {
          try { fs.rmSync(skillPath, { recursive: true, force: true }); } catch (err) {
            errors.push(`.claude/skills/${skillDir}/: ${(err as Error).message}`);
            continue;
          }
        }
        removed.push(`.claude/skills/${skillDir}/`);
      }
    }
  }

  // 6. Optionally remove .subframe/ directory
  if (options.removeSubframeDir) {
    const subframePath = path.join(projectPath, FRAME_DIR);
    if (fs.existsSync(subframePath)) {
      // Warn about user data files
      const userDataFiles = ['tasks.json', 'PROJECT_NOTES.md'];
      for (const file of userDataFiles) {
        const filePath = path.join(subframePath, file);
        if (fs.existsSync(filePath)) {
          preserved.push(`.subframe/${file} (contains user data)`);
        }
      }

      if (perform) {
        try {
          fs.rmSync(subframePath, { recursive: true, force: true });
          removed.push('.subframe/ (entire directory)');
        } catch (err) {
          errors.push(`.subframe/: ${(err as Error).message}`);
        }
      } else {
        removed.push('.subframe/ (entire directory)');
      }
    }
  }

  return {
    success: errors.length === 0,
    removed,
    preserved,
    errors,
    dryRun: options.dryRun,
  };
}

export { init, isFrameProject, getFrameConfig, initializeFrameProject, updateSubFrameComponents, setupIPC };
