/**
 * SidebarAgentStatus — Tiny status widget for the sidebar footer area.
 * Shows a pulsing dot + current tool name when an agent session is active.
 * Adapts to collapsed sidebar: shows icon + dot + count badge with tooltip.
 */

import { Bot } from 'lucide-react';
import { useAgentState } from '../hooks/useAgentState';
import { useUIStore } from '../stores/useUIStore';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

export function SidebarAgentStatus() {
  const { sessions } = useAgentState();
  const sidebarState = useUIStore((s) => s.sidebarState);

  const activeSessions = sessions.filter((s) => s.status === 'active' || s.status === 'busy');

  if (activeSessions.length === 0) return null;

  const isCollapsed = sidebarState === 'collapsed';
  const count = activeSessions.length;
  const label = count === 1
    ? activeSessions[0].currentTool || activeSessions[0].agentName || 'Active'
    : `${count} agents active`;
  const titleText = `${count} active agent session${count !== 1 ? 's' : ''}`;

  // ── Collapsed: icon + pulse dot + count badge + tooltip ──
  if (isCollapsed) {
    return (
      <TooltipProvider delayDuration={400}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => useUIStore.getState().togglePanel('agentState')}
              className="relative p-2 rounded text-success hover:bg-bg-hover transition-colors cursor-pointer"
              aria-label={titleText}
            >
              <Bot size={16} />
              {/* Pulsing dot — top-right */}
              <span className="absolute top-1 right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
              </span>
              {/* Count badge — bottom-right, only when >1 */}
              {count > 1 && (
                <span className="absolute -bottom-0.5 -right-0.5 min-w-[14px] h-[14px] flex items-center justify-center text-[8px] font-bold text-bg-primary bg-success rounded-full tabular-nums leading-none">
                  {count}
                </span>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p className="text-xs">{label}</p>
            {count > 1 && (
              <p className="text-[10px] opacity-60">{count} sessions</p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // ── Expanded: original inline layout ──
  return (
    <button
      onClick={() => useUIStore.getState().togglePanel('agentState')}
      className="flex items-center gap-1.5 px-2 py-1 w-full rounded hover:bg-bg-hover/50 transition-colors cursor-pointer"
      title={titleText}
    >
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
      </span>
      <span className="flex-1 min-w-0 text-left">
        <span className="text-[10px] text-text-secondary truncate block">
          {label}
        </span>
      </span>
      {count > 1 && (
        <span className="text-[9px] text-text-muted bg-bg-tertiary rounded-full px-1.5 py-0.5 shrink-0 tabular-nums">
          {count}
        </span>
      )}
    </button>
  );
}
