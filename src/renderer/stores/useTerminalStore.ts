import { create } from 'zustand';

type ViewMode = 'tabs' | 'grid';
type GridLayout = '1x2' | '1x3' | '1x4' | '2x1' | '2x2' | '3x1' | '3x2' | '3x3' | '2L1R' | '1L2R' | '2T1B' | '1T2B';

const GRID_LAYOUT_KEY = 'terminal-grid-layout';

function loadGridLayout(): GridLayout {
  try {
    const stored = localStorage.getItem(GRID_LAYOUT_KEY);
    if (stored && ['1x2', '1x3', '1x4', '2x1', '2x2', '3x1', '3x2', '3x3', '2L1R', '1L2R', '2T1B', '1T2B'].includes(stored)) {
      return stored as GridLayout;
    }
  } catch {
    // ignore
  }
  return '1x2';
}

export interface TerminalInfo {
  id: string;
  name: string;
  nameSource?: 'default' | 'user' | 'session';
  projectPath: string;
  isActive: boolean;
  createdAt?: number;
  claudeActive?: boolean;
  claudeSessionId?: string;
  poppedOut?: boolean;
}

interface TerminalState {
  terminals: Map<string, TerminalInfo>;
  activeTerminalId: string | null;
  activeByProject: Map<string, string>;
  viewMode: ViewMode;
  gridLayout: GridLayout;
  maximizedTerminalId: string | null;
  gridSlots: (string | null)[];
  gridSlotsByProject: Map<string, (string | null)[]>;
  setGridSlots: (slots: (string | null)[], projectPath?: string) => void;
  setActiveTerminal: (id: string) => void;
  addTerminal: (info: TerminalInfo) => void;
  removeTerminal: (id: string, currentProjectPath?: string) => void;
  renameTerminal: (id: string, name: string, nameSource?: 'default' | 'user' | 'session') => void;
  reorderTerminals: (orderedIds: string[]) => void;
  switchToProject: (projectPath: string) => void;
  setClaudeActive: (id: string, active: boolean, sessionId?: string) => void;
  setPoppedOut: (id: string, poppedOut: boolean) => void;
  setViewMode: (mode: ViewMode) => void;
  setGridLayout: (layout: GridLayout) => void;
  setMaximizedTerminal: (id: string | null) => void;
}

export const useTerminalStore = create<TerminalState>((set, get) => ({
  terminals: new Map(),
  activeTerminalId: null,
  activeByProject: new Map(),
  viewMode: 'tabs',
  gridLayout: loadGridLayout(),
  maximizedTerminalId: null,
  gridSlots: [],
  gridSlotsByProject: new Map(),
  setGridSlots: (slots, projectPath) => {
    if (projectPath !== undefined) {
      const byProject = new Map(get().gridSlotsByProject);
      byProject.set(projectPath, slots);
      set({ gridSlots: slots, gridSlotsByProject: byProject });
    } else {
      set({ gridSlots: slots });
    }
  },

  setActiveTerminal: (id) => {
    const info = get().terminals.get(id);
    const activeByProject = new Map(get().activeByProject);
    if (info) {
      activeByProject.set(info.projectPath || '', id);
    }
    set({ activeTerminalId: id, activeByProject });
  },

  addTerminal: (info) => {
    const terminals = new Map(get().terminals);
    const existing = terminals.get(info.id);
    // Preserve createdAt for existing terminals (prevents reorder loss from duplicate TERMINAL_CREATED events)
    const createdAt = existing?.createdAt ?? info.createdAt ?? Date.now();
    terminals.set(info.id, { ...info, createdAt });
    const activeByProject = new Map(get().activeByProject);
    if (info.isActive) {
      // Foreground terminal — activate and update per-project mapping
      activeByProject.set(info.projectPath || '', info.id);
      set({ terminals, activeTerminalId: info.id, activeByProject });
    } else {
      // Background terminal (e.g. onboarding analysis) — register without stealing focus
      set({ terminals, activeByProject });
    }
  },

  removeTerminal: (id, currentProjectPath) => {
    const terminals = new Map(get().terminals);
    const removed = terminals.get(id);
    terminals.delete(id);

    // Scope fallback to same project
    const projectPath = currentProjectPath ?? removed?.projectPath ?? '';
    const projectTerminals = Array.from(terminals.values())
      .filter((t) => (t.projectPath || '') === projectPath)
      .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0) || a.id.localeCompare(b.id));

    const newActive = projectTerminals.length > 0
      ? projectTerminals[projectTerminals.length - 1].id
      : null;

    const activeByProject = new Map(get().activeByProject);
    if (newActive) {
      activeByProject.set(projectPath, newActive);
    } else {
      activeByProject.delete(projectPath);
    }

    set({ terminals, activeTerminalId: newActive, activeByProject });
  },

  renameTerminal: (id, name, nameSource) => {
    const terminals = new Map(get().terminals);
    const info = terminals.get(id);
    if (info) terminals.set(id, { ...info, name, nameSource: nameSource ?? 'user' });
    set({ terminals });
  },

  reorderTerminals: (orderedIds) => {
    const terminals = new Map(get().terminals);
    let timestamp = 1;
    for (const id of orderedIds) {
      const info = terminals.get(id);
      if (info) {
        terminals.set(id, { ...info, createdAt: timestamp++ });
      }
    }
    set({ terminals });
  },

  switchToProject: (projectPath) => {
    const activeByProject = get().activeByProject;
    const savedId = activeByProject.get(projectPath);

    // Restore per-project grid slots
    const savedSlots = get().gridSlotsByProject.get(projectPath);
    if (savedSlots) {
      set({ gridSlots: savedSlots });
    }

    if (savedId && get().terminals.has(savedId)) {
      set({ activeTerminalId: savedId });
    } else {
      // Fallback: pick the most recent terminal for this project
      const projectTerminals = Array.from(get().terminals.values())
        .filter((t) => (t.projectPath || '') === projectPath)
        .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0) || a.id.localeCompare(b.id));

      const fallback = projectTerminals.length > 0
        ? projectTerminals[projectTerminals.length - 1].id
        : null;

      if (fallback) {
        const newMap = new Map(activeByProject);
        newMap.set(projectPath, fallback);
        set({ activeTerminalId: fallback, activeByProject: newMap });
      } else {
        set({ activeTerminalId: null });
      }
    }
  },

  setClaudeActive: (id, active, sessionId) => {
    const terminals = new Map(get().terminals);
    const info = terminals.get(id);
    if (info) terminals.set(id, { ...info, claudeActive: active, claudeSessionId: active ? sessionId : undefined });
    set({ terminals });
  },

  setPoppedOut: (id, poppedOut) => {
    const terminals = new Map(get().terminals);
    const info = terminals.get(id);
    if (info) terminals.set(id, { ...info, poppedOut });
    set({ terminals });
  },

  setViewMode: (mode) => set({ viewMode: mode }),
  setGridLayout: (layout) => {
    try { localStorage.setItem(GRID_LAYOUT_KEY, layout); } catch { /* ignore */ }
    set({ gridLayout: layout });
  },
  setMaximizedTerminal: (id) => set({ maximizedTerminalId: id }),
}));
