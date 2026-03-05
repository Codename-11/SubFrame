/**
 * Tests for subframeHealth — component registry and health status checking
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getSubFrameHealth, getComponentRegistry, getHooksDir } from '../../src/shared/subframeHealth';
import { writeClaudeSettings, mergeSubFrameHooks } from '../../src/shared/claudeSettingsUtils';
import { FRAME_DIR, FRAME_FILES, FRAME_TASKS_DIR, FRAME_WORKFLOWS_DIR, GITHOOKS_DIR } from '../../src/shared/frameConstants';
import { AGENTS_TEMPLATE_VERSION } from '../../src/shared/frameTemplates';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'subframe-health-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

/**
 * Helper: get template content from the component registry by component ID.
 * This avoids importing frameTemplates directly (which may resolve to stale .js).
 */
function getTemplateById(id: string): string {
  const entry = getComponentRegistry().find((e) => e.id === id);
  if (!entry?.getTemplate) throw new Error(`No template for ${id}`);
  return entry.getTemplate();
}

/**
 * Helper: build a SubFrame hooks config matching what getClaudeSettingsHooksTemplate returns.
 * Uses the registry's stop hook template to get the hooks dir path.
 */
function makeSubFrameHooksConfig(): { hooks: Record<string, Array<{ matcher: string; hooks: Array<{ type: string; command: string }> }>> } {
  return {
    hooks: {
      SessionStart: [{
        matcher: '',
        hooks: [{ type: 'command', command: 'node .subframe/hooks/session-start.js' }],
      }],
      UserPromptSubmit: [{
        matcher: '',
        hooks: [{ type: 'command', command: 'node .subframe/hooks/prompt-submit.js' }],
      }],
      Stop: [{
        matcher: '',
        hooks: [{ type: 'command', command: 'node .subframe/hooks/stop.js' }],
      }],
    },
  };
}

/**
 * Deploy a minimal SubFrame project (all components present and current).
 * Uses component registry getTemplate() to get correct content.
 */
