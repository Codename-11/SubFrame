/**
 * AgentTimeline — Vertical stepper/timeline showing agent execution steps.
 * Renders step status with animated entries and auto-scroll to latest.
 */

import { useRef, useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, XCircle, Loader2, Circle } from 'lucide-react';
import { cn } from '../lib/utils';
import type { AgentStep } from '../../shared/agentStateTypes';

interface AgentTimelineProps {
  steps: AgentStep[];
  compact?: boolean;
  maxVisible?: number;
}

/** Short relative timestamp: "now", "22s", "5m", "2h", "3d" */
function formatShortTime(dateString: string | undefined): string {
  if (!dateString) return '';
  const diffMs = Date.now() - new Date(dateString).getTime();
  if (diffMs < 0) return 'now';
  const sec = Math.floor(diffMs / 1000);
  if (sec < 5) return 'now';
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  return `${Math.floor(hr / 24)}d`;
}

/** Status sort priority — running first, then by recency */
const STATUS_PRIORITY: Record<string, number> = {
  running: 0,
  pending: 1,
  completed: 2,
  failed: 2,
};

function StepIcon({ status }: { status: AgentStep['status'] }) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 size={14} className="text-success shrink-0" />;
    case 'failed':
      return <XCircle size={14} className="text-error shrink-0" />;
    case 'running':
      return <Loader2 size={14} className="text-accent shrink-0 animate-spin" />;
    case 'pending':
    default:
      return <Circle size={14} className="text-text-muted shrink-0" />;
  }
}

export function AgentTimeline({ steps, compact = false, maxVisible = 20 }: AgentTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to top (newest) when new steps arrive
  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [steps.length]);

  // Sort: running steps first, then newest-to-oldest
  const visibleSteps = useMemo(() => {
    const sliced = steps.length > maxVisible ? steps.slice(-maxVisible) : steps;
    return [...sliced].sort((a, b) => {
      const pa = STATUS_PRIORITY[a.status] ?? 2;
      const pb = STATUS_PRIORITY[b.status] ?? 2;
      if (pa !== pb) return pa - pb;
      // Within same priority: newest first (compare timestamps descending)
      const ta = a.startedAt ? new Date(a.startedAt).getTime() : 0;
      const tb = b.startedAt ? new Date(b.startedAt).getTime() : 0;
      return tb - ta;
    });
  }, [steps, maxVisible]);

  if (visibleSteps.length === 0) {
    return (
      <div className="flex items-center justify-center py-6 text-text-tertiary text-xs">
        No steps yet
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="relative">
      <div ref={topRef} />
      <AnimatePresence initial={false}>
        {visibleSteps.map((step, i) => {
          const isLast = i === visibleSteps.length - 1;
          const isRunning = step.status === 'running';

          const timeLabel = formatShortTime(step.startedAt);

          return (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="relative flex gap-1.5 pl-0.5"
            >
              {/* Time gutter */}
              <span className={cn(
                'w-7 shrink-0 text-[9px] font-mono text-right pt-px leading-[14px]',
                isRunning ? 'text-accent' : 'text-text-muted',
              )}>
                {timeLabel}
              </span>

              {/* Connector line + icon column */}
              <div className="flex flex-col items-center shrink-0">
                <StepIcon status={step.status} />
                {!isLast && (
                  <div className="w-px flex-1 min-h-3 bg-border-subtle" />
                )}
              </div>

              {/* Content */}
              <div
                className={cn(
                  'flex-1 min-w-0 pb-3',
                  isRunning && 'rounded px-1.5 py-0.5 -ml-1.5 bg-accent-subtle border border-accent/20',
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={cn(
                      'text-xs truncate',
                      isRunning ? 'text-accent font-medium' : 'text-text-primary',
                    )}
                  >
                    {step.label}
                  </span>
                </div>

                {!compact && step.toolName && (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] text-text-tertiary">{step.toolName}</span>
                    {step.status === 'completed' && (
                      <span className="text-[10px] text-success">done</span>
                    )}
                    {step.status === 'running' && (
                      <span className="text-[10px] text-accent">running</span>
                    )}
                    {step.status === 'failed' && step.result && (
                      <span className="text-[10px] text-error truncate">{step.result}</span>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
