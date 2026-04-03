import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  FolderOpen,
  FileText,
  Settings,
  ChevronLeft,
  ChevronDown,
  X,
  Loader2,
  CircleHelp,
  Play,
  Layers,
  Plus,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { cn } from '../lib/utils';
import { ScrollArea } from './ui/scroll-area';
import { useUIStore } from '../stores/useUIStore';
import { useProjectStore } from '../stores/useProjectStore';
import { useAIToolConfig, useSettings } from '../hooks/useSettings';
import { ProjectList } from './ProjectList';
import { WorkspaceSelector } from './WorkspaceSelector';
import { FileTree } from './FileTree';
import { IPC } from '../../shared/ipcChannels';
import type { AITool, WorkspaceListResult } from '../../shared/ipcChannels';
import { typedInvoke, typedSend } from '../lib/ipc';
import { useIpcQuery } from '../hooks/useIpc';
import { getLogoSVG } from '../../shared/logoSVG';
import { SidebarAgentStatus } from './SidebarAgentStatus';
import { useTerminalStore } from '../stores/useTerminalStore';
import { useGitStatus } from '../hooks/useGithub';
import { toast } from 'sonner';

/** Read version at module level — avoids importing frameConstants.ts which uses Node's `path` */
const FRAME_VERSION: string = require('../../../package.json').version;

import { getTransport } from '../lib/transportProvider';

type SidebarTab = 'projects' | 'files';

const SIDEBAR_TABS: { id: SidebarTab; label: string; icon: typeof FolderOpen; shortcut: string }[] = [
  { id: 'projects', label: 'Projects', icon: FolderOpen, shortcut: 'Ctrl+E' },
  { id: 'files', label: 'Files', icon: FileText, shortcut: 'Ctrl+Shift+E' },
];

/**
 * Sidebar component.
 * Expanded: header with brand + collapse/hide, tab bar, content, action buttons.
 * Collapsed: vertical icon strip matching RightPanel pattern — expand chevron
 * at top, tab icons with active accent, settings at bottom.
 */
