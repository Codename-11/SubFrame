/**
 * Tests for frameConstants — verifies constants and paths are correct
 */

import { describe, it, expect } from 'vitest';
import {
  FRAME_DIR,
  FRAME_CONFIG_FILE,
  WORKSPACE_DIR,
  WORKSPACE_FILE,
  FRAME_FILES,
  FRAME_BIN_DIR,
  GITHOOKS_DIR,
  FRAME_VERSION,
} from '../../src/shared/frameConstants';

describe('frameConstants', () => {
  it('FRAME_DIR is .subframe', () => {
    expect(FRAME_DIR).toBe('.subframe');
  });

  it('FRAME_CONFIG_FILE is config.json', () => {
    expect(FRAME_CONFIG_FILE).toBe('config.json');
  });

  it('WORKSPACE_DIR matches FRAME_DIR', () => {
    expect(WORKSPACE_DIR).toBe('.subframe');
  });

  it('WORKSPACE_FILE is workspaces.json', () => {
    expect(WORKSPACE_FILE).toBe('workspaces.json');
  });

  it('FRAME_FILES contains expected keys', () => {
    expect(FRAME_FILES).toHaveProperty('AGENTS');
    expect(FRAME_FILES).toHaveProperty('CLAUDE');
    expect(FRAME_FILES).toHaveProperty('GEMINI');
    expect(FRAME_FILES).toHaveProperty('STRUCTURE');
    expect(FRAME_FILES).toHaveProperty('NOTES');
    expect(FRAME_FILES).toHaveProperty('TASKS');
    expect(FRAME_FILES).toHaveProperty('QUICKSTART');
  });

  it('FRAME_FILES root AI files point to expected filenames', () => {
    expect(FRAME_FILES.AGENTS).toBe('AGENTS.md');
    expect(FRAME_FILES.CLAUDE).toBe('CLAUDE.md');
    expect(FRAME_FILES.GEMINI).toBe('GEMINI.md');
  });

  it('FRAME_FILES project files have expected names', () => {
    expect(FRAME_FILES.STRUCTURE).toContain('STRUCTURE.json');
    expect(FRAME_FILES.NOTES).toContain('PROJECT_NOTES.md');
    expect(FRAME_FILES.TASKS).toContain('tasks.json');
    expect(FRAME_FILES.QUICKSTART).toContain('QUICKSTART.md');
  });

  it('FRAME_BIN_DIR is bin', () => {
    expect(FRAME_BIN_DIR).toBe('bin');
  });

  it('GITHOOKS_DIR is .githooks', () => {
    expect(GITHOOKS_DIR).toBe('.githooks');
  });

  it('FRAME_VERSION is a valid semver string', () => {
    expect(FRAME_VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('FRAME_VERSION matches package.json', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pkg = require('../../package.json');
    expect(FRAME_VERSION).toBe(pkg.version);
  });
});
