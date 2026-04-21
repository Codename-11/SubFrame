import { create } from 'zustand';
import {
  addTabToLeaf,
  buildGridTree,
  collectAllTabs,
  collectLeafIds,
  collectLeaves,
  createEditorTab,
  createEmptyTab,
  createLeaf,
  createLeafWithTab,
  createPanelTab,
  createTerminalTab,
  deserializeTree,
  findLeafById,
  findLeafContainingFile,
  findLeafContainingTerminal,
  moveTabBetweenLeaves,
  removeLeafById,
  removeTabFromLeaf,
  resizeSplit,
  serializeTree,
  setActiveTab,
  splitLeafNode,
  type LeafNode,
  type LeafTab,
  type SplitDirection,
  type TreeNode,
} from '../lib/splitTree';
import type { TerminalStatus } from '../../shared/agentStateTypes';

type ViewMode = 'tabs' | 'grid';
type GridLayout = '1x1' | '1x2' | '1x3' | '1x4' | '2x1' | '2x2' | '3x1' | '3x2' | '3x3' | '2L1R' | '1L2R' | '2T1B' | '1T2B';

const GRID_LAYOUT_KEY = 'terminal-grid-layout';
const PINNED_TERMINALS_KEY = 'subframe-pinned-terminals';
const LAYOUT_TREE_KEY = 'subframe-layout-trees-v1';

// ── Layout tree persistence (per-project) ──────────────────────────────────

function loadLayoutTreesByProject(): Map<string, TreeNode> {
  const out = new Map<string, TreeNode>();
  // Honor the "Restore layout on launch" setting. When disabled, drop the
  // persisted tree but keep the localStorage entry so toggling it back on
  // recovers state on the next launch.
  try {
    const restore = localStorage.getItem('subframe-restore-layout-on-launch');
    if (restore === 'false') return out;
  } catch {
    // ignore — default is restore
  }
  try {
    const stored = localStorage.getItem(LAYOUT_TREE_KEY);
    if (!stored) return out;
    const parsed = JSON.parse(stored);
    if (!parsed || typeof parsed !== 'object') return out;
    for (const [projectPath, data] of Object.entries(parsed)) {
      const tree = deserializeTree(data);
      if (tree) out.set(projectPath, tree);
    }
  } catch {
    // ignore — start fresh
  }
  return out;
}

function saveLayoutTreesByProject(map: Map<string, TreeNode>): void {
  try {
    const obj: Record<string, unknown> = {};
    for (const [projectPath, tree] of map.entries()) {
      obj[projectPath] = serializeTree(tree);
    }
    localStorage.setItem(LAYOUT_TREE_KEY, JSON.stringify(obj));
  } catch {
    // ignore
  }
}

function loadPinnedTerminals(): Set<string> {
  try {
    const stored = localStorage.getItem(PINNED_TERMINALS_KEY);
    if (stored) {
      const arr = JSON.parse(stored);
      if (Array.isArray(arr)) return new Set(arr.filter((v: unknown) => typeof v === 'string'));
    }
  } catch {
    // ignore
  }
  return new Set();
}

function savePinnedTerminals(pinned: Set<string>): void {
  try {
    localStorage.setItem(PINNED_TERMINALS_KEY, JSON.stringify([...pinned]));
  } catch {
    // ignore
  }
}

function loadGridLayout(): GridLayout {
  try {
    const stored = localStorage.getItem(GRID_LAYOUT_KEY);
    if (stored && ['1x1', '1x2', '1x3', '1x4', '2x1', '2x2', '3x1', '3x2', '3x3', '2L1R', '1L2R', '2T1B', '1T2B'].includes(stored)) {
      return stored as GridLayout;
    }
  } catch {
    // ignore
  }
  return '1x1';
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
  /** Formal 7-state status (Maestro-style). Defaults to 'idle'. */
  status?: TerminalStatus;
  /** Optional human-readable status message (e.g. "Running: Bash") */
  statusMessage?: string;
}