function deployFullProject(): void {
  const frameDirPath = path.join(tmpDir, FRAME_DIR);
  fs.mkdirSync(frameDirPath, { recursive: true });

  // Core files (existence-only)
  fs.writeFileSync(path.join(frameDirPath, 'config.json'), '{}');
  fs.writeFileSync(
    path.join(tmpDir, FRAME_FILES.AGENTS),
    `# Agents\n\n<!-- subframe-template-version: ${AGENTS_TEMPLATE_VERSION} -->\n`,
  );
  fs.writeFileSync(path.join(tmpDir, FRAME_FILES.STRUCTURE), '{}');
  fs.writeFileSync(path.join(tmpDir, FRAME_FILES.NOTES), '# Notes');
  fs.mkdirSync(path.join(tmpDir, FRAME_TASKS_DIR), { recursive: true }); // tasks/ directory
  fs.writeFileSync(path.join(tmpDir, FRAME_FILES.QUICKSTART), '# Quick');
  fs.mkdirSync(path.join(tmpDir, FRAME_FILES.DOCS_INTERNAL), { recursive: true });

  // Codex wrapper (content-compared — use registry template)
  const binDir = path.join(frameDirPath, 'bin');
  fs.mkdirSync(binDir, { recursive: true });
  fs.writeFileSync(path.join(binDir, 'codex'), getTemplateById('codex-wrapper'));

  // Hook scripts (content-compared — use registry templates)
  const hooksDir = path.join(tmpDir, '.subframe', 'hooks');
  fs.mkdirSync(hooksDir, { recursive: true });
  fs.writeFileSync(
    path.join(tmpDir, FRAME_FILES.HOOKS_SESSION_START),
    getTemplateById('hook-session-start'),
  );
  fs.writeFileSync(
    path.join(tmpDir, FRAME_FILES.HOOKS_PROMPT_SUBMIT),
    getTemplateById('hook-prompt-submit'),
  );
  fs.writeFileSync(
    path.join(tmpDir, FRAME_FILES.HOOKS_STOP),
    getTemplateById('hook-stop'),
  );
  fs.writeFileSync(
    path.join(tmpDir, FRAME_FILES.HOOKS_PRE_TOOL_USE),
    getTemplateById('hook-pre-tool-use'),
  );
  fs.writeFileSync(
    path.join(tmpDir, FRAME_FILES.HOOKS_POST_TOOL_USE),
    getTemplateById('hook-post-tool-use'),
  );

  // Claude settings with hooks merged
  const sfHooks = makeSubFrameHooksConfig();
  const merged = mergeSubFrameHooks({}, sfHooks);
  writeClaudeSettings(tmpDir, merged);

  // Skill files (content-compared — use registry templates)
  fs.mkdirSync(path.join(tmpDir, path.dirname(FRAME_FILES.SKILLS_SUB_TASKS)), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, path.dirname(FRAME_FILES.SKILLS_SUB_DOCS)), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, path.dirname(FRAME_FILES.SKILLS_SUB_AUDIT)), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, path.dirname(FRAME_FILES.SKILLS_ONBOARD)), { recursive: true });
  fs.writeFileSync(
    path.join(tmpDir, FRAME_FILES.SKILLS_SUB_TASKS),
    getTemplateById('skill-sub-tasks'),
  );
  fs.writeFileSync(
    path.join(tmpDir, FRAME_FILES.SKILLS_SUB_DOCS),
    getTemplateById('skill-sub-docs'),
  );
  fs.writeFileSync(
    path.join(tmpDir, FRAME_FILES.SKILLS_SUB_AUDIT),
    getTemplateById('skill-sub-audit'),
  );
  fs.writeFileSync(
    path.join(tmpDir, FRAME_FILES.SKILLS_ONBOARD),
    getTemplateById('skill-onboard'),
  );

  // Git hooks (content-compared — use registry templates)
  const githooksDir = path.join(tmpDir, GITHOOKS_DIR);
  fs.mkdirSync(githooksDir, { recursive: true });
  fs.writeFileSync(
    path.join(githooksDir, 'pre-commit'),
    getTemplateById('pre-commit'),
  );
  fs.writeFileSync(
    path.join(githooksDir, 'update-structure.js'),
    getTemplateById('update-structure'),
  );
  fs.writeFileSync(
    path.join(githooksDir, 'pre-push'),
    getTemplateById('pre-push'),
  );

  // Pipeline workflow files (existence-only)
  const workflowsDir = path.join(tmpDir, FRAME_WORKFLOWS_DIR);
  fs.mkdirSync(workflowsDir, { recursive: true });
  fs.writeFileSync(path.join(workflowsDir, 'review.yml'), 'name: review\non:\n  manual: true\njobs:\n  q:\n    steps:\n      - name: Lint\n        uses: lint\n');
  fs.writeFileSync(path.join(workflowsDir, 'task-verify.yml'), 'name: task-verify\non:\n  manual: true\njobs:\n  v:\n    steps:\n      - name: Test\n        uses: test\n');
  fs.writeFileSync(path.join(workflowsDir, 'health-check.yml'), 'name: health-check\non:\n  manual: true\njobs:\n  a:\n    steps:\n      - name: Lint\n        uses: lint\n');
}

// ── getComponentRegistry ─────────────────────────────────────────────────────

describe('getComponentRegistry', () => {
  it('returns an array of component entries', () => {
    const registry = getComponentRegistry();
    expect(Array.isArray(registry)).toBe(true);
    expect(registry.length).toBeGreaterThan(0);
  });

  it('each entry has required fields', () => {
    const registry = getComponentRegistry();
    for (const entry of registry) {
      expect(entry.id).toBeDefined();
      expect(entry.label).toBeDefined();
      expect(entry.category).toBeDefined();
      expect(entry.path).toBeDefined();
      expect(['core', 'hooks', 'claude-integration', 'git', 'skills', 'pipeline']).toContain(entry.category);
    }
  });

  it('includes entries from all 6 categories', () => {
    const registry = getComponentRegistry();
    const categories = new Set(registry.map((e) => e.category));
    expect(categories.has('core')).toBe(true);
    expect(categories.has('hooks')).toBe(true);
    expect(categories.has('claude-integration')).toBe(true);
    expect(categories.has('git')).toBe(true);
    expect(categories.has('skills')).toBe(true);
    expect(categories.has('pipeline')).toBe(true);
  });
});

// ── getHooksDir ──────────────────────────────────────────────────────────────

