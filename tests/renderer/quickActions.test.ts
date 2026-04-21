/**
 * Tests for quickActions — default quick-action pill config and tool filtering.
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_QUICK_ACTIONS,
  getActionsForTool,
  normalizeToolKey,
  type QuickAction,
} from '../../src/renderer/lib/quickActions';

describe('DEFAULT_QUICK_ACTIONS', () => {
  it('ships exactly 7 default actions', () => {
    expect(DEFAULT_QUICK_ACTIONS).toHaveLength(7);
  });

  it('every action has non-empty id, label, text, icon, and tools', () => {
    for (const a of DEFAULT_QUICK_ACTIONS) {
      expect(typeof a.id).toBe('string');
      expect(a.id.length).toBeGreaterThan(0);
      expect(typeof a.label).toBe('string');
      expect(a.label.length).toBeGreaterThan(0);
      expect(typeof a.text).toBe('string');
      expect(a.text.length).toBeGreaterThan(0);
      expect(typeof a.icon).toBe('string');
      expect(a.icon.length).toBeGreaterThan(0);
      expect(Array.isArray(a.tools)).toBe(true);
      expect(a.tools.length).toBeGreaterThan(0);
    }
  });

  it('all action ids are unique', () => {
    const ids = DEFAULT_QUICK_ACTIONS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('tools are all valid QuickActionTool keys', () => {
    const valid = new Set(['claude', 'codex', 'gemini', 'shell', 'all']);
    for (const a of DEFAULT_QUICK_ACTIONS) {
      for (const t of a.tools) {
        expect(valid.has(t)).toBe(true);
      }
    }
  });
});

// ─── normalizeToolKey ──────────────────────────────────────────────────────

describe('normalizeToolKey', () => {
  it('returns "shell" for null/undefined/empty', () => {
    expect(normalizeToolKey(null)).toBe('shell');
    expect(normalizeToolKey(undefined)).toBe('shell');
    expect(normalizeToolKey('')).toBe('shell');
  });

  it('recognizes "claude" in common variations', () => {
    expect(normalizeToolKey('claude')).toBe('claude');
    expect(normalizeToolKey('Claude Code')).toBe('claude');
    expect(normalizeToolKey('CLAUDE')).toBe('claude');
  });

  it('recognizes "codex"', () => {
    expect(normalizeToolKey('codex')).toBe('codex');
    expect(normalizeToolKey('Codex CLI')).toBe('codex');
  });

  it('recognizes "gemini"', () => {
    expect(normalizeToolKey('gemini')).toBe('gemini');
    expect(normalizeToolKey('Gemini CLI')).toBe('gemini');
  });

  it('falls back to "shell" for unknown tool strings', () => {
    expect(normalizeToolKey('bash')).toBe('shell');
    expect(normalizeToolKey('xyz-tool')).toBe('shell');
  });
});

// ─── getActionsForTool ─────────────────────────────────────────────────────

describe('getActionsForTool', () => {
  it('returns claude-tagged + all-tagged actions for "claude"', () => {
    const actions = getActionsForTool('claude');
    expect(actions.length).toBeGreaterThan(0);
    for (const a of actions) {
      expect(a.tools.includes('claude') || a.tools.includes('all')).toBe(true);
    }
    // Includes the claude-specific /clear and /commit pills.
    const ids = actions.map((a) => a.id);
    expect(ids).toContain('clear');
    expect(ids).toContain('commit');
    expect(ids).toContain('continue');
  });

  it('returns shell-tagged + all-tagged actions for "shell"', () => {
    const actions = getActionsForTool('shell');
    for (const a of actions) {
      expect(a.tools.includes('shell') || a.tools.includes('all')).toBe(true);
    }
    // Shouldn't include claude-only pills like /clear
    const ids = actions.map((a) => a.id);
    expect(ids).not.toContain('clear');
    expect(ids).not.toContain('commit');
    // Should include run-tests and status (which are 'shell' + 'all')
    expect(ids).toContain('run-tests');
    expect(ids).toContain('status');
  });

  it('unknown tool strings are normalized to shell', () => {
    const unknown = getActionsForTool('unknown-bogus-tool');
    const shell = getActionsForTool('shell');
    expect(unknown.map((a) => a.id)).toEqual(shell.map((a) => a.id));
  });

  it('returns codex-compatible actions for "codex"', () => {
    const actions = getActionsForTool('codex');
    for (const a of actions) {
      expect(a.tools.includes('codex') || a.tools.includes('all')).toBe(true);
    }
    // Codex should see continue, explain, fix-it
    const ids = actions.map((a) => a.id);
    expect(ids).toContain('continue');
    expect(ids).toContain('explain');
    expect(ids).toContain('fix-it');
    // Codex should NOT see claude-only /clear
    expect(ids).not.toContain('clear');
  });

  it('returns gemini-compatible actions for "gemini"', () => {
    const actions = getActionsForTool('gemini');
    const ids = actions.map((a) => a.id);
    expect(ids).toContain('continue');
    expect(ids).toContain('explain');
    expect(ids).not.toContain('clear');
  });

  it('no action appears twice in a single filter result', () => {
    for (const tool of ['claude', 'codex', 'gemini', 'shell', 'unknown']) {
      const actions = getActionsForTool(tool);
      const ids = actions.map((a) => a.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('accepts user-facing tool display names', () => {
    // getActionsForTool calls normalizeToolKey internally, so display names work.
    const direct = getActionsForTool('claude');
    const display = getActionsForTool('Claude Code');
    expect(display.map((a) => a.id)).toEqual(direct.map((a) => a.id));
  });

  it('returned array references the same QuickAction objects as DEFAULT_QUICK_ACTIONS', () => {
    const actions = getActionsForTool('claude');
    for (const a of actions) {
      expect(DEFAULT_QUICK_ACTIONS).toContain(a as QuickAction);
    }
  });
});
