/**
 * Pipeline Manager Module
 * Orchestrates pipeline runs: parses workflows, executes jobs/stages,
 * handles approval gates, and pushes progress events to the renderer.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { exec } from 'child_process';
import type { BrowserWindow, IpcMain } from 'electron';
import { IPC } from '../shared/ipcChannels';
import type {
  PipelineRun,
  PipelineJob,
  PipelineStage,
  PipelineArtifact,
  PipelineTrigger,
  StageType,
  WorkflowDefinition,
  WorkflowStep,
  PipelineProgressEvent,
} from '../shared/ipcChannels';
import { FRAME_PIPELINES_DIR, FRAME_WORKFLOWS_DIR } from '../shared/frameConstants';
import { listWorkflows, parseWorkflow, getDefaultWorkflow, getTaskVerificationWorkflow, getHealthCheckWorkflow, getDocsAuditWorkflow, getSecurityScanWorkflow } from './pipelineWorkflowParser';
import {
  getStageHandler,
  runCustomStage,
  type StageContext,
} from './pipelineStages';
import * as aiToolManager from './aiToolManager';
import * as activityManager from './activityManager';
import { broadcast as bridgeBroadcast } from './eventBridge';

// ─── Module State ────────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null;
let workflowsWatcher: fs.FSWatcher | null = null;
let triggerWatcher: fs.FSWatcher | null = null;

interface PipelineRunContext {
  run: PipelineRun;
  abortController: AbortController;
  /** Resolve function for the approval promise; set when a stage is paused. */
  approvalResolve: ((approved: boolean) => void) | null;
}

const activeRuns: Map<string, PipelineRunContext> = new Map();
/** All runs (active + historical) for the current session. */
const allRuns: Map<string, PipelineRun> = new Map();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uid(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

function send(channel: string, data: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    bridgeBroadcast(channel, data);
  }
}

function emitProgress(runId: string, stageId: string, log: string): void {
  const event: PipelineProgressEvent = { runId, stageId, log };
  send(IPC.PIPELINE_PROGRESS, event);
}

function broadcastRunUpdate(run: PipelineRun): void {
  send(IPC.PIPELINE_RUN_UPDATED, run);
}

function broadcastRunsList(projectPath: string): void {
  const runs = Array.from(allRuns.values())
    .filter((r) => r.projectPath === projectPath)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  send(IPC.PIPELINE_RUNS_DATA, { projectPath, runs });
}

/**
 * Get the pipelines directory, creating it if needed.
 */
function ensurePipelinesDir(projectPath: string): string {
  const dir = path.join(projectPath, FRAME_PIPELINES_DIR);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Ensure the workflows directory exists, seeding with default workflow if empty.
 */
function ensureWorkflowsDir(projectPath: string): string {
  const dir = path.join(projectPath, FRAME_WORKFLOWS_DIR);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  // Seed any missing built-in workflows (safe to call repeatedly)
  const builtins: [string, () => string][] = [
    ['review.yml', getDefaultWorkflow],
    ['task-verify.yml', getTaskVerificationWorkflow],
    ['health-check.yml', getHealthCheckWorkflow],
    ['docs-audit.yml', getDocsAuditWorkflow],
    ['security-scan.yml', getSecurityScanWorkflow],
  ];
  for (const [filename, getTemplate] of builtins) {
    const filePath = path.join(dir, filename);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, getTemplate(), 'utf8');
    }
  }
  return dir;
}

/**
 * Persist runs to .subframe/pipelines/runs.json
 */
function persistRuns(projectPath: string): void {
  try {
    const dir = ensurePipelinesDir(projectPath);
    const runs = Array.from(allRuns.values())
      .filter((r) => r.projectPath === projectPath);
    // Keep only the last 50 runs to avoid unbounded growth
    const trimmed = runs
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 50);
    fs.writeFileSync(
      path.join(dir, 'runs.json'),
      JSON.stringify(trimmed, null, 2),
      'utf8'
    );
  } catch (err) {
    console.error('Error persisting pipeline runs:', (err as Error).message);
  }
}

/**
 * Load persisted runs from disk.
 */
