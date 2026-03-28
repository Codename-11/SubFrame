/**
 * OnboardingDialog — Multi-step dialog for project intelligence onboarding.
 *
 * Persistent stepper shows all 4 steps with status indicators.
 * Steps: Detect → Analyze (AI) → Review & Import → Complete
 *
 * Users can skip AI analysis, go back to rerun, and rollback initialization.
 */

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from './ui/alert-dialog';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { ScrollArea } from './ui/scroll-area';
import { cn } from '../lib/utils';
import { focusActivityBar } from '../lib/activityBarEvents';
import {
  Loader2,
  Search,
  Brain,
  CheckCircle,
  FileText,
  Package,
  BookOpen,
  Settings2,
  Terminal,
  AlertCircle,
  RotateCcw,
  Undo2,
  PartyPopper,
  SkipForward,
  ChevronRight,
  X,
  FolderOpen,
  File,
  Eye,
  ChevronDown,
} from 'lucide-react';
import type {
  AIToolConfig,
  OnboardingDetectionResult,
  OnboardingAnalysisResult,
  OnboardingImportSelections,
  OnboardingImportResult,
  OnboardingAnalysisOptions,
  DetectedIntelligence,
} from '../../shared/ipcChannels';
import { EmbeddedTerminal } from './EmbeddedTerminal';

// ── Step definitions ────────────────────────────────────────────────────────

type StepIndex = 0 | 1 | 2 | 3;
type StepStatus = 'completed' | 'active' | 'pending' | 'skipped' | 'error';

interface StepDef {
  label: string;
  subtitle: string;
  icon: typeof Search;
}

const STEPS: StepDef[] = [
  { label: 'Detect', subtitle: 'Scan project files', icon: Search },
  { label: 'Analyze', subtitle: 'AI-powered analysis', icon: Brain },
  { label: 'Review', subtitle: 'Select & import', icon: FileText },
  { label: 'Complete', subtitle: 'Ready to go', icon: PartyPopper },
];

// ── Category config ──────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<
  string,
  { icon: typeof Brain; color: string; label: string }
> = {
  'ai-config': { icon: Brain, color: 'text-amber-400', label: 'AI Config' },
  'project-metadata': { icon: Package, color: 'text-blue-400', label: 'Metadata' },
  'documentation': { icon: BookOpen, color: 'text-green-400', label: 'Docs' },
  'dev-config': { icon: Settings2, color: 'text-zinc-400', label: 'Dev Config' },
};

// ── Analysis phases (ordered) ────────────────────────────────────────────────

const ANALYSIS_PHASES = ['detecting', 'gathering', 'analyzing', 'parsing', 'importing'] as const;
type AnalysisPhase = (typeof ANALYSIS_PHASES)[number];

// ── Props ────────────────────────────────────────────────────────────────────

interface OnboardingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detection: OnboardingDetectionResult | null;
  analysisResult: OnboardingAnalysisResult | null;
  progress: { phase: string; message: string; progress: number } | null;
  terminalId: string | null;
  activityStreamId: string | null;
  isAnalyzing: boolean;
  isImporting: boolean;
  error: string | null;
  aiToolConfig: AIToolConfig | null;
  onAnalyze: (options?: OnboardingAnalysisOptions) => void;
  onImport: (selections: OnboardingImportSelections) => void;
  onCancel: () => void;
  onViewTerminal: () => void;
  onRetry: () => void;
  onRollback: () => void;
  isRollingBack: boolean;
  importResult: OnboardingImportResult | null;
  onPreviewPrompt: (options?: OnboardingAnalysisOptions) => Promise<{ prompt: string; contextSize: number }>;
  onBrowseFiles: (type: 'file' | 'directory') => Promise<string[]>;
  stalled?: boolean;
  stallDurationMs?: number;
  timeoutMs?: number | null;
}

// ── Component ────────────────────────────────────────────────────────────────

