import { create } from 'zustand';
import type { SortingState } from '@tanstack/react-table';

type PanelId = 'tasks' | 'plugins' | 'sessions' | 'gitChanges' | 'githubIssues' | 'githubPRs' | 'githubBranches' | 'githubWorktrees' | 'githubWorkflows' | 'githubNotifications' | 'overview' | 'aiFiles' | 'subframeHealth' | 'history' | 'agentState' | 'skills' | 'prompts' | 'pipeline' | 'system' | null;
type SidebarState = 'expanded' | 'collapsed' | 'hidden';
export type FullViewContent = 'overview' | 'structureMap' | 'tasks' | 'stats' | 'decisions' | 'pipeline' | 'agentState' | 'shortcuts' | 'system' | null;

export interface ViewTab {
  id: string;       // 'terminal' | any FullViewContent value
  label: string;    // Display name for the tab
  closable: boolean; // false for 'terminal'
}

export interface LiveUIStateSnapshot {
  sidebarState: SidebarState;
  sidebarWidth: number;
  activePanel: PanelId;
  rightPanelCollapsed: boolean;
  rightPanelWidth: number;
  settingsOpen: boolean;
  shortcutsHelpOpen: boolean;
  fullViewContent: FullViewContent;
  openTabs: ViewTab[];
}

export const VIEW_TAB_LABELS: Record<string, string> = {
  terminal: 'Terminals',
  overview: 'Overview',
  structureMap: 'Structure Map',
  tasks: 'Tasks',
  stats: 'Stats',
  decisions: 'Decisions',
  pipeline: 'Pipeline',
  agentState: 'Agent Activity',
  shortcuts: 'Keyboard Shortcuts',
  system: 'System',
};

/** Sub-views that render within a parent tab instead of getting their own tab */
const SUB_VIEW_PARENT: Record<string, string> = {
  stats: 'overview',
  decisions: 'overview',
  structureMap: 'overview',
};

/** Resolve a content type to its tab ID (maps sub-views to parent) */
export function getTabIdForContent(content: string): string {
  return SUB_VIEW_PARENT[content] ?? content;
}
export type StatusFilter = 'all' | 'pending' | 'in_progress' | 'completed' | 'blocked';

/** Load persisted openTabs from localStorage (cold start = Terminal only) */
function loadPersistedTabs(): ViewTab[] {
  try {
    const raw = localStorage.getItem('subframe-open-tabs');
    if (raw) {
      const parsed = JSON.parse(raw) as ViewTab[];
      // Ensure terminal tab is always present and non-closable
      if (!parsed.some(t => t.id === 'terminal')) {
        parsed.unshift({ id: 'terminal', label: 'Terminals', closable: false });
      }
      return parsed.map(t => ({ ...t, closable: t.id !== 'terminal' }));
    }
  } catch { /* ignore */ }
  return [{ id: 'terminal', label: 'Terminals', closable: false }];
}

/** Persist openTabs to localStorage */
function persistTabs(tabs: ViewTab[]) {
  try {
    localStorage.setItem('subframe-open-tabs', JSON.stringify(tabs));
  } catch { /* ignore */ }
}

function cloneTabs(tabs: ViewTab[]): ViewTab[] {
  return tabs.map((tab) => ({ ...tab }));
}

function cloneLiveUIStateSnapshot(snapshot: LiveUIStateSnapshot): LiveUIStateSnapshot {
  return {
    ...snapshot,
    openTabs: cloneTabs(snapshot.openTabs),
  };
}

function isSameTabs(left: ViewTab[], right: ViewTab[]): boolean {
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i += 1) {
    const a = left[i];
    const b = right[i];
    if (a.id !== b.id || a.label !== b.label || a.closable !== b.closable) {
      return false;
    }
  }
  return true;
}

function isSameLiveUIState(left: LiveUIStateSnapshot, right: LiveUIStateSnapshot): boolean {
  return (
    left.sidebarState === right.sidebarState &&
    left.sidebarWidth === right.sidebarWidth &&
    left.activePanel === right.activePanel &&
    left.rightPanelCollapsed === right.rightPanelCollapsed &&
    left.rightPanelWidth === right.rightPanelWidth &&
    left.settingsOpen === right.settingsOpen &&
    left.shortcutsHelpOpen === right.shortcutsHelpOpen &&
    left.fullViewContent === right.fullViewContent &&
    isSameTabs(left.openTabs, right.openTabs)
  );
}