describe('getHooksDir', () => {
  it('returns the .subframe/hooks path', () => {
    const dir = getHooksDir();
    expect(dir).toContain('.subframe');
    expect(dir).toContain('hooks');
  });
});

// ── getSubFrameHealth — empty project ────────────────────────────────────────

describe('getSubFrameHealth — empty project', () => {
  it('reports all components as missing', () => {
    const health = getSubFrameHealth(tmpDir);
    expect(health.healthy).toBe(0);
    expect(health.missing).toBe(health.total);
    expect(health.needsUpdate).toBe(0);
    expect(health.claudeSettingsMerged).toBe(false);
    expect(health.gitHooksPath).toBeNull();
  });

  it('returns correct total matching registry size', () => {
    const health = getSubFrameHealth(tmpDir);
    const registry = getComponentRegistry();
    expect(health.total).toBe(registry.length);
  });

  it('each component is not exists and not current', () => {
    const health = getSubFrameHealth(tmpDir);
    for (const comp of health.components) {
      expect(comp.exists).toBe(false);
      expect(comp.current).toBe(false);
    }
  });
});

// ── getSubFrameHealth — full project ─────────────────────────────────────────

describe('getSubFrameHealth — full project', () => {
  beforeEach(() => {
    deployFullProject();
  });

  it('reports all components as healthy', () => {
    const health = getSubFrameHealth(tmpDir);
    expect(health.healthy).toBe(health.total);
    expect(health.missing).toBe(0);
    expect(health.needsUpdate).toBe(0);
  });

  it('detects Claude settings are merged', () => {
    const health = getSubFrameHealth(tmpDir);
    expect(health.claudeSettingsMerged).toBe(true);
  });

  it('detects git hooks path', () => {
    const health = getSubFrameHealth(tmpDir);
    expect(health.gitHooksPath).toBe(GITHOOKS_DIR);
  });

  it('all components report exists=true and current=true', () => {
    const health = getSubFrameHealth(tmpDir);
    for (const comp of health.components) {
      expect(comp.exists).toBe(true);
      expect(comp.current).toBe(true);
      expect(comp.needsUpdate).toBe(false);
    }
  });
});

// ── getSubFrameHealth — outdated components ──────────────────────────────────

describe('getSubFrameHealth — outdated components', () => {
  beforeEach(() => {
    deployFullProject();
  });

  it('detects outdated hook script', () => {
    // Modify a hook script to make it outdated
    fs.writeFileSync(
      path.join(tmpDir, FRAME_FILES.HOOKS_SESSION_START),
      '// modified content — not matching template',
    );

    const health = getSubFrameHealth(tmpDir);
    const sessionStart = health.components.find((c) => c.id === 'hook-session-start');
    expect(sessionStart).toBeDefined();
    expect(sessionStart!.exists).toBe(true);
    expect(sessionStart!.current).toBe(false);
    expect(sessionStart!.needsUpdate).toBe(true);
    expect(health.needsUpdate).toBeGreaterThan(0);
  });

  it('detects outdated git hook', () => {
    fs.writeFileSync(
      path.join(tmpDir, GITHOOKS_DIR, 'pre-commit'),
      '#!/bin/sh\n# old version\nexit 0',
    );

    const health = getSubFrameHealth(tmpDir);
    const preCommit = health.components.find((c) => c.id === 'pre-commit');
    expect(preCommit!.exists).toBe(true);
    expect(preCommit!.current).toBe(false);
    expect(preCommit!.needsUpdate).toBe(true);
  });

  it('does not flag existence-only components as outdated', () => {
    // Create tasks directory (user data) — should NOT be flagged as outdated
    fs.mkdirSync(path.join(tmpDir, FRAME_TASKS_DIR), { recursive: true });

    const health = getSubFrameHealth(tmpDir);
    const tasks = health.components.find((c) => c.id === 'tasks');
    expect(tasks!.exists).toBe(true);
    expect(tasks!.current).toBe(true);
    expect(tasks!.needsUpdate).toBe(false);
  });
});

// ── getSubFrameHealth — partial project ──────────────────────────────────────

