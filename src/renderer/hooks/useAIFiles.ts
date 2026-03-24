/**
 * TanStack Query hook for AI files status (CLAUDE.md, GEMINI.md, AGENTS.md).
 * Uses the send/on pattern since GET_AI_FILES_STATUS is a send channel.
 * Also provides backlink verification, config loading/saving, and update-all.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { typedSend } from '../lib/ipc';
import { useIPCEvent } from './useIPCListener';
import { useProjectStore } from '../stores/useProjectStore';
import {
  IPC,
  type AIFilesStatus,
  type BacklinkVerificationResult,
  type BacklinkConfig,
} from '../../shared/ipcChannels';
import { useCallback, useRef, useEffect, useState } from 'react';
import { getTransport } from '../lib/transportProvider';

export function useAIFiles() {
  const projectPath = useProjectStore((s) => s.currentProjectPath);
  const queryClient = useQueryClient();
  const latestData = useRef<AIFilesStatus | null>(null);

  // Clear stale ref on project switch
  useEffect(() => { latestData.current = null; }, [projectPath]);

  // ── Backlink verification state ──
  const [verificationResult, setVerificationResult] = useState<BacklinkVerificationResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // ── Backlink config state ──
  const [backlinkConfig, setBacklinkConfig] = useState<BacklinkConfig | null>(null);
  const [backlinkConfigLoaded, setBacklinkConfigLoaded] = useState(false);

  // ── AI files status listener ──
  useEffect(() => {
    const handler = (_event: unknown, data: { projectPath: string; status: AIFilesStatus | null }) => {
      if (data.status) {
        latestData.current = data.status;
        queryClient.setQueryData(['aiFiles', projectPath], data.status);
      }
    };
    return getTransport().on(IPC.AI_FILES_STATUS_DATA, handler);
  }, [projectPath, queryClient]);

  // ── Backlink verification result listener ──
  useEffect(() => {
    const handler = (_event: unknown, data: { projectPath: string; result: BacklinkVerificationResult | null; error?: string }) => {
      setIsVerifying(false);
      if (data.error) {
        setVerificationResult(null);
      } else {
        setVerificationResult(data.result);
      }
    };
    return getTransport().on(IPC.BACKLINK_VERIFICATION_RESULT, handler);
  }, []);

  // ── Backlink config data listener ──
  useEffect(() => {
    const handler = (_event: unknown, data: { projectPath: string; config: BacklinkConfig | null }) => {
      setBacklinkConfig(data.config);
      setBacklinkConfigLoaded(true);
    };
    return getTransport().on(IPC.BACKLINK_CONFIG_DATA, handler);
  }, []);

  // ── Backlink config saved listener ──
  useEffect(() => {
    const handler = (_event: unknown, _data: { projectPath: string; success: boolean }) => {
      // Config saved — result handled in the mutation onSuccess
    };
    return getTransport().on(IPC.BACKLINK_CONFIG_SAVED, handler);
  }, []);

  // ── All backlinks updated listener ──
  useEffect(() => {
    const handler = (_event: unknown, _data: { projectPath: string; result: unknown }) => {
      // Update complete — reload status to reflect changes
      reload();
    };
    return getTransport().on(IPC.ALL_BACKLINKS_UPDATED, handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectPath]);

  // Reset backlink config state on project change
  useEffect(() => {
    setBacklinkConfig(null);
    setBacklinkConfigLoaded(false);
  }, [projectPath]);

  const reload = useCallback(() => {
    if (projectPath) {
      typedSend(IPC.GET_AI_FILES_STATUS, projectPath);
    }
  }, [projectPath]);

  // Refresh on file update events
  useIPCEvent(IPC.AI_FILE_UPDATED, reload);

  const query = useQuery<AIFilesStatus | null>({
    queryKey: ['aiFiles', projectPath],
    queryFn: () => {
      if (!projectPath) return null;
      typedSend(IPC.GET_AI_FILES_STATUS, projectPath);
      return latestData.current;
    },
    enabled: !!projectPath,
  });

  const injectBacklink = useMutation({
    mutationFn: (filename: string) => {
      if (!projectPath) return Promise.resolve();
      typedSend(IPC.INJECT_BACKLINK, { projectPath, filename });
      return Promise.resolve();
    },
    onSuccess: reload,
  });

  const removeBacklink = useMutation({
    mutationFn: (filename: string) => {
      if (!projectPath) return Promise.resolve();
      typedSend(IPC.REMOVE_BACKLINK, { projectPath, filename });
      return Promise.resolve();
    },
    onSuccess: reload,
  });

  const createFile = useMutation({
    mutationFn: (filename: string) => {
      if (!projectPath) return Promise.resolve();
      typedSend(IPC.CREATE_NATIVE_FILE, { projectPath, filename });
      return Promise.resolve();
    },
    onSuccess: reload,
  });

  const migrateSymlink = useMutation({
    mutationFn: (filename: string) => {
      if (!projectPath) return Promise.resolve();
      typedSend(IPC.MIGRATE_SYMLINK, { projectPath, filename });
      return Promise.resolve();
    },
    onSuccess: reload,
  });

  // ── Verify backlinks ──
  const verifyBacklinks = useCallback(() => {
    if (!projectPath) return;
    setIsVerifying(true);
    setVerificationResult(null);
    typedSend(IPC.VERIFY_BACKLINKS, projectPath);
  }, [projectPath]);

  // ── Load backlink config ──
  const loadBacklinkConfig = useCallback(() => {
    if (!projectPath) return;
    typedSend(IPC.GET_BACKLINK_CONFIG, projectPath);
  }, [projectPath]);

  // ── Save backlink config ──
  const saveBacklinkConfig = useMutation({
    mutationFn: (config: BacklinkConfig) => {
      if (!projectPath) return Promise.resolve();
      typedSend(IPC.SAVE_BACKLINK_CONFIG, { projectPath, backlinkConfig: config });
      return Promise.resolve();
    },
  });

  // ── Update all backlinks ──
  const updateAllBacklinks = useMutation({
    mutationFn: () => {
      if (!projectPath) return Promise.resolve();
      typedSend(IPC.UPDATE_ALL_BACKLINKS, projectPath);
      return Promise.resolve();
    },
    onSuccess: reload,
  });

  return {
    status: query.data ?? null,
    isLoading: query.isLoading,
    refetch: reload,
    injectBacklink,
    removeBacklink,
    createFile,
    migrateSymlink,
    // Backlink verification
    verifyBacklinks,
    verificationResult,
    isVerifying,
    // Backlink config
    backlinkConfig,
    backlinkConfigLoaded,
    loadBacklinkConfig,
    saveBacklinkConfig,
    updateAllBacklinks,
  };
}
