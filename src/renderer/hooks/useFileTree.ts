/**
 * TanStack Query hook for file tree data.
 * Sends LOAD_FILE_TREE and listens for FILE_TREE_DATA events.
 * Supports lazy directory loading and file watcher integration.
 */

import { useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useIpcQuery } from './useIpc';
import { IPC } from '../../shared/ipcChannels';
import type { FileTreeNode } from '../../shared/ipcChannels';
import { typedSend } from '../lib/ipc';
import { getTransport } from '../lib/transportProvider';

/**
 * Fetches and caches file tree data for a project.
 * Listens for FILE_TREE_DATA responses from main process and
 * auto-refreshes when showDotfiles setting changes.
 * Integrates with file watcher for live updates and supports lazy directory loading.
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
            unsub();
            return; // Stale response — TanStack Query will retry with the latest params
          }
          unsub();
          resolve(files);
        };
        const unsub = getTransport().on(IPC.FILE_TREE_DATA, handler);
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
    return getTransport().on(IPC.SETTINGS_UPDATED, handler);
  }, [queryClient]);

  // Start/stop file watcher when project changes
  useEffect(() => {
    if (!projectPath) return;

    typedSend(IPC.START_FILE_WATCHER, { projectPath });

    return () => {
      typedSend(IPC.STOP_FILE_WATCHER);
    };
  }, [projectPath]);

  // Listen for file watcher change events — invalidate tree cache
  useEffect(() => {
    const handler = (_event: unknown, _data: { projectPath: string; event: string; path: string }) => {
      queryClient.invalidateQueries({ queryKey: ['fileTree', projectPath] });
    };
    return getTransport().on(IPC.FILE_TREE_CHANGED, handler);
  }, [queryClient, projectPath]);

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['fileTree', projectPath] });
  }, [queryClient, projectPath]);

  /**
   * Lazy-load children of a directory.
   * Sends LOAD_DIRECTORY_CHILDREN and updates the tree data in cache
   * when DIRECTORY_CHILDREN_DATA is received.
   */
  const loadChildren = useCallback(
    (dirPath: string) => {
      if (!projectPath) return;

      const handler = (_event: unknown, data: { path: string; children: FileTreeNode[] }) => {
        if (data.path !== dirPath) return;
        unsub();

        // Update the cached tree data with the newly loaded children
        queryClient.setQueryData<FileTreeNode[]>(
          ['fileTree', projectPath, showDotfiles],
          (oldData) => {
            if (!oldData) return oldData;
            return updateTreeChildren(oldData, dirPath, data.children);
          }
        );
      };
      const unsub = getTransport().on(IPC.DIRECTORY_CHILDREN_DATA, handler);
      typedSend(IPC.LOAD_DIRECTORY_CHILDREN, { path: dirPath, showDotfiles });
    },
    [projectPath, showDotfiles, queryClient]
  );

  return { ...query, refresh, loadChildren };
}

/**
 * Recursively update a node's children in the tree.
 * Finds the node matching `dirPath` and replaces its children.
 */
function updateTreeChildren(
  nodes: FileTreeNode[],
  dirPath: string,
  children: FileTreeNode[]
): FileTreeNode[] {
  return nodes.map((node) => {
    if (node.path === dirPath) {
      return {
        ...node,
        children,
        childrenLoaded: true,
        hasChildren: children.length > 0,
      };
    }
    if (node.isDirectory && node.children) {
      return {
        ...node,
        children: updateTreeChildren(node.children, dirPath, children),
      };
    }
    return node;
  });
}
