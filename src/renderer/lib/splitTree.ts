/**
 * Binary split tree for the VS-Code-style unified editor grid.
 *
 * Pure data module — no React imports. Every mutation returns a NEW tree
 * (immutable) so Zustand/React can diff structurally. Mutations that find
 * no target return the **same reference** to keep memoization cheap.
 *
 * ## Schema (v2)
 *
 *   - LeafNode  — an "editor group": an ordered tab list where each tab is
 *                 a terminal, a file editor, a panel view, or an empty
 *                 placeholder. A leaf always has at least one tab.
 *   - SplitNode — a divider between two children with a ratio in
 *                 [MIN_RATIO, MAX_RATIO].
 *
 * ## Migration from v1
 *
 * The v1 schema used `LeafNode = { type:'leaf', id, slotId }` where `slotId`
 * was either a terminal id or a `__empty_<n>__` placeholder. v1 trees
 * persisted in localStorage under `subframe-layout-trees-v1` still work:
 * `deserializeTree` accepts both shapes and `migrateV1ToV2` produces the
 * tabbed equivalent (one tab per old leaf).
 *
 * During the Phase 1 -> Phase 2 transition, legacy consumers still read
 * `leaf.slotId` directly; we keep that field as a **deprecated mirror** of
 * the first terminal tab (or the empty placeholder) so old code paths keep
 * compiling until their migration lands. New code should read `leaf.tabs`.
 *
 * Inspired by Maestro's `splitTree.ts` (https://github.com/its-maestro-baby/maestro).
 */

export type SplitDirection = 'horizontal' | 'vertical';

// ── Tab payloads (discriminated union) ──────────────────────────────────────

export type LeafTabKind = 'terminal' | 'editor' | 'panel' | 'empty';

export interface TerminalTab {
  id: string;           // stable tab id (uid)
  kind: 'terminal';
  terminalId: string;   // maps to PTYInstance.id
}

export interface EditorTab {
  id: string;
  kind: 'editor';
  filePath: string;     // absolute file path
}

export interface PanelTab {
  id: string;
  kind: 'panel';
  panelId: string;      // matches FullViewContent values
}

export interface EmptyTab {
  id: string;
  kind: 'empty';
}

export type LeafTab = TerminalTab | EditorTab | PanelTab | EmptyTab;

// ── Tree nodes ──────────────────────────────────────────────────────────────

export interface LeafNode {
  type: 'leaf';
  id: string;
  tabs: LeafTab[];        // invariant: length >= 1
  activeTabId: string;    // must equal one of tabs[].id
  /**
   * @deprecated v1 compatibility mirror. Reflects the first terminal tab's
   * terminalId, or the placeholder string `__empty_<n>__` if the leaf has
   * only empty content. Maintained by all v2 helpers so legacy consumers
   * (Phase 1) keep working until Phase 2 migrates them.
   */
  slotId: string;
}

export interface SplitNode {
  type: 'split';
  id: string;
  direction: SplitDirection;
  ratio: number; // 0..1, fraction allocated to children[0]
  children: [TreeNode, TreeNode];
}

export type TreeNode = LeafNode | SplitNode;

export const MIN_RATIO = 0.15;
export const MAX_RATIO = 0.85;

// ── Ids ─────────────────────────────────────────────────────────────────────

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function clampRatio(r: number): number {
  if (!Number.isFinite(r)) return 0.5;
  if (r < MIN_RATIO) return MIN_RATIO;
  if (r > MAX_RATIO) return MAX_RATIO;
  return r;
}

// ── Tab constructors ────────────────────────────────────────────────────────

export function createTerminalTab(terminalId: string): TerminalTab {
  return { id: uid(), kind: 'terminal', terminalId };
}

export function createEditorTab(filePath: string): EditorTab {
  return { id: uid(), kind: 'editor', filePath };
}

export function createPanelTab(panelId: string): PanelTab {
  return { id: uid(), kind: 'panel', panelId };
}

export function createEmptyTab(): EmptyTab {
  return { id: uid(), kind: 'empty' };
}

