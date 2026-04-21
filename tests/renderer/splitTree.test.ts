/**
 * Tests for splitTree — immutable binary split tree for terminal grid layout.
 */

import { describe, it, expect } from 'vitest';
import {
  createLeaf,
  createLeafWithTab,
  createSplit,
  createTerminalTab,
  createEditorTab,
  createPanelTab,
  createEmptyTab,
  splitLeaf,
  splitLeafNode,
  removeLeaf,
  removeLeafById,
  resizeSplit,
  findLeaf,
  findLeafById,
  findLeafByTabId,
  findLeafContainingTerminal,
  findLeafContainingFile,
  addTabToLeaf,
  removeTabFromLeaf,
  setActiveTab,
  moveTabBetweenLeaves,
  collectLeaves,
  collectLeafIds,
  collectTerminalSlotIds,
  collectAllTabs,
  countLeaves,
  countTabsByKind,
  buildGridTree,
  serializeTree,
  deserializeTree,
  migrateV1ToV2,
  clampRatio,
  MIN_RATIO,
  MAX_RATIO,
  type TreeNode,
  type LeafNode,
  type SplitNode,
  type TerminalTab,
  type EditorTab,
} from '../../src/renderer/lib/splitTree';

// ─── clampRatio ────────────────────────────────────────────────────────────

describe('clampRatio', () => {
  it('returns value unchanged when within bounds', () => {
    expect(clampRatio(0.5)).toBe(0.5);
    expect(clampRatio(0.25)).toBe(0.25);
    expect(clampRatio(0.75)).toBe(0.75);
  });

  it('clamps values below MIN_RATIO', () => {
    expect(clampRatio(0)).toBe(MIN_RATIO);
    expect(clampRatio(-1)).toBe(MIN_RATIO);
    expect(clampRatio(0.1)).toBe(MIN_RATIO);
  });

  it('clamps values above MAX_RATIO', () => {
    expect(clampRatio(1)).toBe(MAX_RATIO);
    expect(clampRatio(10)).toBe(MAX_RATIO);
    expect(clampRatio(0.99)).toBe(MAX_RATIO);
  });

  it('returns 0.5 for non-finite values', () => {
    expect(clampRatio(NaN)).toBe(0.5);
    expect(clampRatio(Infinity)).toBe(0.5);
    expect(clampRatio(-Infinity)).toBe(0.5);
  });
});

// ─── createLeaf / createSplit ──────────────────────────────────────────────

describe('createLeaf', () => {
  it('creates a leaf node with slotId and unique id', () => {
    const leaf = createLeaf('term-1');
    expect(leaf.type).toBe('leaf');
    expect(leaf.slotId).toBe('term-1');
    expect(typeof leaf.id).toBe('string');
    expect(leaf.id.length).toBeGreaterThan(0);
  });

  it('generates different ids for different leaves', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 50; i++) {
      ids.add(createLeaf('x').id);
    }
    // Probabilistically should be 50 unique ids
    expect(ids.size).toBeGreaterThan(40);
  });
});

describe('createSplit', () => {
  it('creates a split node with children and ratio', () => {
    const a = createLeaf('a');
    const b = createLeaf('b');
    const s = createSplit('horizontal', a, b, 0.3);
    expect(s.type).toBe('split');
    expect(s.direction).toBe('horizontal');
    expect(s.ratio).toBe(0.3);
    expect(s.children[0]).toBe(a);
    expect(s.children[1]).toBe(b);
  });

  it('clamps out-of-range ratios at construction', () => {
    const a = createLeaf('a');
    const b = createLeaf('b');
    expect(createSplit('horizontal', a, b, 0.01).ratio).toBe(MIN_RATIO);
    expect(createSplit('horizontal', a, b, 0.99).ratio).toBe(MAX_RATIO);
  });

  it('defaults ratio to 0.5', () => {
    const a = createLeaf('a');
    const b = createLeaf('b');
    expect(createSplit('vertical', a, b).ratio).toBe(0.5);
  });
});

// ─── splitLeaf ─────────────────────────────────────────────────────────────

describe('splitLeaf', () => {
  it('splits a single leaf into a SplitNode with both leaves, ratio 0.5', () => {
    const tree: TreeNode = createLeaf('a');
    const result = splitLeaf(tree, 'a', 'b', 'horizontal');
    expect(result.type).toBe('split');
    const s = result as SplitNode;
    expect(s.ratio).toBe(0.5);
    expect(s.direction).toBe('horizontal');
    expect(s.children[0].type).toBe('leaf');
    expect((s.children[0] as LeafNode).slotId).toBe('a');
    expect((s.children[1] as LeafNode).slotId).toBe('b');
  });

  it('returns the tree unchanged when target slotId is not found', () => {
    const tree: TreeNode = createLeaf('a');
    const result = splitLeaf(tree, 'does-not-exist', 'b', 'horizontal');
    expect(result).toBe(tree);
  });

  it('supports both horizontal and vertical directions', () => {
    const h = splitLeaf(createLeaf('a'), 'a', 'b', 'horizontal');
    const v = splitLeaf(createLeaf('a'), 'a', 'b', 'vertical');
    expect((h as SplitNode).direction).toBe('horizontal');
    expect((v as SplitNode).direction).toBe('vertical');
  });

  it('splits a nested leaf while preserving the rest of the tree', () => {
    // Tree: split(a, split(b, c))
    const tree: TreeNode = createSplit(
      'horizontal',
      createLeaf('a'),
      createSplit('vertical', createLeaf('b'), createLeaf('c'), 0.5),
      0.5
    );
    const result = splitLeaf(tree, 'c', 'd', 'horizontal');
    expect(result.type).toBe('split');
    const leaves = collectLeaves(result);
    expect(leaves).toEqual(['a', 'b', 'c', 'd']);
    // Original "a" leaf should be structurally untouched (same reference).
    const root = result as SplitNode;
    expect(root.children[0]).toBe((tree as SplitNode).children[0]);
  });

  it('returns the same tree reference when target is not in a nested subtree', () => {
    const tree: TreeNode = createSplit(
      'horizontal',
      createLeaf('a'),
      createLeaf('b'),
      0.5
    );
    const result = splitLeaf(tree, 'missing', 'x', 'horizontal');
    expect(result).toBe(tree);
  });
});

