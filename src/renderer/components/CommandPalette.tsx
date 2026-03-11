/**
 * CommandPalette — Floating command palette triggered by Ctrl+/.
 * Provides quick access to actions, panel toggles, terminal commands,
 * workspace/project switching, and settings.
 */

import { useCallback, useEffect, useState, useMemo } from 'react';
import {
  LayoutDashboard,
  ListTodo,
  Github,
  Activity,
  Plug,
  Clock,
  Settings,
  Keyboard,
  FolderOpen,
  FileText,
  Plus,
  Grid2x2,
  Columns2,
  Map,
  FileCode,
  Shield,
  Sparkles,
  History,
  BarChart3,
  Scale,
  X,
  Play,
  Layers,
  BookOpen,
  Workflow,
} from 'lucide-react';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
} from './ui/command';
import { useUIStore } from '../stores/useUIStore';
import { useTerminalStore } from '../stores/useTerminalStore';
import { useProjectStore } from '../stores/useProjectStore';
import { useIpcQuery } from '../hooks/useIpc';
import { typedInvoke, typedSend } from '../lib/ipc';
import { IPC } from '../../shared/ipcChannels';
import type { WorkspaceListResult } from '../../shared/ipcChannels';
import { SHORTCUTS } from '../lib/shortcuts';
import { toast } from 'sonner';