// ── Leaf / split constructors ───────────────────────────────────────────────

/**
 * Preferred v2 constructor. Builds a LeafNode wrapping a single tab.
 */
export function createLeafWithTab(tab: LeafTab): LeafNode {
  return {
    type: 'leaf',
    id: uid(),
    tabs: [tab],
    activeTabId: tab.id,
    slotId: deriveSlotId([tab]),
  };
}

/**
 * @deprecated Use `createLeafWithTab(createTerminalTab(id))` for new code.
 *
 * Legacy v1 constructor preserved for backward compat. Creates a leaf with a
 * single tab:
 *   - If `slotId` starts with `__empty_`, the tab is an EmptyTab.
 *   - Otherwise, the tab is a TerminalTab with `terminalId = slotId`.
 *
 * The resulting leaf's deprecated `.slotId` field mirrors the passed value so
 * old call sites (Phase 1) keep reading the same string they wrote.
 */
export function createLeaf(slotId: string): LeafNode {
  const tab: LeafTab = slotId.startsWith('__empty_')
    ? createEmptyTab()
    : createTerminalTab(slotId);
  return {
    type: 'leaf',
    id: uid(),
    tabs: [tab],
    activeTabId: tab.id,
    slotId, // preserve legacy placeholder string verbatim
  };
}

export function createSplit(
  direction: SplitDirection,
  a: TreeNode,
  b: TreeNode,
  ratio: number = 0.5
): SplitNode {
  return {
    type: 'split',
    id: uid(),
    direction,
    ratio: clampRatio(ratio),
    children: [a, b],
  };
}

// ── Internal helpers ────────────────────────────────────────────────────────

/**
 * Derive the deprecated `slotId` mirror from a tab list. Returns the first
 * terminal tab's terminalId if any, otherwise an `__empty_0__` placeholder.
 */
function deriveSlotId(tabs: LeafTab[]): string {
  for (const t of tabs) {
    if (t.kind === 'terminal') return t.terminalId;
  }
  return '__empty_0__';
}

/**
 * Rebuild a LeafNode with the given tabs, preserving id. Re-derives slotId
 * and validates activeTabId (falls back to first tab if the requested id is
 * not in the new tab list).
 */
function rebuildLeaf(
  leaf: LeafNode,
  tabs: LeafTab[],
  activeTabId: string
): LeafNode {
  const nextActive = tabs.some((t) => t.id === activeTabId)
    ? activeTabId
    : tabs[0].id;
  return {
    type: 'leaf',
    id: leaf.id,
    tabs,
    activeTabId: nextActive,
    slotId: deriveSlotId(tabs),
  };
}

// ── Queries ─────────────────────────────────────────────────────────────────

/**
 * @deprecated Use `findLeafContainingTerminal` or `findLeafById` in new code.
 *
 * Returns the LeafNode whose tab list contains a TerminalTab with
 * `terminalId === slotId`, OR (legacy fallback) whose deprecated `.slotId`
 * field equals the argument. This keeps v1 call sites working — they passed
 * `__empty_<n>__` placeholders or terminal ids interchangeably.
 */
export function findLeaf(tree: TreeNode, slotId: string): LeafNode | null {
  if (tree.type === 'leaf') {
    if (tree.slotId === slotId) return tree;
    for (const t of tree.tabs) {
      if (t.kind === 'terminal' && t.terminalId === slotId) return tree;
    }
    return null;
  }
  return (
    findLeaf(tree.children[0], slotId) ?? findLeaf(tree.children[1], slotId)
  );
}

export function findLeafById(tree: TreeNode, leafId: string): LeafNode | null {
  if (tree.type === 'leaf') {
    return tree.id === leafId ? tree : null;
  }
  return (
    findLeafById(tree.children[0], leafId) ??
    findLeafById(tree.children[1], leafId)
  );
}

export function findLeafByTabId(
  tree: TreeNode,
  tabId: string
): LeafNode | null {
  if (tree.type === 'leaf') {
    return tree.tabs.some((t) => t.id === tabId) ? tree : null;
  }
  return (
    findLeafByTabId(tree.children[0], tabId) ??
    findLeafByTabId(tree.children[1], tabId)
  );
}