// ─── removeLeaf ────────────────────────────────────────────────────────────

describe('removeLeaf', () => {
  it('returns null when removing the only leaf in a single-leaf tree', () => {
    const tree = createLeaf('a');
    expect(removeLeaf(tree, 'a')).toBeNull();
  });

  it('returns the tree unchanged when slot not found in a leaf', () => {
    const tree = createLeaf('a');
    expect(removeLeaf(tree, 'b')).toBe(tree);
  });

  it('promotes the sibling when removing one of two leaves in a SplitNode', () => {
    const a = createLeaf('a');
    const b = createLeaf('b');
    const tree = createSplit('horizontal', a, b, 0.5);
    expect(removeLeaf(tree, 'a')).toBe(b);
    expect(removeLeaf(tree, 'b')).toBe(a);
  });

  it('updates grandparent children when removing a nested leaf', () => {
    // Tree: split(a, split(b, c))
    const inner = createSplit('vertical', createLeaf('b'), createLeaf('c'), 0.4);
    const tree = createSplit('horizontal', createLeaf('a'), inner, 0.6);
    const result = removeLeaf(tree, 'b');
    expect(result).not.toBeNull();
    const root = result as SplitNode;
    expect(root.type).toBe('split');
    expect(root.ratio).toBe(0.6); // outer ratio preserved
    expect(root.direction).toBe('horizontal');
    // Inner split collapsed → 'c' promoted.
    expect(root.children[1].type).toBe('leaf');
    expect((root.children[1] as LeafNode).slotId).toBe('c');
    expect((root.children[0] as LeafNode).slotId).toBe('a');
  });

  it('returns tree unchanged when removing a non-existent nested slot', () => {
    const tree = createSplit(
      'horizontal',
      createLeaf('a'),
      createSplit('vertical', createLeaf('b'), createLeaf('c'), 0.5),
      0.5
    );
    const result = removeLeaf(tree, 'zzz');
    expect(result).toBe(tree);
  });

  it('handles deeply nested removal preserving ratios on all ancestors', () => {
    // split0.3(split0.4(a, b), split0.6(c, split0.7(d, e)))
    const tree = createSplit(
      'horizontal',
      createSplit('vertical', createLeaf('a'), createLeaf('b'), 0.4),
      createSplit(
        'vertical',
        createLeaf('c'),
        createSplit('horizontal', createLeaf('d'), createLeaf('e'), 0.7),
        0.6
      ),
      0.3
    );
    const result = removeLeaf(tree, 'd') as SplitNode;
    expect(result.ratio).toBe(0.3);
    expect((result.children[1] as SplitNode).ratio).toBe(0.6);
    expect(collectLeaves(result)).toEqual(['a', 'b', 'c', 'e']);
  });
});

// ─── resizeSplit ───────────────────────────────────────────────────────────

describe('resizeSplit', () => {
  it('updates ratio on the matching SplitNode only', () => {
    const inner = createSplit('vertical', createLeaf('b'), createLeaf('c'), 0.5);
    const tree = createSplit('horizontal', createLeaf('a'), inner, 0.5);
    const result = resizeSplit(tree, inner.id, 0.7) as SplitNode;
    expect(result.ratio).toBe(0.5); // outer unchanged
    const newInner = result.children[1] as SplitNode;
    expect(newInner.id).toBe(inner.id);
    expect(newInner.ratio).toBe(0.7);
  });

  it('clamps ratio to [MIN_RATIO, MAX_RATIO]', () => {
    const tree = createSplit('horizontal', createLeaf('a'), createLeaf('b'), 0.5);
    const low = resizeSplit(tree, tree.id, 0.01) as SplitNode;
    const high = resizeSplit(tree, tree.id, 0.99) as SplitNode;
    expect(low.ratio).toBe(MIN_RATIO);
    expect(high.ratio).toBe(MAX_RATIO);
  });

  it('returns tree unchanged on unknown nodeId', () => {
    const tree = createSplit('horizontal', createLeaf('a'), createLeaf('b'), 0.5);
    const result = resizeSplit(tree, 'does-not-exist', 0.7);
    expect(result).toBe(tree);
  });

  it('returns leaf unchanged when called on a leaf root', () => {
    const tree = createLeaf('a');
    const result = resizeSplit(tree, tree.id, 0.3);
    expect(result).toBe(tree);
  });
});

// ─── findLeaf / collectLeaves / countLeaves ────────────────────────────────

