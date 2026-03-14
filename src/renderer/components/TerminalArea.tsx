/**
 * Terminal area orchestrator.
 * Renders the tab bar and either a single terminal (tabs mode)
 * or the terminal grid (grid mode). Manages terminal creation/destruction
 * via IPC and keyboard shortcuts. Scopes terminals per-project with hot-swap.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, ArrowLeft, ExternalLink } from 'lucide-react';
import { TerminalTabBar } from './TerminalTabBar';
import { TerminalGrid } from './TerminalGrid';
import { Terminal } from './Terminal';
import { OverviewPanel } from './OverviewPanel';
import { StructureMap } from './StructureMap';
import { TasksPanel } from './TasksPanel';
import { StatsDetailView } from './StatsDetailView';
import { DecisionsDetailView } from './DecisionsDetailView';
import { PipelinePanel } from './PipelinePanel';
import { AgentStateView } from './AgentStateView';
import { ShortcutsPanel } from './ShortcutsPanel';
import { ViewTabBar } from './ViewTabBar';
import { ErrorBoundary } from './ErrorBoundary';
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
import { useTerminalStore } from '../stores/useTerminalStore';
import { useProjectStore } from '../stores/useProjectStore';
import { useUIStore, getTabIdForContent } from '../stores/useUIStore';
import { useSettings, useAIToolConfig } from '../hooks/useSettings';
import { typedSend } from '../lib/ipc';
import { typedInvoke } from '../lib/ipc';
import { IPC } from '../../shared/ipcChannels';
import * as terminalRegistry from '../lib/terminalRegistry';
import { getLogoSVG } from '../../shared/logoSVG';
import { toast } from 'sonner';

const { ipcRenderer } = require('electron');

/** localStorage key for per-project terminal sessions */
const SESSION_KEY = 'subframe-terminal-sessions';
const GLOBAL_PROJECT = '__global__';

interface SessionData {
  viewMode: 'tabs' | 'grid';
  activeTerminalId: string | null;
  terminalNames: Record<string, string>;
  terminalNameSources?: Record<string, 'default' | 'user' | 'session'>;
  gridLayout?: string;
  gridSlots?: (string | null)[];
  tabOrder?: string[];
  maximizedTerminalId?: string | null;
}

function saveSession(projectPath: string | null, store: ReturnType<typeof useTerminalStore.getState>) {
  const key = projectPath ?? GLOBAL_PROJECT;
  const normalizedPath = projectPath ?? '';
  const terminals = Array.from(store.terminals.values()).filter(
    (t) => (t.projectPath || '') === normalizedPath
  );
  // Capture tab order: terminal IDs sorted by current display order (createdAt)
  const tabOrder = [...terminals]
    .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0) || a.id.localeCompare(b.id))
    .map((t) => t.id);

  // Save even when terminals.length === 0 so stale session data gets cleared
  const data: SessionData = {
    viewMode: store.viewMode,
    activeTerminalId: terminals.length > 0
      ? (store.activeByProject.get(normalizedPath) ?? store.activeTerminalId)
      : null,
    terminalNames: Object.fromEntries(terminals.map((t) => [t.id, t.name])),
    terminalNameSources: Object.fromEntries(
      terminals.filter((t) => t.nameSource).map((t) => [t.id, t.nameSource!])
    ),
    gridLayout: store.gridLayout,
    gridSlots: store.gridSlots,
    tabOrder,
    maximizedTerminalId: terminals.length > 0 ? store.maximizedTerminalId : null,
  };

  try {
    const all = JSON.parse(localStorage.getItem(SESSION_KEY) || '{}');
    all[key] = data;
    localStorage.setItem(SESSION_KEY, JSON.stringify(all));
  } catch {
    // ignore
  }
}

function loadSession(projectPath: string | null): SessionData | null {
  const key = projectPath ?? GLOBAL_PROJECT;
  try {
    const all = JSON.parse(localStorage.getItem(SESSION_KEY) || '{}');
    return all[key] ?? null;
  } catch {
    return null;
  }
}

