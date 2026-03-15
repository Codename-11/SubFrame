/**
 * PipelinePanel — Main pipeline panel supporting side-panel and full-view modes.
 * Shows workflow selector, run list, and run detail with tabs.
 */

import { useState, useMemo, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Play,
  Square,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  GitBranch,
  Workflow,
  ChevronDown,
  FileText,
  MessageSquare,
  FileDiff,
  ThumbsUp,
  ThumbsDown,
  Check,
  Maximize2,
  RotateCcw,
  Trash2,
  Pencil,
  Plus,
  Infinity as InfinityIcon,
} from 'lucide-react';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

import { cn } from '../lib/utils';
import { usePipeline, usePipelineWorkflows, usePipelineProgress } from '../hooks/usePipeline';
import { useUIStore } from '../stores/useUIStore';
import { PipelineTimeline } from './PipelineTimeline';
import { WorkflowEditorDialog } from './WorkflowEditor';
import { toast } from 'sonner';
import type {
  PipelineRun,
  PipelineRunStatus,
  PipelineArtifact,
  ContentArtifact,
  CommentArtifact,
  PatchArtifact,
  ArtifactSeverity,
  WorkflowDefinition,
} from '../../shared/ipcChannels';

// ─── Utilities ───────────────────────────────────────────────────────────────

function formatRelativeTime(dateString: string | undefined | null): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay === 1) return 'yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)}w ago`;
  return date.toLocaleDateString();
}

const STATUS_CONFIG: Record<PipelineRunStatus, { label: string; className: string; icon: React.ReactNode }> = {
  queued:    { label: 'Queued',    className: 'bg-bg-tertiary text-text-secondary',  icon: <Clock size={10} /> },
  running:   { label: 'Running',   className: 'bg-accent/20 text-accent',            icon: <Loader2 size={10} className="animate-spin" /> },
  paused:    { label: 'Paused',    className: 'bg-info/20 text-info',                icon: <Clock size={10} /> },
  completed: { label: 'Completed', className: 'bg-success/20 text-success',          icon: <CheckCircle2 size={10} /> },
  failed:    { label: 'Failed',    className: 'bg-error/20 text-error',              icon: <XCircle size={10} /> },
  cancelled: { label: 'Cancelled', className: 'bg-bg-tertiary text-text-muted',      icon: <Square size={10} /> },
};

const SEVERITY_COLORS: Record<ArtifactSeverity, string> = {
  error: 'text-error',
  warning: 'text-warning',
  info: 'text-info',
  suggestion: 'text-accent',
};

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Status badge for pipeline runs */
function StatusBadge({ status }: { status: PipelineRunStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium', config.className)}>
      {config.icon}
      {config.label}
    </span>
  );
}

/** Single run item in the list */
function RunListItem({
  run,
  isSelected,
  onSelect,
}: {
  run: PipelineRun;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const allStages = run.jobs.flatMap((j) => j.stages);
  const finishedCount = allStages.filter((s) => s.status === 'completed' || s.status === 'skipped').length;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full text-left px-3 py-2 border-b border-border-subtle transition-colors',
        isSelected ? 'bg-bg-tertiary' : 'hover:bg-bg-hover'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <StatusBadge status={run.status} />
          <span className="text-xs text-text-primary truncate font-medium">
            {run.workflowId}
          </span>
        </div>
        <span className="text-[10px] text-text-tertiary whitespace-nowrap">
          {formatRelativeTime(run.createdAt)}
        </span>
      </div>
      <div className="flex items-center gap-2 mt-1">
        <span className="inline-flex items-center gap-1 text-[10px] text-text-secondary">
          <GitBranch size={10} />
          {run.branch}
        </span>
        {allStages.length > 0 && (
          <span className="text-[10px] text-text-tertiary">
            {finishedCount}/{allStages.length} stages
          </span>
        )}
      </div>
    </button>
  );
}

