/**
 * Tests for frameProject — updateSubFrameComponents extracted logic
 *
 * Covers the three bug fixes (executable bit, legacy backup, generic templateVersion)
 * and additional scenarios (opt-out, claude-settings merge, missing component, new file creation).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock electron — not available in CI (npm ci --ignore-scripts skips binary download)
vi.mock('electron', () => ({
  dialog: { showMessageBox: vi.fn() },
  ipcMain: { handle: vi.fn(), on: vi.fn() },
}));

import { updateSubFrameComponents } from '../../src/main/frameProject';
import { getComponentRegistry } from '../../src/shared/subframeHealth';
import { writeClaudeSettings, readClaudeSettings } from '../../src/shared/claudeSettingsUtils';
import { FRAME_DIR, GITHOOKS_DIR } from '../../src/shared/frameConstants';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'subframe-update-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

/**
 * Helper: get the registry entry by ID.
 */
function getEntry(id: string) {
  return getComponentRegistry().find((e) => e.id === id);
}

/**
 * Helper: create a minimal .subframe/config.json so the agents template
 * can resolve the project name.
 */
function writeConfig(name?: string): void {
  const configDir = path.join(tmpDir, FRAME_DIR);
  fs.mkdirSync(configDir, { recursive: true });
  const config = name ? { name } : {};
  fs.writeFileSync(path.join(configDir, 'config.json'), JSON.stringify(config), 'utf8');
}

// ── Bug 1: Executable bit preservation ────────────────────────────────────────

describe('executable bit preservation', () => {
  it('sets executable mode on pre-commit hook (new file)', () => {
    const entry = getEntry('pre-commit');
    expect(entry).toBeDefined();
    expect(entry!.executable).toBe(true);

    // Ensure parent dir exists
    fs.mkdirSync(path.join(tmpDir, GITHOOKS_DIR), { recursive: true });

    const result = updateSubFrameComponents(tmpDir, ['pre-commit']);
    expect(result.updated).toContain('pre-commit');

    const fullPath = path.join(tmpDir, entry!.path);
    expect(fs.existsSync(fullPath)).toBe(true);

    // On Unix: verify executable bit. On Windows: just verify file was written.
    if (process.platform !== 'win32') {
      const mode = fs.statSync(fullPath).mode;
      expect(mode & 0o111).not.toBe(0);
    }
  });

  it('sets executable mode on pre-push hook', () => {
    fs.mkdirSync(path.join(tmpDir, GITHOOKS_DIR), { recursive: true });

    const result = updateSubFrameComponents(tmpDir, ['pre-push']);
    expect(result.updated).toContain('pre-push');

    const entry = getEntry('pre-push')!;
    const fullPath = path.join(tmpDir, entry.path);
    expect(fs.existsSync(fullPath)).toBe(true);

    if (process.platform !== 'win32') {
      const mode = fs.statSync(fullPath).mode;
      expect(mode & 0o111).not.toBe(0);
    }
  });

  it('sets executable mode on codex-wrapper', () => {
    const entry = getEntry('codex-wrapper')!;
    expect(entry.executable).toBe(true);

    const result = updateSubFrameComponents(tmpDir, ['codex-wrapper']);
    expect(result.updated).toContain('codex-wrapper');

    const fullPath = path.join(tmpDir, entry.path);
    expect(fs.existsSync(fullPath)).toBe(true);

    if (process.platform !== 'win32') {
      const mode = fs.statSync(fullPath).mode;
      expect(mode & 0o111).not.toBe(0);
    }
  });

  it('does NOT set executable mode on non-executable components', () => {
    const entry = getEntry('hook-session-start')!;
    expect(entry.executable).toBeFalsy();

    const hooksDir = path.join(tmpDir, '.subframe', 'hooks');
    fs.mkdirSync(hooksDir, { recursive: true });

    const result = updateSubFrameComponents(tmpDir, ['hook-session-start']);
    expect(result.updated).toContain('hook-session-start');
  });
});

// ── Bug 2: Legacy file backup ─────────────────────────────────────────────────