function loadPersistedRuns(projectPath: string): void {
  try {
    const runsPath = path.join(projectPath, FRAME_PIPELINES_DIR, 'runs.json');
    if (fs.existsSync(runsPath)) {
      const data = JSON.parse(fs.readFileSync(runsPath, 'utf8')) as PipelineRun[];
      for (const run of data) {
        // Don't overwrite active runs
        if (!activeRuns.has(run.id)) {
          // Mark any previously-running runs as failed (stale from crash)
          if (run.status === 'running' || run.status === 'paused') {
            run.status = 'failed';
            run.updatedAt = now();
          }
          allRuns.set(run.id, run);
        }
      }
    }
  } catch (err) {
    console.error('Error loading persisted runs:', (err as Error).message);
  }
}

/**
 * Run a shell command and return stdout.
 */
function execAsync(
  cmd: string,
  cwd: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd, maxBuffer: 5 * 1024 * 1024 }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout.trim());
    });
  });
}

// ─── Topological Sort (Kahn's Algorithm) ─────────────────────────────────────

/**
 * Topologically sort jobs by their `needs` dependencies.
 * Returns an ordered array of [jobId, WorkflowJob] pairs.
 */
function topologicalSortJobs(
  jobs: Record<string, { name?: string; needs?: string[]; steps: WorkflowStep[] }>
): string[] {
  const jobIds = Object.keys(jobs);
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const id of jobIds) {
    inDegree.set(id, 0);
    adjacency.set(id, []);
  }

  for (const id of jobIds) {
    const needs = jobs[id].needs || [];
    for (const dep of needs) {
      if (!adjacency.has(dep)) {
        throw new Error(`Job '${id}' depends on unknown job '${dep}'`);
      }
      adjacency.get(dep)!.push(id);
      inDegree.set(id, (inDegree.get(id) || 0) + 1);
    }
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);
    for (const neighbor of adjacency.get(current) || []) {
      const newDeg = (inDegree.get(neighbor) || 1) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }

  if (sorted.length !== jobIds.length) {
    throw new Error('Circular dependency detected in workflow jobs');
  }

  return sorted;
}

// ─── Workflow → PipelineRun Conversion ───────────────────────────────────────

/**
 * Map a workflow step's `uses` value to a StageType.
 */
function stepToStageType(step: WorkflowStep): StageType {
  if (step.uses) {
    const known: StageType[] = ['lint', 'test', 'describe', 'critique', 'freeze', 'push', 'create-pr'];
    if (known.includes(step.uses as StageType)) {
      return step.uses as StageType;
    }
  }
  return 'custom';
}

/**
 * Build a PipelineRun from a workflow definition.
 */
function buildRun(
  workflow: WorkflowDefinition,
  projectPath: string,
  trigger: PipelineTrigger,
  branch: string,
  baseSha: string,
  headSha: string,
  overrides?: Record<string, string>
): PipelineRun {
  const runId = uid();
  const sortedJobIds = topologicalSortJobs(workflow.jobs);

  const jobs: PipelineJob[] = sortedJobIds.map((jobId) => {
    const wJob = workflow.jobs[jobId];
    const stages: PipelineStage[] = wJob.steps.map((step) => ({
      id: uid(),
      name: step.name,
      type: stepToStageType(step),
      status: 'pending',
      requireApproval: step['require-approval'] || false,
      continueOnError: step['continue-on-error'] || false,
      frozen: false,
      artifacts: [],
      logs: [],
      startedAt: null,
      completedAt: null,
      durationMs: null,
      failureReason: null,
    }));

    return {
      id: jobId,
      name: wJob.name || jobId,
      needs: wJob.needs || [],
      stages,
      status: 'pending',
      startedAt: null,
      completedAt: null,
    };
  });

  return {
    id: runId,
    projectPath,
    workflowId: workflow.name,
    trigger,
    status: 'queued',
    branch,
    baseSha,
    headSha,
    jobs,
    artifacts: [],
    createdAt: now(),
    updatedAt: now(),
    completedAt: null,
    overrides,
  };
}

// ─── Pipeline Execution Engine ───────────────────────────────────────────────

/**
 * Execute a full pipeline run.
 */
