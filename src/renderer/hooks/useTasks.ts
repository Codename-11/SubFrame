/**
 * TanStack Query hooks for sub-task management.
 * Wraps LOAD_TASKS (send/on) + ADD_TASK, UPDATE_TASK, DELETE_TASK mutations.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { typedSend } from '../lib/ipc';
import { useIPCEvent } from './useIPCListener';
import { useProjectStore } from '../stores/useProjectStore';
import { IPC, type Task, type TasksPayload } from '../../shared/ipcChannels';
import { useCallback, useRef, useEffect, useMemo } from 'react';

const { ipcRenderer } = require('electron');

/** Extract the grouped { pending, inProgress, completed } from whatever the main process sends */
function extractGrouped(payload: TasksPayload | null): { pending: Task[]; inProgress: Task[]; completed: Task[] } {
  const empty = { pending: [], inProgress: [], completed: [] };
  if (!payload?.tasks) return empty;
  const t = payload.tasks as any;
  // Main sends the full TasksData object as `tasks`, so the groups are at `.tasks.tasks`
  const groups = (t.pending && t.inProgress && t.completed) ? t : t.tasks;
  if (!groups || !Array.isArray(groups.pending)) return empty;
  return {
    pending: groups.pending ?? [],
    inProgress: groups.inProgress ?? [],
    completed: groups.completed ?? [],
  };
}

/** Flattened tasks array from the grouped payload */
function flattenTasks(payload: TasksPayload | null): Task[] {
  const g = extractGrouped(payload);
  return [...g.pending, ...g.inProgress, ...g.completed];
}

/**
 * Query hook that loads tasks via send/on pattern and keeps cache fresh via IPC events.
 */
export function useTasks() {
  const projectPath = useProjectStore((s) => s.currentProjectPath);
  const queryClient = useQueryClient();
  const latestData = useRef<TasksPayload | null>(null);

  // Listen for tasks data pushed from main.
  // Deduplicate: only update cache if data actually changed (prevents re-render loop
  // from file-watcher events that send identical data repeatedly).
  const lastUpdateTs = useRef<string | null>(null);

  // Clear stale refs on project switch — prevents serving old project data to new queryFn
  useEffect(() => {
    latestData.current = null;
    lastUpdateTs.current = null;
  }, [projectPath]);

  useEffect(() => {
    const handler = (_event: unknown, data: TasksPayload) => {
      latestData.current = data;
      // Compare lastUpdated timestamp — skip cache update if data unchanged
      const newTs = (data?.tasks as any)?.lastUpdated ?? null;
      if (newTs && newTs === lastUpdateTs.current) return;
      lastUpdateTs.current = newTs;
      queryClient.setQueryData(['tasks', projectPath], data);
    };
    ipcRenderer.on(IPC.TASKS_DATA, handler);
    return () => { ipcRenderer.removeListener(IPC.TASKS_DATA, handler); };
  }, [projectPath, queryClient]);

  // Invalidate on task update events
  const invalidateKeys = useCallback(() => {
    if (projectPath) {
      typedSend(IPC.LOAD_TASKS, projectPath);
    }
  }, [projectPath]);

  useIPCEvent(IPC.TASK_UPDATED, invalidateKeys);

  const query = useQuery<TasksPayload | null>({
    queryKey: ['tasks', projectPath],
    queryFn: () => {
      if (!projectPath) return null;
      typedSend(IPC.LOAD_TASKS, projectPath);
      // Return latest cached data; real data arrives via IPC event
      return latestData.current ?? null;
    },
    enabled: !!projectPath,
    staleTime: Infinity, // Data freshness is managed by IPC events, not polling
  });

  // Memoize derived values — stable references unless query.data actually changes
  const allTasks = useMemo(() => flattenTasks(query.data ?? null), [query.data]);
  const groupedResult = useMemo(() => extractGrouped(query.data ?? null), [query.data]);

  // Derived: set of task IDs that are blocked (have an incomplete blocker)
  const blockedTaskIds = useMemo(() => {
    const activeIds = new Set(allTasks.filter(t => t.status !== 'completed').map(t => t.id));
    return new Set(
      allTasks
        .filter(t => t.blockedBy?.some(id => activeIds.has(id)))
        .map(t => t.id)
    );
  }, [allTasks]);

  // Mutations — no onSuccess invalidation needed; main sends TASK_UPDATED
  // which triggers invalidateKeys via useIPCEvent above.
  const addTask = useMutation({
    mutationFn: (task: Partial<Task>) => {
      if (!projectPath) return Promise.resolve();
      typedSend(IPC.ADD_TASK, { projectPath, task });
      return Promise.resolve();
    },
  });

  const updateTask = useMutation({
    mutationFn: (vars: { taskId: string; updates: Partial<Task> }) => {
      if (!projectPath) return Promise.resolve();
      typedSend(IPC.UPDATE_TASK, { projectPath, taskId: vars.taskId, updates: vars.updates });
      return Promise.resolve();
    },
  });

  const deleteTask = useMutation({
    mutationFn: (taskId: string) => {
      if (!projectPath) return Promise.resolve();
      typedSend(IPC.DELETE_TASK, { projectPath, taskId });
      return Promise.resolve();
    },
  });

  // Stable mutation function refs — prevents cascading re-renders when
  // mutation state transitions (idle→pending→success→idle) create new objects.
  const addTaskRef = useRef(addTask.mutate);
  addTaskRef.current = addTask.mutate;
  const updateTaskRef = useRef(updateTask.mutate);
  updateTaskRef.current = updateTask.mutate;
  const deleteTaskRef = useRef(deleteTask.mutate);
  deleteTaskRef.current = deleteTask.mutate;

  // Stable wrappers that delegate to refs — intentionally empty deps
  const stableMutations = useMemo(() => ({
    addTask:    { mutate: (...args: Parameters<typeof addTask.mutate>) => addTaskRef.current(...args) },
    updateTask: { mutate: (...args: Parameters<typeof updateTask.mutate>) => updateTaskRef.current(...args) },
    deleteTask: { mutate: (...args: Parameters<typeof deleteTask.mutate>) => deleteTaskRef.current(...args) },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  return {
    tasks: allTasks,
    grouped: groupedResult,
    blockedTaskIds,
    isLoading: query.isLoading,
    refetch: invalidateKeys,
    addTask: stableMutations.addTask,
    updateTask: stableMutations.updateTask,
    deleteTask: stableMutations.deleteTask,
  };
}
