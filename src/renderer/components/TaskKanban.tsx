/**
 * TaskKanban — Kanban board view for tasks.
 * Full view: horizontal columns side by side.
 * Compact/sidebar: vertical stacked sections.
 */

import { useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Play, Check, Pause, RotateCcw, Trash2, Send, FileText } from 'lucide-react';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { cn } from '../lib/utils';
import { useUIStore } from '../stores/useUIStore';
import type { Task, TaskStep } from '../../shared/ipcChannels';

// ── Column definitions ───────────────────────────────────────────────
interface KanbanColumn {
  id: string;
  label: string;
  dotColor: string;
  filter: (task: Task, blockedIds: Set<string>) => boolean;
}

const COLUMNS: KanbanColumn[] = [
  {
    id: 'pending',
    label: 'Pending',
    dotColor: 'bg-zinc-400',
    filter: (t, blocked) => t.status === 'pending' && !blocked.has(t.id),
  },
  {
    id: 'blocked',
    label: 'Blocked',
    dotColor: 'bg-red-400',
    filter: (t, blocked) => blocked.has(t.id) && t.status !== 'completed',
  },
  {
    id: 'in_progress',
    label: 'In Progress',
    dotColor: 'bg-amber-400',
    filter: (t, blocked) => t.status === 'in_progress' && !blocked.has(t.id),
  },
  {
    id: 'completed',
    label: 'Completed',
    dotColor: 'bg-emerald-400',
    filter: (t) => t.status === 'completed',
  },
];

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-900/60 text-red-300',
  medium: 'bg-amber-900/60 text-amber-300',
  low: 'bg-zinc-700 text-zinc-300',
};

const CATEGORY_COLORS: Record<string, string> = {
  feature: 'bg-violet-900/60 text-violet-300',
  fix: 'bg-orange-900/60 text-orange-300',
  refactor: 'bg-cyan-900/60 text-cyan-300',
  docs: 'bg-blue-900/60 text-blue-300',
  test: 'bg-teal-900/60 text-teal-300',
  chore: 'bg-zinc-700 text-zinc-300',
};