export function findLeafContainingTerminal(
  tree: TreeNode,
  terminalId: string
): LeafNode | null {
  if (tree.type === 'leaf') {
    for (const t of tree.tabs) {
      if (t.kind === 'terminal' && t.terminalId === terminalId) return tree;
    }
    return null;
  }
  return (
    findLeafContainingTerminal(tree.children[0], terminalId) ??
    findLeafContainingTerminal(tree.children[1], terminalId)
  );
}

export function findLeafContainingFile(
  tree: TreeNode,
  filePath: string
): LeafNode | null {
  if (tree.type === 'leaf') {
    for (const t of tree.tabs) {
      if (t.kind === 'editor' && t.filePath === filePath) return tree;
    }
    return null;
  }
  return (
    findLeafContainingFile(tree.children[0], filePath) ??
    findLeafContainingFile(tree.children[1], filePath)
  );
}

/**
 * DFS collection of leaf **slotIds** in left-to-right / top-to-bottom order.
 *
 * NOTE (Phase 1 compat): this keeps the v1 signature that returned a list of
 * slotId strings, because numerous consumers still read it that way. For a
 * stricter "leaf ids" view use `collectLeafIds`, and for a list of terminal
 * ids only use `collectTerminalSlotIds`.
 *
 * In practice `slotId` on a v2 leaf equals either its first terminal's
 * terminalId or a `__empty_*` placeholder, so the output order and content
 * matches v1 for the common case of one-tab-per-leaf trees.
 */
export function collectLeaves(tree: TreeNode): string[] {
  const out: string[] = [];
  const walk = (n: TreeNode): void => {
    if (n.type === 'leaf') {
      out.push(n.slotId);
    } else {
      walk(n.children[0]);
      walk(n.children[1]);
    }
  };
  walk(tree);
  return out;
}

/** Flat DFS list of leaf node ids (not slotIds) in reading order. */
export function collectLeafIds(tree: TreeNode): string[] {
  const out: string[] = [];
  const walk = (n: TreeNode): void => {
    if (n.type === 'leaf') {
      out.push(n.id);
    } else {
      walk(n.children[0]);
      walk(n.children[1]);
    }
  };
  walk(tree);
  return out;
}

/**
 * DFS list of terminal ids pulled from TerminalTab entries in reading order.
 * Skips editor / panel / empty tabs. Use this when a v1 caller truly wanted
 * the set of live terminal ids (e.g. for PTY cleanup).
 */
export function collectTerminalSlotIds(tree: TreeNode): string[] {
  const out: string[] = [];
  const walk = (n: TreeNode): void => {
    if (n.type === 'leaf') {
      for (const t of n.tabs) {
        if (t.kind === 'terminal') out.push(t.terminalId);
      }
    } else {
      walk(n.children[0]);
      walk(n.children[1]);
    }
  };
  walk(tree);
  return out;
}

/** Flat list of every tab plus the id of its containing leaf. */
export function collectAllTabs(
  tree: TreeNode
): Array<{ leafId: string; tab: LeafTab }> {
  const out: Array<{ leafId: string; tab: LeafTab }> = [];
  const walk = (n: TreeNode): void => {
    if (n.type === 'leaf') {
      for (const t of n.tabs) out.push({ leafId: n.id, tab: t });
    } else {
      walk(n.children[0]);
      walk(n.children[1]);
    }
  };
  walk(tree);
  return out;
}

export function countTabsByKind(tree: TreeNode, kind: LeafTabKind): number {
  let n = 0;
  const walk = (node: TreeNode): void => {
    if (node.type === 'leaf') {
      for (const t of node.tabs) if (t.kind === kind) n++;
    } else {
      walk(node.children[0]);
      walk(node.children[1]);
    }
  };
  walk(tree);
  return n;
}

export function countLeaves(tree: TreeNode): number {
  if (tree.type === 'leaf') return 1;
  return countLeaves(tree.children[0]) + countLeaves(tree.children[1]);
}