async function executeRun(runCtx: PipelineRunContext, workflow: WorkflowDefinition): Promise<void> {
  const { run, abortController } = runCtx;
  const projectPath = run.projectPath;

  run.status = 'running';
  run.updatedAt = now();
  broadcastRunUpdate(run);

  // Verify the active AI tool is installed before proceeding
  const activeTool = await aiToolManager.getActiveTool();
  if (!await aiToolManager.checkToolInstalled(activeTool)) {
    const installHint = activeTool.installUrl ? ` Install: ${activeTool.installUrl}` : '';
    const errMsg = `AI tool '${activeTool.name}' is not installed.${installHint}`;
    run.status = 'failed';
    run.updatedAt = now();
    run.completedAt = now();
    for (const job of run.jobs) {
      job.status = 'skipped';
      for (const stage of job.stages) {
        stage.status = 'skipped';
      }
    }
    broadcastRunUpdate(run);
    persistRuns(projectPath);
    activeRuns.delete(run.id);
    console.error(`Pipeline run aborted: ${errMsg}`);
    return;
  }

  const aiTool = await aiToolManager.getStartCommand();
  const aiToolId = activeTool.id;
  let frozen = false;

  try {
    // Execute jobs in topological order (they are already sorted in run.jobs)
    for (const job of run.jobs) {
      if (abortController.signal.aborted) break;

      // Check if dependencies completed successfully
      const depsFailed = job.needs.some((depId) => {
        const depJob = run.jobs.find((j) => j.id === depId);
        return depJob && depJob.status === 'failed';
      });

      if (depsFailed) {
        job.status = 'skipped';
        for (const stage of job.stages) {
          stage.status = 'skipped';
        }
        run.updatedAt = now();
        broadcastRunUpdate(run);
        continue;
      }

      job.status = 'running';
      job.startedAt = now();
      run.updatedAt = now();
      broadcastRunUpdate(run);

      // Execute stages sequentially within the job
      let jobFailed = false;
      for (const stage of job.stages) {
        if (abortController.signal.aborted) break;

        // Apply freeze semantics
        if (frozen) {
          stage.frozen = true;
        }

        // Find the corresponding workflow step for custom stage config
        const jobDef = workflow.jobs[job.id];
        const stepIndex = job.stages.indexOf(stage);
        const step = jobDef?.steps[stepIndex];

        stage.status = 'running';
        stage.startedAt = now();
        run.updatedAt = now();
        broadcastRunUpdate(run);

        // Create an activity stream for this stage
        const stageTimeoutMs = (step?.timeout ?? 600) * 1000;
        const isAgentMode = step?.with?.mode === 'agent';
        const streamId = activityManager.createStream({
          name: `Pipeline: ${stage.name}`,
          type: isAgentMode ? 'agent' : 'pty',
          source: 'pipeline',
          timeout: stageTimeoutMs,
          heartbeatInterval: isAgentMode ? 15_000 : 10_000,
        });
        activityManager.updateStatus(streamId, 'running');
        activityManager.startHeartbeat(streamId);

        const ctx: StageContext = {
          run,
          stage,
          projectPath,
          worktreePath: null,
          baseSha: run.baseSha,
          headSha: run.headSha,
          artifacts: [...run.artifacts],
          aiToolId,
          aiTool,
          abortSignal: abortController.signal,
          emit: (log: string) => {
            stage.logs.push(log);
            emitProgress(run.id, stage.id, log);
          },
          stepConfig: { ...(step?.with ?? {}), ...(run.overrides ?? {}) },
          streamId,
        };

        try {
          // Enforce stage timeout (default: 10 minutes, configurable via step.timeout)
          const timeoutMs = stageTimeoutMs;
          let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
          const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutHandle = setTimeout(() => {
              reject(new Error(`Stage timed out after ${Math.round(timeoutMs / 1000)}s`));
            }, timeoutMs);
          });

          let result;
          const stagePromise = (async () => {
            if (stage.type === 'custom' && step) {
              return runCustomStage(ctx, {
                run: step.run,
                uses: step.uses,
                env: step.env,
              });
            } else {
              const handler = getStageHandler(stage.type);
              if (!handler) {
                ctx.emit(`Unknown stage type: ${stage.type}`);
                return { status: 'failed' as const, artifacts: [], logs: [`Unknown stage type: ${stage.type}`] };
              }
              return handler(ctx);
            }
          })();

          try {
            result = await Promise.race([stagePromise, timeoutPromise]);
          } finally {
            if (timeoutHandle) clearTimeout(timeoutHandle);
          }

          stage.status = result.status;
          stage.failureReason = result.failureReason ?? null;
          stage.logs.push(...result.logs);
          stage.completedAt = now();
          stage.durationMs = new Date(stage.completedAt).getTime() - new Date(stage.startedAt!).getTime();

          // Update activity stream status
          if (result.status === 'completed') {
            activityManager.updateStatus(streamId, 'completed');
          } else if (result.status === 'failed') {
            activityManager.updateStatus(streamId, 'failed', result.failureReason ?? 'Stage failed');
          } else {
            // skipped
            activityManager.updateStatus(streamId, 'completed');
          }

          // Collect artifacts
          for (const artifact of result.artifacts) {
            stage.artifacts.push(artifact.id);
            run.artifacts.push(artifact);
          }

          // Handle freeze semantics: if this is a freeze stage, mark subsequent stages
          if (stage.type === 'freeze' && result.status === 'completed') {
            frozen = true;
          }

          // Handle approval gates
          if (stage.status === 'completed' && shouldRequireApproval(stage, result.artifacts)) {
            run.status = 'paused';
            run.updatedAt = now();
            broadcastRunUpdate(run);

            ctx.emit('Waiting for approval...');
            const approved = await waitForApproval(runCtx);

            if (!approved) {
              stage.status = 'failed';
              stage.logs.push('Stage rejected by user');
              run.status = 'failed';
              run.updatedAt = now();
              run.completedAt = now();
              broadcastRunUpdate(run);
              persistRuns(projectPath);
              return;
            }

            run.status = 'running';
            run.updatedAt = now();
            broadcastRunUpdate(run);
          }

          run.updatedAt = now();
          broadcastRunUpdate(run);

          // Handle stage failure
          if (result.status === 'failed' && !stage.continueOnError) {
            jobFailed = true;
            break;
          }
        } catch (err) {
          if (abortController.signal.aborted) {
            activityManager.updateStatus(streamId, 'cancelled');
            break;
          }
          const errMsg = (err as Error).message;
          stage.status = 'failed';
          stage.failureReason = errMsg.includes('timed out') ? 'timeout' : 'error';
          stage.completedAt = now();
          stage.durationMs = new Date(stage.completedAt).getTime() - new Date(stage.startedAt!).getTime();
          stage.logs.push(`Unhandled error: ${errMsg}`);
          run.updatedAt = now();
          broadcastRunUpdate(run);

          // Update activity stream with failure
          activityManager.updateStatus(streamId, 'failed', errMsg);

          if (!stage.continueOnError) {
            jobFailed = true;
            break;
          }
        }
      }

      job.status = abortController.signal.aborted
        ? 'skipped'
        : jobFailed
          ? 'failed'
          : 'completed';
      job.completedAt = now();
      run.updatedAt = now();
      broadcastRunUpdate(run);

      // If a job failed, skip remaining jobs that depend on it
      if (jobFailed) {
        // Let the loop continue; dependency check at top handles skipping
      }
    }

    // Determine final run status
    if (abortController.signal.aborted) {
      run.status = 'cancelled';
    } else {
      const anyFailed = run.jobs.some((j) => j.status === 'failed');
      run.status = anyFailed ? 'failed' : 'completed';
    }
  } catch (err) {
    run.status = 'failed';
    console.error('Pipeline execution error:', (err as Error).message);
  }

  run.completedAt = now();
  run.updatedAt = now();
  broadcastRunUpdate(run);
  persistRuns(projectPath);
  activeRuns.delete(run.id);
}

