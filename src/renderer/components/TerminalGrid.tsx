/**
 * Terminal grid layout component.
 * Renders terminals in a CSS Grid with resize handles between cells.
 * Supports drag-to-swap reordering of grid cells.
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import { X, Maximize2, Minimize2, Plus, GripVertical, Bot, ExternalLink } from 'lucide-react';
import { Terminal } from './Terminal';
import { useTerminalStore, type TerminalInfo } from '../stores/useTerminalStore';
import { typedInvoke } from '../lib/ipc';
import { IPC } from '../../shared/ipcChannels';

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
  onCreateTerminal: (shell?: string) => void;
  onPopOutTerminal?: (id: string) => void;
  projectTerminals: TerminalInfo[];
  projectPath?: string;
}

export function TerminalGrid({ onCloseTerminal, onCreateTerminal, onPopOutTerminal, projectTerminals, projectPath }: TerminalGridProps) {
  const activeTerminalId = useTerminalStore((s) => s.activeTerminalId);
  const gridLayout = useTerminalStore((s) => s.gridLayout);
  const setActiveTerminal = useTerminalStore((s) => s.setActiveTerminal);
  const maximizedTerminalId = useTerminalStore((s) => s.maximizedTerminalId);
  const setMaximizedTerminal = useTerminalStore((s) => s.setMaximizedTerminal);
  const gridSlots = useTerminalStore((s) => s.gridSlots);
  const setGridSlots = useTerminalStore((s) => s.setGridSlots);

  const config = GRID_LAYOUTS[gridLayout] ?? GRID_LAYOUTS['2x2'];
  const maxCells = config.rows * config.cols;

  // Track which slot index was clicked for "New Terminal" so we can place it there
  const pendingSlotRef = useRef<number | null>(null);

  // Rebuild slots when terminals or layout change — preserve existing positions
  useEffect(() => {
    const prev = useTerminalStore.getState().gridSlots;
    const terminalIds = new Set(projectTerminals.map(t => t.id));
    // Keep existing assignments that still have valid terminals
    const kept = prev.slice(0, maxCells).map(id => id && terminalIds.has(id) ? id : null);
    // Pad to maxCells
    while (kept.length < maxCells) kept.push(null);
    // Find terminals not yet assigned to a slot
    const assignedIds = new Set(kept.filter(Boolean));
    const unassigned = projectTerminals.filter(t => !assignedIds.has(t.id));
    // If a specific slot was requested, fill it first
    let ui = 0;
    const pending = pendingSlotRef.current;
    if (pending !== null && pending < kept.length && kept[pending] === null && ui < unassigned.length) {
      kept[pending] = unassigned[ui++].id;
      pendingSlotRef.current = null;
    }
    // Fill remaining empty slots with remaining unassigned terminals
    for (let i = 0; i < kept.length && ui < unassigned.length; i++) {
      if (kept[i] === null) {
        kept[i] = unassigned[ui++].id;
      }
    }
    // Only update store if slots actually changed (avoid infinite loops)
    const prevStr = JSON.stringify(prev.slice(0, maxCells));
    const nextStr = JSON.stringify(kept);
    if (prevStr !== nextStr) {
      setGridSlots(kept, projectPath);
    }
  }, [projectTerminals, maxCells, setGridSlots, projectPath]);

  // Resolve slots to terminal objects for rendering
  const terminalMap = useRef(new Map<string, TerminalInfo>());
  terminalMap.current = new Map(projectTerminals.map(t => [t.id, t]));

  // Drag-to-swap state
  const [dragSourceIdx, setDragSourceIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const dragSourceRef = useRef<number | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    dragSourceRef.current = index;
    setDragSourceIdx(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIdx(index);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverIdx(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    e.stopPropagation();

    const sourceIdx = dragSourceRef.current;
    setDragOverIdx(null);
    setDragSourceIdx(null);
    dragSourceRef.current = null;

    if (sourceIdx === null || sourceIdx === targetIdx) return;

    // Swap the two slots (works for filled↔filled, filled↔empty, any combo)
    const prev = useTerminalStore.getState().gridSlots;
    const next = [...prev];
    [next[sourceIdx], next[targetIdx]] = [next[targetIdx], next[sourceIdx]];
    setGridSlots(next, projectPath);
  }, [setGridSlots, projectPath]);

  const handleDragEnd = useCallback(() => {
    setDragSourceIdx(null);
    setDragOverIdx(null);
  }, []);

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

  // Restore saved sizes (or reset) when layout changes; also clear maximize
  useEffect(() => {
    setMaximizedTerminal(null);
    try {
      const saved = JSON.parse(localStorage.getItem(`terminal-grid-sizes-${gridLayout}`) || 'null');
      setColSizes(saved?.cols ?? null);
      setRowSizes(saved?.rows ?? null);
    } catch {
      setColSizes(null);
      setRowSizes(null);
    }
  }, [gridLayout, setMaximizedTerminal]);

  // Track latest sizes for persistence on drag end
  const latestColSizesRef = useRef(colSizes);
  const latestRowSizesRef = useRef(rowSizes);
  latestColSizesRef.current = colSizes;
  latestRowSizesRef.current = rowSizes;

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

        // Persist sizes for current layout
        try {
          const sizes = { cols: latestColSizesRef.current, rows: latestRowSizesRef.current };
          localStorage.setItem(`terminal-grid-sizes-${gridLayout}`, JSON.stringify(sizes));
        } catch { /* ignore */ }
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      document.body.style.cursor = type === 'col' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
    },
    [colSizes, rowSizes, config.cols, config.rows, gridLayout]
  );

  // Compute grid template strings
  const colTemplate = colSizes
    ? colSizes.map((s) => `${s}fr`).join(' ')
    : `repeat(${config.cols}, 1fr)`;
  const rowTemplate = rowSizes
    ? rowSizes.map((s) => `${s}fr`).join(' ')
    : `repeat(${config.rows}, 1fr)`;

  // If a terminal is maximized, render it full-size instead of the grid
  const maximizedTerminal = maximizedTerminalId
    ? projectTerminals.find((t) => t.id === maximizedTerminalId)
    : null;

  if (maximizedTerminal) {
    return (
      <div className="h-full w-full flex flex-col bg-bg-deep">
        <div className="flex items-center justify-between h-6 px-2 bg-bg-secondary border-b border-border-subtle shrink-0">
          <span className="text-[10px] text-text-tertiary truncate">{maximizedTerminal.name}</span>
          <div className="flex items-center gap-1">
            {onPopOutTerminal && !maximizedTerminal.poppedOut && (
              <button
                onClick={() => onPopOutTerminal(maximizedTerminal.id)}
                className="text-text-tertiary hover:text-accent transition-colors cursor-pointer"
                title="Pop Out (Ctrl+Shift+D)"
              >
                <ExternalLink className="h-3 w-3" />
              </button>
            )}
            <button
              onClick={() => setMaximizedTerminal(null)}
              className="text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
              title="Restore grid (Esc)"
            >
              <Minimize2 className="h-3 w-3" />
            </button>
            <button
              onClick={() => onCloseTerminal(maximizedTerminal.id)}
              className="text-text-tertiary hover:text-error transition-colors cursor-pointer"
              title="Close"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          {maximizedTerminal.poppedOut ? (
            <div className="flex h-full items-center justify-center text-text-tertiary">
              <div className="text-center">
                <ExternalLink className="h-10 w-10 mx-auto mb-3 text-text-muted" />
                <p className="text-sm text-text-secondary font-medium mb-1">Terminal in separate window</p>
                <p className="text-xs text-text-muted mb-4">This terminal has been popped out to its own window.</p>
                <div className="flex items-center gap-2 justify-center">
                  <button
                    onClick={() => typedInvoke(IPC.TERMINAL_POPOUT, maximizedTerminal.id)}
                    className="px-3 py-1.5 rounded text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover border border-border-subtle transition-colors cursor-pointer"
                  >
                    Focus Window
                  </button>
                  <button
                    onClick={() => typedInvoke(IPC.TERMINAL_DOCK, maximizedTerminal.id)}
                    className="px-3 py-1.5 rounded text-xs bg-accent/15 text-accent border border-accent/25 hover:bg-accent/25 transition-colors cursor-pointer"
                  >
                    Dock Back
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <Terminal terminalId={maximizedTerminal.id} />
          )}
        </div>
      </div>
    );
  }

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
      {gridSlots.slice(0, maxCells).map((slotId, index) => {
        const t = slotId ? terminalMap.current.get(slotId) : null;
        const row = Math.floor(index / config.cols);
        const col = index % config.cols;
        const isDragSource = dragSourceIdx === index;
        const isDragOver = dragOverIdx === index && dragSourceIdx !== index;

        if (t) {
          const isActive = t.id === activeTerminalId;
          return (
            <div
              key={t.id}
              className={`relative flex flex-col min-h-0 min-w-0 bg-bg-deep transition-opacity duration-150
                          ${isActive ? 'ring-1 ring-accent/30' : ''}
                          ${isDragSource ? 'opacity-40' : ''}
                          ${isDragOver ? 'ring-2 ring-accent/60' : ''}`}
              onClick={() => setActiveTerminal(t.id)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
            >
              {/* Cell header — left side draggable, right side has action buttons */}
              <div
                className="flex items-center justify-between h-6 bg-bg-secondary border-b border-border-subtle flex-shrink-0"
                onDoubleClick={() => setMaximizedTerminal(t.id)}
              >
                <div
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragEnd={handleDragEnd}
                  className="flex items-center gap-1 min-w-0 flex-1 px-2 h-full cursor-grab active:cursor-grabbing"
                >
                  <GripVertical className="h-3 w-3 text-text-muted flex-shrink-0" />
                  {t.claudeActive && <Bot className="h-3 w-3 text-success flex-shrink-0 animate-pulse" />}
                  <span className="text-[10px] text-text-tertiary truncate">{t.name}</span>
                </div>
                <div className="flex items-center flex-shrink-0 pr-1">
                  {onPopOutTerminal && !t.poppedOut && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onPopOutTerminal(t.id);
                      }}
                      className="text-text-tertiary hover:text-accent hover:bg-bg-hover transition-colors cursor-pointer rounded p-1"
                      title="Pop Out (Ctrl+Shift+D)"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMaximizedTerminal(t.id);
                    }}
                    className="text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer rounded p-1"
                    title="Maximize"
                  >
                    <Maximize2 className="h-3 w-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseTerminal(t.id);
                    }}
                    className="text-text-tertiary hover:text-error hover:bg-bg-hover transition-colors cursor-pointer rounded p-1"
                    title="Close"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {/* Terminal or popped-out placeholder */}
              <div className="flex-1 min-h-0">
                {t.poppedOut ? (
                  <div className="flex h-full items-center justify-center text-text-tertiary">
                    <div className="text-center px-4">
                      <ExternalLink className="h-7 w-7 mx-auto mb-2 text-text-muted" />
                      <p className="text-xs text-text-secondary font-medium mb-2">In separate window</p>
                      <div className="flex items-center gap-1.5 justify-center">
                        <button
                          onClick={(e) => { e.stopPropagation(); typedInvoke(IPC.TERMINAL_POPOUT, t.id); }}
                          className="px-2 py-1 rounded text-[10px] text-text-secondary hover:text-text-primary hover:bg-bg-hover border border-border-subtle transition-colors cursor-pointer"
                        >
                          Focus
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); typedInvoke(IPC.TERMINAL_DOCK, t.id); }}
                          className="px-2 py-1 rounded text-[10px] bg-accent/15 text-accent border border-accent/25 hover:bg-accent/25 transition-colors cursor-pointer"
                        >
                          Dock
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Terminal terminalId={t.id} />
                )}
              </div>

              {/* Right resize handle */}
              {col < config.cols - 1 && (
                <div
                  className="absolute top-0 right-0 w-2 h-full cursor-col-resize z-10 group"
                  onMouseDown={(e) => handleResizeStart('col', col, e.clientX)}
                >
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-full bg-transparent group-hover:bg-accent/40 transition-colors" />
                </div>
              )}

              {/* Bottom resize handle */}
              {row < config.rows - 1 && (
                <div
                  className="absolute bottom-0 left-0 h-2 w-full cursor-row-resize z-10 group"
                  onMouseDown={(e) => handleResizeStart('row', row, e.clientY)}
                >
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 h-px w-full bg-transparent group-hover:bg-accent/40 transition-colors" />
                </div>
              )}
            </div>
          );
        }

        // Empty cell — entire area is clickable to create a terminal
        return (
          <div
            key={`empty-${index}`}
            className={`relative flex flex-col min-h-0 min-w-0 bg-bg-deep cursor-pointer
                        hover:bg-bg-primary/50 transition-colors group
                        ${isDragOver ? 'ring-2 ring-accent/60' : ''}`}
            onClick={() => {
              pendingSlotRef.current = index;
              onCreateTerminal();
            }}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
          >
            <div className="flex items-center h-6 px-2 bg-bg-secondary border-b border-border-subtle flex-shrink-0">
              <span className="text-[10px] text-text-muted">Empty</span>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center gap-2
                            text-text-muted group-hover:text-accent transition-colors">
              <div className="w-10 h-10 rounded-full border border-dashed border-border-subtle
                              group-hover:border-accent/40 flex items-center justify-center transition-colors">
                <Plus className="w-5 h-5" />
              </div>
              <span className="text-xs">New Terminal</span>
              <span className="text-[10px] text-text-muted">Ctrl+Shift+T</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
