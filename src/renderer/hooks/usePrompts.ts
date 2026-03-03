/**
 * TanStack Query hooks for the prompt library.
 */

import { useIpcQuery, useIpcMutation } from './useIpc';
import { useProjectStore } from '../stores/useProjectStore';
import { IPC } from '../../shared/ipcChannels';

export function usePrompts() {
  const projectPath = useProjectStore((s) => s.currentProjectPath);

  const query = useIpcQuery(
    IPC.LOAD_PROMPTS,
    [projectPath ?? ''],
    { enabled: !!projectPath }
  );

  const savePrompt = useIpcMutation(IPC.SAVE_PROMPT, {
    onSuccess: () => query.refetch(),
  });

  const deletePrompt = useIpcMutation(IPC.DELETE_PROMPT, {
    onSuccess: () => query.refetch(),
  });

  return {
    prompts: query.data?.prompts ?? [],
    error: query.data?.error ?? null,
    isLoading: query.isLoading,
    refetch: query.refetch,
    savePrompt,
    deletePrompt,
  };
}
