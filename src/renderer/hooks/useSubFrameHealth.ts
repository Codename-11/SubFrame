/**
 * TanStack Query hook for SubFrame health status.
 * Uses the send/on pattern since GET_SUBFRAME_HEALTH is a send channel.
 * Provides health status, component updates, and uninstall mutations.
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

const { ipcRenderer } = require('electron');

export function useSubFrameHealth() {
  const projectPath = useProjectStore((s) => s.currentProjectPath);
  const queryClient = useQueryClient();
  const latestData = useRef<SubFrameHealthStatus | null>(null);

  // ── Update result state ──
  const [updateResult, setUpdateResult] = useState<{ updated: string[]; failed: string[] } | null>(null);

  // ── Uninstall result state ──
  const [uninstallResult, setUninstallResult] = useState<UninstallResult | null>(null);

  // ── Health data listener ──
  useEffect(() => {
    const handler = (_event: unknown, data: { projectPath: string; health: SubFrameHealthStatus | null; error?: string }) => {
      if (data.health) {
        latestData.current = data.health;
        queryClient.setQueryData(['subframeHealth', projectPath], data.health);
      }
    };
    ipcRenderer.on(IPC.SUBFRAME_HEALTH_DATA, handler);
    return () => { ipcRenderer.removeListener(IPC.SUBFRAME_HEALTH_DATA, handler); };
  }, [projectPath, queryClient]);

  // ── Components updated listener ──
  useEffect(() => {
    const handler = (_event: unknown, data: { projectPath: string; updated: string[]; failed: string[]; error?: string }) => {
      setUpdateResult({ updated: data.updated || [], failed: data.failed || [] });
      // Refresh health after update
      reload();
    };
    ipcRenderer.on(IPC.SUBFRAME_COMPONENTS_UPDATED, handler);
    return () => { ipcRenderer.removeListener(IPC.SUBFRAME_COMPONENTS_UPDATED, handler); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectPath]);

  // ── Uninstall result listener ──
  useEffect(() => {
    const handler = (_event: unknown, data: { projectPath: string; result: UninstallResult | null; error?: string }) => {
      if (data.result) {
        setUninstallResult(data.result);
      }
    };
    ipcRenderer.on(IPC.SUBFRAME_UNINSTALLED, handler);
    return () => { ipcRenderer.removeListener(IPC.SUBFRAME_UNINSTALLED, handler); };
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
