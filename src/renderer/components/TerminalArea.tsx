/**
 * Terminal area orchestrator.
 * Renders the tab bar and either a single terminal (tabs mode)
 * or the terminal grid (grid mode). Manages terminal creation/destruction
 * via IPC and keyboard shortcuts. Scopes terminals per-project with hot-swap.
 */

import { useEffect, useCallback, useRef } from 'react';
import { X, ArrowLeft } from 'lucide-react';
import { TerminalTabBar } from './TerminalTabBar';
import { TerminalGrid } from './TerminalGrid';
import { Terminal } from './Terminal';
import { OverviewPanel } from './OverviewPanel';
import { StructureMap } from './StructureMap';
import { TasksPanel } from './TasksPanel';
import { StatsDetailView } from './StatsDetailView';
import { DecisionsDetailView } from './DecisionsDetailView';
import { ErrorBoundary } from './ErrorBoundary';
import { useTerminalStore } from '../stores/useTerminalStore';
import { useProjectStore } from '../stores/useProjectStore';
import { useUIStore } from '../stores/useUIStore';
import { typedSend } from '../lib/ipc';
import { typedInvoke } from '../lib/ipc';
import { IPC } from '../../shared/ipcChannels';
import { getLogoSVG } from '../../shared/logoSVG';

const { ipcRenderer } = require('electron');

/** localStorage key for per-project terminal sessions */
const SESSION_KEY = 'subframe-terminal-sessions';
const GLOBAL_PROJECT = '__global__';

interface SessionData {
  viewMode: 'tabs' | 'grid';
  activeTerminalId: string | null;
  terminalNames: Record<string, string>;
}