const CATEGORY_SHORT: Record<string, string> = {
  feature: 'Feat',
  fix: 'Fix',
  refactor: 'Refac',
  docs: 'Docs',
  test: 'Test',
  chore: 'Chore',
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return `${diff}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Task card ────────────────────────────────────────────────────────
interface TaskCardProps {
  task: Task;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdateStatus: (taskId: string, status: Task['status']) => void;
  onSendToTerminal?: (task: Task) => void;
  onRequestDelete: (taskId: string) => void;
  compact?: boolean;
}

function TaskCard({
  task,
  isExpanded,
  onToggle,
  onUpdateStatus,
  onSendToTerminal,
  onRequestDelete,
  compact,
}: TaskCardProps) {
  const completedSteps = task.steps?.filter((s: TaskStep) => s.completed).length ?? 0;
  const totalSteps = task.steps?.length ?? 0;
  const hasSteps = totalSteps > 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.15 }}
      className="bg-bg-secondary border border-border-subtle rounded-lg overflow-hidden"
    >
      {/* Card header */}
      <button
        onClick={onToggle}
        className="w-full px-3 py-2 text-left flex items-start gap-2 hover:bg-bg-hover/30 transition-colors cursor-pointer"
      >
        <span className="mt-0.5 text-text-tertiary shrink-0">
          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
        <div className="flex-1 min-w-0">
          <span className={cn(
            'text-xs font-medium text-text-primary block',
            compact ? 'truncate' : 'line-clamp-2'
          )}>
            {task.title}
          </span>
          <div className="flex items-center gap-1.5 mt-1">
            <Badge variant="secondary" className={cn('text-[9px] capitalize px-1.5 py-0', PRIORITY_COLORS[task.priority])}>
              {task.priority}
            </Badge>
            {task.category && (
              <Badge
                variant="secondary"
                className={cn('text-[8px] px-1 py-0', CATEGORY_COLORS[task.category] || CATEGORY_COLORS.chore)}
              >
                {CATEGORY_SHORT[task.category] || task.category}
              </Badge>
            )}
            {hasSteps && (
              <span className="text-[9px] text-text-tertiary ml-auto">
                {completedSteps}/{totalSteps}
              </span>
            )}
          </div>
          {hasSteps && (
            <div className="mt-1.5 h-1 bg-bg-tertiary rounded-full overflow-hidden">
              <div
                className="h-full bg-success rounded-full transition-all"
                style={{ width: `${Math.round((completedSteps / totalSteps) * 100)}%` }}
              />
            </div>
          )}
        </div>
      </button>

      {/* Expanded detail */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-2 border-t border-border-subtle/50 pt-2">
              {task.description && (
                <p className="text-[11px] text-text-secondary mb-2 break-words">{task.description}</p>
              )}
              {task.blockedBy && task.blockedBy.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {task.blockedBy.map((dep) => (
                    <Badge key={dep} variant="secondary" className="text-[9px] bg-red-900/40 text-red-300">
                      Blocked by: {dep}
                    </Badge>
                  ))}
                </div>
              )}
              {task.blocks && task.blocks.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {task.blocks.map((dep) => (
                    <Badge key={dep} variant="secondary" className="text-[9px] bg-amber-900/40 text-amber-300">
                      Blocking: {dep}
                    </Badge>
                  ))}
                </div>
              )}
              <div className="text-[10px] text-text-tertiary mb-2">
                Updated {formatDate(task.updatedAt)}
              </div>
              {/* Actions */}
              <div className="flex items-center gap-1 pt-1 border-t border-border-subtle/30">
                {task.filePath && (
                  <button
                    onClick={() => useUIStore.getState().setEditorFilePath(task.filePath!)}
                    className="p-1 text-text-tertiary hover:text-accent transition-colors cursor-pointer"
                    title="Open in editor"
                  >
                    <FileText size={12} />
                  </button>
                )}
                {onSendToTerminal && (
                  <button
                    onClick={() => onSendToTerminal(task)}
                    className="p-1 text-text-tertiary hover:text-accent transition-colors cursor-pointer"
                    title="Send to Claude"
                  >
                    <Send size={12} />
                  </button>
                )}
                {task.status === 'pending' && (
                  <button
                    onClick={() => onUpdateStatus(task.id, 'in_progress')}
                    className="p-1 text-text-tertiary hover:text-accent transition-colors cursor-pointer"
                    title="Start"
                  >
                    <Play size={12} />
                  </button>
                )}
                {task.status === 'in_progress' && (
                  <>
                    <button
                      onClick={() => onUpdateStatus(task.id, 'completed')}
                      className="p-1 text-text-tertiary hover:text-emerald-400 transition-colors cursor-pointer"
                      title="Complete"
                    >
                      <Check size={12} />
                    </button>
                    <button
                      onClick={() => onUpdateStatus(task.id, 'pending')}
                      className="p-1 text-text-tertiary hover:text-amber-400 transition-colors cursor-pointer"
                      title="Pause"
                    >
                      <Pause size={12} />
                    </button>
                  </>
                )}
                {task.status === 'completed' && (
                  <button
                    onClick={() => onUpdateStatus(task.id, 'pending')}
                    className="p-1 text-text-tertiary hover:text-accent transition-colors cursor-pointer"
                    title="Reopen"
                  >
                    <RotateCcw size={12} />
                  </button>
                )}
                <button
                  onClick={() => onRequestDelete(task.id)}
                  className="p-1 text-text-tertiary hover:text-red-400 transition-colors cursor-pointer ml-auto"
                  title="Delete"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Kanban board ─────────────────────────────────────────────────────
interface TaskKanbanProps {
  tasks: Task[];
  onUpdateStatus: (taskId: string, status: Task['status']) => void;
  onSendToTerminal?: (task: Task) => void;
  onRequestDelete: (taskId: string) => void;
  className?: string;
  /** Compact mode stacks columns vertically (sidebar) */
  compact?: boolean;
}

export function TaskKanban({
  tasks,
  onUpdateStatus,
  onSendToTerminal,
  onRequestDelete,
  className,
  compact,
}: TaskKanbanProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [collapsedCols, setCollapsedCols] = useState<Set<string>>(new Set());

  // Derive blocked IDs
  const blockedIds = useMemo(() => {
    const activeIds = new Set(tasks.filter((t) => t.status !== 'completed').map((t) => t.id));
    return new Set(
      tasks.filter((t) => t.blockedBy?.some((id) => activeIds.has(id))).map((t) => t.id)
    );
  }, [tasks]);

  // Group tasks into columns
  const grouped = useMemo(() => {
    const result: Record<string, Task[]> = {};
    for (const col of COLUMNS) {
      result[col.id] = tasks.filter((t) => col.filter(t, blockedIds));
    }
    return result;
  }, [tasks, blockedIds]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const toggleColumn = useCallback((colId: string) => {
    setCollapsedCols((prev) => {
      const next = new Set(prev);
      if (next.has(colId)) next.delete(colId);
      else next.add(colId);
      return next;
    });
  }, []);

  // Compact mode: vertical stacked sections
  if (compact) {
    return (
      <ScrollArea className={cn('flex-1 min-h-0', className)}>
        <div className="flex flex-col gap-1 p-2">
          {COLUMNS.map((col) => {
            const columnTasks = grouped[col.id];
            const isCollapsed = collapsedCols.has(col.id);
            if (columnTasks.length === 0 && col.id === 'blocked') return null;

            return (
              <div key={col.id}>
                {/* Column header */}
                <button
                  onClick={() => toggleColumn(col.id)}
                  className="flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-bg-hover/30 transition-colors cursor-pointer"
                >
                  <span className="text-text-tertiary">
                    {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                  </span>
                  <div className={cn('w-2 h-2 rounded-full', col.dotColor)} />
                  <span className="text-xs font-medium text-text-secondary">{col.label}</span>
                  <span className="text-[10px] text-text-muted ml-auto">
                    {columnTasks.length}
                  </span>
                </button>

                {/* Cards */}
                <AnimatePresence>
                  {!isCollapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden"
                    >
                      <div className="flex flex-col gap-1.5 pl-4 pr-1 py-1">
                        <AnimatePresence mode="popLayout">
                          {columnTasks.map((task) => (
                            <TaskCard
                              key={task.id}
                              task={task}
                              isExpanded={expandedId === task.id}
                              onToggle={() => toggleExpand(task.id)}
                              onUpdateStatus={onUpdateStatus}
                              onSendToTerminal={onSendToTerminal}
                              onRequestDelete={onRequestDelete}
                              compact
                            />
                          ))}
                        </AnimatePresence>
                        {columnTasks.length === 0 && (
                          <div className="text-[10px] text-text-muted py-2 text-center">
                            No tasks
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    );
  }

  // Full view: horizontal columns — all columns always visible
  return (
    <div className={cn('flex gap-3 h-full p-3', className)}>
      {COLUMNS.map((col) => {
        const columnTasks = grouped[col.id];

        return (
          <div
            key={col.id}
            className="flex flex-col min-w-0 flex-1 bg-bg-deep/50 rounded-lg border border-border-subtle/50"
          >
            {/* Column header */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border-subtle/50">
              <div className={cn('w-2.5 h-2.5 rounded-full', col.dotColor)} />
              <span className="text-xs font-medium text-text-primary">{col.label}</span>
              <span className="text-[10px] text-text-muted ml-auto bg-bg-tertiary rounded-full px-1.5 py-0.5">
                {columnTasks.length}
              </span>
            </div>

            {/* Cards */}
            <ScrollArea className="flex-1 min-h-0">
              <div className="flex flex-col gap-2 p-2">
                <AnimatePresence mode="popLayout">
                  {columnTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      isExpanded={expandedId === task.id}
                      onToggle={() => toggleExpand(task.id)}
                      onUpdateStatus={onUpdateStatus}
                      onSendToTerminal={onSendToTerminal}
                      onRequestDelete={onRequestDelete}
                    />
                  ))}
                </AnimatePresence>
                {columnTasks.length === 0 && (
                  <div className="text-xs text-text-muted py-4 text-center">
                    No tasks
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        );
      })}
    </div>
  );
}
