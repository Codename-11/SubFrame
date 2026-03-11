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

// ─── Global prompts ─────────────────────────────────────────────────────────

/**
 * Load global prompts from ~/.subframe/prompts.json
 */
function loadGlobalPrompts(): PromptsResult {
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
