import { FileText, Loader2 } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { useOverview } from '../hooks/useOverview';

export function DecisionsDetailView() {
  const { overview, isLoading } = useOverview();
  const decisions = overview?.decisions;
  const total = decisions?.total || 0;
  const items = decisions?.decisions || [];

  return (
    <ScrollArea className="h-full">
      <div className="max-w-2xl mx-auto p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-blue-400" />
          <h2 className="text-sm font-semibold text-text-primary">Project Decisions</h2>
          <span className="text-xs text-text-tertiary ml-auto">{total} total</span>
        </div>

        {/* Source note */}
        <div className="text-[11px] text-text-tertiary">
          Extracted from <span className="font-mono">.subframe/PROJECT_NOTES.md</span>
        </div>

        {isLoading && items.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 size={20} className="animate-spin text-text-muted" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-1 text-text-tertiary py-8 text-center">
            <span className="text-sm">No decisions recorded yet</span>
            <span className="text-xs opacity-60">Decisions are tracked in .subframe/PROJECT_NOTES.md to preserve architecture and design choices</span>
          </div>
        ) : (
          <div className="space-y-1.5">
            {items.map((d, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-2.5 rounded-md bg-bg-deep/50 border border-border-subtle/50"
              >
                <span className="text-[10px] font-mono text-text-tertiary bg-bg-hover px-1.5 py-0.5 rounded shrink-0">
                  {d.date}
                </span>
                <span className="text-xs text-text-secondary">{d.title}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
