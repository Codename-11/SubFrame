/**
 * React Query hook for typed IPC invoke calls.
 * Wraps ipcRenderer.invoke with TanStack React Query for caching and refetching.
 */

import { useQuery, useMutation, type UseQueryOptions, type UseMutationOptions } from '@tanstack/react-query';
import { typedInvoke } from '../lib/ipc';
import type { IPCHandleMap } from '../../shared/ipcChannels';

/**
 * Use an IPC handle channel as a React Query.
 * Automatically creates a queryKey from the channel + args.
 */
export function useIpcQuery<K extends keyof IPCHandleMap>(
  channel: K,
  args: IPCHandleMap[K]['args'],
  options?: Omit<UseQueryOptions<IPCHandleMap[K]['return'], Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery<IPCHandleMap[K]['return'], Error>({
    queryKey: [channel, ...args],
    queryFn: () => typedInvoke(channel, ...args),
    ...options,
  });
}

/**
 * Use an IPC handle channel as a React Query mutation.
 * Useful for write operations like UPDATE_SETTING, SET_AI_TOOL, etc.
 */
export function useIpcMutation<K extends keyof IPCHandleMap>(
  channel: K,
  options?: Omit<UseMutationOptions<IPCHandleMap[K]['return'], Error, IPCHandleMap[K]['args']>, 'mutationFn'>
) {
  return useMutation<IPCHandleMap[K]['return'], Error, IPCHandleMap[K]['args']>({
    mutationFn: (args: IPCHandleMap[K]['args']) => typedInvoke(channel, ...args),
    ...options,
  });
}
