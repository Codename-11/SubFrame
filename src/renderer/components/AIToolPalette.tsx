/**
 * AIToolPalette — Overlay palette for switching AI tools.
 * Triggered by Ctrl+. or clicking the tool indicator in ViewTabBar.
 * Shows install status, supports per-project tool binding.
 */

import { useCallback, useEffect, useState, useMemo } from 'react';
import {
  Terminal,
  Check,
  Pin,
  PinOff,
  Sparkles,
  ExternalLink,
  RefreshCw,
  CircleAlert,
} from 'lucide-react';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from './ui/command';
import { useAIToolConfig } from '../hooks/useSettings';
import { useProjectStore } from '../stores/useProjectStore';
import { typedSend, typedInvoke } from '../lib/ipc';
import { IPC } from '../../shared/ipcChannels';
import { SHORTCUTS } from '../lib/shortcuts';
import { toast } from 'sonner';
import { getTransport } from '../lib/transportProvider';

export function AIToolPalette() {
  const [open, setOpen] = useState(false);
  const [rechecking, setRechecking] = useState(false);
  const { config, setAITool, refetch } = useAIToolConfig();
  const currentProjectPath = useProjectStore(s => s.currentProjectPath);
  const projects = useProjectStore(s => s.projects);

  // Derive per-project binding from project list
  const currentProject = useMemo(() => {
    if (!currentProjectPath) return null;
    return projects.find(p => p.path === currentProjectPath) ?? null;
  }, [projects, currentProjectPath]);

  const projectToolBinding = currentProject?.aiTool ?? null;

  // Register Ctrl+. keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === '.') {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Listen for programmatic open requests
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('open-ai-tool-palette', handler);
    return () => window.removeEventListener('open-ai-tool-palette', handler);
  }, []);

  const tools = useMemo(() => {
    if (!config) return [];
    return Object.values(config.availableTools);
  }, [config]);

  const activeTool = config?.activeTool ?? null;

  const handleSelectTool = useCallback(
    async (toolId: string, installed?: boolean) => {
      if (installed === false) {
        const tool = tools.find(t => t.id === toolId);
        toast.error(`${tool?.name ?? toolId} is not installed`, {
          description: tool?.installUrl ? 'Click to view install instructions' : undefined,
          action: tool?.installUrl ? {
            label: 'Install',
            onClick: () => getTransport().platform.openExternal(tool.installUrl!),
          } : undefined,
        });
        return;
      }
      try {
        await setAITool.mutateAsync([toolId]);
        const tool = tools.find(t => t.id === toolId);
        toast.success(`Switched to ${tool?.name ?? toolId}`);
      } catch {
        toast.error('Failed to switch tool');
      }
      setOpen(false);
    },
    [setAITool, tools]
  );

  const handleBindToProject = useCallback(
    (toolId: string | null) => {
      if (!currentProjectPath) {
        toast.error('No project selected');
        return;
      }
      typedSend(IPC.SET_PROJECT_AI_TOOL, { projectPath: currentProjectPath, aiTool: toolId });
      if (toolId) {
        const tool = tools.find(t => t.id === toolId);
        if (tool?.installed === false) {
          toast.warning(`Warning: ${tool.name} is not currently installed`, {
            description: 'The binding was saved but the tool won\'t work until installed.',
          });
        } else {
          toast.success(`Bound ${tool?.name ?? toolId} to this project`);
        }
      } else {
        toast.success('Cleared project tool binding');
      }
      setOpen(false);
    },
    [currentProjectPath, tools]
  );

  const handleStartTool = useCallback(
    () => {
      if (activeTool && activeTool.installed === false) {
        toast.error(`${activeTool.name} is not installed`, {
          description: activeTool.installUrl ? 'Click to view install instructions' : undefined,
          action: activeTool.installUrl ? {
            label: 'Install',
            onClick: () => getTransport().platform.openExternal(activeTool.installUrl!),
          } : undefined,
        });
        setOpen(false);
        return;
      }
      setOpen(false);
      requestAnimationFrame(() => {
        window.dispatchEvent(new Event('start-ai-tool'));
      });
    },
    [activeTool]
  );

  const handleRecheck = useCallback(
    async () => {
      setRechecking(true);
      try {
        await typedInvoke(IPC.RECHECK_AI_TOOLS);
        await refetch();
        toast.success('Install status refreshed');
      } catch {
        toast.error('Failed to check tools');
      } finally {
        setRechecking(false);
      }
    },
    [refetch]
  );

  const projectName = currentProjectPath
    ? currentProjectPath.replace(/\\/g, '/').split('/').filter(Boolean).pop()
    : null;

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      className="bg-bg-primary border-border-subtle sm:max-w-md"
      showCloseButton={false}
    >
      <CommandInput
        placeholder="Search AI tools..."
        className="text-text-primary placeholder:text-text-muted"
      />
      <CommandList className="text-text-primary">
        <CommandEmpty className="text-text-tertiary">No tools found.</CommandEmpty>

        {/* Available tools */}
        <CommandGroup heading="Switch Active Tool">
          {tools.map(tool => {
            const isActive = tool.id === activeTool?.id;
            const isBound = tool.id === projectToolBinding;
            const isInstalled = tool.installed !== false; // undefined or true = OK
            return (
              <CommandItem
                key={tool.id}
                onSelect={() => handleSelectTool(tool.id, tool.installed)}
                className="gap-2 cursor-pointer"
              >
                <Terminal className={`w-4 h-4 flex-shrink-0 ${isInstalled ? 'text-text-tertiary' : 'text-error'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-sm font-medium ${!isInstalled ? 'text-text-muted' : ''}`}>{tool.name}</span>
                    {!isInstalled && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-error/15 text-error font-semibold uppercase tracking-wider">
                        not installed
                      </span>
                    )}
                    {isBound && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-accent/15 text-accent font-semibold uppercase tracking-wider">
                        project
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-text-tertiary">{tool.description}</span>
                </div>
                {isActive && isInstalled && <Check className="w-4 h-4 text-accent flex-shrink-0" />}
                {!isInstalled && tool.installUrl && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      getTransport().platform.openExternal(tool.installUrl!);
                    }}
                    className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-accent
                               hover:bg-accent/10 rounded transition-colors cursor-pointer"
                    title="Open install page"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Install
                  </button>
                )}
              </CommandItem>
            );
          })}
        </CommandGroup>

        <CommandSeparator />

        {/* Quick actions */}
        <CommandGroup heading="Actions">
          {activeTool && (
            <CommandItem
              onSelect={handleStartTool}
              className="gap-2 cursor-pointer"
            >
              {activeTool.installed === false
                ? <CircleAlert className="w-4 h-4 text-warning" />
                : <Sparkles className="w-4 h-4 text-text-tertiary" />
              }
              <span>Start {activeTool.name}</span>
              <CommandShortcut>{SHORTCUTS.START_AI_TOOL.keys}</CommandShortcut>
            </CommandItem>
          )}
          <CommandItem
            onSelect={handleRecheck}
            className="gap-2 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 text-text-tertiary ${rechecking ? 'animate-spin' : ''}`} />
            <span>Recheck Install Status</span>
          </CommandItem>
        </CommandGroup>

        {/* Per-project binding */}
        {currentProjectPath && (
          <>
            <CommandSeparator />
            <CommandGroup heading={`Project Binding — ${projectName}`}>
              {tools.map(tool => {
                const isBound = tool.id === projectToolBinding;
                return (
                  <CommandItem
                    key={`bind-${tool.id}`}
                    onSelect={() => handleBindToProject(isBound ? null : tool.id)}
                    className="gap-2 cursor-pointer"
                  >
                    {isBound
                      ? <PinOff className="w-4 h-4 text-accent flex-shrink-0" />
                      : <Pin className="w-4 h-4 text-text-tertiary flex-shrink-0" />
                    }
                    <span className="text-sm">
                      {isBound ? `Unbind ${tool.name}` : `Bind ${tool.name} to project`}
                    </span>
                    {isBound && <Check className="w-4 h-4 text-accent flex-shrink-0 ml-auto" />}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
