/**
 * TanStack Query hook for activity streams.
 * Wraps ACTIVITY_LIST (invoke) + ACTIVITY_STATUS / ACTIVITY_OUTPUT (events).
 */

import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useIpcQuery } from './useIpc';
import { useIPCEvent } from './useIPCListener';
import { typedInvoke, typedSend } from '../lib/ipc';
import { IPC } from '../../shared/ipcChannels';
import type { ActivityListPayload, ActivityStatusEvent, ActivityOutputEvent, ActivityStream } from '../../shared/activityTypes';

function isDiagnosticLine(line: string): boolean {
  return /^\[Heartbeat\]\b/.test(line) || /^Waiting for AI output\.\.\./.test(line);
}

/**
 * Hook that provides activity stream state, real-time output logs, and cancel mutation.
 */
export function useActivity() {
  // ─── Initial stream list via invoke ────────────────────────────────────────
  const query = useIpcQuery(IPC.ACTIVITY_LIST, [], {
    staleTime: 30_000,
  });

  // Local copy of streams that gets patched by status events for real-time updates
  const [localStreams, setLocalStreams] = useState<ActivityStream[]>([]);
  const localStreamsInitialised = useRef(false);

  // Sync initial query data into local state (once)
  useEffect(() => {
    if (query.data && !localStreamsInitialised.current) {
      localStreamsInitialised.current = true;
      setLocalStreams(query.data.streams ?? []);
    }
  }, [query.data]);

  // ─── Real-time status events ───────────────────────────────────────────────
  const handleStatus = useCallback((event: ActivityStatusEvent) => {
    setLocalStreams((prev) => {
      const idx = prev.findIndex((s) => s.id === event.stream.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = event.stream;
        return updated;
      }
      // New stream — prepend
      return [event.stream, ...prev];
    });
  }, []);

  useIPCEvent<ActivityStatusEvent>(IPC.ACTIVITY_STATUS, handleStatus);

  // ─── Output log accumulation (ref-based, like usePipelineProgress) ─────────
  const logsRef = useRef<Record<string, string[]>>({});
  const [revision, setRevision] = useState(0);

  const handleOutput = useCallback((event: ActivityOutputEvent) => {
    const { streamId, lines } = event;
    const visibleLines = lines.filter((line) => !isDiagnosticLine(line));
    if (visibleLines.length === 0) {
      return;
    }
    if (!logsRef.current[streamId]) {
      logsRef.current[streamId] = [];
    }
    logsRef.current[streamId].push(...visibleLines);
    setRevision((r) => r + 1);
  }, []);

  useIPCEvent<ActivityOutputEvent>(IPC.ACTIVITY_OUTPUT, handleOutput);

  // ─── Cancel mutation ───────────────────────────────────────────────────────
  const cancelMutation = useMutation({
    mutationFn: (streamId: string) => typedInvoke(IPC.ACTIVITY_CANCEL, streamId),
  });

  const cancelMutateRef = useRef(cancelMutation.mutate);
  cancelMutateRef.current = cancelMutation.mutate;

  const stableCancelStream = useMemo(() => ({
    mutate: (...args: Parameters<typeof cancelMutation.mutate>) => cancelMutateRef.current(...args),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  // ─── Derived: active stream ────────────────────────────────────────────────
  const streams = localStreams;

  const activeStream = useMemo(() => {
    // Prefer the most recent running stream
    const running = streams.find((s) => s.status === 'running');
    if (running) return running;
    // Fall back to the most recent completed/failed stream (first in list, assuming newest-first)
    return streams[0] ?? null;
  }, [streams]);

  // ─── Clear (dismiss) finished streams ─────────────────────────────────────
  const clearStream = useCallback((streamId: string) => {
    typedSend(IPC.ACTIVITY_CLEAR, streamId);
    setLocalStreams((prev) => prev.filter((s) => s.id !== streamId));
    delete logsRef.current[streamId];
  }, []);

  const clearAllFinished = useCallback(() => {
    const finished = streams.filter((s) => s.status !== 'running' && s.status !== 'pending');
    for (const s of finished) {
      typedSend(IPC.ACTIVITY_CLEAR, s.id);
      delete logsRef.current[s.id];
    }
    setLocalStreams((prev) => prev.filter((s) => s.status === 'running' || s.status === 'pending'));
  }, [streams]);

  return {
    /** All active + recent streams */
    streams,
    /** The most relevant stream (running preferred, else most recent) */
    activeStream,
    /** Per-stream output logs keyed by streamId */
    outputLogs: logsRef.current,
    /** Mutation to cancel a running stream */
    cancelStream: stableCancelStream,
    /** Dismiss a finished stream from the bar */
    clearStream,
    /** Dismiss all finished streams */
    clearAllFinished,
    /** Revision counter — increments on each output event for re-render triggers */
    revision,
  };
}