// ── Tab mutations (immutable) ───────────────────────────────────────────────

/**
 * Append `tab` to the leaf with `leafId`. If the leaf's sole tab is currently
 * an EmptyTab placeholder, it is replaced rather than appended so users don't
 * end up with a permanent "Empty" card next to real content. Returns the
 * same tree reference if the leaf is not found.
 */
export function addTabToLeaf(
  tree: TreeNode,
  leafId: string,
  tab: LeafTab,
  activate: boolean = true
): TreeNode {
  if (tree.type === 'leaf') {
    if (tree.id !== leafId) return tree;
    const onlyEmpty =
      tree.tabs.length === 1 && tree.tabs[0].kind === 'empty';
    const nextTabs = onlyEmpty ? [tab] : [...tree.tabs, tab];
    const nextActive = activate ? tab.id : tree.activeTabId;
    return rebuildLeaf(tree, nextTabs, nextActive);
  }
  const [a, b] = tree.children;
  const newA = addTabToLeaf(a, leafId, tab, activate);
  if (newA !== a) return { ...tree, children: [newA, b] };
  const newB = addTabToLeaf(b, leafId, tab, activate);
  if (newB !== b) return { ...tree, children: [a, newB] };
  return tree;
}

/**
 * Remove the tab `tabId` from leaf `leafId`. If it was the last real tab,
 * the leaf is kept and its tab list is replaced with a single fresh EmptyTab
 * (the caller decides whether to collapse the leaf entirely).
 */
export function removeTabFromLeaf(
  tree: TreeNode,
  leafId: string,
  tabId: string
): TreeNode {
  if (tree.type === 'leaf') {
    if (tree.id !== leafId) return tree;
    if (!tree.tabs.some((t) => t.id === tabId)) return tree;
    const nextTabs = tree.tabs.filter((t) => t.id !== tabId);
    if (nextTabs.length === 0) {
      const empty = createEmptyTab();
      return rebuildLeaf(tree, [empty], empty.id);
    }
    // If the removed tab was active, pick the tab that took its place (or
    // the new last tab if the active tab was the last one).
    const activeRemoved = tree.activeTabId === tabId;
    let nextActive = tree.activeTabId;
    if (activeRemoved) {
      const removedIndex = tree.tabs.findIndex((t) => t.id === tabId);
      const fallbackIndex = Math.min(removedIndex, nextTabs.length - 1);
      nextActive = nextTabs[fallbackIndex].id;
    }
    return rebuildLeaf(tree, nextTabs, nextActive);
  }
  const [a, b] = tree.children;
  const newA = removeTabFromLeaf(a, leafId, tabId);
  if (newA !== a) return { ...tree, children: [newA, b] };
  const newB = removeTabFromLeaf(b, leafId, tabId);
  if (newB !== b) return { ...tree, children: [a, newB] };
  return tree;
}

/** Set the active tab on a leaf. No-op if leaf/tab not found. */
export function setActiveTab(
  tree: TreeNode,
  leafId: string,
  tabId: string
): TreeNode {
  if (tree.type === 'leaf') {
    if (tree.id !== leafId) return tree;
    if (tree.activeTabId === tabId) return tree;
    if (!tree.tabs.some((t) => t.id === tabId)) return tree;
    return rebuildLeaf(tree, tree.tabs, tabId);
  }
  const [a, b] = tree.children;
  const newA = setActiveTab(a, leafId, tabId);
  if (newA !== a) return { ...tree, children: [newA, b] };
  const newB = setActiveTab(b, leafId, tabId);
  if (newB !== b) return { ...tree, children: [a, newB] };
  return tree;
}

/**
 * Move a tab from one leaf to another. The source leaf collapses to a single
 * EmptyTab if this was its last tab (same rule as `removeTabFromLeaf`). If
 * `activateOnDest` is true (default), the moved tab becomes active on the
 * destination leaf.
 */
