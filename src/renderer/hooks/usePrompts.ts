/**
 * TanStack Query hooks for the prompt library.
 * Supports both project-level and global (user-level) prompts.
 */

import { useCallback } from 'react';
import { useIpcQuery, useIpcMutation } from './useIpc';
import { useProjectStore } from '../stores/useProjectStore';
import { IPC } from '../../shared/ipcChannels';
import type { SavedPrompt } from '../../shared/ipcChannels';
import { generatePromptId } from '../lib/promptUtils';

export function usePrompts() {
  const projectPath = useProjectStore((s) => s.currentProjectPath);

  // ─── Project prompts (requires projectPath) ──────────────────────────────

  const projectQuery = useIpcQuery(
    IPC.LOAD_PROMPTS,
    [projectPath ?? ''],
    { enabled: !!projectPath }
  );

  const savePrompt = useIpcMutation(IPC.SAVE_PROMPT, {
    onSuccess: () => projectQuery.refetch(),
  });

  const deletePrompt = useIpcMutation(IPC.DELETE_PROMPT, {
    onSuccess: () => projectQuery.refetch(),
  });

  // ─── Global prompts (always available) ───────────────────────────────────

  const globalQuery = useIpcQuery(
    IPC.LOAD_GLOBAL_PROMPTS,
    [],
    { enabled: true }
  );

  const saveGlobalPrompt = useIpcMutation(IPC.SAVE_GLOBAL_PROMPT, {
    onSuccess: () => globalQuery.refetch(),
  });

  const deleteGlobalPrompt = useIpcMutation(IPC.DELETE_GLOBAL_PROMPT, {
    onSuccess: () => globalQuery.refetch(),
  });

  // ─── Promote / Demote helpers ────────────────────────────────────────────

  /** Copy a project prompt to global, then delete from project */
  const promoteToGlobal = useCallback(
    (prompt: SavedPrompt) => {
      if (!projectPath) return;
      const globalCopy: SavedPrompt = {
        ...prompt,
        id: generatePromptId(),
        scope: 'global',
        updatedAt: new Date().toISOString(),
      };
      saveGlobalPrompt.mutate([globalCopy], {
        onSuccess: () => {
          deletePrompt.mutate([{ projectPath, promptId: prompt.id }]);
        },
      });
    },
    [projectPath, saveGlobalPrompt, deletePrompt]
  );

  /** Copy a global prompt to the current project, then delete from global */
  const demoteToProject = useCallback(
    (prompt: SavedPrompt) => {
      if (!projectPath) return;
      const projectCopy: SavedPrompt = {
        ...prompt,
        id: generatePromptId(),
        scope: 'project',
        updatedAt: new Date().toISOString(),
      };
      savePrompt.mutate([{ projectPath, prompt: projectCopy }], {
        onSuccess: () => {
          deleteGlobalPrompt.mutate([prompt.id]);
        },
      });
    },
    [projectPath, savePrompt, deleteGlobalPrompt]
  );

  return {
    // Project prompts
    prompts: (projectQuery.data?.prompts ?? []).map((p): SavedPrompt & { scope: 'global' | 'project' } => ({ ...p, scope: p.scope ?? 'project' })),
    error: projectQuery.data?.error ?? null,
    isLoading: projectQuery.isLoading,
    refetch: projectQuery.refetch,
    savePrompt,
    deletePrompt,

    // Global prompts
    globalPrompts: (globalQuery.data?.prompts ?? []).map((p): SavedPrompt & { scope: 'global' } => ({ ...p, scope: 'global' })),
    globalError: globalQuery.data?.error ?? null,
    isLoadingGlobal: globalQuery.isLoading,
    refetchGlobal: globalQuery.refetch,
    saveGlobalPrompt,
    deleteGlobalPrompt,

    // Scope transfer
    promoteToGlobal,
    demoteToProject,
  };
}
