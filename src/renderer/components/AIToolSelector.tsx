/**
 * AI Tool Selector component.
 * Dropdown for switching between AI coding tools (Claude Code, Codex CLI, etc.)
 * with support for presets and custom commands.
 */

import { useCallback } from 'react';
import { ChevronDown, Terminal, Check, Plus } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { useIpcQuery, useIpcMutation } from '../hooks/useIpc';
import { useIPCEvent } from '../hooks/useIPCListener';
import { IPC } from '../../shared/ipcChannels';
import type { AIToolConfig } from '../../shared/ipcChannels';

interface AIToolSelectorProps {
  /** Callback when the active tool changes */
  onToolChange?: (toolId: string) => void;
  /** Compact mode for embedding in tight spaces */
  compact?: boolean;
}

export function AIToolSelector({ onToolChange, compact = false }: AIToolSelectorProps) {
  const { data: config, refetch } = useIpcQuery(IPC.GET_AI_TOOL_CONFIG, [], {
    staleTime: 30_000,
  });

  const setToolMutation = useIpcMutation(IPC.SET_AI_TOOL);

  // Listen for tool changed events from main process
  useIPCEvent<AIToolConfig>(IPC.AI_TOOL_CHANGED, useCallback(() => {
    refetch();
  }, [refetch]));

  const typedConfig = config as AIToolConfig | undefined;
  const activeTool = typedConfig?.activeTool;
  const tools = typedConfig ? Object.values(typedConfig.availableTools) : [];

  const handleSelectTool = useCallback(
    async (toolId: string) => {
      await setToolMutation.mutateAsync([toolId]);
      refetch();
      onToolChange?.(toolId);
    },
    [setToolMutation, refetch, onToolChange]
  );

  const handleCustomCommand = useCallback(() => {
    const command = prompt('Enter custom AI tool command:');
    if (command && command.trim()) {
      onToolChange?.(command.trim());
    }
  }, [onToolChange]);

  const activeToolName = activeTool?.name ?? 'Claude Code';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={`flex items-center gap-1.5 rounded-md transition-colors cursor-pointer
            ${
              compact
                ? 'px-2 py-1 text-[11px]'
                : 'px-3 py-1.5 text-xs'
            }
            bg-bg-secondary border border-border-subtle
            hover:bg-bg-hover text-text-secondary hover:text-text-primary
          `}
        >
          <Terminal className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
          <span className="truncate max-w-[120px]">{activeToolName}</span>
          <ChevronDown className="w-3 h-3 text-text-tertiary flex-shrink-0" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="min-w-[180px] bg-bg-elevated border-border-subtle"
      >
        <DropdownMenuLabel className="text-[10px] text-text-tertiary uppercase tracking-wider">
          AI Tools
        </DropdownMenuLabel>

        {tools.map((tool) => (
          <DropdownMenuItem
            key={tool.id}
            onClick={() => handleSelectTool(tool.id)}
            className="text-xs gap-2 cursor-pointer"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span className="flex-1">{tool.name}</span>
            {tool.id === activeTool?.id && (
              <Check className="w-3.5 h-3.5 text-accent" />
            )}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={handleCustomCommand}
          className="text-xs gap-2 text-text-tertiary cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Custom command...
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