export function moveTabBetweenLeaves(
  tree: TreeNode,
  fromLeafId: string,
  toLeafId: string,
  tabId: string,
  activateOnDest: boolean = true
): TreeNode {
  if (fromLeafId === toLeafId) return tree;
  const fromLeaf = findLeafById(tree, fromLeafId);
  if (!fromLeaf) return tree;
  const tab = fromLeaf.tabs.find((t) => t.id === tabId);
  if (!tab) return tree;
  const toLeaf = findLeafById(tree, toLeafId);
  if (!toLeaf) return tree;

  const removed = removeTabFromLeaf(tree, fromLeafId, tabId);
  return addTabToLeaf(removed, toLeafId, tab, activateOnDest);
}

// ── Leaf mutations (immutable) ──────────────────────────────────────────────

/**
 * Replace the leaf containing terminal `targetSlotId` with a split node
 * containing [originalLeaf, newLeaf], where the new leaf wraps a single
 * terminal tab for `newSlotId`. Legacy signature preserved from v1 — see
 * `splitLeafNode` for the preferred leaf-id-keyed API.
 */
export function splitLeaf(
  tree: TreeNode,
  targetSlotId: string,
  newSlotId: string,
  direction: SplitDirection
): TreeNode {
  if (tree.type === 'leaf') {
    const matches =
      tree.slotId === targetSlotId ||
      tree.tabs.some(
        (t) => t.kind === 'terminal' && t.terminalId === targetSlotId
      );
    if (!matches) return tree;
    const newLeaf = createLeaf(newSlotId);
    return createSplit(direction, tree, newLeaf, 0.5);
  }

  const [a, b] = tree.children;
  const newA = splitLeaf(a, targetSlotId, newSlotId, direction);
  if (newA !== a) {
    return { ...tree, children: [newA, b] };
  }
  const newB = splitLeaf(b, targetSlotId, newSlotId, direction);
  if (newB !== b) {
    return { ...tree, children: [a, newB] };
  }
  return tree;
}

/**
 * Preferred v2 split API: split the leaf identified by `leafId`, inserting a
 * new leaf that wraps `newTab`. Returns the same tree if `leafId` is not
 * found.
 */
export function splitLeafNode(
  tree: TreeNode,
  leafId: string,
  newTab: LeafTab,
  direction: SplitDirection
): TreeNode {
  if (tree.type === 'leaf') {
    if (tree.id !== leafId) return tree;
    const newLeaf = createLeafWithTab(newTab);
    return createSplit(direction, tree, newLeaf, 0.5);
  }
  const [a, b] = tree.children;
  const newA = splitLeafNode(a, leafId, newTab, direction);
  if (newA !== a) return { ...tree, children: [newA, b] };
  const newB = splitLeafNode(b, leafId, newTab, direction);
  if (newB !== b) return { ...tree, children: [a, newB] };
  return tree;
}

/**
 * Remove the leaf containing terminal `slotId` entirely. Legacy signature —
 * caller intent is "this terminal is gone, close its pane". The sibling is
 * promoted to replace the parent SplitNode. Returns null if the removed
 * leaf was the whole root.
 */
export function removeLeaf(tree: TreeNode, slotId: string): TreeNode | null {
  const leafMatches = (leaf: LeafNode): boolean => {
    if (leaf.slotId === slotId) return true;
    return leaf.tabs.some(
      (t) => t.kind === 'terminal' && t.terminalId === slotId
    );
  };

  if (tree.type === 'leaf') {
    return leafMatches(tree) ? null : tree;
  }

  const [a, b] = tree.children;

  if (a.type === 'leaf' && leafMatches(a)) return b;
  if (b.type === 'leaf' && leafMatches(b)) return a;

  const newA = removeLeaf(a, slotId);
  if (newA !== a) {
    if (newA === null) return b;
    return { ...tree, children: [newA, b] };
  }
  const newB = removeLeaf(b, slotId);
  if (newB !== b) {
    if (newB === null) return a;
    return { ...tree, children: [a, newB] };
  }
  return tree;
}

/**
 * Preferred v2 leaf-removal API: remove the leaf with the given node id
 * outright. The sibling is promoted. Returns null if the whole tree
 * collapses, or the same tree reference if `leafId` is not found.
 */
