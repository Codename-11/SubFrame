/**
 * TaskTimeline — Horizontal stepper showing task step progress.
 * Compact mode (or >7 steps) shows a progress bar with count.
 * Full mode shows circles with connectors and labels.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '../lib/utils';
import type { TaskStep } from '../../shared/ipcChannels';

interface TaskTimelineProps {
  steps: TaskStep[];
  onToggleStep?: (index: number) => void;
  compact?: boolean;
}

export function TaskTimeline({ steps, onToggleStep, compact }: TaskTimelineProps) {
  if (steps.length === 0) return null;

  const completedCount = steps.filter((s) => s.completed).length;
  const total = steps.length;
  const percent = Math.round((completedCount / total) * 100);

  // Use compact view when explicitly compact or too many steps
  const useCompact = compact || total > 7;

  if (useCompact) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-text-tertiary whitespace-nowrap">
          Steps: {completedCount}/{total}
        </span>
        <div className="flex-1 h-1.5 bg-bg-tertiary rounded-full overflow-hidden min-w-[60px]">
          <motion.div
            className="h-full bg-success rounded-full"
            initial={false}
            animate={{ width: `${percent}%` }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          />
        </div>
        <span className="text-[10px] text-text-tertiary whitespace-nowrap">
          {percent}%
        </span>
      </div>
    );
  }

  // Full stepper view
  // Find the first incomplete step (the "current" step)
  const currentIndex = steps.findIndex((s) => !s.completed);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-text-tertiary whitespace-nowrap">
          Steps: {completedCount}/{total}
        </span>
        <div className="flex-1 h-1 bg-bg-tertiary rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-success rounded-full"
            initial={false}
            animate={{ width: `${percent}%` }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          />
        </div>
        <span className="text-[10px] text-text-tertiary whitespace-nowrap">
          {percent}%
        </span>
      </div>
      <div className="flex items-start">
        {steps.map((step, index) => {
          const isCompleted = step.completed;
          const isCurrent = index === currentIndex;
          const isFuture = !isCompleted && !isCurrent;

          return (
            <div
              key={index}
              className="flex flex-col items-center flex-1 min-w-0"
            >
              {/* Circle + connectors row */}
              <div className="flex items-center w-full">
                {/* Left connector */}
                {index > 0 && (
                  <div
                    className={cn(
                      'flex-1 h-px',
                      steps[index - 1].completed ? 'bg-success' : 'bg-border-default'
                    )}
                  />
                )}
                {index === 0 && <div className="flex-1" />}

                {/* Step circle */}
                <button
                  onClick={() => onToggleStep?.(index)}
                  className={cn(
                    'relative shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-colors',
                    onToggleStep && 'cursor-pointer',
                    !onToggleStep && 'cursor-default'
                  )}
                  title={step.label}
                  type="button"
                >
                  <AnimatePresence mode="wait">
                    {isCompleted ? (
                      <motion.div
                        key="completed"
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.5, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="w-5 h-5 rounded-full bg-success flex items-center justify-center"
                      >
                        <Check size={10} className="text-bg-deep" strokeWidth={3} />
                      </motion.div>
                    ) : isCurrent ? (
                      <motion.div
                        key="current"
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.5, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="w-5 h-5 rounded-full bg-accent flex items-center justify-center"
                      >
                        {/* Pulse ring — 3-keyframe opacity so loop point is seamless (0→0→0) */}
                        <motion.div
                          className="absolute inset-0 rounded-full bg-accent"
                          animate={{ scale: [1, 1.2, 1.5], opacity: [0, 0.4, 0] }}
                          transition={{ duration: 2, repeat: Infinity, ease: 'easeOut', times: [0, 0.1, 1] }}
                        />
                        <div className="w-1.5 h-1.5 rounded-full bg-bg-deep" />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="future"
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.5, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="w-5 h-5 rounded-full border-2 border-border-default bg-bg-primary"
                      />
                    )}
                  </AnimatePresence>
                </button>

                {/* Right connector */}
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      'flex-1 h-px',
                      isCompleted ? 'bg-success' : 'bg-border-default'
                    )}
                  />
                )}
                {index === steps.length - 1 && <div className="flex-1" />}
              </div>

              {/* Label */}
              <span
                className={cn(
                  'text-[9px] mt-1 text-center truncate w-full px-0.5',
                  isCompleted && 'text-success',
                  isCurrent && 'text-accent',
                  isFuture && 'text-text-muted'
                )}
                title={step.label}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
