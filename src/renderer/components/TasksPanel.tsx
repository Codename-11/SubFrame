/**
 * TasksPanel — Sub-task management with TanStack Table.
 * Supports filtering, sorting, inline expand, add/edit/delete.
 */

import { useState, useMemo, useCallback, useEffect, useRef, Fragment } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type SortingFn,
} from '@tanstack/react-table';
import { Plus, ArrowUpDown, ArrowUp, ArrowDown, Play, Check, Pause, RotateCcw, Trash2, ChevronDown, ChevronRight, Send, Maximize2, FileText, List, Network, Columns3, X, Copy, Lock, Link, Sparkles, Loader2, Pencil, RefreshCw, ClipboardCopy, Hash, CheckSquare } from 'lucide-react';
import { TaskTimeline } from './TaskTimeline';
import { TaskGraph } from './TaskGraph';
import { TaskKanban } from './TaskKanban';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { ScrollArea } from './ui/scroll-area';
import { Checkbox } from './ui/checkbox';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from './ui/context-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { cn } from '../lib/utils';
import { useTasks } from '../hooks/useTasks';
import { useTerminalStore } from '../stores/useTerminalStore';
import { useProjectStore } from '../stores/useProjectStore';
import { useUIStore, type StatusFilter } from '../stores/useUIStore';
import { typedInvoke } from '../lib/ipc';
import { IPC } from '../../shared/ipcChannels';
import type { Task, TaskStep } from '../../shared/ipcChannels';
import { toast } from 'sonner';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getTransport } from '../lib/transportProvider';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-zinc-600 text-zinc-200',
  in_progress: 'bg-amber-900/60 text-amber-300',
  completed: 'bg-emerald-900/60 text-emerald-300',
};

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-900/60 text-red-300',
  medium: 'bg-amber-900/60 text-amber-300',
  low: 'bg-zinc-700 text-zinc-300',
};

const CATEGORY_COLORS: Record<string, string> = {
  feature: 'bg-violet-900/60 text-violet-300',
  enhancement: 'bg-indigo-900/60 text-indigo-300',
  bug: 'bg-orange-900/60 text-orange-300',
  fix: 'bg-orange-900/60 text-orange-300',
  refactor: 'bg-cyan-900/60 text-cyan-300',
  research: 'bg-pink-900/60 text-pink-300',
  docs: 'bg-blue-900/60 text-blue-300',
  test: 'bg-teal-900/60 text-teal-300',
  chore: 'bg-zinc-700 text-zinc-300',
};

const CATEGORY_SHORT: Record<string, string> = {
  feature: 'Feat',
  enhancement: 'Enh',
  bug: 'Bug',
  fix: 'Fix',
  refactor: 'Refac',
  research: 'Rsrch',
  docs: 'Docs',
  test: 'Test',
  chore: 'Chore',
};

const STATUS_SHORT: Record<string, string> = {
  pending: 'Pend',
  in_progress: 'Active',
  completed: 'Done',
};

const PRIORITY_SHORT: Record<string, string> = {
  high: 'Hi',
  medium: 'Med',
  low: 'Lo',
};

// ─── Task body ↔ markdown conversion (no frontmatter — metadata stays in form fields) ───

const TASK_TEMPLATE = `Describe what this task accomplishes.

## Steps
- [ ] First step
- [ ] Second step
- [ ] Third step

## Acceptance Criteria
Define what "done" looks like.

## Notes
Any additional context or references.`;


function markdownToForm(md: string): {
  description: string;
  steps: TaskStep[];
  acceptanceCriteria: string;
  notes: string;
} {
  const lines = md.split('\n');
  let currentSection: string | null = null;
  let currentLines: string[] = [];
  const descriptionLines: string[] = [];
  const sections = new Map<string, string>();

  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (currentSection) {
        sections.set(currentSection, currentLines.join('\n').trim());
      }
      currentSection = line;
      currentLines = [];
    } else if (currentSection) {
      currentLines.push(line);
    } else {
      descriptionLines.push(line);
    }
  }
  if (currentSection) {
    sections.set(currentSection, currentLines.join('\n').trim());
  }

  const stepsText = sections.get('## Steps') ?? '';
  const steps: TaskStep[] = [];
  const re = /^- \[(x| )\] (.+)$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stepsText)) !== null) {
    steps.push({ completed: m[1] === 'x', label: m[2].trim() });
  }

  return {
    description: descriptionLines.join('\n').trim(),
    steps,
    acceptanceCriteria: sections.get('## Acceptance Criteria') ?? '',
    notes: sections.get('## Notes') ?? '',
  };
}

/** Compact markdown components for inline rendering in task detail rows */
const taskMdComponents: Record<string, React.ComponentType<any>> = {
  p: ({ children, ...props }: any) => <p className="text-text-secondary text-xs mb-1.5 leading-relaxed" {...props}>{children}</p>,
  ul: ({ children, ...props }: any) => <ul className="list-disc pl-4 mb-1.5 text-text-secondary text-xs" {...props}>{children}</ul>,
  ol: ({ children, ...props }: any) => <ol className="list-decimal pl-4 mb-1.5 text-text-secondary text-xs" {...props}>{children}</ol>,
  li: ({ children, ...props }: any) => <li className="mb-0.5" {...props}>{children}</li>,
  strong: ({ children, ...props }: any) => <strong className="text-text-primary font-semibold" {...props}>{children}</strong>,
  em: ({ children, ...props }: any) => <em className="italic" {...props}>{children}</em>,
  code: ({ children, ...props }: any) => <code className="bg-bg-tertiary text-accent px-1 py-0.5 rounded text-[11px] font-mono" {...props}>{children}</code>,
  a: ({ children, href, ...props }: any) => (
    <a href={href} className="text-info hover:underline" onClick={(e: React.MouseEvent) => {
      e.preventDefault();
      if (href) {
        try {
          const url = new URL(href);
          if (['https:', 'http:'].includes(url.protocol)) {
            getTransport().platform.openExternal(href);
          }
        } catch { /* invalid URL — ignore */ }
      }
    }} {...props}>{children}</a>
  ),
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

// Custom sort orderings — ascending puts most important first
const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };
const STATUS_ORDER: Record<string, number> = { in_progress: 0, pending: 1, completed: 2 };

const prioritySortingFn: SortingFn<Task> = (rowA, rowB) => {
  const a = PRIORITY_ORDER[rowA.original.priority] ?? 99;
  const b = PRIORITY_ORDER[rowB.original.priority] ?? 99;
  return a - b;
};

const statusSortingFn: SortingFn<Task> = (rowA, rowB) => {
  const a = STATUS_ORDER[rowA.original.status] ?? 99;
  const b = STATUS_ORDER[rowB.original.status] ?? 99;
  return a - b;
};

/** Renders a sortable column header with directional arrow indicator. */
function SortHeader({ column, label }: { column: { getIsSorted: () => false | 'asc' | 'desc'; toggleSorting: (desc?: boolean, multi?: boolean) => void }; label: string }) {
  const sorted = column.getIsSorted();
  return (
    <button
      onClick={(e) => column.toggleSorting(undefined, e.shiftKey)}
      className="flex items-center gap-1 cursor-pointer"
    >
      {label}
      {sorted === 'asc' ? <ArrowUp size={12} /> : sorted === 'desc' ? <ArrowDown size={12} /> : <ArrowUpDown size={12} className="opacity-50" />}
    </button>
  );
}

const STATUS_FILTERS: { label: string; value: StatusFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Completed', value: 'completed' },
  { label: 'Blocked', value: 'blocked' },
];