export function removeLeafById(
  tree: TreeNode,
  leafId: string
): TreeNode | null {
  if (tree.type === 'leaf') {
    return tree.id === leafId ? null : tree;
  }
  const [a, b] = tree.children;
  if (a.type === 'leaf' && a.id === leafId) return b;
  if (b.type === 'leaf' && b.id === leafId) return a;

  const newA = removeLeafById(a, leafId);
  if (newA !== a) {
    if (newA === null) return b;
    return { ...tree, children: [newA, b] };
  }
  const newB = removeLeafById(b, leafId);
  if (newB !== b) {
    if (newB === null) return a;
    return { ...tree, children: [a, newB] };
  }
  return tree;
}

/** Update the ratio on the SplitNode with the given id. Ratio is clamped. */
export function resizeSplit(
  tree: TreeNode,
  nodeId: string,
  ratio: number
): TreeNode {
  if (tree.type === 'leaf') return tree;
  if (tree.id === nodeId) {
    return { ...tree, ratio: clampRatio(ratio) };
  }
  const [a, b] = tree.children;
  const newA = resizeSplit(a, nodeId, ratio);
  if (newA !== a) return { ...tree, children: [newA, b] };
  const newB = resizeSplit(b, nodeId, ratio);
  if (newB !== b) return { ...tree, children: [a, newB] };
  return tree;
}

// ── Preset tree builders ────────────────────────────────────────────────────

/**
 * Build a balanced binary tree from a list of slotIds. Used as a starting
 * point and as the snap-to-preset implementation. `hint` matches one of the
 * legacy GRID_LAYOUTS ids ('1x1', '2x2', '2L1R', etc.) so the preset buttons
 * in the tab bar still produce the expected topology.
 *
 * Placeholder slots (`null` entries) become leaves wrapping a single
 * EmptyTab; real slot ids become leaves wrapping a single TerminalTab.
 */
export function buildGridTree(
  slotIds: Array<string | null>,
  hint?: string
): TreeNode {
  const ids = slotIds.length > 0 ? slotIds : [null];
  const resolved = ids.map((id, i) => id ?? `__empty_${i}__`);

  const makeLeaf = (id: string): LeafNode => createLeaf(id);

  if (hint) {
    const tree = buildFromHint(hint, resolved, makeLeaf);
    if (tree) return tree;
  }

  return buildBalanced(resolved, makeLeaf);
}

function buildFromHint(
  hint: string,
  ids: string[],
  makeLeaf: (id: string) => LeafNode
): TreeNode | null {
  const pad = (n: number): string[] => {
    const out: string[] = [];
    for (let i = 0; i < n; i++) out.push(ids[i] ?? `__empty_${i}__`);
    return out;
  };

  const col = (children: TreeNode[]): TreeNode =>
    stackNodes(children, 'vertical');
  const row = (children: TreeNode[]): TreeNode =>
    stackNodes(children, 'horizontal');

  switch (hint) {
    case '1x1': {
      return makeLeaf(pad(1)[0]);
    }
    case '1x2': {
      const p = pad(2);
      return row([makeLeaf(p[0]), makeLeaf(p[1])]);
    }
    case '1x3': {
      const p = pad(3);
      return row([makeLeaf(p[0]), makeLeaf(p[1]), makeLeaf(p[2])]);
    }
    case '1x4': {
      const p = pad(4);
      return row([makeLeaf(p[0]), makeLeaf(p[1]), makeLeaf(p[2]), makeLeaf(p[3])]);
    }
    case '2x1': {
      const p = pad(2);
      return col([makeLeaf(p[0]), makeLeaf(p[1])]);
    }
    case '3x1': {
      const p = pad(3);
      return col([makeLeaf(p[0]), makeLeaf(p[1]), makeLeaf(p[2])]);
    }
    case '2x2': {
      const p = pad(4);
      return col([
        row([makeLeaf(p[0]), makeLeaf(p[1])]),
        row([makeLeaf(p[2]), makeLeaf(p[3])]),
      ]);
    }
    case '3x2': {
      const p = pad(6);
      return col([
        row([makeLeaf(p[0]), makeLeaf(p[1])]),
        row([makeLeaf(p[2]), makeLeaf(p[3])]),
        row([makeLeaf(p[4]), makeLeaf(p[5])]),
      ]);
    }
    case '3x3': {
      const p = pad(9);
      return col([
        row([makeLeaf(p[0]), makeLeaf(p[1]), makeLeaf(p[2])]),
        row([makeLeaf(p[3]), makeLeaf(p[4]), makeLeaf(p[5])]),
        row([makeLeaf(p[6]), makeLeaf(p[7]), makeLeaf(p[8])]),
      ]);
    }
    case '2L1R': {
      const p = pad(3);
      return row([col([makeLeaf(p[0]), makeLeaf(p[1])]), makeLeaf(p[2])]);
    }
    case '1L2R': {
      const p = pad(3);
      return row([makeLeaf(p[0]), col([makeLeaf(p[1]), makeLeaf(p[2])])]);
    }
    case '2T1B': {
      const p = pad(3);
      return col([row([makeLeaf(p[0]), makeLeaf(p[1])]), makeLeaf(p[2])]);
    }
    case '1T2B': {
      const p = pad(3);
      return col([makeLeaf(p[0]), row([makeLeaf(p[1]), makeLeaf(p[2])])]);
    }
    default:
      return null;
  }
}

