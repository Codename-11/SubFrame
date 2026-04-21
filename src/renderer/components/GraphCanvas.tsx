/**
 * GraphCanvas — SVG overlay that draws rails and commit nodes behind the
 * commit row list. Absolutely positioned so row clicks pass through via
 * `pointer-events: none` on the SVG.
 */

import { useMemo } from 'react';
import {
  type GraphNode,
  NODE_RADIUS,
  RAIL_COLORS,
  RAIL_WIDTH,
  ROW_HEIGHT,
} from '../lib/gitGraphLayout';

interface GraphCanvasProps {
  nodes: GraphNode[];
  /** Inclusive row index where drawing starts (for pseudo-virtualization). */
  visibleStartRow: number;
  /** Exclusive row index where drawing ends. */
  visibleEndRow: number;
}

const LEFT_PAD = 10;

function railX(col: number): number {
  return LEFT_PAD + col * RAIL_WIDTH + RAIL_WIDTH / 2;
}

function rowY(row: number): number {
  return row * ROW_HEIGHT + ROW_HEIGHT / 2;
}

function railColor(col: number): string {
  return RAIL_COLORS[col % RAIL_COLORS.length];
}

export function GraphCanvas({ nodes, visibleStartRow, visibleEndRow }: GraphCanvasProps) {
  const maxColumn = useMemo(() => {
    let max = 0;
    for (const n of nodes) {
      if (n.column > max) max = n.column;
      for (const c of n.connections) {
        if (c.toCol > max) max = c.toCol;
        if (c.fromCol > max) max = c.fromCol;
      }
    }
    return max;
  }, [nodes]);

  const totalHeight = nodes.length * ROW_HEIGHT;
  const totalWidth = LEFT_PAD * 2 + (maxColumn + 1) * RAIL_WIDTH;

  // Clamp window to valid range.
  const startRow = Math.max(0, visibleStartRow);
  const endRow = Math.min(nodes.length, visibleEndRow);

  return (
    <svg
      width={totalWidth}
      height={totalHeight}
      className="absolute top-0 left-0 pointer-events-none"
      style={{ overflow: 'visible' }}
      aria-hidden="true"
    >
      {/* Rails + merge connections */}
      <g>
        {nodes.map((node) => {
          // Skip nodes entirely outside window to keep DOM small, but always
          // emit connections whose span crosses the window.
          return node.connections.map((conn, idx) => {
            const crossesWindow =
              !(conn.fromRow >= endRow && conn.toRow >= endRow) &&
              !(conn.fromRow < startRow && conn.toRow < startRow);
            if (!crossesWindow) return null;

            const x1 = railX(conn.fromCol);
            const y1 = rowY(conn.fromRow);
            const x2 = railX(conn.toCol);
            const y2 = conn.isOffScreen ? totalHeight : rowY(conn.toRow);
            const color = railColor(conn.toCol);

            if (conn.connectionType === 'straight') {
              return (
                <path
                  key={`${node.commit.hash}-c${idx}`}
                  d={`M ${x1},${y1} L ${x2},${y2}`}
                  stroke={color}
                  strokeWidth={2}
                  fill="none"
                  strokeOpacity={conn.isOffScreen ? 0.35 : 1}
                />
              );
            }

            // Merge bezier — curve early so rails settle into target column.
            const midY = y1 + (y2 - y1) * 0.3;
            return (
              <path
                key={`${node.commit.hash}-c${idx}`}
                d={`M ${x1},${y1} C ${x1},${midY}, ${x2},${midY}, ${x2},${y2}`}
                stroke={color}
                strokeWidth={2}
                fill="none"
                strokeOpacity={conn.isOffScreen ? 0.35 : 1}
              />
            );
          });
        })}
      </g>

      {/* Commit nodes */}
      <g>
        {nodes.map((node) => {
          if (node.row < startRow || node.row >= endRow) return null;
          const cx = railX(node.column);
          const cy = rowY(node.row);
          const color = railColor(node.column);
          return (
            <circle
              key={node.commit.hash}
              cx={cx}
              cy={cy}
              r={NODE_RADIUS}
              fill={color}
              stroke="var(--color-bg-primary, #1a1a1a)"
              strokeWidth={2}
            />
          );
        })}
      </g>
    </svg>
  );
}
