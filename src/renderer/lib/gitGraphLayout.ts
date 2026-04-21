/**
 * gitGraphLayout — Column-assignment layout for a git commit DAG.
 *
 * Ported / adapted from Maestro (https://github.com/its-maestro-baby/maestro)
 * `graphLayout.ts`. Walks a topologically-ordered commit list (newest → oldest)
 * and assigns each commit to a lane ("column"). First parents continue in the
 * same column, additional parents (merge parents) are placed in a newly-opened
 * column. Off-screen parents (not present in the loaded slice) get a connection
 * whose `isOffScreen` flag is set so the renderer can draw a rail fading to the
 * bottom of the visible canvas.
 *
 * Pure TypeScript — no React, no Electron, no IPC. Safe to unit-test.
 */

export interface CommitInfo {
  hash: string;
  parentHashes: string[];
  authorName: string;
  authorEmail: string;
  /** Unix epoch seconds (git `%at`). */
  timestamp: number;
  summary: string;
  /** Optional ref names (branches/tags) pointing at this commit. */
  refs?: string[];
}

export interface ParentConnection {
  fromCol: number;
  fromRow: number;
  toCol: number;
  toRow: number;
  connectionType: 'straight' | 'mergeLeft' | 'mergeRight';
  /** True when the parent commit is not in the loaded slice — draw a fading rail. */
  isOffScreen: boolean;
}

export interface GraphNode {
  commit: CommitInfo;
  row: number;
  column: number;
  connections: ParentConnection[];
}

/** Row height in pixels. The SVG canvas maps one commit to one row. */
export const ROW_HEIGHT = 28;
/** Horizontal distance between adjacent rails. */
export const RAIL_WIDTH = 16;
/** Commit node (circle) radius in pixels. */
export const NODE_RADIUS = 5;

/**
 * Eight-slot rail palette. Roughly GitKraken-ish; renderer cycles
 * `column % RAIL_COLORS.length`.
 */
export const RAIL_COLORS: string[] = [
  '#e11d48',
  '#f59e0b',
  '#10b981',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#84cc16',
];

/**
 * Assign columns to commits and compute the connection list used by the
 * SVG renderer.
 *
 * Algorithm:
 *  1. `activeColumns: Map<col, expectedHash>` tracks which hash each column
 *     is currently waiting for.
 *  2. For each commit (row order is the input order, newest→oldest):
 *     a. If any column is waiting for this commit, reuse the lowest such column.
 *     b. Otherwise pick the smallest free column index.
 *     c. For each parent:
 *        - The first parent inherits this commit's column (linear history).
 *        - Additional parents open a new column unless another active column
 *          already expects the same hash (shared ancestor).
 *     d. Emit a connection per parent. Off-screen parents still produce a
 *        connection with `isOffScreen: true` so the renderer can stub out a
 *        rail to the bottom of the canvas.
 */
export function layoutGraph(commits: CommitInfo[]): GraphNode[] {
  // Index by hash so we can detect off-screen parents.
  const hashToRow = new Map<string, number>();
  commits.forEach((c, i) => hashToRow.set(c.hash, i));

  /** column index -> hash this column is currently waiting for */
  const activeColumns = new Map<number, string>();
  const nodes: GraphNode[] = [];

  for (let row = 0; row < commits.length; row++) {
    const commit = commits[row];

    // 1. Determine this commit's column.
    let column = -1;
    for (const [col, expected] of activeColumns.entries()) {
      if (expected === commit.hash) {
        if (column === -1 || col < column) column = col;
      }
    }
    if (column === -1) {
      // No column is waiting for us — find the lowest free index.
      column = 0;
      while (activeColumns.has(column)) column++;
    } else {
      // Reused a waiting column; clear any other duplicate waiters for this
      // hash so we don't double-book the lane.
      for (const [col, expected] of Array.from(activeColumns.entries())) {
        if (expected === commit.hash && col !== column) {
          activeColumns.delete(col);
        }
      }
    }

    // 2. Compute connections to parents.
    const connections: ParentConnection[] = [];
    const parents = commit.parentHashes;

    for (let pIdx = 0; pIdx < parents.length; pIdx++) {
      const parentHash = parents[pIdx];
      const parentRow = hashToRow.get(parentHash);
      const isOffScreen = parentRow === undefined;

      let parentCol: number;

      if (pIdx === 0) {
        // First parent — continue in this commit's column.
        parentCol = column;
      } else {
        // Merge parent — does any active column already wait for this hash?
        let existingCol = -1;
        for (const [col, expected] of activeColumns.entries()) {
          if (expected === parentHash && col !== column) {
            if (existingCol === -1 || col < existingCol) existingCol = col;
          }
        }
        if (existingCol !== -1) {
          parentCol = existingCol;
        } else {
          // Open a new column for this merge parent.
          parentCol = 0;
          while (activeColumns.has(parentCol) || parentCol === column) {
            parentCol++;
          }
        }
      }

      // Update activeColumns so downstream rows can find this parent.
      activeColumns.set(parentCol, parentHash);

      const fromRow = row;
      const toRow = isOffScreen ? commits.length : (parentRow as number);

      let connectionType: ParentConnection['connectionType'];
      if (parentCol === column) {
        connectionType = 'straight';
      } else if (parentCol < column) {
        connectionType = 'mergeLeft';
      } else {
        connectionType = 'mergeRight';
      }

      connections.push({
        fromCol: column,
        fromRow,
        toCol: parentCol,
        toRow,
        connectionType,
        isOffScreen,
      });
    }

    // 3. If this commit had NO parents (root), clear its column — nothing
    //    downstream expects it.
    if (parents.length === 0) {
      activeColumns.delete(column);
    } else {
      // The current column is now owned by the first parent. If the first
      // parent is the same hash as any other active column (e.g. two branches
      // merged to the same ancestor in a previous row), leave both entries.
      // No-op here: activeColumns.set(column, parents[0]) was done in the loop.
    }

    nodes.push({ commit, row, column, connections });
  }

  return nodes;
}
