/**
 * Tests for `useTerminalStore` — focused on the Phase 2A tabbed-leaf actions
 * (openFileInActiveLeaf dedup, closeTabInLeaf collapse rules, splitActiveLeaf
 * leaf-id tracking) and v1→v2 persistence migration.
 *
 * The store module reads from `localStorage` at import-time, so we install a
 * lightweight in-memory stub on `globalThis` BEFORE dynamically importing the
 * store inside each test. This lets us seed v1 payloads and verify the
 * migration path without needing jsdom.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// ── localStorage stub ──────────────────────────────────────────────────────

class MemoryStorage {
  private store: Map<string, string> = new Map();
  getItem(k: string): string | null {
    return this.store.has(k) ? (this.store.get(k) as string) : null;
  }
  setItem(k: string, v: string): void {
    this.store.set(k, String(v));
  }
  removeItem(k: string): void {
    this.store.delete(k);
  }
  clear(): void {
    this.store.clear();
  }
  key(i: number): string | null {
    return Array.from(this.store.keys())[i] ?? null;
  }
  get length(): number {
    return this.store.size;
  }
}

function installLocalStorage(seed?: Record<string, string>): MemoryStorage {
  const ms = new MemoryStorage();
  if (seed) for (const [k, v] of Object.entries(seed)) ms.setItem(k, v);
  // Attach to globalThis so the store's `localStorage.getItem(...)` resolves.
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = ms;
  return ms;
}

function uninstallLocalStorage(): void {
  delete (globalThis as unknown as { localStorage?: MemoryStorage })
    .localStorage;
}

// Load the store fresh for each test so localStorage seeding takes effect.
// Vitest supports `vi.resetModules()` but we can just use a dynamic import
// after bumping `vi`'s module cache — simplest is to import within a helper
// and rely on Vitest's per-file isolation. To guarantee a fresh module graph
// inside THIS file, we use `vi.resetModules` where needed.
async function loadStoreModule() {
  const { default: _ } = { default: null };
  void _;
  // Dynamic import picks up whatever globalThis.localStorage is at call time.
  const mod = await import('../../src/renderer/stores/useTerminalStore');
  return mod;
}

describe('useTerminalStore — Phase 2A tabbed-leaf actions', () => {
  beforeEach(async () => {
    installLocalStorage();
    // Reset module graph so each test re-reads localStorage on import.
    const { vi } = await import('vitest');
    vi.resetModules();
  });

  afterEach(() => {
    uninstallLocalStorage();
  });

  // ── openFileInActiveLeaf dedup ──────────────────────────────────────────

  it('openFileInActiveLeaf dedups when the same file is opened twice', async () => {
    const { useTerminalStore } = await loadStoreModule();
    const {
      createLeafWithTab,
      createTerminalTab,
      collectAllTabs,
    } = await import('../../src/renderer/lib/splitTree');

    // Seed tree with a single real terminal leaf so openFileInActiveLeaf has
    // a target that isn't the empty placeholder.
    const term = createLeafWithTab(createTerminalTab('term-1'));
    useTerminalStore.getState().setLayoutTree(term);
    useTerminalStore.getState().setActiveLeafId(term.id);

    useTerminalStore.getState().openFileInActiveLeaf('/abs/foo.ts');
    useTerminalStore.getState().openFileInActiveLeaf('/abs/foo.ts'); // dup

    const tree = useTerminalStore.getState().layoutTree;
    const editorTabs = collectAllTabs(tree).filter(
      (e) => e.tab.kind === 'editor'
    );
    expect(editorTabs).toHaveLength(1);
    expect(
      editorTabs[0].tab.kind === 'editor' && editorTabs[0].tab.filePath
    ).toBe('/abs/foo.ts');
  });

  it('openFileInActiveLeaf opens distinct files as separate tabs', async () => {
    const { useTerminalStore } = await loadStoreModule();
    const {
      createLeafWithTab,
      createTerminalTab,
      collectAllTabs,
    } = await import('../../src/renderer/lib/splitTree');

    const term = createLeafWithTab(createTerminalTab('term-1'));
    useTerminalStore.getState().setLayoutTree(term);
    useTerminalStore.getState().setActiveLeafId(term.id);

    useTerminalStore.getState().openFileInActiveLeaf('/abs/a.ts');
    useTerminalStore.getState().openFileInActiveLeaf('/abs/b.ts');

    const tree = useTerminalStore.getState().layoutTree;
    const editorTabs = collectAllTabs(tree).filter(
      (e) => e.tab.kind === 'editor'
    );
    expect(editorTabs).toHaveLength(2);
  });

  // ── closeTabInLeaf collapse rules ────────────────────────────────────────

  it('closeTabInLeaf collapses the leaf when it was the last tab and >1 leaf exists', async () => {
    const { useTerminalStore } = await loadStoreModule();
    const {
      createLeafWithTab,
      createTerminalTab,
      createSplit,
      countLeaves,
      findLeafContainingTerminal,
    } = await import('../../src/renderer/lib/splitTree');

    const leafA = createLeafWithTab(createTerminalTab('term-a'));
    const leafB = createLeafWithTab(createTerminalTab('term-b'));
    const tree = createSplit('horizontal', leafA, leafB, 0.5);
    useTerminalStore.getState().setLayoutTree(tree);

    // Close term-b's sole tab — expect leafB to be removed entirely.
    const bInTree = findLeafContainingTerminal(
      useTerminalStore.getState().layoutTree,
      'term-b'
    );
    expect(bInTree).not.toBeNull();
    const bTabId = bInTree!.tabs[0].id;
    useTerminalStore.getState().closeTabInLeaf(bInTree!.id, bTabId);

    const next = useTerminalStore.getState().layoutTree;
    expect(countLeaves(next)).toBe(1);
    // Remaining leaf should contain term-a.
    expect(findLeafContainingTerminal(next, 'term-a')).not.toBeNull();
    expect(findLeafContainingTerminal(next, 'term-b')).toBeNull();
  });

  it('closeTabInLeaf on the only-leaf leaves an empty placeholder leaf', async () => {
    const { useTerminalStore } = await loadStoreModule();
    const {
      createLeafWithTab,
      createTerminalTab,
      countLeaves,
    } = await import('../../src/renderer/lib/splitTree');

    const sole = createLeafWithTab(createTerminalTab('term-solo'));
    useTerminalStore.getState().setLayoutTree(sole);

    // Close the last tab — the only-leaf rule kicks in.
    useTerminalStore
      .getState()
      .closeTabInLeaf(sole.id, sole.tabs[0].id);

    const next = useTerminalStore.getState().layoutTree;
    expect(countLeaves(next)).toBe(1);
    expect(next.type).toBe('leaf');
    if (next.type === 'leaf') {
      expect(next.tabs).toHaveLength(1);
      expect(next.tabs[0].kind).toBe('empty');
    }
  });

  // ── splitActiveLeaf activeLeafId tracking ────────────────────────────────

  it('splitActiveLeaf updates activeLeafId to the newly created leaf', async () => {
    const { useTerminalStore } = await loadStoreModule();
    const {
      createLeafWithTab,
      createTerminalTab,
      findLeafContainingTerminal,
      countLeaves,
    } = await import('../../src/renderer/lib/splitTree');

    // Seed a single real terminal leaf so splitActiveLeaf actually splits
    // rather than replacing a placeholder.
    const leafA = createLeafWithTab(createTerminalTab('term-a'));
    useTerminalStore.getState().setLayoutTree(leafA);
    useTerminalStore.getState().setActiveLeafId(leafA.id);

    useTerminalStore.getState().splitActiveLeaf('horizontal', 'term-b');

    const tree = useTerminalStore.getState().layoutTree;
    expect(countLeaves(tree)).toBe(2);
    const newLeaf = findLeafContainingTerminal(tree, 'term-b');
    expect(newLeaf).not.toBeNull();
    expect(useTerminalStore.getState().activeLeafId).toBe(newLeaf!.id);
    // And the getActiveLeaf derivation agrees.
    expect(useTerminalStore.getState().getActiveLeaf()?.id).toBe(newLeaf!.id);
  });

  it('splitActiveLeaf fills an empty placeholder leaf instead of splitting', async () => {
    const { useTerminalStore } = await loadStoreModule();
    const { countLeaves, findLeafContainingTerminal } = await import(
      '../../src/renderer/lib/splitTree'
    );

    // Default initial tree is a single __empty_0__ placeholder leaf.
    useTerminalStore.getState().splitActiveLeaf('horizontal', 'term-a');
    const tree = useTerminalStore.getState().layoutTree;
    expect(countLeaves(tree)).toBe(1);
    const leaf = findLeafContainingTerminal(tree, 'term-a');
    expect(leaf).not.toBeNull();
    expect(useTerminalStore.getState().activeLeafId).toBe(leaf!.id);
  });
});

// ── v1 persistence migration ───────────────────────────────────────────────

describe('useTerminalStore — v1 persistence migration', () => {
  beforeEach(async () => {
    const { vi } = await import('vitest');
    vi.resetModules();
  });

  afterEach(() => {
    uninstallLocalStorage();
  });

  it('loads a v1 layout-tree payload and migrates it to v2 on store init', async () => {
    // v1 leaf shape: { type, id, slotId } with no tabs/activeTabId.
    const v1Payload = {
      'C:/fake/project': {
        version: 1,
        tree: {
          type: 'split',
          id: 'split-1',
          direction: 'horizontal',
          ratio: 0.5,
          children: [
            { type: 'leaf', id: 'leaf-a', slotId: 'term-a' },
            { type: 'leaf', id: 'leaf-b', slotId: '__empty_1__' },
          ],
        },
      },
    };

    installLocalStorage({
      'subframe-layout-trees-v1': JSON.stringify(v1Payload),
    });

    const { useTerminalStore } = await loadStoreModule();
    const { findLeafContainingTerminal } = await import(
      '../../src/renderer/lib/splitTree'
    );

    const byProject = useTerminalStore.getState().layoutTreeByProject;
    const tree = byProject.get('C:/fake/project');
    expect(tree).toBeDefined();
    expect(tree!.type).toBe('split');

    if (tree && tree.type === 'split') {
      // Both children should now be v2 leaves with `tabs` and `activeTabId`.
      for (const child of tree.children) {
        expect(child.type).toBe('leaf');
        if (child.type === 'leaf') {
          expect(Array.isArray(child.tabs)).toBe(true);
          expect(child.tabs.length).toBeGreaterThanOrEqual(1);
          expect(typeof child.activeTabId).toBe('string');
          expect(child.tabs.some((t) => t.id === child.activeTabId)).toBe(true);
        }
      }
    }

    // The real-terminal leaf should contain a TerminalTab for 'term-a'.
    const termLeaf = findLeafContainingTerminal(tree!, 'term-a');
    expect(termLeaf).not.toBeNull();
    // The placeholder slot should now be an EmptyTab (not a terminal).
    if (tree && tree.type === 'split') {
      const emptyChild = tree.children.find(
        (c) => c.type === 'leaf' && c.id === 'leaf-b'
      );
      expect(emptyChild).toBeDefined();
      if (emptyChild && emptyChild.type === 'leaf') {
        expect(emptyChild.tabs[0].kind).toBe('empty');
      }
    }
  });
});
