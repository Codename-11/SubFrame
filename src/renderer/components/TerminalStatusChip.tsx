/**
 * TerminalStatusChip — small per-cell chip showing a terminal's formal
 * 7-state status (Maestro-style). Renders a colored dot + short label.
 *
 * This file owns the shared STATUS_STYLES palette, which StatusLegend
 * imports to stay visually in sync.
 */

import type { TerminalStatus } from '../../shared/agentStateTypes';
import { cn } from '../lib/utils';

export interface StatusStyle {
  /** Short, human-readable label used in the chip + legend */
  label: string;
  /** Tailwind bg utility for the solid dot */
  dotClass: string;
  /** Tailwind text utility for the label */
  textClass: string;
}

/**
 * Shared palette used by the per-cell chip AND the status-bar legend.
 * Keep this in one place so the two surfaces never drift.
 */
export const STATUS_STYLES: Record<TerminalStatus, StatusStyle> = {
  starting: {
    label: 'Starting',
    dotClass: 'bg-text-muted',
    textClass: 'text-text-muted',
  },
  idle: {
    label: 'Idle',
    dotClass: 'bg-text-tertiary',
    textClass: 'text-text-tertiary',
  },
  working: {
    label: 'Working',
    dotClass: 'bg-success',
    textClass: 'text-success',
  },
  'needs-input': {
    label: 'Needs Input',
    dotClass: 'bg-warning',
    textClass: 'text-warning',
  },
  done: {
    label: 'Done',
    dotClass: 'bg-info',
    textClass: 'text-info',
  },
  error: {
    label: 'Error',
    dotClass: 'bg-error',
    textClass: 'text-error',
  },
  timeout: {
    label: 'Timeout',
    dotClass: 'bg-accent',
    textClass: 'text-accent',
  },
};

/** All 7 statuses in display order — used by the legend. */
export const TERMINAL_STATUS_ORDER: TerminalStatus[] = [
  'starting',
  'idle',
  'working',
  'needs-input',
  'done',
  'error',
  'timeout',
];

interface TerminalStatusChipProps {
  status: TerminalStatus;
  className?: string;
}

export function TerminalStatusChip({ status, className }: TerminalStatusChipProps) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.idle;
  const isWorking = status === 'working';
  const isNeedsInput = status === 'needs-input';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 h-4 px-1.5 rounded-full bg-bg-primary/60 border border-border-subtle',
        'text-[9px] font-medium uppercase tracking-wide leading-none shrink-0 select-none',
        className,
      )}
      title={`Status: ${style.label}`}
    >
      <span
        className={cn(
          'size-1.5 rounded-full shrink-0',
          style.dotClass,
          (isWorking || isNeedsInput) && 'animate-pulse',
        )}
      />
      <span className={style.textClass}>{style.label}</span>
    </span>
  );
}