export function TerminalArea() {
  const terminals = useTerminalStore((s) => s.terminals);
  const activeTerminalId = useTerminalStore((s) => s.activeTerminalId);
  const viewMode = useTerminalStore((s) => s.viewMode);
  const addTerminal = useTerminalStore((s) => s.addTerminal);
  const removeTerminal = useTerminalStore((s) => s.removeTerminal);
  const setActiveTerminal = useTerminalStore((s) => s.setActiveTerminal);
  const setViewMode = useTerminalStore((s) => s.setViewMode);
  const renameTerminal = useTerminalStore((s) => s.renameTerminal);
  const setClaudeActive = useTerminalStore((s) => s.setClaudeActive);
  const setPoppedOut = useTerminalStore((s) => s.setPoppedOut);
  const switchToProject = useTerminalStore((s) => s.switchToProject);

  const currentProjectPath = useProjectStore((s) => s.currentProjectPath);
  const fullViewContent = useUIStore((s) => s.fullViewContent);
  const setFullViewContent = useUIStore((s) => s.setFullViewContent);
  const toggleFullView = useUIStore((s) => s.toggleFullView);
  const closeTab = useUIStore((s) => s.closeTab);
  const setShortcutsHelpOpen = useUIStore((s) => s.setShortcutsHelpOpen);
  const { settings } = useSettings();
  const { config: aiToolConfig } = useAIToolConfig();
  const aiToolName = aiToolConfig?.activeTool.name || 'AI Tool';
  const prevProjectRef = useRef<string | null>(null);
  const hasRestoredInitialRef = useRef(false);
  const terminalCounterRef = useRef(0);

  // Filter terminals for current project (normalise null → '' for comparison)
  const normalizedPath = currentProjectPath ?? '';
  const projectTerminals = Array.from(terminals.values())
    .filter((t) => (t.projectPath || '') === normalizedPath)
    .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0) || a.id.localeCompare(b.id));

  // Grid overflow detection — when active terminal exceeds grid capacity,
  // temporarily show it in single view instead of the grid
  const gridLayout = useTerminalStore((s) => s.gridLayout);
  const general = (settings?.general as Record<string, unknown>) ?? {};
  const gridOverflowAutoSwitch = general.gridOverflowAutoSwitch !== false;
  const gridMaxCells = (() => {
    const m = gridLayout.match(/^(\d+)x(\d+)$/);
    return m ? Number(m[1]) * Number(m[2]) : 4;
  })();
  const gridTerminalIds = new Set(projectTerminals.slice(0, gridMaxCells).map(t => t.id));
  const activeIsOverflow = viewMode === 'grid'
    && activeTerminalId != null
    && projectTerminals.length > gridMaxCells
    && !gridTerminalIds.has(activeTerminalId);
  const showOverflowSingle = gridOverflowAutoSwitch && activeIsOverflow;

  // Create terminal helper (ref guard prevents double-clicks, with safety timeout)
  const creatingTerminal = useRef(false);
  const createTerminal = useCallback(
    (shell?: string) => {
      if (creatingTerminal.current) return;
      creatingTerminal.current = true;

      // Safety timeout — if IPC reply is missed (e.g. listener removed during re-render),
      // reset the guard so the user isn't permanently locked out.
      const safetyTimeout = setTimeout(() => {
        if (creatingTerminal.current) {
          creatingTerminal.current = false;
        }
      }, 5000);
      (creatingTerminal as any)._safetyTimeout = safetyTimeout;

      const payload: Record<string, string> = {};
      if (currentProjectPath) { payload.projectPath = currentProjectPath; payload.cwd = currentProjectPath; }
      if (typeof shell === 'string') { payload.shell = shell; }
      typedSend(IPC.TERMINAL_CREATE, payload as any);
    },
    [currentProjectPath]
  );

  // Close-with-active-agent confirmation state
  const [pendingCloseId, setPendingCloseId] = useState<string | null>(null);

  // Force-close a terminal (no further checks)
  const forceCloseTerminal = useCallback(
    (id: string) => {
      const currentPath = useProjectStore.getState().currentProjectPath ?? '';
      terminalRegistry.dispose(id);
      removeTerminal(id, currentPath);
      typedSend(IPC.TERMINAL_DESTROY, id);
    },
    [removeTerminal]
  );

  // Close terminal helper — shows confirmation dialog if an agent is active
  const closeTerminal = useCallback(
    (id: string) => {
      const info = useTerminalStore.getState().terminals.get(id);
      if (info?.claudeActive) {
        setPendingCloseId(id);
        return;
      }
      forceCloseTerminal(id);
    },
    [forceCloseTerminal]
  );

  // Pop out terminal handler
  const popOutTerminal = useCallback(
    (terminalId: string) => {
      typedInvoke(IPC.TERMINAL_POPOUT, terminalId).catch(() => {});
    },
    []
  );

  // Listen for pop-out status changes from main process
  const setMaximizedTerminal = useTerminalStore((s) => s.setMaximizedTerminal);
  useEffect(() => {
    const handler = (_event: unknown, data: { terminalId: string; poppedOut: boolean }) => {
      setPoppedOut(data.terminalId, data.poppedOut);
      // Clear maximized state if the maximized terminal was popped out
      if (data.poppedOut && useTerminalStore.getState().maximizedTerminalId === data.terminalId) {
        setMaximizedTerminal(null);
      }
    };
    ipcRenderer.on(IPC.TERMINAL_POPOUT_STATUS, handler);
    return () => { ipcRenderer.removeListener(IPC.TERMINAL_POPOUT_STATUS, handler); };
  }, [setPoppedOut, setMaximizedTerminal]);

  // Listen for TERMINAL_CREATED from main process
  useEffect(() => {
    const handler = (
      _event: unknown,
      data: { terminalId?: string; success: boolean; error?: string; projectPath?: string; name?: string; background?: boolean }
    ) => {
      // Only clear the user-initiated creation guard for non-background terminals
      if (!data.background) {
        clearTimeout((creatingTerminal as any)._safetyTimeout);
        creatingTerminal.current = false;
      }

      if (data.success && data.terminalId) {
        terminalCounterRef.current += 1;
        addTerminal({
          id: data.terminalId,
          name: data.name || `Terminal ${terminalCounterRef.current}`,
          projectPath: data.projectPath || currentProjectPath || '',
          isActive: !data.background,
        });
      } else if (data.error) {
        toast.error(`Failed to create terminal: ${data.error}`);
      }
    };
    ipcRenderer.on(IPC.TERMINAL_CREATED, handler);
    return () => {
      ipcRenderer.removeListener(IPC.TERMINAL_CREATED, handler);
    };
  }, [addTerminal, currentProjectPath]);

  // Listen for TERMINAL_DESTROYED from main process
  useEffect(() => {
    const handler = (_event: unknown, data: { terminalId: string }) => {
      const store = useTerminalStore.getState();
      if (store.terminals.has(data.terminalId)) {
        const currentPath = useProjectStore.getState().currentProjectPath ?? '';
        terminalRegistry.dispose(data.terminalId);
        removeTerminal(data.terminalId, currentPath);
      }
    };
    ipcRenderer.on(IPC.TERMINAL_DESTROYED, handler);
    return () => {
      ipcRenderer.removeListener(IPC.TERMINAL_DESTROYED, handler);
    };
  }, [removeTerminal]);

  // Track which terminals have a pending auto-rename to prevent duplicate triggers
  const pendingRenames = useRef(new Set<string>());

  // Listen for agent active status changes — update store + auto-rename tab
  useEffect(() => {
    const handler = (_event: unknown, data: { terminalId: string; active: boolean; sessionId?: string }) => {
      setClaudeActive(data.terminalId, data.active, data.sessionId);

      // Auto-rename tab when agent starts (skip user-renamed tabs)
      if (data.active && data.sessionId) {
        const terminal = useTerminalStore.getState().terminals.get(data.terminalId);
        if (terminal && terminal.nameSource !== 'user' && !pendingRenames.current.has(data.terminalId)) {
          const capturedTerminalId = data.terminalId;
          const capturedSessionId = data.sessionId;
          pendingRenames.current.add(capturedTerminalId);
          setTimeout(async () => {
            try {
              // Re-check: terminal may have been closed or user-renamed during the delay
              const current = useTerminalStore.getState().terminals.get(capturedTerminalId);
              if (!current || current.nameSource === 'user') return;
              const result = await typedInvoke(IPC.GET_TERMINAL_SESSION_NAME, {
                terminalId: capturedTerminalId,
                sessionId: capturedSessionId,
              });
              if (result.name && current.name !== result.name) {
                renameTerminal(capturedTerminalId, result.name, 'session');
              }
            } catch {
              // Session may not be registered yet
            } finally {
              pendingRenames.current.delete(capturedTerminalId);
            }
          }, 3000);
        }
      }
    };
    ipcRenderer.on(IPC.CLAUDE_ACTIVE_STATUS, handler);
    return () => {
      ipcRenderer.removeListener(IPC.CLAUDE_ACTIVE_STATUS, handler);
    };
  }, [setClaudeActive, renameTerminal]);

  // Listen for menu-triggered close (dispatched from App.tsx menu handler)
  useEffect(() => {
    const handler = () => {
      const { activeTerminalId } = useTerminalStore.getState();
      if (activeTerminalId) closeTerminal(activeTerminalId);
    };
    window.addEventListener('menu-close-terminal', handler);
    return () => window.removeEventListener('menu-close-terminal', handler);
  }, [closeTerminal]);

  // Listen for menu-triggered new terminal (dispatched from App.tsx menu handler)
  useEffect(() => {
    const handler = () => createTerminal();
    window.addEventListener('menu-new-terminal', handler);
    return () => window.removeEventListener('menu-new-terminal', handler);
  }, [createTerminal]);

  // Per-project session save/restore on project switch and initial mount
  useEffect(() => {
    const isProjectSwitch = prevProjectRef.current !== currentProjectPath;
    const isInitialMount = !hasRestoredInitialRef.current;

    if (isProjectSwitch || isInitialMount) {
      // Save outgoing project session (only on project switch, not initial mount)
      if (isProjectSwitch && prevProjectRef.current !== null) {
        saveSession(prevProjectRef.current, useTerminalStore.getState());
      }

      // Restore incoming project session
      const session = loadSession(currentProjectPath);
      if (session) {
        if (session.viewMode) setViewMode(session.viewMode);
        // Restore names for any terminals that already exist (preserve original nameSource)
        for (const [id, name] of Object.entries(session.terminalNames)) {
          if (terminals.has(id)) {
            // Default to 'default' for old session data that didn't persist nameSource,
            // so user-renamed tabs aren't accidentally overwritten by auto-rename
            const source = session.terminalNameSources?.[id] ?? 'default';
            renameTerminal(id, name, source);
          }
        }
        // Gap 2: Restore per-project grid layout
        if (session.gridLayout) {
          useTerminalStore.getState().setGridLayout(session.gridLayout as any);
        }
        // Restore grid slot assignments (drag-swap positions)
        if (session.gridSlots && Array.isArray(session.gridSlots)) {
          useTerminalStore.getState().setGridSlots(session.gridSlots);
        }
        // Gap 3: Restore tab order by updating createdAt timestamps
        if (session.tabOrder && session.tabOrder.length > 0) {
          const store = useTerminalStore.getState();
          // Only reorder IDs that still exist
          const validIds = session.tabOrder.filter((id) => store.terminals.has(id));
          if (validIds.length > 0) {
            store.reorderTerminals(validIds);
          }
        }
        // Gap 4: Populate activeByProject from saved activeTerminalId
        if (session.activeTerminalId && terminals.has(session.activeTerminalId)) {
          const store = useTerminalStore.getState();
          const abp = new Map(store.activeByProject);
          abp.set(normalizedPath, session.activeTerminalId);
          useTerminalStore.setState({ activeByProject: abp });
        }
        // Gap 5: Restore maximized terminal state
        if (session.maximizedTerminalId && terminals.has(session.maximizedTerminalId)) {
          useTerminalStore.getState().setMaximizedTerminal(session.maximizedTerminalId);
        } else {
          useTerminalStore.getState().setMaximizedTerminal(null);
        }
      }

      // Use switchToProject for O(1) active terminal restoration
      switchToProject(normalizedPath);

      prevProjectRef.current = currentProjectPath;
      hasRestoredInitialRef.current = true;
    }
  }, [currentProjectPath, terminals, setViewMode, renameTerminal, switchToProject, normalizedPath]);

  // Save session on app close so grid slot positions persist across restarts
  useEffect(() => {
    const handler = () => {
      saveSession(currentProjectPath, useTerminalStore.getState());
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [currentProjectPath]);

  // Auto-create first terminal when project is selected and none exist
  useEffect(() => {
    if (currentProjectPath && projectTerminals.length === 0) {
      typedInvoke(IPC.LOAD_SETTINGS, ...([] as [])).then((settings: any) => {
        const autoCreate = settings?.general?.autoCreateTerminal ?? false;
        if (autoCreate) {
          createTerminal();
        }
      }).catch(() => {
        // Default: create terminal
        createTerminal();
      });
    }
    // Only run when project changes, not on every terminal list update
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProjectPath]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const modKey = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // Escape — First un-maximize grid cell, then navigate back in full-view overlay
      if (key === 'escape') {
        if (useTerminalStore.getState().maximizedTerminalId) {
          e.preventDefault();
          useTerminalStore.getState().setMaximizedTerminal(null);
          return;
        }
        if (fullViewContent) {
          e.preventDefault();
          if (fullViewContent === 'stats' || fullViewContent === 'decisions' || fullViewContent === 'structureMap' || fullViewContent === 'tasks') {
            // Overview sub-views: navigate back to overview (switch tabs, don't close)
            setFullViewContent('overview');
          } else {
            // Standalone views (overview, pipeline, agentState, shortcuts): close the tab
            closeTab(fullViewContent);
          }
          return;
        }
      }

      // Ctrl+Shift+T — New terminal
      if (modKey && e.shiftKey && key === 't') {
        e.preventDefault();
        createTerminal();
        return;
      }

      // Ctrl+Shift+W — Close current terminal
      if (modKey && e.shiftKey && key === 'w') {
        e.preventDefault();
        if (activeTerminalId) {
          closeTerminal(activeTerminalId);
        }
        return;
      }

      // Ctrl+Shift+D — Pop out active terminal
      if (modKey && e.shiftKey && key === 'd') {
        e.preventDefault();
        if (activeTerminalId) {
          typedInvoke(IPC.TERMINAL_POPOUT, activeTerminalId);
        }
        return;
      }

      // Ctrl+Tab / Ctrl+Shift+Tab — Next/Prev terminal
      if (modKey && e.key === 'Tab') {
        e.preventDefault();
        if (projectTerminals.length <= 1) return;
        const currentIdx = projectTerminals.findIndex((t) => t.id === activeTerminalId);
        const direction = e.shiftKey ? -1 : 1;
        let nextIdx = currentIdx + direction;
        if (nextIdx < 0) nextIdx = projectTerminals.length - 1;
        if (nextIdx >= projectTerminals.length) nextIdx = 0;
        const nextId = projectTerminals[nextIdx].id;
        setActiveTerminal(nextId);
        // Ensure focus reaches the new terminal after React re-renders and DOM reattaches
        setTimeout(() => {
          const instance = terminalRegistry.get(nextId);
          if (instance) instance.terminal.focus();
        }, 50);
        return;
      }

      // Ctrl+1-9 — Jump to terminal N (exclude Alt to avoid conflict with Ctrl+Alt+N workspace switch)
      if (modKey && !e.altKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const idx = parseInt(e.key) - 1;
        if (idx < projectTerminals.length) {
          const targetId = projectTerminals[idx].id;
          setActiveTerminal(targetId);
          // Ensure focus reaches the target terminal after React re-renders
          setTimeout(() => {
            const instance = terminalRegistry.get(targetId);
            if (instance) instance.terminal.focus();
          }, 50);
        }
        return;
      }

      // Ctrl+G — Toggle grid/tab view
      if (modKey && !e.shiftKey && key === 'g') {
        e.preventDefault();
        setViewMode(viewMode === 'tabs' ? 'grid' : 'tabs');
        return;
      }

      // Ctrl+Shift+O — Toggle overview full-view
      if (modKey && e.shiftKey && key === 'o') {
        e.preventDefault();
        toggleFullView('overview');
        return;
      }

      // Ctrl+Shift+K — Toggle tasks full-view
      if (modKey && e.shiftKey && key === 'k') {
        e.preventDefault();
        toggleFullView('tasks');
        return;
      }

      // Ctrl+Shift+Y — Toggle pipeline full-view
      if (modKey && e.shiftKey && key === 'y') {
        e.preventDefault();
        toggleFullView('pipeline');
        return;
      }

    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [
    createTerminal,
    closeTerminal,
    activeTerminalId,
    projectTerminals,
    setActiveTerminal,
    toggleFullView,
    fullViewContent,
    setFullViewContent,
    closeTab,
    viewMode,
    setViewMode,
  ]);

  // Mouse back/forward buttons — navigate full-view overlay
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      // Mouse button 3 = back, 4 = forward
      if (e.button === 3 && fullViewContent) {
        e.preventDefault();
        // Detail views go back to overview; standalone views close the tab
        if (fullViewContent === 'stats' || fullViewContent === 'decisions' || fullViewContent === 'structureMap' || fullViewContent === 'tasks') {
          setFullViewContent('overview');
        } else {
          closeTab(fullViewContent);
        }
      }
    };
    document.addEventListener('mouseup', handler);
    return () => document.removeEventListener('mouseup', handler);
  }, [fullViewContent, setFullViewContent, closeTab]);

  // Listen for RUN_COMMAND from menu accelerators
  useEffect(() => {
    const handler = (_event: unknown, command: string) => {
      if (activeTerminalId) {
        typedSend(IPC.TERMINAL_INPUT_ID, {
          terminalId: activeTerminalId,
          data: command + '\r',
        });
      }
    };
    ipcRenderer.on(IPC.RUN_COMMAND, handler);
    return () => {
      ipcRenderer.removeListener(IPC.RUN_COMMAND, handler);
    };
  }, [activeTerminalId]);

  /** Full-view title label */
  const fullViewTitles: Record<string, string> = {
    overview: 'Project Overview',
    structureMap: 'Structure Map',
    tasks: 'Sub-Tasks',
    stats: 'Repository Stats',
    decisions: 'Project Decisions',
    pipeline: 'Pipeline',
    agentState: 'Agent Activity',
    shortcuts: 'Keyboard Shortcuts',
  };
  const fullViewTitle = fullViewContent ? fullViewTitles[fullViewContent] ?? '' : '';
  const activeTerminalInfo = activeTerminalId ? terminals.get(activeTerminalId) : null;

  return (
    <div className="flex flex-col h-full w-full">
      <ViewTabBar />
      {!fullViewContent && (
        <TerminalTabBar
          onCreateTerminal={createTerminal}
          onCloseTerminal={closeTerminal}
          onPopOutTerminal={popOutTerminal}
          projectTerminals={projectTerminals}
          gridOverflowIds={viewMode === 'grid' && projectTerminals.length > gridMaxCells
            ? new Set(projectTerminals.slice(gridMaxCells).map(t => t.id))
            : undefined}
        />
      )}

      <div className="flex-1 min-h-0">
        {fullViewContent ? (
          /* Full-view overlay — replaces terminal content */
          <div className="flex flex-col h-full bg-bg-primary">
            {/* Full-view top bar */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-border-subtle bg-bg-secondary shrink-0">
              <div className="flex items-center gap-2">
                {fullViewContent && fullViewContent !== 'overview' && fullViewContent !== 'pipeline' && fullViewContent !== 'shortcuts' && (
                  <button
                    onClick={() => setFullViewContent('overview')}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer"
                    title="Back to Overview"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Overview
                  </button>
                )}
                <span className="text-xs font-medium text-text-primary">{fullViewTitle}</span>
              </div>
              <button
                onClick={() => closeTab(getTabIdForContent(fullViewContent!))}
                className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer"
                title="Close (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Full-view content */}
            <div className="flex-1 min-h-0">
              <ErrorBoundary name={fullViewTitle} key={fullViewContent}>
                {fullViewContent === 'overview' && (
                  <OverviewPanel isFullView />
                )}
                {fullViewContent === 'structureMap' && (
                  <StructureMap open inline onClose={() => closeTab('structureMap')} />
                )}
                {fullViewContent === 'tasks' && (
                  <TasksPanel isFullView />
                )}
                {fullViewContent === 'stats' && (
                  <StatsDetailView />
                )}
                {fullViewContent === 'decisions' && (
                  <DecisionsDetailView />
                )}
                {fullViewContent === 'pipeline' && (
                  <PipelinePanel isFullView />
                )}
                {fullViewContent === 'agentState' && (
                  <AgentStateView isFullView />
                )}
                {fullViewContent === 'shortcuts' && (
                  <ShortcutsPanel />
                )}
              </ErrorBoundary>
            </div>
          </div>
        ) : projectTerminals.length === 0 ? (
          <div className="flex h-full items-center justify-center text-text-tertiary">
            <div className="text-center max-w-xs">
              {/* Animated SubFrame logo */}
              <div
                className="mx-auto mb-4"
                style={{ width: 64, height: 64 }}
                dangerouslySetInnerHTML={{ __html: getLogoSVG({ size: 64, id: 'empty-state-logo', frame: false }) }}
              />

              <p className="text-sm text-text-secondary font-medium">
                {currentProjectPath ? 'No terminals for this project' : 'Select a project to get started'}
              </p>

              <div className="flex items-center gap-3 mt-4">
                <button
                  onClick={() => window.dispatchEvent(new Event('start-ai-tool'))}
                  disabled={!currentProjectPath}
                  className={`px-5 py-2.5 rounded-md text-sm font-semibold transition-colors shadow-sm ${
                    currentProjectPath
                      ? 'bg-success/20 text-success border border-success/30 hover:bg-success/30 cursor-pointer shadow-success/10'
                      : 'bg-bg-elevated text-text-muted border border-border-subtle cursor-not-allowed'
                  }`}
                >
                  Start {aiToolName}
                </button>
                <button
                  onClick={() => createTerminal()}
                  className="bg-accent/15 text-accent border border-accent/25 hover:bg-accent/25 px-5 py-2.5 rounded-md text-sm font-semibold cursor-pointer transition-colors shadow-sm"
                >
                  New Terminal
                </button>
              </div>

              {/* Keyboard shortcuts section */}
              <div className="mt-6 pt-4 border-t border-border-subtle">
                <p className="text-[10px] uppercase tracking-wider text-text-muted mb-2">Keyboard Shortcuts</p>
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
                  <kbd className="px-1.5 py-0.5 rounded bg-bg-elevated border border-border-subtle text-[10px] font-mono text-text-tertiary text-right">
                    Ctrl+Shift+Enter
                  </kbd>
                  <span className="text-text-tertiary text-left">Start {aiToolName}</span>

                  <kbd className="px-1.5 py-0.5 rounded bg-bg-elevated border border-border-subtle text-[10px] font-mono text-text-tertiary text-right">
                    Ctrl+Shift+T
                  </kbd>
                  <span className="text-text-tertiary text-left">New Terminal</span>

                  <kbd className="px-1.5 py-0.5 rounded bg-bg-elevated border border-border-subtle text-[10px] font-mono text-text-tertiary text-right">
                    Ctrl+/
                  </kbd>
                  <span className="text-text-tertiary text-left">Command Palette</span>

                  <kbd className="px-1.5 py-0.5 rounded bg-bg-elevated border border-border-subtle text-[10px] font-mono text-text-tertiary text-right">
                    Ctrl+B
                  </kbd>
                  <span className="text-text-tertiary text-left">Toggle Sidebar</span>

                  <kbd className="px-1.5 py-0.5 rounded bg-bg-elevated border border-border-subtle text-[10px] font-mono text-text-tertiary text-right">
                    Ctrl+Shift+O
                  </kbd>
                  <span className="text-text-tertiary text-left">Overview</span>

                  <kbd className="px-1.5 py-0.5 rounded bg-bg-elevated border border-border-subtle text-[10px] font-mono text-text-tertiary text-right">
                    Ctrl+Shift+/
                  </kbd>
                  <button
                    onClick={() => setShortcutsHelpOpen(true)}
                    className="text-accent cursor-pointer hover:underline text-left text-xs p-0 bg-transparent border-none"
                  >
                    All Shortcuts
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : viewMode === 'tabs' || showOverflowSingle ? (
          /* Single terminal — show only the active one (also used for grid overflow auto-switch) */
          activeTerminalId ? (
            activeTerminalInfo?.poppedOut ? (
              <div className="flex h-full items-center justify-center text-text-tertiary">
                <div className="text-center">
                  <ExternalLink className="h-10 w-10 mx-auto mb-3 text-text-muted" />
                  <p className="text-sm text-text-secondary font-medium mb-1">Terminal in separate window</p>
                  <p className="text-xs text-text-muted mb-4">This terminal has been popped out to its own window.</p>
                  <div className="flex items-center gap-2 justify-center">
                    <button
                      onClick={() => typedInvoke(IPC.TERMINAL_POPOUT, activeTerminalId!)}
                      className="px-3 py-1.5 rounded text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover border border-border-subtle transition-colors cursor-pointer"
                    >
                      Focus Window
                    </button>
                    <button
                      onClick={() => typedInvoke(IPC.TERMINAL_DOCK, activeTerminalId!)}
                      className="px-3 py-1.5 rounded text-xs bg-accent/15 text-accent border border-accent/25 hover:bg-accent/25 transition-colors cursor-pointer"
                    >
                      Dock Back
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <Terminal terminalId={activeTerminalId} />
            )
          ) : null
        ) : (
          /* Grid view */
          <TerminalGrid onCloseTerminal={closeTerminal} onCreateTerminal={createTerminal} onPopOutTerminal={popOutTerminal} projectTerminals={projectTerminals} />
        )}
      </div>

      {/* Close active-agent confirmation dialog */}
      <AlertDialog open={!!pendingCloseId} onOpenChange={(open) => !open && setPendingCloseId(null)}>
        <AlertDialogContent className="bg-bg-primary border-border-subtle text-text-primary">
          <AlertDialogHeader>
            <AlertDialogTitle>Close Terminal</AlertDialogTitle>
            <AlertDialogDescription className="text-text-secondary text-xs">
              An AI agent is currently running in this terminal. Closing it will terminate the agent and any in-progress work will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-error text-white hover:bg-error/80 cursor-pointer"
              onClick={() => {
                if (pendingCloseId) forceCloseTerminal(pendingCloseId);
                setPendingCloseId(null);
              }}
            >
              Close Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