let pendingMirroredUISnapshot: LiveUIStateSnapshot | null = null;

interface UIState {
  // Sidebar
  sidebarState: SidebarState;
  sidebarWidth: number;
  setSidebarState: (state: SidebarState) => void;
  setSidebarWidth: (width: number) => void;
  toggleSidebar: () => void;

  // Panels
  activePanel: PanelId;
  rightPanelVisible: boolean;
  rightPanelCollapsed: boolean;
  rightPanelWidth: number;
  setActivePanel: (panel: PanelId) => void;
  setRightPanelCollapsed: (collapsed: boolean) => void;
  setRightPanelWidth: (width: number) => void;
  togglePanel: (panel: PanelId) => void;
  closeRightPanel: () => void;

  // Full-view overlay (renders inside TerminalArea instead of terminal content)
  fullViewContent: FullViewContent;
  setFullViewContent: (content: FullViewContent) => void;
  toggleFullView: (content: 'overview' | 'structureMap' | 'tasks' | 'stats' | 'decisions' | 'pipeline' | 'agentState' | 'shortcuts' | 'system') => void;

  // Tab system
  openTabs: ViewTab[];
  openTab: (id: string, label?: string) => void;
  closeTab: (id: string) => void;

  // Editor
  editorFilePath: string | null;
  setEditorFilePath: (path: string | null) => void;

  // Editor tabs (tab view mode)
  editorOpenFiles: string[];
  activeEditorFile: string | null;
  addEditorFile: (filePath: string) => void;
  closeEditorFile: (filePath: string) => void;
  setActiveEditorFile: (filePath: string | null) => void;

  // Recent editor files
  recentEditorFiles: string[];

  // Focus
  /** Incremented to signal sidebar should focus a specific tab */
  sidebarFocusRequest: { tab: 'projects' | 'files'; seq: number };
  requestSidebarFocus: (tab: 'projects' | 'files') => void;

  // Resize drag state (disables Framer Motion animation during drag)
  isResizing: boolean;
  setIsResizing: (v: boolean) => void;

  // Modals
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  shortcutsHelpOpen: boolean;
  setShortcutsHelpOpen: (open: boolean) => void;

  // TasksPanel sort/filter (session-scoped, survives panel switches)
  tasksSorting: SortingState;
  setTasksSorting: (s: SortingState) => void;
  tasksStatusFilter: StatusFilter;
  setTasksStatusFilter: (f: StatusFilter) => void;
  tasksFilterSetByUser: boolean;
  setTasksFilterSetByUser: (v: boolean) => void;

  // Active task enhancement request (survives panel/view switches)
  activeTaskEnhance: {
    activityStreamId: string;
    editingTaskId: string | null;
  } | null;
  setActiveTaskEnhance: (v: UIState['activeTaskEnhance']) => void;
  clearActiveTaskEnhance: () => void;

  // Pending enhance result (survives dialog close / component unmount)
  pendingEnhance: {
    enhanced: Record<string, unknown>;
    editingTaskId: string | null;
    openRequested: boolean;
  } | null;
  setPendingEnhance: (v: UIState['pendingEnhance']) => void;
  clearPendingEnhance: () => void;
}

type LiveUIStateSource = Pick<
  UIState,
  | 'sidebarState'
  | 'sidebarWidth'
  | 'activePanel'
  | 'rightPanelCollapsed'
  | 'rightPanelWidth'
  | 'settingsOpen'
  | 'shortcutsHelpOpen'
  | 'fullViewContent'
  | 'openTabs'
>;