describe('getSubFrameHealth — partial project', () => {
  it('reports mixed status when only core files are deployed', () => {
    // Only create .subframe dir + core files, no hooks/git
    const frameDirPath = path.join(tmpDir, FRAME_DIR);
    fs.mkdirSync(frameDirPath, { recursive: true });
    fs.writeFileSync(path.join(frameDirPath, 'config.json'), '{}');
    fs.writeFileSync(
      path.join(tmpDir, FRAME_FILES.AGENTS),
      `# Agents\n\n<!-- subframe-template-version: ${AGENTS_TEMPLATE_VERSION} -->\n`,
    );
    fs.writeFileSync(path.join(tmpDir, FRAME_FILES.STRUCTURE), '{}');
    fs.writeFileSync(path.join(tmpDir, FRAME_FILES.NOTES), '# Notes');
    fs.writeFileSync(path.join(tmpDir, FRAME_FILES.TASKS), '{}');
    fs.writeFileSync(path.join(tmpDir, FRAME_FILES.QUICKSTART), '# Quick');
    fs.mkdirSync(path.join(tmpDir, FRAME_FILES.DOCS_INTERNAL), { recursive: true });

    const health = getSubFrameHealth(tmpDir);
    expect(health.healthy).toBeGreaterThan(0);
    expect(health.missing).toBeGreaterThan(0);
    expect(health.healthy + health.missing + health.needsUpdate).toBe(health.total);
  });

  it('detects when Claude settings have no SubFrame hooks', () => {
    deployFullProject();
    // Remove SubFrame hooks from settings
    writeClaudeSettings(tmpDir, { someOtherSetting: true });

    const health = getSubFrameHealth(tmpDir);
    expect(health.claudeSettingsMerged).toBe(false);
    const claudeComp = health.components.find((c) => c.id === 'claude-settings');
    expect(claudeComp!.exists).toBe(false);
  });
});

// ── getSubFrameHealth — template version detection ───────────────────────────

describe('getSubFrameHealth — template version detection', () => {
  beforeEach(() => {
    // Create minimal project structure (only what's needed for AGENTS.md checks)
    const frameDirPath = path.join(tmpDir, FRAME_DIR);
    fs.mkdirSync(frameDirPath, { recursive: true });
    fs.writeFileSync(path.join(frameDirPath, 'config.json'), '{}');
  });

  it('detects old AGENTS.md without version marker as outdated', () => {
    fs.writeFileSync(path.join(tmpDir, FRAME_FILES.AGENTS), '# Old Agents file\nNo version marker here.');

    const health = getSubFrameHealth(tmpDir);
    const agents = health.components.find((c) => c.id === 'agents');
    expect(agents).toBeDefined();
    expect(agents!.exists).toBe(true);
    expect(agents!.current).toBe(false);
    expect(agents!.needsUpdate).toBe(true);
  });

  it('detects AGENTS.md with current version marker as healthy', () => {
    fs.writeFileSync(
      path.join(tmpDir, FRAME_FILES.AGENTS),
      `# Agents\n\n<!-- subframe-template-version: ${AGENTS_TEMPLATE_VERSION} -->\n`,
    );

    const health = getSubFrameHealth(tmpDir);
    const agents = health.components.find((c) => c.id === 'agents');
    expect(agents!.exists).toBe(true);
    expect(agents!.current).toBe(true);
    expect(agents!.needsUpdate).toBe(false);
  });

  it('detects AGENTS.md with old version (0) as outdated', () => {
    fs.writeFileSync(
      path.join(tmpDir, FRAME_FILES.AGENTS),
      '# Agents\n\n<!-- subframe-template-version: 0 -->\n',
    );

    const health = getSubFrameHealth(tmpDir);
    const agents = health.components.find((c) => c.id === 'agents');
    expect(agents!.exists).toBe(true);
    expect(agents!.current).toBe(false);
    expect(agents!.needsUpdate).toBe(true);
  });

  it('treats AGENTS.md with future version (999) as healthy (forward compatible)', () => {
    fs.writeFileSync(
      path.join(tmpDir, FRAME_FILES.AGENTS),
      '# Agents\n\n<!-- subframe-template-version: 999 -->\n',
    );

    const health = getSubFrameHealth(tmpDir);
    const agents = health.components.find((c) => c.id === 'agents');
    expect(agents!.exists).toBe(true);
    expect(agents!.current).toBe(true);
    expect(agents!.needsUpdate).toBe(false);
  });
});
