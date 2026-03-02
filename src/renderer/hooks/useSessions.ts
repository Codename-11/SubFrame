/**
 * TanStack Query hook for Claude Code sessions.
 */

import { useQueryClient } from '@tanstack/react-query';
import { useIpcQuery, useIpcMutation } from './useIpc';
import { useProjectStore } from '../stores/useProjectStore';
import { IPC } from '../../shared/ipcChannels';

export function useSessions() {
  const projectPath = useProjectStore((s) => s.currentProjectPath);
  const queryClient = useQueryClient();

  const query = useIpcQuery(
    IPC.LOAD_CLAUDE_SESSIONS,
    [projectPath ?? ''],
    {
      enabled: !!projectPath,
      refetchInterval: 30_000,
    }
  );

  const renameMutation = useIpcMutation(IPC.RENAME_CLAUDE_SESSION, {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [IPC.LOAD_CLAUDE_SESSIONS] });
    },
  });

  const deleteMutation = useIpcMutation(IPC.DELETE_CLAUDE_SESSION, {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [IPC.LOAD_CLAUDE_SESSIONS] });
    },
  });

  const deleteAllMutation = useIpcMutation(IPC.DELETE_ALL_CLAUDE_SESSIONS, {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [IPC.LOAD_CLAUDE_SESSIONS] });
    },
  });

  return {
    sessions: query.data ?? [],
    isLoading: query.isLoading,
    refetch: query.refetch,
    renameSession: (sessionId: string, name: string) => {
      if (!projectPath) return;
      renameMutation.mutate([{ projectPath, sessionId, name }]);
    },
    deleteSession: (sessionId: string, slug: string) => {
      if (!projectPath) return;
      deleteMutation.mutate([{ projectPath, sessionId, slug }]);
    },
    deleteAllSessions: () => {
      if (!projectPath) return;
      deleteAllMutation.mutate([projectPath]);
    },
  };
}
