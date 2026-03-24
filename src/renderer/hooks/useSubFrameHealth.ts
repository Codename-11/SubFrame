/**
 * TanStack Query hook for SubFrame health status.
 * Uses the send/on pattern since GET_SUBFRAME_HEALTH is a send channel.
 * Provides health status, component updates, and uninstall mutations.
 *
 * Auto-updates outdated managed components on project load and shows
 * a summary toast. User-managed files (@subframe-managed: false) are skipped.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { typedSend } from '../lib/ipc';
import { useProjectStore } from '../stores/useProjectStore';
import {
  IPC,
  type SubFrameHealthStatus,
  type UninstallOptions,
  type UninstallResult,
} from '../../shared/ipcChannels';
import { useCallback, useRef, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getTransport } from '../lib/transportProvider';

export function useSubFrameHealth() {
  const projectPath = useProjectStore((s) => s.currentProjectPath);
  const queryClient = useQueryClient();
  const latestData = useRef<SubFrameHealthStatus | null>(null);

  // Clear stale ref on project switch
  useEffect(() => { latestData.current = null; }, [projectPath]);

  // ── Update result state ──
  const [updateResult, setUpdateResult] = useState<{ updated: string[]; failed: string[]; skipped?: string[] } | null>(null);

  // ── Uninstall result state ──
  const [uninstallResult, setUninstallResult] = useState<UninstallResult | null>(null);

  // ── Auto-update tracking ──
  // Tracks which project path has been auto-updated this session (prevents loops)
  const autoUpdatedForRef = useRef<string | null>(null);
  // True when an auto-update is in flight (distinguishes auto vs manual in result handler)
  const pendingAutoUpdateRef = useRef(false);

  // Reset auto-update tracking when project changes
  useEffect(() => {
    autoUpdatedForRef.current = null;
  }, [projectPath]);

  // ── Health data listener ──
  useEffect(() => {
    const handler = (_event: unknown, data: { projectPath: string; health: SubFrameHealthStatus | null; error?: string }) => {
      if (data.health) {
        latestData.current = data.health;
        queryClient.setQueryData(['subframeHealth', projectPath], data.health);

        // Auto-update outdated managed components (once per project load)
        if (data.projectPath === projectPath && autoUpdatedForRef.current !== projectPath) {
          const outdatedIds = data.health.components
            .filter(c => (c.needsUpdate || !c.exists) && !c.managedOptOut)
            .map(c => c.id);
          if (outdatedIds.length > 0) {
            autoUpdatedForRef.current = projectPath;
            pendingAutoUpdateRef.current = true;
            typedSend(IPC.UPDATE_SUBFRAME_COMPONENTS, { projectPath, componentIds: outdatedIds });
          }
        }
      }
    };
    return getTransport().on(IPC.SUBFRAME_HEALTH_DATA, handler);
  }, [projectPath, queryClient]);

  // ── Components updated listener ──
  useEffect(() => {
    const handler = (_event: unknown, data: { projectPath: string; updated: string[]; failed: string[]; skipped?: string[]; error?: string }) => {
      setUpdateResult({ updated: data.updated || [], failed: data.failed || [], skipped: data.skipped });

      // Show toast — auto-updates get a summary, manual updates are handled by the panel
      const isAutoUpdate = pendingAutoUpdateRef.current;
      pendingAutoUpdateRef.current = false;

      if (isAutoUpdate) {
        const updated = data.updated?.length || 0;
        const skipped = data.skipped?.length || 0;
        const failed = data.failed?.length || 0;

        if (updated > 0 && failed === 0 && skipped === 0) {
          toast.info(`SubFrame synced ${updated} component${updated > 1 ? 's' : ''}`);
        } else if (updated > 0 && skipped > 0) {
          toast.info(`Synced ${updated} component${updated > 1 ? 's' : ''}, ${skipped} user-managed unchanged`);
        } else if (failed > 0) {
          toast.warning(`SubFrame updated ${updated}, ${failed} failed — check Health panel`);
        }
      }

      // Refresh health after update
      reload();
    };
    return getTransport().on(IPC.SUBFRAME_COMPONENTS_UPDATED, handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectPath]);

  // ── Uninstall result listener ──
  useEffect(() => {
    const handler = (_event: unknown, data: { projectPath: string; result: UninstallResult | null; error?: string }) => {
      if (data.result) {
        setUninstallResult(data.result);
      }
    };
    return getTransport().on(IPC.SUBFRAME_UNINSTALLED, handler);
  }, []);

  const reload = useCallback(() => {
    if (projectPath) {
      typedSend(IPC.GET_SUBFRAME_HEALTH, projectPath);
    }
  }, [projectPath]);

  const query = useQuery<SubFrameHealthStatus | null>({
    queryKey: ['subframeHealth', projectPath],
    queryFn: () => {
      if (!projectPath) return null;
      typedSend(IPC.GET_SUBFRAME_HEALTH, projectPath);
      return latestData.current;
    },
    enabled: !!projectPath,
  });

  const updateComponents = useMutation({
    mutationFn: (componentIds: string[]) => {
      if (!projectPath) return Promise.resolve();
      typedSend(IPC.UPDATE_SUBFRAME_COMPONENTS, { projectPath, componentIds });
      return Promise.resolve();
    },
  });

  const uninstall = useMutation({
    mutationFn: (options: UninstallOptions) => {
      if (!projectPath) return Promise.resolve();
      typedSend(IPC.UNINSTALL_SUBFRAME, { projectPath, options });
      return Promise.resolve();
    },
  });

  return {
    health: query.data ?? null,
    isLoading: query.isLoading,
    refetch: reload,
    updateComponents,
    uninstall,
    updateResult,
    uninstallResult,
  };
}