interface TerminalState {
  terminals: Map<string, TerminalInfo>;
  activeTerminalId: string | null;
  activeByProject: Map<string, string>;
  viewMode: ViewMode;
  /** @deprecated Preset id kept for legacy compat (e.g. TerminalArea overflow calc). The binary split tree is the source of truth. */
  gridLayout: GridLayout;
  maximizedTerminalId: string | null;
  /** @deprecated Derived from `layoutTree` via collectLeaves. Phase 2 will remove. Kept for in-flight compat. */
  gridSlots: (string | null)[];
  /** @deprecated See `gridSlots`. */
  gridSlotsByProject: Map<string, (string | null)[]>;
  /** Binary split tree for current project. Source of truth when viewMode === 'grid'. */
  layoutTree: TreeNode;
  /** Per-project persisted trees. */
  layoutTreeByProject: Map<string, TreeNode>;
  /**
   * Ephemeral: id of the leaf that currently has focus. Not persisted to
   * localStorage. Null means "no explicit focus" — fall back to the first
   * leaf in reading order. Auto-updated by split / close / openTab actions.
   */
  activeLeafId: string | null;
  pinnedTerminals: Set<string>;
  frozenTerminals: Set<string>;
  pinTerminal: (id: string) => void;
  unpinTerminal: (id: string) => void;
  freezeTerminal: (id: string) => void;
  unfreezeTerminal: (id: string) => void;
  toggleFreezeTerminal: (id: string) => void;
  setGridSlots: (slots: (string | null)[], projectPath?: string) => void;
  setLayoutTree: (tree: TreeNode, projectPath?: string) => void;
  splitActiveLeaf: (direction: SplitDirection, newSlotId: string, projectPath?: string) => void;
  closeLeaf: (slotId: string, projectPath?: string) => void;
  resizeLeafSplit: (nodeId: string, ratio: number, projectPath?: string) => void;
  rebuildFromPreset: (presetHint: string, projectPath?: string) => void;
  // ── Tabbed-leaf (Phase 2A) actions ────────────────────────────────────────
  setActiveLeafId: (leafId: string | null) => void;
  getActiveLeaf: () => LeafNode | null;
  openTabInLeaf: (leafId: string, tab: LeafTab, activate?: boolean, projectPath?: string) => void;
  closeTabInLeaf: (leafId: string, tabId: string, projectPath?: string) => void;
  activateLeafTab: (leafId: string, tabId: string, projectPath?: string) => void;
  moveLeafTab: (fromLeafId: string, toLeafId: string, tabId: string, projectPath?: string) => void;
  reorderLeafTabs: (leafId: string, orderedTabIds: string[], projectPath?: string) => void;
  splitLeafWithTab: (leafId: string, tab: LeafTab, direction: SplitDirection, projectPath?: string) => void;
  openFileInActiveLeaf: (filePath: string, projectPath?: string) => void;
  openPanelInActiveLeaf: (panelId: string, projectPath?: string) => void;
  setActiveTerminal: (id: string) => void;
  addTerminal: (info: TerminalInfo) => void;
  removeTerminal: (id: string, currentProjectPath?: string) => void;
  renameTerminal: (id: string, name: string, nameSource?: 'default' | 'user' | 'session') => void;
  reorderTerminals: (orderedIds: string[]) => void;
  switchToProject: (projectPath: string) => void;
  setClaudeActive: (id: string, active: boolean, sessionId?: string) => void;
  setTerminalStatus: (id: string, status: TerminalStatus, message?: string) => void;
  setPoppedOut: (id: string, poppedOut: boolean) => void;
  setViewMode: (mode: ViewMode) => void;
  setGridLayout: (layout: GridLayout) => void;
  setMaximizedTerminal: (id: string | null) => void;
}

const initialLayoutTreeByProject = loadLayoutTreesByProject();
const initialLayoutTree: TreeNode = createLeaf('__empty_0__');

/**
 * Replace a leaf's placeholder slot with a fresh terminal-tab leaf. Used by
 * splitActiveLeaf when a spare empty placeholder already exists — we'd rather
 * fill it than add another split. Preserves the original leaf's `id` so any
 * per-leaf UI state (focus ring, etc.) doesn't jump.
 */
