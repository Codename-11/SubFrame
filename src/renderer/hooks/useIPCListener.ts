/**
 * React hook that listens for main->renderer IPC events
 * and optionally invalidates React Query caches.
 */

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getTransport } from '../lib/transportProvider';

/**
 * Listen for an IPC event from the main process.
 * When the event fires, invalidates the specified React Query keys.
 *
 * @param channel - IPC channel to listen on
 * @param queryKeysToInvalidate - Array of query key arrays to invalidate
 *
 * @example
 * ```tsx
 * // Invalidate tasks query when tasks data changes
 * useIPCListener('tasks-data', [['load-tasks']]);
 * ```
 */
export function useIPCListener(
  channel: string,
  queryKeysToInvalidate: string[][]
): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const handler = () => {
      queryKeysToInvalidate.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });
    };

    return getTransport().on(channel, handler);
  }, [channel, queryClient, queryKeysToInvalidate]);
}

/**
 * Listen for an IPC event and call a custom handler with the payload.
 * Does NOT invalidate queries — use this for event-driven updates.
 *
 * @param channel - IPC channel to listen on
 * @param handler - Callback receiving the event payload
 */
export function useIPCEvent<T = unknown>(
  channel: string,
  handler: (data: T) => void
): void {
  useEffect(() => {
    const wrappedHandler = (_event: unknown, data: T) => {
      handler(data);
    };

    return getTransport().on(channel, wrappedHandler);
  }, [channel, handler]);
}
