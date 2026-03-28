import { useEffect, useMemo, useState } from 'react';
import { Bot, ExternalLink, RefreshCw, TerminalSquare } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { TerminalMirror } from './TerminalMirror';
import { cn } from '../lib/utils';
import { useAISessions } from '../hooks/useAISessions';
import { useTerminalStore } from '../stores/useTerminalStore';
import { useUIStore } from '../stores/useUIStore';
import { focusActivityBar } from '../lib/activityBarEvents';
import * as terminalRegistry from '../lib/terminalRegistry';
import type { AISessionSummary } from '../../shared/ipcChannels';

const STATUS_BADGE: Record<AISessionSummary['status'], string> = {
  starting: 'bg-amber-950/70 text-amber-300 border-amber-700/50',
  running: 'bg-emerald-950/70 text-emerald-300 border-emerald-700/50',
  completed: 'bg-zinc-800 text-zinc-200 border-border-subtle',
  failed: 'bg-rose-950/70 text-rose-300 border-rose-700/50',
  cancelled: 'bg-zinc-800 text-zinc-300 border-border-subtle',
};

function SessionRow({
  session,
  selected,
  onSelect,
}: {
  session: AISessionSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full rounded-lg border px-3 py-2.5 text-left transition-colors',
        selected
          ? 'border-accent bg-accent/10'
          : 'border-border-subtle bg-bg-secondary/50 hover:bg-bg-hover/40',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-xs font-medium text-text-primary">{session.name}</div>
          <div className="mt-1 flex items-center gap-1.5 text-[10px] text-text-tertiary">
            <span className="uppercase tracking-wide">{session.toolId}</span>
            <span className="text-text-muted">•</span>
            <span className="capitalize">{session.source}</span>
          </div>
        </div>
        <Badge variant="outline" className={cn('text-[10px] capitalize', STATUS_BADGE[session.status])}>
          {session.status}
        </Badge>
      </div>
      {session.error && (
        <div className="mt-2 line-clamp-2 text-[10px] text-rose-300/90">
          {session.error}
        </div>
      )}
    </button>
  );
}

export function AISessionsPanel() {
  const { sessions, isLoading, refetch } = useAISessions();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const setActiveTerminal = useTerminalStore((s) => s.setActiveTerminal);
  const setFullViewContent = useUIStore((s) => s.setFullViewContent);

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) ?? sessions[0] ?? null,
    [selectedSessionId, sessions],
  );

  useEffect(() => {
    if (selectedSessionId && sessions.some((session) => session.id === selectedSessionId)) {
      return;
    }
    setSelectedSessionId(sessions[0]?.id ?? null);
  }, [selectedSessionId, sessions]);

  const openTerminal = (session: AISessionSummary) => {
    setActiveTerminal(session.terminalId);
    setFullViewContent(null);
    setTimeout(() => {
      const instance = terminalRegistry.get(session.terminalId);
      instance?.terminal.focus();
    }, 50);
  };

  if (isLoading && sessions.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-text-tertiary">
        Loading AI sessions...
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-text-tertiary">
        <Bot className="h-6 w-6 opacity-40" />
        <div className="text-xs">No live AI sessions</div>
        <div className="text-[10px] opacity-60">Onboarding, task enhancement, and pipeline AI runs appear here while active.</div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-border-subtle px-3 py-2">
        <span className="text-xs text-text-secondary">
          {sessions.length} live session{sessions.length !== 1 ? 's' : ''}
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => { void refetch(); }}
          className="h-7 px-2"
        >
          <RefreshCw size={14} />
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(180px,220px)_1fr]">
        <ScrollArea className="border-b border-border-subtle">
          <div className="space-y-2 p-3">
            {sessions.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                selected={session.id === selectedSession?.id}
                onSelect={() => setSelectedSessionId(session.id)}
              />
            ))}
          </div>
        </ScrollArea>

        {selectedSession ? (
          <div className="flex min-h-0 flex-col">
            <div className="flex items-center justify-between gap-2 border-b border-border-subtle px-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-xs font-medium text-text-primary">{selectedSession.name}</div>
                <div className="mt-0.5 text-[10px] text-text-tertiary">
                  {selectedSession.toolId} • {selectedSession.source}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {selectedSession.activityStreamId && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => focusActivityBar({ mode: 'activity', streamId: selectedSession.activityStreamId })}
                    className="h-7 px-2 text-xs"
                  >
                    <ExternalLink size={13} className="mr-1" />
                    Activity
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => openTerminal(selectedSession)}
                  className="h-7 px-2 text-xs"
                >
                  <TerminalSquare size={13} className="mr-1" />
                  Open
                </Button>
              </div>
            </div>
            <div className="min-h-0 flex-1 bg-[#0f0f13]">
              <TerminalMirror
                terminalId={selectedSession.terminalId}
                interactive={selectedSession.status === 'running'}
                autoFocus={selectedSession.status === 'running'}
                className="h-full w-full"
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