/** Overview tab — timeline + artifact feed */
function OverviewTab({ run, onStageClick }: { run: PipelineRun; onStageClick: (id: string) => void }) {
  const allStages = run.jobs.flatMap((j) => j.stages);
  const sortedArtifacts = useMemo(
    () => [...run.artifacts].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [run.artifacts]
  );

  return (
    <div className="space-y-4">
      {/* Pipeline timeline */}
      <div className="p-3 bg-bg-secondary rounded-lg border border-border-subtle">
        <PipelineTimeline stages={allStages} onStageClick={onStageClick} />
      </div>

      {/* Artifact feed */}
      {sortedArtifacts.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[11px] font-medium text-text-secondary uppercase tracking-wide px-1">
            Artifacts
          </h4>
          {sortedArtifacts.map((artifact) => (
            <ArtifactCard key={artifact.id} artifact={artifact} />
          ))}
        </div>
      )}

      {sortedArtifacts.length === 0 && (
        <p className="text-xs text-text-muted text-center py-4">No artifacts yet</p>
      )}
    </div>
  );
}

/** Renders a single artifact inline */
function ArtifactCard({ artifact }: { artifact: PipelineArtifact }) {
  switch (artifact.type) {
    case 'content':
      return <ContentArtifactCard artifact={artifact} />;
    case 'comment':
      return <CommentArtifactCard artifact={artifact} />;
    case 'patch':
      return <PatchArtifactSummary artifact={artifact} />;
    default:
      return null;
  }
}

function ContentArtifactCard({ artifact }: { artifact: ContentArtifact }) {
  return (
    <div className="p-2.5 bg-bg-secondary rounded border border-border-subtle">
      <div className="flex items-center gap-1.5 mb-1.5">
        <FileText size={11} className="text-text-tertiary" />
        <span className="text-[11px] font-medium text-text-primary">{artifact.title}</span>
        <span className="text-[9px] text-text-muted ml-auto">{formatRelativeTime(artifact.createdAt)}</span>
      </div>
      <p className="text-[11px] text-text-secondary leading-relaxed whitespace-pre-wrap">{artifact.body}</p>
    </div>
  );
}

function CommentArtifactCard({ artifact }: { artifact: CommentArtifact }) {
  return (
    <div className="p-2.5 bg-bg-secondary rounded border border-border-subtle">
      <div className="flex items-center gap-1.5">
        <MessageSquare size={11} className={SEVERITY_COLORS[artifact.severity]} />
        <span className="text-[11px] text-text-secondary font-mono truncate">
          {artifact.file}:{artifact.line}
          {artifact.endLine ? `-${artifact.endLine}` : ''}
        </span>
        {artifact.category && (
          <span className="text-[9px] text-text-muted bg-bg-tertiary rounded px-1 py-0.5">
            {artifact.category}
          </span>
        )}
      </div>
      <p className={cn('text-[11px] mt-1 leading-relaxed', SEVERITY_COLORS[artifact.severity])}>
        {artifact.message}
      </p>
    </div>
  );
}

