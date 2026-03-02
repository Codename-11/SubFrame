/**
 * SidebarAgentStatus — Tiny status widget for the sidebar footer area.
 * Shows a pulsing dot + current tool name when an agent session is active.
 */

import { useAgentState } from '../hooks/useAgentState';
import { useUIStore } from '../stores/useUIStore';

export function SidebarAgentStatus() {
  const { activeSession } = useAgentState();

  if (!activeSession) return null;

  return (
    <button
      onClick={() => useUIStore.getState().togglePanel('agentState')}
      className="flex items-center gap-1.5 px-2 py-1 max-w-[120px] rounded hover:bg-bg-hover/50 transition-colors cursor-pointer"
      title="View agent activity"
    >
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
      </span>
      <span className="text-[10px] text-text-secondary truncate">
        {activeSession.currentTool || 'Active'}
      </span>
    </button>
  );
}
