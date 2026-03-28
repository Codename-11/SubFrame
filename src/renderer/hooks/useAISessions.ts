import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useProjectStore } from '../stores/useProjectStore';
import { useUIStore } from '../stores/useUIStore';
import { useIpcQuery } from './useIpc';
import { useIPCEvent } from './useIPCListener';
import { IPC, type AISessionsPayload } from '../../shared/ipcChannels';

export function useAISessions() {
  const projectPath = useProjectStore((s) => s.currentProjectPath);
  const queryClient = useQueryClient();
  const activePanel = useUIStore((s) => s.activePanel);
  const isVisible = activePanel === 'aiSessions';

  const query = useIpcQuery(
    IPC.LIST_AI_SESSIONS,
    [projectPath ?? null],
    {
      enabled: !!projectPath,
      refetchInterval: isVisible ? 5_000 : false,
    },
  );

  useIPCEvent<AISessionsPayload>(IPC.AI_SESSIONS_UPDATED, (payload) => {
    const filtered = !projectPath
      ? payload.sessions
      : payload.sessions.filter((session) => session.projectPath === projectPath);
    queryClient.setQueryData([IPC.LIST_AI_SESSIONS, projectPath ?? null], { sessions: filtered });
  });

  useEffect(() => {
    if (!projectPath) return;
    query.refetch().catch(() => {
      // best effort
    });
  }, [projectPath]);

  return {
    sessions: query.data?.sessions ?? [],
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
