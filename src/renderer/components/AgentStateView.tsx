/**
 * AgentStateView — Main agent state visualization component.
 * Panel mode: compact active session view.
 * Full-view mode: session list + selected session timeline.
 */

import { useState, useMemo } from 'react';
import { Activity } from 'lucide-react';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { cn } from '../lib/utils';
import { useAgentState } from '../hooks/useAgentState';
import { AgentTimeline } from './AgentTimeline';
import type { AgentSession, AgentSessionStatus } from '../../shared/agentStateTypes';

interface AgentStateViewProps {
  isFullView?: boolean;
}

const STATUS_STYLES: Record<AgentSessionStatus, string> = {
  active: 'bg-emerald-900/60 text-emerald-300',
  busy: 'bg-amber-900/60 text-amber-300',
  idle: 'bg-zinc-600 text-zinc-200',
  completed: 'bg-zinc-700 text-zinc-300',
};

const STATUS_DOT: Record<AgentSessionStatus, string> = {
  active: 'bg-success',
  busy: 'bg-warning',
  idle: 'bg-text-muted',
  completed: 'bg-text-tertiary',
};

function SessionCard({ session }: { session: AgentSession }) {
  return (
    <div className="bg-bg-secondary rounded-lg border border-border-subtle p-3 min-w-0">
      <div className="flex items-center justify-between gap-2 min-w-0">
        <span className="text-xs font-medium text-text-primary truncate min-w-0">
          {session.agentName || 'Claude'}
        </span>
        <Badge
          variant="secondary"
          className={cn('text-[10px] capitalize', STATUS_STYLES[session.status])}
        >
          {session.status}
        </Badge>
      </div>
      {session.currentTool && (
        <div className="mt-1.5 min-w-0">
          <span className="bg-accent-subtle text-accent text-[10px] px-1.5 py-0.5 rounded truncate inline-block max-w-full">
            {session.currentTool}
          </span>
        </div>
      )}
      <div className="mt-1.5 text-[10px] text-text-tertiary flex items-center min-w-0">
        <span className="shrink-0">{session.steps.length} step{session.steps.length !== 1 ? 's' : ''}</span>
        {session.currentTask && (
          <span className="ml-2 text-text-muted truncate min-w-0">{session.currentTask}</span>
        )}
      </div>
    </div>
  );
}

function SessionListItem({
  session,
  isSelected,
  onClick,
}: {
  session: AgentSession;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-3 py-2 transition-colors cursor-pointer',
        isSelected ? 'bg-bg-hover/50 border-l-2 border-accent' : 'hover:bg-bg-hover/30 border-l-2 border-transparent',
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className={cn('w-2 h-2 rounded-full shrink-0', STATUS_DOT[session.status])} />
        <span className="text-xs font-medium text-text-primary truncate min-w-0 flex-1">
          {session.agentName || 'Claude'}
        </span>
        <span className="text-[10px] text-text-muted ml-auto shrink-0">
          {session.steps.length}
        </span>
      </div>
      {session.currentTool && (
        <div className="mt-0.5 ml-4 text-[10px] text-text-tertiary truncate min-w-0">
          {session.currentTool}
        </div>
      )}
    </button>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2 text-text-tertiary">
      <Activity size={24} className="opacity-40" />
      <span className="text-xs">No active agent sessions</span>
      <span className="text-[10px] opacity-60">Start an AI tool to see agent activity here</span>
    </div>
  );
}

export function AgentStateView({ isFullView = false }: AgentStateViewProps) {
  const { sessions, activeSession, isLoading } = useAgentState();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // In full-view, resolve the selected session (fallback to active)
  const selectedSession = useMemo<AgentSession | null>(() => {
    if (!isFullView) return activeSession;
    if (selectedSessionId) {
      const found = sessions.find((s) => s.sessionId === selectedSessionId);
      if (found) return found;
    }
    return activeSession ?? sessions[0] ?? null;
  }, [isFullView, sessions, selectedSessionId, activeSession]);

  // ── Panel mode (sidebar right panel) ──────────────────────────────────────
  if (!isFullView) {
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle shrink-0">
          <span className="text-xs font-medium text-text-secondary">Agent Activity</span>
          {activeSession && (
            <Badge
              variant="secondary"
              className={cn('text-[10px] capitalize', STATUS_STYLES[activeSession.status])}
            >
              {activeSession.status}
            </Badge>
          )}
        </div>

        <ScrollArea className="flex-1 min-h-0">
          {isLoading && sessions.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-text-tertiary text-sm">
              Loading...
            </div>
          ) : sessions.length === 0 ? (
            <div className="p-4">
              <EmptyState />
            </div>
          ) : (
            <div className="p-3 flex flex-col gap-3">
              {activeSession && <SessionCard session={activeSession} />}
              {activeSession && activeSession.steps.length > 0 && (
                <>
                  <Separator className="bg-border-subtle" />
                  <AgentTimeline steps={activeSession.steps} compact />
                </>
              )}
            </div>
          )}
        </ScrollArea>
      </div>
    );
  }

  // ── Full-view mode (TerminalArea overlay) ─────────────────────────────────
  return (
    <div className="flex h-full">
      {/* Session list (left) */}
      <div className="w-[250px] border-r border-border-subtle flex flex-col shrink-0">
        <div className="px-3 py-2 border-b border-border-subtle shrink-0">
          <span className="text-xs font-medium text-text-secondary">
            {sessions.length} session{sessions.length !== 1 ? 's' : ''}
          </span>
        </div>
        <ScrollArea className="flex-1 min-h-0">
          {sessions.length === 0 ? (
            <div className="p-4">
              <EmptyState />
            </div>
          ) : (
            <div className="flex flex-col">
              {sessions.map((s) => (
                <SessionListItem
                  key={s.sessionId}
                  session={s}
                  isSelected={selectedSession?.sessionId === s.sessionId}
                  onClick={() => setSelectedSessionId(s.sessionId)}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Selected session detail (right) */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedSession ? (
          <>
            <div className="flex items-center justify-between px-4 py-2 border-b border-border-subtle shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-medium text-text-primary truncate">
                  {selectedSession.agentName || 'Claude'}
                </span>
                <Badge
                  variant="secondary"
                  className={cn('text-[10px] capitalize', STATUS_STYLES[selectedSession.status])}
                >
                  {selectedSession.status}
                </Badge>
                {selectedSession.currentTool && (
                  <span className="bg-accent-subtle text-accent text-[10px] px-1.5 py-0.5 rounded">
                    {selectedSession.currentTool}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-text-muted shrink-0">
                {selectedSession.steps.length} step{selectedSession.steps.length !== 1 ? 's' : ''}
              </span>
            </div>
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-4">
                <AgentTimeline steps={selectedSession.steps} />
              </div>
            </ScrollArea>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState />
          </div>
        )}
      </div>
    </div>
  );
}
