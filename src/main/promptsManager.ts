/**
 * Prompts Manager Module
 * Handles CRUD operations for saved prompts (prompt library).
 * Supports both project-level (.subframe/prompts.json) and
 * global/user-level (~/.subframe/prompts.json) prompts.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { IpcMain } from 'electron';
import { IPC } from '../shared/ipcChannels';
import type { SavedPrompt, PromptsResult } from '../shared/ipcChannels';

const PROMPTS_FILE = path.join('.subframe', 'prompts.json');

/** Resolve the global prompts file path (~/.subframe/prompts.json) */
function getGlobalPromptsPath(): string {
  return path.join(os.homedir(), '.subframe', 'prompts.json');
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

/**
 * Read prompts from a JSON file at the given path.
 */
function readPromptsFile(filePath: string): PromptsResult {
  if (!fs.existsSync(filePath)) {
    return { error: null, prompts: [] };
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);
    const prompts: SavedPrompt[] = Array.isArray(data.prompts) ? data.prompts : [];
    return { error: null, prompts };
  } catch (err) {
    return { error: (err as Error).message, prompts: [] };
  }
}

/**
 * Write prompts array to a JSON file.
 */
function writePromptsFile(filePath: string, prompts: SavedPrompt[]): void {
  const dir = path.dirname(filePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Sort by usage count (most used first), then by updatedAt
  const sorted = [...prompts].sort((a, b) => {
    if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount;
    return b.updatedAt.localeCompare(a.updatedAt);
  });

  fs.writeFileSync(filePath, JSON.stringify({ prompts: sorted }, null, 2), 'utf8');
}

/**
 * Save (create or update) a prompt in a given file.
 */
function upsertPrompt(filePath: string, prompt: SavedPrompt): PromptsResult {
  const result = readPromptsFile(filePath);
  if (result.error) return result;

  const existing = result.prompts.findIndex((p) => p.id === prompt.id);
  if (existing >= 0) {
    result.prompts[existing] = { ...prompt, updatedAt: new Date().toISOString() };
  } else {
    result.prompts.push({
      ...prompt,
      createdAt: prompt.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  try {
    writePromptsFile(filePath, result.prompts);
    return readPromptsFile(filePath);
  } catch (err) {
    return { error: (err as Error).message, prompts: result.prompts };
  }
}

/**
 * Delete a prompt by ID from a given file.
 */
function removePrompt(filePath: string, promptId: string): PromptsResult {
  const result = readPromptsFile(filePath);
  if (result.error) return result;

  result.prompts = result.prompts.filter((p) => p.id !== promptId);

  try {
    writePromptsFile(filePath, result.prompts);
    return readPromptsFile(filePath);
  } catch (err) {
    return { error: (err as Error).message, prompts: result.prompts };
  }
}

// ─── Project-level prompts ───────────────────────────────────────────────────

/**
 * Load prompts from a project's .subframe/prompts.json
 */
function loadPrompts(projectPath: string): PromptsResult {
  if (!projectPath) return { error: 'No project selected', prompts: [] };
  return readPromptsFile(path.join(projectPath, PROMPTS_FILE));
}

/**
 * Save (create or update) a project prompt
 */
function savePrompt(projectPath: string, prompt: SavedPrompt): PromptsResult {
  if (!projectPath) return { error: 'No project selected', prompts: [] };
  return upsertPrompt(path.join(projectPath, PROMPTS_FILE), prompt);
}

/**
 * Delete a project prompt by ID
 */
function deletePrompt(projectPath: string, promptId: string): PromptsResult {
  if (!projectPath) return { error: 'No project selected', prompts: [] };
  return removePrompt(path.join(projectPath, PROMPTS_FILE), promptId);
}

// ─── Seed prompts (first-launch defaults) ───────────────────────────────────

function generateSeedId(): string {
  return `prompt-seed-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Starter prompts seeded on first launch */
function getSeedPrompts(): SavedPrompt[] {
  const now = new Date().toISOString();
  const base = { usageCount: 0, createdAt: now, updatedAt: now, scope: 'global' as const };

  return [
    {
      ...base, id: generateSeedId(),
      title: 'Quick Audit',
      content: 'Audit: same-pattern bugs elsewhere, edge cases, fix tradeoffs, other considerations, and anything I missed.',
      tags: ['audit', 'starter'],
      category: 'Review',
    },
    {
      ...base, id: generateSeedId(),
      title: 'Explain This',
      content: 'Explain what this code does, why it\'s written this way, and any non-obvious design decisions.',
      tags: ['learning', 'starter'],
      category: 'Understand',
    },
    {
      ...base, id: generateSeedId(),
      title: 'Refactor Suggestions',
      content: 'Suggest refactoring opportunities in this code. Focus on readability, maintainability, and removing duplication. Don\'t implement — just list.',
      tags: ['refactor', 'starter'],
      category: 'Review',
    },
    {
      ...base, id: generateSeedId(),
      title: 'Write Tests',
      content: 'Write unit tests for the most recent changes. Follow existing test patterns in {{project}}. Cover happy path, edge cases, and error states.',
      tags: ['testing', 'starter'],
      category: 'Code',
    },
    {
      ...base, id: generateSeedId(),
      title: 'PR Description',
      content: 'Write a PR description for all changes on this branch. Include: summary (2-3 bullets), what changed, and how to test.',
      tags: ['git', 'starter'],
      category: 'Workflow',
    },
    {
      ...base, id: generateSeedId(),
      title: 'Security Review',
      content: 'Review this code for security vulnerabilities: injection, XSS, auth bypass, secrets exposure, OWASP top 10. Report only real concerns with confidence levels.',
      tags: ['security', 'starter'],
      category: 'Review',
    },
    {
      ...base, id: generateSeedId(),
      title: 'Summarize Session',
      content: 'Summarize everything we did this session: tasks completed, files changed, decisions made, and anything left in progress.',
      tags: ['workflow', 'starter'],
      category: 'Workflow',
    },
  ];
}

/**
 * Seed global prompts file on first launch.
 * Only writes if the file does not exist yet.
 */
function seedGlobalPromptsIfNeeded(): void {
  const globalPath = getGlobalPromptsPath();
  if (fs.existsSync(globalPath)) return;

  const dir = path.dirname(globalPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const seeds = getSeedPrompts();
  fs.writeFileSync(globalPath, JSON.stringify({ prompts: seeds }, null, 2), 'utf8');
}

// ─── Global prompts ─────────────────────────────────────────────────────────

/**
 * Load global prompts from ~/.subframe/prompts.json
 */
function loadGlobalPrompts(): PromptsResult {
  seedGlobalPromptsIfNeeded();
  return readPromptsFile(getGlobalPromptsPath());
}

/**
 * Save (create or update) a global prompt
 */
function saveGlobalPrompt(prompt: SavedPrompt): PromptsResult {
  return upsertPrompt(getGlobalPromptsPath(), { ...prompt, scope: 'global' });
}

/**
 * Delete a global prompt by ID
 */
function deleteGlobalPrompt(promptId: string): PromptsResult {
  return removePrompt(getGlobalPromptsPath(), promptId);
}

// ─── IPC Setup ───────────────────────────────────────────────────────────────

/**
 * Setup IPC handlers
 */
function setupIPC(ipcMain: IpcMain): void {
  // Project-level prompts
  ipcMain.handle(IPC.LOAD_PROMPTS, (_event, projectPath: string) => {
    return loadPrompts(projectPath);
  });

  ipcMain.handle(IPC.SAVE_PROMPT, (_event, { projectPath, prompt }: { projectPath: string; prompt: SavedPrompt }) => {
    return savePrompt(projectPath, prompt);
  });

  ipcMain.handle(IPC.DELETE_PROMPT, (_event, { projectPath, promptId }: { projectPath: string; promptId: string }) => {
    return deletePrompt(projectPath, promptId);
  });

  // Global prompts
  ipcMain.handle(IPC.LOAD_GLOBAL_PROMPTS, () => {
    return loadGlobalPrompts();
  });

  ipcMain.handle(IPC.SAVE_GLOBAL_PROMPT, (_event, prompt: SavedPrompt) => {
    return saveGlobalPrompt(prompt);
  });

  ipcMain.handle(IPC.DELETE_GLOBAL_PROMPT, (_event, promptId: string) => {
    return deleteGlobalPrompt(promptId);
  });
}

export { setupIPC };