/**
 * Determine if a stage should pause for approval.
 */
function shouldRequireApproval(stage: PipelineStage, artifacts: PipelineArtifact[]): boolean {
  if (stage.requireApproval === true) return true;
  if (stage.requireApproval === 'if_patches') {
    return artifacts.some((a) => a.type === 'patch');
  }
  return false;
}

/**
 * Wait for user approval/rejection via IPC.
 * Returns true if approved, false if rejected.
 */
function waitForApproval(runCtx: PipelineRunContext): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const safeResolve = (value: boolean) => {
      if (settled) return;
      settled = true;
      runCtx.approvalResolve = null;
      resolve(value);
    };
    runCtx.approvalResolve = safeResolve;

    // Also resolve on abort
    runCtx.abortController.signal.addEventListener('abort', () => {
      safeResolve(false);
    }, { once: true });
  });
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Initialize the pipeline manager.
 */
function init(window: BrowserWindow): void {
  mainWindow = window;
}

/**
 * Setup all IPC handlers for the pipeline system.
 */
function setupIPC(ipcMain: IpcMain): void {
  // ── Handle channels (request/response) ──────────────────────────────────

  ipcMain.handle(IPC.PIPELINE_LIST_WORKFLOWS, async (_event, projectPath: string) => {
    ensureWorkflowsDir(projectPath);
    return listWorkflows(projectPath);
  });

  ipcMain.handle(
    IPC.PIPELINE_START,
    async (
      _event,
      payload: { projectPath: string; workflowId: string; trigger: PipelineTrigger; overrides?: Record<string, string> }
    ) => {
      const { projectPath, workflowId, trigger, overrides } = payload;

      // Load workflows and find the requested one
      ensureWorkflowsDir(projectPath);
      const workflows = listWorkflows(projectPath);
      const workflow = workflows.find((w) => w.name === workflowId);

      if (!workflow) {
        throw new Error(`Workflow '${workflowId}' not found`);
      }

      // Get git context
      let branch: string;
      let baseSha: string;
      let headSha: string;

      try {
        branch = await execAsync('git symbolic-ref --short HEAD', projectPath);
        headSha = await execAsync('git rev-parse HEAD', projectPath);
        // Try to find merge-base with main/master
        try {
          baseSha = await execAsync('git merge-base main HEAD', projectPath);
        } catch {
          try {
            baseSha = await execAsync('git merge-base master HEAD', projectPath);
          } catch {
            // Fallback: use HEAD~1 or the initial commit
            try {
              baseSha = await execAsync('git rev-parse HEAD~1', projectPath);
            } catch {
              baseSha = headSha;
            }
          }
        }
      } catch {
        branch = 'unknown';
        baseSha = '';
        headSha = '';
      }

      const run = buildRun(workflow, projectPath, trigger, branch, baseSha, headSha, overrides);
      const abortController = new AbortController();
      const runCtx: PipelineRunContext = {
        run,
        abortController,
        approvalResolve: null,
      };

      activeRuns.set(run.id, runCtx);
      allRuns.set(run.id, run);
      broadcastRunUpdate(run);
      broadcastRunsList(projectPath);

      // Start execution asynchronously
      executeRun(runCtx, workflow).catch((err) => {
        console.error('Pipeline run error:', (err as Error).message);
      });

      return { runId: run.id };
    }
  );

  ipcMain.handle(IPC.PIPELINE_CANCEL, async (_event, runId: string) => {
    const runCtx = activeRuns.get(runId);
    if (!runCtx) {
      return { success: false };
    }

    runCtx.abortController.abort();

    // If waiting for approval, reject it
    if (runCtx.approvalResolve) {
      runCtx.approvalResolve(false);
      runCtx.approvalResolve = null;
    }

    return { success: true };
  });

  ipcMain.handle(
    IPC.PIPELINE_APPROVE_STAGE,
    async (_event, payload: { runId: string; stageId: string }) => {
      const runCtx = activeRuns.get(payload.runId);
      if (!runCtx || !runCtx.approvalResolve) {
        return { success: false };
      }

      runCtx.approvalResolve(true);
      runCtx.approvalResolve = null;
      return { success: true };
    }
  );

  ipcMain.handle(
    IPC.PIPELINE_REJECT_STAGE,
    async (_event, payload: { runId: string; stageId: string }) => {
      const runCtx = activeRuns.get(payload.runId);
      if (!runCtx || !runCtx.approvalResolve) {
        return { success: false };
      }

      runCtx.approvalResolve(false);
      runCtx.approvalResolve = null;
      return { success: true };
    }
  );

  ipcMain.handle(
    IPC.PIPELINE_APPLY_PATCH,
    async (_event, payload: { runId: string; patchId: string }) => {
      const run = allRuns.get(payload.runId);
      if (!run) {
        return { success: false, error: 'Run not found' };
      }

      const patch = run.artifacts.find(
        (a) => a.id === payload.patchId && a.type === 'patch'
      );
      if (!patch || patch.type !== 'patch') {
        return { success: false, error: 'Patch not found' };
      }

      try {
        // Write the diff to a temporary file and apply it
        const tmpFile = path.join(
          run.projectPath,
          FRAME_PIPELINES_DIR,
          `patch-${payload.patchId}.diff`
        );
        fs.writeFileSync(tmpFile, patch.diff, 'utf8');

        await execAsync(`git apply "${tmpFile}"`, run.projectPath);

        // Clean up temp file
        try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }

        // Mark patch as applied
        patch.applied = true;
        run.updatedAt = now();
        broadcastRunUpdate(run);
        persistRuns(run.projectPath);

        return { success: true };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    }
  );

  ipcMain.handle(
    IPC.PIPELINE_DELETE_RUN,
    async (_event, payload: { runId: string; projectPath: string }) => {
      // Cancel if active
      const runCtx = activeRuns.get(payload.runId);
      if (runCtx) {
        runCtx.abortController.abort();
        if (runCtx.approvalResolve) {
          runCtx.approvalResolve(false);
        }
        activeRuns.delete(payload.runId);
      }

      allRuns.delete(payload.runId);
      persistRuns(payload.projectPath);
      broadcastRunsList(payload.projectPath);
      return { success: true };
    }
  );

  ipcMain.handle(
    IPC.PIPELINE_SAVE_WORKFLOW,
    async (_event, payload: { projectPath: string; filename: string; content: string }) => {
      const { projectPath, filename, content } = payload;

      // Validate filename
      if (!filename.endsWith('.yml') || /[/\\]/.test(filename) || filename.includes('..')) {
        return { success: false, error: 'Invalid filename: must end in .yml and contain no path separators' };
      }

      // Validate YAML content parses as a valid workflow
      try {
        parseWorkflow(content);
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }

      const dir = ensureWorkflowsDir(projectPath);
      fs.writeFileSync(path.join(dir, filename), content, 'utf8');
      return { success: true };
    }
  );

  ipcMain.handle(
    IPC.PIPELINE_DELETE_WORKFLOW,
    async (_event, payload: { projectPath: string; filename: string }) => {
      const { projectPath, filename } = payload;

      // Validate filename
      if (!filename.endsWith('.yml') || /[/\\]/.test(filename) || filename.includes('..')) {
        return { success: false, error: 'Invalid filename: must end in .yml and contain no path separators' };
      }

      const filePath = path.join(projectPath, FRAME_WORKFLOWS_DIR, filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return { success: true };
    }
  );

  // ── Send channels (fire-and-forget) ─────────────────────────────────────

  ipcMain.on(IPC.PIPELINE_LIST_RUNS, (_event, data: { projectPath: string }) => {
    // Clear stale runs from other projects (non-active only) to prevent unbounded growth
    for (const [id, run] of allRuns) {
      if (run.projectPath !== data.projectPath && !activeRuns.has(id)) {
        allRuns.delete(id);
      }
    }
    loadPersistedRuns(data.projectPath);
    broadcastRunsList(data.projectPath);
  });

  ipcMain.on(IPC.PIPELINE_GET_RUN, (_event, data: { runId: string }) => {
    const run = allRuns.get(data.runId);
    if (run) {
      broadcastRunUpdate(run);
    }
  });

  ipcMain.on(IPC.WATCH_PIPELINE, (_event, projectPath: string) => {
    watchWorkflows(projectPath);
    watchPrePushTrigger(projectPath);
  });

  ipcMain.on(IPC.UNWATCH_PIPELINE, () => {
    unwatchWorkflows();
    unwatchPrePushTrigger();
  });
}

// ─── File Watching ───────────────────────────────────────────────────────────

let watchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

function watchWorkflows(projectPath: string): void {
  unwatchWorkflows();

  const dir = path.join(projectPath, FRAME_WORKFLOWS_DIR);
  if (!fs.existsSync(dir)) return;

  try {
    workflowsWatcher = fs.watch(dir, (_eventType, filename) => {
      if (filename && !filename.endsWith('.yml') && !filename.endsWith('.yaml')) return;

      if (watchDebounceTimer) clearTimeout(watchDebounceTimer);
      watchDebounceTimer = setTimeout(() => {
        // Notify renderer that workflows changed so it can refetch
        broadcastRunsList(projectPath);
      }, 300);
    });
    workflowsWatcher.on('error', (err) => {
      console.warn('[Pipeline] Workflows watcher error:', (err as NodeJS.ErrnoException).code);
      unwatchWorkflows();
    });
  } catch (err) {
    console.error('Error watching workflows directory:', (err as Error).message);
  }
}

function unwatchWorkflows(): void {
  if (watchDebounceTimer) clearTimeout(watchDebounceTimer);
  if (workflowsWatcher) {
    workflowsWatcher.close();
    workflowsWatcher = null;
  }
}

// ─── Pre-push Trigger Watching ───────────────────────────────────────────────

/**
 * Start a pipeline run from an automated trigger (e.g. pre-push hook).
 * Extracts the common pipeline-start logic so it can be called from both
 * the IPC handler and the file watcher.
 */
async function startPipelineFromTrigger(
  projectPath: string,
  workflowId: string,
  trigger: PipelineTrigger
): Promise<void> {
  ensureWorkflowsDir(projectPath);
  const workflows = listWorkflows(projectPath);
  const workflow = workflows.find((w) => w.name === workflowId);

  if (!workflow) {
    console.error(`Workflow '${workflowId}' not found for trigger '${trigger}'`);
    return;
  }

  let branch: string;
  let baseSha: string;
  let headSha: string;

  try {
    branch = await execAsync('git symbolic-ref --short HEAD', projectPath);
    headSha = await execAsync('git rev-parse HEAD', projectPath);
    try {
      baseSha = await execAsync('git merge-base main HEAD', projectPath);
    } catch {
      try {
        baseSha = await execAsync('git merge-base master HEAD', projectPath);
      } catch {
        try {
          baseSha = await execAsync('git rev-parse HEAD~1', projectPath);
        } catch {
          baseSha = headSha;
        }
      }
    }
  } catch {
    branch = 'unknown';
    baseSha = '';
    headSha = '';
  }

  const run = buildRun(workflow, projectPath, trigger, branch, baseSha, headSha);
  const abortController = new AbortController();
  const runCtx: PipelineRunContext = {
    run,
    abortController,
    approvalResolve: null,
  };

  activeRuns.set(run.id, runCtx);
  allRuns.set(run.id, run);
  broadcastRunUpdate(run);
  broadcastRunsList(projectPath);

  executeRun(runCtx, workflow).catch((err) => {
    console.error('Pipeline run error:', (err as Error).message);
  });
}

function watchPrePushTrigger(projectPath: string): void {
  unwatchPrePushTrigger();

  const pipelinesDir = path.join(projectPath, FRAME_PIPELINES_DIR);
  if (!fs.existsSync(pipelinesDir)) {
    try {
      fs.mkdirSync(pipelinesDir, { recursive: true });
    } catch { /* ignore */ }
  }

  try {
    triggerWatcher = fs.watch(pipelinesDir, (eventType, filename) => {
      if (filename !== '.pre-push-trigger') return;

      const triggerFile = path.join(pipelinesDir, '.pre-push-trigger');
      if (!fs.existsSync(triggerFile)) return;

      // Read and delete trigger file
      try {
        fs.unlinkSync(triggerFile);
      } catch { /* ignore race */ }

      // Find push-enabled workflows and start them
      const workflows = listWorkflows(projectPath);
      for (const workflow of workflows) {
        if (workflow.on?.push) {
          startPipelineFromTrigger(projectPath, workflow.name, 'pre-push');
        }
      }
    });
    triggerWatcher.on('error', (err) => {
      console.warn('[Pipeline] Trigger watcher error:', (err as NodeJS.ErrnoException).code);
      unwatchPrePushTrigger();
    });
  } catch (err) {
    console.error('Error watching pre-push triggers:', (err as Error).message);
  }
}

function unwatchPrePushTrigger(): void {
  if (triggerWatcher) {
    triggerWatcher.close();
    triggerWatcher = null;
  }
}

// ─── Exports ─────────────────────────────────────────────────────────────────

/** Check if any pipeline runs are currently in progress */
function hasActiveRuns(): boolean {
  return activeRuns.size > 0;
}

export {
  init,
  setupIPC,
  watchWorkflows,
  unwatchWorkflows,
  watchPrePushTrigger,
  unwatchPrePushTrigger,
  hasActiveRuns,
};
