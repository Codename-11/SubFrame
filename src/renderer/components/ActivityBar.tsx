/**
 * ActivityBar — Thin bottom bar for centralized activity streams output.
 * Collapsed: single row showing active stream status + latest log line.
 * Expanded: tabbed log viewer with per-stream output and cancel controls.
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  ChevronUp,
  ChevronDown,
  X,
  Check,
  Square,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { useActivity } from '../hooks/useActivity';
import type { ActivityStatus } from '../../shared/activityTypes';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Format milliseconds to a compact duration string */
function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

/** Live elapsed-time hook for running streams */
function useElapsedTime(startedAt: string | null | undefined, isRunning: boolean): string | null {
  const [elapsed, setElapsed] = useState<string | null>(null);

  useEffect(() => {
    if (!isRunning || !startedAt) {
      setElapsed(null);
      return;
    }
    const update = () => {
      const ms = Date.now() - new Date(startedAt).getTime();
      setElapsed(formatElapsed(ms));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [startedAt, isRunning]);

  return elapsed;
}

// ─── Status Indicator ────────────────────────────────────────────────────────

function StatusDot({ status }: { status: ActivityStatus }) {
  if (status === 'running') {
    return (
      <span className="relative flex size-2.5">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-75" />
        <span className="relative inline-flex size-2.5 rounded-full bg-accent" />
      </span>
    );
  }
  if (status === 'completed') {
    return (
      <span className="flex size-3.5 items-center justify-center rounded-full bg-success">
        <Check size={8} className="text-bg-deep" strokeWidth={3} />
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="flex size-3.5 items-center justify-center rounded-full bg-error">
        <X size={8} className="text-bg-deep" strokeWidth={3} />
      </span>
    );
  }
  if (status === 'cancelled') {
    return <span className="size-2.5 rounded-full bg-text-muted" />;
  }
  // pending
  return <span className="size-2.5 rounded-full border border-border-default" />;
}

// ─── ActivityBar ─────────────────────────────────────────────────────────────

export function ActivityBar() {
  const { streams, activeStream, outputLogs, cancelStream, clearStream, clearAllFinished, revision } = useActivity();
  const [expanded, setExpanded] = useState(false);
  const [selectedStreamId, setSelectedStreamId] = useState<string | null>(null);
  const logEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-select the active stream when it changes
  useEffect(() => {
    if (activeStream && !selectedStreamId) {
      setSelectedStreamId(activeStream.id);
    }
  }, [activeStream, selectedStreamId]);

  // When a new running stream appears, switch to it
  useEffect(() => {
    if (activeStream?.status === 'running') {
      setSelectedStreamId(activeStream.id);
    }
  }, [activeStream?.id, activeStream?.status]);

  // Clear stale selectedStreamId when the stream is removed from the list
  useEffect(() => {
    if (selectedStreamId && !streams.find((s) => s.id === selectedStreamId)) {
      setSelectedStreamId(null);
    }
  }, [streams, selectedStreamId]);

  // Determine the stream to display in expanded log view
  const displayStream = useMemo(() => {
    if (selectedStreamId) {
      return streams.find((s) => s.id === selectedStreamId) ?? activeStream;
    }
    return activeStream;
  }, [selectedStreamId, streams, activeStream]);

  // Get log lines for displayed stream
  const logLines = useMemo(() => {
    if (!displayStream) return [];
    return outputLogs[displayStream.id] ?? displayStream.outputTail ?? [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayStream?.id, outputLogs, revision]);

  // Auto-scroll to bottom when new log lines arrive
  useEffect(() => {
    if (expanded && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logLines.length, expanded]);

  // Elapsed time for the active stream
  const elapsed = useElapsedTime(
    activeStream?.startedAt ?? null,
    activeStream?.status === 'running'
  );

  // Latest log line for collapsed view
  const latestLine = useMemo(() => {
    if (!activeStream) return null;
    const streamLogs = outputLogs[activeStream.id];
    if (streamLogs && streamLogs.length > 0) {
      return streamLogs[streamLogs.length - 1];
    }
    if (activeStream.outputTail && activeStream.outputTail.length > 0) {
      return activeStream.outputTail[activeStream.outputTail.length - 1];
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStream?.id, outputLogs, revision]);

  // Don't render if there are no streams
  if (streams.length === 0) {
    return null;
  }

  const runningCount = streams.filter((s) => s.status === 'running').length;

  return (
    <div className="flex flex-col border-t border-border-subtle bg-bg-primary shrink-0">
      {/* ── Collapsed / Header Bar ────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 h-6 px-2 hover:bg-bg-hover transition-colors cursor-pointer select-none w-full text-left"
      >
        {/* Left: icon + stream name + status */}
        <Activity size={12} className="text-text-tertiary shrink-0" />
        {activeStream && (
          <>
            <StatusDot status={activeStream.status} />
            <span className="text-[11px] text-text-secondary truncate max-w-[160px]">
              {activeStream.name}
            </span>
          </>
        )}

        {/* Center: latest log line */}
        {latestLine && (
          <span className="flex-1 min-w-0 text-[10px] font-mono text-text-muted truncate mx-2">
            {latestLine}
          </span>
        )}
        {!latestLine && <span className="flex-1" />}

        {/* Right: elapsed + stream count + toggle */}
        <span className="flex items-center gap-1.5 shrink-0">
          {elapsed && (
            <span className="text-[10px] text-accent tabular-nums">
              {elapsed}
            </span>
          )}
          {streams.length > 1 && (
            <span className="text-[9px] bg-bg-tertiary text-text-tertiary rounded-full px-1.5 py-px">
              {runningCount > 0 ? `${runningCount} running` : `${streams.length}`}
            </span>
          )}
          {runningCount === 0 && (
            <span
              role="button"
              onClick={(e) => { e.stopPropagation(); clearAllFinished(); }}
              className="p-0.5 text-text-muted hover:text-text-primary transition-colors"
              title="Dismiss all"
            >
              <X size={10} />
            </span>
          )}
          {expanded ? (
            <ChevronDown size={12} className="text-text-tertiary" />
          ) : (
            <ChevronUp size={12} className="text-text-tertiary" />
          )}
        </span>
      </button>

      {/* ── Expanded Panel ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 200, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden border-t border-border-subtle"
          >
            <div className="flex flex-col h-[200px]">
              {/* Tab row */}
              <div className="flex items-center gap-px px-1 h-7 shrink-0 bg-bg-secondary overflow-x-auto">
                {streams.map((stream) => (
                  <div key={stream.id} className="flex items-center group">
                    <button
                      type="button"
                      onClick={() => setSelectedStreamId(stream.id)}
                      className={cn(
                        'flex items-center gap-1.5 px-2 py-1 rounded-sm text-[11px] whitespace-nowrap transition-colors',
                        displayStream?.id === stream.id
                          ? 'bg-bg-primary text-accent'
                          : 'text-text-tertiary hover:text-text-secondary hover:bg-bg-hover'
                      )}
                    >
                      <StatusDot status={stream.status} />
                      <span className="truncate max-w-[120px]">{stream.name}</span>
                    </button>
                    {stream.status !== 'running' && stream.status !== 'pending' && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); clearStream(stream.id); }}
                        className="p-0.5 opacity-0 group-hover:opacity-100 text-text-muted hover:text-text-primary transition-opacity"
                        title="Dismiss"
                      >
                        <X size={10} />
                      </button>
                    )}
                  </div>
                ))}

                <div className="ml-auto flex items-center gap-0.5 shrink-0">
                  {/* Cancel button for running streams */}
                  {displayStream?.status === 'running' && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="text-text-muted hover:text-error"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (displayStream) {
                          cancelStream.mutate(displayStream.id);
                        }
                      }}
                      title="Cancel stream"
                    >
                      <Square size={10} />
                    </Button>
                  )}
                  {/* Clear all finished streams */}
                  {streams.some((s) => s.status !== 'running' && s.status !== 'pending') && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="text-text-muted hover:text-text-primary"
                      onClick={clearAllFinished}
                      title="Clear finished"
                    >
                      <X size={10} />
                    </Button>
                  )}
                </div>
              </div>

              {/* Log area */}
              <ScrollArea className="flex-1 min-h-0">
                <div className="p-2 bg-bg-deep">
                  {logLines.length === 0 ? (
                    <div className="flex items-center justify-center h-full py-8">
                      <span className="text-[11px] text-text-muted">
                        {displayStream?.status === 'pending'
                          ? 'Waiting to start...'
                          : 'No output yet'}
                      </span>
                    </div>
                  ) : (
                    logLines.map((line, i) => (
                      <div
                        key={i}
                        className="text-[11px] font-mono text-text-secondary leading-[1.6] break-all"
                      >
                        {line || '\u00A0'}
                      </div>
                    ))
                  )}
                  <div ref={logEndRef} />
                </div>
              </ScrollArea>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
