/**
 * SubFrame Project Initialization (Pure Node.js)
 * Core init logic shared between the Electron app and the CLI.
 * No Electron dependencies — safe to require from plain Node.js.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { FRAME_DIR, FRAME_CONFIG_FILE, FRAME_FILES, FRAME_BIN_DIR, GITHOOKS_DIR, SUBFRAME_HOOKS_DIR, FRAME_TASKS_DIR, FRAME_WORKFLOWS_DIR } from './frameConstants';
import * as templates from './frameTemplates';
import { injectBacklink, isSymlinkFile } from './backlinkUtils';
import { readClaudeSettings, mergeSubFrameHooks, writeClaudeSettings } from './claudeSettingsUtils';

export interface InitOptions {
  name?: string;
  hooks?: boolean;
  claudeHooks?: boolean;
}

export interface InitResult {
  config: ReturnType<typeof templates.getFrameConfigTemplate>;
  created: string[];
  skipped: string[];
}

/**
 * Create file if it doesn't exist
 * @returns true if the file was created, false if it already existed
 */
export function createFileIfNotExists(filePath: string, content: string | object): boolean {
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
 */
export function createOrMigrateNativeFile(filePath: string): boolean {
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
 */
export function checkExistingFiles(projectPath: string): string[] {
  const existingFiles: string[] = [];
  const filesToCheck = [
    { name: 'AGENTS.md', path: path.join(projectPath, FRAME_FILES.AGENTS) },
    { name: 'CLAUDE.md', path: path.join(projectPath, FRAME_FILES.CLAUDE) },
    { name: 'GEMINI.md', path: path.join(projectPath, FRAME_FILES.GEMINI) },
    { name: '.subframe/STRUCTURE.json', path: path.join(projectPath, FRAME_FILES.STRUCTURE) },
    { name: '.subframe/PROJECT_NOTES.md', path: path.join(projectPath, FRAME_FILES.NOTES) },
    { name: '.subframe/tasks/', path: path.join(projectPath, FRAME_TASKS_DIR) },
    { name: '.subframe/tasks.json', path: path.join(projectPath, FRAME_FILES.TASKS) },
    { name: '.subframe/QUICKSTART.md', path: path.join(projectPath, FRAME_FILES.QUICKSTART) },
    { name: '.subframe/docs-internal/', path: path.join(projectPath, FRAME_FILES.DOCS_INTERNAL) },
    { name: '.claude/skills/sub-tasks/', path: path.join(projectPath, '.claude', 'skills', 'sub-tasks') },
    { name: '.claude/skills/sub-docs/', path: path.join(projectPath, '.claude', 'skills', 'sub-docs') },
    { name: '.claude/skills/sub-audit/', path: path.join(projectPath, '.claude', 'skills', 'sub-audit') },
    { name: '.claude/skills/onboard/', path: path.join(projectPath, '.claude', 'skills', 'onboard') },
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
 * Migrate legacy root-level files into .subframe/ directory
 */
export function migrateRootFiles(projectPath: string): string[] {
  const frameDirPath = path.join(projectPath, FRAME_DIR);
  const migrated: string[] = [];

  const filesToMigrate = [
    { rootName: 'STRUCTURE.json', subframeName: 'STRUCTURE.json' },
    { rootName: 'PROJECT_NOTES.md', subframeName: 'PROJECT_NOTES.md' },
    { rootName: 'tasks.json', subframeName: 'tasks.json' },
    { rootName: 'QUICKSTART.md', subframeName: 'QUICKSTART.md' },
    { rootName: 'docs-internal', subframeName: 'docs-internal' }
  ];

  for (const file of filesToMigrate) {
    const rootPath = path.join(projectPath, file.rootName);
    const subframePath = path.join(frameDirPath, file.subframeName);

    if (fs.existsSync(rootPath) && !fs.existsSync(subframePath)) {
      fs.renameSync(rootPath, subframePath);
      migrated.push(file.rootName);
    }
  }

  return migrated;
}

/**
 * Initialize a project as a SubFrame project.
 */
export function initializeProject(projectPath: string, options: InitOptions = {}): InitResult {
  const name = options.name || path.basename(projectPath);
  const hooks = options.hooks !== false;
  const frameDirPath = path.join(projectPath, FRAME_DIR);

  const created: string[] = [];
  const skipped: string[] = [];

  function track(label: string, wasCreated: boolean): void {
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

  // Migrate legacy root-level files
  const migrated = migrateRootFiles(projectPath);
  if (migrated.length > 0) {
    created.push(`migrated: ${migrated.join(', ')}`);
  }

  // Create .subframe/config.json
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

  // CLAUDE.md
  track('CLAUDE.md (backlink)', createOrMigrateNativeFile(
    path.join(projectPath, FRAME_FILES.CLAUDE)
  ));

  // GEMINI.md
  track('GEMINI.md (backlink)', createOrMigrateNativeFile(
    path.join(projectPath, FRAME_FILES.GEMINI)
  ));

  // .subframe/STRUCTURE.json
  track('.subframe/STRUCTURE.json', createFileIfNotExists(
    path.join(projectPath, FRAME_FILES.STRUCTURE),
    templates.getStructureTemplate(name)
  ));

  // .subframe/PROJECT_NOTES.md
  track('.subframe/PROJECT_NOTES.md', createFileIfNotExists(
    path.join(projectPath, FRAME_FILES.NOTES),
    templates.getNotesTemplate(name)
  ));

  // .subframe/tasks/ directory (for individual task .md files)
  const tasksDir = path.join(projectPath, FRAME_TASKS_DIR);
  if (!fs.existsSync(tasksDir)) {
    fs.mkdirSync(tasksDir, { recursive: true });
    track('.subframe/tasks/', true);
  }

  // .subframe/tasks.json (generated index)
  track('.subframe/tasks.json', createFileIfNotExists(
    path.join(projectPath, FRAME_FILES.TASKS),
    templates.getTasksTemplate(name)
  ));

  // .subframe/QUICKSTART.md
  track('.subframe/QUICKSTART.md', createFileIfNotExists(
    path.join(projectPath, FRAME_FILES.QUICKSTART),
    templates.getQuickstartTemplate(name)
  ));

  // .subframe/docs-internal/
  const docsInternalPath = path.join(projectPath, FRAME_FILES.DOCS_INTERNAL);
  if (!fs.existsSync(docsInternalPath)) {
    fs.mkdirSync(docsInternalPath, { recursive: true });
    fs.writeFileSync(
      path.join(docsInternalPath, 'README.md'),
      templates.getDocsInternalReadme(name),
      'utf8'
    );
    created.push('.subframe/docs-internal/');
  } else {
    skipped.push('.subframe/docs-internal/');
  }

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

  // Git hooks
  const gitDirPath = path.join(projectPath, '.git');
  if (hooks && !fs.existsSync(gitDirPath)) {
    skipped.push('.githooks/ (no .git directory)');
  }
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
      } catch (_err) {
        // Non-fatal
      }
      created.push('.githooks/pre-commit');
      created.push('.githooks/update-structure.js');
    } else {
      skipped.push('.githooks/pre-commit');
    }
  }

  // Pre-push hook (alongside pre-commit)
  if (hooks && fs.existsSync(gitDirPath)) {
    const hooksDirPath = path.join(projectPath, GITHOOKS_DIR);
    const prePushPath = path.join(hooksDirPath, 'pre-push');
    if (!fs.existsSync(prePushPath)) {
      if (!fs.existsSync(hooksDirPath)) {
        fs.mkdirSync(hooksDirPath, { recursive: true });
      }
      fs.writeFileSync(prePushPath, templates.getPrePushHookTemplate(), { mode: 0o755 });
      created.push('.githooks/pre-push');
    } else {
      skipped.push('.githooks/pre-push');
    }
  }

  // Pipeline workflows (.subframe/workflows/)
  const workflowsDir = path.join(projectPath, FRAME_WORKFLOWS_DIR);
  if (!fs.existsSync(workflowsDir)) {
    fs.mkdirSync(workflowsDir, { recursive: true });
    fs.writeFileSync(path.join(workflowsDir, 'review.yml'), templates.getDefaultReviewWorkflow(), 'utf8');
    fs.writeFileSync(path.join(workflowsDir, 'task-verify.yml'), templates.getTaskVerifyWorkflow(), 'utf8');
    fs.writeFileSync(path.join(workflowsDir, 'health-check.yml'), templates.getHealthCheckWorkflow(), 'utf8');
    created.push('.subframe/workflows/ (3 templates)');
  } else {
    skipped.push('.subframe/workflows/');
  }

  // Claude Code skills (.claude/skills/sub-tasks/, sub-docs/, sub-audit/, onboard/)
  const skillDirs = ['sub-tasks', 'sub-docs', 'sub-audit', 'onboard'] as const;
  const skillTemplates: Record<string, () => string> = {
    'sub-tasks': templates.getSubTasksSkillTemplate,
    'sub-docs': templates.getSubDocsSkillTemplate,
    'sub-audit': templates.getSubAuditSkillTemplate,
    'onboard': templates.getOnboardSkillTemplate,
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
