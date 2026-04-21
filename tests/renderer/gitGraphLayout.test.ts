/**
 * Tests for gitGraphLayout — column-assignment layout for a git commit DAG.
 */

import { describe, it, expect } from 'vitest';
import {
  layoutGraph,
  RAIL_COLORS,
  ROW_HEIGHT,
  RAIL_WIDTH,
  NODE_RADIUS,
  type CommitInfo,
} from '../../src/renderer/lib/gitGraphLayout';

/** Helper to build a CommitInfo with defaults for uninteresting fields. */
function commit(hash: string, parentHashes: string[], extras: Partial<CommitInfo> = {}): CommitInfo {
  return {
    hash,
    parentHashes,
    authorName: 'Tester',
    authorEmail: 'test@example.com',
    timestamp: 0,
    summary: hash,
    ...extras,
  };
}

// ─── Constants ─────────────────────────────────────────────────────────────

describe('exported constants', () => {
  it('RAIL_COLORS has exactly 8 entries, each a hex color', () => {
    expect(RAIL_COLORS).toHaveLength(8);
    for (const c of RAIL_COLORS) {
      expect(c).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('ROW_HEIGHT / RAIL_WIDTH / NODE_RADIUS are positive numbers', () => {
    expect(ROW_HEIGHT).toBeGreaterThan(0);
    expect(RAIL_WIDTH).toBeGreaterThan(0);
    expect(NODE_RADIUS).toBeGreaterThan(0);
  });
});

// ─── Empty input ───────────────────────────────────────────────────────────

describe('layoutGraph — empty input', () => {
  it('returns an empty array for empty commits', () => {
    expect(layoutGraph([])).toEqual([]);
  });
});

// ─── Linear history ────────────────────────────────────────────────────────

describe('layoutGraph — linear history', () => {
  it('places all commits on column 0 with straight connections', () => {
    const commits = [
      commit('A', ['B']),
      commit('B', ['C']),
      commit('C', []),
    ];
    const nodes = layoutGraph(commits);
    expect(nodes).toHaveLength(3);
    expect(nodes.map((n) => n.column)).toEqual([0, 0, 0]);
    expect(nodes.map((n) => n.row)).toEqual([0, 1, 2]);

    // A → B straight
    expect(nodes[0].connections).toHaveLength(1);
    expect(nodes[0].connections[0]).toMatchObject({
      fromCol: 0,
      fromRow: 0,
      toCol: 0,
      toRow: 1,
      connectionType: 'straight',
      isOffScreen: false,
    });

    // B → C straight
    expect(nodes[1].connections[0]).toMatchObject({
      fromCol: 0,
      toCol: 0,
      connectionType: 'straight',
      isOffScreen: false,
    });

    // Root commit has no connections
    expect(nodes[2].connections).toEqual([]);
  });
});

// ─── Simple merge ──────────────────────────────────────────────────────────

describe('layoutGraph — simple merge', () => {
  it('places the merge parent on a new rightward column', () => {
    // M has two parents: B (first parent — stays on col 0) and C (new col 1).
    const commits = [
      commit('M', ['B', 'C']),
      commit('B', []),
      commit('C', []),
    ];
    const nodes = layoutGraph(commits);

    // Column assignments
    expect(nodes[0].column).toBe(0); // M
    expect(nodes[1].column).toBe(0); // B continues col 0
    expect(nodes[2].column).toBe(1); // C moved to col 1 when M was processed

    // M has two parent connections
    const mConnections = nodes[0].connections;
    expect(mConnections).toHaveLength(2);

    // First parent (B) → straight, col 0
    expect(mConnections[0]).toMatchObject({
      fromCol: 0,
      toCol: 0,
      toRow: 1,
      connectionType: 'straight',
      isOffScreen: false,
    });

    // Second parent (C) → mergeRight, col 1
    expect(mConnections[1]).toMatchObject({
      fromCol: 0,
      toCol: 1,
      toRow: 2,
      connectionType: 'mergeRight',
      isOffScreen: false,
    });
  });
});

// ─── Fork ─────────────────────────────────────────────────────────────────

describe('layoutGraph — fork (two descendants of same parent)', () => {
  it('promotes the lowest column to the shared parent and clears duplicates', () => {
    // A and B are siblings sharing parent P.
    // Order newest → oldest: A (col 0), B (no col waits → col 1), P.
    const commits = [
      commit('A', ['P']),
      commit('B', ['P']),
      commit('P', []),
    ];
    const nodes = layoutGraph(commits);

    expect(nodes[0].column).toBe(0); // A
    expect(nodes[1].column).toBe(1); // B (no existing col for B, picks free col 1)
    expect(nodes[2].column).toBe(0); // P picks lowest waiting column

    // A's connection to P is straight col 0
    expect(nodes[0].connections[0]).toMatchObject({
      fromCol: 0,
      toCol: 0,
      toRow: 2,
      connectionType: 'straight',
    });

    // B's connection to P is straight col 1 → col 1 (it owned its own col at the time)
    expect(nodes[1].connections[0]).toMatchObject({
      fromCol: 1,
      toCol: 1,
      toRow: 2,
      connectionType: 'straight',
    });
  });
});

// ─── Branch merge back into main ──────────────────────────────────────────

describe('layoutGraph — branch merge back into main', () => {
  it('collapses two lanes back to a single shared ancestor', () => {
    // M merges B and D. B and D both share parent A.
    // Order: M (merge, col 0), B, D, A.
    const commits = [
      commit('M', ['B', 'D']),
      commit('B', ['A']),
      commit('D', ['A']),
      commit('A', []),
    ];
    const nodes = layoutGraph(commits);

    expect(nodes[0].column).toBe(0); // M
    expect(nodes[1].column).toBe(0); // B continues col 0
    expect(nodes[2].column).toBe(1); // D was opened on col 1 by M
    expect(nodes[3].column).toBe(0); // A picks lowest waiter

    // M → mergeRight to D on col 1
    expect(nodes[0].connections).toHaveLength(2);
    expect(nodes[0].connections[1]).toMatchObject({
      fromCol: 0,
      toCol: 1,
      connectionType: 'mergeRight',
    });

    // B → A straight col 0
    expect(nodes[1].connections[0]).toMatchObject({
      fromCol: 0,
      toCol: 0,
      connectionType: 'straight',
    });

    // D → A on col 1 (D owns col 1 at this point, A is on col 1 until row 3)
    // D's parent col is 1 (first parent continues in same col).
    expect(nodes[2].connections[0]).toMatchObject({
      fromCol: 1,
      toCol: 1,
      connectionType: 'straight',
    });
  });
});

// ─── Root commit ───────────────────────────────────────────────────────────

describe('layoutGraph — root commit', () => {
  it('emits no connections and frees its column', () => {
    const commits = [commit('A', []), commit('B', [])];
    const nodes = layoutGraph(commits);
    expect(nodes[0].connections).toEqual([]);
    expect(nodes[1].connections).toEqual([]);
    // Both roots should land on column 0 since the previous column is freed.
    expect(nodes[0].column).toBe(0);
    expect(nodes[1].column).toBe(0);
  });
});

// ─── Off-screen parent ────────────────────────────────────────────────────

describe('layoutGraph — off-screen parent', () => {
  it('emits a connection with isOffScreen: true and toRow = commits.length', () => {
    // A's parent B is not in the slice.
    const commits = [commit('A', ['B'])];
    const nodes = layoutGraph(commits);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].connections).toHaveLength(1);
    const conn = nodes[0].connections[0];
    expect(conn.isOffScreen).toBe(true);
    expect(conn.toRow).toBe(1); // commits.length
    expect(conn.connectionType).toBe('straight');
  });

  it('handles off-screen merge parent with isOffScreen flag', () => {
    const commits = [commit('M', ['P1', 'P2']), commit('P1', [])];
    const nodes = layoutGraph(commits);
    // P2 is off-screen, should produce mergeRight with isOffScreen true.
    const p2Conn = nodes[0].connections[1];
    expect(p2Conn.isOffScreen).toBe(true);
    expect(p2Conn.toRow).toBe(commits.length);
    expect(p2Conn.connectionType).toBe('mergeRight');
  });
});

// ─── General invariants ───────────────────────────────────────────────────

describe('layoutGraph — general invariants', () => {
  it('preserves input row order and attaches original commit reference', () => {
    const commits = [commit('X', ['Y']), commit('Y', [])];
    const nodes = layoutGraph(commits);
    expect(nodes[0].commit).toBe(commits[0]);
    expect(nodes[1].commit).toBe(commits[1]);
  });

  it('every connection has fromRow matching the node row', () => {
    const commits = [
      commit('M', ['B', 'C']),
      commit('B', ['A']),
      commit('C', ['A']),
      commit('A', []),
    ];
    const nodes = layoutGraph(commits);
    for (const node of nodes) {
      for (const conn of node.connections) {
        expect(conn.fromRow).toBe(node.row);
        expect(conn.fromCol).toBe(node.column);
      }
    }
  });
});