export function CommandPalette() {
  const [open, setOpen] = useState(false);

  // Register Ctrl+/ keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+/ or Cmd+/ (not Ctrl+Shift+/ which is keyboard shortcuts help)
      if ((e.ctrlKey || e.metaKey) && e.key === '/' && !e.shiftKey) {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      // Ctrl+Shift+P — VS Code-style command palette alias
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const runAction = useCallback((action: () => void) => {
    setOpen(false);
    // Small delay to let the dialog close smoothly
    requestAnimationFrame(action);
  }, []);

  const togglePanel = useUIStore((s) => s.togglePanel);
  const toggleFullView = useUIStore((s) => s.toggleFullView);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen);
  const setShortcutsHelpOpen = useUIStore((s) => s.setShortcutsHelpOpen);
  const requestSidebarFocus = useUIStore((s) => s.requestSidebarFocus);
  const viewMode = useTerminalStore((s) => s.viewMode);
  const setViewMode = useTerminalStore((s) => s.setViewMode);
  const gridLayout = useTerminalStore((s) => s.gridLayout);
  const setGridLayout = useTerminalStore((s) => s.setGridLayout);
  const currentProjectPath = useProjectStore((s) => s.currentProjectPath);
  const selectAdjacentProject = useProjectStore((s) => s.selectAdjacentProject);

  // Workspace list for switching
  const { data: workspaceData } = useIpcQuery(IPC.WORKSPACE_LIST, [], { staleTime: 10000 });
  const workspaces = useMemo(() => {
    const parsed = workspaceData as WorkspaceListResult | undefined;
    return parsed?.workspaces ?? [];
  }, [workspaceData]);

  const switchWorkspace = useCallback(
    async (key: string) => {
      try {
        await typedInvoke(IPC.WORKSPACE_SWITCH, key);
        typedSend(IPC.LOAD_WORKSPACE);
      } catch { toast.error('Failed to switch workspace'); }
    },
    []
  );

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      className="bg-bg-primary border-border-subtle sm:max-w-lg"
      showCloseButton={false}
    >
      <CommandInput
        placeholder="Type a command..."
        className="text-text-primary placeholder:text-text-muted"
      />
      <CommandList className="text-text-primary">
        <CommandEmpty className="text-text-tertiary">No results found.</CommandEmpty>

        {/* Panels */}
        <CommandGroup heading="Panels">
          <CommandItem onSelect={() => runAction(() => togglePanel('tasks'))}>
            <ListTodo className="text-text-tertiary" />
            <span>Sub-Tasks</span>
            <CommandShortcut>{SHORTCUTS.PANEL_TASKS.keys}</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runAction(() => togglePanel('agentState'))}>
            <Activity className="text-text-tertiary" />
            <span>Agent Activity</span>
            <CommandShortcut>{SHORTCUTS.PANEL_AGENT.keys}</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runAction(() => togglePanel('gitChanges'))}>
            <Github className="text-text-tertiary" />
            <span>GitHub</span>
            <CommandShortcut>{SHORTCUTS.PANEL_GITHUB.keys}</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runAction(() => togglePanel('plugins'))}>
            <Plug className="text-text-tertiary" />
            <span>Plugins</span>
            <CommandShortcut>{SHORTCUTS.PANEL_PLUGINS.keys}</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runAction(() => togglePanel('sessions'))}>
            <History className="text-text-tertiary" />
            <span>Sessions</span>
          </CommandItem>
          <CommandItem onSelect={() => runAction(() => togglePanel('history'))}>
            <Clock className="text-text-tertiary" />
            <span>Prompt History</span>
            <CommandShortcut>{SHORTCUTS.PANEL_HISTORY.keys}</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runAction(() => togglePanel('pipeline'))}>
            <Workflow className="text-text-tertiary" />
            <span>Pipeline</span>
            <CommandShortcut>{SHORTCUTS.PANEL_PIPELINE.keys}</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runAction(() => window.dispatchEvent(new Event('open-prompt-library')))}>
            <BookOpen className="text-text-tertiary" />
            <span>Prompt Library</span>
            <CommandShortcut>{SHORTCUTS.PANEL_PROMPT_LIBRARY.keys}</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runAction(() => togglePanel('aiFiles'))}>
            <FileCode className="text-text-tertiary" />
            <span>AI Files</span>
          </CommandItem>
          <CommandItem onSelect={() => runAction(() => togglePanel('skills'))}>
            <Sparkles className="text-text-tertiary" />
            <span>Skills</span>
          </CommandItem>
          <CommandItem onSelect={() => runAction(() => togglePanel('subframeHealth'))}>
            <Shield className="text-text-tertiary" />
            <span>SubFrame Health</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* Full-View Overlays */}
        <CommandGroup heading="Views">
          <CommandItem onSelect={() => runAction(() => toggleFullView('overview'))}>
            <LayoutDashboard className="text-text-tertiary" />
            <span>Project Overview</span>
            <CommandShortcut>{SHORTCUTS.VIEW_OVERVIEW.keys}</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runAction(() => toggleFullView('tasks'))}>
            <ListTodo className="text-text-tertiary" />
            <span>Tasks Full View</span>
            <CommandShortcut>{SHORTCUTS.VIEW_TASKS.keys}</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runAction(() => toggleFullView('structureMap'))}>
            <Map className="text-text-tertiary" />
            <span>Structure Map</span>
          </CommandItem>
          <CommandItem onSelect={() => runAction(() => toggleFullView('stats'))}>
            <BarChart3 className="text-text-tertiary" />
            <span>Repository Stats</span>
          </CommandItem>
          <CommandItem onSelect={() => runAction(() => toggleFullView('decisions'))}>
            <Scale className="text-text-tertiary" />
            <span>Project Decisions</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* Workspaces */}
        {workspaces.length > 1 && (
          <>
            <CommandGroup heading="Workspaces">
              {workspaces.map((ws, i) => (
                <CommandItem
                  key={ws.key}
                  onSelect={() => runAction(() => switchWorkspace(ws.key))}
                >
                  <Layers className="text-text-tertiary" />
                  <span className="font-mono text-accent opacity-70 text-[10px]">#{i + 1}</span>
                  <span>{ws.name}</span>
                  {i < 9 && <CommandShortcut>Ctrl+Alt+{i + 1}</CommandShortcut>}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Terminal Actions */}
        <CommandGroup heading="Terminal">
          <CommandItem onSelect={() => runAction(() => window.dispatchEvent(new Event('open-ai-tool-palette')))}>
            <Play className="text-text-tertiary" />
            <span>Switch AI Tool</span>
            <CommandShortcut>{SHORTCUTS.AI_TOOL_PALETTE.keys}</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runAction(() => window.dispatchEvent(new Event('start-ai-tool')))}>
            <Play className="text-text-tertiary" />
            <span>Start AI Tool</span>
            <CommandShortcut>{SHORTCUTS.START_AI_TOOL.keys}</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runAction(() => {
            const payload: Record<string, string> = {};
            if (currentProjectPath) { payload.projectPath = currentProjectPath; payload.cwd = currentProjectPath; }
            typedSend(IPC.TERMINAL_CREATE, payload as any);
          })}>
            <Plus className="text-text-tertiary" />
            <span>New Terminal</span>
            <CommandShortcut>{SHORTCUTS.NEW_TERMINAL.keys}</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runAction(() => {
            setViewMode(viewMode === 'tabs' ? 'grid' : 'tabs');
          })}>
            {viewMode === 'tabs' ? <Grid2x2 className="text-text-tertiary" /> : <Columns2 className="text-text-tertiary" />}
            <span>{viewMode === 'tabs' ? 'Switch to Grid View' : 'Switch to Tab View'}</span>
            <CommandShortcut>{SHORTCUTS.TOGGLE_GRID.keys}</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runAction(() => {
            const layouts: string[] = ['1x2','1x3','1x4','2x1','2x2','3x1','3x2','3x3'];
            const nextLayout = layouts[(layouts.indexOf(gridLayout) + 1) % layouts.length];
            setGridLayout(nextLayout as typeof gridLayout);
          })}>
            <Grid2x2 className="text-text-tertiary" />
            <span>Next Grid Layout</span>
          </CommandItem>
          <CommandItem onSelect={() => runAction(() => {
            const layouts: string[] = ['1x2','1x3','1x4','2x1','2x2','3x1','3x2','3x3'];
            const prevLayout = layouts[(layouts.indexOf(gridLayout) - 1 + layouts.length) % layouts.length];
            setGridLayout(prevLayout as typeof gridLayout);
          })}>
            <Grid2x2 className="text-text-tertiary" />
            <span>Previous Grid Layout</span>
          </CommandItem>
          <CommandItem onSelect={() => runAction(() => window.dispatchEvent(new Event('close-active-terminal')))}>
            <X className="text-text-tertiary" />
            <span>Close Terminal</span>
            <CommandShortcut>{SHORTCUTS.CLOSE_TERMINAL.keys}</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* Sidebar */}
        <CommandGroup heading="Sidebar">
          <CommandItem onSelect={() => runAction(() => toggleSidebar())}>
            <FolderOpen className="text-text-tertiary" />
            <span>Toggle Sidebar</span>
            <CommandShortcut>{SHORTCUTS.TOGGLE_SIDEBAR.keys}</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runAction(() => requestSidebarFocus('projects'))}>
            <FolderOpen className="text-text-tertiary" />
            <span>Focus Projects</span>
            <CommandShortcut>{SHORTCUTS.FOCUS_PROJECTS.keys}</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runAction(() => requestSidebarFocus('files'))}>
            <FileText className="text-text-tertiary" />
            <span>Focus File Tree</span>
            <CommandShortcut>{SHORTCUTS.FOCUS_FILE_TREE.keys}</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* Navigation */}
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => runAction(() => selectAdjacentProject(-1))}>
            <FolderOpen className="text-text-tertiary" />
            <span>Previous Project</span>
            <CommandShortcut>{SHORTCUTS.PREV_PROJECT.keys}</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runAction(() => selectAdjacentProject(1))}>
            <FolderOpen className="text-text-tertiary" />
            <span>Next Project</span>
            <CommandShortcut>{SHORTCUTS.NEXT_PROJECT.keys}</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* Settings & Help */}
        <CommandGroup heading="Settings">
          <CommandItem onSelect={() => runAction(() => setSettingsOpen(true))}>
            <Settings className="text-text-tertiary" />
            <span>Open Settings</span>
            <CommandShortcut>{SHORTCUTS.SETTINGS.keys}</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runAction(() => setShortcutsHelpOpen(true))}>
            <Keyboard className="text-text-tertiary" />
            <span>Keyboard Shortcuts</span>
            <CommandShortcut>{SHORTCUTS.SHORTCUTS_HELP.keys}</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runAction(() => window.dispatchEvent(new Event('open-whats-new')))}>
            <Sparkles className="text-text-tertiary" />
            <span>What&apos;s New</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
