/**
 * TanStack Query hook for real-time agent state visualization.
 * Wraps LOAD_AGENT_STATE (send/on) + WATCH/UNWATCH lifecycle.
 *
 * The IPC listener is registered with an empty dep array (always active)
 * to avoid race conditions where LOAD_AGENT_STATE response arrives
 * before the listener is set up.
 */

import { useEffect, useRef, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useProjectStore } from '../stores/useProjectStore';
import { IPC } from '../../shared/ipcChannels';
import type { AgentStatePayload, AgentSession } from '../../shared/agentStateTypes';
import { getTransport } from '../lib/transportProvider';

/**
 * Query hook that loads agent state via send/on pattern and keeps cache
 * fresh via IPC events pushed from the main process file watcher.
 */
export function useAgentState() {
  const projectPath = useProjectStore((s) => s.currentProjectPath);
  const queryClient = useQueryClient();
  const latestData = useRef<AgentStatePayload | null>(null);
  const lastUpdateTs = useRef<string>('');
  const projectPathRef = useRef(projectPath);
  projectPathRef.current = projectPath;

  // Clear stale refs on project switch
  useEffect(() => {
    latestData.current = null;
    lastUpdateTs.current = '';
  }, [projectPath]);

  // Register IPC listener FIRST (empty deps — always active, avoids race condition)
  useEffect(() => {
    const handler = (_event: unknown, data: AgentStatePayload) => {
      const currentPath = projectPathRef.current;
      if (!currentPath) return;
      if (data?.lastUpdated && data.lastUpdated !== lastUpdateTs.current) {
        lastUpdateTs.current = data.lastUpdated;
        latestData.current = data;
        queryClient.setQueryData(['agentState', currentPath], data);
      }
    };
    return getTransport().on(IPC.AGENT_STATE_DATA, handler);
  }, [queryClient]);

  // Start/stop file watching + load initial data (depends on projectPath)
  useEffect(() => {
    if (!projectPath) return;
    const transport = getTransport();
    transport.send(IPC.WATCH_AGENT_STATE, projectPath);
    transport.send(IPC.LOAD_AGENT_STATE, projectPath);
    return () => {
      transport.send(IPC.UNWATCH_AGENT_STATE);
    };
  }, [projectPath]);

  const query = useQuery<AgentStatePayload | null>({
    queryKey: ['agentState', projectPath],
    queryFn: () =>
      latestData.current ?? { projectPath: projectPath || '', sessions: [], lastUpdated: '' },
    enabled: !!projectPath,
    staleTime: Infinity,
  });

  const sessions = useMemo<AgentSession[]>(
    () => query.data?.sessions ?? [],
    [query.data],
  );

  const activeSession = useMemo(
    () => sessions.find((s) => s.status === 'active' || s.status === 'busy') ?? null,
    [sessions],
  );

  return {
    agentState: query.data ?? null,
    sessions,
    activeSession,
    isLoading: query.isLoading,
  };
}