export const useUIStore = create<UIState>((set, get) => ({
  sidebarState: (localStorage.getItem('sidebar-state') as SidebarState) || 'expanded',
  sidebarWidth: parseInt(localStorage.getItem('sidebar-width') || '220'),
  setSidebarState: (state) => {
    localStorage.setItem('sidebar-state', state);
    set({ sidebarState: state });
  },
  setSidebarWidth: (width) => {
    set({ sidebarWidth: width });
    // Defer localStorage write to avoid per-frame I/O during resize drag
    if (!get().isResizing) localStorage.setItem('sidebar-width', String(width));
  },
  toggleSidebar: () => {
    const current = get().sidebarState;
    const next = current === 'expanded' ? 'collapsed' : current === 'collapsed' ? 'hidden' : 'expanded';
    get().setSidebarState(next);
  },

  activePanel: null,
  rightPanelVisible: false,
  rightPanelCollapsed: false,
  rightPanelWidth: parseInt(localStorage.getItem('right-panel-width') || '380'),
  setActivePanel: (panel) => set({ activePanel: panel, rightPanelVisible: panel !== null, rightPanelCollapsed: false }),
  setRightPanelCollapsed: (collapsed) => set({ rightPanelCollapsed: collapsed }),
  setRightPanelWidth: (width) => {
    set({ rightPanelWidth: width });
    if (!get().isResizing) localStorage.setItem('right-panel-width', String(width));
  },
  togglePanel: (panel) => {
    const current = get().activePanel;
    if (current === panel) {
      // If already collapsed, hide completely. If expanded, collapse first.
      if (get().rightPanelCollapsed) {
        set({ activePanel: null, rightPanelVisible: false, rightPanelCollapsed: false });
      } else {
        set({ rightPanelCollapsed: true });
      }
    } else {
      set({ activePanel: panel, rightPanelVisible: true, rightPanelCollapsed: false });
    }
  },
  closeRightPanel: () => set({ activePanel: null, rightPanelVisible: false, rightPanelCollapsed: false }),

  fullViewContent: null,
  openTabs: loadPersistedTabs(),
  setFullViewContent: (content) => {
    const prev = get().fullViewContent;
    let { openTabs } = get();

    // When opening a view, ensure it has a tab — but sub-views use their parent tab
    if (content !== null) {
      const tabId = getTabIdForContent(content);
      if (!openTabs.some(t => t.id === tabId)) {
        openTabs = [...openTabs, { id: tabId, label: VIEW_TAB_LABELS[tabId] || tabId, closable: true }];
      }
    }

    // Sync shortcutsHelpOpen
    if (prev === 'shortcuts' && content !== 'shortcuts') {
      set({ fullViewContent: content, shortcutsHelpOpen: false, openTabs });
    } else if (content === 'shortcuts') {
      set({ fullViewContent: content, shortcutsHelpOpen: true, openTabs });
    } else {
      set({ fullViewContent: content, openTabs });
    }
    persistTabs(openTabs);
  },
  toggleFullView: (content) => {
    const current = get().fullViewContent;
    let { openTabs } = get();

    if (current === content) {
      // Already viewing this — switch to terminal (keep tab open)
      if (content === 'shortcuts') {
        set({ fullViewContent: null, shortcutsHelpOpen: false });
      } else {
        set({ fullViewContent: null });
      }
    } else {
      // Switch to this view — add tab if needed (sub-views use parent tab)
      const tabId = getTabIdForContent(content);
      if (!openTabs.some(t => t.id === tabId)) {
        openTabs = [...openTabs, { id: tabId, label: VIEW_TAB_LABELS[tabId] || tabId, closable: true }];
      }
      if (content === 'shortcuts') {
        set({ fullViewContent: content, shortcutsHelpOpen: true, openTabs });
      } else {
        set({ fullViewContent: content, openTabs, ...(current === 'shortcuts' ? { shortcutsHelpOpen: false } : {}) });
      }
      persistTabs(openTabs);
    }
  },
  openTab: (id, label) => {
    const { openTabs } = get();
    // Sub-views use their parent tab (e.g., stats → overview)
    const tabId = getTabIdForContent(id);
    let next = openTabs;
    if (!openTabs.some(t => t.id === tabId)) {
      next = [...openTabs, { id: tabId, label: label || VIEW_TAB_LABELS[tabId] || tabId, closable: tabId !== 'terminal' }];
    }
    // Switch to this content (may be a sub-view rendered within the parent tab)
    const content = id === 'terminal' ? null : id as FullViewContent;
    if (id === 'shortcuts') {
      set({ openTabs: next, fullViewContent: content, shortcutsHelpOpen: true });
    } else {
      const prev = get().fullViewContent;
      set({ openTabs: next, fullViewContent: content, ...(prev === 'shortcuts' ? { shortcutsHelpOpen: false } : {}) });
    }
    persistTabs(next);
  },
  closeTab: (id) => {
    if (id === 'terminal') return; // Can't close terminal
    const { openTabs, fullViewContent } = get();
    const next = openTabs.filter(t => t.id !== id);
    // If closing the active tab (or its parent for sub-views), switch to fallback
    const currentActiveId = fullViewContent ? getTabIdForContent(fullViewContent) : 'terminal';
    if (currentActiveId === id) {
      const closedIdx = openTabs.findIndex(t => t.id === id);
      const fallback = (closedIdx > 0 ? openTabs[closedIdx - 1] : next[0]) ?? next[0];
      const fallbackContent = !fallback || fallback.id === 'terminal' ? null : fallback.id as FullViewContent;
      set({ openTabs: next, fullViewContent: fallbackContent, ...(id === 'shortcuts' ? { shortcutsHelpOpen: false } : {}) });
    } else {
      set({ openTabs: next, ...(id === 'shortcuts' ? { shortcutsHelpOpen: false } : {}) });
    }
    persistTabs(next);
  },

  editorFilePath: null,
  setEditorFilePath: (path) => {
    if (path) {
      // Track recent files
      const recent = [path, ...get().recentEditorFiles.filter(f => f !== path)].slice(0, 10);
      set({ recentEditorFiles: recent });
      try { localStorage.setItem('recent-editor-files', JSON.stringify(recent)); } catch { /* ignore */ }

      // In tab mode, also add as an editor tab
      const editorViewMode = localStorage.getItem('editor-view-mode') || 'overlay';
      if (editorViewMode === 'tab') {
        get().addEditorFile(path);
        return; // addEditorFile already sets editorFilePath
      }
    }
    set({ editorFilePath: path });
  },

  // Editor tabs (tab view mode)
  editorOpenFiles: [],
  activeEditorFile: null,
  addEditorFile: (filePath) => set((state) => ({
    editorOpenFiles: state.editorOpenFiles.includes(filePath)
      ? state.editorOpenFiles
      : [...state.editorOpenFiles, filePath],
    activeEditorFile: filePath,
    editorFilePath: filePath,
  })),
  closeEditorFile: (filePath) => set((state) => {
    const remaining = state.editorOpenFiles.filter((f) => f !== filePath);
    const wasActive = state.activeEditorFile === filePath;
    return {
      editorOpenFiles: remaining,
      activeEditorFile: wasActive ? (remaining[remaining.length - 1] ?? null) : state.activeEditorFile,
      editorFilePath: wasActive ? (remaining[remaining.length - 1] ?? null) : state.editorFilePath,
    };
  }),
  setActiveEditorFile: (filePath) => set({
    activeEditorFile: filePath,
    editorFilePath: filePath,
  }),

  // Recent editor files
  recentEditorFiles: (() => {
    try { return JSON.parse(localStorage.getItem('recent-editor-files') || '[]'); } catch { return []; }
  })(),

  sidebarFocusRequest: { tab: 'projects', seq: 0 },
  requestSidebarFocus: (tab) => {
    const { sidebarState, sidebarFocusRequest } = get();
    // Ensure sidebar is visible
    if (sidebarState === 'hidden' || sidebarState === 'collapsed') {
      get().setSidebarState('expanded');
    }
    set({ sidebarFocusRequest: { tab, seq: sidebarFocusRequest.seq + 1 } });
  },

  isResizing: false,
  setIsResizing: (v) => {
    set({ isResizing: v });
    // Flush deferred localStorage writes when drag ends
    if (!v) {
      localStorage.setItem('sidebar-width', String(get().sidebarWidth));
      localStorage.setItem('right-panel-width', String(get().rightPanelWidth));
    }
  },

  settingsOpen: false,
  setSettingsOpen: (open) => set({ settingsOpen: open }),

  shortcutsHelpOpen: false,
  setShortcutsHelpOpen: (open) => {
    // Route shortcuts help through the full-view system instead of a modal dialog
    if (open) {
      let { openTabs } = get();
      if (!openTabs.some(t => t.id === 'shortcuts')) {
        openTabs = [...openTabs, { id: 'shortcuts', label: VIEW_TAB_LABELS['shortcuts'], closable: true }];
      }
      set({ shortcutsHelpOpen: true, fullViewContent: 'shortcuts', openTabs });
      persistTabs(openTabs);
    } else {
      const tabs = get().openTabs.filter(t => t.id !== 'shortcuts');
      set({ shortcutsHelpOpen: false, fullViewContent: get().fullViewContent === 'shortcuts' ? null : get().fullViewContent, openTabs: tabs });
      persistTabs(tabs);
    }
  },

  // TasksPanel sort/filter — session-scoped (no localStorage)
  tasksSorting: [{ id: 'status', desc: false }, { id: 'priority', desc: false }],
  setTasksSorting: (s) => set({ tasksSorting: s }),
  tasksStatusFilter: 'all',
  setTasksStatusFilter: (f) => set({ tasksStatusFilter: f }),
  tasksFilterSetByUser: false,
  setTasksFilterSetByUser: (v) => set({ tasksFilterSetByUser: v }),

  activeTaskEnhance: null,
  setActiveTaskEnhance: (v) => set({ activeTaskEnhance: v }),
  clearActiveTaskEnhance: () => set({ activeTaskEnhance: null }),

  // Pending enhance — persists across dialog close / panel switch
  pendingEnhance: null,
  setPendingEnhance: (v) => set({ pendingEnhance: v }),
  clearPendingEnhance: () => set({ pendingEnhance: null }),
}));

