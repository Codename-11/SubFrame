/**
 * SubFrame Health Checking
 * Evaluates the deployment status of all SubFrame components in a project.
 * Used by the health panel to show what's installed, outdated, or missing.
 */

import * as fs from 'fs';
import * as path from 'path';
import { FRAME_DIR, FRAME_FILES, FRAME_TASKS_DIR, FRAME_WORKFLOWS_DIR, FRAME_VERSION, GITHOOKS_DIR, SUBFRAME_HOOKS_DIR } from './frameConstants';
import * as templates from './frameTemplates';
import { SUBFRAME_VERSION_REGEX, SUBFRAME_MANAGED_REGEX } from './frameTemplates';
import { hasSubFrameHooks, getSubFrameHookCoverage, readClaudeSettings } from './claudeSettingsUtils';
import type { SubFrameComponentStatus, SubFrameHealthStatus } from './ipcChannels';

type ComponentCategory = 'core' | 'hooks' | 'claude-integration' | 'git' | 'skills' | 'pipeline';

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
  /** If true, file needs executable permission (0o755) on Unix — used by update handler */
  executable?: boolean;
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
    id: 'tasks-index',
    label: '.subframe/tasks.json',
    category: 'core',
    path: FRAME_FILES.TASKS,
    existenceOnly: true,
  },
  {
    id: 'claude-md',
    label: 'CLAUDE.md',
    category: 'core',
    path: FRAME_FILES.CLAUDE,
    existenceOnly: true,
  },
  {
    id: 'gemini-md',
    label: 'GEMINI.md',
    category: 'core',
    path: FRAME_FILES.GEMINI,
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
    executable: true,
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
    executable: true,
  },
  {
    id: 'pre-push',
    label: 'Pre-push hook',
    category: 'git',
    path: path.join(GITHOOKS_DIR, 'pre-push'),
    getTemplate: () => templates.getPrePushHookTemplate(),
    executable: true,
  },
  {
    id: 'update-structure',
    label: 'Structure updater',
    category: 'git',
    path: path.join(GITHOOKS_DIR, 'update-structure.js'),
    getTemplate: () => templates.getHookUpdaterScript(),
  },

  // ── Pipeline workflows ──
  {
    id: 'workflows-dir',
    label: 'workflows/',
    category: 'pipeline',
    path: FRAME_WORKFLOWS_DIR,
    existenceOnly: true,
  },
  {
    id: 'workflow-review',
    label: 'review.yml',
    category: 'pipeline',
    path: path.join(FRAME_WORKFLOWS_DIR, 'review.yml'),
    getTemplate: () => templates.getDefaultReviewWorkflow(),
  },
  {
    id: 'workflow-task-verify',
    label: 'task-verify.yml',
    category: 'pipeline',
    path: path.join(FRAME_WORKFLOWS_DIR, 'task-verify.yml'),
    getTemplate: () => templates.getTaskVerifyWorkflow(),
  },
  {
    id: 'workflow-health-check',
    label: 'health-check.yml',
    category: 'pipeline',
    path: path.join(FRAME_WORKFLOWS_DIR, 'health-check.yml'),
    getTemplate: () => templates.getHealthCheckWorkflow(),
  },
  {
    id: 'workflow-docs-audit',
    label: 'docs-audit.yml',
    category: 'pipeline',
    path: path.join(FRAME_WORKFLOWS_DIR, 'docs-audit.yml'),
    getTemplate: () => templates.getDocsAuditWorkflow(),
  },
  {
    id: 'workflow-security-scan',
    label: 'security-scan.yml',
    category: 'pipeline',
    path: path.join(FRAME_WORKFLOWS_DIR, 'security-scan.yml'),
    getTemplate: () => templates.getSecurityScanWorkflow(),
  },
];

/**
 * Compare two semver-ish version strings (e.g., "0.2.4-beta" vs "0.3.0-beta").
 * Returns true if `deployed` is older than `current`.
 */
