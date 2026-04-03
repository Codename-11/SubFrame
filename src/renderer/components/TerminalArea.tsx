/**
 * Terminal area orchestrator.
 * Renders the tab bar and either a single terminal (tabs mode)
 * or the terminal grid (grid mode). Manages terminal creation/destruction
 * via IPC and keyboard shortcuts. Scopes terminals per-project with hot-swap.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { X, ArrowLeft, ExternalLink, Sparkles, Loader2 } from 'lucide-react';
import { TerminalTabBar } from './TerminalTabBar';
import { generateTerminalName, getUsedTerminalNames } from '../lib/terminalNames';
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
import { SystemPanel } from './SystemPanel';
import { Editor } from './Editor';
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
import { useUIStore, getTabIdForContent, isEditorTab, makeEditorTabId } from '../stores/useUIStore';
import { useSettings, useAIToolConfig } from '../hooks/useSettings';
import { typedSend } from '../lib/ipc';
import { typedInvoke } from '../lib/ipc';
import { IPC } from '../../shared/ipcChannels';
import * as terminalRegistry from '../lib/terminalRegistry';
import { getLogoSVG } from '../../shared/logoSVG';
import { toast } from 'sonner';
import { getTransport } from '../lib/transportProvider';

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
  terminalCwds?: Record<string, string>;      // id -> last known cwd
  terminalShells?: Record<string, string>;     // id -> shell path
  terminalSessionIds?: Record<string, string>; // id -> claude session id
  editorOpenFiles?: string[];                  // open editor file paths
  activeEditorFile?: string | null;            // currently active editor file
}

/** Terminal state snapshot from main process (cached during save) */
interface TerminalStateSnapshot {
  terminals: Array<{ id: string; cwd: string; shell: string; claudeActive: boolean; sessionId: string | null; projectPath: string | null }>;
}

function buildSessionData(
  projectPath: string | null,
  store: ReturnType<typeof useTerminalStore.getState>,
  terminalState?: TerminalStateSnapshot | null,
): SessionData {
  const normalizedPath = projectPath ?? '';
  const terminals = Array.from(store.terminals.values()).filter(
    (t) => (t.projectPath || '') === normalizedPath
  );
  // Capture tab order: terminal IDs sorted by current display order (createdAt)
  const tabOrder = [...terminals]
    .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0) || a.id.localeCompare(b.id))
    .map((t) => t.id);

  // Build cwd/shell/session maps from terminal state snapshot (if available)
  const terminalCwds: Record<string, string> = {};
  const terminalShells: Record<string, string> = {};
  const terminalSessionIds: Record<string, string> = {};
  if (terminalState?.terminals) {
    const terminalIds = new Set(terminals.map((t) => t.id));
    for (const ts of terminalState.terminals) {
      if (!terminalIds.has(ts.id)) continue;
      if (ts.cwd) terminalCwds[ts.id] = ts.cwd;
      if (ts.shell) terminalShells[ts.id] = ts.shell;
      if (ts.sessionId) terminalSessionIds[ts.id] = ts.sessionId;
    }
  }

  // Include editor state from UI store
  const uiState = useUIStore.getState();
  const editorOpenFiles = uiState.editorOpenFiles.length > 0 ? uiState.editorOpenFiles : undefined;
  const activeEditorFile = uiState.activeEditorFile ?? undefined;

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
    gridSlots: store.gridSlotsByProject.get(normalizedPath) ?? store.gridSlots,
    tabOrder,
    maximizedTerminalId: terminals.length > 0 ? store.maximizedTerminalId : null,
    terminalCwds: Object.keys(terminalCwds).length > 0 ? terminalCwds : undefined,
    terminalShells: Object.keys(terminalShells).length > 0 ? terminalShells : undefined,
    terminalSessionIds: Object.keys(terminalSessionIds).length > 0 ? terminalSessionIds : undefined,
    editorOpenFiles,
    activeEditorFile: activeEditorFile ?? null,
  };

  return data;
}

function syncLiveWebSession(projectPath: string | null, data: SessionData) {
  getTransport().send(IPC.WEB_SESSION_SYNC, {
    origin: getTransport().platform.isElectron ? 'electron' : 'web',
    currentProjectPath: projectPath,
    session: data,
  });
}