function stackNodes(nodes: TreeNode[], direction: SplitDirection): TreeNode {
  if (nodes.length === 0) {
    return createLeaf('__empty_0__');
  }
  if (nodes.length === 1) return nodes[0];
  if (nodes.length === 2) {
    return createSplit(direction, nodes[0], nodes[1], 0.5);
  }
  const first = nodes[0];
  const rest = stackNodes(nodes.slice(1), direction);
  const ratio = clampRatio(1 / nodes.length);
  return createSplit(direction, first, rest, ratio);
}

function buildBalanced(
  ids: string[],
  makeLeaf: (id: string) => LeafNode,
  depth: number = 0
): TreeNode {
  if (ids.length === 0) return makeLeaf('__empty_0__');
  if (ids.length === 1) return makeLeaf(ids[0]);

  const mid = Math.ceil(ids.length / 2);
  const left = buildBalanced(ids.slice(0, mid), makeLeaf, depth + 1);
  const right = buildBalanced(ids.slice(mid), makeLeaf, depth + 1);
  const direction: SplitDirection = depth % 2 === 0 ? 'horizontal' : 'vertical';
  return createSplit(direction, left, right, 0.5);
}

// ── Persistence ─────────────────────────────────────────────────────────────

export interface SerializedTree {
  version: 2;
  tree: TreeNode;
}

export function serializeTree(tree: TreeNode): SerializedTree {
  return { version: 2, tree: cloneTree(tree) };
}

/**
 * Accept both v1 (`{version:1, tree:<v1>}`) and v2 payloads. v1 trees are
 * transparently migrated to v2 via `migrateV1ToV2`. Unknown versions and
 * invalid shapes return null.
 */
export function deserializeTree(data: unknown): TreeNode | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as { version?: number; tree?: unknown };
  if (d.version === 2) {
    if (!isValidNode(d.tree)) return null;
    return cloneTree(d.tree);
  }
  if (d.version === 1) {
    return migrateV1ToV2(d.tree);
  }
  return null;
}

/**
 * Walk a v1 tree and produce a v2 tree. Each v1 leaf
 * `{type:'leaf', id, slotId}` becomes a v2 leaf containing a single tab:
 *   - EmptyTab if `slotId` starts with `__empty_`
 *   - TerminalTab with `terminalId = slotId` otherwise
 *
 * Returns null if the input is not a valid v1 node shape.
 */
