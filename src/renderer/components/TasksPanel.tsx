/**
 * TasksPanel — Sub-task management with TanStack Table.
 * Supports filtering, sorting, inline expand, add/edit/delete.
 */

import { useState, useMemo, useCallback, useEffect, Fragment } from 'react';
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
import { Plus, ArrowUpDown, ArrowUp, ArrowDown, Play, Check, Pause, RotateCcw, Trash2, ChevronDown, ChevronRight, Send, Maximize2, FileText, List, Network, Columns3 } from 'lucide-react';
import { TaskTimeline } from './TaskTimeline';
import { TaskGraph } from './TaskGraph';
import { TaskKanban } from './TaskKanban';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { ScrollArea } from './ui/scroll-area';
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
import { useUIStore, type StatusFilter } from '../stores/useUIStore';
import { IPC } from '../../shared/ipcChannels';
import type { Task } from '../../shared/ipcChannels';
import { toast } from 'sonner';

const { ipcRenderer } = require('electron');

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
    <div className="flex items-center gap-1">
      {task.filePath && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            useUIStore.getState().setEditorFilePath(task.filePath!);
          }}
          className="p-1 text-text-tertiary hover:text-accent transition-colors cursor-pointer"
          title="Open in editor"
        >
          <FileText size={12} />
        </button>
      )}
      {hasActiveTerminal && (
        <button
          onClick={(e) => { e.stopPropagation(); onSendToTerminal(task); }}
          className="p-1 text-text-tertiary hover:text-accent transition-colors cursor-pointer"
          title="Send to Claude"
        >
          <Send size={12} />
        </button>
      )}
      {task.status === 'pending' && (
        <button
          onClick={(e) => { e.stopPropagation(); onUpdateStatus(task.id, 'in_progress'); toast.info('Task started'); }}
          className="p-1 text-text-tertiary hover:text-accent transition-colors cursor-pointer"
          title="Start"
        >
          <Play size={12} />
        </button>
      )}
      {task.status === 'in_progress' && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); onUpdateStatus(task.id, 'completed'); toast.success('Task completed'); }}
            className="p-1 text-text-tertiary hover:text-emerald-400 transition-colors cursor-pointer"
            title="Complete"
          >
            <Check size={12} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onUpdateStatus(task.id, 'pending'); toast.info('Task paused'); }}
            className="p-1 text-text-tertiary hover:text-amber-400 transition-colors cursor-pointer"
            title="Pause"
          >
            <Pause size={12} />
          </button>
        </>
      )}
      {task.status === 'completed' && (
        <button
          onClick={(e) => { e.stopPropagation(); onUpdateStatus(task.id, 'pending'); toast.info('Task reopened'); }}
          className="p-1 text-text-tertiary hover:text-accent transition-colors cursor-pointer"
          title="Reopen"
        >
          <RotateCcw size={12} />
        </button>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); onEdit(task); }}
        className="p-1 text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
        title="Edit"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onRequestDelete(task.id); }}
        className="p-1 text-text-tertiary hover:text-red-400 transition-colors cursor-pointer"
        title="Delete"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

interface TasksPanelProps {
  /** When true, the panel is rendered inside TerminalArea full-view */
  isFullView?: boolean;
}

