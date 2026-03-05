/**
 * PatchReview — Displays PatchArtifact[] with diff preview and apply controls.
 */

import { useState, useMemo, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronRight, FileCode, GitBranch } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import type { PatchArtifact } from '../../shared/ipcChannels';

interface PatchReviewProps {
  artifacts: PatchArtifact[];
  onApplyPatch?: (patchId: string) => void;
}

/** Render a unified diff with syntax coloring */
function DiffView({ diff }: { diff: string }) {
  const lines = diff.split('\n');
  return (
    <pre className="text-[11px] font-mono leading-relaxed overflow-x-auto p-3 bg-bg-deep rounded-md">
      {lines.map((line, i) => {
        let className = 'text-text-secondary';
        if (line.startsWith('+')) {
          className = 'text-success bg-success/5';
        } else if (line.startsWith('-')) {
          className = 'text-error bg-error/5';
        } else if (line.startsWith('@@')) {
          className = 'text-info bg-info/5';
        } else if (line.startsWith('diff') || line.startsWith('index') || line.startsWith('---') || line.startsWith('+++')) {
          className = 'text-text-muted';
        }
        return (
          <div key={i} className={cn('px-1', className)}>
            {line || ' '}
          </div>
        );
      })}
    </pre>
  );
}

export function PatchReview({ artifacts, onApplyPatch }: PatchReviewProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectablePatches = useMemo(
    () => artifacts.filter((p) => !p.applied),
    [artifacts]
  );

  const selectedCount = useMemo(
    () => Array.from(selectedIds).filter((id) => selectablePatches.some((p) => p.id === id)).length,
    [selectedIds, selectablePatches]
  );

  const handleApplySelected = useCallback(() => {
    if (!onApplyPatch) return;
    for (const id of selectedIds) {
      if (selectablePatches.some((p) => p.id === id)) {
        onApplyPatch(id);
      }
    }
    setSelectedIds(new Set());
  }, [onApplyPatch, selectedIds, selectablePatches]);

  // Empty state
  if (artifacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-text-tertiary py-12">
        <FileCode className="w-8 h-8 mb-2 opacity-40" />
        <p className="text-sm">No patches available</p>
        <p className="text-xs text-text-muted mt-1">Patches from critique stages will appear here</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar with apply button */}
      {onApplyPatch && selectablePatches.length > 0 && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle bg-bg-secondary shrink-0">
          <span className="text-xs text-text-secondary">
            {selectedCount} of {selectablePatches.length} selected
          </span>
          <Button
            size="sm"
            disabled={selectedCount === 0}
            onClick={handleApplySelected}
            className="h-7 text-xs"
          >
            Apply Selected
          </Button>
        </div>
      )}

      {/* Patch list */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2 flex flex-col gap-1.5">
        {artifacts.map((patch) => {
          const isApplied = patch.applied;
          const isSelected = selectedIds.has(patch.id);
          const isExpanded = expandedIds.has(patch.id);

          return (
            <div
              key={patch.id}
              className={cn(
                'rounded-md border overflow-hidden transition-colors',
                isApplied
                  ? 'border-success/20 bg-success/5 opacity-70'
                  : 'border-border-subtle bg-bg-secondary'
              )}
            >
              {/* Patch header */}
              <div className="flex items-center gap-2 px-3 py-2">
                {/* Checkbox / applied indicator */}
                {isApplied ? (
                  <div className="flex items-center justify-center w-4 h-4 rounded bg-success/20 flex-shrink-0">
                    <Check className="w-3 h-3 text-success" />
                  </div>
                ) : onApplyPatch ? (
                  <button
                    onClick={() => toggleSelection(patch.id)}
                    className={cn(
                      'flex items-center justify-center w-4 h-4 rounded border transition-colors cursor-pointer flex-shrink-0',
                      isSelected
                        ? 'bg-accent border-accent text-bg-primary'
                        : 'border-border-default bg-bg-primary hover:border-accent/50'
                    )}
                  >
                    {isSelected && <Check className="w-3 h-3" />}
                  </button>
                ) : null}

                {/* Expand toggle */}
                <button
                  onClick={() => toggleExpanded(patch.id)}
                  className="cursor-pointer flex-shrink-0"
                >
                  <ChevronRight
                    className={cn(
                      'w-3.5 h-3.5 text-text-tertiary transition-transform',
                      isExpanded && 'rotate-90'
                    )}
                  />
                </button>

                {/* Title and info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs font-medium truncate',
                      isApplied ? 'text-success line-through' : 'text-text-primary'
                    )}>
                      {patch.title}
                    </span>
                    {isApplied && (
                      <span className="text-[10px] text-success font-medium">Applied</span>
                    )}
                  </div>
                  <p className="text-[11px] text-text-tertiary truncate mt-0.5">{patch.explanation}</p>
                </div>
              </div>

              {/* Affected files */}
              {patch.files.length > 0 && (
                <div className="flex items-center gap-1 px-3 pb-2 flex-wrap">
                  <GitBranch className="w-3 h-3 text-text-muted flex-shrink-0" />
                  {patch.files.map((file) => (
                    <span
                      key={file}
                      className="text-[10px] font-mono text-text-muted bg-bg-tertiary px-1.5 py-0.5 rounded"
                    >
                      {file}
                    </span>
                  ))}
                </div>
              )}

              {/* Expandable diff preview */}
              <AnimatePresence>
                {isExpanded && patch.diff && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="overflow-hidden border-t border-border-subtle"
                  >
                    <div className="p-2">
                      <DiffView diff={patch.diff} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
