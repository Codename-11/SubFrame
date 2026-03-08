/**
 * SidebarAgentStatus — Tiny status widget for the sidebar footer area.
 * Shows a pulsing dot + current tool name when an agent session is active.
 */

import { useAgentState } from '../hooks/useAgentState';
import { useUIStore } from '../stores/useUIStore';

export function SidebarAgentStatus() {
  const { sessions } = useAgentState();

  const activeSessions = sessions.filter((s) => s.status === 'active' || s.status === 'busy');

  if (activeSessions.length === 0) return null;

  return (
    <button
      onClick={() => useUIStore.getState().togglePanel('agentState')}
      className="flex items-center gap-1.5 px-2 py-1 w-full rounded hover:bg-bg-hover/50 transition-colors cursor-pointer"
      title={`${activeSessions.length} active agent session${activeSessions.length !== 1 ? 's' : ''}`}
    >
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
      </span>
      <span className="flex-1 min-w-0 text-left">
        {activeSessions.length === 1 ? (
          <span className="text-[10px] text-text-secondary truncate block">
            {activeSessions[0].currentTool || activeSessions[0].agentName || 'Active'}
          </span>
        ) : (
          <span className="text-[10px] text-text-secondary truncate block">
            {activeSessions.length} agents active
          </span>
        )}
      </span>
      {activeSessions.length > 1 && (
        <span className="text-[9px] text-text-muted bg-bg-tertiary rounded-full px-1.5 py-0.5 shrink-0 tabular-nums">
          {activeSessions.length}
        </span>
      )}
    </button>
  );
}
