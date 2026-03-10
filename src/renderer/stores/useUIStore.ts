import { create } from 'zustand';
import type { SortingState } from '@tanstack/react-table';

type PanelId = 'tasks' | 'plugins' | 'sessions' | 'gitChanges' | 'githubIssues' | 'githubPRs' | 'githubBranches' | 'githubWorktrees' | 'overview' | 'aiFiles' | 'subframeHealth' | 'history' | 'agentState' | 'skills' | 'prompts' | 'pipeline' | null;
type SidebarState = 'expanded' | 'collapsed' | 'hidden';
type FullViewContent = 'overview' | 'structureMap' | 'tasks' | 'stats' | 'decisions' | 'pipeline' | 'agentState' | null;
export type StatusFilter = 'all' | 'pending' | 'in_progress' | 'completed' | 'blocked';

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
  toggleFullView: (content: 'overview' | 'structureMap' | 'tasks' | 'stats' | 'decisions' | 'pipeline') => void;

  // Editor
  editorFilePath: string | null;
  setEditorFilePath: (path: string | null) => void;

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
}

export const useUIStore = create<UIState>((set, get) => ({
  sidebarState: (localStorage.getItem('sidebar-state') as SidebarState) || 'expanded',
  sidebarWidth: parseInt(localStorage.getItem('sidebar-width') || '260'),
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
  setFullViewContent: (content) => set({ fullViewContent: content }),
  toggleFullView: (content) => {
    const current = get().fullViewContent;
    set({ fullViewContent: current === content ? null : content });
  },

  editorFilePath: null,
  setEditorFilePath: (path) => set({ editorFilePath: path }),

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
  setShortcutsHelpOpen: (open) => set({ shortcutsHelpOpen: open }),

  // TasksPanel sort/filter — session-scoped (no localStorage)
  tasksSorting: [{ id: 'status', desc: false }, { id: 'priority', desc: false }],
  setTasksSorting: (s) => set({ tasksSorting: s }),
  tasksStatusFilter: 'all',
  setTasksStatusFilter: (f) => set({ tasksStatusFilter: f }),
  tasksFilterSetByUser: false,
  setTasksFilterSetByUser: (v) => set({ tasksFilterSetByUser: v }),
}));