export function TasksPanel({ isFullView = false }: TasksPanelProps) {
  const { tasks, addTask, updateTask, deleteTask, isLoading } = useTasks();
  const activeTerminalId = useTerminalStore((s) => s.activeTerminalId);

  // Sort/filter state from Zustand store — survives panel switches
  const sorting = useUIStore((s) => s.tasksSorting);
  const setSorting = useUIStore((s) => s.setTasksSorting);
  const statusFilter = useUIStore((s) => s.tasksStatusFilter);
  const setTasksStatusFilter = useUIStore((s) => s.setTasksStatusFilter);
  const tasksFilterSetByUser = useUIStore((s) => s.tasksFilterSetByUser);
  const setTasksFilterSetByUser = useUIStore((s) => s.setTasksFilterSetByUser);
  const setFullViewContent = useUIStore((s) => s.setFullViewContent);
  const closeRightPanel = useUIStore((s) => s.closeRightPanel);

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

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPriority, setFormPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [formCategory, setFormCategory] = useState('feature');
  const [formStatus, setFormStatus] = useState<'pending' | 'in_progress' | 'completed'>('pending');

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
      const prompt = `Task: ${task.title}\n\nDescription: ${task.description || 'N/A'}\n\nAcceptance Criteria: ${task.acceptanceCriteria || 'N/A'}`;
      ipcRenderer.send(IPC.TERMINAL_INPUT_ID, { terminalId: activeTerminalId, data: prompt + '\r' });
      toast.info('Task sent to terminal');
    },
    [activeTerminalId]
  );

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
      {
        id: 'expand',
        header: '',
        cell: () => null, // Rendered manually in TaskRow
        size: 24,
      },
      {
        accessorKey: 'title',
        header: ({ column }) => <SortHeader column={column} label="Title" />,
        cell: ({ getValue }) => (
          <span className="text-text-primary font-medium line-clamp-2 leading-tight" title={getValue() as string}>
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
          return (
            <span className="flex items-center gap-1 flex-wrap">
              <Badge variant="secondary" className={cn('text-[10px] capitalize whitespace-nowrap', STATUS_COLORS[status])}>
                {status.replace('_', ' ')}
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
        size: isFullView ? 110 : 90,
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
      // Panel mode: combined tags column (category + priority stacked) to save space
      cols.push({
        id: 'tags',
        header: () => <span className="text-[10px] uppercase tracking-wider text-text-tertiary font-medium">Tags</span>,
        cell: ({ row }) => {
          const cat = row.original.category || 'feature';
          const priority = row.original.priority;
          return (
            <div className="flex flex-col gap-0.5">
              <Badge variant="secondary" className={cn('text-[10px] capitalize whitespace-nowrap w-fit', CATEGORY_COLORS[cat] || CATEGORY_COLORS.chore)}>
                {CATEGORY_SHORT[cat] || cat}
              </Badge>
              <Badge variant="secondary" className={cn('text-[10px] capitalize whitespace-nowrap w-fit', PRIORITY_COLORS[priority])}>
                {priority}
              </Badge>
            </div>
          );
        },
        size: 52,
      });
    }

    cols.push({
      id: 'actions',
      header: '',
      cell: () => null, // Rendered manually in TaskRow
      size: isFullView ? 80 : 56,
    });

    return cols;
  }, [isFullView]);

  const table = useReactTable({
    data: filteredTasks,
    columns,
    state: { sorting },
    onSortingChange: handleSortingChange,
    enableMultiSort: true,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  function openAddDialog() {
    setEditingTask(null);
    setFormTitle('');
    setFormDescription('');
    setFormPriority('medium');
    setFormCategory('feature');
    setFormStatus('pending');
    setDialogOpen(true);
  }

  // React 18 batches all these setState calls into a single render
  const openEditDialog = useCallback((task: Task) => {
    setEditingTask(task);
    setFormTitle(task.title);
    setFormDescription(task.description || '');
    setFormPriority(task.priority);
    setFormCategory(task.category || 'feature');
    setFormStatus(task.status);
    setDialogOpen(true);
  }, []);

  function handleSubmit() {
    if (!formTitle.trim()) return;
    const data = {
      title: formTitle.trim(),
      description: formDescription.trim(),
      priority: formPriority,
      category: formCategory,
      status: formStatus,
    };

    if (editingTask) {
      updateTask.mutate({ taskId: editingTask.id, updates: data });
      toast.success('Sub-task updated');
    } else {
      addTask.mutate(data);
      toast.success('Sub-task created');
    }
    setDialogOpen(false);
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
          <table className="w-full table-fixed">
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
                          <td key={cell.id} className={cn(cellPx, 'py-2 text-xs', cell.column.id === 'title' ? 'overflow-hidden' : '')}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        );
                      })}
                    </tr>
                    {expandedId === row.original.id && (
                      <tr>
                        <td colSpan={columns.length} className="px-4 py-3 bg-bg-deep/50">
                          <TaskDetail task={row.original} updateTask={updateTask} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
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
            <AlertDialogAction variant="default" size="sm" onClick={handleConfirmDelete} className="bg-red-600 hover:bg-red-700 cursor-pointer">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-bg-primary border-border-subtle text-text-primary sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{editingTask ? 'Edit Sub-Task' : 'Add Sub-Task'}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
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
            <div>
              <label className="text-xs text-text-secondary mb-1 block">Description</label>
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Task description"
                rows={3}
                className="w-full rounded-md bg-bg-deep border border-border-subtle px-3 py-2 text-sm text-text-primary resize-none focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
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
                  <option value="bug">Bug</option>
                  <option value="refactor">Refactor</option>
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
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} className="cursor-pointer">
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!formTitle.trim()} className="bg-accent text-bg-deep hover:bg-accent/80 cursor-pointer">
              {editingTask ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TaskDetail({ task, updateTask }: { task: Task; updateTask: { mutate: (vars: { taskId: string; updates: Partial<Task> }) => void } }) {
  return (
    <div className="flex flex-col gap-2 text-xs">
      {task.description && (
        <div className="break-words">
          <span className="text-text-tertiary font-medium">Description: </span>
          <span className="text-text-secondary">{task.description}</span>
        </div>
      )}
      {task.acceptanceCriteria && (
        <div className="break-words">
          <span className="text-text-tertiary font-medium">Acceptance Criteria: </span>
          <span className="text-text-secondary">{task.acceptanceCriteria}</span>
        </div>
      )}
      {task.notes && (
        <div className="break-words">
          <span className="text-text-tertiary font-medium">Notes: </span>
          <span className="text-text-secondary">{task.notes}</span>
        </div>
      )}
      {task.category && (
        <div>
          <span className="text-text-tertiary font-medium">Category: </span>
          <span className="text-text-secondary">{task.category}</span>
        </div>
      )}
      {task.blockedBy && task.blockedBy.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {task.blockedBy.map((dep) => (
            <Badge key={dep} variant="secondary" className="text-[10px] bg-red-900/40 text-red-300">
              Blocked by: {dep}
            </Badge>
          ))}
        </div>
      )}
      {task.blocks && task.blocks.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {task.blocks.map((dep) => (
            <Badge key={dep} variant="secondary" className="text-[10px] bg-amber-900/40 text-amber-300">
              Blocking: {dep}
            </Badge>
          ))}
        </div>
      )}
      {task.steps && task.steps.length > 0 && (
        <TaskTimeline
          steps={task.steps}
          onToggleStep={(index) => {
            const newSteps = task.steps.map((s, i) => i === index ? { ...s, completed: !s.completed } : s);
            updateTask.mutate({ taskId: task.id, updates: { steps: newSteps } });
          }}
        />
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-text-tertiary">
        <span>Created: {formatDate(task.createdAt)}</span>
        <span>Updated: {formatDate(task.updatedAt)}</span>
        {task.completedAt && <span>Completed: {formatDate(task.completedAt)}</span>}
      </div>
    </div>
  );
}
