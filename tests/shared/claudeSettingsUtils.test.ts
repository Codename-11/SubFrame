/**
 * Tests for claudeSettingsUtils — read/write/merge/remove Claude settings hooks
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  readClaudeSettings,
  writeClaudeSettings,
  hasSubFrameHooks,
  mergeSubFrameHooks,
  removeSubFrameHooks,
} from '../../src/shared/claudeSettingsUtils';
import type { ClaudeSettings, ClaudeHooksConfig } from '../../src/shared/claudeSettingsUtils';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'subframe-claude-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// Helper: a SubFrame hooks config matching production format (git-root-relative paths)
function makeSubFrameHooks(): { hooks: ClaudeHooksConfig } {
  return {
    hooks: {
      SessionStart: [
        {
          matcher: '',
          hooks: [
            { type: 'command', command: 'node "$(git rev-parse --show-toplevel)/.subframe/hooks/session-start.js"' },
          ],
        },
      ],
      UserPromptSubmit: [
        {
          matcher: '',
          hooks: [
            { type: 'command', command: 'node "$(git rev-parse --show-toplevel)/.subframe/hooks/prompt-submit.js"' },
          ],
        },
      ],
      Stop: [
        {
          matcher: '',
          hooks: [
            { type: 'command', command: 'node "$(git rev-parse --show-toplevel)/.subframe/hooks/stop.js"' },
          ],
        },
      ],
    },
  };
}

// Helper: a user-defined hook (not SubFrame)
function makeUserHooks(): ClaudeHooksConfig {
  return {
    SessionStart: [
      {
        matcher: '',
        hooks: [
          { type: 'command', command: 'echo "hello from user hook"' },
        ],
      },
    ],
  };
}

// ── readClaudeSettings ───────────────────────────────────────────────────────

describe('readClaudeSettings', () => {
  it('returns empty object when .claude/settings.json does not exist', () => {
    expect(readClaudeSettings(tmpDir)).toEqual({});
  });

  it('returns empty object when .claude/ directory does not exist', () => {
    expect(readClaudeSettings(path.join(tmpDir, 'nonexistent'))).toEqual({});
  });

  it('reads valid settings.json', () => {
    const claudeDir = path.join(tmpDir, '.claude');
    fs.mkdirSync(claudeDir);
    fs.writeFileSync(
      path.join(claudeDir, 'settings.json'),
      JSON.stringify({ foo: 'bar', hooks: {} }),
    );
    const settings = readClaudeSettings(tmpDir);
    expect(settings.foo).toBe('bar');
    expect(settings.hooks).toEqual({});
  });

  it('returns empty object for malformed JSON', () => {
    const claudeDir = path.join(tmpDir, '.claude');
    fs.mkdirSync(claudeDir);
    fs.writeFileSync(path.join(claudeDir, 'settings.json'), 'not json{{{');
    expect(readClaudeSettings(tmpDir)).toEqual({});
  });
});

// ── writeClaudeSettings ──────────────────────────────────────────────────────

describe('writeClaudeSettings', () => {
  it('creates .claude/ directory and writes settings.json', () => {
    writeClaudeSettings(tmpDir, { key: 'value' });
    const written = JSON.parse(
      fs.readFileSync(path.join(tmpDir, '.claude', 'settings.json'), 'utf8'),
    );
    expect(written.key).toBe('value');
  });

  it('overwrites existing settings.json', () => {
    writeClaudeSettings(tmpDir, { first: true });
    writeClaudeSettings(tmpDir, { second: true });
    const written = JSON.parse(
      fs.readFileSync(path.join(tmpDir, '.claude', 'settings.json'), 'utf8'),
    );
    expect(written.second).toBe(true);
    expect(written.first).toBeUndefined();
  });

  it('preserves existing .claude/ directory contents', () => {
    const claudeDir = path.join(tmpDir, '.claude');
    fs.mkdirSync(claudeDir);
    fs.writeFileSync(path.join(claudeDir, 'other-file.txt'), 'keep me');
    writeClaudeSettings(tmpDir, { hooks: {} });
    expect(fs.readFileSync(path.join(claudeDir, 'other-file.txt'), 'utf8')).toBe('keep me');
  });
});

// ── hasSubFrameHooks ─────────────────────────────────────────────────────────

describe('hasSubFrameHooks', () => {
  it('returns false for empty settings', () => {
    expect(hasSubFrameHooks({})).toBe(false);
  });

  it('returns false for settings with no hooks', () => {
    expect(hasSubFrameHooks({ someOther: 'config' })).toBe(false);
  });

  it('returns false for settings with only user hooks', () => {
    const settings: ClaudeSettings = { hooks: makeUserHooks() };
    expect(hasSubFrameHooks(settings)).toBe(false);
  });

  it('returns true when SubFrame hooks are present', () => {
    const sfHooks = makeSubFrameHooks();
    const settings: ClaudeSettings = { hooks: sfHooks.hooks };
    expect(hasSubFrameHooks(settings)).toBe(true);
  });

  it('returns true when SubFrame hooks are mixed with user hooks', () => {
    const sfHooks = makeSubFrameHooks();
    const settings: ClaudeSettings = {
      hooks: {
        ...makeUserHooks(),
        Stop: sfHooks.hooks.Stop,
      },
    };
    expect(hasSubFrameHooks(settings)).toBe(true);
  });
});

// ── mergeSubFrameHooks ───────────────────────────────────────────────────────

describe('mergeSubFrameHooks', () => {
  it('adds SubFrame hooks to empty settings', () => {
    const result = mergeSubFrameHooks({}, makeSubFrameHooks());
    expect(result.hooks).toBeDefined();
    expect(result.hooks!.SessionStart).toHaveLength(1);
    expect(result.hooks!.UserPromptSubmit).toHaveLength(1);
    expect(result.hooks!.Stop).toHaveLength(1);
    expect(hasSubFrameHooks(result)).toBe(true);
  });

  it('preserves existing user hooks when merging', () => {
    const existing: ClaudeSettings = { hooks: makeUserHooks() };
    const result = mergeSubFrameHooks(existing, makeSubFrameHooks());

    // User hook should still be there
    const sessionStartMatchers = result.hooks!.SessionStart;
    expect(sessionStartMatchers.length).toBe(2); // user + subframe
    const userMatcher = sessionStartMatchers.find(
      (m) => m.hooks.some((h) => h.command.includes('echo')),
    );
    expect(userMatcher).toBeDefined();
  });

  it('preserves non-hook settings', () => {
    const existing: ClaudeSettings = { customKey: 'preserved', anotherKey: 42 };
    const result = mergeSubFrameHooks(existing, makeSubFrameHooks());
    expect(result.customKey).toBe('preserved');
    expect(result.anotherKey).toBe(42);
  });

  it('replaces existing SubFrame hooks (idempotent)', () => {
    // First merge
    const first = mergeSubFrameHooks({}, makeSubFrameHooks());
    // Second merge (should replace, not duplicate)
    const second = mergeSubFrameHooks(first, makeSubFrameHooks());

    expect(second.hooks!.SessionStart).toHaveLength(1);
    expect(second.hooks!.Stop).toHaveLength(1);
  });

  it('replaces SubFrame hooks without affecting user hooks', () => {
    const existing: ClaudeSettings = { hooks: makeUserHooks() };
    const first = mergeSubFrameHooks(existing, makeSubFrameHooks());
    const second = mergeSubFrameHooks(first, makeSubFrameHooks());

    // 2 matchers in SessionStart: user + subframe
    expect(second.hooks!.SessionStart).toHaveLength(2);
    // User hook still present
    const userMatcher = second.hooks!.SessionStart.find(
      (m) => m.hooks.some((h) => h.command.includes('echo')),
    );
    expect(userMatcher).toBeDefined();
  });
});

// ── removeSubFrameHooks ──────────────────────────────────────────────────────

describe('removeSubFrameHooks', () => {
  it('returns settings unchanged when no hooks present', () => {
    const settings: ClaudeSettings = { key: 'value' };
    const result = removeSubFrameHooks(settings);
    expect(result).toEqual({ key: 'value' });
  });

  it('removes all SubFrame hooks from settings', () => {
    const settings = mergeSubFrameHooks({}, makeSubFrameHooks());
    expect(hasSubFrameHooks(settings)).toBe(true);

    const result = removeSubFrameHooks(settings);
    expect(hasSubFrameHooks(result)).toBe(false);
  });

  it('removes hooks key entirely when no hooks remain', () => {
    const settings = mergeSubFrameHooks({}, makeSubFrameHooks());
    const result = removeSubFrameHooks(settings);
    expect(result.hooks).toBeUndefined();
  });

  it('preserves user hooks when removing SubFrame hooks', () => {
    const existing: ClaudeSettings = { hooks: makeUserHooks() };
    const merged = mergeSubFrameHooks(existing, makeSubFrameHooks());
    const result = removeSubFrameHooks(merged);

    expect(hasSubFrameHooks(result)).toBe(false);
    expect(result.hooks).toBeDefined();
    expect(result.hooks!.SessionStart).toHaveLength(1);
    expect(result.hooks!.SessionStart[0].hooks[0].command).toContain('echo');
  });

  it('preserves non-hook settings', () => {
    const existing: ClaudeSettings = { customKey: 'preserved' };
    const merged = mergeSubFrameHooks(existing, makeSubFrameHooks());
    const result = removeSubFrameHooks(merged);
    expect(result.customKey).toBe('preserved');
  });
});

// ── Round-trip: write → read → merge → remove ───────────────────────────────

describe('round-trip integration', () => {
  it('write → read → merge → read → verify', () => {
    // Write initial settings
    writeClaudeSettings(tmpDir, { existingKey: true });

    // Read them back
    const existing = readClaudeSettings(tmpDir);
    expect(existing.existingKey).toBe(true);

    // Merge SubFrame hooks
    const merged = mergeSubFrameHooks(existing, makeSubFrameHooks());
    writeClaudeSettings(tmpDir, merged);

    // Read and verify
    const afterMerge = readClaudeSettings(tmpDir);
    expect(hasSubFrameHooks(afterMerge)).toBe(true);
    expect(afterMerge.existingKey).toBe(true);

    // Remove SubFrame hooks
    const cleaned = removeSubFrameHooks(afterMerge);
    writeClaudeSettings(tmpDir, cleaned);

    // Final read
    const afterRemove = readClaudeSettings(tmpDir);
    expect(hasSubFrameHooks(afterRemove)).toBe(false);
    expect(afterRemove.existingKey).toBe(true);
  });
});
