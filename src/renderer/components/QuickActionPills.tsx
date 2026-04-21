/**
 * QuickActionPills — compact row of contextual prompt shortcuts.
 *
 * Renders above the focused terminal. Each pill injects a literal text
 * snippet into the terminal via the same path PromptLibrary uses
 * (sendCommandToTerminal / TERMINAL_INPUT_ID). Pills are filtered by the
 * active AI tool: Claude pills show only when claudeActive, otherwise we
 * fall back to the project's configured AI tool name, then to 'shell'.
 *
 * Visibility is gated by useUIStore.showQuickActionPills. When a terminal
 * isn't focused, the component returns null.
 */

import { useMemo } from 'react';
import * as LucideIcons from 'lucide-react';
import { useTerminalStore } from '../stores/useTerminalStore';
import { useUIStore } from '../stores/useUIStore';
import { useAIToolConfig } from '../hooks/useSettings';
import { sendCommandToTerminal } from '../lib/promptUtils';
import {
  DEFAULT_QUICK_ACTIONS,
  getActionsForTool,
  normalizeToolKey,
  type QuickAction,
} from '../lib/quickActions';

interface QuickActionPillsProps {
  terminalId: string | null;
}

/**
 * Resolve a lucide icon name to a component. Falls back to Zap if unknown.
 */
function resolveIcon(name: string): React.ComponentType<{ className?: string }> {
  const icons = LucideIcons as unknown as Record<
    string,
    React.ComponentType<{ className?: string }>
  >;
  return icons[name] ?? icons['Zap'] ?? (() => null);
}

export function QuickActionPills({ terminalId }: QuickActionPillsProps) {
  const showQuickActionPills = useUIStore((s) => s.showQuickActionPills);
  const terminal = useTerminalStore((s) =>
    terminalId ? s.terminals.get(terminalId) : undefined
  );
  const { config: aiToolConfig } = useAIToolConfig();

  // Determine which tool context this terminal is running in.
  // Priority: claudeActive flag on the terminal → project's configured AI
  // tool name → 'shell'. normalizeToolKey handles the various display names.
  const toolKey = useMemo(() => {
    if (terminal?.claudeActive) return 'claude';
    return normalizeToolKey(aiToolConfig?.activeTool?.name ?? null);
  }, [terminal?.claudeActive, aiToolConfig]);

  const actions = useMemo<QuickAction[]>(() => {
    // Claude-active terminals additionally show all Claude pills; otherwise
    // use the generic filter. We intentionally always include 'all' pills
    // via getActionsForTool to keep shell/git-status pills universally useful.
    return getActionsForTool(toolKey);
  }, [toolKey]);

  if (!showQuickActionPills) return null;
  if (!terminalId) return null;
  if (actions.length === 0) return null;

  const handleClick = (action: QuickAction) => {
    // Mirror PromptLibrary's injection path: promptUtils.sendCommandToTerminal
    // sends through IPC.TERMINAL_INPUT_ID with '\r' appended for execution.
    // That's the same mechanism prompt-library Shift+Click uses.
    sendCommandToTerminal(action.text, terminalId);
  };

  return (
    <div
      className="flex flex-wrap gap-1 px-2 py-1 border-b border-border-subtle bg-bg-secondary/60"
      data-testid="quick-action-pills"
      role="toolbar"
      aria-label="Quick actions"
    >
      {actions.map((action) => {
        const Icon = resolveIcon(action.icon);
        return (
          <button
            key={action.id}
            type="button"
            onClick={() => handleClick(action)}
            title={action.text}
            className="inline-flex items-center gap-1 border border-border-default bg-bg-secondary hover:bg-bg-hover text-text-secondary hover:text-text-primary text-xs rounded-full px-2 py-0.5 transition-colors cursor-pointer"
          >
            <Icon className="w-3 h-3" />
            <span>{action.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// Re-export for any consumers that want the raw defaults without pulling
// from lib/quickActions directly.
export { DEFAULT_QUICK_ACTIONS };