describe('legacy file backup', () => {
  it('backs up existing file when updating a getTemplate component', () => {
    // Deploy an old version of hook-session-start
    const entry = getEntry('hook-session-start')!;
    const fullPath = path.join(tmpDir, entry.path);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    const oldContent = '// old session-start hook v0';
    fs.writeFileSync(fullPath, oldContent, 'utf8');

    const result = updateSubFrameComponents(tmpDir, ['hook-session-start']);
    expect(result.updated).toContain('hook-session-start');

    // .bak should contain the old content
    const bakPath = fullPath + '.bak';
    expect(fs.existsSync(bakPath)).toBe(true);
    expect(fs.readFileSync(bakPath, 'utf8')).toBe(oldContent);

    // The file itself should have the new template content
    const newContent = fs.readFileSync(fullPath, 'utf8');
    expect(newContent).not.toBe(oldContent);
    expect(newContent.length).toBeGreaterThan(0);
  });

  it('backs up legacy AGENTS.md (templateVersion component)', () => {
    writeConfig('TestProject');

    const entry = getEntry('agents')!;
    const fullPath = path.join(tmpDir, entry.path);
    const oldContent = '# My old agents file\nNo version marker.';
    fs.writeFileSync(fullPath, oldContent, 'utf8');

    const result = updateSubFrameComponents(tmpDir, ['agents']);
    expect(result.updated).toContain('agents');

    const bakPath = fullPath + '.bak';
    expect(fs.existsSync(bakPath)).toBe(true);
    expect(fs.readFileSync(bakPath, 'utf8')).toBe(oldContent);
  });

  it('does NOT create .bak when file does not exist yet', () => {
    const entry = getEntry('hook-stop')!;
    const fullPath = path.join(tmpDir, entry.path);
    // Don't pre-create the file

    const result = updateSubFrameComponents(tmpDir, ['hook-stop']);
    expect(result.updated).toContain('hook-stop');

    expect(fs.existsSync(fullPath)).toBe(true);
    expect(fs.existsSync(fullPath + '.bak')).toBe(false);
  });
});

// ── Bug 3: Generic templateVersion dispatch ───────────────────────────────────

describe('generic templateVersion dispatch', () => {
  it('updates agents component using templateVersion path', () => {
    writeConfig('TestProject');

    const result = updateSubFrameComponents(tmpDir, ['agents']);
    expect(result.updated).toContain('agents');
    expect(result.failed).not.toContain('agents');

    const entry = getEntry('agents')!;
    const fullPath = path.join(tmpDir, entry.path);
    const content = fs.readFileSync(fullPath, 'utf8');
    // Should contain the template version marker
    expect(content).toContain('subframe-template-version:');
    // Should contain the project name
    expect(content).toContain('TestProject');
  });

  it('uses project name from config.json when available', () => {
    writeConfig('MyCustomProject');

    updateSubFrameComponents(tmpDir, ['agents']);

    const entry = getEntry('agents')!;
    const content = fs.readFileSync(path.join(tmpDir, entry.path), 'utf8');
    expect(content).toContain('MyCustomProject');
  });

  it('falls back to directory name when config.json is missing', () => {
    // No config.json
    const result = updateSubFrameComponents(tmpDir, ['agents']);
    expect(result.updated).toContain('agents');

    const entry = getEntry('agents')!;
    const content = fs.readFileSync(path.join(tmpDir, entry.path), 'utf8');
    // Should use the tmp dir basename as the project name
    expect(content).toContain(path.basename(tmpDir));
  });
});

// ── User opt-out ──────────────────────────────────────────────────────────────

describe('user opt-out', () => {
  it('skips file with @subframe-managed: false marker', () => {
    const entry = getEntry('hook-session-start')!;
    const fullPath = path.join(tmpDir, entry.path);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    const customContent = '// @subframe-managed: false\n// My custom hook\nconsole.log("custom");';
    fs.writeFileSync(fullPath, customContent, 'utf8');

    const result = updateSubFrameComponents(tmpDir, ['hook-session-start']);
    expect(result.skipped).toContain('hook-session-start');
    expect(result.updated).not.toContain('hook-session-start');

    // File should be unchanged
    expect(fs.readFileSync(fullPath, 'utf8')).toBe(customContent);
  });

  it('does NOT skip files without the opt-out marker', () => {
    const entry = getEntry('hook-session-start')!;
    const fullPath = path.join(tmpDir, entry.path);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, '// old hook without opt-out', 'utf8');

    const result = updateSubFrameComponents(tmpDir, ['hook-session-start']);
    expect(result.updated).toContain('hook-session-start');
    expect(result.skipped).not.toContain('hook-session-start');
  });

  it('skips templateVersion file with opt-out marker', () => {
    writeConfig('TestProject');

    const entry = getEntry('agents')!;
    const fullPath = path.join(tmpDir, entry.path);
    const customContent = '<!-- @subframe-managed: false -->\n# My custom AGENTS.md';
    fs.writeFileSync(fullPath, customContent, 'utf8');

    const result = updateSubFrameComponents(tmpDir, ['agents']);
    expect(result.skipped).toContain('agents');
    expect(fs.readFileSync(fullPath, 'utf8')).toBe(customContent);
  });
});

// ── Claude settings merge ─────────────────────────────────────────────────────