export function buildLiveUIStateSnapshot(state: LiveUIStateSource = useUIStore.getState()): LiveUIStateSnapshot {
  return {
    sidebarState: state.sidebarState,
    sidebarWidth: state.sidebarWidth,
    activePanel: state.activePanel,
    rightPanelCollapsed: state.rightPanelCollapsed,
    rightPanelWidth: state.rightPanelWidth,
    settingsOpen: state.settingsOpen,
    shortcutsHelpOpen: state.shortcutsHelpOpen,
    fullViewContent: state.fullViewContent,
    openTabs: cloneTabs(state.openTabs),
  };
}

export function applyLiveUIStateSnapshot(snapshot: LiveUIStateSnapshot): void {
  const current = buildLiveUIStateSnapshot();
  if (isSameLiveUIState(current, snapshot)) {
    return;
  }

  pendingMirroredUISnapshot = cloneLiveUIStateSnapshot(snapshot);

  try {
    localStorage.setItem('sidebar-state', snapshot.sidebarState);
    localStorage.setItem('sidebar-width', String(snapshot.sidebarWidth));
    localStorage.setItem('right-panel-width', String(snapshot.rightPanelWidth));
    persistTabs(snapshot.openTabs);
  } catch {
    // ignore
  }

  useUIStore.setState({
    sidebarState: snapshot.sidebarState,
    sidebarWidth: snapshot.sidebarWidth,
    activePanel: snapshot.activePanel,
    rightPanelVisible: snapshot.activePanel !== null,
    rightPanelCollapsed: snapshot.rightPanelCollapsed,
    rightPanelWidth: snapshot.rightPanelWidth,
    fullViewContent: snapshot.fullViewContent,
    openTabs: cloneTabs(snapshot.openTabs),
    settingsOpen: snapshot.settingsOpen,
    shortcutsHelpOpen: snapshot.shortcutsHelpOpen,
  });
}

export function consumeMirroredUISyncSuppression(snapshot: LiveUIStateSnapshot): boolean {
  if (!pendingMirroredUISnapshot) {
    return false;
  }

  const shouldSuppress = isSameLiveUIState(pendingMirroredUISnapshot, snapshot);
  if (shouldSuppress) {
    pendingMirroredUISnapshot = null;
  }
  return shouldSuppress;
}