export function OnboardingDialog({
  open,
  onOpenChange,
  detection,
  analysisResult,
  progress,
  terminalId,
  activityStreamId,
  isAnalyzing,
  isImporting,
  error,
  aiToolConfig,
  onAnalyze,
  onImport,
  onCancel,
  onViewTerminal,
  onRetry,
  onRollback,
  isRollingBack,
  importResult,
  onPreviewPrompt,
  onBrowseFiles,
  stalled,
  stallDurationMs,
  timeoutMs,
}: OnboardingDialogProps) {
  const [activeStep, setActiveStep] = useState<StepIndex>(0);
  const [analysisSkipped, setAnalysisSkipped] = useState(false);
  const [selections, setSelections] = useState<OnboardingImportSelections>({
    structure: true,
    projectNotes: true,
    taskIds: [],
  });

  // Inline terminal output state
  const [showOutput, setShowOutput] = useState(false);
  const suppressCancelRef = useRef(false);
  const [confirmRollback, setConfirmRollback] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  // Elapsed timer for analyzing phase
  const [analyzeStartTime, setAnalyzeStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  // Advanced analysis options
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customContext, setCustomContext] = useState('');
  const [extraFiles, setExtraFiles] = useState<{path: string; type: 'file' | 'directory'}[]>([]);
  const [promptPreview, setPromptPreview] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [selectedToolId, setSelectedToolId] = useState<string | null>(aiToolConfig?.activeTool.id ?? null);
  const availableTools = useMemo(
    () => Object.values(aiToolConfig?.availableTools ?? {}),
    [aiToolConfig]
  );
  const selectedTool = useMemo(
    () => availableTools.find((tool) => tool.id === selectedToolId) ?? aiToolConfig?.activeTool ?? null,
    [availableTools, aiToolConfig, selectedToolId]
  );

  const buildAnalysisOptions = useCallback((base?: Partial<OnboardingAnalysisOptions>): OnboardingAnalysisOptions | undefined => {
    const opts: OnboardingAnalysisOptions = { ...base };
    if (selectedToolId) opts.toolId = selectedToolId;
    if (customContext.trim()) opts.customContext = customContext.trim();
    if (extraFiles.length > 0) opts.extraFiles = extraFiles.map((f) => f.path);
    return Object.keys(opts).length > 0 ? opts : undefined;
  }, [customContext, extraFiles, selectedToolId]);

  useEffect(() => {
    if (!selectedToolId && aiToolConfig?.activeTool.id) {
      setSelectedToolId(aiToolConfig.activeTool.id);
    }
  }, [aiToolConfig?.activeTool.id, selectedToolId]);

  // ── Auto-advance steps based on external state ──

  // Detection arrived → step 0 is done, advance to step 1
  useEffect(() => {
    if (detection && activeStep === 0) {
      setActiveStep(1);
    }
  }, [detection, activeStep]);

  // Analysis started → go to step 1
  useEffect(() => {
    if (isAnalyzing) {
      setActiveStep(1);
      setAnalysisSkipped(false);
    }
  }, [isAnalyzing]);

  useEffect(() => {
    if (isAnalyzing && terminalId) {
      setShowOutput(true);
    }
  }, [isAnalyzing, terminalId]);

  // Analysis completed → advance to review
  useEffect(() => {
    if (analysisResult) {
      setActiveStep(2);
      setAnalysisSkipped(false);
      setSelections((prev) => ({
        ...prev,
        taskIds: analysisResult.suggestedTasks.map((_, i) => i),
      }));
    }
  }, [analysisResult]);

  // Import completed → advance to complete
  useEffect(() => {
    if (importResult) {
      setActiveStep(3);
    }
  }, [importResult]);

  // Reset when retry clears state
  useEffect(() => {
    if (!isAnalyzing && !analysisResult && !error && detection) {
      setActiveStep(1);
    }
  }, [isAnalyzing, analysisResult, error, detection]);

  // Auto-show output when analyzing phase begins, track elapsed time
  useEffect(() => {
    if (progress?.phase === 'analyzing' && isAnalyzing) {
      setShowOutput(true);
      if (!analyzeStartTime) setAnalyzeStartTime(Date.now());
    } else if (progress?.phase && progress.phase !== 'analyzing') {
      setAnalyzeStartTime(null);
      setElapsed(0);
    }
  }, [progress?.phase, isAnalyzing, analyzeStartTime]);

  // Elapsed timer tick (1s interval during analyzing)
  useEffect(() => {
    if (!analyzeStartTime || !isAnalyzing) return;
    const tick = setInterval(() => {
      setElapsed(Math.floor((Date.now() - analyzeStartTime) / 1000));
    }, 1000);
    return () => clearInterval(tick);
  }, [analyzeStartTime, isAnalyzing]);

  // Reset transient state on step change
  useEffect(() => {
    setConfirmRollback(false);
    if (activeStep === 0) {
      setShowOutput(false);
      setAnalyzeStartTime(null);
      setElapsed(0);
    }
  }, [activeStep]);

  // Reset local state when dialog opens fresh
  useEffect(() => {
    if (open) {
      suppressCancelRef.current = false;
      setAnalysisSkipped(false);
      setConfirmRollback(false);
      setShowCloseConfirm(false);
      setShowAdvanced(false);
      setPromptPreview(null);
      setIsLoadingPreview(false);
      // Note: don't reset extraFiles/customContext — preserve user's configuration across reopens
    }
  }, [open]);

  // Clear stale prompt preview when inputs change
  const extraFilesKey = extraFiles.map(f => f.path).join('\0');
  useEffect(() => {
    setPromptPreview(null);
  }, [customContext, extraFilesKey]);

  // ── Computed state ──

  const groupedDetections = useMemo(() => {
    if (!detection) return {};
    const groups: Record<string, DetectedIntelligence[]> = {};
    for (const item of detection.detected) {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    }
    return groups;
  }, [detection]);

  const currentPhaseIndex = useMemo(() => {
    if (!progress) return -1;
    return ANALYSIS_PHASES.indexOf(progress.phase as AnalysisPhase);
  }, [progress]);

  // Compute status for each step
  const stepStatuses: StepStatus[] = useMemo(() => {
    const s: StepStatus[] = ['pending', 'pending', 'pending', 'pending'];

    // Step 0: Detect
    if (detection) s[0] = 'completed';
    if (activeStep === 0) s[0] = 'active';

    // Step 1: Analyze
    if (activeStep === 1) {
      s[1] = error ? 'error' : 'active';
    } else if (analysisResult) {
      s[1] = 'completed';
    } else if (analysisSkipped) {
      s[1] = 'skipped';
    }

    // Step 2: Review
    if (activeStep === 2) {
      s[2] = 'active';
    } else if (importResult) {
      s[2] = 'completed';
    } else if (analysisSkipped) {
      s[2] = 'skipped';
    }

    // Step 3: Complete
    if (activeStep === 3) {
      s[3] = 'active';
    } else if (analysisSkipped && !importResult) {
      s[3] = 'skipped';
    }

    return s;
  }, [activeStep, detection, analysisResult, analysisSkipped, error, importResult]);

  const toggleTask = (index: number) => {
    setSelections((prev) => ({
      ...prev,
      taskIds: prev.taskIds.includes(index)
        ? prev.taskIds.filter((id) => id !== index)
        : [...prev.taskIds, index],
    }));
  };

  // Navigate to a step (only completed/error steps are clickable to go back)
  const navigateToStep = (index: StepIndex) => {
    const status = stepStatuses[index];
    if (status === 'completed' || status === 'error' || status === 'skipped') {
      // Going back to analyze: reset analysis state so user can rerun
      if (index === 1 && !isAnalyzing) {
        onRetry();
        setAnalysisSkipped(false);
      }
      setActiveStep(index);
    }
  };

  const handleSkipAnalysis = () => {
    setAnalysisSkipped(true);
    onOpenChange(false);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!nextOpen && (isAnalyzing || isImporting || isRollingBack) && !suppressCancelRef.current) {
        // Show confirmation instead of immediately cancelling
        setShowCloseConfirm(true);
        return; // Don't close yet
      }
      suppressCancelRef.current = false;
      onOpenChange(nextOpen);
    }}>
      <DialogContent
        className="sm:max-w-2xl bg-bg-primary border-border-subtle !flex !flex-col max-h-[80vh] overflow-hidden p-0 gap-0"
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">Project Setup</DialogTitle>
        {/* ── Stepper ──────────────────────────────────────────────────── */}
        <div className="shrink-0 flex items-start justify-between gap-1 px-7 pt-7 pb-2">
          {STEPS.map((stepDef, index) => {
            const status = stepStatuses[index];
            const isClickable =
              index !== activeStep &&
              !isAnalyzing &&
              !isImporting &&
              (status === 'completed' || status === 'error' || status === 'skipped');

            return (
              <div key={index} className="flex items-start flex-1 min-w-0">
                {/* Step indicator + labels */}
                <button
                  type="button"
                  onClick={() => isClickable && navigateToStep(index as StepIndex)}
                  disabled={!isClickable}
                  className={cn(
                    'flex flex-col items-center gap-1 min-w-0 flex-1 group',
                    isClickable && 'cursor-pointer',
                    !isClickable && 'cursor-default'
                  )}
                >
                  {/* Circle */}
                  <div
                    className={cn(
                      'relative flex items-center justify-center size-8 rounded-full border-2 transition-all duration-200',
                      status === 'completed' && 'border-success bg-success/10',
                      status === 'active' && 'border-accent bg-accent/10',
                      status === 'error' && 'border-error bg-error/10',
                      status === 'skipped' && 'border-border-default bg-bg-tertiary border-dashed',
                      status === 'pending' && 'border-border-default bg-bg-secondary',
                      isClickable && 'group-hover:ring-2 group-hover:ring-accent/20'
                    )}
                  >
                    {status === 'completed' && (
                      <CheckCircle className="size-4 text-success" />
                    )}
                    {status === 'active' && !isAnalyzing && !isImporting && (
                      <stepDef.icon className="size-4 text-accent" />
                    )}
                    {status === 'active' && (isAnalyzing || isImporting) && (
                      <Loader2 className="size-4 text-accent animate-spin" />
                    )}
                    {status === 'error' && (
                      <AlertCircle className="size-4 text-error" />
                    )}
                    {status === 'skipped' && (
                      <SkipForward className="size-3.5 text-text-muted" />
                    )}
                    {status === 'pending' && (
                      <span className="text-xs font-medium text-text-muted">{index + 1}</span>
                    )}
                  </div>

                  {/* Label */}
                  <span
                    className={cn(
                      'text-xs font-medium leading-tight',
                      status === 'active' && 'text-text-primary',
                      status === 'completed' && 'text-success',
                      status === 'error' && 'text-error',
                      status === 'skipped' && 'text-text-muted',
                      status === 'pending' && 'text-text-muted'
                    )}
                  >
                    {stepDef.label}
                  </span>

                  {/* Subtitle */}
                  <span className="text-[10px] text-text-muted leading-tight text-center">
                    {status === 'skipped' ? 'Skipped' : stepDef.subtitle}
                  </span>
                </button>

                {/* Connector line */}
                {index < STEPS.length - 1 && (
                  <div className="flex items-center pt-3.5 px-0.5 flex-shrink-0">
                    <div
                      className={cn(
                        'h-0.5 w-4 sm:w-6 rounded-full transition-colors',
                        stepStatuses[index] === 'completed' ? 'bg-success/40' : 'bg-border-default'
                      )}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="shrink-0 h-px bg-border-subtle" />

        {/* ── Step Content ─────────────────────────────────────────────── */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">

          {/* ── Step 0: Detection Summary ──────────────────────────────── */}
          {activeStep === 0 && !detection && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              {error ? (
                <>
                  <AlertCircle className="size-6 text-error" />
                  <p className="text-sm text-error">Detection failed</p>
                  <p className="text-xs text-text-muted text-center max-w-xs">{error}</p>
                </>
              ) : (
                <>
                  <Loader2 className="size-6 text-accent animate-spin" />
                  <p className="text-sm text-text-secondary">Scanning project files...</p>
                </>
              )}
            </div>
          )}

          {/* ── Step 1: AI Analysis ────────────────────────────────────── */}
          {activeStep === 1 && (
            <div className="space-y-4">
              {/* Detection summary (compact, always visible as context) */}
              {detection && (
                <div className="rounded-md border border-border-subtle bg-bg-secondary p-2.5">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Search className="size-3.5 text-accent" />
                    <span className="text-xs font-medium text-text-primary">
                      {detection.detected.length} intelligence files detected
                    </span>
                    <span className="text-[10px] text-text-muted ml-auto">
                      {detection.sourceFileCount} source files • {detection.primaryLanguage}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(groupedDetections).map(([category, items]) => {
                      const config = CATEGORY_CONFIG[category] ?? {
                        icon: FileText, color: 'text-text-muted', label: category,
                      };
                      const Icon = config.icon;
                      return (
                        <span
                          key={category}
                          className="inline-flex items-center gap-1 rounded bg-bg-tertiary px-1.5 py-0.5 text-[10px] text-text-secondary"
                        >
                          <Icon className={cn('size-3', config.color)} />
                          {config.label} ({items.length})
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Not worth analyzing warning */}
              {detection && !detection.worthAnalyzing && (
                <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 p-2.5">
                  <AlertCircle className="size-4 text-warning shrink-0 mt-0.5" />
                  <p className="text-xs text-warning">
                    Not enough project intelligence files for meaningful analysis.
                    Consider adding a README, CLAUDE.md, or other documentation first.
                  </p>
                </div>
              )}

              {/* Analysis not started yet */}
              {!isAnalyzing && !error && !analysisResult && (
                <div className="space-y-3">
                  <div className="flex flex-col items-center py-3 gap-2">
                    <Brain className="size-8 text-accent/60" />
                    <div className="text-center">
                      <p className="text-sm text-text-primary font-medium">
                        Run AI Analysis
                      </p>
                      <p className="text-xs text-text-muted mt-0.5">
                        {(selectedTool?.name ?? aiToolConfig?.activeTool.name ?? 'Claude Code')} will analyze your project to generate structure docs, notes, and tasks
                      </p>
                    </div>
                  </div>

                  <div className="rounded-md border border-border-subtle bg-bg-secondary p-3 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-medium text-text-secondary">Analysis Tool</p>
                        <p className="text-[10px] text-text-muted">Override the globally active AI tool for this onboarding run only.</p>
                      </div>
                      {selectedTool?.installed === false && (
                        <span className="text-[10px] text-warning shrink-0">Not installed</span>
                      )}
                    </div>
                    <select
                      value={selectedToolId ?? ''}
                      onChange={(e) => setSelectedToolId(e.target.value || null)}
                      className="w-full rounded-md border border-border-default bg-bg-deep px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent/50"
                    >
                      {availableTools.map((tool) => (
                        <option key={tool.id} value={tool.id}>
                          {tool.name}{tool.installed === false ? ' (Not installed)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* ── Advanced Options (collapsible) ──────────────────── */}
                  <div className="rounded-md border border-border-subtle bg-bg-secondary">
                    <button
                      type="button"
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      className="flex items-center gap-2 w-full px-3 py-2 text-xs text-text-secondary hover:text-text-primary transition-colors"
                    >
                      <ChevronDown className={cn('size-3.5 transition-transform', showAdvanced && 'rotate-180')} />
                      <span className="font-medium">Advanced Options</span>
                      {(customContext || extraFiles.length > 0) && (
                        <span className="text-[10px] text-accent ml-auto">customized</span>
                      )}
                    </button>

                    {showAdvanced && (
                      <div className="px-3 pb-3 space-y-3 border-t border-border-subtle pt-2">
                        {/* Extra files/directories */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-[11px] font-medium text-text-secondary">
                              Additional Context Files
                            </label>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={async () => {
                                  const paths = await onBrowseFiles('file');
                                  if (paths.length > 0) {
                                    setExtraFiles(prev => {
                                      const existing = new Set(prev.map(f => f.path));
                                      const newEntries = paths.filter(p => !existing.has(p)).map(p => ({ path: p, type: 'file' as const }));
                                      return [...prev, ...newEntries];
                                    });
                                  }
                                }}
                                title="Add files"
                              >
                                <File className="size-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={async () => {
                                  const paths = await onBrowseFiles('directory');
                                  if (paths.length > 0) {
                                    setExtraFiles(prev => {
                                      const existing = new Set(prev.map(f => f.path));
                                      const newEntries = paths.filter(p => !existing.has(p)).map(p => ({ path: p, type: 'directory' as const }));
                                      return [...prev, ...newEntries];
                                    });
                                  }
                                }}
                                title="Add directories"
                              >
                                <FolderOpen className="size-3" />
                              </Button>
                            </div>
                          </div>
                          {extraFiles.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {extraFiles.map((entry) => {
                                const name = entry.path.split(/[/\\]/).pop() || entry.path;
                                return (
                                  <span
                                    key={entry.path}
                                    className="inline-flex items-center gap-1 rounded-md bg-bg-tertiary border border-border-subtle px-2 py-0.5 text-[11px] text-text-secondary group"
                                    title={entry.path}
                                  >
                                    {entry.type === 'directory' ? (
                                      <FolderOpen className="size-3 text-amber-400 shrink-0" />
                                    ) : (
                                      <File className="size-3 text-blue-400 shrink-0" />
                                    )}
                                    <span className="truncate max-w-[120px]">{name}</span>
                                    <button
                                      type="button"
                                      onClick={() => setExtraFiles(prev => prev.filter(e => e.path !== entry.path))}
                                      className="ml-0.5 text-text-muted hover:text-error transition-colors"
                                    >
                                      <X className="size-3" />
                                    </button>
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-[10px] text-text-muted">
                              No extra files added. Detected files will be used by default.
                            </p>
                          )}
                        </div>

                        {/* Custom instructions */}
                        <div>
                          <label className="text-[11px] font-medium text-text-secondary block mb-1">
                            Additional Instructions
                          </label>
                          <textarea
                            value={customContext}
                            onChange={(e) => setCustomContext(e.target.value)}
                            placeholder="e.g., Focus on the backend API layer, ignore legacy code in /old..."
                            className="w-full h-16 rounded-md border border-border-default bg-bg-deep px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:ring-1 focus:ring-accent/50"
                          />
                        </div>

                        {/* Prompt preview */}
                        <div>
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={async () => {
                              if (promptPreview) {
                                setPromptPreview(null);
                                return;
                              }
                              setIsLoadingPreview(true);
                              try {
                                const result = await onPreviewPrompt(buildAnalysisOptions());
                                setPromptPreview(result.prompt);
                              } catch {
                                setPromptPreview('Error loading prompt preview');
                              } finally {
                                setIsLoadingPreview(false);
                              }
                            }}
                            className="gap-1.5"
                          >
                            <Eye className="size-3" />
                            {isLoadingPreview ? 'Loading...' : promptPreview ? 'Hide Prompt' : 'Preview Prompt'}
                          </Button>
                          {promptPreview && (
                            <div className="mt-1.5 max-h-[200px] overflow-y-auto rounded-md bg-bg-deep border border-border-subtle p-2 font-mono text-[10px] leading-relaxed text-text-secondary whitespace-pre-wrap">
                              {promptPreview}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Analysis in progress — phase stepper */}
              {isAnalyzing && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    {ANALYSIS_PHASES.map((phase, index) => {
                      const isCompleted = index < currentPhaseIndex;
                      const isCurrent = index === currentPhaseIndex;
                      const isPending = index > currentPhaseIndex;

                      return (
                        <div key={phase} className="flex items-center gap-2">
                          {isCompleted && <CheckCircle className="size-3.5 text-success shrink-0" />}
                          {isCurrent && <Loader2 className="size-3.5 text-accent animate-spin shrink-0" />}
                          {isPending && <div className="size-3.5 rounded-full border border-border-default shrink-0" />}
                          <span
                            className={cn(
                              'text-xs capitalize',
                              isCompleted && 'text-text-secondary',
                              isCurrent && 'text-text-primary font-medium',
                              isPending && 'text-text-muted'
                            )}
                          >
                            {phase}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Progress bar */}
                  <div className="h-1 w-full overflow-hidden rounded-full bg-bg-tertiary">
                    <div
                      className="h-full rounded-full bg-accent transition-all duration-300"
                      style={{ width: `${progress?.progress ?? 0}%` }}
                    />
                  </div>

                  {progress?.message && (
                    <div className="flex items-center gap-2">
                      <p className="text-[11px] text-text-secondary truncate flex-1">{progress.message}</p>
                      {progress.phase === 'analyzing' && elapsed > 0 && (
                        <span className="text-[10px] text-text-muted tabular-nums shrink-0">
                          {elapsed}s{timeoutMs ? ` / ${Math.floor(timeoutMs / 1000)}s` : ''}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Error display */}
              {error && (
                <div className="flex items-start gap-2 rounded-md border border-error/30 bg-error/5 p-2.5">
                  <AlertCircle className="size-4 text-error shrink-0 mt-0.5" />
                  <p className="text-xs text-error">{error}</p>
                </div>
              )}

              {/* Terminal output — real terminal via registry attach */}
              {showOutput && terminalId && (
                <div className="h-[250px] overflow-hidden rounded-md bg-bg-deep border border-border-subtle">
                  <EmbeddedTerminal
                    terminalId={terminalId}
                    className="h-full w-full"
                  />
                </div>
              )}

              {/* Stall warning */}
              {stalled && (
                <div className="flex items-center gap-2 rounded-md border border-warning/30 bg-warning/5 px-2.5 py-1.5">
                  <AlertCircle className="size-3.5 text-warning shrink-0" />
                  <p className="text-[11px] text-warning">
                    No output for {Math.floor((stallDurationMs ?? 0) / 1000)}s — the AI tool may be processing a large response.
                  </p>
                </div>
              )}

              {/* Background hint */}
              <div className="flex items-center justify-between gap-2 rounded-md border border-border-subtle bg-bg-secondary/60 px-2.5 py-2">
                <p className="text-[10px] text-text-muted italic">
                  You can close this dialog. Live progress continues in the Activity bar and the analysis terminal.
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => focusActivityBar({ mode: 'activity', streamId: activityStreamId })}
                  className="h-7 px-2 text-[11px] shrink-0"
                >
                  View Activity
                </Button>
              </div>
            </div>
          )}

          {/* ── Step 2: Results Review ─────────────────────────────────── */}
          {activeStep === 2 && analysisResult && (
            <ScrollArea className="max-h-[350px] pr-3">
              <div className="space-y-3">
                {/* ── Structure ──────────────────────────────────── */}
                <ReviewSection
                  checked={selections.structure}
                  onCheckedChange={(checked) =>
                    setSelections((prev) => ({ ...prev, structure: checked }))
                  }
                  label="Structure"
                  icon={<FileText className="size-4 text-blue-400" />}
                  summary={
                    <div className="flex gap-3 text-text-muted text-xs">
                      {analysisResult.structure.architecture && (
                        <span className="inline-flex items-center gap-1 rounded bg-bg-deep px-1.5 py-0.5 border border-border-subtle text-[10px]">
                          {analysisResult.structure.architecture}
                        </span>
                      )}
                      {analysisResult.structure.conventions && (
                        <span>{analysisResult.structure.conventions.length} conventions</span>
                      )}
                      {analysisResult.structure.modules && (
                        <span>{Object.keys(analysisResult.structure.modules).length} modules</span>
                      )}
                    </div>
                  }
                >
                  <div className="space-y-3 text-xs">
                    {analysisResult.structure.description && (
                      <p className="text-text-secondary leading-relaxed">{analysisResult.structure.description}</p>
                    )}
                    {analysisResult.structure.dataFlow && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-text-muted font-medium mb-1">Data Flow</div>
                        <p className="text-text-secondary leading-relaxed">{analysisResult.structure.dataFlow}</p>
                      </div>
                    )}
                    {analysisResult.structure.conventions && analysisResult.structure.conventions.length > 0 && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-text-muted font-medium mb-1">Conventions</div>
                        <div className="flex flex-wrap gap-1">
                          {analysisResult.structure.conventions.map((c, i) => (
                            <span key={i} className="inline-flex rounded bg-bg-deep px-1.5 py-0.5 border border-border-subtle text-[10px] text-text-secondary">
                              {c}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {analysisResult.structure.modules && Object.keys(analysisResult.structure.modules).length > 0 && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-text-muted font-medium mb-1">Modules</div>
                        <div className="grid grid-cols-1 gap-0.5 max-h-[120px] overflow-y-auto">
                          {Object.entries(analysisResult.structure.modules).map(([name, mod]) => (
                            <div key={name} className="flex items-baseline gap-2 py-0.5">
                              <code className="text-[10px] text-accent shrink-0">{name}</code>
                              {mod.purpose && <span className="text-text-muted text-[10px] truncate">{mod.purpose}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </ReviewSection>

                {/* ── Project Notes ──────────────────────────────── */}
                <ReviewSection
                  checked={selections.projectNotes}
                  onCheckedChange={(checked) =>
                    setSelections((prev) => ({ ...prev, projectNotes: checked }))
                  }
                  label="Project Notes"
                  icon={<BookOpen className="size-4 text-green-400" />}
                  summary={
                    <div className="flex gap-3 text-text-muted text-xs">
                      {analysisResult.projectNotes.decisions && (
                        <span>{analysisResult.projectNotes.decisions.length} decisions</span>
                      )}
                      {analysisResult.projectNotes.techStack && analysisResult.projectNotes.techStack.length > 0 && (
                        <span>{analysisResult.projectNotes.techStack.length} technologies</span>
                      )}
                    </div>
                  }
                >
                  <div className="space-y-3 text-xs">
                    {analysisResult.projectNotes.vision && (
                      <p className="text-text-secondary leading-relaxed">{analysisResult.projectNotes.vision}</p>
                    )}
                    {analysisResult.projectNotes.techStack && analysisResult.projectNotes.techStack.length > 0 && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-text-muted font-medium mb-1">Tech Stack</div>
                        <div className="flex flex-wrap gap-1">
                          {analysisResult.projectNotes.techStack.map((tech, i) => (
                            <span key={i} className="inline-flex rounded bg-bg-deep px-1.5 py-0.5 border border-border-subtle text-[10px] text-text-secondary">
                              {tech}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {analysisResult.projectNotes.decisions && analysisResult.projectNotes.decisions.length > 0 && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-text-muted font-medium mb-1">Decisions</div>
                        <div className="space-y-1.5">
                          {analysisResult.projectNotes.decisions.map((d, i) => (
                            <div key={i} className="rounded bg-bg-deep p-2 border border-border-subtle">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-[10px] text-text-muted">{d.date}</span>
                                <span className="text-text-primary font-medium">{d.title}</span>
                              </div>
                              <p className="text-text-secondary text-[10px] leading-relaxed">{d.detail}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </ReviewSection>

                {/* ── Suggested Tasks ────────────────────────────── */}
                {analysisResult.suggestedTasks.length > 0 && (
                  <div className="rounded-md border border-border-subtle bg-bg-secondary p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Terminal className="size-4 text-accent" />
                        <span className="text-sm font-medium text-text-primary">
                          Suggested Tasks
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          className="text-[10px] text-text-muted hover:text-accent cursor-pointer transition-colors"
                          onClick={() => {
                            const allSelected = selections.taskIds.length === analysisResult.suggestedTasks.length;
                            setSelections((prev) => ({
                              ...prev,
                              taskIds: allSelected ? [] : analysisResult.suggestedTasks.map((_, i) => i),
                            }));
                          }}
                        >
                          {selections.taskIds.length === analysisResult.suggestedTasks.length ? 'Deselect all' : 'Select all'}
                        </button>
                        <span className="text-xs text-text-muted">
                          {selections.taskIds.length}/{analysisResult.suggestedTasks.length}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      {analysisResult.suggestedTasks.map((task, index) => (
                        <label
                          key={index}
                          className="flex items-start gap-2.5 rounded px-2 py-1.5 transition-colors hover:bg-bg-hover cursor-pointer"
                        >
                          <Checkbox
                            checked={selections.taskIds.includes(index)}
                            onCheckedChange={() => toggleTask(index)}
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-text-primary">{task.title}</span>
                              <PriorityBadge priority={task.priority} />
                              {task.category && (
                                <span className="inline-flex rounded bg-bg-deep px-1.5 py-0 border border-border-subtle text-[10px] text-text-muted shrink-0">
                                  {task.category}
                                </span>
                              )}
                            </div>
                            {task.description && (
                              <p className="text-xs text-text-tertiary mt-0.5 leading-relaxed">{task.description}</p>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}

          {activeStep === 2 && !analysisResult && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <AlertCircle className="size-6 text-text-muted" />
              <p className="text-sm text-text-secondary">No analysis results available</p>
              <p className="text-xs text-text-muted">Run AI analysis first to see results here.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveStep(1)}
                className="mt-2"
              >
                Go to Analysis
              </Button>
            </div>
          )}

          {/* ── Step 3: Success Confirmation ───────────────────────────── */}
          {activeStep === 3 && importResult && (
            <div className="space-y-3">
              {/* Success header */}
              <div className="flex flex-col items-center py-3 gap-2">
                <div className="size-12 rounded-full bg-success/10 flex items-center justify-center">
                  <PartyPopper className="size-6 text-accent" />
                </div>
                <p className="text-base font-medium text-text-primary">
                  Project setup complete
                </p>
              </div>

              {/* Import summary */}
              <div className="rounded-md border border-success/20 bg-success/5 p-3 space-y-2">
                {importResult.imported.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-success flex items-center gap-1.5">
                      <CheckCircle className="size-3.5" />
                      {importResult.imported.length} item{importResult.imported.length !== 1 ? 's' : ''} imported
                    </p>
                    {importResult.imported.map((item, i) => (
                      <p key={i} className="text-xs text-text-secondary pl-5">• {item}</p>
                    ))}
                  </div>
                )}
                {importResult.skipped.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-text-muted">Skipped:</p>
                    {importResult.skipped.map((item, i) => (
                      <p key={i} className="text-xs text-text-tertiary pl-5">• {item}</p>
                    ))}
                  </div>
                )}
                {importResult.errors.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-error">Errors:</p>
                    {importResult.errors.map((item, i) => (
                      <p key={i} className="text-xs text-error/80 pl-5">• {item}</p>
                    ))}
                  </div>
                )}
              </div>

              {/* Next steps */}
              <div className="rounded-md border border-border-subtle bg-bg-secondary p-3">
                <p className="text-xs font-medium text-text-primary mb-1.5">Next steps</p>
                <ul className="space-y-1 text-xs text-text-secondary">
                  <li className="flex items-start gap-1.5">
                    <ChevronRight className="size-3 mt-0.5 text-accent shrink-0" />
                    Open <span className="text-text-primary font-medium">Sub-Tasks</span> panel
                    <kbd className="ml-auto text-[10px] text-text-muted bg-bg-tertiary rounded px-1">Ctrl+Shift+S</kbd>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <ChevronRight className="size-3 mt-0.5 text-accent shrink-0" />
                    Review <span className="font-mono text-[11px] text-text-primary">.subframe/PROJECT_NOTES.md</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <ChevronRight className="size-3 mt-0.5 text-accent shrink-0" />
                    Run your AI tool — SubFrame tracks activity automatically
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <DialogFooter className="shrink-0 flex-wrap gap-2 px-6 pb-6 pt-2 border-t border-border-subtle">
          {/* Left side — rollback / terminal actions */}
          <div className="flex items-center gap-2 flex-1 flex-wrap min-w-0">
            {/* Rollback (available in steps 1-2, not during active import or on success) */}
            {activeStep < 3 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (confirmRollback) {
                    onRollback();
                  } else {
                    setConfirmRollback(true);
                  }
                }}
                disabled={isRollingBack || isImporting || isAnalyzing}
                className={cn(
                  'gap-1.5 bg-bg-secondary text-text-primary hover:bg-bg-hover',
                  confirmRollback && 'border-error/40 text-error hover:bg-error/10 hover:text-error'
                )}
                title="Remove all SubFrame files and undo initialization"
              >
                <Undo2 className="size-3.5" />
                {isRollingBack ? 'Rolling back...' : confirmRollback ? 'Confirm Rollback' : 'Rollback'}
              </Button>
            )}

            {/* Terminal output controls (step 1 during/after analysis) */}
            {activeStep === 1 && terminalId && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => focusActivityBar({ mode: 'activity', streamId: activityStreamId })}
                  className="gap-1.5 bg-bg-secondary text-text-primary hover:bg-bg-hover"
                  title="Open the shared Activity bar for live progress and output"
                >
                  <Eye className="size-3.5" />
                  Open Activity
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowOutput(!showOutput)}
                  className="gap-1.5 bg-bg-secondary text-text-primary hover:bg-bg-hover"
                  title="Toggle raw AI tool output in this dialog"
                >
                  <Terminal className="size-3.5" />
                  {showOutput ? 'Hide Output' : 'Show Output'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    suppressCancelRef.current = true;
                    onOpenChange(false);
                    onViewTerminal();
                  }}
                  className="gap-1.5 bg-bg-secondary text-text-primary hover:bg-bg-hover"
                  title="Close dialog and switch to the analysis terminal"
                >
                  Open Terminal
                </Button>
              </>
            )}
          </div>

          {/* Right side — primary actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Step 1: Analyze actions */}
            {activeStep === 1 && (
              <>
                {error && (
                  <>
                    <Button variant="outline" size="sm" onClick={onRetry} className="gap-1.5">
                      <RotateCcw className="size-3.5" />
                      Retry
                    </Button>
                    {error.toLowerCase().includes('timed out') && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            onRetry();
                            // Schedule analyze with double timeout after retry clears state
                            setTimeout(() => {
                            onAnalyze(buildAnalysisOptions({
                              timeoutOverride: (timeoutMs ?? 300_000) * 2,
                            }));
                          }, 100);
                        }}
                        className="gap-1.5"
                      >
                        <RotateCcw className="size-3.5" />
                        Retry ({Math.floor((timeoutMs ?? 300_000) * 2 / 60_000)}m timeout)
                      </Button>
                    )}
                  </>
                )}
                {!isAnalyzing && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSkipAnalysis}
                    className="gap-1.5 bg-bg-secondary text-text-primary hover:bg-bg-hover"
                    title="Skip AI analysis and close — you can run it later from SubFrame Health"
                  >
                    <SkipForward className="size-3.5" />
                    Skip
                  </Button>
                )}
                {isAnalyzing ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onCancel}
                    className="bg-bg-secondary text-text-primary hover:bg-bg-hover"
                  >
                    Cancel
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => onAnalyze(buildAnalysisOptions())}
                    disabled={isAnalyzing || selectedTool?.installed === false}
                    className="gap-1.5"
                  >
                    <Brain className="size-3.5" />
                    {error ? 'Rerun Analysis' : analysisResult ? 'Rerun' : `Analyze with ${selectedTool?.name ?? aiToolConfig?.activeTool.name ?? 'Claude Code'}`}
                  </Button>
                )}
              </>
            )}

            {/* Step 2: Import actions */}
            {activeStep === 2 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setActiveStep(1);
                    onRetry();
                  }}
                  className="gap-1.5 bg-bg-secondary text-text-primary hover:bg-bg-hover"
                >
                  <RotateCcw className="size-3.5" />
                  Rerun Analysis
                </Button>
                <Button
                  size="sm"
                  onClick={() => onImport(selections)}
                  disabled={
                    isImporting ||
                    (!selections.structure && !selections.projectNotes && selections.taskIds.length === 0)
                  }
                >
                  {isImporting ? 'Importing...' : 'Apply Selected'}
                </Button>
              </>
            )}

            {/* Step 3: Done */}
            {activeStep === 3 && (
              <Button size="sm" onClick={() => onOpenChange(false)}>
                Get Started
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Close confirmation when analysis is running */}
    <AlertDialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
      <AlertDialogContent className="bg-bg-primary border-border-subtle">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-text-primary text-sm">Analysis in progress</AlertDialogTitle>
          <AlertDialogDescription className="text-text-secondary text-xs">
            The AI analysis is still running. You can keep it running in the background terminal, or cancel it.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="text-xs h-8 bg-bg-secondary text-text-primary border-border-default hover:bg-bg-hover">
            Keep Open
          </AlertDialogCancel>
          <AlertDialogAction
            className="text-xs h-8 bg-bg-secondary border border-border-default text-text-primary hover:bg-bg-hover"
            onClick={() => {
              onCancel();
              setShowCloseConfirm(false);
              onOpenChange(false);
            }}
          >
            Cancel Analysis
          </AlertDialogAction>
          <AlertDialogAction
            className="text-xs h-8"
            onClick={() => {
              suppressCancelRef.current = true;
              setShowCloseConfirm(false);
              onOpenChange(false);
            }}
          >
            Continue in Background
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

// ── ReviewSection helper ─────────────────────────────────────────────────────

function ReviewSection({
  checked,
  onCheckedChange,
  label,
  icon,
  summary,
  children,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  icon: React.ReactNode;
  summary?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-md border border-border-subtle bg-bg-secondary">
      {/* Header row: checkbox + label + expand toggle */}
      <div className="flex items-start gap-2.5 p-3">
        <label className="cursor-pointer mt-0.5" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={checked}
            onCheckedChange={(val) => onCheckedChange(val === true)}
          />
        </label>
        <button
          className="flex-1 min-w-0 text-left cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-2">
            {icon}
            <span className="text-sm font-medium text-text-primary">{label}</span>
            <ChevronDown className={cn('size-3.5 text-text-muted transition-transform ml-auto shrink-0', expanded && 'rotate-180')} />
          </div>
          {!expanded && summary && <div className="mt-1">{summary}</div>}
        </button>
      </div>
      {/* Expanded detail content */}
      {expanded && (
        <div className="px-3 pb-3 pt-0 ml-8 border-t border-border-subtle mt-0 pt-2">
          {children}
        </div>
      )}
    </div>
  );
}

// ── PriorityBadge helper ─────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: 'high' | 'medium' | 'low' }) {
  const config = {
    high: 'bg-error/15 text-error border-error/20',
    medium: 'bg-warning/15 text-warning border-warning/20',
    low: 'bg-info/15 text-info border-info/20',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-1.5 py-0 text-[10px] font-medium border shrink-0',
        config[priority]
      )}
    >
      {priority}
    </span>
  );
}
