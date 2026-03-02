/**
 * TanStack Query hook for file tree data.
 * Sends LOAD_FILE_TREE and listens for FILE_TREE_DATA events.
 */

import { useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useIpcQuery } from './useIpc';
import { IPC } from '../../shared/ipcChannels';
import type { FileTreeNode } from '../../shared/ipcChannels';
import { typedSend } from '../lib/ipc';

const { ipcRenderer } = require('electron');

/**
 * Fetches and caches file tree data for a project.
 * Listens for FILE_TREE_DATA responses from main process and
 * auto-refreshes when showDotfiles setting changes.
 */
export function useFileTree(projectPath: string | null) {
  const queryClient = useQueryClient();

  // Load settings to get showDotfiles
  const { data: settings } = useIpcQuery(IPC.LOAD_SETTINGS, [], {
    staleTime: 30_000,
  });

  const showDotfiles = !!((settings as Record<string, any> | undefined)?.general?.showDotfiles);

  // The query fetches by sending an IPC message and waiting for the response event.
  // We track which request is current to avoid cross-contamination from concurrent queries.
  const requestSeq = useRef(0);

  const query = useQuery<FileTreeNode[], Error>({
    queryKey: ['fileTree', projectPath, showDotfiles],
    queryFn: () => {
      if (!projectPath) return Promise.resolve([]);

      const mySeq = ++requestSeq.current;
      return new Promise<FileTreeNode[]>((resolve) => {
        const handler = (_event: unknown, files: FileTreeNode[]) => {
          // Only accept this response if we're still the current request
          if (mySeq !== requestSeq.current) {
            ipcRenderer.removeListener(IPC.FILE_TREE_DATA, handler);
            return; // Stale response — TanStack Query will retry with the latest params
          }
          ipcRenderer.removeListener(IPC.FILE_TREE_DATA, handler);
          resolve(files);
        };
        ipcRenderer.on(IPC.FILE_TREE_DATA, handler);
        typedSend(IPC.LOAD_FILE_TREE, { path: projectPath, showDotfiles });
      });
    },
    enabled: !!projectPath,
    staleTime: 10_000,
  });

  // Invalidate when settings change (showDotfiles toggle)
  useEffect(() => {
    const handler = (_event: unknown, data: { key: string }) => {
      if (data.key === 'general.showDotfiles') {
        queryClient.invalidateQueries({ queryKey: ['fileTree'] });
      }
    };
    ipcRenderer.on(IPC.SETTINGS_UPDATED, handler);
    return () => {
      ipcRenderer.removeListener(IPC.SETTINGS_UPDATED, handler);
    };
  }, [queryClient]);

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['fileTree', projectPath] });
  }, [queryClient, projectPath]);

  return { ...query, refresh };
}