describe('findLeaf', () => {
  it('returns the leaf when slotId matches in a leaf', () => {
    const tree = createLeaf('a');
    expect(findLeaf(tree, 'a')).toBe(tree);
  });

  it('returns null when slotId does not match', () => {
    expect(findLeaf(createLeaf('a'), 'b')).toBeNull();
  });

  it('finds nested leaves', () => {
    const target = createLeaf('c');
    const tree = createSplit(
      'horizontal',
      createLeaf('a'),
      createSplit('vertical', createLeaf('b'), target, 0.5),
      0.5
    );
    expect(findLeaf(tree, 'c')).toBe(target);
  });

  it('returns null when the slotId is not in the tree', () => {
    const tree = createSplit('horizontal', createLeaf('a'), createLeaf('b'), 0.5);
    expect(findLeaf(tree, 'z')).toBeNull();
  });
});

describe('collectLeaves', () => {
  it('returns a single slotId for a leaf root', () => {
    expect(collectLeaves(createLeaf('a'))).toEqual(['a']);
  });

  it('returns DFS left-to-right order', () => {
    // split(split(a,b), split(c, split(d, e)))
    const tree = createSplit(
      'horizontal',
      createSplit('vertical', createLeaf('a'), createLeaf('b'), 0.5),
      createSplit(
        'vertical',
        createLeaf('c'),
        createSplit('horizontal', createLeaf('d'), createLeaf('e'), 0.5),
        0.5
      ),
      0.5
    );
    expect(collectLeaves(tree)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});

describe('countLeaves', () => {
  it('counts a single leaf', () => {
    expect(countLeaves(createLeaf('a'))).toBe(1);
  });

  it('counts leaves in a nested tree', () => {
    const tree = createSplit(
      'horizontal',
      createLeaf('a'),
      createSplit('vertical', createLeaf('b'), createLeaf('c'), 0.5),
      0.5
    );
    expect(countLeaves(tree)).toBe(3);
  });
});

// ─── buildGridTree ─────────────────────────────────────────────────────────

describe('buildGridTree', () => {
  it('returns a single leaf for a one-id list', () => {
    const tree = buildGridTree(['a']);
    expect(tree.type).toBe('leaf');
    expect((tree as LeafNode).slotId).toBe('a');
  });

  it('handles empty arrays by producing a placeholder leaf', () => {
    const tree = buildGridTree([]);
    expect(tree.type).toBe('leaf');
    expect((tree as LeafNode).slotId).toMatch(/^__empty_/);
  });

  it('maps null slots to __empty_ placeholder slotIds', () => {
    const tree = buildGridTree(['a', null], '1x2') as SplitNode;
    expect(tree.type).toBe('split');
    expect((tree.children[0] as LeafNode).slotId).toBe('a');
    expect((tree.children[1] as LeafNode).slotId).toMatch(/^__empty_/);
  });

  it('builds a horizontal 1x2 preset for hint=1x2', () => {
    const tree = buildGridTree(['a', 'b'], '1x2') as SplitNode;
    expect(tree.type).toBe('split');
    expect(tree.direction).toBe('horizontal');
    expect(collectLeaves(tree)).toEqual(['a', 'b']);
  });

  it('builds a vertical 2x1 preset for hint=2x1', () => {
    const tree = buildGridTree(['a', 'b'], '2x1') as SplitNode;
    expect(tree.direction).toBe('vertical');
    expect(collectLeaves(tree)).toEqual(['a', 'b']);
  });

  it('builds a balanced 2x2 tree for hint=2x2 with 4 slots', () => {
    const tree = buildGridTree(['a', 'b', 'c', 'd'], '2x2') as SplitNode;
    // Structure: col(row(a,b), row(c,d))
    expect(tree.direction).toBe('vertical');
    const top = tree.children[0] as SplitNode;
    const bot = tree.children[1] as SplitNode;
    expect(top.direction).toBe('horizontal');
    expect(bot.direction).toBe('horizontal');
    expect(collectLeaves(tree)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('builds 2L1R: two stacked left, one tall right', () => {
    const tree = buildGridTree(['a', 'b', 'c'], '2L1R') as SplitNode;
    expect(tree.direction).toBe('horizontal');
    const left = tree.children[0] as SplitNode;
    expect(left.direction).toBe('vertical');
    expect(collectLeaves(left)).toEqual(['a', 'b']);
    expect((tree.children[1] as LeafNode).slotId).toBe('c');
  });

  it('pads missing ids with placeholders for partial presets', () => {
    const tree = buildGridTree(['a'], '1x2') as SplitNode;
    expect(tree.type).toBe('split');
    const leaves = collectLeaves(tree);
    expect(leaves[0]).toBe('a');
    expect(leaves[1]).toMatch(/^__empty_/);
  });

  it('falls back to balanced build when hint is unknown', () => {
    const tree = buildGridTree(['a', 'b', 'c'], 'bogus-hint');
    // balanced path produces a split
    expect(tree.type).toBe('split');
    expect(collectLeaves(tree)).toEqual(['a', 'b', 'c']);
  });

  it('balanced build alternates direction by depth', () => {
    // With no hint and 4 ids: mid=2 → left(a,b), right(c,d), top split horizontal (depth 0)
    const tree = buildGridTree(['a', 'b', 'c', 'd']) as SplitNode;
    expect(tree.direction).toBe('horizontal');
    const left = tree.children[0] as SplitNode;
    expect(left.direction).toBe('vertical');
    expect(collectLeaves(tree)).toEqual(['a', 'b', 'c', 'd']);
  });
});

// ─── serializeTree / deserializeTree ───────────────────────────────────────

describe('serialize / deserialize round-trip', () => {
  it('round-trips a single leaf', () => {
    const tree = createLeaf('a');
    const restored = deserializeTree(serializeTree(tree));
    expect(restored).not.toBeNull();
    expect(collectLeaves(restored as TreeNode)).toEqual(['a']);
  });

  it('round-trips a nested split tree preserving structure and ratios', () => {
    const tree = createSplit(
      'horizontal',
      createLeaf('a'),
      createSplit('vertical', createLeaf('b'), createLeaf('c'), 0.35),
      0.6
    );
    const serialized = serializeTree(tree);
    expect(serialized.version).toBe(2);
    const restored = deserializeTree(serialized) as SplitNode;
    expect(restored.type).toBe('split');
    expect(restored.direction).toBe('horizontal');
    expect(restored.ratio).toBeCloseTo(0.6, 10);
    expect(collectLeaves(restored)).toEqual(['a', 'b', 'c']);
    const inner = restored.children[1] as SplitNode;
    expect(inner.direction).toBe('vertical');
    expect(inner.ratio).toBeCloseTo(0.35, 10);
  });

  it('deserialize returns null for missing or wrong version', () => {
    expect(deserializeTree(null)).toBeNull();
    expect(deserializeTree(undefined)).toBeNull();
    expect(deserializeTree({})).toBeNull();
    // v2 is now the current version, so v3 is the "future unknown" version.
    expect(deserializeTree({ version: 3, tree: createLeaf('a') })).toBeNull();
    expect(deserializeTree({ version: 'x', tree: createLeaf('a') })).toBeNull();
    expect(deserializeTree('not an object')).toBeNull();
  });

  it('deserialize returns null for invalid node shapes', () => {
    expect(deserializeTree({ version: 1, tree: null })).toBeNull();
    expect(
      deserializeTree({ version: 1, tree: { type: 'leaf', id: 'x' } }) // missing slotId
    ).toBeNull();
    expect(
      deserializeTree({
        version: 1,
        tree: { type: 'split', id: 's', direction: 'diagonal', ratio: 0.5, children: [] },
      })
    ).toBeNull();
  });

  it('deserialized tree is a clone, not the original reference', () => {
    const tree = createLeaf('a');
    const serialized = serializeTree(tree);
    const restored = deserializeTree(serialized);
    expect(restored).not.toBe(tree);
  });
});

// ─── Tab constructors ──────────────────────────────────────────────────────

describe('tab constructors', () => {
  it('createTerminalTab returns a terminal-kind tab with unique id', () => {
    const a = createTerminalTab('term-1');
    const b = createTerminalTab('term-1');
    expect(a.kind).toBe('terminal');
    expect(a.terminalId).toBe('term-1');
    expect(typeof a.id).toBe('string');
    expect(a.id).not.toBe(b.id);
  });

  it('createEditorTab returns an editor-kind tab', () => {
    const t = createEditorTab('C:/foo/bar.ts');
    expect(t.kind).toBe('editor');
    expect(t.filePath).toBe('C:/foo/bar.ts');
  });

  it('createPanelTab returns a panel-kind tab', () => {
    const t = createPanelTab('overview');
    expect(t.kind).toBe('panel');
    expect(t.panelId).toBe('overview');
  });

  it('createEmptyTab returns an empty-kind tab', () => {
    const t = createEmptyTab();
    expect(t.kind).toBe('empty');
    expect(typeof t.id).toBe('string');
  });

  it('createLeafWithTab wraps a tab into a single-tab leaf with active set', () => {
    const tab = createTerminalTab('term-x');
    const leaf = createLeafWithTab(tab);
    expect(leaf.type).toBe('leaf');
    expect(leaf.tabs).toHaveLength(1);
    expect(leaf.tabs[0]).toBe(tab);
    expect(leaf.activeTabId).toBe(tab.id);
    expect(leaf.slotId).toBe('term-x');
  });

  it('createLeafWithTab with an empty tab derives a placeholder slotId', () => {
    const leaf = createLeafWithTab(createEmptyTab());
    expect(leaf.slotId).toMatch(/^__empty_/);
  });

  it('createLeaf (legacy) creates an EmptyTab when slotId is a placeholder', () => {
    const leaf = createLeaf('__empty_2__');
    expect(leaf.tabs).toHaveLength(1);
    expect(leaf.tabs[0].kind).toBe('empty');
    expect(leaf.slotId).toBe('__empty_2__');
    expect(leaf.activeTabId).toBe(leaf.tabs[0].id);
  });

  it('createLeaf (legacy) creates a TerminalTab for real ids', () => {
    const leaf = createLeaf('term-123');
    expect(leaf.tabs).toHaveLength(1);
    expect(leaf.tabs[0].kind).toBe('terminal');
    expect((leaf.tabs[0] as TerminalTab).terminalId).toBe('term-123');
    expect(leaf.slotId).toBe('term-123');
  });
});

// ─── addTabToLeaf / removeTabFromLeaf / setActiveTab ───────────────────────

describe('addTabToLeaf', () => {
  it('appends a tab to the matching leaf and activates it by default', () => {
    const leaf = createLeafWithTab(createTerminalTab('t1'));
    const newTab = createEditorTab('C:/a.ts');
    const result = addTabToLeaf(leaf, leaf.id, newTab);
    expect(result).not.toBe(leaf);
    const r = result as LeafNode;
    expect(r.tabs).toHaveLength(2);
    expect(r.tabs[1]).toEqual(newTab);
    expect(r.activeTabId).toBe(newTab.id);
  });

  it('does not activate if activate=false', () => {
    const leaf = createLeafWithTab(createTerminalTab('t1'));
    const newTab = createEditorTab('C:/a.ts');
    const result = addTabToLeaf(leaf, leaf.id, newTab, false) as LeafNode;
    expect(result.activeTabId).toBe(leaf.activeTabId);
  });

  it('replaces a sole EmptyTab rather than appending', () => {
    const leaf = createLeafWithTab(createEmptyTab());
    const newTab = createTerminalTab('t-new');
    const result = addTabToLeaf(leaf, leaf.id, newTab) as LeafNode;
    expect(result.tabs).toHaveLength(1);
    expect(result.tabs[0]).toBe(newTab);
    expect(result.slotId).toBe('t-new');
  });

  it('returns same reference when leaf not found', () => {
    const leaf = createLeafWithTab(createTerminalTab('t1'));
    const result = addTabToLeaf(leaf, 'nope', createEditorTab('x.ts'));
    expect(result).toBe(leaf);
  });

  it('descends into split trees and only mutates the matching leaf', () => {
    const leafA = createLeafWithTab(createTerminalTab('a'));
    const leafB = createLeafWithTab(createTerminalTab('b'));
    const tree = createSplit('horizontal', leafA, leafB, 0.5);
    const result = addTabToLeaf(
      tree,
      leafB.id,
      createEditorTab('C:/x.ts')
    ) as SplitNode;
    expect(result.children[0]).toBe(leafA);
    expect((result.children[1] as LeafNode).tabs).toHaveLength(2);
  });
});

describe('removeTabFromLeaf', () => {
  it('removes a tab and activates the neighbour when active tab removed', () => {
    const leaf = createLeafWithTab(createTerminalTab('t1'));
    const tab2 = createEditorTab('C:/a.ts');
    const tab3 = createEditorTab('C:/b.ts');
    let tree: TreeNode = leaf;
    tree = addTabToLeaf(tree, leaf.id, tab2);
    tree = addTabToLeaf(tree, leaf.id, tab3);
    // active = tab3
    const afterRemove = removeTabFromLeaf(tree, leaf.id, tab3.id) as LeafNode;
    expect(afterRemove.tabs).toHaveLength(2);
    // Removed the last, fallback is new last (tab2)
    expect(afterRemove.activeTabId).toBe(tab2.id);
  });

  it('collapses to a single EmptyTab when the last tab is removed (leaf preserved)', () => {
    const tab = createTerminalTab('t1');
    const leaf = createLeafWithTab(tab);
    const result = removeTabFromLeaf(leaf, leaf.id, tab.id) as LeafNode;
    expect(result).not.toBe(leaf);
    expect(result.type).toBe('leaf');
    expect(result.id).toBe(leaf.id);
    expect(result.tabs).toHaveLength(1);
    expect(result.tabs[0].kind).toBe('empty');
    expect(result.activeTabId).toBe(result.tabs[0].id);
    expect(result.slotId).toMatch(/^__empty_/);
  });

  it('returns same reference when tabId not found', () => {
    const leaf = createLeafWithTab(createTerminalTab('t1'));
    const result = removeTabFromLeaf(leaf, leaf.id, 'bogus');
    expect(result).toBe(leaf);
  });

  it('returns same reference when leafId not found', () => {
    const leaf = createLeafWithTab(createTerminalTab('t1'));
    const result = removeTabFromLeaf(leaf, 'bogus', leaf.tabs[0].id);
    expect(result).toBe(leaf);
  });

  it('does not collapse the parent SplitNode when leaf becomes empty', () => {
    const leafA = createLeafWithTab(createTerminalTab('a'));
    const leafB = createLeafWithTab(createTerminalTab('b'));
    const tree = createSplit('horizontal', leafA, leafB, 0.5);
    const result = removeTabFromLeaf(
      tree,
      leafB.id,
      leafB.tabs[0].id
    ) as SplitNode;
    expect(result.type).toBe('split');
    expect(result.children[0]).toBe(leafA);
    const newB = result.children[1] as LeafNode;
    expect(newB.id).toBe(leafB.id);
    expect(newB.tabs).toHaveLength(1);
    expect(newB.tabs[0].kind).toBe('empty');
  });
});

describe('setActiveTab', () => {
  it('sets the active tab id', () => {
    const leaf = createLeafWithTab(createTerminalTab('t1'));
    const tab2 = createEditorTab('C:/a.ts');
    const tree = addTabToLeaf(leaf, leaf.id, tab2, false);
    const result = setActiveTab(tree, leaf.id, tab2.id) as LeafNode;
    expect(result.activeTabId).toBe(tab2.id);
  });

  it('returns same reference when already active', () => {
    const leaf = createLeafWithTab(createTerminalTab('t1'));
    const result = setActiveTab(leaf, leaf.id, leaf.activeTabId);
    expect(result).toBe(leaf);
  });

  it('returns same reference when tab not in leaf', () => {
    const leaf = createLeafWithTab(createTerminalTab('t1'));
    const result = setActiveTab(leaf, leaf.id, 'nope');
    expect(result).toBe(leaf);
  });
});

describe('moveTabBetweenLeaves', () => {
  it('moves a tab from one leaf to another, activating on dest', () => {
    const leafA = createLeafWithTab(createTerminalTab('a'));
    const leafB = createLeafWithTab(createTerminalTab('b'));
    const tree = createSplit('horizontal', leafA, leafB, 0.5);
    const extra = createEditorTab('C:/file.ts');
    const withTab = addTabToLeaf(tree, leafA.id, extra) as SplitNode;

    const moved = moveTabBetweenLeaves(
      withTab,
      leafA.id,
      leafB.id,
      extra.id
    ) as SplitNode;

    const newA = moved.children[0] as LeafNode;
    const newB = moved.children[1] as LeafNode;
    expect(newA.tabs).toHaveLength(1);
    expect((newA.tabs[0] as TerminalTab).terminalId).toBe('a');
    expect(newB.tabs).toHaveLength(2);
    expect(newB.activeTabId).toBe(extra.id);
  });

  it('source collapses to EmptyTab when moved tab was its only tab', () => {
    const leafA = createLeafWithTab(createTerminalTab('a'));
    const leafB = createLeafWithTab(createTerminalTab('b'));
    const tree = createSplit('horizontal', leafA, leafB, 0.5);
    const moved = moveTabBetweenLeaves(
      tree,
      leafA.id,
      leafB.id,
      leafA.tabs[0].id
    ) as SplitNode;
    const newA = moved.children[0] as LeafNode;
    expect(newA.id).toBe(leafA.id);
    expect(newA.tabs).toHaveLength(1);
    expect(newA.tabs[0].kind).toBe('empty');
    const newB = moved.children[1] as LeafNode;
    expect(newB.tabs).toHaveLength(2);
  });

  it('is a no-op when from === to', () => {
    const leafA = createLeafWithTab(createTerminalTab('a'));
    const result = moveTabBetweenLeaves(
      leafA,
      leafA.id,
      leafA.id,
      leafA.tabs[0].id
    );
    expect(result).toBe(leafA);
  });

  it('returns same reference when source/dest/tab not found', () => {
    const leafA = createLeafWithTab(createTerminalTab('a'));
    const leafB = createLeafWithTab(createTerminalTab('b'));
    const tree = createSplit('horizontal', leafA, leafB, 0.5);
    expect(moveTabBetweenLeaves(tree, 'nope', leafB.id, 'x')).toBe(tree);
    expect(moveTabBetweenLeaves(tree, leafA.id, 'nope', leafA.tabs[0].id)).toBe(
      tree
    );
    expect(moveTabBetweenLeaves(tree, leafA.id, leafB.id, 'nope-tab')).toBe(
      tree
    );
  });
});

// ─── findLeaf variants ──────────────────────────────────────────────────────

describe('findLeafById', () => {
  it('finds a leaf by its node id in a nested tree', () => {
    const target = createLeafWithTab(createTerminalTab('x'));
    const tree = createSplit(
      'horizontal',
      createLeafWithTab(createTerminalTab('a')),
      createSplit(
        'vertical',
        createLeafWithTab(createTerminalTab('b')),
        target,
        0.5
      ),
      0.5
    );
    expect(findLeafById(tree, target.id)).toBe(target);
  });

  it('returns null when id not present', () => {
    const leaf = createLeafWithTab(createTerminalTab('x'));
    expect(findLeafById(leaf, 'missing')).toBeNull();
  });
});

describe('findLeafByTabId', () => {
  it('finds the leaf containing a given tab id', () => {
    const leaf = createLeafWithTab(createTerminalTab('a'));
    const extra = createEditorTab('C:/f.ts');
    const withExtra = addTabToLeaf(leaf, leaf.id, extra) as LeafNode;
    expect(findLeafByTabId(withExtra, extra.id)).toBe(withExtra);
  });

  it('returns null when no leaf holds the tab', () => {
    const leaf = createLeafWithTab(createTerminalTab('a'));
    expect(findLeafByTabId(leaf, 'bogus')).toBeNull();
  });
});

describe('findLeafContainingTerminal', () => {
  it('finds a leaf that holds a terminal tab', () => {
    const leafA = createLeafWithTab(createTerminalTab('a'));
    const leafB = createLeafWithTab(createTerminalTab('b'));
    const tree = createSplit('horizontal', leafA, leafB, 0.5);
    expect(findLeafContainingTerminal(tree, 'b')).toBe(leafB);
  });

  it('returns null for non-existent terminalId', () => {
    const leaf = createLeafWithTab(createTerminalTab('a'));
    expect(findLeafContainingTerminal(leaf, 'zzz')).toBeNull();
  });

  it('returns null when the leaf has only a non-terminal tab', () => {
    const leaf = createLeafWithTab(createEditorTab('C:/a.ts'));
    expect(findLeafContainingTerminal(leaf, 'a')).toBeNull();
  });
});

describe('findLeafContainingFile', () => {
  it('finds a leaf that holds an editor tab for that file', () => {
    const leaf = createLeafWithTab(createTerminalTab('a'));
    const editorTab = createEditorTab('C:/src/foo.ts');
    const withTab = addTabToLeaf(leaf, leaf.id, editorTab) as LeafNode;
    expect(findLeafContainingFile(withTab, 'C:/src/foo.ts')).toBe(withTab);
  });

  it('returns null when no editor tab matches', () => {
    const leaf = createLeafWithTab(createTerminalTab('a'));
    expect(findLeafContainingFile(leaf, 'C:/nothing.ts')).toBeNull();
  });
});

// ─── collection helpers ────────────────────────────────────────────────────

describe('collectLeafIds / collectTerminalSlotIds / collectAllTabs', () => {
  it('collectLeafIds returns leaf node ids in DFS order', () => {
    const a = createLeafWithTab(createTerminalTab('a'));
    const b = createLeafWithTab(createTerminalTab('b'));
    const c = createLeafWithTab(createTerminalTab('c'));
    const tree = createSplit(
      'horizontal',
      a,
      createSplit('vertical', b, c, 0.5),
      0.5
    );
    expect(collectLeafIds(tree)).toEqual([a.id, b.id, c.id]);
  });

  it('collectTerminalSlotIds walks every tab list, skipping non-terminals', () => {
    const a = createLeafWithTab(createTerminalTab('a'));
    const b = createLeafWithTab(createEditorTab('C:/f.ts'));
    const withSecondTerm = addTabToLeaf(a, a.id, createTerminalTab('a2'));
    const tree = createSplit('horizontal', withSecondTerm, b, 0.5);
    expect(collectTerminalSlotIds(tree)).toEqual(['a', 'a2']);
  });

  it('collectAllTabs returns every tab with its leaf id', () => {
    const a = createLeafWithTab(createTerminalTab('a'));
    const extra = createEditorTab('C:/f.ts');
    const withExtra = addTabToLeaf(a, a.id, extra) as LeafNode;
    const result = collectAllTabs(withExtra);
    expect(result).toHaveLength(2);
    expect(result[0].leafId).toBe(withExtra.id);
    expect(result[1].leafId).toBe(withExtra.id);
    expect(result[1].tab).toBe(extra);
  });

  it('countTabsByKind counts across the whole tree', () => {
    const leafA = createLeafWithTab(createTerminalTab('a'));
    const withEditor = addTabToLeaf(
      leafA,
      leafA.id,
      createEditorTab('C:/a.ts')
    ) as LeafNode;
    const leafB = createLeafWithTab(createPanelTab('overview'));
    const tree = createSplit('horizontal', withEditor, leafB, 0.5);
    expect(countTabsByKind(tree, 'terminal')).toBe(1);
    expect(countTabsByKind(tree, 'editor')).toBe(1);
    expect(countTabsByKind(tree, 'panel')).toBe(1);
    expect(countTabsByKind(tree, 'empty')).toBe(0);
  });
});

// ─── splitLeafNode / removeLeafById ────────────────────────────────────────

describe('splitLeafNode', () => {
  it('splits a leaf by id, inserting a leaf wrapping the new tab', () => {
    const leaf = createLeafWithTab(createTerminalTab('a'));
    const newTab = createEditorTab('C:/x.ts');
    const result = splitLeafNode(leaf, leaf.id, newTab, 'vertical') as SplitNode;
    expect(result.type).toBe('split');
    expect(result.direction).toBe('vertical');
    expect(result.children[0]).toBe(leaf);
    const newLeaf = result.children[1] as LeafNode;
    expect(newLeaf.tabs).toHaveLength(1);
    expect(newLeaf.tabs[0]).toBe(newTab);
  });

  it('returns same reference when leaf id not found', () => {
    const leaf = createLeafWithTab(createTerminalTab('a'));
    const result = splitLeafNode(
      leaf,
      'nope',
      createTerminalTab('b'),
      'horizontal'
    );
    expect(result).toBe(leaf);
  });

  it('splits a nested leaf preserving untouched subtrees', () => {
    const leafA = createLeafWithTab(createTerminalTab('a'));
    const leafB = createLeafWithTab(createTerminalTab('b'));
    const leafC = createLeafWithTab(createTerminalTab('c'));
    const tree = createSplit(
      'horizontal',
      leafA,
      createSplit('vertical', leafB, leafC, 0.5),
      0.5
    );
    const result = splitLeafNode(
      tree,
      leafC.id,
      createEditorTab('x.ts'),
      'horizontal'
    ) as SplitNode;
    expect(result.children[0]).toBe(leafA);
  });
});

describe('removeLeafById', () => {
  it('removes a leaf and promotes the sibling', () => {
    const a = createLeafWithTab(createTerminalTab('a'));
    const b = createLeafWithTab(createTerminalTab('b'));
    const tree = createSplit('horizontal', a, b, 0.5);
    expect(removeLeafById(tree, a.id)).toBe(b);
  });

  it('returns null when removing the only leaf', () => {
    const leaf = createLeafWithTab(createTerminalTab('a'));
    expect(removeLeafById(leaf, leaf.id)).toBeNull();
  });

  it('returns same reference when leaf id not found', () => {
    const leaf = createLeafWithTab(createTerminalTab('a'));
    expect(removeLeafById(leaf, 'bogus')).toBe(leaf);
  });

  it('handles nested removal with sibling promotion', () => {
    const a = createLeafWithTab(createTerminalTab('a'));
    const b = createLeafWithTab(createTerminalTab('b'));
    const c = createLeafWithTab(createTerminalTab('c'));
    const tree = createSplit(
      'horizontal',
      a,
      createSplit('vertical', b, c, 0.5),
      0.5
    );
    const result = removeLeafById(tree, b.id) as SplitNode;
    expect(result.children[0]).toBe(a);
    expect(result.children[1]).toBe(c);
  });
});

// ─── v1 -> v2 migration ───────────────────────────────────────────────────

describe('migrateV1ToV2', () => {
  it('migrates a single v1 leaf with a terminal slotId', () => {
    const v1 = { type: 'leaf', id: 'leaf-1', slotId: 'term-a' };
    const migrated = migrateV1ToV2(v1) as LeafNode;
    expect(migrated.type).toBe('leaf');
    expect(migrated.id).toBe('leaf-1');
    expect(migrated.tabs).toHaveLength(1);
    expect(migrated.tabs[0].kind).toBe('terminal');
    expect((migrated.tabs[0] as TerminalTab).terminalId).toBe('term-a');
    expect(migrated.activeTabId).toBe(migrated.tabs[0].id);
  });

  it('migrates v1 empty placeholders to EmptyTab leaves', () => {
    const v1 = { type: 'leaf', id: 'leaf-e', slotId: '__empty_0__' };
    const migrated = migrateV1ToV2(v1) as LeafNode;
    expect(migrated.tabs[0].kind).toBe('empty');
    expect(migrated.slotId).toBe('__empty_0__');
  });

  it('migrates a nested v1 tree with mixed real ids and placeholders', () => {
    const v1 = {
      type: 'split',
      id: 'split-root',
      direction: 'horizontal',
      ratio: 0.6,
      children: [
        { type: 'leaf', id: 'la', slotId: 'term-a' },
        {
          type: 'split',
          id: 'split-inner',
          direction: 'vertical',
          ratio: 0.3,
          children: [
            { type: 'leaf', id: 'lb', slotId: '__empty_1__' },
            { type: 'leaf', id: 'lc', slotId: 'term-c' },
          ],
        },
      ],
    };
    const migrated = migrateV1ToV2(v1) as SplitNode;
    expect(migrated.type).toBe('split');
    expect(migrated.direction).toBe('horizontal');
    expect(migrated.ratio).toBeCloseTo(0.6, 10);
    const la = migrated.children[0] as LeafNode;
    expect(la.id).toBe('la');
    expect((la.tabs[0] as TerminalTab).terminalId).toBe('term-a');
    const inner = migrated.children[1] as SplitNode;
    expect(inner.ratio).toBeCloseTo(0.3, 10);
    const lb = inner.children[0] as LeafNode;
    const lc = inner.children[1] as LeafNode;
    expect(lb.tabs[0].kind).toBe('empty');
    expect(lc.tabs[0].kind).toBe('terminal');
    expect(collectLeafIds(migrated)).toEqual(['la', 'lb', 'lc']);
  });

  it('returns null for invalid v1 shapes', () => {
    expect(migrateV1ToV2(null)).toBeNull();
    expect(migrateV1ToV2({ type: 'leaf', id: 'x' })).toBeNull(); // missing slotId
    expect(
      migrateV1ToV2({
        type: 'split',
        id: 's',
        direction: 'diagonal',
        ratio: 0.5,
        children: [],
      })
    ).toBeNull();
  });
});

describe('deserializeTree accepts both v1 and v2', () => {
  it('round-trips a v1 payload into an equivalent v2 tree', () => {
    const v1Payload = {
      version: 1,
      tree: {
        type: 'split',
        id: 'root',
        direction: 'horizontal',
        ratio: 0.5,
        children: [
          { type: 'leaf', id: 'l1', slotId: 'term-a' },
          { type: 'leaf', id: 'l2', slotId: '__empty_1__' },
        ],
      },
    };
    const restored = deserializeTree(v1Payload) as SplitNode;
    expect(restored).not.toBeNull();
    expect(restored.type).toBe('split');
    const l1 = restored.children[0] as LeafNode;
    const l2 = restored.children[1] as LeafNode;
    expect(l1.tabs[0].kind).toBe('terminal');
    expect((l1.tabs[0] as TerminalTab).terminalId).toBe('term-a');
    expect(l2.tabs[0].kind).toBe('empty');
  });

  it('round-trips a v2 payload unchanged in shape', () => {
    const leaf = createLeafWithTab(createTerminalTab('a'));
    const withExtra = addTabToLeaf(leaf, leaf.id, createEditorTab('C:/x.ts'));
    const serialized = serializeTree(withExtra);
    expect(serialized.version).toBe(2);
    const restored = deserializeTree(serialized) as LeafNode;
    expect(restored.type).toBe('leaf');
    expect(restored.tabs).toHaveLength(2);
    expect(restored.tabs[0].kind).toBe('terminal');
    expect(restored.tabs[1].kind).toBe('editor');
  });

  it('rejects unknown version values', () => {
    expect(deserializeTree({ version: 3, tree: null })).toBeNull();
    expect(deserializeTree({ version: 0, tree: null })).toBeNull();
  });

  it('rejects invalid v2 node shapes', () => {
    expect(
      deserializeTree({
        version: 2,
        tree: { type: 'leaf', id: 'x' }, // missing tabs/activeTabId/slotId
      })
    ).toBeNull();
    expect(
      deserializeTree({
        version: 2,
        tree: {
          type: 'leaf',
          id: 'x',
          slotId: 'a',
          tabs: [],
          activeTabId: 'z',
        }, // empty tabs
      })
    ).toBeNull();
    expect(
      deserializeTree({
        version: 2,
        tree: {
          type: 'leaf',
          id: 'x',
          slotId: 'a',
          tabs: [{ id: 't1', kind: 'terminal', terminalId: 'a' }],
          activeTabId: 'mismatched',
        },
      })
    ).toBeNull();
  });
});
