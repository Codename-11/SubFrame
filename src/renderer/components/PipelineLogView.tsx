/**
 * PipelineLogView — Scrollable log viewer for pipeline stage output.
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Terminal, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';
import type { PipelineStage, StageStatus } from '../../shared/ipcChannels';

interface PipelineLogViewProps {
  stages: PipelineStage[];
  logs: Map<string, string[]> | Record<string, string[]>;
}

const statusConfig: Record<StageStatus, { colorClass: string; label: string }> = {
  pending:   { colorClass: 'bg-text-muted/20 text-text-muted',   label: 'Pending' },
  running:   { colorClass: 'bg-info/20 text-info',               label: 'Running' },
  completed: { colorClass: 'bg-success/20 text-success',         label: 'Done' },
  failed:    { colorClass: 'bg-error/20 text-error',             label: 'Failed' },
  skipped:   { colorClass: 'bg-text-muted/10 text-text-muted',   label: 'Skipped' },
};

function StageStatusBadge({ status }: { status: StageStatus }) {
  const config = statusConfig[status];
  return (
    <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium', config.colorClass)}>
      {config.label}
    </span>
  );
}

export function PipelineLogView({ stages, logs }: PipelineLogViewProps) {
  // Normalize logs to a plain object
  const logsObj = useMemo(() => {
    if (logs instanceof Map) {
      const obj: Record<string, string[]> = {};
      logs.forEach((val, key) => { obj[key] = val; });
      return obj;
    }
    return logs;
  }, [logs]);

  // Default to first stage with logs, or first running stage, or first stage
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  // Auto-select first meaningful stage
  useEffect(() => {
    if (stages.length === 0) return;
    if (selectedStageId && stages.some((s) => s.id === selectedStageId)) return;

    const running = stages.find((s) => s.status === 'running');
    const withLogs = stages.find((s) => logsObj[s.id]?.length);
    setSelectedStageId(running?.id ?? withLogs?.id ?? stages[0].id);
  }, [stages, selectedStageId, logsObj]);

  const selectedStage = stages.find((s) => s.id === selectedStageId) ?? null;
  const currentLogs = selectedStageId ? (logsObj[selectedStageId] ?? []) : [];

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScrollRef.current && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [currentLogs.length]);

  // Detect manual scroll to disable auto-scroll
  const handleScroll = () => {
    const el = logContainerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    autoScrollRef.current = atBottom;
  };

  // Empty state
  if (stages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-text-tertiary py-12">
        <Terminal className="w-8 h-8 mb-2 opacity-40" />
        <p className="text-sm">No pipeline stages</p>
        <p className="text-xs text-text-muted mt-1">Stage output will appear here during pipeline runs</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Stage selector */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border-subtle bg-bg-secondary shrink-0">
        <Terminal className="w-3.5 h-3.5 text-text-tertiary flex-shrink-0" />
        <div className="relative flex-1">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 w-full px-2 py-1 rounded bg-bg-tertiary border border-border-subtle
                       hover:border-border-default transition-colors cursor-pointer text-left"
          >
            <span className="text-xs font-medium text-text-primary truncate flex-1">
              {selectedStage?.name ?? 'Select stage'}
            </span>
            {selectedStage && <StageStatusBadge status={selectedStage.status} />}
            <ChevronDown className={cn('w-3.5 h-3.5 text-text-tertiary transition-transform', dropdownOpen && 'rotate-180')} />
          </button>

          <AnimatePresence>
            {dropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.1 }}
                className="absolute top-full left-0 right-0 mt-1 bg-bg-elevated border border-border-default rounded-md shadow-lg z-20 overflow-hidden"
              >
                {stages.map((stage) => (
                  <button
                    key={stage.id}
                    onClick={() => {
                      setSelectedStageId(stage.id);
                      setDropdownOpen(false);
                      autoScrollRef.current = true;
                    }}
                    className={cn(
                      'flex items-center gap-2 w-full px-3 py-1.5 text-left transition-colors cursor-pointer',
                      stage.id === selectedStageId
                        ? 'bg-accent/10 text-accent'
                        : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                    )}
                  >
                    <span className="text-xs truncate flex-1">{stage.name}</span>
                    <StageStatusBadge status={stage.status} />
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <span className="text-[10px] text-text-muted tabular-nums flex-shrink-0">
          {currentLogs.length} lines
        </span>
      </div>

      {/* Log output */}
      <div
        ref={logContainerRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto bg-bg-deep p-3"
      >
        {currentLogs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-text-muted text-xs">
            No logs for this stage
          </div>
        ) : (
          <pre className="text-[11px] font-mono leading-relaxed text-text-secondary whitespace-pre-wrap break-words">
            {currentLogs.map((line, i) => (
              <div key={i} className="hover:bg-white/[0.02] transition-colors">
                <span className="inline-block w-8 text-right mr-3 text-text-muted select-none tabular-nums text-[10px]">
                  {i + 1}
                </span>
                {line}
              </div>
            ))}
          </pre>
        )}
      </div>
    </div>
  );
}
