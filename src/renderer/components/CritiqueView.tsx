/**
 * CritiqueView — Displays CommentArtifact[] grouped by file with severity badges.
 */

import { useState, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, AlertTriangle, Info, Lightbulb, ChevronRight, FileText } from 'lucide-react';
import { cn } from '../lib/utils';
import type { CommentArtifact, ArtifactSeverity } from '../../shared/ipcChannels';

interface CritiqueViewProps {
  artifacts: CommentArtifact[];
}

const severityConfig: Record<ArtifactSeverity, { icon: typeof AlertCircle; colorClass: string; label: string }> = {
  error:      { icon: AlertCircle,    colorClass: 'text-error bg-error/10 border-error/20',             label: 'Error' },
  warning:    { icon: AlertTriangle,  colorClass: 'text-warning bg-warning/10 border-warning/20',       label: 'Warning' },
  info:       { icon: Info,           colorClass: 'text-info bg-info/10 border-info/20',                label: 'Info' },
  suggestion: { icon: Lightbulb,      colorClass: 'text-[#a78bfa] bg-[#a78bfa]/10 border-[#a78bfa]/20', label: 'Suggestion' },
};

function SeverityBadge({ severity }: { severity: ArtifactSeverity }) {
  const config = severityConfig[severity];
  const Icon = config.icon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border flex-shrink-0',
        config.colorClass
      )}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

export function CritiqueView({ artifacts }: CritiqueViewProps) {
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  // Group comments by file
  const grouped = useMemo(() => {
    const map = new Map<string, CommentArtifact[]>();
    for (const artifact of artifacts) {
      const existing = map.get(artifact.file);
      if (existing) {
        existing.push(artifact);
      } else {
        map.set(artifact.file, [artifact]);
      }
    }
    // Sort comments within each file by line number
    for (const comments of map.values()) {
      comments.sort((a, b) => a.line - b.line);
    }
    return map;
  }, [artifacts]);

  const toggleFile = (file: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(file)) {
        next.delete(file);
      } else {
        next.add(file);
      }
      return next;
    });
  };

  // Empty state
  if (artifacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-text-tertiary py-12">
        <AlertCircle className="w-8 h-8 mb-2 opacity-40" />
        <p className="text-sm">No critique comments</p>
        <p className="text-xs text-text-muted mt-1">Run a critique stage to see feedback here</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 p-2">
      {Array.from(grouped.entries()).map(([file, comments]) => {
        const isExpanded = expandedFiles.has(file);
        const errorCount = comments.filter((c) => c.severity === 'error').length;
        const warningCount = comments.filter((c) => c.severity === 'warning').length;

        return (
          <div key={file} className="rounded-md border border-border-subtle bg-bg-secondary overflow-hidden">
            {/* Collapsible file header */}
            <button
              onClick={() => toggleFile(file)}
              className={cn(
                'flex items-center gap-2 w-full px-3 py-2 text-left transition-colors cursor-pointer',
                'hover:bg-bg-hover',
                isExpanded && 'bg-bg-tertiary'
              )}
            >
              <ChevronRight
                className={cn(
                  'w-3.5 h-3.5 text-text-tertiary transition-transform flex-shrink-0',
                  isExpanded && 'rotate-90'
                )}
              />
              <FileText className="w-3.5 h-3.5 text-text-tertiary flex-shrink-0" />
              <span className="text-xs font-medium text-text-primary truncate flex-1">{file}</span>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {errorCount > 0 && (
                  <span className="text-[10px] font-medium text-error">{errorCount} err</span>
                )}
                {warningCount > 0 && (
                  <span className="text-[10px] font-medium text-warning">{warningCount} warn</span>
                )}
                <span className="text-[10px] text-text-muted">{comments.length} comments</span>
              </div>
            </button>

            {/* Comment list */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-border-subtle">
                    {comments.map((comment) => (
                      <div
                        key={comment.id}
                        className="flex items-start gap-2 px-3 py-2 border-b border-border-subtle last:border-b-0 hover:bg-bg-hover/50 transition-colors"
                      >
                        <SeverityBadge severity={comment.severity} />
                        <span className="text-[10px] font-mono text-text-muted flex-shrink-0 pt-0.5 min-w-[32px] text-right">
                          L{comment.line}
                          {comment.endLine && comment.endLine !== comment.line ? `-${comment.endLine}` : ''}
                        </span>
                        <p className="text-xs text-text-secondary flex-1 leading-relaxed">{comment.message}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
