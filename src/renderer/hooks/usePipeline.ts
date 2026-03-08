/**
 * TanStack Query hooks for pipeline management.
 * Wraps PIPELINE_LIST_RUNS (send/on) + PIPELINE_START, PIPELINE_CANCEL, etc. mutations.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { typedSend, typedInvoke } from '../lib/ipc';
import { useIPCEvent } from './useIPCListener';
import { useProjectStore } from '../stores/useProjectStore';
import {
  IPC,
  type PipelineRunsPayload,
  type PipelineProgressEvent,
  type PipelineTrigger,
  type WorkflowDefinition,
} from '../../shared/ipcChannels';
import { useCallback, useRef, useEffect, useMemo, useState } from 'react';

const { ipcRenderer } = require('electron');

/**
 * Query hook that loads pipeline runs via send/on pattern and keeps cache fresh via IPC events.
 */
export function usePipeline() {
  const projectPath = useProjectStore((s) => s.currentProjectPath);
  const queryClient = useQueryClient();
  const latestData = useRef<PipelineRunsPayload | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  // Listen for pipeline runs data pushed from main.
  // Deduplicate by timestamp to prevent re-render loops.
  const lastUpdateTs = useRef<string | null>(null);

  useEffect(() => {
    const handler = (_event: unknown, data: PipelineRunsPayload) => {
      // Only accept data for the current project
      if (data?.projectPath !== projectPath) return;
      latestData.current = data;
      // Compare updatedAt of the most recent run to avoid redundant cache updates
      const newTs = data?.runs?.[0]?.updatedAt ?? null;
      if (newTs && newTs === lastUpdateTs.current) return;
      lastUpdateTs.current = newTs;
      queryClient.setQueryData(['pipeline-runs', projectPath], data);
    };
    ipcRenderer.on(IPC.PIPELINE_RUNS_DATA, handler);
    return () => { ipcRenderer.removeListener(IPC.PIPELINE_RUNS_DATA, handler); };
  }, [projectPath, queryClient]);

  // Watch/unwatch pipeline workflows when project changes
  useEffect(() => {
    if (!projectPath) return;
    typedSend(IPC.WATCH_PIPELINE, projectPath);
    return () => { typedSend(IPC.UNWATCH_PIPELINE); };
  }, [projectPath]);

  // Invalidate on run update events — guard by projectPath
  const invalidateKeys = useCallback((run: { projectPath?: string }) => {
    if (projectPath && (!run?.projectPath || run.projectPath === projectPath)) {
      typedSend(IPC.PIPELINE_LIST_RUNS, { projectPath });
    }
  }, [projectPath]);

  useIPCEvent(IPC.PIPELINE_RUN_UPDATED, invalidateKeys);

  const query = useQuery<PipelineRunsPayload | null>({
    queryKey: ['pipeline-runs', projectPath],
    queryFn: () => {
      if (!projectPath) return null;
      typedSend(IPC.PIPELINE_LIST_RUNS, { projectPath });
      // Return latest cached data; real data arrives via IPC event
      return latestData.current ?? null;
    },
    enabled: !!projectPath,
    staleTime: Infinity, // Data freshness is managed by IPC events, not polling
  });

  const runs = useMemo(() => query.data?.runs ?? [], [query.data]);

  const selectedRun = useMemo(
    () => (selectedRunId ? runs.find((r) => r.id === selectedRunId) ?? null : null),
    [runs, selectedRunId]
  );

  // Mutations — use typedInvoke for handle-based channels
  const startPipeline = useMutation({
    mutationFn: (vars: { workflowId: string; trigger: PipelineTrigger }) => {
      if (!projectPath) return Promise.reject(new Error('No project'));
      return typedInvoke(IPC.PIPELINE_START, { projectPath, workflowId: vars.workflowId, trigger: vars.trigger });
    },
  });

  const cancelPipeline = useMutation({
    mutationFn: (runId: string) => typedInvoke(IPC.PIPELINE_CANCEL, runId),
  });

  const approveStage = useMutation({
    mutationFn: (vars: { runId: string; stageId: string }) =>
      typedInvoke(IPC.PIPELINE_APPROVE_STAGE, { runId: vars.runId, stageId: vars.stageId }),
  });

  const rejectStage = useMutation({
    mutationFn: (vars: { runId: string; stageId: string }) =>
      typedInvoke(IPC.PIPELINE_REJECT_STAGE, { runId: vars.runId, stageId: vars.stageId }),
  });

  const applyPatch = useMutation({
    mutationFn: (vars: { runId: string; patchId: string }) =>
      typedInvoke(IPC.PIPELINE_APPLY_PATCH, { runId: vars.runId, patchId: vars.patchId }),
  });

  const deleteRun = useMutation({
    mutationFn: (runId: string) => {
      if (!projectPath) return Promise.reject(new Error('No project'));
      // Clear selection if deleting the selected run
      if (runId === selectedRunId) setSelectedRunId(null);
      return typedInvoke(IPC.PIPELINE_DELETE_RUN, { runId, projectPath });
    },
  });

  // Stable mutation refs — prevents cascading re-renders when
  // mutation state transitions (idle→pending→success→idle) create new objects.
  const startPipelineRef = useRef(startPipeline.mutate);
  startPipelineRef.current = startPipeline.mutate;
  const cancelPipelineRef = useRef(cancelPipeline.mutate);
  cancelPipelineRef.current = cancelPipeline.mutate;
  const approveStageRef = useRef(approveStage.mutate);
  approveStageRef.current = approveStage.mutate;
  const rejectStageRef = useRef(rejectStage.mutate);
  rejectStageRef.current = rejectStage.mutate;
  const applyPatchRef = useRef(applyPatch.mutate);
  applyPatchRef.current = applyPatch.mutate;
  const deleteRunRef = useRef(deleteRun.mutate);
  deleteRunRef.current = deleteRun.mutate;

  // Stable wrappers that delegate to refs — intentionally empty deps
  const stableMutations = useMemo(() => ({
    startPipeline:  { mutate: (...args: Parameters<typeof startPipeline.mutate>) => startPipelineRef.current(...args) },
    cancelPipeline: { mutate: (...args: Parameters<typeof cancelPipeline.mutate>) => cancelPipelineRef.current(...args) },
    approveStage:   { mutate: (...args: Parameters<typeof approveStage.mutate>) => approveStageRef.current(...args) },
    rejectStage:    { mutate: (...args: Parameters<typeof rejectStage.mutate>) => rejectStageRef.current(...args) },
    applyPatch:     { mutate: (...args: Parameters<typeof applyPatch.mutate>) => applyPatchRef.current(...args) },
    deleteRun:      { mutate: (...args: Parameters<typeof deleteRun.mutate>) => deleteRunRef.current(...args) },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  return {
    runs,
    selectedRun,
    selectedRunId,
    setSelectedRunId,
    isLoading: query.isLoading,
    refetch: invalidateKeys,
    startPipeline: stableMutations.startPipeline,
    cancelPipeline: stableMutations.cancelPipeline,
    approveStage: stableMutations.approveStage,
    rejectStage: stableMutations.rejectStage,
    applyPatch: stableMutations.applyPatch,
    deleteRun: stableMutations.deleteRun,
  };
}

/**
 * Query hook for available workflow definitions.
 */
export function usePipelineWorkflows() {
  const projectPath = useProjectStore((s) => s.currentProjectPath);
  const queryClient = useQueryClient();

  const query = useQuery<WorkflowDefinition[]>({
    queryKey: ['pipeline-workflows', projectPath],
    queryFn: () => {
      if (!projectPath) return [];
      return typedInvoke(IPC.PIPELINE_LIST_WORKFLOWS, projectPath);
    },
    enabled: !!projectPath,
    staleTime: 60_000, // Workflows change infrequently
  });

  const saveWorkflow = useMutation({
    mutationFn: (vars: { filename: string; content: string }) => {
      if (!projectPath) return Promise.reject(new Error('No project'));
      return typedInvoke(IPC.PIPELINE_SAVE_WORKFLOW, { projectPath, filename: vars.filename, content: vars.content });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['pipeline-workflows', projectPath] }); },
  });

  const deleteWorkflow = useMutation({
    mutationFn: (filename: string) => {
      if (!projectPath) return Promise.reject(new Error('No project'));
      return typedInvoke(IPC.PIPELINE_DELETE_WORKFLOW, { projectPath, filename });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['pipeline-workflows', projectPath] }); },
  });

  return {
    workflows: query.data ?? [],
    isLoading: query.isLoading,
    refetch: query.refetch,
    saveWorkflow,
    deleteWorkflow,
  };
}

/**
 * Hook that listens to PIPELINE_PROGRESS events and maintains a log buffer per stage.
 */
export function usePipelineProgress(runId: string | null) {
  const logsRef = useRef<Record<string, string[]>>({});
  const [revision, setRevision] = useState(0);

  const handler = useCallback((event: PipelineProgressEvent) => {
    if (!runId || event.runId !== runId) return;
    const stageId = event.stageId;
    if (!logsRef.current[stageId]) {
      logsRef.current[stageId] = [];
    }
    logsRef.current[stageId].push(event.log);
    setRevision((r) => r + 1);
  }, [runId]);

  useIPCEvent(IPC.PIPELINE_PROGRESS, handler);

  // Reset logs when runId changes
  useEffect(() => {
    logsRef.current = {};
    setRevision(0);
  }, [runId]);

  return {
    /** Log lines keyed by stageId */
    logs: logsRef.current,
    /** Incremented on each new log line — use to trigger re-renders */
    revision,
  };
}
