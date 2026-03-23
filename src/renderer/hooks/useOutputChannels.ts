/**
 * TanStack Query hooks for Output Channels.
 */

import { useRef, useState, useCallback } from 'react';
import { useIpcQuery, useIpcMutation } from './useIpc';
import { useIPCListener, useIPCEvent } from './useIPCListener';
import { IPC } from '../../shared/ipcChannels';
import type { OutputChannelEvent } from '../../shared/activityTypes';

export function useOutputChannels() {
  const query = useIpcQuery(IPC.OUTPUT_CHANNEL_LIST, []);

  // Refetch channel list when any channel updates
  useIPCListener(IPC.OUTPUT_CHANNEL_UPDATED, [[IPC.OUTPUT_CHANNEL_LIST]]);

  return {
    channels: query.data?.channels ?? [],
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

export function useOutputChannelLog(channelId: string | null) {
  const query = useIpcQuery(
    IPC.OUTPUT_CHANNEL_LOG,
    [channelId ?? ''],
    { enabled: !!channelId }
  );

  // Accumulate real-time lines in a ref for performance
  const linesRef = useRef<string[]>([]);
  const [revision, setRevision] = useState(0);
  const initRef = useRef<string | null>(null);

  // Sync initial load when channel changes or data arrives
  if (query.data?.lines && initRef.current !== channelId) {
    linesRef.current = [...query.data.lines];
    initRef.current = channelId;
  }

  // Listen for new output lines
  useIPCEvent<OutputChannelEvent>(IPC.OUTPUT_CHANNEL_OUTPUT, useCallback((event: OutputChannelEvent) => {
    if (event.channelId === channelId) {
      linesRef.current.push(...event.lines);
      setRevision((r) => r + 1);
    }
  }, [channelId]));

  const refetch = useCallback(() => {
    linesRef.current = [];
    initRef.current = null;
    query.refetch();
  }, [query]);

  return {
    lines: linesRef.current,
    revision,
    isLoading: query.isLoading,
    refetch,
  };
}

export function useClearOutputChannel() {
  return useIpcMutation(IPC.OUTPUT_CHANNEL_CLEAR);
}
