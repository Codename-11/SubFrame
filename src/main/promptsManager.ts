/**
 * Prompts Manager Module
 * Handles CRUD operations for saved prompts (prompt library).
 * Prompts are stored in .subframe/prompts.json per project.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { IpcMain } from 'electron';
import { IPC } from '../shared/ipcChannels';
import type { SavedPrompt, PromptsResult } from '../shared/ipcChannels';

const PROMPTS_FILE = path.join('.subframe', 'prompts.json');

/**
 * Load prompts from a project's .subframe/prompts.json
 */
function loadPrompts(projectPath: string): PromptsResult {
  if (!projectPath) return { error: 'No project selected', prompts: [] };

  const filePath = path.join(projectPath, PROMPTS_FILE);

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
 * Save prompts array to .subframe/prompts.json
 */
function writePrompts(projectPath: string, prompts: SavedPrompt[]): void {
  const filePath = path.join(projectPath, PROMPTS_FILE);
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
 * Save (create or update) a prompt
 */
function savePrompt(projectPath: string, prompt: SavedPrompt): PromptsResult {
  if (!projectPath) return { error: 'No project selected', prompts: [] };

  const result = loadPrompts(projectPath);
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
    writePrompts(projectPath, result.prompts);
    return loadPrompts(projectPath);
  } catch (err) {
    return { error: (err as Error).message, prompts: result.prompts };
  }
}

/**
 * Delete a prompt by ID
 */
function deletePrompt(projectPath: string, promptId: string): PromptsResult {
  if (!projectPath) return { error: 'No project selected', prompts: [] };

  const result = loadPrompts(projectPath);
  if (result.error) return result;

  result.prompts = result.prompts.filter((p) => p.id !== promptId);

  try {
    writePrompts(projectPath, result.prompts);
    return loadPrompts(projectPath);
  } catch (err) {
    return { error: (err as Error).message, prompts: result.prompts };
  }
}

/**
 * Setup IPC handlers
 */
function setupIPC(ipcMain: IpcMain): void {
  ipcMain.handle(IPC.LOAD_PROMPTS, (_event, projectPath: string) => {
    return loadPrompts(projectPath);
  });

  ipcMain.handle(IPC.SAVE_PROMPT, (_event, { projectPath, prompt }: { projectPath: string; prompt: SavedPrompt }) => {
    return savePrompt(projectPath, prompt);
  });

  ipcMain.handle(IPC.DELETE_PROMPT, (_event, { projectPath, promptId }: { projectPath: string; promptId: string }) => {
    return deletePrompt(projectPath, promptId);
  });
}

export { setupIPC };
