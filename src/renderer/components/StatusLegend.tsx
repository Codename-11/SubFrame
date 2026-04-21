/**
 * StatusLegend — compact horizontal legend showing {coloredDot, label, count}
 * for each of the 7 formal terminal statuses. Designed to fit in the status
 * bar (h-6). Counts are derived from `useTerminalStore.terminals`.
 *
 * Also owns the global `TERMINAL_STATUS_CHANGED` IPC listener — mounted once
 * in StatusBar so every terminal's formal status stays in sync with the
 * ptyManager-side broadcast.
 */

import { useMemo } from 'react';
import { useTerminalStore } from '../stores/useTerminalStore';
import { useUIStore } from '../stores/useUIStore';
import { useIPCEvent } from '../hooks/useIPCListener';
import { IPC } from '../../shared/ipcChannels';
import type { TerminalStatus, TerminalStatusEntry } from '../../shared/agentStateTypes';
import { STATUS_STYLES, TERMINAL_STATUS_ORDER } from './TerminalStatusChip';
import { cn } from '../lib/utils';

export function StatusLegend() {
  const terminals = useTerminalStore((s) => s.terminals);
  const setTerminalStatus = useTerminalStore((s) => s.setTerminalStatus);
  const showStatusLegend = useUIStore((s) => s.showStatusLegend);

  // Bridge: keep Zustand's per-terminal `status` field in sync with main-process
  // broadcasts. One listener, global to the app (StatusBar mounts the legend once).
  useIPCEvent<TerminalStatusEntry>(IPC.TERMINAL_STATUS_CHANGED, (data) => {
    if (!data || !data.terminalId) return;
    setTerminalStatus(data.terminalId, data.status, data.message);
  });

  const counts = useMemo(() => {
    const base: Record<TerminalStatus, number> = {
      starting: 0,
      idle: 0,
      working: 0,
      'needs-input': 0,
      done: 0,
      error: 0,
      timeout: 0,
    };
    for (const t of terminals.values()) {
      const s: TerminalStatus = t.status ?? 'idle';
      base[s] = (base[s] ?? 0) + 1;
    }
    return base;
  }, [terminals]);

  // Gate visibility AFTER the IPC bridge hook so status broadcasts keep flowing
  // even when the legend itself is hidden.
  if (!showStatusLegend) return null;

  return (
    <div
      className="flex items-center h-6 gap-2 px-2 text-[10px] text-text-secondary select-none"
      title="Formal terminal status counts"
    >
      {TERMINAL_STATUS_ORDER.map((status) => {
        const style = STATUS_STYLES[status];
        const count = counts[status];
        const dimmed = count === 0;
        return (
          <span
            key={status}
            className={cn(
              'inline-flex items-center gap-1 whitespace-nowrap',
              dimmed && 'opacity-40',
            )}
            title={`${style.label}: ${count}`}
          >
            <span className={cn('size-1.5 rounded-full shrink-0', style.dotClass)} />
            <span className={cn('font-mono tabular-nums', !dimmed && style.textClass)}>
              {count}
            </span>
            <span className="text-text-muted">{style.label}</span>
          </span>
        );
      })}
    </div>
  );
}
