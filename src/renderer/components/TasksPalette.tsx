/**
 * TasksPalette — Floating quick-task palette triggered by Ctrl+'.
 * Provides fast search and navigation for active Sub-Tasks.
 * Follows the same overlay pattern as CommandPalette.tsx and PromptLibrary.tsx.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from './ui/command';
import { useUIStore } from '../stores/useUIStore';
import { useTasks } from '../hooks/useTasks';
import type { Task } from '../../shared/ipcChannels';

/** Small status dot rendered to the left of each task title. */
function StatusDot({ status, blocked }: { status: Task['status']; blocked: boolean }) {
  if (blocked) {
    return <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-error" />;
  }
  if (status === 'in_progress') {
    return <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-warning animate-pulse" />;
  }
  // pending (non-blocked)
  return <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-text-muted" />;
}

/** Priority badge shown at the right side of each item. */
function PriorityBadge({ priority }: { priority: Task['priority'] }) {
  const colorClass =
    priority === 'high'
      ? 'text-error'
      : priority === 'medium'
        ? 'text-warning'
        : 'text-text-muted';

  return <span className={`text-[10px] font-medium ${colorClass}`}>{priority}</span>;
}

/** Steps progress indicator (e.g. "2/5") when a task has steps. */
function StepsProgress({ steps }: { steps: Task['steps'] }) {
  if (!steps || steps.length === 0) return null;
  const completed = steps.filter((s) => s.completed).length;
  return (
    <span className="text-[10px] text-text-muted font-mono">
      {completed}/{steps.length}
    </span>
  );
}

export function TasksPalette() {
  const [open, setOpen] = useState(false);

  // Register Ctrl+' keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "'") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const togglePanel = useUIStore((s) => s.togglePanel);
  const { grouped, blockedTaskIds } = useTasks();

  // Derive the three groups: in_progress, pending (non-blocked), blocked
  const { inProgressTasks, pendingTasks, blockedTasks } = useMemo(() => {
    const inProgressTasks = grouped.inProgress ?? [];

    // Blocked: pending tasks whose id is in blockedTaskIds
    const blockedTasks = (grouped.pending ?? []).filter((t) => blockedTaskIds.has(t.id));

    // Pending: exclude blocked tasks
    const pendingTasks = (grouped.pending ?? []).filter((t) => !blockedTaskIds.has(t.id));

    return { inProgressTasks, pendingTasks, blockedTasks };
  }, [grouped, blockedTaskIds]);

  const handleSelect = () => {
    setOpen(false);
    requestAnimationFrame(() => togglePanel('tasks'));
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Quick Tasks"
      description="Search and navigate Sub-Tasks"
      className="bg-bg-primary border-border-subtle sm:max-w-lg"
      showCloseButton={false}
    >
      <CommandInput
        placeholder="Search tasks..."
        className="text-text-primary placeholder:text-text-muted"
      />
      <CommandList className="text-text-primary">
        <CommandEmpty className="text-text-tertiary">No tasks found.</CommandEmpty>

        {/* In Progress */}
        {inProgressTasks.length > 0 && (
          <CommandGroup heading="In Progress">
            {inProgressTasks.map((task) => (
              <CommandItem key={task.id} value={task.id} keywords={[task.title, task.category ?? '']} onSelect={handleSelect}>
                <StatusDot status="in_progress" blocked={false} />
                <span className="flex-1 truncate">{task.title}</span>
                <StepsProgress steps={task.steps} />
                {task.category && (
                  <span className="text-text-tertiary text-[10px]">{task.category}</span>
                )}
                <PriorityBadge priority={task.priority} />
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {inProgressTasks.length > 0 && (pendingTasks.length > 0 || blockedTasks.length > 0) && (
          <CommandSeparator />
        )}

        {/* Pending (non-blocked) */}
        {pendingTasks.length > 0 && (
          <CommandGroup heading="Pending">
            {pendingTasks.map((task) => (
              <CommandItem key={task.id} value={task.id} keywords={[task.title, task.category ?? '']} onSelect={handleSelect}>
                <StatusDot status="pending" blocked={false} />
                <span className="flex-1 truncate">{task.title}</span>
                <StepsProgress steps={task.steps} />
                {task.category && (
                  <span className="text-text-tertiary text-[10px]">{task.category}</span>
                )}
                <PriorityBadge priority={task.priority} />
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {pendingTasks.length > 0 && blockedTasks.length > 0 && <CommandSeparator />}

        {/* Blocked */}
        {blockedTasks.length > 0 && (
          <CommandGroup heading="Blocked">
            {blockedTasks.map((task) => (
              <CommandItem key={task.id} value={task.id} keywords={[task.title, task.category ?? '']} onSelect={handleSelect}>
                <StatusDot status="pending" blocked={true} />
                <span className="flex-1 truncate">{task.title}</span>
                <StepsProgress steps={task.steps} />
                {task.category && (
                  <span className="text-text-tertiary text-[10px]">{task.category}</span>
                )}
                <PriorityBadge priority={task.priority} />
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