describe('claude-settings merge', () => {
  it('preserves non-SubFrame hooks when updating claude-settings', () => {
    // Write settings with a user's custom hook
    const userSettings = {
      hooks: {
        SessionStart: [
          {
            matcher: '',
            hooks: [{ type: 'command', command: 'echo "my custom hook"' }],
          },
        ],
      },
    };
    writeClaudeSettings(tmpDir, userSettings);

    const result = updateSubFrameComponents(tmpDir, ['claude-settings']);
    expect(result.updated).toContain('claude-settings');

    // Read back and verify the user's hook is preserved
    const settings = readClaudeSettings(tmpDir);
    expect(settings.hooks).toBeDefined();
    const sessionMatchers = settings.hooks!['SessionStart'];
    expect(sessionMatchers).toBeDefined();

    // Should have at least 2 matcher groups: user's + SubFrame's
    const allCommands = sessionMatchers.flatMap((m: { hooks: Array<{ command: string }> }) =>
      m.hooks.map((h: { command: string }) => h.command)
    );
    expect(allCommands).toContain('echo "my custom hook"');
    // Should also have SubFrame hooks
    const hasSubFrame = allCommands.some((cmd: string) => cmd.includes('.subframe/hooks/'));
    expect(hasSubFrame).toBe(true);
  });

  it('creates .claude/settings.json if it does not exist', () => {
    const settingsPath = path.join(tmpDir, '.claude', 'settings.json');
    expect(fs.existsSync(settingsPath)).toBe(false);

    const result = updateSubFrameComponents(tmpDir, ['claude-settings']);
    expect(result.updated).toContain('claude-settings');
    expect(fs.existsSync(settingsPath)).toBe(true);
  });
});

// ── Missing component ─────────────────────────────────────────────────────────

describe('missing component ID', () => {
  it('reports non-existent component ID as failed', () => {
    const result = updateSubFrameComponents(tmpDir, ['totally-fake-component']);
    expect(result.failed).toContain('totally-fake-component');
    expect(result.updated).toHaveLength(0);
  });

  it('reports existence-only components as failed (cannot update user data)', () => {
    const entry = getEntry('config')!;
    expect(entry.existenceOnly).toBe(true);

    // Create the file so it exists
    fs.mkdirSync(path.join(tmpDir, FRAME_DIR), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, entry.path), '{}', 'utf8');

    const result = updateSubFrameComponents(tmpDir, ['config']);
    expect(result.failed).toContain('config');
  });
});

// ── New file creation ─────────────────────────────────────────────────────────

describe('new file creation', () => {
  it('creates file and parent directories when they do not exist', () => {
    // hook-session-start lives in .subframe/hooks/ — don't pre-create dirs
    const entry = getEntry('hook-session-start')!;
    const fullPath = path.join(tmpDir, entry.path);

    expect(fs.existsSync(fullPath)).toBe(false);
    expect(fs.existsSync(path.dirname(fullPath))).toBe(false);

    const result = updateSubFrameComponents(tmpDir, ['hook-session-start']);
    expect(result.updated).toContain('hook-session-start');
    expect(fs.existsSync(fullPath)).toBe(true);
  });

  it('creates agents file when it does not exist', () => {
    writeConfig('NewProject');

    const entry = getEntry('agents')!;
    const fullPath = path.join(tmpDir, entry.path);
    expect(fs.existsSync(fullPath)).toBe(false);

    const result = updateSubFrameComponents(tmpDir, ['agents']);
    expect(result.updated).toContain('agents');
    expect(fs.existsSync(fullPath)).toBe(true);
  });
});

// ── Version stamp in output ───────────────────────────────────────────────────

describe('version stamp in output', () => {
  it('agents file contains subframe-template-version after update', () => {
    writeConfig('VersionTest');

    updateSubFrameComponents(tmpDir, ['agents']);

    const entry = getEntry('agents')!;
    const content = fs.readFileSync(path.join(tmpDir, entry.path), 'utf8');
    expect(content).toMatch(/<!-- subframe-template-version:\s*\d+\s*-->/);
  });
});

// ── Multiple components in one call ───────────────────────────────────────────

describe('multiple components', () => {
  it('handles a mix of valid, invalid, and skipped components', () => {
    writeConfig('MultiTest');

    // Set up opt-out for one component
    const hookEntry = getEntry('hook-session-start')!;
    const hookPath = path.join(tmpDir, hookEntry.path);
    fs.mkdirSync(path.dirname(hookPath), { recursive: true });
    fs.writeFileSync(hookPath, '// @subframe-managed: false\n// custom', 'utf8');

    const result = updateSubFrameComponents(tmpDir, [
      'agents',              // should update (templateVersion)
      'hook-session-start',  // should skip (opt-out)
      'fake-id',             // should fail (not in registry)
      'config',              // should fail (existence-only)
    ]);

    expect(result.updated).toContain('agents');
    expect(result.skipped).toContain('hook-session-start');
    expect(result.failed).toContain('fake-id');
    expect(result.failed).toContain('config');
  });
});
