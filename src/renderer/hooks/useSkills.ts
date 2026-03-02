/**
 * TanStack Query hook for loading Claude Code skills.
 */

import { useProjectStore } from '../stores/useProjectStore';
import { useIpcQuery } from './useIpc';
import { IPC } from '../../shared/ipcChannels';

export function useSkills() {
  const projectPath = useProjectStore((s) => s.currentProjectPath);

  const query = useIpcQuery(IPC.LOAD_SKILLS, [projectPath ?? ''], {
    enabled: !!projectPath,
  });

  return {
    skills: query.data ?? [],
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
