/**
 * Tests for backlinkUtils — backlink block generation, injection, update, removal
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  BACKLINK_START,
  BACKLINK_END,
  getBacklinkBlock,
  hasBacklink,
  injectBacklink,
  updateBacklink,
  removeBacklink,
  getNativeFileStatus,
  getBacklinkTarget,
} from '../../src/shared/backlinkUtils';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'subframe-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ── getBacklinkBlock ─────────────────────────────────────────────────────────

describe('getBacklinkBlock', () => {
  it('produces block with start and end markers', () => {
    const block = getBacklinkBlock();
    expect(block).toContain(BACKLINK_START);
    expect(block).toContain(BACKLINK_END);
  });

  it('includes default message referencing AGENTS.md', () => {
    const block = getBacklinkBlock();
    expect(block).toContain('AGENTS.md');
    expect(block).toContain('SubFrame Project');
  });

  it('uses custom message when provided', () => {
    const block = getBacklinkBlock({ customMessage: '> Custom backlink message' });
    expect(block).toContain('Custom backlink message');
    expect(block).not.toContain('SubFrame Project');
  });

  it('includes additional refs', () => {
    const block = getBacklinkBlock({ additionalRefs: ['> See also: SPEC.md'] });
    expect(block).toContain('See also: SPEC.md');
  });

  it('skips empty additional refs', () => {
    const block = getBacklinkBlock({ additionalRefs: ['', '  '] });
    // Empty refs should not add extra lines beyond the base block
    const baseBlock = getBacklinkBlock();
    expect(block).toBe(baseBlock);
  });
});

// ── hasBacklink ──────────────────────────────────────────────────────────────

describe('hasBacklink', () => {
  it('returns false for non-existent file', () => {
    expect(hasBacklink(path.join(tmpDir, 'nope.md'))).toBe(false);
  });

  it('returns false for file without backlink', () => {
    const f = path.join(tmpDir, 'plain.md');
    fs.writeFileSync(f, '# Plain file\nNo backlink here.\n');
    expect(hasBacklink(f)).toBe(false);
  });

  it('returns true for file with backlink', () => {
    const f = path.join(tmpDir, 'linked.md');
    fs.writeFileSync(f, getBacklinkBlock() + '\n\n# Content\n');
    expect(hasBacklink(f)).toBe(true);
  });
});

// ── injectBacklink ───────────────────────────────────────────────────────────

describe('injectBacklink', () => {
  it('creates file with backlink if file does not exist', () => {
    const f = path.join(tmpDir, 'new.md');
    expect(injectBacklink(f)).toBe(true);
    expect(fs.existsSync(f)).toBe(true);
    expect(hasBacklink(f)).toBe(true);
  });

  it('prepends backlink to existing file without one', () => {
    const f = path.join(tmpDir, 'existing.md');
    fs.writeFileSync(f, '# My Content\n');
    expect(injectBacklink(f)).toBe(true);

    const content = fs.readFileSync(f, 'utf8');
    expect(content).toContain(BACKLINK_START);
    expect(content).toContain('# My Content');
    // Backlink should come before the content
    expect(content.indexOf(BACKLINK_START)).toBeLessThan(content.indexOf('# My Content'));
  });

  it('is idempotent — does not duplicate if already present', () => {
    const f = path.join(tmpDir, 'double.md');
    injectBacklink(f);
    const first = fs.readFileSync(f, 'utf8');
    injectBacklink(f);
    const second = fs.readFileSync(f, 'utf8');
    expect(first).toBe(second);
  });
});

// ── updateBacklink ───────────────────────────────────────────────────────────

describe('updateBacklink', () => {
  it('replaces existing backlink block in-place', () => {
    const f = path.join(tmpDir, 'update.md');
    injectBacklink(f);
    // Now update with custom message
    updateBacklink(f, { customMessage: '> Updated message' });
    const content = fs.readFileSync(f, 'utf8');
    expect(content).toContain('Updated message');
    expect(content).not.toContain('SubFrame Project');
  });

  it('injects if file has no backlink', () => {
    const f = path.join(tmpDir, 'noblock.md');
    fs.writeFileSync(f, '# Plain\n');
    updateBacklink(f);
    expect(hasBacklink(f)).toBe(true);
  });

  it('creates file if it does not exist', () => {
    const f = path.join(tmpDir, 'fresh.md');
    updateBacklink(f);
    expect(fs.existsSync(f)).toBe(true);
    expect(hasBacklink(f)).toBe(true);
  });
});

// ── removeBacklink ───────────────────────────────────────────────────────────

describe('removeBacklink', () => {
  it('removes backlink block and preserves content after it', () => {
    const f = path.join(tmpDir, 'remove.md');
    fs.writeFileSync(f, getBacklinkBlock() + '\n\n# Keep This\nImportant stuff.\n');
    expect(removeBacklink(f)).toBe(true);

    const content = fs.readFileSync(f, 'utf8');
    expect(content).not.toContain(BACKLINK_START);
    expect(content).toContain('# Keep This');
  });

  it('is safe on file without backlink', () => {
    const f = path.join(tmpDir, 'no-backlink.md');
    fs.writeFileSync(f, '# Nothing here\n');
    expect(removeBacklink(f)).toBe(true);
    expect(fs.readFileSync(f, 'utf8')).toContain('# Nothing here');
  });

  it('is safe on non-existent file', () => {
    expect(removeBacklink(path.join(tmpDir, 'ghost.md'))).toBe(true);
  });

  it('removes backlink mid-file and preserves content before and after', () => {
    const f = path.join(tmpDir, 'mid-block.md');
    const before = '# Header\nSome intro text.\n\n';
    const after = '\n\n# More Content\nImportant stuff.\n';
    fs.writeFileSync(f, before + getBacklinkBlock() + after);
    expect(removeBacklink(f)).toBe(true);

    const content = fs.readFileSync(f, 'utf8');
    expect(content).not.toContain(BACKLINK_START);
    expect(content).toContain('# Header');
    expect(content).toContain('# More Content');
  });
});

// ── getNativeFileStatus ──────────────────────────────────────────────────────

describe('getNativeFileStatus', () => {
  it('reports non-existent file', () => {
    const status = getNativeFileStatus(tmpDir, 'CLAUDE.md');
    expect(status.exists).toBe(false);
    expect(status.hasBacklink).toBe(false);
    expect(status.hasUserContent).toBe(false);
  });

  it('detects file with backlink and no user content', () => {
    fs.writeFileSync(path.join(tmpDir, 'CLAUDE.md'), getBacklinkBlock() + '\n');
    const status = getNativeFileStatus(tmpDir, 'CLAUDE.md');
    expect(status.exists).toBe(true);
    expect(status.hasBacklink).toBe(true);
    expect(status.hasUserContent).toBe(false);
  });

  it('detects file with backlink AND user content', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'CLAUDE.md'),
      getBacklinkBlock() + '\n\n# My custom rules\n',
    );
    const status = getNativeFileStatus(tmpDir, 'CLAUDE.md');
    expect(status.exists).toBe(true);
    expect(status.hasBacklink).toBe(true);
    expect(status.hasUserContent).toBe(true);
  });

  it('detects file without backlink as having user content', () => {
    fs.writeFileSync(path.join(tmpDir, 'CLAUDE.md'), '# Custom only\n');
    const status = getNativeFileStatus(tmpDir, 'CLAUDE.md');
    expect(status.exists).toBe(true);
    expect(status.hasBacklink).toBe(false);
    expect(status.hasUserContent).toBe(true);
  });
});

// ── getBacklinkTarget ────────────────────────────────────────────────────────

describe('getBacklinkTarget', () => {
  it('extracts AGENTS.md from default backlink block', () => {
    const f = path.join(tmpDir, 'target.md');
    fs.writeFileSync(f, getBacklinkBlock() + '\n');
    expect(getBacklinkTarget(f)).toBe('AGENTS.md');
  });

  it('returns null for file without backlink', () => {
    const f = path.join(tmpDir, 'no-target.md');
    fs.writeFileSync(f, '# Plain\n');
    expect(getBacklinkTarget(f)).toBeNull();
  });

  it('returns null for non-existent file', () => {
    expect(getBacklinkTarget(path.join(tmpDir, 'ghost.md'))).toBeNull();
  });
});
