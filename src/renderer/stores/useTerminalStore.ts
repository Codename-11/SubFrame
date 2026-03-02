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
  viewMode: ViewMode;
  gridLayout: GridLayout;
  setActiveTerminal: (id: string) => void;
  addTerminal: (info: TerminalInfo) => void;
  removeTerminal: (id: string) => void;
  renameTerminal: (id: string, name: string) => void;
  setViewMode: (mode: ViewMode) => void;
  setGridLayout: (layout: GridLayout) => void;
}

export const useTerminalStore = create<TerminalState>((set, get) => ({
  terminals: new Map(),
  activeTerminalId: null,
  viewMode: 'tabs',
  gridLayout: loadGridLayout(),
  setActiveTerminal: (id) => set({ activeTerminalId: id }),
  addTerminal: (info) => {
    const terminals = new Map(get().terminals);
    terminals.set(info.id, { ...info, createdAt: info.createdAt ?? Date.now() });
    set({ terminals, activeTerminalId: info.id });
  },
  removeTerminal: (id) => {
    const terminals = new Map(get().terminals);
    terminals.delete(id);
    const remaining = Array.from(terminals.keys());
    set({
      terminals,
      activeTerminalId: remaining.length > 0 ? remaining[remaining.length - 1] : null,
    });
  },
  renameTerminal: (id, name) => {
    const terminals = new Map(get().terminals);
    const info = terminals.get(id);
    if (info) terminals.set(id, { ...info, name });
    set({ terminals });
  },
  setViewMode: (mode) => set({ viewMode: mode }),
  setGridLayout: (layout) => {
    try { localStorage.setItem(GRID_LAYOUT_KEY, layout); } catch { /* ignore */ }
    set({ gridLayout: layout });
  },
}));