function isVersionOlder(deployed: string, current: string): boolean {
  // Strip any leading 'v'
  const normalize = (v: string) => v.replace(/^v/, '');
  const dParts = normalize(deployed).split('-')[0].split('.').map(Number);
  const cParts = normalize(current).split('-')[0].split('.').map(Number);

  for (let i = 0; i < Math.max(dParts.length, cParts.length); i++) {
    const d = dParts[i] ?? 0;
    const c = cParts[i] ?? 0;
    if (d < c) return true;
    if (d > c) return false;
  }

  // Numeric parts are equal — compare pre-release suffix
  // "0.2.4-beta" vs "0.2.4" → beta is older (pre-release < release)
  const dSuffix = normalize(deployed).includes('-') ? normalize(deployed).split('-').slice(1).join('-') : '';
  const cSuffix = normalize(current).includes('-') ? normalize(current).split('-').slice(1).join('-') : '';

  // Both same suffix (or both no suffix) → not older
  if (dSuffix === cSuffix) return false;
  // Deployed has pre-release, current doesn't → deployed is older
  if (dSuffix && !cSuffix) return true;
  // Deployed has no pre-release, current does → deployed is newer
  if (!dSuffix && cSuffix) return false;
  // Both have different pre-release suffixes — semver-aware comparison
  // Split by '.' and compare segments (numeric segments compared numerically)
  const dSegments = dSuffix.split('.');
  const cSegments = cSuffix.split('.');
  for (let j = 0; j < Math.max(dSegments.length, cSegments.length); j++) {
    const dSeg = dSegments[j];
    const cSeg = cSegments[j];
    if (dSeg === undefined) return true;
    if (cSeg === undefined) return false;
    const dNum = /^\d+$/.test(dSeg) ? parseInt(dSeg, 10) : NaN;
    const cNum = /^\d+$/.test(cSeg) ? parseInt(cSeg, 10) : NaN;
    if (!isNaN(dNum) && !isNaN(cNum)) {
      if (dNum < cNum) return true;
      if (dNum > cNum) return false;
    } else {
      if (dSeg < cSeg) return true;
      if (dSeg > cSeg) return false;
    }
  }
  return false;
}

/**
 * Check if a single component is current (content matches template).
 */
function checkComponent(
  projectPath: string,
  entry: ComponentRegistryEntry
): SubFrameComponentStatus {
  const fullPath = path.join(projectPath, entry.path);

  // Special check for claude-settings — structural hook validation
  if (entry.specialCheck === 'claude-settings') {
    const settings = readClaudeSettings(projectPath);
    const coverage = getSubFrameHookCoverage(settings);
    const allConfigured = coverage.missing.length === 0;
    const anyConfigured = coverage.configured.length > 0;
    return {
      id: entry.id,
      label: entry.label,
      category: entry.category,
      exists: anyConfigured,
      current: allConfigured,
      // Only needsUpdate if partially configured (some but not all hooks)
      // If none configured, it's "missing" not "needs update"
      needsUpdate: anyConfigured && !allConfigured,
      path: entry.path,
      missingHooks: coverage.missing.length > 0 ? coverage.missing : undefined,
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

  // Template version check (embedded HTML comment version marker, e.g., AGENTS.md)
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

  // Components with templates: use version-aware checking
  if (entry.getTemplate) {
    try {
      const currentContent = fs.readFileSync(fullPath, 'utf8');

      // Check for user opt-out
      if (SUBFRAME_MANAGED_REGEX.test(currentContent)) {
        return {
          id: entry.id,
          label: entry.label,
          category: entry.category,
          exists: true,
          current: true,
          needsUpdate: false,
          path: entry.path,
          managedOptOut: true,
        };
      }

      // Try to extract @subframe-version stamp
      const versionMatch = currentContent.match(SUBFRAME_VERSION_REGEX);

      if (versionMatch) {
        const deployedVersion = versionMatch[1];
        // Version stamp found — compare against current app version
        if (deployedVersion === FRAME_VERSION) {
          // Same version — current even if content differs (user may have edited)
          return {
            id: entry.id,
            label: entry.label,
            category: entry.category,
            exists: true,
            current: true,
            needsUpdate: false,
            path: entry.path,
            deployedVersion,
          };
        }
        if (isVersionOlder(deployedVersion, FRAME_VERSION)) {
          // Older version — needs update
          return {
            id: entry.id,
            label: entry.label,
            category: entry.category,
            exists: true,
            current: false,
            needsUpdate: true,
            path: entry.path,
            deployedVersion,
          };
        }
        // deployedVersion is same or newer (edge case) — treat as current
        return {
          id: entry.id,
          label: entry.label,
          category: entry.category,
          exists: true,
          current: true,
          needsUpdate: false,
          path: entry.path,
          deployedVersion,
        };
      }

      // No version stamp (legacy deployment) — fall back to content comparison
      // If content matches current template, it's healthy (stamp will be added on next deploy)
      // If content differs, it's outdated and needs update
      const templateContent = entry.getTemplate();
      const contentMatches = currentContent === templateContent;
      return {
        id: entry.id,
        label: entry.label,
        category: entry.category,
        exists: true,
        current: contentMatches,
        needsUpdate: !contentMatches,
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