function saveSession(
  projectPath: string | null,
  store: ReturnType<typeof useTerminalStore.getState>,
  terminalState?: TerminalStateSnapshot | null,
) {
  const key = projectPath ?? GLOBAL_PROJECT;
  const data = buildSessionData(projectPath, store, terminalState);

  try {
    const all = JSON.parse(localStorage.getItem(SESSION_KEY) || '{}');
    all[key] = data;
    localStorage.setItem(SESSION_KEY, JSON.stringify(all));
  } catch {
    // ignore
  }

  syncLiveWebSession(projectPath, data);
}

/** Fetch terminal state from main process and save session with it */
async function saveSessionWithState(
  projectPath: string | null,
  store: ReturnType<typeof useTerminalStore.getState>,
) {
  try {
    const state = await typedInvoke(IPC.GET_TERMINAL_STATE);
    saveSession(projectPath, store, state);
  } catch {
    // Fallback: save without terminal state
    saveSession(projectPath, store, null);
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
  const isFrameProject = useProjectStore((s) => s.isFrameProject);
  const workspaceName = useProjectStore((s) => s.workspaceName);
  const workspaceProjects = useProjectStore((s) => s.projects);
  const fullViewContent = useUIStore((s) => s.fullViewContent);
  const setFullViewContent = useUIStore((s) => s.setFullViewContent);
  const toggleFullView = useUIStore((s) => s.toggleFullView);
  const closeTab = useUIStore((s) => s.closeTab);
  const setShortcutsHelpOpen = useUIStore((s) => s.setShortcutsHelpOpen);
  const activeEditorFile = useUIStore((s) => s.activeEditorFile);
  const closeEditorFile = useUIStore((s) => s.closeEditorFile);
  const openTabs = useUIStore((s) => s.openTabs);
  const { settings } = useSettings();
  const { config: aiToolConfig } = useAIToolConfig();
  const aiToolName = aiToolConfig?.activeTool.name || 'AI Tool';
  const [combineWorkspaceTerminals, setCombineWorkspaceTerminals] = useState(false);
  const prevProjectRef = useRef<string | null>(null);
  /** Tracks which project path we have successfully restored terminal-dependent state for.
   *  `null` means restoration is pending (terminals not yet available). */
  const restoredForProjectRef = useRef<string | null>(null);
  const terminalCounterRef = useRef(0);
  /** Tracks whether we've initiated terminal restoration for this project (prevents double-creation) */
  const restoringTerminalsRef = useRef<string | null>(null);
  /** Cached terminal state from main process — used for synchronous saves (e.g. beforeunload) */
  const cachedTerminalStateRef = useRef<TerminalStateSnapshot | null>(null);
  /** True after renderer hot reload resync has been attempted (prevents duplicate resync) */
  const resyncAttemptedRef = useRef(false);

  // ── Renderer Hot Reload: Terminal Resync ──────────────────────────────────
  // On mount, check if the main process has active terminals that the renderer
  // doesn't know about (i.e. this is a renderer reload, not a fresh app launch).
  // If so, re-populate the Zustand store and let terminalRegistry re-hydrate
  // each xterm instance from the backlog when Terminal components mount.
  useEffect(() => {
    if (resyncAttemptedRef.current) return;
    resyncAttemptedRef.current = true;

    // Only resync if the store is empty (fresh renderer) — if terminals exist,
    // this is a normal mount, not a reload.
    const storeHasTerminals = useTerminalStore.getState().terminals.size > 0;
    if (storeHasTerminals) return;

    typedInvoke(IPC.TERMINAL_RESYNC).then((result: {
      terminals: Array<{
        terminalId: string;
        cwd: string;
        shell: string;
        projectPath: string | null;
        claudeActive: boolean;
        cols: number;
        rows: number;
        sessionId: string | null;
        backlog: string;
      }>;
    }) => {
      if (!result.terminals || result.terminals.length === 0) return;

      console.log(`[hot-reload] Resyncing ${result.terminals.length} terminal(s) from main process`);

      // Restore session data from localStorage to recover names, tab order, etc.
      const session = loadSession(currentProjectPath);

      for (const t of result.terminals) {
        // Add to Zustand store (renderer-side terminal state)
        const savedName = session?.terminalNames?.[t.terminalId];
        addTerminal({
          id: t.terminalId,
          name: savedName || t.terminalId,
          projectPath: t.projectPath || '',
          isActive: false,
        });

        // Mark claude-active status (restore sessionId for session tracking)
        if (t.claudeActive) {
          setClaudeActive(t.terminalId, true, t.sessionId ?? undefined);
        }
      }

      // Restore active terminal from session or pick the first one
      const firstForProject = result.terminals.find(
        (t) => (t.projectPath || '') === (currentProjectPath ?? '')
      );
      if (session?.activeTerminalId && result.terminals.some((t) => t.terminalId === session.activeTerminalId)) {
        setActiveTerminal(session.activeTerminalId);
      } else if (firstForProject) {
        setActiveTerminal(firstForProject.terminalId);
      }

      // Signal to the main process that the renderer has reloaded
      typedSend(IPC.RENDERER_RELOADED);
    }).catch((err: unknown) => {
      console.warn('[hot-reload] Terminal resync failed:', err);
    });
    // Only run once on mount — deps intentionally limited
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter terminals for current project (normalise null → '' for comparison)
  const normalizedPath = currentProjectPath ?? '';
  const pinnedTerminals = useTerminalStore((s) => s.pinnedTerminals);
  const workspaceProjectPaths = useMemo(
    () => new Set(workspaceProjects.map((project) => project.path)),
    [workspaceProjects]
  );
  const hasOtherWorkspaceProjects = useMemo(
    () => workspaceProjects.some((project) => project.path !== normalizedPath),
    [workspaceProjects, normalizedPath]
  );
  const nativeProjectTerminals = Array.from(terminals.values())
    .filter((t) => (t.projectPath || '') === normalizedPath)
    .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0) || a.id.localeCompare(b.id));

  const workspaceTerminals = Array.from(terminals.values())
    .filter((t) => workspaceProjectPaths.has(t.projectPath || ''))
    .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0) || a.id.localeCompare(b.id));

  // Include pinned terminals from other projects
  const pinnedFromOtherProjects = Array.from(terminals.values())
    .filter((t) => pinnedTerminals.has(t.id) && (t.projectPath || '') !== normalizedPath)
    .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0) || a.id.localeCompare(b.id));

  const pinnedOutsideWorkspace = Array.from(terminals.values())
    .filter((t) => pinnedTerminals.has(t.id) && !workspaceProjectPaths.has(t.projectPath || ''))
    .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0) || a.id.localeCompare(b.id));

  // Project mode: native project terminals + pinned extras.
  // Combine mode: all workspace terminals + pinned terminals from outside the workspace.
  const projectTerminals = combineWorkspaceTerminals
    ? [...workspaceTerminals, ...pinnedOutsideWorkspace]
    : [...nativeProjectTerminals, ...pinnedFromOtherProjects];

  // Grid overflow detection — when active terminal exceeds grid capacity,
  // temporarily show it in single view instead of the grid
  const gridLayout = useTerminalStore((s) => s.gridLayout);
  const general = (settings?.general as Record<string, unknown>) ?? {};
  const gridOverflowAutoSwitch = general.gridOverflowAutoSwitch !== false;
  const gridMaxCells = (() => {
    const m = gridLayout.match(/^(\d+)x(\d+)$/);
    if (m) return Number(m[1]) * Number(m[2]);
    // Asymmetric 3-slot layouts
    if (['2L1R', '1L2R', '2T1B', '1T2B'].includes(gridLayout)) return 3;
    return 4;
  })();
  const gridTerminalIds = new Set(projectTerminals.slice(0, gridMaxCells).map(t => t.id));
  const activeIsOverflow = viewMode === 'grid'
    && activeTerminalId != null
    && projectTerminals.length > gridMaxCells
    && !gridTerminalIds.has(activeTerminalId);
  const showOverflowSingle = gridOverflowAutoSwitch && activeIsOverflow;

  // Auto-enable combine mode for multi-project workspaces (working on them together
  // is the whole point of grouping dirs into one workspace). The user can still toggle
  // it off via the Mix button; the effect only re-fires when workspace or project count changes.
  useEffect(() => {
    setCombineWorkspaceTerminals(hasOtherWorkspaceProjects);
  }, [workspaceName, hasOtherWorkspaceProjects]);

  // If combine mode is turned off while focused on a foreign terminal, restore the active terminal for the current project.
  useEffect(() => {
    if (!activeTerminalId) return;
    if (projectTerminals.some((terminal) => terminal.id === activeTerminalId)) return;
    switchToProject(normalizedPath);
  }, [activeTerminalId, projectTerminals, switchToProject, normalizedPath]);

  // Create terminal helper (ref guard prevents double-clicks, with safety timeout)
  const creatingTerminal = useRef(false);
  const [terminalPending, setTerminalPending] = useState(false);
  const createTerminal = useCallback(
    (shell?: string) => {
      if (creatingTerminal.current) return;
      creatingTerminal.current = true;
      setTerminalPending(true);

      // Safety timeout — if IPC reply is missed (e.g. listener removed during re-render),
      // reset the guard so the user isn't permanently locked out.
      const safetyTimeout = setTimeout(() => {
        if (creatingTerminal.current) {
          creatingTerminal.current = false;
          setTerminalPending(false);
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
    return getTransport().on(IPC.TERMINAL_POPOUT_STATUS, handler);
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
        setTerminalPending(false);
      }

      if (data.success && data.terminalId) {
        terminalCounterRef.current += 1;
        const defaultName = data.name || generateTerminalName(getUsedTerminalNames(terminals));
        addTerminal({
          id: data.terminalId,
          name: defaultName,
          projectPath: data.projectPath || currentProjectPath || '',
          isActive: !data.background,
        });
        // Restore scrollback and optionally resume Claude session (gated by settings)
        const tid = data.terminalId;
        const projPath = data.projectPath || currentProjectPath;
        if (projPath) {
          setTimeout(() => {
            typedInvoke(IPC.LOAD_SETTINGS, ...([] as [])).then((settings: any) => {
              // Restore scrollback (only if setting enabled)
              const restoreScrollback = settings?.terminal?.restoreScrollback ?? false;
              if (restoreScrollback) {
                typedInvoke(IPC.LOAD_TERMINAL_SCROLLBACK, { projectPath: projPath, terminalId: tid })
                  .then((result: { lines: string[] }) => {
                    if (result.lines.length > 0) {
                      terminalRegistry.importScrollback(tid, result.lines);
                    }
                  })
                  .catch(() => {});
              }

              // Check for Claude session resume
              const session = loadSession(projPath);
              const sessionId = session?.terminalSessionIds?.[tid];
              if (sessionId) {
                const resumeMode = settings?.terminal?.autoResumeAgent ?? 'prompt';
                if (resumeMode === 'never') return;
                const resumeCmd = `claude --resume ${sessionId}\r`;
                if (resumeMode === 'auto') {
                  setTimeout(() => {
                    getTransport().send(IPC.TERMINAL_INPUT_ID, { terminalId: tid, data: resumeCmd });
                  }, 1000);
                } else {
                  toast.info('Previous Claude session found', {
                    description: `Resume session in this terminal?`,
                    duration: 15000,
                    action: {
                      label: 'Resume',
                      onClick: () => {
                        getTransport().send(IPC.TERMINAL_INPUT_ID, { terminalId: tid, data: resumeCmd });
                      },
                    },
                  });
                }
              }
            }).catch(() => {});
          }, 500);
        }
      } else if (data.error) {
        toast.error(`Failed to create terminal: ${data.error}`);
      }
    };
    const unsub = getTransport().on(IPC.TERMINAL_CREATED, handler);
    return unsub;
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
      // Clear stale close-confirmation dialog if this terminal was pending
      setPendingCloseId((prev) => (prev === data.terminalId ? null : prev));
    };
    const unsub = getTransport().on(IPC.TERMINAL_DESTROYED, handler);
    return unsub;
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
    const unsub = getTransport().on(IPC.CLAUDE_ACTIVE_STATUS, handler);
    return unsub;
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

  // Per-project session save/restore on project switch and deferred terminal arrival.
  //
  // Two-phase restoration: non-terminal-dependent state (viewMode, gridLayout, gridSlots) is
  // restored immediately on project switch.  Terminal-dependent state (tab order, names, active
  // terminal, maximized) is deferred until ALL session terminals exist in the store — fixing the
  // race where the effect fires before TERMINAL_CREATED IPC events arrive on app launch.
  // A 3-second timeout prevents permanent blocking if a terminal was destroyed between sessions.
  const restoreStartTimeRef = useRef<number>(0);
  useEffect(() => {
    const isProjectSwitch = prevProjectRef.current !== currentProjectPath;

    // ── Phase 1: Save outgoing + restore non-terminal state (only on project switch) ──
    if (isProjectSwitch) {
      if (prevProjectRef.current !== null) {
        saveSession(prevProjectRef.current, useTerminalStore.getState(), cachedTerminalStateRef.current);
      }
      // Cancel any pending auto-save from the previous project
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      prevProjectRef.current = currentProjectPath;
      restoredForProjectRef.current = null; // Reset — need to restore for new project
      restoringTerminalsRef.current = null;
      restoreStartTimeRef.current = Date.now();

      const session = loadSession(currentProjectPath);
      if (session) {
        if (session.viewMode) setViewMode(session.viewMode);
        if (session.gridLayout) {
          useTerminalStore.getState().setGridLayout(session.gridLayout as any);
        }
        if (session.gridSlots && Array.isArray(session.gridSlots)) {
          useTerminalStore.getState().setGridSlots(session.gridSlots, normalizedPath);
        }

        // ── Editor Restore: Reopen saved editor files as view tabs ──
        // First, remove old editor tabs from openTabs (they belong to the previous project)
        const uiStore = useUIStore.getState();
        let nextOpenTabs = uiStore.openTabs.filter(t => !isEditorTab(t.id));

        if (session.editorOpenFiles && session.editorOpenFiles.length > 0) {
          // Filter to files that are within the current project (prevents cross-project ghost tabs).
          // Normalise separators for comparison.
          const normProject = (currentProjectPath ?? '').replace(/\\/g, '/');
          const validFiles = session.editorOpenFiles.filter((fp) => {
            const norm = fp.replace(/\\/g, '/');
            return normProject && norm.startsWith(normProject);
          });

          for (const fp of validFiles) {
            const tabId = makeEditorTabId(fp);
            if (!nextOpenTabs.some(t => t.id === tabId)) {
              const fileName = fp.replace(/\\/g, '/').split('/').pop() ?? fp;
              nextOpenTabs = [...nextOpenTabs, { id: tabId, label: fileName, closable: true }];
            }
          }
          const validActive = session.activeEditorFile && validFiles.includes(session.activeEditorFile)
            ? session.activeEditorFile
            : (validFiles[0] ?? null);
          useUIStore.setState({
            editorOpenFiles: validFiles,
            activeEditorFile: validActive,
            editorFilePath: validActive,
            openTabs: nextOpenTabs,
            dirtyEditorFiles: new Set<string>(),
          });
        } else {
          // Clear editor state from previous project
          useUIStore.setState({
            editorOpenFiles: [],
            activeEditorFile: null,
            editorFilePath: null,
            openTabs: nextOpenTabs,
            dirtyEditorFiles: new Set<string>(),
          });
        }

        // ── Terminal Restore: Create terminals with saved cwd/shell ──
        // When the session has saved terminal state and restoreOnStartup is enabled,
        // create the terminals now instead of waiting for them to appear.
        const hasSavedTerminals = session.terminalCwds && Object.keys(session.terminalCwds).length > 0;
        if (hasSavedTerminals && restoringTerminalsRef.current !== normalizedPath) {
          restoringTerminalsRef.current = normalizedPath;
          // Check restoreOnStartup setting asynchronously, then create terminals
          typedInvoke(IPC.LOAD_SETTINGS, ...([] as [])).then((settingsData: any) => {
            const restoreEnabled = settingsData?.terminal?.restoreOnStartup ?? true;
            if (!restoreEnabled) {
              restoringTerminalsRef.current = null;
              return;
            }
            const terminalIds = session.tabOrder ?? Object.keys(session.terminalCwds!);
            for (const id of terminalIds) {
              // Only create if this terminal has saved state and isn't already in the store
              if (!session.terminalCwds![id]) continue;
              if (useTerminalStore.getState().terminals.has(id)) continue;
              const payload: Record<string, string> = {
                cwd: session.terminalCwds![id],
              };
              if (currentProjectPath) payload.projectPath = currentProjectPath;
              if (session.terminalShells?.[id]) payload.shell = session.terminalShells[id];
              typedSend(IPC.TERMINAL_CREATE, payload as any);
            }
          }).catch(() => {
            restoringTerminalsRef.current = null;
          });
        }
      }
    }

    // ── Phase 2: Restore terminal-dependent state (retries until terminals exist) ──
    if (restoredForProjectRef.current === normalizedPath) {
      return; // Already restored for this project
    }

    const session = loadSession(currentProjectPath);
    if (!session) {
      switchToProject(normalizedPath);
      restoredForProjectRef.current = normalizedPath;
      void saveSessionWithState(currentProjectPath, useTerminalStore.getState());
      return;
    }

    // Check if ALL session terminals exist yet (not just any one — partial restore loses later arrivals)
    const sessionTerminalIds = new Set([
      ...(session.tabOrder ?? []),
      ...Object.keys(session.terminalNames),
      ...(session.activeTerminalId ? [session.activeTerminalId] : []),
    ]);
    const store = useTerminalStore.getState();
    const allPresent = sessionTerminalIds.size === 0 ||
      [...sessionTerminalIds].every((id) => store.terminals.has(id));
    // Timeout fallback: if a terminal was destroyed between sessions, don't block forever
    const timedOut = Date.now() - restoreStartTimeRef.current > 3000;

    if (!allPresent && !timedOut) {
      return; // Terminals not all populated yet — will retry when terminals Map changes
    }

    // Restore names (preserve original nameSource)
    for (const [id, name] of Object.entries(session.terminalNames)) {
      if (store.terminals.has(id)) {
        const source = session.terminalNameSources?.[id] ?? 'default';
        renameTerminal(id, name, source);
      }
    }

    // Restore tab order by updating createdAt timestamps
    if (session.tabOrder && session.tabOrder.length > 0) {
      const validIds = session.tabOrder.filter((id) => store.terminals.has(id));
      if (validIds.length > 0) {
        store.reorderTerminals(validIds);
      }
    }

    // Populate activeByProject from saved activeTerminalId
    if (session.activeTerminalId && store.terminals.has(session.activeTerminalId)) {
      const abp = new Map(store.activeByProject);
      abp.set(normalizedPath, session.activeTerminalId);
      useTerminalStore.setState({ activeByProject: abp });
    }

    // Restore maximized terminal state
    if (session.maximizedTerminalId && store.terminals.has(session.maximizedTerminalId)) {
      store.setMaximizedTerminal(session.maximizedTerminalId);
    } else {
      store.setMaximizedTerminal(null);
    }

    // switchToProject before marking restored — so auto-save captures post-switch state
    switchToProject(normalizedPath);
    restoredForProjectRef.current = normalizedPath;
    void saveSessionWithState(currentProjectPath, useTerminalStore.getState());
  }, [currentProjectPath, terminals, setViewMode, renameTerminal, switchToProject, normalizedPath]);

  // Periodically cache terminal state from main process for synchronous saves.
  // Also refresh on terminal count changes.
  useEffect(() => {
    const refresh = () => {
      typedInvoke(IPC.GET_TERMINAL_STATE).then((state) => {
        cachedTerminalStateRef.current = state;
      }).catch(() => { /* ignore */ });
    };
    refresh(); // Immediate fetch
    const interval = setInterval(refresh, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, [terminals.size]); // Re-trigger on terminal count change

  // Auto-save session when tab order or grid slots change (debounced).
  // Ensures reorder and grid-swap state persists immediately — not just on project switch / beforeunload.
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gridSlots = useTerminalStore((s) => s.gridSlots);
  useEffect(() => {
    // Skip during initial restoration
    if (restoredForProjectRef.current !== normalizedPath) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      saveSessionWithState(currentProjectPath, useTerminalStore.getState());
    }, 300);
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
    // projectTerminals changes when createdAt changes (reorder), gridSlots changes on grid swap
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectTerminals, gridSlots, currentProjectPath]);

  // Keep the live web-session snapshot aligned with the current desktop terminal state
  // so remote clients inherit the host's terminal names/layout immediately instead of
  // waiting for the next autosave or project switch.
  useEffect(() => {
    if (!getTransport().platform.isElectron) return;
    if (restoredForProjectRef.current !== normalizedPath) return;
    syncLiveWebSession(currentProjectPath, buildSessionData(currentProjectPath, useTerminalStore.getState(), cachedTerminalStateRef.current));
  }, [
    currentProjectPath,
    normalizedPath,
    projectTerminals,
    activeTerminalId,
    viewMode,
    gridLayout,
    gridSlots,
  ]);

  // Save scrollback for all terminals in a project (fire-and-forget)
  const saveScrollbackForProject = useCallback((projPath: string | null) => {
    if (!projPath) return;
    const store = useTerminalStore.getState();
    for (const [id] of store.terminals) {
      const lines = terminalRegistry.exportScrollback(id, 5000);
      if (lines.length > 0) {
        typedInvoke(IPC.SAVE_TERMINAL_SCROLLBACK, { projectPath: projPath, terminalId: id, lines }).catch(() => {});
      }
    }
  }, []);

  // Periodic scrollback auto-save (every 30s) — primary persistence path
  useEffect(() => {
    const interval = setInterval(() => {
      if (currentProjectPath && restoredForProjectRef.current === normalizedPath) {
        saveScrollbackForProject(currentProjectPath);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [currentProjectPath, normalizedPath, saveScrollbackForProject]);

  // Save session on app close — localStorage (sync) + scrollback (best-effort async)
  useEffect(() => {
    const handler = () => {
      saveSession(currentProjectPath, useTerminalStore.getState(), cachedTerminalStateRef.current);
      saveScrollbackForProject(currentProjectPath);
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [currentProjectPath, saveScrollbackForProject]);

  // Auto-create first terminal when project is selected and none exist
  // (skip if terminal restore is in progress — it will create them)
  // Use nativeProjectTerminals (not projectTerminals) so pinned cross-project terminals don't prevent auto-create
  useEffect(() => {
    if (currentProjectPath && nativeProjectTerminals.length === 0) {
      // Check if terminal restore is in progress for this project
      const session = loadSession(currentProjectPath);
      const hasSavedTerminals = session?.terminalCwds && Object.keys(session.terminalCwds).length > 0;
      if (hasSavedTerminals && restoringTerminalsRef.current === (currentProjectPath ?? '')) {
        return; // Skip — terminals will be created by the restore logic
      }

      typedInvoke(IPC.LOAD_SETTINGS, ...([] as [])).then((loadedSettings: any) => {
        const autoCreate = loadedSettings?.general?.autoCreateTerminal ?? false;
        if (autoCreate) {
          // Re-check: terminals may have been created by restore while we awaited settings
          const currentTerminals = Array.from(useTerminalStore.getState().terminals.values())
            .filter((t) => (t.projectPath || '') === (currentProjectPath ?? ''));
          if (currentTerminals.length === 0) {
            createTerminal();
          }
        }
      }).catch(() => {
        // Default: create terminal (only if still empty)
        const currentTerminals = Array.from(useTerminalStore.getState().terminals.values())
          .filter((t) => (t.projectPath || '') === (currentProjectPath ?? ''));
        if (currentTerminals.length === 0) {
          createTerminal();
        }
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

      // Ctrl+W — Close active editor tab (when an editor tab is active)
      if (modKey && !e.shiftKey && key === 'w') {
        const currentActiveEditor = useUIStore.getState().activeEditorFile;
        if (currentActiveEditor) {
          e.preventDefault();
          closeEditorFile(currentActiveEditor);
          return;
        }
      }

      // Ctrl+Shift+D — Pop out active terminal
      if (modKey && e.shiftKey && key === 'd') {
        e.preventDefault();
        if (activeTerminalId) {
          typedInvoke(IPC.TERMINAL_POPOUT, activeTerminalId);
        }
        return;
      }

      // Ctrl+Shift+R — Restart terminal shell
      if (modKey && e.shiftKey && key === 'r') {
        e.preventDefault();
        if (activeTerminalId) {
          typedInvoke(IPC.TERMINAL_RESTART, activeTerminalId).then((r) => {
            if (r.success) toast.success('Shell restarted');
            else toast.error(r.error || 'Failed to restart shell');
          }).catch(() => toast.error('Failed to restart shell'));
        }
        return;
      }

      // Ctrl+Shift+F — Freeze/resume terminal output
      if (modKey && e.shiftKey && key === 'f') {
        e.preventDefault();
        if (activeTerminalId) {
          const { frozenTerminals, toggleFreezeTerminal } = useTerminalStore.getState();
          if (frozenTerminals.has(activeTerminalId)) {
            terminalRegistry.unfreeze(activeTerminalId);
          } else {
            terminalRegistry.freeze(activeTerminalId);
          }
          toggleFreezeTerminal(activeTerminalId);
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
    const unsub = getTransport().on(IPC.RUN_COMMAND, handler);
    return unsub;
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

  // Determine if an editor tab is active in the ViewTabBar
  const isEditorTabActive = !fullViewContent && !!activeEditorFile && openTabs.some(t => isEditorTab(t.id) && t.id === makeEditorTabId(activeEditorFile));

  return (
    <div className="flex flex-col h-full w-full">
      <ViewTabBar />
      {!fullViewContent && !isEditorTabActive && (
        <TerminalTabBar
          onCreateTerminal={createTerminal}
          onCloseTerminal={closeTerminal}
          onPopOutTerminal={popOutTerminal}
          projectTerminals={projectTerminals}
          currentProjectPath={normalizedPath}
          combineWorkspaceTerminals={combineWorkspaceTerminals}
          canCombineWorkspaceTerminals={hasOtherWorkspaceProjects}
          workspaceTerminalCount={workspaceTerminals.length}
          onToggleCombine={() => setCombineWorkspaceTerminals((value) => !value)}
          gridOverflowIds={viewMode === 'grid' && projectTerminals.length > gridMaxCells
            ? new Set(projectTerminals.slice(gridMaxCells).map(t => t.id))
            : undefined}
          terminalCreating={terminalPending}
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
                {fullViewContent === 'system' && (
                  <SystemPanel isFullView />
                )}
              </ErrorBoundary>
            </div>
          </div>
        ) : isEditorTabActive && activeEditorFile ? (
          /* Editor tab — inline editor in ViewTabBar */
          <ErrorBoundary name="Editor">
            <Editor
              filePath={activeEditorFile}
              onClose={() => closeEditorFile(activeEditorFile)}
              inline
            />
          </ErrorBoundary>
        ) : projectTerminals.length === 0 ? (
          terminalPending ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
            </div>
          ) : (
          <div className="flex h-full items-center justify-center text-text-tertiary">
            <div className="text-center max-w-xs">
              {/* Animated SubFrame logo */}
              <div
                className="mx-auto mb-4"
                style={{ width: 64, height: 64 }}
                dangerouslySetInnerHTML={{ __html: getLogoSVG({ size: 64, id: 'empty-state-logo', frame: false }) }}
              />

              <p className="text-sm text-text-secondary font-medium">
                {currentProjectPath
                  ? (combineWorkspaceTerminals ? 'No terminals in this workspace' : 'No terminals for this project')
                  : 'Select a project to get started'}
              </p>

              <div className="mt-4 w-full space-y-2.5">
                {currentProjectPath && !isFrameProject && (
                  <button
                    onClick={() => window.dispatchEvent(new Event('open-frame-init'))}
                    className="w-full bg-accent-subtle text-accent border border-accent/20 hover:bg-accent/20 px-4 py-2.5 rounded-md text-sm font-semibold cursor-pointer transition-colors shadow-sm inline-flex items-center justify-center gap-2"
                  >
                    <Sparkles className="size-4" />
                    Initialize with SubFrame
                  </button>
                )}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    onClick={() => window.dispatchEvent(new Event('start-ai-tool'))}
                    disabled={!currentProjectPath}
                    className={`w-full px-4 py-2.5 rounded-md text-sm font-semibold transition-colors shadow-sm ${
                      currentProjectPath
                        ? 'bg-success/20 text-success border border-success/30 hover:bg-success/30 cursor-pointer shadow-success/10'
                        : 'bg-bg-elevated text-text-muted border border-border-subtle cursor-not-allowed'
                    }`}
                  >
                    Start {aiToolName}
                  </button>
                  <button
                    onClick={() => createTerminal()}
                    className="w-full bg-accent/15 text-accent border border-accent/25 hover:bg-accent/25 px-4 py-2.5 rounded-md text-sm font-semibold cursor-pointer transition-colors shadow-sm"
                  >
                    New Terminal
                  </button>
                </div>
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
          )
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
          <TerminalGrid onCloseTerminal={closeTerminal} onCreateTerminal={createTerminal} onPopOutTerminal={popOutTerminal} projectTerminals={projectTerminals} projectPath={normalizedPath} />
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