function replaceLeafSlot(
  tree: TreeNode,
  oldSlotId: string,
  newSlotId: string
): TreeNode | null {
  if (tree.type === 'leaf') {
    if (tree.slotId !== oldSlotId) return null;
    const replacement = createLeafWithTab(createTerminalTab(newSlotId));
    // Keep the old leaf id so React keys / activeLeafId stay stable.
    return { ...replacement, id: tree.id };
  }
  const [a, b] = tree.children;
  const newA = replaceLeafSlot(a, oldSlotId, newSlotId);
  if (newA) return { ...tree, children: [newA, b] };
  const newB = replaceLeafSlot(b, oldSlotId, newSlotId);
  if (newB) return { ...tree, children: [a, newB] };
  return null;
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
  layoutTree: initialLayoutTree,
  layoutTreeByProject: initialLayoutTreeByProject,
  activeLeafId: null,
  pinnedTerminals: loadPinnedTerminals(),
  frozenTerminals: new Set<string>(),
  freezeTerminal: (id) => {
    const frozen = new Set(get().frozenTerminals);
    frozen.add(id);
    set({ frozenTerminals: frozen });
  },
  unfreezeTerminal: (id) => {
    const frozen = new Set(get().frozenTerminals);
    frozen.delete(id);
    set({ frozenTerminals: frozen });
  },
  toggleFreezeTerminal: (id) => {
    const frozen = new Set(get().frozenTerminals);
    if (frozen.has(id)) frozen.delete(id);
    else frozen.add(id);
    set({ frozenTerminals: frozen });
  },
  pinTerminal: (id) => {
    const pinned = new Set(get().pinnedTerminals);
    pinned.add(id);
    set({ pinnedTerminals: pinned });
    savePinnedTerminals(pinned);
  },
  unpinTerminal: (id) => {
    const pinned = new Set(get().pinnedTerminals);
    pinned.delete(id);
    set({ pinnedTerminals: pinned });
    savePinnedTerminals(pinned);
  },
  setGridSlots: (slots, projectPath) => {
    if (projectPath !== undefined) {
      const byProject = new Map(get().gridSlotsByProject);
      byProject.set(projectPath, slots);
      set({ gridSlots: slots, gridSlotsByProject: byProject });
    } else {
      set({ gridSlots: slots });
    }
  },

  setLayoutTree: (tree, projectPath) => {
    const byProject = new Map(get().layoutTreeByProject);
    if (projectPath !== undefined) {
      byProject.set(projectPath, tree);
      saveLayoutTreesByProject(byProject);
    }
    // Keep derived gridSlots in sync for legacy consumers.
    const derivedSlots: (string | null)[] = collectLeaves(tree).map((id) =>
      id.startsWith('__empty_') ? null : id
    );
    set({
      layoutTree: tree,
      layoutTreeByProject: byProject,
      gridSlots: derivedSlots,
    });
  },

  splitActiveLeaf: (direction, newSlotId, projectPath) => {
    const state = get();
    const tree = state.layoutTree;
    const leaves = collectLeaves(tree);

    // Empty tree / only placeholder → replace root with the new leaf.
    const allEmpty = leaves.every((s) => s.startsWith('__empty_'));
    if (allEmpty) {
      const newLeaf = createLeafWithTab(createTerminalTab(newSlotId));
      get().setLayoutTree(newLeaf, projectPath);
      set({ activeLeafId: newLeaf.id });
      return;
    }

    // Prefer splitting the currently-focused leaf. Priority order:
    //   1. explicit activeLeafId (Phase 2A focus tracking)
    //   2. leaf containing the active terminal (pre-Phase-2A focus)
    //   3. first leaf in reading order
    let targetLeafId: string | null = null;
    if (state.activeLeafId && findLeafById(tree, state.activeLeafId)) {
      targetLeafId = state.activeLeafId;
    } else {
      const activeTermId = state.activeTerminalId;
      if (activeTermId) {
        const leaf = findLeafContainingTerminal(tree, activeTermId);
        if (leaf) targetLeafId = leaf.id;
      }
    }
    if (!targetLeafId) {
      const ids = collectLeafIds(tree);
      if (ids.length === 0) {
        const newLeaf = createLeafWithTab(createTerminalTab(newSlotId));
        get().setLayoutTree(newLeaf, projectPath);
        set({ activeLeafId: newLeaf.id });
        return;
      }
      targetLeafId = ids[0];
    }

    // If there's an empty placeholder leaf lying around, fill it instead of
    // splitting (keeps leaf count == terminal count for fresh projects).
    const firstEmpty = leaves.find((s) => s.startsWith('__empty_'));
    if (firstEmpty) {
      const replaced = replaceLeafSlot(tree, firstEmpty, newSlotId);
      if (replaced) {
        get().setLayoutTree(replaced, projectPath);
        // The original empty leaf's id is preserved by replaceLeafSlot, so
        // find it in the new tree to update activeLeafId.
        const leaf = findLeafContainingTerminal(replaced, newSlotId);
        if (leaf) set({ activeLeafId: leaf.id });
        return;
      }
    }

    const newTab = createTerminalTab(newSlotId);
    const next = splitLeafNode(tree, targetLeafId, newTab, direction);
    if (next === tree) {
      // splitLeafNode no-op (leaf not found) — fall back to root replacement.
      const newLeaf = createLeafWithTab(newTab);
      get().setLayoutTree(newLeaf, projectPath);
      set({ activeLeafId: newLeaf.id });
      return;
    }
    get().setLayoutTree(next, projectPath);
    // Activate the newly created leaf (the one wrapping newTab).
    const newLeaf = findLeafContainingTerminal(next, newSlotId);
    if (newLeaf && newLeaf.id !== targetLeafId) {
      set({ activeLeafId: newLeaf.id });
    }
  },

  closeLeaf: (slotId, projectPath) => {
    const state = get();
    const tree = state.layoutTree;
    // Locate the leaf containing this terminal tab. If none, caller is
    // probably passing a leaf id directly — try that path for compat.
    const leaf =
      findLeafContainingTerminal(tree, slotId) ?? findLeafById(tree, slotId);
    if (!leaf) {
      // Nothing to do — keep the tree as-is (and its activeLeafId).
      return;
    }

    // Find the tab inside the leaf that corresponds to this terminal.
    const termTab = leaf.tabs.find(
      (t) => t.kind === 'terminal' && t.terminalId === slotId
    );

    let next: TreeNode | null;
    if (termTab && leaf.tabs.length > 1) {
      // Leaf has other tabs — just remove the terminal tab from it.
      next = removeTabFromLeaf(tree, leaf.id, termTab.id);
    } else {
      // Either the terminal was the sole real tab, or caller passed a leaf id
      // directly → collapse the entire leaf.
      next = removeLeafById(tree, leaf.id);
    }

    const safe: TreeNode = next ?? createLeafWithTab(createEmptyTab());
    get().setLayoutTree(safe, projectPath);

    // Update activeLeafId if the active leaf was removed.
    if (state.activeLeafId === leaf.id && next !== null) {
      const first = collectLeafIds(safe)[0] ?? null;
      set({ activeLeafId: first });
    } else if (next === null) {
      // Whole tree collapsed → the replacement empty leaf becomes active.
      const first = collectLeafIds(safe)[0] ?? null;
      set({ activeLeafId: first });
    }
  },

  resizeLeafSplit: (nodeId, ratio, projectPath) => {
    const tree = get().layoutTree;
    const next = resizeSplit(tree, nodeId, ratio);
    if (next !== tree) get().setLayoutTree(next, projectPath);
  },

  rebuildFromPreset: (presetHint, projectPath) => {
    const state = get();
    // Seed the preset with existing real leaves first, then pad with
    // placeholders so the preset topology is filled.
    const existing = collectLeaves(state.layoutTree).filter(
      (s) => !s.startsWith('__empty_')
    );
    const tree = buildGridTree(existing, presetHint);
    get().setLayoutTree(tree, projectPath);
    // Rebuilt trees get fresh leaf ids — reset activeLeafId to the first.
    const first = collectLeafIds(tree)[0] ?? null;
    set({ activeLeafId: first });
  },

  // ── Tabbed-leaf (Phase 2A) actions ────────────────────────────────────────

  setActiveLeafId: (leafId) => set({ activeLeafId: leafId }),

  getActiveLeaf: () => {
    const { layoutTree, activeLeafId } = get();
    if (activeLeafId) {
      const leaf = findLeafById(layoutTree, activeLeafId);
      if (leaf) return leaf;
    }
    // Fallback: first leaf in reading order.
    const first = collectLeafIds(layoutTree)[0];
    return first ? findLeafById(layoutTree, first) : null;
  },

  openTabInLeaf: (leafId, tab, activate = true, projectPath) => {
    const tree = get().layoutTree;
    const next = addTabToLeaf(tree, leafId, tab, activate);
    if (next === tree) return;
    get().setLayoutTree(next, projectPath);
    if (activate) set({ activeLeafId: leafId });
  },

  closeTabInLeaf: (leafId, tabId, projectPath) => {
    const state = get();
    const tree = state.layoutTree;
    const leaf = findLeafById(tree, leafId);
    if (!leaf) return;
    const isLastTab =
      leaf.tabs.length === 1 && leaf.tabs.some((t) => t.id === tabId);

    if (isLastTab) {
      // Closing the last tab — collapse the whole leaf UNLESS it's the only
      // leaf in the tree (keep one empty leaf so the user can start fresh).
      const leafCount = collectLeafIds(tree).length;
      if (leafCount <= 1) {
        // Replace the sole tab with a fresh EmptyTab. Keep leaf id stable.
        const nextTree = removeTabFromLeaf(tree, leafId, tabId);
        if (nextTree !== tree) {
          get().setLayoutTree(nextTree, projectPath);
        }
        return;
      }
      const nextTree = removeLeafById(tree, leafId);
      const safe: TreeNode = nextTree ?? createLeafWithTab(createEmptyTab());
      get().setLayoutTree(safe, projectPath);
      if (state.activeLeafId === leafId) {
        const first = collectLeafIds(safe)[0] ?? null;
        set({ activeLeafId: first });
      }
      return;
    }

    // Leaf has other tabs — just drop this one.
    const nextTree = removeTabFromLeaf(tree, leafId, tabId);
    if (nextTree !== tree) get().setLayoutTree(nextTree, projectPath);
  },

  activateLeafTab: (leafId, tabId, projectPath) => {
    const tree = get().layoutTree;
    const next = setActiveTab(tree, leafId, tabId);
    if (next !== tree) get().setLayoutTree(next, projectPath);
    set({ activeLeafId: leafId });
  },

  moveLeafTab: (fromLeafId, toLeafId, tabId, projectPath) => {
    const tree = get().layoutTree;
    const next = moveTabBetweenLeaves(tree, fromLeafId, toLeafId, tabId, true);
    if (next === tree) return;
    get().setLayoutTree(next, projectPath);
    set({ activeLeafId: toLeafId });
  },

  reorderLeafTabs: (leafId, orderedTabIds, projectPath) => {
    const tree = get().layoutTree;
    const leaf = findLeafById(tree, leafId);
    if (!leaf) return;
    const tabMap = new Map(leaf.tabs.map((t) => [t.id, t]));
    const nextTabs = orderedTabIds
      .map((id) => tabMap.get(id))
      .filter((t): t is LeafTab => Boolean(t));
    if (nextTabs.length !== leaf.tabs.length) return;
    const nextActive = nextTabs.some((t) => t.id === leaf.activeTabId)
      ? leaf.activeTabId
      : nextTabs[0].id;
    const nextLeaf: LeafNode = {
      ...leaf,
      tabs: nextTabs,
      activeTabId: nextActive,
    };
    const replaceLeaf = (node: TreeNode): TreeNode => {
      if (node.type === 'leaf') return node.id === leafId ? nextLeaf : node;
      const [a, b] = node.children;
      const newA = replaceLeaf(a);
      if (newA !== a) return { ...node, children: [newA, b] };
      const newB = replaceLeaf(b);
      if (newB !== b) return { ...node, children: [a, newB] };
      return node;
    };
    const nextTree = replaceLeaf(tree);
    if (nextTree !== tree) get().setLayoutTree(nextTree, projectPath);
  },

  splitLeafWithTab: (leafId, tab, direction, projectPath) => {
    const tree = get().layoutTree;
    const next = splitLeafNode(tree, leafId, tab, direction);
    if (next === tree) return;
    get().setLayoutTree(next, projectPath);
    // The new leaf is the sibling added by splitLeafNode — find it by tab id.
    const created = collectAllTabs(next).find((entry) => entry.tab.id === tab.id);
    if (created) set({ activeLeafId: created.leafId });
  },

  openFileInActiveLeaf: (filePath, projectPath) => {
    const state = get();
    const tree = state.layoutTree;

    // Dedup: if the file is already open anywhere, focus that leaf + tab.
    const existing = findLeafContainingFile(tree, filePath);
    if (existing) {
      const tab = existing.tabs.find(
        (t) => t.kind === 'editor' && t.filePath === filePath
      );
      if (tab) {
        const next = setActiveTab(tree, existing.id, tab.id);
        if (next !== tree) get().setLayoutTree(next, projectPath);
        set({ activeLeafId: existing.id });
        return;
      }
    }

    // Pick the active leaf (or first leaf) as the target.
    const targetLeaf =
      (state.activeLeafId ? findLeafById(tree, state.activeLeafId) : null) ??
      (() => {
        const first = collectLeafIds(tree)[0];
        return first ? findLeafById(tree, first) : null;
      })();
    if (!targetLeaf) return;

    const tab = createEditorTab(filePath);
    const next = addTabToLeaf(tree, targetLeaf.id, tab, true);
    if (next === tree) return;
    get().setLayoutTree(next, projectPath);
    set({ activeLeafId: targetLeaf.id });
  },

  openPanelInActiveLeaf: (panelId, projectPath) => {
    const state = get();
    const tree = state.layoutTree;

    // Dedup: look for an existing panel tab matching this panelId anywhere.
    for (const { leafId, tab } of collectAllTabs(tree)) {
      if (tab.kind === 'panel' && tab.panelId === panelId) {
        const next = setActiveTab(tree, leafId, tab.id);
        if (next !== tree) get().setLayoutTree(next, projectPath);
        set({ activeLeafId: leafId });
        return;
      }
    }

    const targetLeaf =
      (state.activeLeafId ? findLeafById(tree, state.activeLeafId) : null) ??
      (() => {
        const first = collectLeafIds(tree)[0];
        return first ? findLeafById(tree, first) : null;
      })();
    if (!targetLeaf) return;

    const tab = createPanelTab(panelId);
    const next = addTabToLeaf(tree, targetLeaf.id, tab, true);
    if (next === tree) return;
    get().setLayoutTree(next, projectPath);
    set({ activeLeafId: targetLeaf.id });
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

    // Clean up pinned state for removed terminal
    const pinned = new Set(get().pinnedTerminals);
    const wasPinned = pinned.delete(id);
    if (wasPinned) savePinnedTerminals(pinned);

    // Clean up frozen state for removed terminal
    const frozen = new Set(get().frozenTerminals);
    frozen.delete(id);

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

    set({ terminals, activeTerminalId: newActive, activeByProject, pinnedTerminals: pinned, frozenTerminals: frozen });
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
    const state = get();
    const activeByProject = state.activeByProject;
    const savedId = activeByProject.get(projectPath);

    // Restore per-project grid slots (legacy)
    const savedSlots = state.gridSlotsByProject.get(projectPath);
    if (savedSlots) {
      set({ gridSlots: savedSlots });
    }

    // Restore per-project layout tree, or seed a fresh one from current
    // terminals for this project.
    const savedTree = state.layoutTreeByProject.get(projectPath);
    if (savedTree) {
      set({ layoutTree: savedTree });
    } else {
      const projectTerminalIds = Array.from(state.terminals.values())
        .filter((t) => (t.projectPath || '') === projectPath)
        .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0) || a.id.localeCompare(b.id))
        .map((t) => t.id);
      const seeded: TreeNode =
        projectTerminalIds.length > 0
          ? buildGridTree(projectTerminalIds)
          : createLeaf('__empty_0__');
      const byProject = new Map(state.layoutTreeByProject);
      byProject.set(projectPath, seeded);
      saveLayoutTreesByProject(byProject);
      set({ layoutTree: seeded, layoutTreeByProject: byProject });
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

  setTerminalStatus: (id, status, message) => {
    const terminals = new Map(get().terminals);
    const info = terminals.get(id);
    if (!info) return;
    // Derive the legacy `claudeActive` boolean from the authoritative status.
    // Consumers that still read `claudeActive` continue to work without change,
    // but the value is now hook-driven instead of scraped from PTY output.
    const derivedClaudeActive = status === 'working' || status === 'needs-input';
    terminals.set(id, {
      ...info,
      status,
      statusMessage: message,
      claudeActive: derivedClaudeActive,
    });
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
    // Rebuild the split tree from the preset, reusing existing real leaves.
    // Persistence for the active project path is handled by TerminalGrid when
    // it observes the tree change (it knows the projectPath).
    const state = get();
    const existing = collectLeaves(state.layoutTree).filter(
      (s) => !s.startsWith('__empty_')
    );
    const tree = buildGridTree(existing, layout);
    const derivedSlots: (string | null)[] = collectLeaves(tree).map((id) =>
      id.startsWith('__empty_') ? null : id
    );
    set({ gridLayout: layout, layoutTree: tree, gridSlots: derivedSlots });
  },
  setMaximizedTerminal: (id) => set({ maximizedTerminalId: id }),
}));
