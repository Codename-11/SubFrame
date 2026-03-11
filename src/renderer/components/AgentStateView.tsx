/**
 * AgentStateView — Main agent state visualization component.
 * Panel mode: compact active session view.
 * Full-view mode: session list + selected session timeline.
 */

import { useState, useMemo, useCallback } from 'react';
import { Activity, Maximize2, TerminalSquare } from 'lucide-react';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { useAgentState } from '../hooks/useAgentState';
import { useUIStore } from '../stores/useUIStore';
import { useTerminalStore } from '../stores/useTerminalStore';
import { AgentTimeline } from './AgentTimeline';
import type { AgentSession, AgentSessionStatus } from '../../shared/agentStateTypes';
import * as terminalRegistry from '../lib/terminalRegistry';

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

function SessionCard({ session, hasTerminal, onJumpToTerminal }: {
  session: AgentSession;
  hasTerminal?: boolean;
  onJumpToTerminal?: () => void;
}) {
  return (
    <div className="bg-bg-secondary rounded-lg border border-border-subtle p-3 min-w-0">
      <div className="flex items-center justify-between gap-2 min-w-0">
        <span className="text-xs font-medium text-text-primary truncate min-w-0">
          {session.agentName || 'Claude'}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {hasTerminal && onJumpToTerminal && (
            <button
              onClick={(e) => { e.stopPropagation(); onJumpToTerminal(); }}
              className="p-0.5 rounded text-text-muted hover:text-accent hover:bg-bg-hover transition-colors cursor-pointer"
              title="Jump to terminal"
            >
              <TerminalSquare className="h-3 w-3" />
            </button>
          )}
          <Badge
            variant="secondary"
            className={cn('text-[10px] capitalize', STATUS_STYLES[session.status])}
          >
            {session.status}
          </Badge>
        </div>
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
  const relativeTime = useMemo(() => {
    if (!session.lastActivityAt) return '';
    const diff = Date.now() - new Date(session.lastActivityAt).getTime();
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  }, [session.lastActivityAt]);

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-3 py-2.5 transition-colors cursor-pointer',
        isSelected ? 'bg-bg-hover/50 border-l-2 border-accent' : 'hover:bg-bg-hover/30 border-l-2 border-transparent',
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className={cn('w-2 h-2 rounded-full shrink-0', STATUS_DOT[session.status])} />
        <span className="text-xs font-medium text-text-primary truncate min-w-0 flex-1">
          {session.agentName || 'Claude'}
        </span>
        <span className="text-[10px] text-text-muted shrink-0 tabular-nums">
          {session.steps.length} steps
        </span>
      </div>
      {session.currentTool && (
        <div className="mt-1 ml-4">
          <span className="bg-accent-subtle text-accent text-[10px] px-1.5 py-0.5 rounded">
            {session.currentTool}
          </span>
        </div>
      )}
      {relativeTime && (
        <div className="mt-0.5 ml-4 text-[10px] text-text-muted">
          {relativeTime}
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
  const terminals = useTerminalStore((s) => s.terminals);

  // In full-view, resolve the selected session (fallback to active)
  const selectedSession = useMemo<AgentSession | null>(() => {
    if (!isFullView) return activeSession;
    if (selectedSessionId) {
      const found = sessions.find((s) => s.sessionId === selectedSessionId);
      if (found) return found;
    }
    return activeSession ?? null;
  }, [isFullView, sessions, selectedSessionId, activeSession]);

  const [selectedPanelSessionId, setSelectedPanelSessionId] = useState<string | null>(null);

  // Find the terminal associated with a session and focus it
  const jumpToTerminal = useCallback((sessionId: string) => {
    const { terminals, setActiveTerminal } = useTerminalStore.getState();
    for (const [, info] of terminals) {
      if (info.claudeSessionId === sessionId) {
        setActiveTerminal(info.id);
        // Close full view if open, so the terminal is visible
        if (isFullView) {
          useUIStore.getState().setFullViewContent(null);
        }
        // Focus the xterm instance
        setTimeout(() => {
          const instance = terminalRegistry.get(info.id);
          if (instance) instance.terminal.focus();
        }, 50);
        return;
      }
    }
    toast.info('No terminal linked to this session', { duration: 2000 });
  }, [isFullView]);

  // Check if a session has an associated terminal (reactive via terminals subscription)
  const terminalBySession = useMemo(() => {
    const map = new Map<string, string>();
    for (const [, info] of terminals) {
      if (info.claudeSessionId) map.set(info.claudeSessionId, info.id);
    }
    return map;
  }, [terminals]);

  // Panel mode: show active/busy sessions first, then recent idle/completed (max 5), newest first
  const panelSessions = useMemo(() => {
    const byRecency = (a: AgentSession, b: AgentSession) => {
      const ta = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
      const tb = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
      return tb - ta;
    };
    const active = sessions.filter((s) => s.status === 'active' || s.status === 'busy').sort(byRecency);
    const inactive = sessions
      .filter((s) => s.status !== 'active' && s.status !== 'busy')
      .sort(byRecency)
      .slice(0, Math.max(0, 5 - active.length));
    return [...active, ...inactive];
  }, [sessions]);

  // Expanded session in panel mode: selected, or first active, or first in list
  const expandedSession = useMemo(() => {
    if (selectedPanelSessionId) {
      const found = panelSessions.find((s) => s.sessionId === selectedPanelSessionId);
      if (found) return found;
    }
    return panelSessions.find((s) => s.status === 'active' || s.status === 'busy') ?? null;
  }, [panelSessions, selectedPanelSessionId]);

  // ── Panel mode (sidebar right panel) ──────────────────────────────────────
  if (!isFullView) {
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle shrink-0">
          <span className="text-xs font-medium text-text-secondary">Agent Activity</span>
          <div className="flex items-center gap-1.5">
            {panelSessions.filter(s => s.status === 'active' || s.status === 'busy').length > 0 && (
              <Badge
                variant="secondary"
                className="text-[10px] bg-emerald-900/60 text-emerald-300"
              >
                {panelSessions.filter(s => s.status === 'active' || s.status === 'busy').length} active
              </Badge>
            )}
            <button
              onClick={() => { useUIStore.getState().setActivePanel(null); useUIStore.getState().setFullViewContent('agentState'); }}
              className="p-1 rounded text-text-tertiary hover:text-accent hover:bg-bg-hover transition-colors cursor-pointer"
              title="Open full view"
            >
              <Maximize2 size={14} />
            </button>
          </div>
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
            <div className="p-3 flex flex-col gap-2">
              {/* Show active/busy sessions first, then recent ones */}
              {panelSessions.map((session) => (
                <button
                  key={session.sessionId}
                  onClick={() => setSelectedPanelSessionId(
                    selectedPanelSessionId === session.sessionId ? null : session.sessionId
                  )}
                  className={cn(
                    'w-full text-left transition-colors rounded-lg',
                    selectedPanelSessionId === session.sessionId
                      ? 'ring-1 ring-accent/30'
                      : 'hover:bg-bg-hover/30'
                  )}
                >
                  <SessionCard
                    session={session}
                    hasTerminal={terminalBySession.has(session.sessionId)}
                    onJumpToTerminal={() => jumpToTerminal(session.sessionId)}
                  />
                </button>
              ))}
              {/* Timeline for selected session */}
              {expandedSession && expandedSession.steps.length > 0 && (
                <>
                  <Separator className="bg-border-subtle" />
                  <AgentTimeline steps={expandedSession.steps} compact />
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
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-secondary">
              {sessions.length} session{sessions.length !== 1 ? 's' : ''}
            </span>
            {sessions.filter(s => s.status === 'active' || s.status === 'busy').length > 0 && (
              <Badge
                variant="secondary"
                className="text-[10px] bg-emerald-900/60 text-emerald-300"
              >
                {sessions.filter(s => s.status === 'active' || s.status === 'busy').length} active
              </Badge>
            )}
          </div>
        </div>
        <ScrollArea className="flex-1 min-h-0">
          {sessions.length === 0 ? (
            <div className="p-4">
              <EmptyState />
            </div>
          ) : (
            <div className="flex flex-col">
              {[...sessions]
                .sort((a, b) => {
                  // Active/busy first, then newest-to-oldest by lastActivityAt
                  const aActive = a.status === 'active' || a.status === 'busy' ? 0 : 1;
                  const bActive = b.status === 'active' || b.status === 'busy' ? 0 : 1;
                  if (aActive !== bActive) return aActive - bActive;
                  const ta = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
                  const tb = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
                  return tb - ta;
                })
                .map((s) => (
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
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] text-text-muted tabular-nums">
                  {selectedSession.steps.length} step{selectedSession.steps.length !== 1 ? 's' : ''}
                </span>
                {selectedSession.startedAt && (
                  <span className="text-[10px] text-text-muted">
                    Started {new Date(selectedSession.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
                {terminalBySession.has(selectedSession.sessionId) && (
                  <button
                    onClick={() => jumpToTerminal(selectedSession.sessionId)}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-text-tertiary hover:text-accent hover:bg-bg-hover transition-colors cursor-pointer"
                    title="Jump to terminal"
                  >
                    <TerminalSquare className="h-3 w-3" />
                    <span>Terminal</span>
                  </button>
                )}
              </div>
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