/** Moved outside TasksPanel to maintain stable component identity across renders. */
function TaskActions({
  task,
  onUpdateStatus,
  onEdit,
  onRequestDelete,
  onSendToTerminal,
  hasActiveTerminal,
}: {
  task: Task;
  onUpdateStatus: (taskId: string, status: Task['status']) => void;
  onEdit: (task: Task) => void;
  onRequestDelete: (taskId: string) => void;
  onSendToTerminal: (task: Task) => void;
  hasActiveTerminal: boolean;
}) {
  return (
    <div className="flex items-center gap-0.5 flex-wrap">
      <button
        onClick={(e) => { e.stopPropagation(); onEdit(task); }}
        className="p-0.5 text-text-tertiary hover:text-accent transition-colors cursor-pointer"
        title="Edit"
      >
        <Pencil size={11} />
      </button>
      {hasActiveTerminal && (
        <button
          onClick={(e) => { e.stopPropagation(); onSendToTerminal(task); }}
          className="p-0.5 text-text-tertiary hover:text-accent transition-colors cursor-pointer"
          title="Send to Claude"
        >
          <Send size={11} />
        </button>
      )}
      {task.status === 'pending' && (
        <button
          onClick={(e) => { e.stopPropagation(); onUpdateStatus(task.id, 'in_progress'); toast.info('Task started'); }}
          className="p-0.5 text-text-tertiary hover:text-accent transition-colors cursor-pointer"
          title="Start"
        >
          <Play size={11} />
        </button>
      )}
      {task.status === 'in_progress' && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); onUpdateStatus(task.id, 'completed'); toast.success('Task completed'); }}
            className="p-0.5 text-text-tertiary hover:text-emerald-400 transition-colors cursor-pointer"
            title="Complete"
          >
            <Check size={11} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onUpdateStatus(task.id, 'pending'); toast.info('Task paused'); }}
            className="p-0.5 text-text-tertiary hover:text-amber-400 transition-colors cursor-pointer"
            title="Pause"
          >
            <Pause size={11} />
          </button>
        </>
      )}
      {task.status === 'completed' && (
        <button
          onClick={(e) => { e.stopPropagation(); onUpdateStatus(task.id, 'pending'); toast.info('Task reopened'); }}
          className="p-0.5 text-text-tertiary hover:text-accent transition-colors cursor-pointer"
          title="Reopen"
        >
          <RotateCcw size={11} />
        </button>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); onRequestDelete(task.id); }}
        className="p-0.5 text-text-tertiary hover:text-red-400 transition-colors cursor-pointer"
        title="Delete"
      >
        <Trash2 size={11} />
      </button>
    </div>
  );
}

interface TasksPanelProps {
  /** When true, the panel is rendered inside TerminalArea full-view */
  isFullView?: boolean;
}

