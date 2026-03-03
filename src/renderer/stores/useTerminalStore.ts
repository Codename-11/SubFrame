import { create } from 'zustand';

type ViewMode = 'tabs' | 'grid';
type GridLayout = '1x2' | '1x3' | '1x4' | '2x1' | '2x2' | '3x1' | '3x2' | '3x3';

const GRID_LAYOUT_KEY = 'terminal-grid-layout';

function loadGridLayout(): GridLayout {
  try {
    const stored = localStorage.getItem(GRID_LAYOUT_KEY);
    if (stored && ['1x2', '1x3', '1x4', '2x1', '2x2', '3x1', '3x2', '3x3'].includes(stored)) {
      return stored as GridLayout;
    }
  } catch {
    // ignore
  }
  return '2x2';
}

export interface TerminalInfo {
  id: string;
  name: string;
  projectPath: string;
  isActive: boolean;
  createdAt?: number;
}

interface TerminalState {
  terminals: Map<string, TerminalInfo>;
  activeTerminalId: string | null;
  activeByProject: Map<string, string>;
  viewMode: ViewMode;
  gridLayout: GridLayout;
  setActiveTerminal: (id: string) => void;
  addTerminal: (info: TerminalInfo) => void;
  removeTerminal: (id: string, currentProjectPath?: string) => void;
  renameTerminal: (id: string, name: string) => void;
  reorderTerminals: (orderedIds: string[]) => void;
  switchToProject: (projectPath: string) => void;
  setViewMode: (mode: ViewMode) => void;
  setGridLayout: (layout: GridLayout) => void;
}

export const useTerminalStore = create<TerminalState>((set, get) => ({
  terminals: new Map(),
  activeTerminalId: null,
  activeByProject: new Map(),
  viewMode: 'tabs',
  gridLayout: loadGridLayout(),

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
    terminals.set(info.id, { ...info, createdAt: info.createdAt ?? Date.now() });
    const activeByProject = new Map(get().activeByProject);
    activeByProject.set(info.projectPath || '', info.id);
    set({ terminals, activeTerminalId: info.id, activeByProject });
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

  renameTerminal: (id, name) => {
    const terminals = new Map(get().terminals);
    const info = terminals.get(id);
    if (info) terminals.set(id, { ...info, name });
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

  setViewMode: (mode) => set({ viewMode: mode }),
  setGridLayout: (layout) => {
    try { localStorage.setItem(GRID_LAYOUT_KEY, layout); } catch { /* ignore */ }
    set({ gridLayout: layout });
  },
}));