export function migrateV1ToV2(v1Tree: unknown): TreeNode | null {
  if (!isValidV1Node(v1Tree)) return null;
  const walk = (node: V1Node): TreeNode => {
    if (node.type === 'leaf') {
      const tab: LeafTab = node.slotId.startsWith('__empty_')
        ? createEmptyTab()
        : createTerminalTab(node.slotId);
      return {
        type: 'leaf',
        id: node.id,
        tabs: [tab],
        activeTabId: tab.id,
        slotId: node.slotId,
      };
    }
    return {
      type: 'split',
      id: node.id,
      direction: node.direction,
      ratio: clampRatio(node.ratio),
      children: [walk(node.children[0]), walk(node.children[1])],
    };
  };
  return walk(v1Tree);
}

interface V1LeafNode {
  type: 'leaf';
  id: string;
  slotId: string;
}
interface V1SplitNode {
  type: 'split';
  id: string;
  direction: SplitDirection;
  ratio: number;
  children: [V1Node, V1Node];
}
type V1Node = V1LeafNode | V1SplitNode;

function isValidV1Node(node: unknown): node is V1Node {
  if (!node || typeof node !== 'object') return false;
  const n = node as Record<string, unknown>;
  if (n.type === 'leaf') {
    return typeof n.id === 'string' && typeof n.slotId === 'string';
  }
  if (n.type === 'split') {
    if (typeof n.id !== 'string') return false;
    if (n.direction !== 'horizontal' && n.direction !== 'vertical') return false;
    if (typeof n.ratio !== 'number') return false;
    if (!Array.isArray(n.children) || n.children.length !== 2) return false;
    return isValidV1Node(n.children[0]) && isValidV1Node(n.children[1]);
  }
  return false;
}

function cloneTree(node: TreeNode): TreeNode {
  if (node.type === 'leaf') {
    return {
      type: 'leaf',
      id: node.id,
      tabs: node.tabs.map(cloneTab),
      activeTabId: node.activeTabId,
      slotId: node.slotId,
    };
  }
  return {
    type: 'split',
    id: node.id,
    direction: node.direction,
    ratio: clampRatio(node.ratio),
    children: [cloneTree(node.children[0]), cloneTree(node.children[1])],
  };
}

function cloneTab(tab: LeafTab): LeafTab {
  switch (tab.kind) {
    case 'terminal':
      return { id: tab.id, kind: 'terminal', terminalId: tab.terminalId };
    case 'editor':
      return { id: tab.id, kind: 'editor', filePath: tab.filePath };
    case 'panel':
      return { id: tab.id, kind: 'panel', panelId: tab.panelId };
    case 'empty':
      return { id: tab.id, kind: 'empty' };
  }
}

function isValidTab(tab: unknown): tab is LeafTab {
  if (!tab || typeof tab !== 'object') return false;
  const t = tab as Record<string, unknown>;
  if (typeof t.id !== 'string') return false;
  switch (t.kind) {
    case 'terminal':
      return typeof t.terminalId === 'string';
    case 'editor':
      return typeof t.filePath === 'string';
    case 'panel':
      return typeof t.panelId === 'string';
    case 'empty':
      return true;
    default:
      return false;
  }
}

function isValidNode(node: unknown): node is TreeNode {
  if (!node || typeof node !== 'object') return false;
  const n = node as Record<string, unknown>;
  if (n.type === 'leaf') {
    if (typeof n.id !== 'string') return false;
    if (typeof n.slotId !== 'string') return false;
    if (!Array.isArray(n.tabs) || n.tabs.length === 0) return false;
    if (typeof n.activeTabId !== 'string') return false;
    if (!n.tabs.every(isValidTab)) return false;
    const tabs = n.tabs as LeafTab[];
    if (!tabs.some((t) => t.id === n.activeTabId)) return false;
    return true;
  }
  if (n.type === 'split') {
    if (typeof n.id !== 'string') return false;
    if (n.direction !== 'horizontal' && n.direction !== 'vertical') return false;
    if (typeof n.ratio !== 'number') return false;
    if (!Array.isArray(n.children) || n.children.length !== 2) return false;
    return isValidNode(n.children[0]) && isValidNode(n.children[1]);
  }
  return false;
}