export function TasksPanel({ isFullView = false }: TasksPanelProps) {
  const { tasks, addTask, updateTask, deleteTask, isLoading, refetch } = useTasks();
  const activeTerminalId = useTerminalStore((s) => s.activeTerminalId);
  const currentProjectPath = useProjectStore((s) => s.currentProjectPath);

  // Sort/filter state from Zustand store — survives panel switches
  const sorting = useUIStore((s) => s.tasksSorting);
  const setSorting = useUIStore((s) => s.setTasksSorting);
  const statusFilter = useUIStore((s) => s.tasksStatusFilter);
  const setTasksStatusFilter = useUIStore((s) => s.setTasksStatusFilter);
  const tasksFilterSetByUser = useUIStore((s) => s.tasksFilterSetByUser);
  const setTasksFilterSetByUser = useUIStore((s) => s.setTasksFilterSetByUser);
  const setFullViewContent = useUIStore((s) => s.setFullViewContent);
  const closeRightPanel = useUIStore((s) => s.closeRightPanel);
  const pendingEnhance = useUIStore((s) => s.pendingEnhance);
  const clearPendingEnhance = useUIStore((s) => s.clearPendingEnhance);

  // TanStack Table passes Updater<SortingState> (value or function) — resolve before setting store
  const handleSortingChange = useCallback(
    (updater: SortingState | ((old: SortingState) => SortingState)) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater;
      setSorting(next);
    },
    [sorting, setSorting]
  );

  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'graph'>('list');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [selectMode, setSelectMode] = useState(false);
  const [bulkSendOpen, setBulkSendOpen] = useState(false);
  const [bulkSendWrapper, setBulkSendWrapper] = useState('');

  // Smart default filter: auto-select the most useful status view
  // Runs when tasks change, but respects explicit user choice
  useEffect(() => {
    if (tasksFilterSetByUser || isLoading || tasks.length === 0) return;
    if (tasks.some((t) => t.status === 'in_progress')) {
      setTasksStatusFilter('in_progress');
    } else if (tasks.some((t) => t.status === 'pending')) {
      setTasksStatusFilter('pending');
    } else {
      setTasksStatusFilter('all');
    }
  }, [tasks, isLoading, tasksFilterSetByUser, setTasksStatusFilter]);

  // Clear row selection and exit select mode when filters or view mode change
  useEffect(() => {
    setRowSelection({});
    setSelectMode(false);
  }, [statusFilter, search, viewMode]);

  // User explicitly clicks a filter → lock their choice
  const handleStatusFilterClick = useCallback(
    (value: StatusFilter) => {
      setTasksStatusFilter(value);
      setTasksFilterSetByUser(true);
    },
    [setTasksStatusFilter, setTasksFilterSetByUser]
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [bulkDeleteIds, setBulkDeleteIds] = useState<string[]>([]);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPriority, setFormPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [formCategory, setFormCategory] = useState('feature');
  const [formStatus, setFormStatus] = useState<'pending' | 'in_progress' | 'completed'>('pending');
  const [formSteps, setFormSteps] = useState<TaskStep[]>([]);
  const [formAcceptanceCriteria, setFormAcceptanceCriteria] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formPrivate, setFormPrivate] = useState(false);
  const [formBlockedBy, setFormBlockedBy] = useState<string[]>([]);
  const [formBlocks, setFormBlocks] = useState<string[]>([]);
  const [blockedBySelect, setBlockedBySelect] = useState('');
  const [blocksSelect, setBlocksSelect] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [enhancing, setEnhancing] = useState(false);

  // Ref tracks dialog state for async callbacks (closures can't see latest useState)
  const dialogOpenRef = useRef(dialogOpen);
  useEffect(() => { dialogOpenRef.current = dialogOpen; }, [dialogOpen]);

  /** Apply enhanced data to form fields */
  const applyEnhancedData = useCallback((e: Record<string, unknown>) => {
    if (e.title) setFormTitle(e.title as string);
    if (e.description) setFormDescription(e.description as string);
    if (e.acceptanceCriteria) { setFormAcceptanceCriteria(e.acceptanceCriteria as string); setShowAdvanced(true); }
    if (e.steps && Array.isArray(e.steps)) setFormSteps(e.steps as TaskStep[]);
    if (e.priority) setFormPriority(e.priority as 'high' | 'medium' | 'low');
    if (e.category) setFormCategory(e.category as string);
  }, []);

  const handleEnhance = useCallback(async () => {
    if (!currentProjectPath || enhancing) return;
    setEnhancing(true);
    // Dismiss any previous enhance toast (prevents stale "View Results" from overlapping)
    toast.dismiss('enhance-result');
    // Clear any previous pending enhance to avoid stale data
    useUIStore.getState().clearPendingEnhance();
    try {
      const result = await typedInvoke(IPC.ENHANCE_TASK, {
        projectPath: currentProjectPath,
        task: {
          title: formTitle,
          description: formDescription,
          priority: formPriority,
          category: formCategory,
        },
      });
      if (result.success && result.enhanced) {
        if (dialogOpenRef.current) {
          // Dialog still open — apply directly
          applyEnhancedData(result.enhanced);
          toast.success('Task enhanced by AI');
        } else {
          // Dialog was closed — store result for later retrieval
          useUIStore.getState().setPendingEnhance({
            enhanced: result.enhanced,
            editingTaskId: editingTask?.id ?? null,
            openRequested: false,
          });
          toast.success('Task enhanced by AI', {
            id: 'enhance-result',
            action: {
              label: 'View Results',
              onClick: () => {
                const store = useUIStore.getState();
                if (store.pendingEnhance) {
                  store.setPendingEnhance({ ...store.pendingEnhance, openRequested: true });
                  // Ensure Tasks panel is mounted so the reopen effect can fire
                  store.setActivePanel('tasks');
                }
              },
            },
            duration: 10_000,
          });
        }
      } else {
        toast.error(result.error || 'AI enhancement failed');
      }
    } catch {
      toast.error('Failed to reach AI tool');
    } finally {
      setEnhancing(false);
    }
  }, [currentProjectPath, enhancing, formTitle, formDescription, formPriority, formCategory, editingTask, applyEnhancedData]);

  // Stable callbacks — mutation refs are stable from useTasks, so no deps needed
  const handleUpdateStatus = useCallback(
    (taskId: string, status: Task['status']) => {
      updateTask.mutate({ taskId, updates: { status } });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const handleRequestDelete = useCallback((taskId: string) => {
    setDeletingTaskId(taskId);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (deletingTaskId) {
      deleteTask.mutate(deletingTaskId);
      toast.success('Sub-task deleted');
    }
    setDeletingTaskId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deletingTaskId]);

  const handleSendToTerminal = useCallback(
    (task: Task) => {
      if (!activeTerminalId) return;
      const steps = task.steps?.length
        ? `\n\nSteps:\n${task.steps.map((s, i) => `${s.completed ? '- [x]' : '- [ ]'} ${s.label}`).join('\n')}`
        : '';
      const prompt = `Task [${task.id}]: ${task.title}\nPriority: ${task.priority || 'medium'} | Category: ${task.category || 'feature'} | Status: ${task.status}\n\nDescription: ${task.description || 'N/A'}\n\nAcceptance Criteria: ${task.acceptanceCriteria || 'N/A'}${steps}`;
      getTransport().send(IPC.TERMINAL_INPUT_ID, { terminalId: activeTerminalId, data: prompt + '\r' });
      // Auto-start the task if it's pending
      if (task.status === 'pending') {
        handleUpdateStatus(task.id, 'in_progress');
      }
      toast.info(task.status === 'pending' ? 'Task started and sent to terminal' : 'Task sent to terminal');
    },
    [activeTerminalId, handleUpdateStatus]
  );

  const handleCopyTitle = useCallback((title: string) => {
    navigator.clipboard.writeText(title).then(
      () => toast.success('Title copied'),
      () => toast.error('Failed to copy')
    );
  }, []);

  const filteredTasks = useMemo(() => {
    let result = tasks;
    if (statusFilter === 'blocked') {
      // Show tasks where blockedBy contains at least one ID matching an incomplete task
      const incompleteIds = new Set(tasks.filter((t) => t.status !== 'completed').map((t) => t.id));
      result = result.filter((t) => t.blockedBy && t.blockedBy.some((id) => incompleteIds.has(id)));
    } else if (statusFilter !== 'all') {
      result = result.filter((t) => t.status === statusFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description && t.description.toLowerCase().includes(q))
      );
    }
    return result;
  }, [tasks, statusFilter, search]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  // Columns no longer depend on expandedId — the expand cell uses the
  // toggleExpand callback and reads expandedId only for rendering the icon
  // via a wrapper that receives it as a prop (see TaskRow below).
  const columns = useMemo<ColumnDef<Task>[]>(() => {
    const cols: ColumnDef<Task>[] = [
      // Select column — only included when selectMode is active
      ...(selectMode ? [{
        id: 'select',
        header: ({ table }: { table: ReturnType<typeof useReactTable<Task>> }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={() => table.toggleAllPageRowsSelected()}
            className="border-border-default data-[state=checked]:bg-accent data-[state=checked]:border-accent"
          />
        ),
        cell: ({ row }: { row: { getIsSelected: () => boolean; toggleSelected: () => void } }) => (
          <div onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={() => row.toggleSelected()}
              className="border-border-default data-[state=checked]:bg-accent data-[state=checked]:border-accent"
            />
          </div>
        ),
        size: 32,
        enableSorting: false,
      } as ColumnDef<Task>] : []),
      {
        id: 'expand',
        header: '',
        cell: () => null, // Rendered manually in TaskRow
        size: 24,
      },
      {
        accessorKey: 'title',
        header: ({ column }) => <SortHeader column={column} label="Title" />,
        cell: ({ row, getValue }) => (
          <span className="text-text-primary font-medium line-clamp-2 leading-tight flex items-center gap-1.5" title={getValue() as string}>
            {row.original.private && <Lock className="w-3 h-3 text-amber-500/70 shrink-0" />}
            {getValue() as string}
          </span>
        ),
        enableMultiSort: true,
        // No explicit size → takes remaining space in table-fixed layout
      },
      {
        accessorKey: 'status',
        header: ({ column }) => <SortHeader column={column} label="Status" />,
        cell: ({ row }) => {
          const status = row.original.status;
          const label = isFullView ? status.replace('_', ' ') : (STATUS_SHORT[status] || status.replace('_', ' '));
          return (
            <span className="flex items-center gap-1 flex-wrap">
              <Badge variant="secondary" className={cn(isFullView ? 'text-[10px]' : 'text-[9px]', 'capitalize whitespace-nowrap', STATUS_COLORS[status])}>
                {label}
              </Badge>
              {row.original.steps?.length > 0 && (
                <span className="text-[10px] text-text-tertiary">
                  {row.original.steps.filter((s) => s.completed).length}/{row.original.steps.length}
                </span>
              )}
            </span>
          );
        },
        sortingFn: statusSortingFn,
        enableMultiSort: true,
        size: isFullView ? 110 : 62,
      },
    ];

    if (isFullView) {
      // Full-view: separate columns for category, priority, updated
      cols.push(
        {
          accessorKey: 'category',
          header: ({ column }) => <SortHeader column={column} label="Cat" />,
          cell: ({ getValue }) => {
            const cat = (getValue() as string) || 'feature';
            return (
              <Badge variant="secondary" className={cn('text-[10px] capitalize whitespace-nowrap', CATEGORY_COLORS[cat] || CATEGORY_COLORS.chore)}>
                {CATEGORY_SHORT[cat] || cat}
              </Badge>
            );
          },
          enableMultiSort: true,
          size: 55,
        },
        {
          accessorKey: 'priority',
          header: ({ column }) => <SortHeader column={column} label="Pri" />,
          cell: ({ getValue }) => {
            const priority = getValue() as string;
            return (
              <Badge variant="secondary" className={cn('text-[10px] capitalize whitespace-nowrap', PRIORITY_COLORS[priority])}>
                {priority}
              </Badge>
            );
          },
          sortingFn: prioritySortingFn,
          enableMultiSort: true,
          size: 55,
        },
        {
          accessorKey: 'updatedAt',
          header: ({ column }) => <SortHeader column={column} label="Updated" />,
          cell: ({ getValue }) => (
            <span className="text-text-tertiary text-xs whitespace-nowrap">{formatDate(getValue() as string)}</span>
          ),
          enableMultiSort: true,
          size: 70,
        },
      );
    } else {
      // Panel mode: separate category + priority columns (sortable)
      cols.push(
        {
          accessorKey: 'category',
          header: ({ column }) => <SortHeader column={column} label="Cat" />,
          cell: ({ getValue }) => {
            const cat = (getValue() as string) || 'feature';
            return (
              <Badge variant="secondary" className={cn('text-[9px] capitalize whitespace-nowrap', CATEGORY_COLORS[cat] || CATEGORY_COLORS.chore)}>
                {CATEGORY_SHORT[cat] || cat}
              </Badge>
            );
          },
          enableMultiSort: true,
          size: 42,
        },
        {
          accessorKey: 'priority',
          header: ({ column }) => <SortHeader column={column} label="Pri" />,
          cell: ({ getValue }) => {
            const priority = getValue() as string;
            return (
              <Badge variant="secondary" className={cn('text-[9px] capitalize whitespace-nowrap', PRIORITY_COLORS[priority])}>
                {PRIORITY_SHORT[priority] || priority}
              </Badge>
            );
          },
          sortingFn: prioritySortingFn,
          enableMultiSort: true,
          size: 42,
        },
      );
    }

    cols.push({
      id: 'actions',
      header: '',
      cell: () => null, // Rendered manually in TaskRow
      size: isFullView ? 80 : 52,
    });

    return cols;
  }, [isFullView, selectMode]);

  const table = useReactTable({
    data: filteredTasks,
    columns,
    state: { sorting, rowSelection },
    onSortingChange: handleSortingChange,
    onRowSelectionChange: setRowSelection,
    enableMultiSort: true,
    enableRowSelection: true,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  // useCallback — stable reference needed by the pendingEnhance reopen effect
  const openAddDialog = useCallback(() => {
    setEditingTask(null);
    setFormTitle('');
    setFormDescription('');
    setFormPriority('medium');
    setFormCategory('feature');
    setFormStatus('pending');
    setFormSteps([]);
    setFormAcceptanceCriteria('');
    setFormNotes('');
    setFormPrivate(false);
    setFormBlockedBy([]);
    setFormBlocks([]);
    setBlockedBySelect('');
    setBlocksSelect('');
    setShowAdvanced(false);
    setDialogOpen(true);
  }, []);

  // React 18 batches all these setState calls into a single render
  const openEditDialog = useCallback((task: Task) => {
    setEditingTask(task);
    setFormTitle(task.title);
    setFormDescription(task.description || '');
    setFormPriority(task.priority);
    setFormCategory(task.category || 'feature');
    setFormStatus(task.status);
    setFormSteps(task.steps?.map((s) => ({ ...s })) || []);
    setFormAcceptanceCriteria(task.acceptanceCriteria || '');
    setFormNotes(task.notes || '');
    setFormPrivate(!!task.private);
    setFormBlockedBy(task.blockedBy ?? []);
    setFormBlocks(task.blocks ?? []);
    setBlockedBySelect('');
    setBlocksSelect('');
    setShowAdvanced(!!(task.acceptanceCriteria || task.notes || task.blockedBy?.length || task.blocks?.length));
    setDialogOpen(true);
  }, []);

  // Re-open dialog with enhanced data when "View Results" toast action is clicked
  useEffect(() => {
    if (!pendingEnhance?.openRequested) return;
    const { enhanced, editingTaskId } = pendingEnhance;

    // If it was an edit, restore the task context
    if (editingTaskId) {
      const task = tasks.find((t) => t.id === editingTaskId);
      if (task) {
        openEditDialog(task);
      } else {
        // Task not found (deleted?) — fall back to add dialog
        openAddDialog();
      }
    } else {
      openAddDialog();
    }

    // Apply enhanced fields on top of the base form + clear pending
    // setTimeout(0) ensures the dialog opens (setState batch) before fields overwrite
    setTimeout(() => {
      applyEnhancedData(enhanced);
      clearPendingEnhance();
    }, 0);
  }, [pendingEnhance, tasks, openAddDialog, openEditDialog, applyEnhancedData, clearPendingEnhance]);

  function handleSubmit() {
    if (!formTitle.trim()) return;

    const data: Record<string, unknown> = {
      title: formTitle.trim(),
      description: formDescription.trim(),
      priority: formPriority,
      category: formCategory,
      status: formStatus,
      steps: formSteps.filter((s) => s.label.trim()),
      acceptanceCriteria: formAcceptanceCriteria.trim() || undefined,
      notes: formNotes.trim() || undefined,
      private: formPrivate || undefined,
      blockedBy: formBlockedBy.length ? formBlockedBy : undefined,
      blocks: formBlocks.length ? formBlocks : undefined,
    };

    if (editingTask) {
      updateTask.mutate({ taskId: editingTask.id, updates: data });
      toast.success('Sub-task updated');
    } else {
      addTask.mutate(data);
      toast.success('Sub-task created');
    }
    setDialogOpen(false);
    // Discard any stale pending enhance result
    clearPendingEnhance();
  }


  function handleApplyTemplate() {
    const parsed = markdownToForm(TASK_TEMPLATE);
    setFormDescription(parsed.description);
    setFormSteps(parsed.steps);
    setFormAcceptanceCriteria(parsed.acceptanceCriteria);
    setFormNotes(parsed.notes);
  }

  return (
    <div className={cn('flex flex-col h-full min-w-0', isFullView && 'px-4')}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border-subtle shrink-0">
        <Input
          placeholder="Search tasks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-7 text-xs bg-bg-deep border-border-subtle flex-1 min-w-0"
        />
        {/* View mode toggle — available in both sidebar and full-view */}
        <div className="flex gap-0.5 shrink-0 bg-bg-deep rounded-md p-0.5">
          <button
            onClick={() => setViewMode('list')}
            className={cn(
              'p-1 rounded transition-colors cursor-pointer',
              viewMode === 'list' ? 'bg-accent/20 text-accent' : 'text-text-tertiary hover:text-text-primary'
            )}
            title="List view"
          >
            <List size={14} />
          </button>
          <button
            onClick={() => setViewMode('kanban')}
            className={cn(
              'p-1 rounded transition-colors cursor-pointer',
              viewMode === 'kanban' ? 'bg-accent/20 text-accent' : 'text-text-tertiary hover:text-text-primary'
            )}
            title="Kanban board"
          >
            <Columns3 size={14} />
          </button>
          <button
            onClick={() => setViewMode('graph')}
            className={cn(
              'p-1 rounded transition-colors cursor-pointer',
              viewMode === 'graph' ? 'bg-accent/20 text-accent' : 'text-text-tertiary hover:text-text-primary'
            )}
            title="Dependency graph"
          >
            <Network size={14} />
          </button>
        </div>
        {viewMode === 'list' && (
          <button
            onClick={() => {
              setSelectMode((v) => !v);
              if (selectMode) setRowSelection({});
            }}
            className={cn(
              'p-1 rounded transition-colors cursor-pointer',
              selectMode ? 'bg-accent/20 text-accent' : 'text-text-tertiary hover:text-text-primary'
            )}
            title={selectMode ? 'Exit select mode' : 'Select tasks'}
          >
            <CheckSquare size={14} />
          </button>
        )}
        {!isFullView && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => { closeRightPanel(); setFullViewContent('tasks'); }}
            className="h-7 px-2 text-text-tertiary hover:text-accent cursor-pointer shrink-0"
            title="Open full view"
          >
            <Maximize2 size={14} />
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={refetch} className="h-7 px-2 text-text-tertiary hover:text-accent cursor-pointer shrink-0" title="Refresh tasks">
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
        </Button>
        <Button size="sm" variant="ghost" onClick={openAddDialog} className="h-7 px-2 text-accent cursor-pointer shrink-0">
          <Plus size={14} />
        </Button>
      </div>

      {/* Status filters */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border-subtle shrink-0">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => handleStatusFilterClick(f.value)}
            className={cn(
              'px-2 py-0.5 rounded text-xs transition-colors cursor-pointer whitespace-nowrap',
              statusFilter === f.value
                ? 'bg-accent/20 text-accent'
                : 'text-text-secondary hover:text-text-primary'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Graph view */}
      {viewMode === 'graph' ? (
        <div className="flex-1 min-h-0">
          <TaskGraph
            tasks={tasks}
            onSelectTask={(taskId) => {
              setExpandedId(expandedId === taskId ? null : taskId);
            }}
            compact={!isFullView}
          />
        </div>
      ) : viewMode === 'kanban' ? (
        /* Kanban view — always receives all tasks; kanban does its own status grouping */
        <TaskKanban
          tasks={tasks}
          onUpdateStatus={handleUpdateStatus}
          onEdit={openEditDialog}
          onSendToTerminal={activeTerminalId ? handleSendToTerminal : undefined}
          onRequestDelete={handleRequestDelete}
          compact={!isFullView}
        />
      ) : (
      /* Table (list view) */
      <ScrollArea className="flex-1 min-h-0">
        {isLoading && filteredTasks.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-text-tertiary text-sm">
            Loading tasks...
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-text-tertiary text-sm gap-1">
            <span>No sub-tasks found</span>
            <span className="text-xs opacity-60">Sub-tasks will appear here when added</span>
          </div>
        ) : (
          <Fragment>
            {Object.keys(rowSelection).length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-accent/10 border border-accent/20 rounded-md mb-2">
              <span className="text-xs text-text-secondary">
                {Object.keys(rowSelection).length} selected
              </span>
              <div className="flex-1" />
              {activeTerminalId && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[10px] text-accent hover:bg-accent/10"
                  onClick={() => {
                    setBulkSendWrapper('');
                    setBulkSendOpen(true);
                  }}
                >
                  <Send className="w-3 h-3 mr-1" />
                  Send to Terminal
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px] text-success hover:bg-success/10"
                onClick={() => {
                  const ids = Object.keys(rowSelection);
                  ids.forEach((id) => handleUpdateStatus(id, 'completed'));
                  setRowSelection({});
                  toast.success(`${ids.length} task(s) completed`);
                }}
              >
                <Check className="w-3 h-3 mr-1" />
                Complete
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px] text-error hover:bg-error/10"
                onClick={() => {
                  setBulkDeleteIds(Object.keys(rowSelection));
                }}
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Delete
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px] text-text-tertiary hover:bg-bg-hover"
                onClick={() => setRowSelection({})}
              >
                Clear
              </Button>
            </div>
          )}
          <table className="w-full table-auto">
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id} className="border-b border-border-subtle">
                    {hg.headers.map((header) => (
                      <th
                        key={header.id}
                        className={cn(
                          'py-1.5 text-left text-[10px] uppercase tracking-wider text-text-tertiary font-medium',
                          isFullView ? 'px-2' : 'px-1.5',
                        )}
                        style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                      >
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <Fragment key={row.id}>
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <tr className="border-b border-border-subtle/50 hover:bg-bg-hover/30 transition-colors">
                          {row.getVisibleCells().map((cell) => {
                            const cellPx = isFullView ? 'px-2' : 'px-1.5';
                            if (cell.column.id === 'expand') {
                              return (
                                <td key={cell.id} className={cn(cellPx, 'py-2 text-xs')}>
                                  <button
                                    onClick={() => toggleExpand(row.original.id)}
                                    className="p-0.5 text-text-tertiary hover:text-text-primary cursor-pointer"
                                  >
                                    {expandedId === row.original.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                  </button>
                                </td>
                              );
                            }
                            if (cell.column.id === 'actions') {
                              return (
                                <td key={cell.id} className={cn(cellPx, 'py-2 text-xs')}>
                                  <TaskActions
                                    task={row.original}
                                    onUpdateStatus={handleUpdateStatus}
                                    onEdit={openEditDialog}
                                    onRequestDelete={handleRequestDelete}
                                    onSendToTerminal={handleSendToTerminal}
                                    hasActiveTerminal={!!activeTerminalId}
                                  />
                                </td>
                              );
                            }
                            return (
                              <td key={cell.id} className={cn(cellPx, 'py-2 text-xs overflow-hidden')}>
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </td>
                            );
                          })}
                        </tr>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="bg-bg-elevated border-border-subtle">
                        <ContextMenuItem
                          onClick={() => handleCopyTitle(row.original.title)}
                          className="text-xs gap-2"
                        >
                          <ClipboardCopy className="w-3.5 h-3.5" />
                          Copy Title
                        </ContextMenuItem>
                        <ContextMenuItem
                          onClick={() => {
                            navigator.clipboard.writeText(row.original.id).then(
                              () => toast.success('Task ID copied'),
                              () => toast.error('Failed to copy')
                            );
                          }}
                          className="text-xs gap-2"
                        >
                          <Hash className="w-3.5 h-3.5" />
                          Copy ID
                        </ContextMenuItem>
                        {activeTerminalId && (
                          <ContextMenuItem
                            onClick={() => handleSendToTerminal(row.original)}
                            className="text-xs gap-2"
                          >
                            <Send className="w-3.5 h-3.5" />
                            Send to Terminal
                          </ContextMenuItem>
                        )}
                        <ContextMenuSeparator />
                        {row.original.status === 'pending' && (
                          <ContextMenuItem
                            onClick={() => { handleUpdateStatus(row.original.id, 'in_progress'); toast.info('Task started'); }}
                            className="text-xs gap-2"
                          >
                            <Play className="w-3.5 h-3.5" />
                            Start
                          </ContextMenuItem>
                        )}
                        {row.original.status === 'in_progress' && (
                          <>
                            <ContextMenuItem
                              onClick={() => { handleUpdateStatus(row.original.id, 'completed'); toast.success('Task completed'); }}
                              className="text-xs gap-2"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Complete
                            </ContextMenuItem>
                            <ContextMenuItem
                              onClick={() => { handleUpdateStatus(row.original.id, 'pending'); toast.info('Task paused'); }}
                              className="text-xs gap-2"
                            >
                              <Pause className="w-3.5 h-3.5" />
                              Pause
                            </ContextMenuItem>
                          </>
                        )}
                        {row.original.status === 'completed' && (
                          <ContextMenuItem
                            onClick={() => { handleUpdateStatus(row.original.id, 'pending'); toast.info('Task reopened'); }}
                            className="text-xs gap-2"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Reopen
                          </ContextMenuItem>
                        )}
                        <ContextMenuItem
                          onClick={() => openEditDialog(row.original)}
                          className="text-xs gap-2"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Edit
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem
                          onClick={() => handleRequestDelete(row.original.id)}
                          variant="destructive"
                          className="text-xs gap-2"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                    {expandedId === row.original.id && (
                      <tr>
                        <td colSpan={columns.length} className="px-4 py-3 bg-bg-deep/50">
                          <TaskDetail task={row.original} updateTask={updateTask} allTasks={tasks} isFullView={isFullView} onEdit={openEditDialog} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </Fragment>
        )}
      </ScrollArea>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingTaskId} onOpenChange={(open) => { if (!open) setDeletingTaskId(null); }}>
        <AlertDialogContent className="bg-bg-primary border-border-subtle text-text-primary" size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Delete sub-task?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-text-secondary">
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel variant="ghost" size="sm" className="cursor-pointer">Cancel</AlertDialogCancel>
            <AlertDialogAction variant="default" size="sm" onClick={handleConfirmDelete} className="bg-error hover:bg-error/80 cursor-pointer">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={bulkDeleteIds.length > 0} onOpenChange={(open) => { if (!open) setBulkDeleteIds([]); }}>
        <AlertDialogContent className="bg-bg-primary border-border-subtle text-text-primary" size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Delete {bulkDeleteIds.length} sub-tasks?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-text-secondary">
              This will permanently delete {bulkDeleteIds.length} task(s). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel variant="ghost" size="sm" className="cursor-pointer">Cancel</AlertDialogCancel>
            <AlertDialogAction variant="default" size="sm" className="bg-error hover:bg-error/80 cursor-pointer" onClick={() => {
              bulkDeleteIds.forEach((id) => deleteTask.mutate(id));
              setRowSelection({});
              setBulkDeleteIds([]);
              toast.success(`${bulkDeleteIds.length} task(s) deleted`);
            }}>
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Send to Terminal Dialog */}
      <Dialog open={bulkSendOpen} onOpenChange={setBulkSendOpen}>
        <DialogContent className="bg-bg-primary border-border-subtle text-text-primary sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="text-sm">Send {Object.keys(rowSelection).length} Tasks to Terminal</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-text-secondary mb-1 block">Wrapper prompt (optional)</label>
              <textarea
                value={bulkSendWrapper}
                onChange={(e) => setBulkSendWrapper(e.target.value)}
                placeholder="e.g. Work through these tasks in order, starting each one before moving to the next..."
                rows={3}
                className="w-full px-3 py-2 text-xs font-mono rounded-md bg-bg-deep border border-border-subtle text-text-primary outline-none focus:border-accent resize-y"
              />
            </div>
            <div className="text-[10px] text-text-muted">
              {Object.keys(rowSelection).length} task(s) will be sent with their ID, title, description, and steps.
              {Object.keys(rowSelection).some((id) => {
                const t = tasks.find((t) => t.id === id);
                return t?.status === 'pending';
              }) && ' Pending tasks will be auto-started.'}
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" size="sm" className="cursor-pointer">Cancel</Button>
            </DialogClose>
            <Button
              size="sm"
              className="bg-accent text-bg-deep hover:bg-accent/80 cursor-pointer"
              onClick={() => {
                if (!activeTerminalId) return;
                const ids = Object.keys(rowSelection);
                const selectedTasks = ids
                  .map((id) => tasks.find((t) => t.id === id))
                  .filter(Boolean) as Task[];

                // Build combined prompt
                const taskBlocks = selectedTasks.map((task) => {
                  const steps = task.steps?.length
                    ? `\nSteps:\n${task.steps.map((s) => `${s.completed ? '- [x]' : '- [ ]'} ${s.label}`).join('\n')}`
                    : '';
                  return `---\nTask [${task.id}]: ${task.title}\nPriority: ${task.priority || 'medium'} | Category: ${task.category || 'feature'} | Status: ${task.status}\n\nDescription: ${task.description || 'N/A'}\n\nAcceptance Criteria: ${task.acceptanceCriteria || 'N/A'}${steps}`;
                }).join('\n\n');

                const wrapper = bulkSendWrapper.trim();
                const prompt = wrapper
                  ? `${wrapper}\n\n${taskBlocks}`
                  : `Here are ${selectedTasks.length} tasks to work on:\n\n${taskBlocks}`;

                getTransport().send(IPC.TERMINAL_INPUT_ID, { terminalId: activeTerminalId, data: prompt + '\r' });

                // Auto-start pending tasks
                selectedTasks.forEach((task) => {
                  if (task.status === 'pending') {
                    handleUpdateStatus(task.id, 'in_progress');
                  }
                });

                setRowSelection({});
                setSelectMode(false);
                setBulkSendOpen(false);
                toast.info(`${selectedTasks.length} task(s) sent to terminal`);
              }}
            >
              <Send className="w-3 h-3 mr-1" />
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        // Prevent accidental close while AI enhance is running
        if (!open && enhancing) {
          toast.info('AI enhancement in progress — close will continue in background');
        }
        setDialogOpen(open);
      }}>
        <DialogContent
          className="bg-bg-primary border-border-subtle text-text-primary sm:max-w-lg max-h-[85vh] !flex !flex-col overflow-hidden"
          aria-describedby={undefined}
        >
          <DialogHeader className="shrink-0">
            <div className="flex items-center justify-between gap-2">
              <DialogTitle>{editingTask ? 'Edit Sub-Task' : 'Add Sub-Task'}</DialogTitle>
              <div className="flex items-center gap-2 shrink-0">
                {/* Template quick-fill (only for new / empty tasks) */}
                {!editingTask && !formDescription && formSteps.length === 0 && (
                  <button
                    onClick={handleApplyTemplate}
                    className="px-2 py-0.5 text-[11px] text-text-tertiary hover:text-accent border border-border-subtle rounded transition-colors cursor-pointer"
                  >
                    From Template
                  </button>
                )}
                {/* AI Enhance */}
                {formTitle.trim() && (
                  <button
                    onClick={handleEnhance}
                    disabled={enhancing}
                    className="flex items-center gap-1 px-2 py-0.5 text-[11px] text-text-tertiary hover:text-info border border-border-subtle rounded transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-wait"
                    title="Use AI to improve task scope and add steps"
                  >
                    {enhancing ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                    Enhance
                  </button>
                )}
                {/* Open in code editor */}
                {editingTask?.filePath && (
                  <button
                    onClick={() => {
                      useUIStore.getState().setEditorFilePath(editingTask.filePath!);
                      setDialogOpen(false);
                    }}
                    className="flex items-center gap-1 px-2 py-0.5 text-[11px] text-text-tertiary hover:text-accent border border-border-subtle rounded transition-colors cursor-pointer"
                    title="Open task file in code editor"
                  >
                    <FileText size={11} />
                    Editor
                  </button>
                )}
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
          <div className="flex flex-col gap-3 py-2">
            {/* Title — always shown */}
            <div>
              <label className="text-xs text-text-secondary mb-1 block">Title</label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Task title"
                className="bg-bg-deep border-border-subtle text-sm"
                autoFocus
              />
            </div>

            {/* Description */}
                <div>
                  <label className="text-xs text-text-secondary mb-1 block">Description</label>
                  <textarea
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Task description (supports markdown)"
                    rows={3}
                    className="w-full rounded-md bg-bg-deep border border-border-subtle px-3 py-2 text-sm text-text-primary resize-y focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>

                {/* Steps / Checklist editor */}
                <div>
                  <label className="text-xs text-text-secondary mb-1 block">Steps / Checklist</label>
                  {formSteps.length > 0 && (
                    <div className="flex flex-col gap-1.5 mb-2">
                      {formSteps.map((step, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <input
                            type="checkbox"
                            checked={step.completed}
                            onChange={() => {
                              const next = formSteps.map((s, idx) => idx === i ? { ...s, completed: !s.completed } : s);
                              setFormSteps(next);
                            }}
                            className="shrink-0 accent-accent cursor-pointer"
                          />
                          <Input
                            value={step.label}
                            onChange={(e) => {
                              const next = formSteps.map((s, idx) => idx === i ? { ...s, label: e.target.value } : s);
                              setFormSteps(next);
                            }}
                            placeholder="Step description"
                            className="bg-bg-deep border-border-subtle text-xs h-7 flex-1"
                          />
                          <button
                            onClick={() => {
                              if (i === 0) return;
                              const next = [...formSteps];
                              [next[i - 1], next[i]] = [next[i], next[i - 1]];
                              setFormSteps(next);
                            }}
                            disabled={i === 0}
                            className="p-0.5 text-text-tertiary hover:text-text-primary disabled:opacity-30 cursor-pointer disabled:cursor-default transition-colors"
                            title="Move up"
                          >
                            <ArrowUp size={12} />
                          </button>
                          <button
                            onClick={() => {
                              if (i === formSteps.length - 1) return;
                              const next = [...formSteps];
                              [next[i], next[i + 1]] = [next[i + 1], next[i]];
                              setFormSteps(next);
                            }}
                            disabled={i === formSteps.length - 1}
                            className="p-0.5 text-text-tertiary hover:text-text-primary disabled:opacity-30 cursor-pointer disabled:cursor-default transition-colors"
                            title="Move down"
                          >
                            <ArrowDown size={12} />
                          </button>
                          <button
                            onClick={() => setFormSteps(formSteps.filter((_, idx) => idx !== i))}
                            className="p-0.5 text-text-tertiary hover:text-red-400 cursor-pointer transition-colors"
                            title="Remove step"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => setFormSteps([...formSteps, { label: '', completed: false }])}
                    className="flex items-center gap-1 text-xs text-text-tertiary hover:text-accent transition-colors cursor-pointer"
                  >
                    <Plus size={12} /> Add step
                  </button>
                </div>

                {/* Advanced section — collapsible */}
                <div>
                  <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex items-center gap-1 text-xs text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer"
                  >
                    {showAdvanced ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    Advanced
                  </button>
                  {showAdvanced && (
                    <div className="flex flex-col gap-3 mt-2 pl-3 border-l border-border-subtle">
                      <div>
                        <label className="text-xs text-text-secondary mb-1 block">Acceptance Criteria</label>
                        <textarea
                          value={formAcceptanceCriteria}
                          onChange={(e) => setFormAcceptanceCriteria(e.target.value)}
                          placeholder="Define what 'done' looks like"
                          rows={2}
                          className="w-full rounded-md bg-bg-deep border border-border-subtle px-3 py-2 text-sm text-text-primary resize-y focus:outline-none focus:ring-1 focus:ring-accent"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-text-secondary mb-1 block">Notes</label>
                        <textarea
                          value={formNotes}
                          onChange={(e) => setFormNotes(e.target.value)}
                          placeholder="Additional context or references"
                          rows={2}
                          className="w-full rounded-md bg-bg-deep border border-border-subtle px-3 py-2 text-sm text-text-primary resize-y focus:outline-none focus:ring-1 focus:ring-accent"
                        />
                      </div>

                      {/* Dependencies — Blocked By */}
                      <div>
                        <label className="text-xs text-text-secondary mb-1 block">Blocked By</label>
                        {formBlockedBy.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-1.5">
                            {formBlockedBy.map((depId) => {
                              const depTask = tasks.find((t) => t.id === depId);
                              return (
                                <span
                                  key={depId}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-red-900/40 text-red-300"
                                >
                                  <Lock size={10} />
                                  <span className="truncate max-w-[140px]">{depTask?.title ?? depId}</span>
                                  <button
                                    type="button"
                                    onClick={() => setFormBlockedBy(formBlockedBy.filter((id) => id !== depId))}
                                    className="hover:text-red-100 cursor-pointer"
                                  >
                                    <X size={10} />
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        )}
                        <div className="flex gap-1.5">
                          <select
                            value={blockedBySelect}
                            onChange={(e) => setBlockedBySelect(e.target.value)}
                            className="flex-1 rounded-md bg-bg-deep border border-border-subtle px-2 py-1 text-xs text-text-primary"
                          >
                            <option value="" disabled>Select a task...</option>
                            {tasks
                              .filter((t) => t.id !== editingTask?.id && !formBlockedBy.includes(t.id))
                              .map((t) => (
                                <option key={t.id} value={t.id}>{t.title}</option>
                              ))}
                          </select>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-xs cursor-pointer"
                            onClick={() => {
                              if (blockedBySelect) {
                                setFormBlockedBy([...formBlockedBy, blockedBySelect]);
                                setBlockedBySelect('');
                              }
                            }}
                          >
                            <Plus size={10} />
                          </Button>
                        </div>
                      </div>

                      {/* Dependencies — Blocks */}
                      <div>
                        <label className="text-xs text-text-secondary mb-1 block">Blocks</label>
                        {formBlocks.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-1.5">
                            {formBlocks.map((depId) => {
                              const depTask = tasks.find((t) => t.id === depId);
                              return (
                                <span
                                  key={depId}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-amber-900/40 text-amber-300"
                                >
                                  <Link size={10} />
                                  <span className="truncate max-w-[140px]">{depTask?.title ?? depId}</span>
                                  <button
                                    type="button"
                                    onClick={() => setFormBlocks(formBlocks.filter((id) => id !== depId))}
                                    className="hover:text-amber-100 cursor-pointer"
                                  >
                                    <X size={10} />
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        )}
                        <div className="flex gap-1.5">
                          <select
                            value={blocksSelect}
                            onChange={(e) => setBlocksSelect(e.target.value)}
                            className="flex-1 rounded-md bg-bg-deep border border-border-subtle px-2 py-1 text-xs text-text-primary"
                          >
                            <option value="" disabled>Select a task...</option>
                            {tasks
                              .filter((t) => t.id !== editingTask?.id && !formBlocks.includes(t.id))
                              .map((t) => (
                                <option key={t.id} value={t.id}>{t.title}</option>
                              ))}
                          </select>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-xs cursor-pointer"
                            onClick={() => {
                              if (blocksSelect) {
                                setFormBlocks([...formBlocks, blocksSelect]);
                                setBlocksSelect('');
                              }
                            }}
                          >
                            <Plus size={10} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

            {/* Priority / Category — always shown */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs text-text-secondary mb-1 block">Priority</label>
                <select
                  value={formPriority}
                  onChange={(e) => setFormPriority(e.target.value as 'high' | 'medium' | 'low')}
                  className="w-full rounded-md bg-bg-deep border border-border-subtle px-3 py-1.5 text-sm text-text-primary"
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="text-xs text-text-secondary mb-1 block">Category</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full rounded-md bg-bg-deep border border-border-subtle px-3 py-1.5 text-sm text-text-primary"
                >
                  <option value="feature">Feature</option>
                  <option value="enhancement">Enhancement</option>
                  <option value="bug">Bug</option>
                  <option value="refactor">Refactor</option>
                  <option value="research">Research</option>
                  <option value="docs">Docs</option>
                  <option value="test">Test</option>
                  <option value="chore">Chore</option>
                </select>
              </div>
            </div>
            {editingTask && (
              <div>
                <label className="text-xs text-text-secondary mb-1 block">Status</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as Task['status'])}
                  className="w-full rounded-md bg-bg-deep border border-border-subtle px-3 py-1.5 text-sm text-text-primary"
                >
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            )}

            {/* Private toggle */}
            <label className="flex items-center gap-2 cursor-pointer select-none group">
              <div
                role="checkbox"
                aria-checked={formPrivate}
                tabIndex={0}
                onClick={() => setFormPrivate(!formPrivate)}
                onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setFormPrivate(!formPrivate); } }}
                className={cn(
                  'w-4 h-4 rounded border flex items-center justify-center transition-colors',
                  formPrivate
                    ? 'bg-amber-600/80 border-amber-500'
                    : 'bg-bg-deep border-border-subtle group-hover:border-border-default'
                )}
              >
                {formPrivate && <Lock className="w-2.5 h-2.5 text-white" />}
              </div>
              <span className="text-xs text-text-secondary">Private <span className="text-text-muted">(local only, excluded from git)</span></span>
            </label>
          </div>
          </div>

          <DialogFooter className="shrink-0">
            <DialogClose asChild>
              <Button variant="ghost" className="cursor-pointer">Cancel</Button>
            </DialogClose>
            <Button onClick={handleSubmit} disabled={!formTitle.trim() || enhancing} className="bg-accent text-bg-deep hover:bg-accent/80 cursor-pointer">
              {editingTask ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TaskDetail({ task, updateTask, allTasks, isFullView = false, onEdit }: { task: Task; updateTask: { mutate: (vars: { taskId: string; updates: Partial<Task> }) => void }; allTasks: Task[]; isFullView?: boolean; onEdit?: (task: Task) => void }) {
  const steps = task.steps ?? [];
  const completedSteps = steps.filter((s) => s.completed).length;
  const totalSteps = steps.length;
  const progressPercent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  function resolveTaskTitle(id: string): string {
    const found = allTasks.find((t) => t.id === id);
    return found ? found.title : id;
  }

  function handleCopyId(): void {
    navigator.clipboard.writeText(task.id);
    toast.success('Task ID copied');
  }

  return (
    <div className="flex flex-col gap-2.5 text-xs">
      {/* ID header + actions */}
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-[10px] text-text-muted select-all">{task.id}</span>
        <button
          onClick={handleCopyId}
          className="text-text-muted hover:text-text-secondary transition-colors p-0.5 rounded hover:bg-bg-tertiary cursor-pointer"
          title="Copy task ID"
        >
          <Copy className="w-3 h-3" />
        </button>
        {onEdit && (
          <button
            onClick={() => onEdit(task)}
            className="text-text-muted hover:text-accent transition-colors p-0.5 rounded hover:bg-bg-tertiary cursor-pointer"
            title="Edit task"
          >
            <Pencil className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Metadata badges — inline in panel mode, in sidebar card in full-view */}
      {!isFullView && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className={cn('text-[10px] capitalize', STATUS_COLORS[task.status])}>
            {task.status.replace('_', ' ')}
          </Badge>
          <Badge variant="secondary" className={cn('text-[10px] capitalize', PRIORITY_COLORS[task.priority])}>
            {task.priority}
          </Badge>
          {task.category && (
            <Badge variant="secondary" className={cn('text-[10px] capitalize', CATEGORY_COLORS[task.category] || CATEGORY_COLORS.chore)}>
              {task.category}
            </Badge>
          )}
          <span className="text-text-muted text-[10px] ml-auto">
            Updated: {formatDate(task.updatedAt)}
          </span>
        </div>
      )}

      {/* Content: single column in panel, two-column in full-view */}
      <div className={isFullView ? 'grid grid-cols-[1fr_220px] gap-3' : 'flex flex-col gap-2'}>
        {/* Content column */}
        <div className="flex flex-col gap-2 min-w-0">
          {task.userRequest && (
            <div className="break-words">
              <span className="text-text-tertiary font-medium block mb-0.5">User Request</span>
              <div className="border-l-2 border-accent/50 pl-2.5 py-1 bg-bg-tertiary/30 rounded-r">
                <Markdown remarkPlugins={[remarkGfm]} components={taskMdComponents}>
                  {task.userRequest}
                </Markdown>
              </div>
            </div>
          )}
          {task.description && (
            <div className="break-words">
              <span className="text-text-tertiary font-medium block mb-0.5">Description</span>
              <Markdown remarkPlugins={[remarkGfm]} components={taskMdComponents}>
                {task.description}
              </Markdown>
            </div>
          )}
          {task.acceptanceCriteria && (
            <div className="break-words">
              <span className="text-text-tertiary font-medium block mb-0.5">Acceptance Criteria</span>
              <Markdown remarkPlugins={[remarkGfm]} components={taskMdComponents}>
                {task.acceptanceCriteria}
              </Markdown>
            </div>
          )}
          {task.notes && (
            <div className="break-words">
              <span className="text-text-tertiary font-medium block mb-0.5">Notes</span>
              <Markdown remarkPlugins={[remarkGfm]} components={taskMdComponents}>
                {task.notes}
              </Markdown>
            </div>
          )}

          {/* Dependencies */}
          {((task.blockedBy && task.blockedBy.length > 0) || (task.blocks && task.blocks.length > 0)) && (
            <div className="flex flex-col gap-1">
              <span className="text-text-tertiary font-medium">Dependencies</span>
              <div className="flex flex-wrap gap-1">
                {task.blockedBy?.map((dep) => (
                  <Badge key={dep} variant="secondary" className="text-[10px] bg-red-900/40 text-red-300 gap-1">
                    <Lock className="w-2.5 h-2.5" />
                    Blocked by: {resolveTaskTitle(dep)}
                  </Badge>
                ))}
                {task.blocks?.map((dep) => (
                  <Badge key={dep} variant="secondary" className="text-[10px] bg-amber-900/40 text-amber-300 gap-1">
                    <Link className="w-2.5 h-2.5" />
                    Blocking: {resolveTaskTitle(dep)}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Step progress bar + timeline */}
          {totalSteps > 0 && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="text-text-tertiary font-medium">Steps</span>
                <span className="text-text-muted text-[10px]">
                  {completedSteps}/{totalSteps} completed ({progressPercent}%)
                </span>
              </div>
              <div className="h-1.5 w-full bg-bg-tertiary rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-300',
                    progressPercent === 100 ? 'bg-emerald-500' : 'bg-accent'
                  )}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <TaskTimeline
                steps={steps}
                onToggleStep={(index) => {
                  const newSteps = steps.map((s, i) => i === index ? { ...s, completed: !s.completed } : s);
                  updateTask.mutate({ taskId: task.id, updates: { steps: newSteps } });
                }}
              />
            </div>
          )}
        </div>

        {/* Right column — metadata card (full-view only, panel mode shows inline badges above) */}
        {isFullView && (
          <div className="flex flex-col gap-2 rounded border border-border-subtle bg-bg-secondary/50 p-2.5 h-fit">
            <div className="flex flex-wrap gap-1">
              <Badge variant="secondary" className={cn('text-[10px] capitalize', STATUS_COLORS[task.status])}>
                {task.status.replace('_', ' ')}
              </Badge>
              <Badge variant="secondary" className={cn('text-[10px] capitalize', PRIORITY_COLORS[task.priority])}>
                {task.priority}
              </Badge>
              {task.category && (
                <Badge variant="secondary" className={cn('text-[10px] capitalize', CATEGORY_COLORS[task.category] || CATEGORY_COLORS.chore)}>
                  {task.category}
                </Badge>
              )}
            </div>

            {totalSteps > 0 && (
              <div className="flex items-center gap-1.5 text-text-tertiary">
                <Check className="w-3 h-3" />
                <span>{completedSteps}/{totalSteps} steps</span>
              </div>
            )}

            <div className="flex flex-col gap-0.5 text-text-tertiary border-t border-border-subtle pt-2 mt-0.5">
              <span>Created: {formatDate(task.createdAt)}</span>
              <span>Updated: {formatDate(task.updatedAt)}</span>
              {task.completedAt && <span>Completed: {formatDate(task.completedAt)}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
