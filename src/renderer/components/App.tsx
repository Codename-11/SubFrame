import { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { TerminalArea } from './TerminalArea';
import { RightPanel } from './RightPanel';
import { SettingsPanel } from './SettingsPanel';

import { CommandPalette } from './CommandPalette';
import { PromptLibrary } from './PromptLibrary';
import { WhatsNew } from './WhatsNew';
import { UpdateNotification } from './UpdateNotification';
import { GracefulShutdownDialog } from './GracefulShutdownDialog';
import { OnboardingDialog } from './OnboardingDialog';
import { Editor } from './Editor';
import { ErrorBoundary } from './ErrorBoundary';
import { ThemeProvider } from './ThemeProvider';
import { ActivityBar } from './ActivityBar';
import { StatusBar } from './StatusBar';
import { TasksPalette } from './TasksPalette';
import { AIToolPalette } from './AIToolPalette';
import { RemoteCursorOverlay, RemotePointerPublisher } from './RemoteCursorOverlay';
import { applyLiveUIStateSnapshot, buildLiveUIStateSnapshot, consumeMirroredUISyncSuppression, useUIStore } from '../stores/useUIStore';
import { useProjectStore } from '../stores/useProjectStore';
import { useTerminalStore } from '../stores/useTerminalStore';

import { cn } from '../lib/utils';
import * as terminalRegistry from '../lib/terminalRegistry';
import { useOnboarding } from '../hooks/useOnboarding';
import { useAIToolConfig } from '../hooks/useSettings';
import { useIpcQuery } from '../hooks/useIpc';
import { useIPCEvent } from '../hooks/useIPCListener';
import { useViewport } from '../hooks/useViewport';
import { IPC } from '../../shared/ipcChannels';
import { typedInvoke, typedSend } from '../lib/ipc';
import { focusActivityBar } from '../lib/activityBarEvents';
import type { Task, UninstallResult, WorkspaceListResult, WorkspaceData, WorkspaceProject } from '../../shared/ipcChannels';
import { getTransport } from '../lib/transportProvider';
import { MobileApp } from './mobile/MobileApp';
import { TabletApp } from './mobile/TabletApp';
import { toast } from 'sonner';

/**
 * Root application layout.
 * Three regions: sidebar (left), terminal area (center), right panel (conditionally visible).
 * Keyboard shortcuts are wired here to match the original app.
 */
export function App() {
  const sidebarState = useUIStore((s) => s.sidebarState);
  const sidebarWidth = useUIStore((s) => s.sidebarWidth);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const activePanel = useUIStore((s) => s.activePanel);
  const fullViewContent = useUIStore((s) => s.fullViewContent);
  const rightPanelCollapsed = useUIStore((s) => s.rightPanelCollapsed);
  const rightPanelWidth = useUIStore((s) => s.rightPanelWidth);
  const settingsOpen = useUIStore((s) => s.settingsOpen);
  const shortcutsHelpOpen = useUIStore((s) => s.shortcutsHelpOpen);
  const openTabs = useUIStore((s) => s.openTabs);
  const togglePanel = useUIStore((s) => s.togglePanel);
  const toggleFullView = useUIStore((s) => s.toggleFullView);
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen);
  const setShortcutsHelpOpen = useUIStore((s) => s.setShortcutsHelpOpen);
  const activeTaskEnhance = useUIStore((s) => s.activeTaskEnhance);
  const clearActiveTaskEnhance = useUIStore((s) => s.clearActiveTaskEnhance);
  const setPendingEnhance = useUIStore((s) => s.setPendingEnhance);
  const isResizing = useUIStore((s) => s.isResizing);
  const editorFilePath = useUIStore((s) => s.editorFilePath);
  const setEditorFilePath = useUIStore((s) => s.setEditorFilePath);
  const requestSidebarFocus = useUIStore((s) => s.requestSidebarFocus);
  const currentProjectPath = useProjectStore((s) => s.currentProjectPath);
  const selectAdjacentProject = useProjectStore((s) => s.selectAdjacentProject);
  const onboarding = useOnboarding();
  const [onboardingDialogOpen, setOnboardingDialogOpen] = useState(false);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const { config: aiToolConfig, setAITool } = useAIToolConfig();
  const projects = useProjectStore((s) => s.projects);
  // Guard: prevents auto-reopen from fighting with user's explicit close
  const userDismissedAnalysisRef = useRef(false);

  // Initialize API server bridge (renderer-side IPC handlers for terminal data requests)
  useEffect(() => { terminalRegistry.initAPIBridge(); }, []);

  // Workspace list for Ctrl+Alt+N switching — refs avoid stale closure in handleKeyDown
  const { data: workspaceData, refetch: refetchWorkspaceList } = useIpcQuery(IPC.WORKSPACE_LIST, [], { staleTime: 10000 });
  const workspaceListRef = useRef<{ key: string; name: string; inactive?: boolean }[]>([]);
  const activeWorkspaceKeyRef = useRef<string | null>(null);
  const refetchWorkspaceListRef = useRef(refetchWorkspaceList);
  refetchWorkspaceListRef.current = refetchWorkspaceList;
  useEffect(() => {
    const parsed = workspaceData as WorkspaceListResult | undefined;
    workspaceListRef.current = parsed?.workspaces?.map((ws) => ({ key: ws.key, name: ws.name, inactive: ws.inactive ?? false })) ?? [];
    activeWorkspaceKeyRef.current = parsed?.active ?? null;
  }, [workspaceData]);

  // Auto-switch AI tool when selecting a project with a per-project binding
  useEffect(() => {
    if (!currentProjectPath || !aiToolConfig) return;
    const project = projects.find(p => p.path === currentProjectPath);
    if (project?.aiTool && project.aiTool !== aiToolConfig.activeTool.id) {
      // Only switch if the bound tool still exists
      if (aiToolConfig.availableTools[project.aiTool]) {
        setAITool.mutate([project.aiTool]);
      }
    }
  }, [currentProjectPath]); // eslint-disable-line react-hooks/exhaustive-deps

  useIPCEvent<{ activityStreamId: string; success: boolean; enhanced: Partial<Task>; error?: string }>(
    IPC.TASK_ENHANCE_RESULT,
    useCallback((payload) => {
      if (!payload.activityStreamId || payload.activityStreamId !== activeTaskEnhance?.activityStreamId) {
        return;
      }

      toast.dismiss('enhance-progress');
      clearActiveTaskEnhance();

      if (payload.success) {
        setPendingEnhance({
          enhanced: payload.enhanced as Record<string, unknown>,
          editingTaskId: activeTaskEnhance.editingTaskId,
          openRequested: false,
        });
        toast.success('Task enhanced by AI', {
          id: 'enhance-result',
          action: {
            label: 'View Results',
            onClick: () => {
              const store = useUIStore.getState();
              if (store.pendingEnhance) {
                store.setPendingEnhance({ ...store.pendingEnhance, openRequested: true });
                store.setActivePanel('tasks');
              }
            },
          },
          duration: 10_000,
        });
        return;
      }

      if (payload.error === 'Cancelled') {
        toast.info('Task enhancement cancelled');
      } else {
        toast.error(payload.error || 'AI enhancement failed');
      }
    }, [activeTaskEnhance, clearActiveTaskEnhance, setPendingEnhance])
  );

  // Per-project right panel state save/restore
  const prevPanelProjectRef = useRef<string | null>(null);
  useEffect(() => {
    const PANEL_KEY = 'subframe-panel-sessions';
    const normalize = (p: string | null) => p ?? '__global__';
    const ui = useUIStore.getState();

    // Save outgoing project's panel state
    if (prevPanelProjectRef.current !== currentProjectPath && prevPanelProjectRef.current !== null) {
      try {
        const all = JSON.parse(localStorage.getItem(PANEL_KEY) || '{}');
        all[normalize(prevPanelProjectRef.current)] = {
          activePanel: ui.activePanel,
          collapsed: ui.rightPanelCollapsed,
        };
        localStorage.setItem(PANEL_KEY, JSON.stringify(all));
      } catch { /* ignore */ }
    }

    // Restore incoming project's panel state
    if (prevPanelProjectRef.current !== currentProjectPath) {
      try {
        const all = JSON.parse(localStorage.getItem(PANEL_KEY) || '{}');
        const session = all[normalize(currentProjectPath)];
        if (session) {
          if (session.activePanel) {
            ui.setActivePanel(session.activePanel);
            if (session.collapsed) ui.setRightPanelCollapsed(true);
          } else {
            ui.closeRightPanel();
          }
        }
        // If no saved session, leave panel as-is (first visit)
      } catch { /* ignore */ }
      prevPanelProjectRef.current = currentProjectPath;
    }
  }, [currentProjectPath]);

  // Save panel state on app close
  useEffect(() => {
    const handler = () => {
      const PANEL_KEY = 'subframe-panel-sessions';
      const key = currentProjectPath ?? '__global__';
      const ui = useUIStore.getState();
      try {
        const all = JSON.parse(localStorage.getItem(PANEL_KEY) || '{}');
        all[key] = { activePanel: ui.activePanel, collapsed: ui.rightPanelCollapsed };
        localStorage.setItem(PANEL_KEY, JSON.stringify(all));
      } catch { /* ignore */ }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [currentProjectPath]);

  // Persistent workspace data listener — ensures project store is updated
  // even when Sidebar/ProjectList are not mounted (collapsed or hidden sidebar).
  // When ProjectList IS mounted it also handles these events; the duplicate
  // store update is harmless (idempotent).
  useEffect(() => {
    const applyWorkspaceProjects = (projects: WorkspaceProject[], workspaceName?: string) => {
      const store = useProjectStore.getState();
      // Filter out scanned (discovered) projects — only show workspace projects
      const manual = (projects || []).filter((p) => (p as WorkspaceProject & { source?: string }).source !== 'scanned');
      store.setProjects(manual.map((p) => ({ path: p.path, name: p.name, isFrameProject: p.isFrameProject ?? false, aiTool: p.aiTool })));
      if (workspaceName) store.setWorkspaceName(workspaceName);

      // Auto-select first project if current selection is not in the new list
      const current = store.currentProjectPath;
      const inList = manual.some((p) => p.path === current);
      if (!inList) {
        if (manual.length > 0) {
          store.setProject(manual[0].path, manual[0].isFrameProject ?? false);
        } else {
          store.setProject(null, false);
        }
      }
    };

    const handleData = (_event: unknown, data: WorkspaceData | WorkspaceProject[]) => {
      const list = data && 'projects' in data ? (data as WorkspaceData).projects : (data as WorkspaceProject[]);
      const wsName = data && 'workspaceName' in data ? (data as WorkspaceData & { workspaceName?: string }).workspaceName : undefined;
      applyWorkspaceProjects(list, wsName);
    };

    const handleUpdated = (_event: unknown, data: { projects: WorkspaceProject[]; workspaceName: string }) => {
      const list = data && 'projects' in data ? data.projects : (data as unknown as WorkspaceProject[]);
      applyWorkspaceProjects(list, data?.workspaceName);
    };

    const unsubData = getTransport().on(IPC.WORKSPACE_DATA, handleData);
    const unsubUpdated = getTransport().on(IPC.WORKSPACE_UPDATED, handleUpdated);
    return () => {
      unsubData();
      unsubUpdated();
    };
  }, []);

  // Listen for uninstall result (rollback from onboarding dialog)
  const onboardingResetRef = useRef(onboarding.reset);
  onboardingResetRef.current = onboarding.reset;

  useEffect(() => {
    const handler = (_event: unknown, data: { projectPath: string; result: UninstallResult | null; error?: string }) => {
      setIsRollingBack(false);
      if (data.result?.success) {
        setOnboardingDialogOpen(false);
        onboardingResetRef.current();
      }
    };
    return getTransport().on(IPC.SUBFRAME_UNINSTALLED, handler);
  }, []);

  // Keyboard shortcuts — matching original src/renderer/index.js
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const modKey = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // Ctrl/Cmd+B — Toggle sidebar (expanded <-> hidden)
      if (modKey && !e.shiftKey && key === 'b') {
        e.preventDefault();
        toggleSidebar();
      }

      // Ctrl/Cmd+Shift+S — Toggle tasks panel (Sub-tasks)
      if (modKey && e.shiftKey && key === 's') {
        e.preventDefault();
        togglePanel('tasks');
      }

      // Ctrl/Cmd+Shift+X — Toggle plugins panel
      if (modKey && e.shiftKey && key === 'x') {
        e.preventDefault();
        togglePanel('plugins');
      }

      // Ctrl/Cmd+Shift+G — Toggle GitHub panel
      if (modKey && e.shiftKey && key === 'g') {
        e.preventDefault();
        togglePanel('gitChanges');
      }

      // Ctrl/Cmd+Shift+H — Toggle history panel
      if (modKey && e.shiftKey && key === 'h') {
        e.preventDefault();
        togglePanel('history');
      }

      // Ctrl/Cmd+Shift+A — Toggle agent activity panel
      if (modKey && e.shiftKey && key === 'a') {
        e.preventDefault();
        togglePanel('agentState');
      }

      // Ctrl/Cmd+Shift+U — Toggle system panel (full-view)
      if (modKey && e.shiftKey && key === 'u') {
        e.preventDefault();
        toggleFullView('system');
      }

      // Ctrl/Cmd+Shift+Y — handled by TerminalArea (toggleFullView('pipeline'))

      // Ctrl/Cmd+, — Toggle settings
      if (modKey && !e.shiftKey && key === ',') {
        e.preventDefault();
        setSettingsOpen(true);
      }

      // Ctrl/Cmd+Shift+[ — Previous project
      if (modKey && e.shiftKey && e.key === '[') {
        e.preventDefault();
        selectAdjacentProject(-1);
      }

      // Ctrl/Cmd+Shift+] — Next project
      if (modKey && e.shiftKey && e.key === ']') {
        e.preventDefault();
        selectAdjacentProject(1);
      }

      // Ctrl/Cmd+E — Focus project list
      if (modKey && !e.shiftKey && key === 'e') {
        e.preventDefault();
        requestSidebarFocus('projects');
      }

      // Ctrl/Cmd+Shift+E — Focus file tree
      if (modKey && e.shiftKey && key === 'e') {
        e.preventDefault();
        requestSidebarFocus('files');
      }

      // Ctrl/Cmd+? (Ctrl+Shift+/) — Keyboard shortcuts help
      if (modKey && e.shiftKey && (key === '?' || key === '/')) {
        e.preventDefault();
        setShortcutsHelpOpen(true);
      }

      // Ctrl/Cmd+Shift+Enter — Start AI tool
      if (modKey && e.shiftKey && key === 'enter') {
        e.preventDefault();
        window.dispatchEvent(new Event('start-ai-tool'));
      }

      // ── Workspace switching: Ctrl+Alt+1-9 (active workspaces only) ──
      if (modKey && e.altKey && !e.shiftKey && key >= '1' && key <= '9') {
        const idx = parseInt(key, 10) - 1;
        const wsList = workspaceListRef.current.filter(ws => !ws.inactive);
        if (idx < wsList.length) {
          e.preventDefault();
          typedInvoke(IPC.WORKSPACE_SWITCH, wsList[idx].key)
            .then(() => {
              typedSend(IPC.LOAD_WORKSPACE);
              refetchWorkspaceListRef.current();
            })
            .catch(() => { /* workspace switch failed — silently ignored */ });
        }
      }

      // Ctrl+Alt+[ — Previous workspace (active only)
      if (modKey && e.altKey && e.key === '[') {
        const wsList = workspaceListRef.current.filter(ws => !ws.inactive);
        const activeKey = activeWorkspaceKeyRef.current;
        if (wsList.length > 1 && activeKey) {
          e.preventDefault();
          const activeIdx = wsList.findIndex((ws) => ws.key === activeKey);
          if (activeIdx === -1) return;
          const prev = (activeIdx - 1 + wsList.length) % wsList.length;
          typedInvoke(IPC.WORKSPACE_SWITCH, wsList[prev].key)
            .then(() => {
              typedSend(IPC.LOAD_WORKSPACE);
              refetchWorkspaceListRef.current();
            })
            .catch(() => { /* workspace switch failed */ });
        }
      }

      // Ctrl+Alt+] — Next workspace (active only)
      if (modKey && e.altKey && e.key === ']') {
        const wsList = workspaceListRef.current.filter(ws => !ws.inactive);
        const activeKey = activeWorkspaceKeyRef.current;
        if (wsList.length > 1 && activeKey) {
          e.preventDefault();
          const activeIdx = wsList.findIndex((ws) => ws.key === activeKey);
          if (activeIdx === -1) return;
          const next = (activeIdx + 1) % wsList.length;
          typedInvoke(IPC.WORKSPACE_SWITCH, wsList[next].key)
            .then(() => {
              typedSend(IPC.LOAD_WORKSPACE);
              refetchWorkspaceListRef.current();
            })
            .catch(() => { /* workspace switch failed */ });
        }
      }
    },
    [toggleSidebar, togglePanel, setSettingsOpen, setShortcutsHelpOpen, selectAdjacentProject, requestSidebarFocus]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Dismiss the index.html loading overlay now that React has rendered
  useEffect(() => {
    window.__dismissLoadingScreen?.();
  }, []);

  // Sync live desktop UI state for remote web hydration.
  useEffect(() => {
    const snapshot = buildLiveUIStateSnapshot({
      sidebarState,
      sidebarWidth,
      activePanel,
      rightPanelCollapsed,
      rightPanelWidth,
      settingsOpen,
      shortcutsHelpOpen,
      fullViewContent,
      openTabs,
    });
    if (consumeMirroredUISyncSuppression(snapshot)) {
      return;
    }

    getTransport().send(IPC.WEB_SESSION_SYNC, {
      origin: getTransport().platform.isElectron ? 'electron' : 'web',
      currentProjectPath,
      ui: snapshot,
    });
  }, [
    activePanel,
    currentProjectPath,
    fullViewContent,
    openTabs,
    rightPanelCollapsed,
    rightPanelWidth,
    settingsOpen,
    shortcutsHelpOpen,
    sidebarState,
    sidebarWidth,
  ]);

  // Apply remote UI sync back into the desktop host so browser-originated
  // panel and dialog changes mirror in the Electron window too.
  useEffect(() => {
    if (!getTransport().platform.isElectron) return;

    return getTransport().on(IPC.WEB_SESSION_SYNC, (_event, payload) => {
      if (!payload || typeof payload !== 'object') return;
      const data = payload as {
        origin?: 'electron' | 'web';
        ui?: ReturnType<typeof buildLiveUIStateSnapshot> | null;
      };
      if (data.origin !== 'web') return;
      if (data.ui) {
        applyLiveUIStateSnapshot(data.ui);
      }
    });
  }, []);

  // Listen for menu-triggered actions from main process
  useEffect(() => {
    const onToggleSidebar = () => useUIStore.getState().toggleSidebar();
    const onToggleRightPanel = () => {
      const { activePanel, togglePanel, setActivePanel } = useUIStore.getState();
      if (activePanel) {
        togglePanel(activePanel);
      } else {
        setActivePanel('tasks');
      }
    };
    const onResetLayout = () => {
      // Reset sidebar
      const uiStore = useUIStore.getState();
      uiStore.setSidebarState('expanded');
      uiStore.setSidebarWidth(220);
      // Reset right panel
      uiStore.setActivePanel(null);
      uiStore.setRightPanelWidth(380);
      uiStore.setRightPanelCollapsed(false);
      // Reset terminal layout
      const termStore = useTerminalStore.getState();
      termStore.setViewMode('tabs');
      termStore.setGridLayout('1x2');
      termStore.setMaximizedTerminal(null);
      // Clear persisted grid cell sizes
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('terminal-grid-sizes-')) {
          localStorage.removeItem(key);
        }
      }
    };
    const onCloseTerminal = () => {
      window.dispatchEvent(new CustomEvent('menu-close-terminal'));
    };
    const onOpenSettings = () => useUIStore.getState().setSettingsOpen(true);
    const onNewTerminal = () => {
      window.dispatchEvent(new CustomEvent('menu-new-terminal'));
    };

    const unsubs = [
      getTransport().on(IPC.MENU_TOGGLE_SIDEBAR, onToggleSidebar),
      getTransport().on(IPC.MENU_TOGGLE_RIGHT_PANEL, onToggleRightPanel),
      getTransport().on(IPC.MENU_RESET_LAYOUT, onResetLayout),
      getTransport().on(IPC.MENU_CLOSE_TERMINAL, onCloseTerminal),
      getTransport().on(IPC.MENU_OPEN_SETTINGS, onOpenSettings),
      getTransport().on(IPC.MENU_NEW_TERMINAL, onNewTerminal),
    ];

    return () => { unsubs.forEach(fn => fn()); };
  }, []);

  // Listen for CLI integration events (file/project open from command line)
  useEffect(() => {
    const onCliOpenFile = (_event: unknown, filePath: string) => {
      useUIStore.getState().setEditorFilePath(filePath);
    };
    const onCliOpenProject = (_event: unknown, dirPath: string) => {
      // Trigger project selection via the same flow as folder picker
      const store = useProjectStore.getState();
      store.setProject(dirPath, false);
      getTransport().send(IPC.CHECK_IS_FRAME_PROJECT, dirPath);
    };

    const unsubFile = getTransport().on(IPC.CLI_OPEN_FILE, onCliOpenFile);
    const unsubProject = getTransport().on(IPC.CLI_OPEN_PROJECT, onCliOpenProject);
    return () => {
      unsubFile();
      unsubProject();
    };
  }, []);

  // Listen for onboarding trigger after project init
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.projectPath) {
        onboarding.detect(detail.projectPath).catch(() => {
          // Error already captured in hook state
        });
        setOnboardingDialogOpen(true);
      }
    };
    window.addEventListener('start-onboarding', handler);
    return () => window.removeEventListener('start-onboarding', handler);
  }, [onboarding]);

  // Auto-open dialog when detection completes (e.g. from SubFrame Health "AI Analysis" button)
  useEffect(() => {
    if (onboarding.detection) setOnboardingDialogOpen(true);
  }, [onboarding.detection]);

  // Re-open dialog when analysis results arrive (e.g. after user clicked "Open Terminal")
  // Only auto-reopens if the user hasn't explicitly dismissed it
  useEffect(() => {
    if (onboarding.analysisResult && !onboardingDialogOpen && !userDismissedAnalysisRef.current) {
      setOnboardingDialogOpen(true);
    }
  }, [onboarding.analysisResult, onboardingDialogOpen]);

  // Responsive viewport — web mobile gets a different layout
  const { isMobile, isTablet, isWeb } = useViewport();

  // Compute sidebar pixel width for CSS
  const resolvedSidebarWidth =
    sidebarState === 'hidden' ? 0 : sidebarState === 'collapsed' ? 54 : sidebarWidth;

  // Mobile web layout — simplified bottom-tab navigation
  if (isMobile && isWeb) {
    return (
      <>
        <RemotePointerPublisher />
        <RemoteCursorOverlay />
        <MobileApp />
        <SettingsPanel />
        <ThemeProvider />
      </>
    );
  }

  // Tablet web layout — collapsed sidebar + overlay panels
  if (isTablet && isWeb) {
    return (
      <>
        <RemotePointerPublisher />
        <RemoteCursorOverlay />
        <TabletApp />
        <SettingsPanel />
        <CommandPalette />
        <ThemeProvider />
      </>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg-deep text-text-primary font-sans">
      <RemotePointerPublisher />
      <RemoteCursorOverlay />
      {/* Sidebar */}
      <AnimatePresence initial={false}>
        {sidebarState !== 'hidden' && (
          <motion.div
            key="sidebar"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: resolvedSidebarWidth, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: isResizing ? 0 : 0.2, ease: 'easeInOut' }}
            className="relative flex-shrink-0 overflow-hidden"
          >
            <ErrorBoundary name="Sidebar"><Sidebar /></ErrorBoundary>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content area — terminal placeholder + right panel */}
      <div className="flex flex-1 min-w-0">
        {/* Terminal area — always present, takes remaining space */}
        <div className="flex-1 min-w-0 flex flex-col bg-bg-deep">
          {/* Analysis banner — shown when dialog is closed but analysis is active, errored, or results are ready */}
          {!onboardingDialogOpen && (onboarding.isAnalyzing || onboarding.error || onboarding.cancelled || (onboarding.analysisResult && !onboarding.importResult)) && (
            <div className={cn(
              "flex items-center gap-2 px-3 py-1.5 border-b shrink-0",
              onboarding.error ? "bg-error/10 border-error/20"
                : onboarding.cancelled ? "bg-bg-secondary border-border-subtle"
                : "bg-accent/10 border-accent/20"
            )}>
              {onboarding.isAnalyzing ? (
                <>
                  <div className="size-3 rounded-full border-2 border-accent border-t-transparent animate-spin" />
                  <span className="text-xs text-text-secondary">
                    AI analysis running...
                  </span>
                </>
              ) : onboarding.cancelled ? (
                <>
                  <span className="size-2 rounded-full bg-text-muted" />
                  <span className="text-xs text-text-secondary">
                    Analysis cancelled
                  </span>
                </>
              ) : onboarding.error ? (
                <>
                  <span className="size-2 rounded-full bg-error" />
                  <span className="text-xs text-text-secondary">
                    Analysis failed
                  </span>
                </>
              ) : (
                <>
                  <span className="size-2 rounded-full bg-success" />
                  <span className="text-xs text-text-secondary">
                    Analysis complete — ready to review
                  </span>
                </>
              )}
              <button
                type="button"
                onClick={() => focusActivityBar({ mode: 'activity', streamId: onboarding.activityStreamId })}
                className="ml-auto text-xs text-text-secondary hover:text-text-primary font-medium transition-colors"
              >
                View Activity
              </button>
              <button
                type="button"
                onClick={() => { userDismissedAnalysisRef.current = false; setOnboardingDialogOpen(true); }}
                className="text-xs text-accent hover:text-accent/80 font-medium transition-colors"
              >
                {onboarding.isAnalyzing ? 'View Progress' : onboarding.error ? 'View Error' : onboarding.cancelled ? 'Start Again' : 'Review Results'}
              </button>
            </div>
          )}
          <div id="terminal-container-react" className="flex-1 min-h-0">
            <ErrorBoundary name="Terminal"><TerminalArea /></ErrorBoundary>
          </div>
          <ActivityBar />
          <StatusBar />
        </div>

        {/* Right panel — conditionally visible */}
        <AnimatePresence initial={false}>
          {activePanel && (
            <motion.div
              key="right-panel"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: rightPanelCollapsed ? 44 : rightPanelWidth, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: isResizing ? 0 : 0.2, ease: 'easeInOut' }}
              className="flex-shrink-0 overflow-hidden border-l border-border-subtle bg-bg-primary"
            >
              <div className="h-full w-full">
                <ErrorBoundary name="Right Panel"><RightPanel /></ErrorBoundary>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* File editor dialog — overlay mode only (tab mode renders inside TerminalArea) */}
      {(localStorage.getItem('editor-view-mode') || 'overlay') === 'overlay' && (
        <Editor filePath={editorFilePath} onClose={() => setEditorFilePath(null)} />
      )}

      {/* Settings dialog (modal, renders above everything) */}
      <SettingsPanel />

      {/* Command palette (Ctrl+/) */}
      <CommandPalette />

      {/* Prompt library (Ctrl+Shift+L) */}
      <PromptLibrary />

      {/* Quick tasks palette (Ctrl+') */}
      <TasksPalette />

      {/* AI Tool palette (Ctrl+.) */}
      <AIToolPalette />

      {/* What's New dialog (auto-shows after updates) */}
      <WhatsNew />

      {/* Auto-updater notification (side-effect only, renders null) */}
      <UpdateNotification />

      {/* Graceful shutdown dialog (opens when closing with active work) */}
      <GracefulShutdownDialog />

      {/* Theme provider (side-effect only, applies CSS custom properties) */}
      <ThemeProvider />

      {/* Onboarding dialog for project intelligence */}
      <OnboardingDialog
        open={onboardingDialogOpen}
        onOpenChange={(open) => {
          setOnboardingDialogOpen(open);
          // Track explicit user dismissal to prevent auto-reopen bounce
          if (!open && onboarding.analysisResult) userDismissedAnalysisRef.current = true;
          // Full-reset only when closing and analysis isn't running
          if (!open && !onboarding.isAnalyzing) onboarding.reset();
        }}
        detection={onboarding.detection}
        analysisResult={onboarding.analysisResult}
        progress={onboarding.progress}
        terminalId={onboarding.terminalId}
        activityStreamId={onboarding.activityStreamId}
        isAnalyzing={onboarding.isAnalyzing}
        isImporting={onboarding.isImporting}
        error={onboarding.error}
        importResult={onboarding.importResult}
        aiToolName={aiToolConfig?.activeTool.name || 'Claude Code'}
        onAnalyze={(options) => { if (currentProjectPath) { userDismissedAnalysisRef.current = false; onboarding.analyze(currentProjectPath, options); } }}
        onPreviewPrompt={(options) => currentProjectPath ? onboarding.previewPrompt(currentProjectPath, options) : Promise.resolve({ prompt: '', contextSize: 0 })}
        onBrowseFiles={(type) => currentProjectPath ? onboarding.browseFiles(currentProjectPath, type) : Promise.resolve([])}
        onRetry={() => onboarding.retry()}
        onImport={(selections) => {
          if (currentProjectPath && onboarding.analysisResult) {
            onboarding.importResults(currentProjectPath, onboarding.analysisResult, selections);
          }
        }}
        onCancel={() => { if (currentProjectPath) onboarding.cancel(currentProjectPath); }}
        onRollback={() => {
          if (currentProjectPath) {
            setIsRollingBack(true);
            // Cancel any running analysis first
            if (onboarding.isAnalyzing) onboarding.cancel(currentProjectPath);
            typedSend(IPC.UNINSTALL_SUBFRAME, {
              projectPath: currentProjectPath,
              options: {
                removeClaudeHooks: true,
                removeGitHooks: true,
                removeBacklinks: true,
                removeAgentsMd: true,
                removeClaudeSkills: true,
                removeSubframeDir: true,
                dryRun: false,
              },
            });
          }
        }}
        isRollingBack={isRollingBack}
        stalled={onboarding.stalled}
        stallDurationMs={onboarding.stallDurationMs}
        timeoutMs={onboarding.timeoutMs}
        onViewTerminal={() => {
          if (onboarding.terminalId) {
            // Close right panel and switch to the analysis terminal
            useUIStore.getState().setActivePanel(null);
            useTerminalStore.getState().setActiveTerminal(onboarding.terminalId);
          }
        }}
      />
    </div>
  );
}

