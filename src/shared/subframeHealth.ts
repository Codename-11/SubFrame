/**
 * SubFrame Health Checking
 * Evaluates the deployment status of all SubFrame components in a project.
 * Used by the health panel to show what's installed, outdated, or missing.
 */

import * as fs from 'fs';
import * as path from 'path';
import { FRAME_DIR, FRAME_FILES, FRAME_TASKS_DIR, GITHOOKS_DIR, SUBFRAME_HOOKS_DIR } from './frameConstants';
import * as templates from './frameTemplates';
import { hasSubFrameHooks, readClaudeSettings } from './claudeSettingsUtils';
import type { SubFrameComponentStatus, SubFrameHealthStatus } from './ipcChannels';

type ComponentCategory = 'core' | 'hooks' | 'claude-integration' | 'git' | 'skills';

interface ComponentRegistryEntry {
  id: string;
  label: string;
  category: ComponentCategory;
  path: string;
  /** If set, used to compare file content for currency checks */
  getTemplate?: () => string;
  /** If true, only check existence (file contains user data) */
  existenceOnly?: boolean;
  /** Special check type for non-file components */
  specialCheck?: 'claude-settings';
  /** If set, check for embedded version marker instead of exact content match */
  templateVersion?: number;
}

/**
 * Registry of all deployable SubFrame components.
 * Each entry defines what to check, where to find it, and how to verify currency.
 */
const COMPONENT_REGISTRY: ComponentRegistryEntry[] = [
  // ── Core files (existence-only — they contain user data) ──
  {
    id: 'config',
    label: '.subframe/config.json',
    category: 'core',
    path: path.join(FRAME_DIR, 'config.json'),
    existenceOnly: true,
  },
  {
    id: 'agents',
    label: 'AGENTS.md',
    category: 'core',
    path: FRAME_FILES.AGENTS,
    templateVersion: templates.AGENTS_TEMPLATE_VERSION,
  },
  {
    id: 'structure',
    label: 'STRUCTURE.json',
    category: 'core',
    path: FRAME_FILES.STRUCTURE,
    existenceOnly: true,
  },
  {
    id: 'notes',
    label: 'PROJECT_NOTES.md',
    category: 'core',
    path: FRAME_FILES.NOTES,
    existenceOnly: true,
  },
  {
    id: 'tasks',
    label: 'tasks/',
    category: 'core',
    path: FRAME_TASKS_DIR,
    existenceOnly: true,
  },
  {
    id: 'quickstart',
    label: 'QUICKSTART.md',
    category: 'core',
    path: FRAME_FILES.QUICKSTART,
    existenceOnly: true,
  },
  {
    id: 'docs-internal',
    label: 'docs-internal/',
    category: 'core',
    path: FRAME_FILES.DOCS_INTERNAL,
    existenceOnly: true,
  },
  {
    id: 'codex-wrapper',
    label: 'Codex wrapper',
    category: 'core',
    path: path.join(FRAME_DIR, 'bin', 'codex'),
    getTemplate: () => templates.getCodexWrapperTemplate(),
  },

  // ── Claude Code hooks (content-compared for currency) ──
  {
    id: 'hook-session-start',
    label: 'Session Start hook',
    category: 'hooks',
    path: FRAME_FILES.HOOKS_SESSION_START,
    getTemplate: () => templates.getSessionStartHookTemplate(),
  },
  {
    id: 'hook-prompt-submit',
    label: 'Prompt Submit hook',
    category: 'hooks',
    path: FRAME_FILES.HOOKS_PROMPT_SUBMIT,
    getTemplate: () => templates.getPromptSubmitHookTemplate(),
  },
  {
    id: 'hook-stop',
    label: 'Stop hook',
    category: 'hooks',
    path: FRAME_FILES.HOOKS_STOP,
    getTemplate: () => templates.getStopHookTemplate(),
  },
  {
    id: 'hook-pre-tool-use',
    label: 'Pre-Tool-Use hook',
    category: 'hooks',
    path: FRAME_FILES.HOOKS_PRE_TOOL_USE,
    getTemplate: () => templates.getPreToolUseHookTemplate(),
  },
  {
    id: 'hook-post-tool-use',
    label: 'Post-Tool-Use hook',
    category: 'hooks',
    path: FRAME_FILES.HOOKS_POST_TOOL_USE,
    getTemplate: () => templates.getPostToolUseHookTemplate(),
  },

  // ── Claude Code skills (content-compared for currency) ──
  {
    id: 'skill-sub-tasks',
    label: '/sub-tasks skill',
    category: 'skills',
    path: FRAME_FILES.SKILLS_SUB_TASKS,
    getTemplate: () => templates.getSubTasksSkillTemplate(),
  },
  {
    id: 'skill-sub-docs',
    label: '/sub-docs skill',
    category: 'skills',
    path: FRAME_FILES.SKILLS_SUB_DOCS,
    getTemplate: () => templates.getSubDocsSkillTemplate(),
  },
  {
    id: 'skill-sub-audit',
    label: '/sub-audit skill',
    category: 'skills',
    path: FRAME_FILES.SKILLS_SUB_AUDIT,
    getTemplate: () => templates.getSubAuditSkillTemplate(),
  },
  {
    id: 'skill-onboard',
    label: '/onboard skill',
    category: 'skills',
    path: FRAME_FILES.SKILLS_ONBOARD,
    getTemplate: () => templates.getOnboardSkillTemplate(),
  },

  // ── Claude integration ──
  {
    id: 'claude-settings',
    label: 'Claude hooks config',
    category: 'claude-integration',
    path: FRAME_FILES.CLAUDE_SETTINGS,
    specialCheck: 'claude-settings',
  },

  // ── Git hooks (content-compared) ──
  {
    id: 'pre-commit',
    label: 'Pre-commit hook',
    category: 'git',
    path: path.join(GITHOOKS_DIR, 'pre-commit'),
    getTemplate: () => templates.getPreCommitHookTemplate(),
  },
  {
    id: 'update-structure',
    label: 'Structure updater',
    category: 'git',
    path: path.join(GITHOOKS_DIR, 'update-structure.js'),
    getTemplate: () => templates.getHookUpdaterScript(),
  },
];

