/**
 * TanStack Query hook for project overview data.
 */

import { useIpcQuery } from './useIpc';
import { useProjectStore } from '../stores/useProjectStore';
import { IPC } from '../../shared/ipcChannels';

export function useOverview() {
  const projectPath = useProjectStore((s) => s.currentProjectPath);

  const query = useIpcQuery(
    IPC.LOAD_OVERVIEW,
    [projectPath ?? ''],
    { enabled: !!projectPath }
  );

  return {
    overview: query.data ?? null,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
