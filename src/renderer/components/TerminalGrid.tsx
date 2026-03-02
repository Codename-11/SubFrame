/**
 * Terminal grid layout component.
 * Renders terminals in a CSS Grid with resize handles between cells.
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import { X, Maximize2 } from 'lucide-react';
import { Terminal } from './Terminal';
import { useTerminalStore } from '../stores/useTerminalStore';

const GRID_LAYOUTS: Record<string, { rows: number; cols: number }> = {
  '1x2': { rows: 1, cols: 2 },
  '1x3': { rows: 1, cols: 3 },
  '1x4': { rows: 1, cols: 4 },
  '2x1': { rows: 2, cols: 1 },
  '2x2': { rows: 2, cols: 2 },
  '3x1': { rows: 3, cols: 1 },
  '3x2': { rows: 3, cols: 2 },
  '3x3': { rows: 3, cols: 3 },
};

interface TerminalGridProps {
  onCloseTerminal: (id: string) => void;
}

export function TerminalGrid({ onCloseTerminal }: TerminalGridProps) {
  const terminals = useTerminalStore((s) => s.terminals);
  const activeTerminalId = useTerminalStore((s) => s.activeTerminalId);
  const gridLayout = useTerminalStore((s) => s.gridLayout);
  const setActiveTerminal = useTerminalStore((s) => s.setActiveTerminal);
  const setViewMode = useTerminalStore((s) => s.setViewMode);

  const config = GRID_LAYOUTS[gridLayout] ?? GRID_LAYOUTS['2x2'];
  const maxCells = config.rows * config.cols;

  const terminalList = Array.from(terminals.values()).sort(
    (a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0) || a.id.localeCompare(b.id)
  );
  const visibleTerminals = terminalList.slice(0, maxCells);

  // Resize handle state — imperative for performance
  const gridRef = useRef<HTMLDivElement>(null);
  const [colSizes, setColSizes] = useState<number[] | null>(null);
  const [rowSizes, setRowSizes] = useState<number[] | null>(null);
  const dragState = useRef<{
    type: 'col' | 'row';
    index: number;
    startPos: number;
    startSizes: number[];
  } | null>(null);

  // Reset custom sizes when layout changes
  useEffect(() => {
    setColSizes(null);
    setRowSizes(null);
  }, [gridLayout]);

  const handleResizeStart = useCallback(
    (type: 'col' | 'row', index: number, startPos: number) => {
      const grid = gridRef.current;
      if (!grid) return;

      const currentSizes =
        type === 'col'
          ? colSizes ?? Array(config.cols).fill(1)
          : rowSizes ?? Array(config.rows).fill(1);

      dragState.current = { type, index, startPos, startSizes: [...currentSizes] };

      const totalSize =
        type === 'col' ? grid.clientWidth : grid.clientHeight;

      const onMouseMove = (e: MouseEvent) => {
        const ds = dragState.current;
        if (!ds) return;

        const pos = ds.type === 'col' ? e.clientX : e.clientY;
        const delta = pos - ds.startPos;
        const frDelta = (delta / totalSize) * ds.startSizes.reduce((a, b) => a + b, 0);

        const newSizes = [...ds.startSizes];
        const minFr = 0.15;
        newSizes[ds.index] = Math.max(minFr, ds.startSizes[ds.index] + frDelta);
        if (ds.index + 1 < newSizes.length) {
          newSizes[ds.index + 1] = Math.max(minFr, ds.startSizes[ds.index + 1] - frDelta);
        }

        if (ds.type === 'col') {
          setColSizes(newSizes);
        } else {
          setRowSizes(newSizes);
        }
      };

      const onMouseUp = () => {
        dragState.current = null;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      document.body.style.cursor = type === 'col' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
    },
    [colSizes, rowSizes, config.cols, config.rows]
  );

  // Compute grid template strings
  const colTemplate = colSizes
    ? colSizes.map((s) => `${s}fr`).join(' ')
    : `repeat(${config.cols}, 1fr)`;
  const rowTemplate = rowSizes
    ? rowSizes.map((s) => `${s}fr`).join(' ')
    : `repeat(${config.rows}, 1fr)`;

  return (
    <div
      ref={gridRef}
      className="h-full w-full relative"
      style={{
        display: 'grid',
        gridTemplateColumns: colTemplate,
        gridTemplateRows: rowTemplate,
        gap: '2px',
        backgroundColor: 'var(--color-bg-tertiary)',
      }}
    >
      {visibleTerminals.map((t, index) => {
        const row = Math.floor(index / config.cols);
        const col = index % config.cols;
        const isActive = t.id === activeTerminalId;

        return (
          <div
            key={t.id}
            className={`relative flex flex-col min-h-0 min-w-0 bg-bg-deep
                        ${isActive ? 'ring-1 ring-accent/30' : ''}`}
            onClick={() => setActiveTerminal(t.id)}
          >
            {/* Cell header */}
            <div className="flex items-center justify-between h-6 px-2 bg-bg-secondary border-b border-border-subtle flex-shrink-0">
              <span className="text-[10px] text-text-tertiary truncate">{t.name}</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveTerminal(t.id);
                    setViewMode('tabs');
                  }}
                  className="text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
                  title="Focus"
                >
                  <Maximize2 className="h-3 w-3" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTerminal(t.id);
                  }}
                  className="text-text-tertiary hover:text-error transition-colors cursor-pointer"
                  title="Close"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>

            {/* Terminal */}
            <div className="flex-1 min-h-0">
              <Terminal terminalId={t.id} />
            </div>

            {/* Right resize handle */}
            {col < config.cols - 1 && (
              <div
                className="absolute top-0 right-0 w-1 h-full cursor-col-resize z-10 hover:bg-accent/30 transition-colors"
                onMouseDown={(e) => handleResizeStart('col', col, e.clientX)}
              />
            )}

            {/* Bottom resize handle */}
            {row < config.rows - 1 && (
              <div
                className="absolute bottom-0 left-0 h-1 w-full cursor-row-resize z-10 hover:bg-accent/30 transition-colors"
                onMouseDown={(e) => handleResizeStart('row', row, e.clientY)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