function saveSession(projectPath: string | null, store: ReturnType<typeof useTerminalStore.getState>) {
  const key = projectPath ?? GLOBAL_PROJECT;
  const terminals = Array.from(store.terminals.values()).filter(
    (t) => t.projectPath === projectPath
  );
  if (terminals.length === 0) return;

  const data: SessionData = {
    viewMode: store.viewMode,
    activeTerminalId: store.activeTerminalId,
    terminalNames: Object.fromEntries(terminals.map((t) => [t.id, t.name])),
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
  const switchToProject = useTerminalStore((s) => s.switchToProject);

  const currentProjectPath = useProjectStore((s) => s.currentProjectPath);
  const togglePanel = useUIStore((s) => s.togglePanel);
  const fullViewContent = useUIStore((s) => s.fullViewContent);
  const setFullViewContent = useUIStore((s) => s.setFullViewContent);
  const toggleFullView = useUIStore((s) => s.toggleFullView);
  const setShortcutsHelpOpen = useUIStore((s) => s.setShortcutsHelpOpen);
  const prevProjectRef = useRef<string | null>(null);
  const hasRestoredInitialRef = useRef(false);
  const terminalCounterRef = useRef(0);

  // Filter terminals for current project (normalise null → '' for comparison)
  const normalizedPath = currentProjectPath ?? '';
  const projectTerminals = Array.from(terminals.values())
    .filter((t) => (t.projectPath || '') === normalizedPath)
    .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0) || a.id.localeCompare(b.id));

  // Create terminal helper (ref guard prevents double-clicks)
  const creatingTerminal = useRef(false);
  const createTerminal = useCallback(
    (shell?: string) => {
      if (creatingTerminal.current) return;
      creatingTerminal.current = true;
      typedSend(IPC.TERMINAL_CREATE, {
        projectPath: currentProjectPath ?? undefined,
        shell: shell ?? undefined,
        cwd: currentProjectPath ?? undefined,
      });
    },
    [currentProjectPath]
  );

  // Close terminal helper — scoped to current project
  const closeTerminal = useCallback(
    (id: string) => {
      removeTerminal(id, normalizedPath);
      typedSend(IPC.TERMINAL_DESTROY, id);
    },
    [removeTerminal, normalizedPath]
  );

  // Listen for TERMINAL_CREATED from main process
  useEffect(() => {
    const handler = (
      _event: unknown,
      data: { terminalId?: string; success: boolean; error?: string }
    ) => {
      creatingTerminal.current = false;
      if (data.success && data.terminalId) {
        terminalCounterRef.current += 1;
        addTerminal({
          id: data.terminalId,
          name: `Terminal ${terminalCounterRef.current}`,
          projectPath: currentProjectPath ?? '',
          isActive: true,
        });
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
      if (terminals.has(data.terminalId)) {
        removeTerminal(data.terminalId, normalizedPath);
      }
    };
    ipcRenderer.on(IPC.TERMINAL_DESTROYED, handler);
    return () => {
      ipcRenderer.removeListener(IPC.TERMINAL_DESTROYED, handler);
    };
  }, [terminals, removeTerminal, normalizedPath]);

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
        // Restore names for any terminals that already exist
        for (const [id, name] of Object.entries(session.terminalNames)) {
          if (terminals.has(id)) renameTerminal(id, name);
        }
      }

      // Use switchToProject for O(1) active terminal restoration
      switchToProject(normalizedPath);

      prevProjectRef.current = currentProjectPath;
      hasRestoredInitialRef.current = true;
    }
  }, [currentProjectPath, terminals, setViewMode, renameTerminal, switchToProject, normalizedPath]);

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
            setFullViewContent('overview');
          } else {
            setFullViewContent(null);
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

      // Ctrl+Tab / Ctrl+Shift+Tab — Next/Prev terminal
      if (modKey && e.key === 'Tab') {
        e.preventDefault();
        if (projectTerminals.length <= 1) return;
        const currentIdx = projectTerminals.findIndex((t) => t.id === activeTerminalId);
        const direction = e.shiftKey ? -1 : 1;
        let nextIdx = currentIdx + direction;
        if (nextIdx < 0) nextIdx = projectTerminals.length - 1;
        if (nextIdx >= projectTerminals.length) nextIdx = 0;
        setActiveTerminal(projectTerminals[nextIdx].id);
        return;
      }

      // Ctrl+1-9 — Jump to terminal N
      if (modKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const idx = parseInt(e.key) - 1;
        if (idx < projectTerminals.length) {
          setActiveTerminal(projectTerminals[idx].id);
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
    viewMode,
    setViewMode,
  ]);

  // Mouse back/forward buttons — navigate full-view overlay
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      // Mouse button 3 = back, 4 = forward
      if (e.button === 3 && fullViewContent) {
        e.preventDefault();
        // Detail views go back to overview; overview closes entirely
        if (fullViewContent === 'stats' || fullViewContent === 'decisions' || fullViewContent === 'structureMap' || fullViewContent === 'tasks') {
          setFullViewContent('overview');
        } else {
          setFullViewContent(null);
        }
      }
    };
    document.addEventListener('mouseup', handler);
    return () => document.removeEventListener('mouseup', handler);
  }, [fullViewContent, setFullViewContent]);

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
  };
  const fullViewTitle = fullViewContent ? fullViewTitles[fullViewContent] ?? '' : '';

  return (
    <div className="flex flex-col h-full w-full">
      <TerminalTabBar
        onCreateTerminal={createTerminal}
        onCloseTerminal={closeTerminal}
        onOverviewToggle={() => togglePanel('overview')}
        onTogglePanel={(panel) => togglePanel(panel)}
        projectTerminals={projectTerminals}
      />

      <div className="flex-1 min-h-0">
        {fullViewContent ? (
          /* Full-view overlay — replaces terminal content */
          <div className="flex flex-col h-full bg-bg-primary">
            {/* Full-view top bar */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-border-subtle bg-bg-secondary shrink-0">
              <div className="flex items-center gap-2">
                {fullViewContent && fullViewContent !== 'overview' && (
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
                onClick={() => setFullViewContent(null)}
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
                  <StructureMap open inline onClose={() => setFullViewContent(null)} />
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
                  Start AI
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
                  <span className="text-text-tertiary text-left">Start AI Tool</span>

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
        ) : viewMode === 'tabs' ? (
          /* Single terminal — show only the active one */
          activeTerminalId ? (
            <Terminal terminalId={activeTerminalId} />
          ) : null
        ) : (
          /* Grid view */
          <TerminalGrid onCloseTerminal={closeTerminal} onCreateTerminal={createTerminal} projectTerminals={projectTerminals} />
        )}
      </div>
    </div>
  );
}