export function Sidebar() {
  const sidebarState = useUIStore((s) => s.sidebarState);
  const setSidebarState = useUIStore((s) => s.setSidebarState);
  const sidebarWidth = useUIStore((s) => s.sidebarWidth);
  const setSidebarWidth = useUIStore((s) => s.setSidebarWidth);
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen);
  const setShortcutsHelpOpen = useUIStore((s) => s.setShortcutsHelpOpen);
  const sidebarFocusRequest = useUIStore((s) => s.sidebarFocusRequest);
  const currentProjectPath = useProjectStore((s) => s.currentProjectPath);
  const isFrameProject = useProjectStore((s) => s.isFrameProject);
  const setIsFrameProject = useProjectStore((s) => s.setIsFrameProject);

  const [activeTab, setActiveTab] = useState<SidebarTab>('projects');
  const [initDialogOpen, setInitDialogOpen] = useState(false);
  const [initLoading, setInitLoading] = useState(false);
  const { config: aiToolConfig } = useAIToolConfig();
  const { settings } = useSettings();
  const startingClaude = useRef(false);

  // Compute effective start command for tooltip display
  const aiToolSettings = (settings?.aiTools as Record<string, Record<string, string>>) || {};
  const customCmd = aiToolSettings[aiToolConfig?.activeTool.id || 'claude']?.customCommand;
  const effectiveCommand = customCmd || aiToolConfig?.activeTool.command || 'claude';
  const fileTreeContainerRef = useRef<HTMLDivElement>(null);
  const projectListContainerRef = useRef<HTMLDivElement>(null);

  const isCollapsed = sidebarState === 'collapsed';

  // Listen for frame project detection results and initialization success
  useEffect(() => {
    const handleResult = (_event: unknown, data: { projectPath: string; isFrame: boolean }) => {
      if (data.projectPath === currentProjectPath) {
        setIsFrameProject(data.isFrame);
      }
    };
    const handleInitialized = (_event: unknown, data: { projectPath: string; success: boolean }) => {
      if (data.projectPath === currentProjectPath) {
        setInitLoading(false);
        setInitDialogOpen(false);
        if (data.success) {
          setIsFrameProject(true);
          toast.success('Project initialized as SubFrame project');
          window.dispatchEvent(new CustomEvent('start-onboarding', { detail: { projectPath: data.projectPath } }));
        } else {
          toast.error('Failed to initialize project');
        }
      }
    };
    const unsubResult = getTransport().on(IPC.IS_FRAME_PROJECT_RESULT, handleResult);
    const unsubInit = getTransport().on(IPC.FRAME_PROJECT_INITIALIZED, handleInitialized);
    return () => {
      unsubResult();
      unsubInit();
    };
  }, [currentProjectPath, setIsFrameProject]);

  useEffect(() => {
    const openInitDialog = () => {
      if (currentProjectPath && !isFrameProject) {
        setInitDialogOpen(true);
      }
    };
    window.addEventListener('open-frame-init', openInitDialog);
    return () => window.removeEventListener('open-frame-init', openInitDialog);
  }, [currentProjectPath, isFrameProject]);

  // Respond to focus requests from keyboard shortcuts (Ctrl+E / Ctrl+Shift+E)
  useEffect(() => {
    if (sidebarFocusRequest.seq === 0) return;
    setActiveTab(sidebarFocusRequest.tab);
    requestAnimationFrame(() => {
      if (sidebarFocusRequest.tab === 'files') {
        fileTreeContainerRef.current?.querySelector<HTMLElement>('[tabindex="0"]')?.focus();
      } else {
        projectListContainerRef.current?.querySelector<HTMLElement>('button')?.focus();
      }
    });
  }, [sidebarFocusRequest]);

  const handleTabClick = useCallback(
    (tab: SidebarTab) => {
      if (isCollapsed) {
        setSidebarState('expanded');
      }
      setActiveTab(tab);
    },
    [isCollapsed, setSidebarState]
  );

  // Start an AI tool — reuses the active terminal if no agent is running, otherwise creates a new one
  const startAITool = useCallback(
    async (tool?: AITool) => {
      if (!currentProjectPath || startingClaude.current) return;
      startingClaude.current = true;
      try {
        // If a specific tool was requested, switch to it first
        if (tool && tool.id !== aiToolConfig?.activeTool.id) {
          await getTransport().invoke(IPC.SET_AI_TOOL, tool.id);
        }

        // Get start command — use active tool's command (or custom override from settings)
        const config = await getTransport().invoke(IPC.GET_AI_TOOL_CONFIG);
        const activeTool = config?.activeTool as AITool | undefined;

        // Warn if tool is not installed
        if (activeTool && activeTool.installed === false) {
          toast.error(`${activeTool.name} is not installed`, {
            description: activeTool.installUrl ? 'Click to view install instructions' : 'Install it and try again',
            action: activeTool.installUrl ? {
              label: 'Install',
              onClick: () => getTransport().platform.openExternal(activeTool.installUrl!),
            } : undefined,
          });
          return;
        }
        const settings = await getTransport().invoke(IPC.LOAD_SETTINGS) as Record<string, any>;
        const aiToolSettings = (settings?.aiTools as Record<string, Record<string, string>>) || {};
        const customCmd = aiToolSettings[activeTool?.id || 'claude']?.customCommand;
        const startCommand = customCmd || activeTool?.command || 'claude';

        // Check if we can reuse the active terminal (idle — no agent running)
        const reuseIdle = settings?.general?.reuseIdleTerminal !== false; // default true
        if (reuseIdle) {
          const { activeTerminalId, terminals } = useTerminalStore.getState();
          const activeInfo = activeTerminalId ? terminals.get(activeTerminalId) : null;
          const isCurrentProject = activeInfo && (activeInfo.projectPath || '') === currentProjectPath;

          if (activeTerminalId && isCurrentProject) {
            const isAgentRunning = await typedInvoke(IPC.IS_TERMINAL_CLAUDE_ACTIVE, activeTerminalId);
            if (!isAgentRunning) {
              // Brief delay so the user can release modifier keys from the shortcut
              // (Ctrl+Shift+Enter). On Windows, ConPTY can interpret 'c' as Ctrl+C if
              // the physical Ctrl key is still held when the first byte reaches the shell.
              await new Promise(resolve => setTimeout(resolve, 80));
              // Reuse existing idle terminal — just send the command
              getTransport().send(IPC.TERMINAL_INPUT_ID, {
                terminalId: activeTerminalId,
                data: startCommand + '\r',
              });
              return;
            }
          }
        }

        // No reusable terminal — create a new one (once pattern)
        // Safety: auto-cleanup after 10s if TERMINAL_CREATED never arrives
        let unsub: (() => void) | null = null;
        const safetyTimer = setTimeout(() => { unsub?.(); }, 10_000);
        unsub = getTransport().on(IPC.TERMINAL_CREATED, (_event: unknown, data: { terminalId?: string; success: boolean }) => {
          unsub?.();
          clearTimeout(safetyTimer);
          if (data.success && data.terminalId) {
            const newTerminalId = data.terminalId;
            let resolved = false;
            let unsubShellReady: (() => void) | null = null;
            const finishStart = () => {
              if (resolved) return;
              resolved = true;
              clearTimeout(shellReadyFallback);
              unsubShellReady?.();
              getTransport().send(IPC.TERMINAL_INPUT_ID, {
                terminalId: newTerminalId,
                data: startCommand + '\r',
              });
            };
            const shellReadyFallback = window.setTimeout(finishStart, 3000);
            unsubShellReady = getTransport().on(IPC.TERMINAL_SHELL_READY, (_readyEvent: unknown, readyData: { terminalId: string }) => {
              if (readyData.terminalId !== newTerminalId) return;
              finishStart();
            });
          } else if (!data.success) {
            toast.error('Failed to start terminal');
          }
        });
        getTransport().send(IPC.TERMINAL_CREATE, {
          projectPath: currentProjectPath,
          cwd: currentProjectPath,
        });
      } finally {
        startingClaude.current = false;
      }
    },
    [currentProjectPath, aiToolConfig]
  );

  // Listen for global start-ai-tool event (keyboard shortcut, command palette, empty state)
  useEffect(() => {
    const handler = () => startAITool();
    window.addEventListener('start-ai-tool', handler);
    return () => window.removeEventListener('start-ai-tool', handler);
  }, [startAITool]);

  // ── Collapsed: vertical icon strip (matches RightPanel pattern) ──────────
  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center py-2 gap-1 bg-bg-primary h-full w-full border-r border-border-subtle">
        {/* Animated logo + expand */}
        <button
          onClick={() => setSidebarState('expanded')}
          className="p-1 rounded hover:bg-bg-hover transition-colors cursor-pointer mb-1"
          title="Expand sidebar (Ctrl+B)"
          aria-label="Expand sidebar"
        >
          <div
            className="w-9 h-9 flex-shrink-0 sidebar-logo"
            dangerouslySetInnerHTML={{ __html: getLogoSVG({ size: 36, id: 'sb-col', frame: false }) }}
          />
        </button>

        {/* Workspace switcher (collapsed) */}
        <CollapsedWorkspaceSwitcher />

        {/* Subtle separator */}
        <div className="w-5 border-t border-border-subtle my-0.5" />

        {/* Tab icons — active highlighted with accent */}
        {SIDEBAR_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={cn(
                'p-2 rounded transition-colors cursor-pointer',
                isActive
                  ? 'text-accent bg-accent-subtle'
                  : 'text-text-tertiary hover:text-text-primary hover:bg-bg-hover'
              )}
              title={`${tab.label} (${tab.shortcut})`}
              aria-label={`${tab.label} (${tab.shortcut})`}
            >
              <Icon size={16} />
            </button>
          );
        })}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Compact git status indicator */}
        <CollapsedGitStatus />

        {/* Agent status (pulsing dot when active) */}
        <SidebarAgentStatus />

        {/* Start AI tool — icon only */}
        <TooltipProvider delayDuration={400}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                disabled={!currentProjectPath}
                onClick={() => startAITool()}
                className={cn(
                  'p-2 rounded transition-colors cursor-pointer',
                  'text-success hover:bg-success/15',
                  'disabled:opacity-30 disabled:cursor-not-allowed'
                )}
                aria-label={`Start ${aiToolConfig?.activeTool.name || 'AI Tool'}`}
              >
                <Play size={16} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p className="text-xs">Start {aiToolConfig?.activeTool.name || 'AI Tool'}</p>
              <p className="font-mono text-[10px] opacity-60">{effectiveCommand}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Help + Settings at bottom */}
        <button
          onClick={() => setShortcutsHelpOpen(true)}
          className="p-2 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer"
          title="Keyboard shortcuts (Ctrl+Shift+/)"
          aria-label="Keyboard shortcuts"
        >
          <CircleHelp size={16} />
        </button>
        <button
          onClick={() => setSettingsOpen(true)}
          className="p-2 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer"
          title="Settings (Ctrl+,)"
          aria-label="Settings"
        >
          <Settings size={16} />
        </button>
      </div>
    );
  }

  // ── Expanded: full sidebar ────────────────────────────────────────────────
  return (
    <div className="relative h-full flex flex-col bg-bg-primary border-r border-border-subtle overflow-hidden">
      {/* Header — animated logo, brand, help, settings, collapse, hide */}
      <div className="flex items-start gap-2 px-2 py-2 border-b border-border-subtle flex-shrink-0">
        <div
          className="flex-shrink-0 sidebar-logo"
          style={{ width: 56, height: 56, minWidth: 56 }}
          dangerouslySetInnerHTML={{ __html: getLogoSVG({ size: 56, id: 'sb-exp', frame: false }) }}
        />
        <div className="flex flex-col min-w-0 gap-0.5 flex-1">
          <span className="text-sm font-semibold tracking-tight truncate leading-none">SubFrame</span>
          {FRAME_VERSION.includes('-') && (
            <span className="text-[9px] font-mono font-medium text-warning leading-none">
              {FRAME_VERSION.split('-')[1]?.split('.')[0]?.toUpperCase() ?? 'PRE'}
            </span>
          )}
          <span className="text-[10px] font-mono text-text-muted leading-none">
            v{FRAME_VERSION}
          </span>
          <div className="flex items-center gap-0.5 mt-0.5">
            <button
              onClick={() => setShortcutsHelpOpen(true)}
              className="p-0.5 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer"
              title="Keyboard shortcuts (Ctrl+Shift+/)"
              aria-label="Keyboard shortcuts"
            >
              <CircleHelp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              className="p-0.5 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer"
              title="Settings (Ctrl+,)"
              aria-label="Settings"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setSidebarState('collapsed')}
              className="p-0.5 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer"
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setSidebarState('hidden')}
              className="p-0.5 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer"
              title="Hide sidebar (Ctrl+B)"
              aria-label="Hide sidebar"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Workspace selector — above tabs to establish scope hierarchy */}
      <WorkspaceSelector />

      {/* Tab bar */}
      <div className="flex border-b border-border-subtle flex-shrink-0">
        {SIDEBAR_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors cursor-pointer',
                isActive
                  ? 'text-text-primary border-b-2 border-accent'
                  : 'text-text-tertiary hover:text-text-secondary hover:bg-bg-hover/50'
              )}
              title={`${tab.label} (${tab.shortcut})`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {activeTab === 'projects' && (
          <div ref={projectListContainerRef} className="flex-1 min-h-0 flex flex-col">
            {/* Project list */}
            <ScrollArea className="flex-1 min-h-0">
              <ProjectList />
            </ScrollArea>

            {/* Git status + Agent status + Action buttons */}
            <div className="flex-shrink-0 p-3 border-t border-border-subtle space-y-2">
              <GitStatusBar />
              <SidebarAgentStatus />
              {/* Start AI Tool — button + dropdown combo */}
              <div className="flex">
                <TooltipProvider delayDuration={400}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        disabled={!currentProjectPath}
                        className="flex-1 px-3 py-1.5 text-xs font-medium rounded-l-md
                                   bg-success/15 text-success border border-success/20
                                   hover:bg-success/25 transition-colors
                                   disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        onClick={() => startAITool()}
                      >
                        Start {aiToolConfig?.activeTool.name || 'Claude Code'}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p className="font-mono text-xs">{effectiveCommand}</p>
                      {customCmd && <p className="text-[10px] opacity-60">Custom override</p>}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      disabled={!currentProjectPath}
                      className="px-1.5 py-1.5 text-xs rounded-r-md border border-l-0
                                 bg-success/15 text-success border-success/20
                                 hover:bg-success/25 transition-colors
                                 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      aria-label="Select AI tool"
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[160px]">
                    {aiToolConfig && Object.values(aiToolConfig.availableTools).map((tool) => (
                      <DropdownMenuItem
                        key={tool.id}
                        onClick={() => startAITool(tool)}
                        className={cn(
                          'text-xs cursor-pointer',
                          tool.id === aiToolConfig.activeTool.id && 'text-accent font-medium'
                        )}
                      >
                        {tool.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {currentProjectPath && isFrameProject && (
                <button
                  className="w-full px-3 py-1.5 text-xs font-medium rounded-md
                             bg-bg-secondary text-text-secondary border border-border-subtle
                             hover:bg-bg-hover hover:text-text-primary transition-colors cursor-pointer"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('start-onboarding', {
                      detail: { projectPath: currentProjectPath },
                    }));
                  }}
                >
                  Run AI Analysis
                </button>
              )}
              {currentProjectPath && !isFrameProject && (
                <>
                  <button
                    className="w-full px-3 py-1.5 text-xs font-medium rounded-md
                               bg-accent-subtle text-accent border border-accent/20
                               hover:bg-accent/20 transition-colors cursor-pointer"
                    onClick={() => setInitDialogOpen(true)}
                  >
                    Initialize as SubFrame Project
                  </button>
                  <AlertDialog open={initDialogOpen} onOpenChange={setInitDialogOpen}>
                    <AlertDialogContent className="bg-bg-primary border-border-subtle text-text-primary">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Initialize SubFrame Project?</AlertDialogTitle>
                        <AlertDialogDescription className="text-text-secondary text-xs space-y-2">
                          <span className="block">This will create SubFrame project files in:</span>
                          <code className="block text-[11px] bg-bg-deep px-2 py-1 rounded border border-border-subtle text-text-primary break-all">
                            {currentProjectPath}
                          </code>
                          <span className="block">Files created: <code>.subframe/</code> directory with config, tasks, structure map, and project notes. Existing files will not be overwritten.</span>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="cursor-pointer" disabled={initLoading}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-accent text-bg-deep hover:bg-accent/80 cursor-pointer"
                          disabled={initLoading}
                          onClick={(e) => {
                            e.preventDefault();
                            setInitLoading(true);
                            getTransport().send(IPC.INITIALIZE_FRAME_PROJECT, {
                              projectPath: currentProjectPath,
                              confirmed: true,
                            });
                          }}
                        >
                          {initLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                          {initLoading ? 'Initializing...' : 'Initialize'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </div>
          </div>
        )}

        {activeTab === 'files' && (
          <div ref={fileTreeContainerRef} className="flex-1 min-h-0 flex flex-col">
            <FileTree onFileOpen={(path) => useUIStore.getState().setEditorFilePath(path)} />
          </div>
        )}
      </div>

      {/* Resize handle */}
      <div
        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-accent/30 active:bg-accent/50 transition-colors z-10"
        onMouseDown={(e) => {
          e.preventDefault();
          const startX = e.clientX;
          const startWidth = sidebarWidth;
          useUIStore.getState().setIsResizing(true);
          const onMouseMove = (e: MouseEvent) => {
            const newWidth = Math.min(500, Math.max(180, startWidth + (e.clientX - startX)));
            setSidebarWidth(newWidth);
          };
          const cleanup = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', cleanup);
            window.removeEventListener('blur', cleanup);
            useUIStore.getState().setIsResizing(false);
          };
          document.addEventListener('mousemove', onMouseMove);
          document.addEventListener('mouseup', cleanup);
          window.addEventListener('blur', cleanup);
        }}
        onDoubleClick={() => setSidebarWidth(220)}
        title="Drag to resize, double-click to reset"
      />
    </div>
  );
}

/** Collapsed sidebar workspace switcher — dropdown with workspace list */
function CollapsedWorkspaceSwitcher() {
  const workspaceName = useProjectStore((s) => s.workspaceName);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const { data: workspaceList, refetch } = useIpcQuery(IPC.WORKSPACE_LIST, [], {
    staleTime: 10000,
  });

  const parsed = workspaceList as WorkspaceListResult | undefined;
  const workspaces = useMemo(() =>
    parsed?.workspaces?.map((ws) => ({
      key: ws.key,
      name: ws.name,
      active: ws.key === parsed.active,
      projectCount: ws.projectCount ?? 0,
    })) ?? [],
    [parsed]
  );

  const handleSwitch = useCallback(
    async (key: string) => {
      if (loading) return;
      // Skip if already the active workspace
      if (parsed?.active === key) return;
      setLoading(true);
      try {
        await typedInvoke(IPC.WORKSPACE_SWITCH, key);
        refetch();
        typedSend(IPC.LOAD_WORKSPACE);
      } catch {
        toast.error('Failed to switch workspace');
      } finally {
        setLoading(false);
      }
    },
    [refetch, loading, parsed]
  );

  const handleCreate = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      await typedInvoke(IPC.WORKSPACE_CREATE, 'New Workspace');
      refetch();
      typedSend(IPC.LOAD_WORKSPACE);
      toast.success('Workspace created');
    } catch {
      toast.error('Failed to create workspace');
    } finally {
      setLoading(false);
    }
  }, [refetch, loading]);

  return (
    <TooltipProvider delayDuration={400}>
      <Tooltip>
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  'p-2 rounded transition-colors cursor-pointer',
                  open
                    ? 'text-accent bg-accent-subtle'
                    : 'text-text-tertiary hover:text-text-primary hover:bg-bg-hover'
                )}
                aria-label={`Workspace: ${workspaceName || 'Default Workspace'}`}
              >
                <Layers size={16} />
              </button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p className="text-xs">{workspaceName || 'Default Workspace'}</p>
            <p className="text-[10px] opacity-60">Switch workspace</p>
          </TooltipContent>
          <DropdownMenuContent side="right" align="start" className="min-w-[220px]">
            {workspaces.map((ws, i) => {
              const idx = i + 1;
              return (
                <DropdownMenuItem
                  key={ws.key}
                  onClick={() => handleSwitch(ws.key)}
                  disabled={loading}
                  className={ws.active ? 'bg-accent-subtle' : ''}
                >
                  <span className="font-mono font-semibold text-accent opacity-70 mr-1.5">#{idx}</span>
                  <span className="truncate">{ws.name}</span>
                  {ws.projectCount > 0 && (
                    <span className="text-text-muted text-[10px] ml-1">({ws.projectCount})</span>
                  )}
                  {idx <= 9 && (
                    <span className="ml-auto text-[10px] font-mono text-text-muted opacity-60 pl-3">Ctrl+Alt+{idx}</span>
                  )}
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleCreate} disabled={loading}>
              <Plus className="w-3.5 h-3.5 mr-2" />
              New Workspace
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Tooltip>
    </TooltipProvider>
  );
}

/** Compact git status bar showing branch + change counts */
function GitStatusBar() {
  const { branch, ahead, behind, staged, modified, untracked, error } = useGitStatus();

  if (error || !branch) return null;

  const hasChanges = staged > 0 || modified > 0 || untracked > 0;

  return (
    <div className="flex items-center gap-1.5 text-[10px] font-mono text-text-tertiary px-0.5">
      <GitBranchIcon className="w-3 h-3 flex-shrink-0" />
      <span className="truncate font-medium text-text-secondary">{branch}</span>
      {ahead > 0 && <span className="text-success" title={`${ahead} unpushed commit${ahead > 1 ? 's' : ''}`} aria-label={`${ahead} commits ahead`}>↑{ahead}</span>}
      {behind > 0 && <span className="text-warning" title={`${behind} behind`} aria-label={`${behind} commits behind`}>↓{behind}</span>}
      {hasChanges && (
        <span className="ml-auto flex items-center gap-1">
          {staged > 0 && <span className="text-success" title={`${staged} staged`} aria-label={`${staged} staged`}>+{staged}</span>}
          {modified > 0 && <span className="text-warning" title={`${modified} modified`} aria-label={`${modified} modified`}>~{modified}</span>}
          {untracked > 0 && <span className="text-text-muted" title={`${untracked} untracked`} aria-label={`${untracked} untracked`}>?{untracked}</span>}
        </span>
      )}
    </div>
  );
}

/** Compact git status for collapsed sidebar — colored dot + branch icon */
function CollapsedGitStatus() {
  const { branch, staged, modified, untracked, error } = useGitStatus();
  const togglePanel = useUIStore((s) => s.togglePanel);

  if (error || !branch) return null;

  const hasChanges = staged > 0 || modified > 0 || untracked > 0;
  const dotColor = hasChanges ? 'bg-warning' : 'bg-success';
  const summary = hasChanges
    ? `${branch} — ${[staged && `+${staged}`, modified && `~${modified}`, untracked && `?${untracked}`].filter(Boolean).join(' ')}`
    : `${branch} — clean`;

  return (
    <TooltipProvider delayDuration={400}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => togglePanel('gitChanges')}
            className="relative p-2 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer"
            aria-label={`Git: ${summary}`}
          >
            <GitBranchIcon className="w-4 h-4" />
            <span className={cn('absolute top-1 right-1 w-2 h-2 rounded-full', dotColor)} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p className="text-xs font-mono">{branch}</p>
          {hasChanges ? (
            <p className="text-[10px] opacity-60">
              {[staged && `${staged} staged`, modified && `${modified} modified`, untracked && `${untracked} untracked`].filter(Boolean).join(', ')}
            </p>
          ) : (
            <p className="text-[10px] opacity-60">Working tree clean</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** Inline git branch icon to avoid adding another lucide import just for this */
function GitBranchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="6" y1="3" x2="6" y2="15" /><circle cx="18" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M18 9a9 9 0 0 1-9 9" />
    </svg>
  );
}

