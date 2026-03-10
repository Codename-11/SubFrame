/**
 * Shared prompt utilities.
 * Extracted from PromptLibrary.tsx and PromptsPanel.tsx to eliminate duplication.
 */

import { toast } from 'sonner';
import { typedSend } from './ipc';
import { IPC } from '../../shared/ipcChannels';
import { useUIStore } from '../stores/useUIStore';
import { useTerminalStore } from '../stores/useTerminalStore';
import * as terminalRegistry from './terminalRegistry';
import type { SavedPrompt } from '../../shared/ipcChannels';

/** Template variables available in prompt content */
export const TEMPLATE_VARIABLES = [
  { token: '{{project}}', label: 'Project', description: 'Project folder name' },
  { token: '{{projectPath}}', label: 'Path', description: 'Full project path' },
  { token: '{{file}}', label: 'File', description: 'Currently open file' },
] as const;

/** Regex that matches all template variable tokens */
export const TEMPLATE_VAR_REGEX = /\{\{(project|projectPath|file)\}\}/g;

/** Generate a unique prompt ID */
export function generatePromptId(): string {
  return `prompt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Create a blank prompt scaffold for new prompt creation */
export function createBlankPrompt(): SavedPrompt {
  const now = new Date().toISOString();
  return {
    id: generatePromptId(),
    title: '',
    content: '',
    tags: [],
    category: 'General',
    usageCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

/** Resolve template variables in prompt content */
export function resolveTemplateVariables(
  content: string,
  projectPath: string | null
): string {
  let text = content;
  if (projectPath) {
    const projectName = projectPath.split(/[\\/]/).pop() || '';
    text = text.replace(/\{\{project\}\}/g, projectName);
    text = text.replace(/\{\{projectPath\}\}/g, projectPath);
  }
  const editorFile = useUIStore.getState().editorFilePath;
  text = text.replace(/\{\{file\}\}/g, editorFile || '');
  return text;
}

/**
 * Insert a prompt into the active terminal.
 * Returns true if insertion succeeded.
 */
export function insertPromptIntoTerminal(
  prompt: SavedPrompt,
  activeTerminalId: string | null,
  projectPath: string | null
): boolean {
  if (!activeTerminalId) {
    toast.warning('No active terminal', { description: 'Open a terminal first.' });
    return false;
  }
  const text = resolveTemplateVariables(prompt.content, projectPath);
  typedSend(IPC.TERMINAL_INPUT_ID, { terminalId: activeTerminalId, data: text });
  // Focus the xterm instance so the user can immediately edit or press Enter.
  // 100ms delay ensures Radix Dialog focus-restore (on close) completes first.
  setTimeout(() => {
    const instance = terminalRegistry.get(activeTerminalId);
    if (instance) instance.terminal.focus();
  }, 100);
  toast.success('Inserted into terminal');
  return true;
}

/**
 * Send a command string to the active terminal and execute it.
 * Returns true if the command was sent successfully.
 */
export function sendCommandToTerminal(command: string): boolean {
  const { activeTerminalId } = useTerminalStore.getState();
  if (!activeTerminalId) {
    toast.warning('No active terminal', { description: 'Open a terminal first.' });
    return false;
  }
  typedSend(IPC.TERMINAL_INPUT_ID, { terminalId: activeTerminalId, data: command + '\r' });
  // Focus the xterm instance so the terminal is ready for interaction.
  // 100ms delay ensures Radix Dialog/Dropdown focus-restore completes first.
  setTimeout(() => {
    const instance = terminalRegistry.get(activeTerminalId);
    if (instance) instance.terminal.focus();
  }, 100);
  return true;
}

/** Copy prompt content to clipboard */
export function copyPromptToClipboard(prompt: SavedPrompt): void {
  navigator.clipboard.writeText(prompt.content);
  toast.success('Copied to clipboard');
}

/** Parse comma-separated tags string into array */
export function parseTags(input: string): string[] {
  return input
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Sort mode options for prompt lists */
export type PromptSortMode = 'usage' | 'updated' | 'alpha';

/** Sort prompts by the selected mode */
export function sortPrompts(prompts: SavedPrompt[], mode: PromptSortMode): SavedPrompt[] {
  const sorted = [...prompts];
  switch (mode) {
    case 'usage':
      sorted.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
      break;
    case 'updated':
      sorted.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      break;
    case 'alpha':
      sorted.sort((a, b) => a.title.localeCompare(b.title));
      break;
  }
  return sorted;
}
