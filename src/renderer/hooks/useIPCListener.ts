/**
 * React hook that listens for main->renderer IPC events
 * and optionally invalidates React Query caches.
 */

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getTransport } from '../lib/transportProvider';

type SharedListener = (event: unknown, data: unknown) => void;

interface ChannelSubscription {
  handlers: Set<SharedListener>;
  unsubscribe: () => void;
}

const channelSubscriptions = new Map<string, ChannelSubscription>();

function subscribeShared(channel: string, handler: SharedListener): () => void {
  let subscription = channelSubscriptions.get(channel);

  if (!subscription) {
    const handlers = new Set<SharedListener>();
    const unsubscribe = getTransport().on(channel, (event: unknown, data: unknown) => {
      const current = channelSubscriptions.get(channel);
      if (!current) return;
      for (const registeredHandler of current.handlers) {
        registeredHandler(event, data);
      }
    });

    subscription = { handlers, unsubscribe };
    channelSubscriptions.set(channel, subscription);
  }

  subscription.handlers.add(handler);

  return () => {
    const current = channelSubscriptions.get(channel);
    if (!current) return;

    current.handlers.delete(handler);
    if (current.handlers.size === 0) {
      current.unsubscribe();
      channelSubscriptions.delete(channel);
    }
  };
}

/**
 * Listen for an IPC event from the main process.
 * When the event fires, invalidates the specified React Query keys.
 *
 * Uses a ref for queryKeysToInvalidate so callers can pass inline array
 * literals without causing the listener to be torn down and re-registered
 * on every render.
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
  // Ref to avoid re-registration when callers pass inline arrays
  const keysRef = useRef(queryKeysToInvalidate);
  keysRef.current = queryKeysToInvalidate;

  useEffect(() => {
    const handler = () => {
      keysRef.current.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });
    };

    return subscribeShared(channel, handler);
  }, [channel, queryClient]);
}

/**
 * Listen for an IPC event and call a custom handler with the payload.
 * Does NOT invalidate queries — use this for event-driven updates.
 *
 * Uses a ref for the handler so callers can pass inline arrow functions
 * without causing the listener to be torn down and re-registered on
 * every render.
 *
 * @param channel - IPC channel to listen on
 * @param handler - Callback receiving the event payload
 */
export function useIPCEvent<T = unknown>(
  channel: string,
  handler: (data: T) => void
): void {
  // Ref to avoid re-registration when callers pass inline handlers
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const wrappedHandler = (_event: unknown, data: T) => {
      handlerRef.current(data);
    };

    return subscribeShared(channel, wrappedHandler as SharedListener);
  }, [channel]);
}
