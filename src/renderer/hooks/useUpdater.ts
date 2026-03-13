/**
 * TanStack Query hook for auto-updater state management.
 * Listens for status/progress events from the main process and
 * exposes mutations for check, download, and install actions.
 */

import { useState, useCallback } from 'react';
import { useIpcMutation } from './useIpc';
import { useIPCEvent } from './useIPCListener';
import { IPC } from '../../shared/ipcChannels';
import type { UpdaterStatus, UpdaterProgress } from '../../shared/ipcChannels';

export interface UpdaterState {
  status: UpdaterStatus['status'] | 'idle';
  version?: string;
  error?: string;
  progress?: UpdaterProgress;
  /** True when the current check was triggered by the user (menu / settings) */
  manual?: boolean;
}

export function useUpdater() {
  const [state, setState] = useState<UpdaterState>({ status: 'idle' });

  // Listen for status pushes from main process
  const handleStatus = useCallback((data: UpdaterStatus) => {
    setState((prev) => ({
      ...prev,
      status: data.status,
      version: data.version ?? prev.version,
      error: data.error,
      manual: data.manual,
    }));
  }, []);

  // Listen for download progress
  const handleProgress = useCallback((data: UpdaterProgress) => {
    setState((prev) => ({ ...prev, progress: data }));
  }, []);

  useIPCEvent<UpdaterStatus>(IPC.UPDATER_STATUS, handleStatus);
  useIPCEvent<UpdaterProgress>(IPC.UPDATER_PROGRESS, handleProgress);

  // Mutations for user-initiated actions
  const checkForUpdates = useIpcMutation(IPC.UPDATER_CHECK);
  const downloadUpdate = useIpcMutation(IPC.UPDATER_DOWNLOAD);
  const installUpdate = useIpcMutation(IPC.UPDATER_INSTALL);

  return {
    ...state,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
  };
}