function PatchArtifactSummary({ artifact }: { artifact: PatchArtifact }) {
  return (
    <div className="p-2.5 bg-bg-secondary rounded border border-border-subtle">
      <div className="flex items-center gap-1.5">
        <FileDiff size={11} className="text-accent" />
        <span className="text-[11px] font-medium text-text-primary">{artifact.title}</span>
        {artifact.applied && (
          <span className="text-[9px] text-success bg-success/10 rounded px-1 py-0.5 ml-auto flex items-center gap-0.5">
            <Check size={8} /> Applied
          </span>
        )}
      </div>
      <p className="text-[11px] text-text-secondary mt-1">{artifact.explanation}</p>
      <div className="flex flex-wrap gap-1 mt-1.5">
        {artifact.files.map((file) => (
          <span key={file} className="text-[9px] text-text-muted font-mono bg-bg-tertiary rounded px-1 py-0.5">
            {file}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Critique tab — shows comment artifacts grouped by severity */
function CritiqueView({ run }: { run: PipelineRun }) {
  const comments = useMemo(
    () => run.artifacts.filter((a): a is CommentArtifact => a.type === 'comment'),
    [run.artifacts]
  );

  const grouped = useMemo(() => {
    const groups: Record<ArtifactSeverity, CommentArtifact[]> = { error: [], warning: [], info: [], suggestion: [] };
    for (const c of comments) {
      groups[c.severity].push(c);
    }
    return groups;
  }, [comments]);

  if (comments.length === 0) {
    return <p className="text-xs text-text-muted text-center py-6">No critique comments</p>;
  }

  const severityOrder: ArtifactSeverity[] = ['error', 'warning', 'suggestion', 'info'];

  return (
    <div className="space-y-3">
      {severityOrder.map((severity) => {
        const items = grouped[severity];
        if (items.length === 0) return null;
        return (
          <div key={severity}>
            <h4 className={cn('text-[11px] font-medium uppercase tracking-wide mb-1.5 px-1', SEVERITY_COLORS[severity])}>
              {severity} ({items.length})
            </h4>
            <div className="space-y-1.5">
              {items.map((c) => (
                <CommentArtifactCard key={c.id} artifact={c} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Patches tab — shows patch artifacts with apply actions */
function PatchReview({
  run,
  onApplyPatch,
}: {
  run: PipelineRun;
  onApplyPatch: (patchId: string) => void;
}) {
  const patches = useMemo(
    () => run.artifacts.filter((a): a is PatchArtifact => a.type === 'patch'),
    [run.artifacts]
  );

  if (patches.length === 0) {
    return <p className="text-xs text-text-muted text-center py-6">No patches</p>;
  }

  return (
    <div className="space-y-2">
      {patches.map((patch) => (
        <div key={patch.id} className="p-2.5 bg-bg-secondary rounded border border-border-subtle">
          <div className="flex items-center gap-1.5 mb-1.5">
            <FileDiff size={11} className="text-accent" />
            <span className="text-[11px] font-medium text-text-primary">{patch.title}</span>
          </div>
          <p className="text-[11px] text-text-secondary mb-2">{patch.explanation}</p>

          {/* Files affected */}
          <div className="flex flex-wrap gap-1 mb-2">
            {patch.files.map((file) => (
              <span key={file} className="text-[9px] text-text-muted font-mono bg-bg-tertiary rounded px-1 py-0.5">
                {file}
              </span>
            ))}
          </div>

          {/* Diff preview */}
          {patch.diff && (
            <pre className="text-[10px] text-text-secondary font-mono bg-bg-deep rounded p-2 overflow-x-auto max-h-40 mb-2 border border-border-subtle">
              {patch.diff}
            </pre>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2">
            {patch.applied ? (
              <span className="text-[10px] text-success flex items-center gap-1">
                <Check size={10} /> Applied
              </span>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] text-accent hover:text-accent"
                onClick={() => onApplyPatch(patch.id)}
              >
                <ThumbsUp size={10} className="mr-1" />
                Apply
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Log tab — shows real-time log output per stage, falling back to persisted stage.logs */
function PipelineLogView({
  run,
  logs,
  initialStageId,
}: {
  run: PipelineRun;
  logs: Record<string, string[]>;
  initialStageId?: string | null;
}) {
  const allStages = run.jobs.flatMap((j) => j.stages);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(
    initialStageId ?? allStages[0]?.id ?? null
  );

  // Reset selected stage when run changes or when initialStageId changes
  useEffect(() => {
    if (initialStageId) {
      setSelectedStageId(initialStageId);
    } else if (!allStages.some((s) => s.id === selectedStageId)) {
      setSelectedStageId(allStages[0]?.id ?? null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run.id, initialStageId]);

  const selectedStage = allStages.find((s) => s.id === selectedStageId);

  // Merge real-time logs with persisted stage.logs (deduplicated)
  const stageLog = useMemo(() => {
    const realTime = selectedStageId ? (logs[selectedStageId] ?? []) : [];
    const persisted = selectedStage?.logs ?? [];
    // If we have real-time logs, prefer those (they're the live stream)
    if (realTime.length > 0) return realTime;
    // Otherwise fall back to persisted logs from the run data
    return persisted;
  }, [selectedStageId, logs, selectedStage]);

  return (
    <div className="space-y-2">
      {/* Stage selector */}
      <div className="flex gap-1 flex-wrap">
        {allStages.map((stage) => (
          <button
            key={stage.id}
            type="button"
            onClick={() => setSelectedStageId(stage.id)}
            className={cn(
              'text-[10px] px-2 py-1 rounded transition-colors',
              selectedStageId === stage.id
                ? 'bg-accent/20 text-accent'
                : 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover'
            )}
          >
            {stage.name}
          </button>
        ))}
      </div>

      {/* Log output */}
      <div className="bg-bg-deep rounded border border-border-subtle p-2 min-h-[120px] max-h-[300px] overflow-auto">
        {stageLog.length > 0 ? (
          <pre className="text-[10px] font-mono whitespace-pre-wrap">
            {stageLog.map((line, i) => {
              const isHeartbeat = line.startsWith('[Agent]');
              return (
                <div
                  key={i}
                  className={cn(
                    isHeartbeat ? 'text-text-muted italic' : 'text-text-secondary'
                  )}
                >
                  {line}
                </div>
              );
            })}
          </pre>
        ) : (
          <p className="text-[10px] text-text-muted text-center py-4">
            {selectedStage?.status === 'pending'
              ? 'Stage has not started yet'
              : selectedStage?.status === 'running'
                ? 'Waiting for output...'
                : 'No log output'}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Main Panel ──────────────────────────────────────────────────────────────

interface PipelinePanelProps {
  isFullView?: boolean;
}

export function PipelinePanel({ isFullView = false }: PipelinePanelProps) {
  const {
    runs,
    selectedRun,
    selectedRunId,
    setSelectedRunId,
    isLoading,
    startPipeline,
    cancelPipeline,
    approveStage,
    rejectStage,
    applyPatch,
    deleteRun,
  } = usePipeline();

  const { workflows, saveWorkflow, deleteWorkflow } = usePipelineWorkflows();
  const { logs } = usePipelineProgress(selectedRunId);
  const setFullViewContent = useUIStore((s) => s.setFullViewContent);
  const closeRightPanel = useUIStore((s) => s.closeRightPanel);

  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Workflow editor dialog state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<WorkflowDefinition | null>(null);
  const [editingFilename, setEditingFilename] = useState<string | null>(null);

  const handleEditWorkflow = (workflow: WorkflowDefinition) => {
    setEditingWorkflow(workflow);
    setEditingFilename(workflow.filename ?? `${workflow.name}.yml`);
    setEditorOpen(true);
  };

  const handleNewWorkflow = () => {
    setEditingWorkflow(null);
    setEditingFilename(null);
    setEditorOpen(true);
  };

  const handleSaveWorkflow = (filename: string, content: string) => {
    saveWorkflow.mutate(
      { filename, content },
      {
        onSuccess: (result) => {
          if (result.success) {
            toast.success(`Workflow saved: ${filename}`);
            setEditorOpen(false);
            // Refetch handled by onSuccess invalidation in the hook
          } else {
            toast.error(`Save failed: ${result.error ?? 'Unknown error'}`);
          }
        },
        onError: (err) => toast.error(`Save failed: ${(err as Error).message}`),
      },
    );
  };

  const handleDeleteWorkflow = (filename: string) => {
    deleteWorkflow.mutate(filename, {
      onSuccess: () => {
        toast.success(`Workflow deleted: ${filename}`);
        // Refetch handled by onSuccess invalidation in the hook
      },
      onError: (err) => toast.error(`Delete failed: ${(err as Error).message}`),
    });
  };

  const activeWorkflow = selectedWorkflowId
    ? workflows.find((w) => w.name === selectedWorkflowId)
    : workflows[0] ?? null;

  const handleStartPipeline = () => {
    if (!activeWorkflow) return;
    startPipeline.mutate({ workflowId: activeWorkflow.name, trigger: 'manual' });
  };

  const handleCancelRun = () => {
    if (!selectedRunId) return;
    cancelPipeline.mutate(selectedRunId);
  };

  const handleApproveStage = (stageId: string) => {
    if (!selectedRunId) return;
    approveStage.mutate({ runId: selectedRunId, stageId });
  };

  const handleRejectStage = (stageId: string) => {
    if (!selectedRunId) return;
    rejectStage.mutate({ runId: selectedRunId, stageId });
  };

  const handleRerunPipeline = () => {
    if (!selectedRun) return;
    startPipeline.mutate({ workflowId: selectedRun.workflowId, trigger: 'manual' });
  };

  /** Re-run the same workflow with max-turns set to unlimited */
  const handleRerunUnlimited = () => {
    if (!selectedRun) return;
    startPipeline.mutate({
      workflowId: selectedRun.workflowId,
      trigger: 'manual',
      overrides: { 'max-turns': '0' },
    });
  };

  const handleDeleteRun = () => {
    if (!selectedRunId) return;
    deleteRun.mutate(selectedRunId);
  };

  const handleApplyPatch = (patchId: string) => {
    if (!selectedRunId) return;
    applyPatch.mutate({ runId: selectedRunId, patchId });
  };

  const [logStageId, setLogStageId] = useState<string | null>(null);

  const handleStageClick = (stageId: string) => {
    setLogStageId(stageId);
    setActiveTab('log');
  };

  // Find stages awaiting approval (run must be paused, stage completed with requireApproval)
  const pendingApprovalStages = useMemo(() => {
    if (!selectedRun || selectedRun.status !== 'paused') return [];
    return selectedRun.jobs
      .flatMap((j) => j.stages)
      .filter((s) => {
        if (s.status !== 'completed') return false;
        if (s.requireApproval === true) return true;
        if (s.requireApproval === 'if_patches') {
          return selectedRun.artifacts.some((a) => a.type === 'patch' && a.stageId === s.id);
        }
        return false;
      });
  }, [selectedRun]);

  // Detect if run failed due to max-turns (any stage)
  const hasMaxTurnsFailure = useMemo(() => {
    if (!selectedRun) return false;
    return selectedRun.jobs
      .flatMap((j) => j.stages)
      .some((s) => s.failureReason === 'max-turns');
  }, [selectedRun]);

  // ─── Render sections ────────────────────────────────────────────────────

  const toolbar = (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border-subtle bg-bg-primary">
      {/* Workflow selector */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1 text-text-secondary">
            <Workflow size={12} />
            {activeWorkflow?.name ?? 'No workflows'}
            <ChevronDown size={10} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[220px]">
          {workflows.map((w) => {
            const stepCount = Object.values(w.jobs).reduce((n, j) => n + j.steps.length, 0);
            const isActive = activeWorkflow?.name === w.name;
            return (
              <DropdownMenuItem
                key={w.name}
                onClick={() => setSelectedWorkflowId(w.name)}
                className={cn('flex flex-col items-start gap-0.5 py-1.5', isActive && 'bg-accent-subtle')}
              >
                <div className="flex items-center gap-1.5 w-full">
                  <span className="text-[11px] font-medium">{w.name}</span>
                  <span className="text-[9px] text-text-muted ml-auto">{stepCount} step{stepCount !== 1 ? 's' : ''}</span>
                </div>
                {w.description && (
                  <span className="text-[10px] text-text-tertiary leading-tight">{w.description}</span>
                )}
              </DropdownMenuItem>
            );
          })}
          {workflows.length === 0 && (
            <DropdownMenuItem disabled className="text-[11px] text-text-muted">
              No workflows found
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edit active workflow */}
      {activeWorkflow && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-1.5 text-text-tertiary hover:text-accent"
          onClick={() => handleEditWorkflow(activeWorkflow)}
          title="Edit workflow"
        >
          <Pencil size={12} />
        </Button>
      )}

      {/* New workflow */}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-1.5 text-text-tertiary hover:text-accent"
        onClick={handleNewWorkflow}
        title="New workflow"
      >
        <Plus size={12} />
      </Button>

      <div className="flex-1" />

      {/* Full-view popout (side-panel only) */}
      {!isFullView && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => { closeRightPanel(); setFullViewContent('pipeline'); }}
          className="h-7 px-2 text-text-tertiary hover:text-accent cursor-pointer shrink-0"
          title="Open full view (Ctrl+Shift+Y)"
        >
          <Maximize2 size={14} />
        </Button>
      )}

      {/* Run pipeline button */}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-[11px] gap-1 text-accent hover:text-accent"
        onClick={handleStartPipeline}
        disabled={!activeWorkflow}
      >
        <Play size={12} />
        Run
      </Button>
    </div>
  );

  const runList = (
    <div className={cn('flex flex-col', isFullView ? 'w-[240px] border-r border-border-subtle' : '')}>
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={16} className="animate-spin text-text-muted" />
        </div>
      ) : runs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <Workflow size={20} className="text-text-muted" />
          <p className="text-xs text-text-muted">No pipeline runs</p>
        </div>
      ) : (
        runs.map((run) => (
          <RunListItem
            key={run.id}
            run={run}
            isSelected={run.id === selectedRunId}
            onSelect={() => setSelectedRunId(run.id)}
          />
        ))
      )}
    </div>
  );

  const runDetail = selectedRun ? (
    <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
      {/* Run header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border-subtle shrink-0">
        <StatusBadge status={selectedRun.status} />
        <span className="text-xs font-medium text-text-primary truncate">
          {selectedRun.workflowId}
        </span>
        <span className="inline-flex items-center gap-1 text-[10px] text-text-secondary">
          <GitBranch size={10} />
          {selectedRun.branch}
        </span>
        <div className="flex-1" />

        {/* Approval buttons for paused stages */}
        {pendingApprovalStages.length > 0 && (
          <div className="flex items-center gap-1">
            {pendingApprovalStages.map((stage) => (
              <div key={stage.id} className="flex items-center gap-1">
                <span className="text-[9px] text-text-tertiary">{stage.name}:</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 text-success hover:text-success"
                  onClick={() => handleApproveStage(stage.id)}
                  title="Approve stage"
                >
                  <ThumbsUp size={10} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 text-error hover:text-error"
                  onClick={() => handleRejectStage(stage.id)}
                  title="Reject stage"
                >
                  <ThumbsDown size={10} />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Cancel button for running pipelines */}
        {(selectedRun.status === 'running' || selectedRun.status === 'queued') && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] gap-1 text-error hover:text-error"
            onClick={handleCancelRun}
          >
            <Square size={10} />
            Cancel
          </Button>
        )}

        {/* Re-run + Delete for finished runs */}
        {(selectedRun.status === 'completed' || selectedRun.status === 'failed' || selectedRun.status === 'cancelled') && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] gap-1 text-accent hover:text-accent"
              onClick={handleRerunPipeline}
              title="Re-run this workflow"
            >
              <RotateCcw size={10} />
              Re-run
            </Button>
            {hasMaxTurnsFailure && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] gap-1 text-warning hover:text-warning"
                onClick={handleRerunUnlimited}
                title="Re-run with unlimited AI turns (bypasses max-turns limit)"
              >
                <InfinityIcon size={10} />
                Unlimited
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] gap-1 text-text-tertiary hover:text-error"
              onClick={handleDeleteRun}
              title="Delete this run"
            >
              <Trash2 size={10} />
            </Button>
          </>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 px-3 border-b border-border-subtle shrink-0">
        {(['overview', 'critique', 'patches', 'log'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              'text-[11px] h-7 px-2 capitalize transition-colors relative',
              activeTab === tab
                ? 'text-accent after:absolute after:bottom-0 after:inset-x-0 after:h-0.5 after:bg-accent'
                : 'text-text-secondary hover:text-text-primary'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Scrollable tab content */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
            >
              {activeTab === 'overview' && (
                <OverviewTab run={selectedRun} onStageClick={handleStageClick} />
              )}
              {activeTab === 'critique' && (
                <CritiqueView run={selectedRun} />
              )}
              {activeTab === 'patches' && (
                <PatchReview run={selectedRun} onApplyPatch={handleApplyPatch} />
              )}
              {activeTab === 'log' && (
                <PipelineLogView run={selectedRun} logs={logs} initialStageId={logStageId} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </ScrollArea>
    </div>
  ) : null;

  // ─── Layout ─────────────────────────────────────────────────────────────

  const workflowEditorDialog = (
    <WorkflowEditorDialog
      open={editorOpen}
      onOpenChange={setEditorOpen}
      editingWorkflow={editingWorkflow}
      editingFilename={editingFilename}
      onSave={handleSaveWorkflow}
      onDelete={handleDeleteWorkflow}
    />
  );

  if (isFullView) {
    return (
      <div className="flex flex-col h-full bg-bg-primary">
        {toolbar}
        <div className="flex flex-1 min-h-0">
          <ScrollArea className="w-[240px] border-r border-border-subtle">
            {runList}
          </ScrollArea>
          {runDetail ?? (
            <div className="flex flex-col items-center justify-center flex-1 py-12 gap-2">
              <Workflow size={24} className="text-text-muted" />
              <p className="text-xs text-text-muted">Select a run to view details</p>
            </div>
          )}
        </div>
        {workflowEditorDialog}
      </div>
    );
  }

  // Side panel mode — single column, no nested scroll areas
  return (
    <div className="flex flex-col h-full bg-bg-primary">
      {toolbar}
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Run list — shrink to fit, scrollable if many runs */}
        <div className="flex-shrink-0 max-h-[40%] overflow-y-auto border-b border-border-subtle">
          {runList}
        </div>

        {/* Run detail — takes remaining space (direct flex child for unbroken height chain) */}
        {runDetail ?? (
          <div className="flex flex-col items-center justify-center flex-1 py-12 gap-2">
            <Workflow size={24} className="text-text-muted" />
            <p className="text-xs text-text-muted">Select a run to view details</p>
          </div>
        )}
      </div>
      {workflowEditorDialog}
    </div>
  );
}
