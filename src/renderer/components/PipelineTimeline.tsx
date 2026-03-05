/**
 * PipelineTimeline — Horizontal stage flow visualization for pipeline runs.
 * Compact mode shows a progress bar with count.
 * Full mode shows stage nodes connected by lines with status indicators.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, SkipForward } from 'lucide-react';
import { cn } from '../lib/utils';
import type { PipelineStage, StageStatus } from '../../shared/ipcChannels';

interface PipelineTimelineProps {
  stages: PipelineStage[];
  onStageClick?: (stageId: string) => void;
  compact?: boolean;
}

/** Format milliseconds to a human-readable duration */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

/** Count completed + skipped stages (finished stages) */
function countFinished(stages: PipelineStage[]): number {
  return stages.filter((s) => s.status === 'completed' || s.status === 'skipped').length;
}

export function PipelineTimeline({ stages, onStageClick, compact }: PipelineTimelineProps) {
  if (stages.length === 0) return null;

  const finishedCount = countFinished(stages);
  const total = stages.length;
  const percent = Math.round((finishedCount / total) * 100);

  const useCompact = compact || total > 7;

  if (useCompact) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-text-tertiary whitespace-nowrap">
          Stages: {finishedCount}/{total}
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

  // Full stage flow view
  return (
    <div className="flex flex-col gap-1.5">
      {/* Progress bar */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-text-tertiary whitespace-nowrap">
          Stages: {finishedCount}/{total}
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

      {/* Stage nodes */}
      <div className="flex items-start">
        {stages.map((stage, index) => (
          <StageNode
            key={stage.id}
            stage={stage}
            index={index}
            total={stages.length}
            prevStatus={index > 0 ? stages[index - 1].status : null}
            onClick={onStageClick}
          />
        ))}
      </div>
    </div>
  );
}

interface StageNodeProps {
  stage: PipelineStage;
  index: number;
  total: number;
  prevStatus: StageStatus | null;
  onClick?: (stageId: string) => void;
}

function StageNode({ stage, index, total, prevStatus, onClick }: StageNodeProps) {
  const { status } = stage;
  const isCompleted = status === 'completed';
  const isRunning = status === 'running';
  const isFailed = status === 'failed';
  const isSkipped = status === 'skipped';

  return (
    <div className="flex flex-col items-center flex-1 min-w-0">
      {/* Circle + connectors row */}
      <div className="flex items-center w-full">
        {/* Left connector */}
        {index > 0 ? (
          <div
            className={cn(
              'flex-1 h-px',
              prevStatus === 'completed' ? 'bg-success' :
              prevStatus === 'failed' ? 'bg-error' :
              prevStatus === 'skipped' ? 'bg-border-default border-dashed' :
              'bg-border-default'
            )}
          />
        ) : (
          <div className="flex-1" />
        )}

        {/* Stage circle */}
        <button
          onClick={() => onClick?.(stage.id)}
          className={cn(
            'relative shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-colors',
            onClick && 'cursor-pointer',
            !onClick && 'cursor-default'
          )}
          title={`${stage.name}${stage.durationMs ? ` (${formatDuration(stage.durationMs)})` : ''}`}
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
            ) : isRunning ? (
              <motion.div
                key="running"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="w-5 h-5 rounded-full bg-accent flex items-center justify-center"
              >
                {/* Pulse ring */}
                <motion.div
                  className="absolute inset-0 rounded-full bg-accent"
                  animate={{ scale: [1, 1.4], opacity: [0.4, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
                />
                <div className="w-1.5 h-1.5 rounded-full bg-bg-deep" />
              </motion.div>
            ) : isFailed ? (
              <motion.div
                key="failed"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="w-5 h-5 rounded-full bg-error flex items-center justify-center"
              >
                <X size={10} className="text-bg-deep" strokeWidth={3} />
              </motion.div>
            ) : isSkipped ? (
              <motion.div
                key="skipped"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="w-5 h-5 rounded-full border-2 border-dashed border-border-default bg-bg-primary flex items-center justify-center"
              >
                <SkipForward size={8} className="text-text-muted" />
              </motion.div>
            ) : (
              <motion.div
                key="pending"
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
        {index < total - 1 ? (
          <div
            className={cn(
              'flex-1 h-px',
              isCompleted ? 'bg-success' :
              isFailed ? 'bg-error' :
              isSkipped ? 'bg-border-default border-dashed' :
              'bg-border-default'
            )}
          />
        ) : (
          <div className="flex-1" />
        )}
      </div>

      {/* Label */}
      <span
        className={cn(
          'text-[9px] mt-1 text-center truncate w-full px-0.5',
          isCompleted && 'text-success',
          isRunning && 'text-accent',
          isFailed && 'text-error',
          isSkipped && 'text-text-muted',
          status === 'pending' && 'text-text-muted'
        )}
        title={stage.name}
      >
        {stage.name}
      </span>

      {/* Duration badge */}
      {isCompleted && stage.durationMs != null && (
        <span className="text-[8px] text-text-tertiary mt-0.5">
          {formatDuration(stage.durationMs)}
        </span>
      )}
    </div>
  );
}