/**
 * Check if a single component is current (content matches template).
 */
function checkComponent(
  projectPath: string,
  entry: ComponentRegistryEntry
): SubFrameComponentStatus {
  const fullPath = path.join(projectPath, entry.path);

  // Special check for claude-settings
  if (entry.specialCheck === 'claude-settings') {
    const settings = readClaudeSettings(projectPath);
    const merged = hasSubFrameHooks(settings);
    return {
      id: entry.id,
      label: entry.label,
      category: entry.category,
      exists: merged,
      current: merged,
      needsUpdate: false,
      path: entry.path,
    };
  }

  const exists = fs.existsSync(fullPath);

  if (!exists) {
    return {
      id: entry.id,
      label: entry.label,
      category: entry.category,
      exists: false,
      current: false,
      needsUpdate: false,
      path: entry.path,
    };
  }

  // Existence-only check (user data files)
  if (entry.existenceOnly) {
    return {
      id: entry.id,
      label: entry.label,
      category: entry.category,
      exists: true,
      current: true,
      needsUpdate: false,
      path: entry.path,
    };
  }

  // Template version check (embedded version marker)
  if (entry.templateVersion !== undefined) {
    try {
      const content = fs.readFileSync(fullPath, 'utf8');
      const match = content.match(/<!-- subframe-template-version:\s*(\d+)\s*-->/);
      const fileVersion = match ? parseInt(match[1], 10) : 0;
      const isCurrent = fileVersion >= entry.templateVersion;
      return {
        id: entry.id,
        label: entry.label,
        category: entry.category,
        exists: true,
        current: isCurrent,
        needsUpdate: !isCurrent,
        path: entry.path,
      };
    } catch {
      return {
        id: entry.id,
        label: entry.label,
        category: entry.category,
        exists: true,
        current: false,
        needsUpdate: true,
        path: entry.path,
      };
    }
  }

  // Content comparison check
  if (entry.getTemplate) {
    try {
      const currentContent = fs.readFileSync(fullPath, 'utf8');
      const templateContent = entry.getTemplate();
      const isCurrent = currentContent === templateContent;
      return {
        id: entry.id,
        label: entry.label,
        category: entry.category,
        exists: true,
        current: isCurrent,
        needsUpdate: !isCurrent,
        path: entry.path,
      };
    } catch {
      return {
        id: entry.id,
        label: entry.label,
        category: entry.category,
        exists: true,
        current: false,
        needsUpdate: true,
        path: entry.path,
      };
    }
  }

  return {
    id: entry.id,
    label: entry.label,
    category: entry.category,
    exists: true,
    current: true,
    needsUpdate: false,
    path: entry.path,
  };
}

/**
 * Get the full SubFrame health status for a project.
 */
export function getSubFrameHealth(projectPath: string): SubFrameHealthStatus {
  const components = COMPONENT_REGISTRY.map((entry) =>
    checkComponent(projectPath, entry)
  );

  const healthy = components.filter((c) => c.exists && c.current).length;
  const needsUpdate = components.filter((c) => c.needsUpdate).length;
  const missing = components.filter((c) => !c.exists).length;

  // Check if Claude settings have SubFrame hooks merged
  const settings = readClaudeSettings(projectPath);
  const claudeSettingsMerged = hasSubFrameHooks(settings);

  // Check git hooks path
  let gitHooksPath: string | null = null;
  const githooksDir = path.join(projectPath, GITHOOKS_DIR);
  if (fs.existsSync(githooksDir)) {
    gitHooksPath = GITHOOKS_DIR;
  }

  return {
    components,
    healthy,
    total: components.length,
    needsUpdate,
    missing,
    claudeSettingsMerged,
    gitHooksPath,
  };
}

/**
 * Get the component registry (for use by update handlers).
 */
export function getComponentRegistry(): ComponentRegistryEntry[] {
  return COMPONENT_REGISTRY;
}

/**
 * Get the hooks directory path constant.
 */
export function getHooksDir(): string {
  return SUBFRAME_HOOKS_DIR;
}
