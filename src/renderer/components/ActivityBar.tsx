/**
 * ActivityBar — Thin bottom bar for centralized activity streams output
 * and output channel viewer.
 * Collapsed: single row showing active stream status + latest log line.
 * Expanded: tabbed view with two modes:
 *   - "Activity" — per-stream output logs with cancel controls
 *   - "Output"   — VS Code-style output channels viewer
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Copy,
  ExternalLink,
  Globe,
  X,
  Check,
  Square,
  Trash2,
  ScrollText,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { useActivity } from '../hooks/useActivity';
import { useIpcQuery } from '../hooks/useIpc';
import { useOutputChannels, useOutputChannelLog, useClearOutputChannel } from '../hooks/useOutputChannels';
import { useUIStore } from '../stores/useUIStore';
import type { ActivityStatus } from '../../shared/activityTypes';
import { IPC } from '../../shared/ipcChannels';
import { typedInvoke } from '../lib/ipc';
import { toast } from 'sonner';

// ─── Types ──────────────────────────────────────────────────────────────────

type BarMode = 'activity' | 'output';

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

// ─── Output Channel Viewer ──────────────────────────────────────────────────

function OutputChannelViewer() {
  const { channels, isLoading } = useOutputChannels();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const clearChannel = useClearOutputChannel();
  const logEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-select the first channel when channels load or selection is stale
  useEffect(() => {
    if (channels.length > 0 && (!selectedId || !channels.find((c) => c.id === selectedId))) {
      setSelectedId(channels[0].id);
    }
  }, [channels, selectedId]);

  const { lines, revision } = useOutputChannelLog(selectedId);

  // Auto-scroll on new lines
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision, lines.length]);

  const handleClear = useCallback(() => {
    if (selectedId) {
      clearChannel.mutate([selectedId]);
    }
  }, [selectedId, clearChannel]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-[11px] text-text-muted">Loading channels...</span>
      </div>
    );
  }

  if (channels.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-[11px] text-text-muted">No output channels</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Channel toolbar */}
      <div className="flex items-center gap-2 px-2 h-7 shrink-0 bg-bg-secondary border-b border-border-subtle">
        <select
          value={selectedId ?? ''}
          onChange={(e) => setSelectedId(e.target.value || null)}
          className="bg-bg-deep border border-border-subtle text-xs text-text-secondary rounded px-1.5 py-0.5 outline-none focus:border-accent max-w-[240px] truncate"
        >
          {channels.map((ch) => (
            <option key={ch.id} value={ch.id}>
              {ch.name} ({ch.lineCount})
            </option>
          ))}
        </select>

        <div className="ml-auto flex items-center">
          <Button
            variant="ghost"
            size="icon-xs"
            className="text-text-muted hover:text-text-primary"
            onClick={handleClear}
            disabled={!selectedId}
            title="Clear channel"
          >
            <Trash2 size={11} />
          </Button>
        </div>
      </div>

      {/* Log area */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2 bg-bg-deep">
          {lines.length === 0 ? (
            <div className="flex items-center justify-center h-full py-8">
              <span className="text-[11px] text-text-muted">No output</span>
            </div>
          ) : (
            lines.map((line, i) => (
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
  );
}

// ─── Mode Toggle Pills ─────────────────────────────────────────────────────

function ModeToggle({
  mode,
  onChange,
}: {
  mode: BarMode;
  onChange: (mode: BarMode) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 mr-2">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onChange('activity'); }}
        className={cn(
          'px-2 py-0.5 rounded text-[10px] transition-colors',
          mode === 'activity'
            ? 'bg-accent/20 text-accent'
            : 'text-text-muted hover:text-text-secondary'
        )}
      >
        Activity
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onChange('output'); }}
        className={cn(
          'px-2 py-0.5 rounded text-[10px] transition-colors',
          mode === 'output'
            ? 'bg-accent/20 text-accent'
            : 'text-text-muted hover:text-text-secondary'
        )}
      >
        Output
      </button>
    </div>
  );
}

// ─── ActivityBar ─────────────────────────────────────────────────────────────

export function ActivityBar() {
  const { streams, activeStream, outputLogs, cancelStream, clearStream, clearAllFinished, revision } = useActivity();
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen);
  const [expanded, setExpanded] = useState(false);
  const [selectedStreamId, setSelectedStreamId] = useState<string | null>(null);
  const [mode, setMode] = useState<BarMode>('activity');
  const [showOutputPanel, setShowOutputPanel] = useState(false);
  const logEndRef = useRef<HTMLDivElement | null>(null);
  const { data: webServerInfo } = useIpcQuery(IPC.WEB_SERVER_INFO, [], {
    staleTime: 5_000,
    refetchInterval: 5_000,
  });
  const webStatus = useMemo(() => {
    if (!webServerInfo) {
      return null;
    }
    if (webServerInfo.lastStartError) {
      return {
        label: 'Web Error',
        className: 'bg-error/15 text-error hover:text-error',
        title: webServerInfo.lastStartError,
      };
    }
    if (webServerInfo.clientConnected) {
      return {
        label: 'Web Live',
        className: 'bg-accent/20 text-accent',
        title: `Remote client connected via ${webServerInfo.lanMode ? 'LAN' : 'local-only'} mode`,
      };
    }
    if (webServerInfo.enabled) {
      return {
        label: 'Web Ready',
        className: 'bg-bg-tertiary text-text-secondary hover:text-text-primary',
        title: `Server running on port ${webServerInfo.port}${webServerInfo.startOnLaunch ? ' • starts on launch' : ''}`,
      };
    }
    return {
      label: 'Web Off',
      className: 'bg-bg-tertiary/70 text-text-muted hover:text-text-secondary',
      title: webServerInfo.startOnLaunch
        ? 'Server is off for this session but will start on launch'
        : 'Server is off. Start it here or from Settings.',
    };
  }, [webServerInfo]);
  const webServerBaseUrl = webServerInfo?.enabled && webServerInfo.port
    ? `http://${webServerInfo.lanMode && webServerInfo.lanIp ? webServerInfo.lanIp : 'localhost'}:${webServerInfo.port}`
    : '';
  const webServerConnectionUrl = webServerInfo?.enabled && webServerInfo.port && webServerInfo.token
    ? `${webServerBaseUrl}/?token=${webServerInfo.token}`
    : '';

  const copyToClipboard = useCallback(async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error(`Failed to copy ${label.toLowerCase()}`);
    }
  }, []);

  const toggleWebServer = useCallback(async () => {
    if (!webServerInfo) return;
    try {
      await typedInvoke(IPC.WEB_SERVER_TOGGLE, !webServerInfo.enabled);
      toast.success(!webServerInfo.enabled ? 'SubFrame Server started' : 'SubFrame Server stopped');
    } catch {
      toast.error(!webServerInfo.enabled ? 'Failed to start SubFrame Server' : 'Failed to stop SubFrame Server');
    }
  }, [webServerInfo]);

  // Listen for external toggle from StatusBar
  useEffect(() => {
    const handler = () => {
      setShowOutputPanel((prev) => {
        const next = !prev;
        if (next) {
          // Opening: show the bar expanded with output mode if no streams
          setExpanded(true);
          if (streams.length === 0) {
            setMode('output');
          }
        } else {
          // Closing: collapse if no streams to keep visible
          if (streams.length === 0) {
            setExpanded(false);
          }
        }
        return next;
      });
    };
    window.addEventListener('toggle-activity-bar', handler);
    return () => window.removeEventListener('toggle-activity-bar', handler);
  }, [streams.length]);

  // Auto-select the active stream when it changes
  useEffect(() => {
    if (activeStream && !selectedStreamId) {
      setSelectedStreamId(activeStream.id);
    }
  }, [activeStream, selectedStreamId]);

  // When a new running stream appears, switch to it and activate Activity mode
  useEffect(() => {
    if (activeStream?.status === 'running') {
      setSelectedStreamId(activeStream.id);
      setMode('activity');
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
    if (expanded && mode === 'activity' && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logLines.length, expanded, mode]);

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

  // Don't render if there are no streams and output panel is not requested
  if (streams.length === 0 && !showOutputPanel) {
    return null;
  }

  const runningCount = streams.filter((s) => s.status === 'running').length;
  const hasStreams = streams.length > 0;

  return (
    <div className="flex flex-col border-t border-border-subtle bg-bg-primary shrink-0">
      {/* ── Collapsed / Header Bar ────────────────────────────────────────── */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setExpanded((v) => !v); }}
        className="flex items-center gap-2 h-6 px-2 hover:bg-bg-hover transition-colors cursor-pointer select-none w-full text-left"
      >
        {/* Left: icon + mode toggle (when expanded) + stream name + status */}
        {mode === 'output' && !hasStreams ? (
          <ScrollText size={12} className="text-text-tertiary shrink-0" />
        ) : (
          <Activity size={12} className="text-text-tertiary shrink-0" />
        )}

        {expanded && (
          <ModeToggle mode={mode} onChange={setMode} />
        )}

        {mode === 'activity' && activeStream && (
          <>
            <StatusDot status={activeStream.status} />
            <span className="text-[11px] text-text-secondary truncate max-w-[160px]">
              {activeStream.name}
            </span>
          </>
        )}

        {mode === 'output' && !activeStream && (
          <span className="text-[11px] text-text-secondary truncate">
            Output Channels
          </span>
        )}

        {/* Center: latest log line (activity mode only) */}
        {mode === 'activity' && latestLine && (
          <span className="flex-1 min-w-0 text-[10px] font-mono text-text-muted truncate mx-2">
            {latestLine}
          </span>
        )}
        {(mode === 'output' || !latestLine) && <span className="flex-1" />}

        {/* Right: elapsed + stream count + toggle */}
        <span className="flex items-center gap-1.5 shrink-0">
          {webStatus && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[9px] font-medium transition-colors',
                    webStatus.className,
                  )}
                  title={webStatus.title}
                >
                  <Globe size={10} />
                  <span>{webStatus.label}</span>
                  <ChevronsUpDown size={9} className="opacity-70" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[220px]">
                <DropdownMenuItem
                  onClick={toggleWebServer}
                  className="text-xs cursor-pointer"
                >
                  <Globe className="w-3.5 h-3.5" />
                  {webServerInfo?.enabled ? 'Stop SubFrame Server' : 'Start SubFrame Server'}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setSettingsOpen(true)}
                  className="text-xs cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open Server Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => copyToClipboard(webServerBaseUrl, 'Base URL')}
                  disabled={!webServerBaseUrl}
                  className="text-xs cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copy Base URL
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => copyToClipboard(webServerConnectionUrl, 'Connection URL')}
                  disabled={!webServerConnectionUrl}
                  className="text-xs cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copy Connection URL
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {mode === 'activity' && elapsed && (
            <span className="text-[10px] text-accent tabular-nums">
              {elapsed}
            </span>
          )}
          {mode === 'activity' && streams.length > 1 && (
            <span className="text-[9px] bg-bg-tertiary text-text-tertiary rounded-full px-1.5 py-px">
              {runningCount > 0 ? `${runningCount} running` : `${streams.length}`}
            </span>
          )}
          {mode === 'activity' && runningCount === 0 && hasStreams && (
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
      </div>

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
            {mode === 'activity' ? (
              /* ── Activity Streams View ──────────────────────────────────── */
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
                    {hasStreams ? (
                      logLines.length === 0 ? (
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
                      )
                    ) : (
                      <div className="flex items-center justify-center h-full py-8">
                        <span className="text-[11px] text-text-muted">
                          No activity streams
                        </span>
                      </div>
                    )}
                    <div ref={logEndRef} />
                  </div>
                </ScrollArea>
              </div>
            ) : (
              /* ── Output Channels View ──────────────────────────────────── */
              <div className="h-[200px]">
                <OutputChannelViewer />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
