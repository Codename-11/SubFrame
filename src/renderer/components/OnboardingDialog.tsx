/**
 * OnboardingDialog — Multi-step dialog for project intelligence onboarding.
 *
 * Step 1: Detection summary (what files/configs were found)
 * Step 2: Analysis in progress (phase tracking + terminal link)
 * Step 3: Results review (select what to import)
 */

import { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
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
} from 'lucide-react';
import type {
  OnboardingDetectionResult,
  OnboardingAnalysisResult,
  OnboardingImportSelections,
  DetectedIntelligence,
} from '../../shared/ipcChannels';

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
  isAnalyzing: boolean;
  error: string | null;
  aiToolName: string;
  onAnalyze: () => void;
  onImport: (selections: OnboardingImportSelections) => void;
  onCancel: () => void;
  onViewTerminal: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export function OnboardingDialog({
  open,
  onOpenChange,
  detection,
  analysisResult,
  progress,
  terminalId,
  isAnalyzing,
  error,
  aiToolName,
  onAnalyze,
  onImport,
  onCancel,
  onViewTerminal,
}: OnboardingDialogProps) {
  const [step, setStep] = useState<'detect' | 'analyze' | 'review'>('detect');
  const [selections, setSelections] = useState<OnboardingImportSelections>({
    structure: true,
    projectNotes: true,
    taskIds: [],
  });

  // Auto-advance steps based on external state changes
  useEffect(() => {
    if (isAnalyzing) {
      setStep('analyze');
    }
  }, [isAnalyzing]);

  useEffect(() => {
    if (analysisResult) {
      setStep('review');
      // Initialize taskIds to select all suggested tasks
      setSelections((prev) => ({
        ...prev,
        taskIds: analysisResult.suggestedTasks.map((_, i) => i),
      }));
    }
  }, [analysisResult]);

  // Group detected files by category
  const groupedDetections = useMemo(() => {
    if (!detection) return {};
    const groups: Record<string, DetectedIntelligence[]> = {};
    for (const item of detection.detected) {
      if (!groups[item.category]) {
        groups[item.category] = [];
      }
      groups[item.category].push(item);
    }
    return groups;
  }, [detection]);

  // Determine current phase index for the progress indicator
  const currentPhaseIndex = useMemo(() => {
    if (!progress) return -1;
    return ANALYSIS_PHASES.indexOf(progress.phase as AnalysisPhase);
  }, [progress]);

  // Handle task checkbox toggle
  const toggleTask = (index: number) => {
    setSelections((prev) => {
      const has = prev.taskIds.includes(index);
      return {
        ...prev,
        taskIds: has
          ? prev.taskIds.filter((id) => id !== index)
          : [...prev.taskIds, index],
      };
    });
  };

  // Determine dialog max width based on step
  const dialogMaxWidth = step === 'review' ? 'sm:max-w-2xl' : 'sm:max-w-lg';

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      // If closing during analysis, cancel to avoid orphaned terminals
      if (!nextOpen && isAnalyzing) {
        onCancel();
      }
      onOpenChange(nextOpen);
    }}>
      <DialogContent
        className={cn(dialogMaxWidth, 'bg-bg-primary border-border-subtle')}
      >
        {/* ── Step 1: Detection Summary ─────────────────────────────────── */}
        {step === 'detect' && detection && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-text-primary">
                <Search className="size-5 text-accent" />
                Project Intelligence Detected
              </DialogTitle>
              <DialogDescription className="text-text-secondary">
                Found existing project configuration and documentation that can
                be analyzed to bootstrap SubFrame.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              {/* Detected file groups */}
              {Object.entries(groupedDetections).map(([category, items]) => {
                const config = CATEGORY_CONFIG[category] ?? {
                  icon: FileText,
                  color: 'text-text-muted',
                  label: category,
                };
                const Icon = config.icon;
                return (
                  <div
                    key={category}
                    className="rounded-md border border-border-subtle bg-bg-secondary p-3"
                  >
                    <div className="mb-1.5 flex items-center gap-2">
                      <Icon className={cn('size-4', config.color)} />
                      <span className="text-sm font-medium text-text-primary">
                        {config.label}
                      </span>
                      <Badge
                        variant="secondary"
                        className="ml-auto text-[10px] px-1.5 py-0"
                      >
                        {items.length}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {items.map((item) => (
                        <span
                          key={item.path}
                          className="inline-flex items-center rounded bg-bg-tertiary px-1.5 py-0.5 text-xs text-text-secondary font-mono"
                        >
                          {item.label}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Stats line */}
              <p className="text-xs text-text-muted">
                {detection.sourceFileCount} source files
                {' \u2022 '}
                Primary: {detection.primaryLanguage}
                {' \u2022 '}
                Git: {detection.hasGit ? 'Yes' : 'No'}
              </p>
            </div>

            <DialogFooter>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                Skip
              </Button>
              <Button size="sm" onClick={onAnalyze} disabled={isAnalyzing}>
                Analyze with {aiToolName}
              </Button>
            </DialogFooter>
          </>
        )}

        {/* ── Step 2: Analysis in Progress ──────────────────────────────── */}
        {step === 'analyze' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-text-primary">
                <Brain className="size-5 text-accent" />
                Analyzing Project...
              </DialogTitle>
              <DialogDescription className="text-text-secondary">
                Running AI analysis to understand your project structure,
                conventions, and potential tasks.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Phase steps */}
              <div className="space-y-2">
                {ANALYSIS_PHASES.map((phase, index) => {
                  const isCompleted = index < currentPhaseIndex;
                  const isCurrent = index === currentPhaseIndex;
                  const isPending = index > currentPhaseIndex;

                  return (
                    <div
                      key={phase}
                      className="flex items-center gap-2.5"
                    >
                      {isCompleted && (
                        <CheckCircle className="size-4 text-success shrink-0" />
                      )}
                      {isCurrent && (
                        <Loader2 className="size-4 text-accent animate-spin shrink-0" />
                      )}
                      {isPending && (
                        <div className="size-4 rounded-full border border-border-default shrink-0" />
                      )}
                      <span
                        className={cn(
                          'text-sm capitalize',
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

              {/* Current message */}
              {progress?.message && (
                <p className="text-xs text-text-secondary truncate">
                  {progress.message}
                </p>
              )}

              {/* Error display */}
              {error && (
                <div className="flex items-start gap-2 rounded-md border border-error/30 bg-error/5 p-2.5">
                  <AlertCircle className="size-4 text-error shrink-0 mt-0.5" />
                  <p className="text-xs text-error">{error}</p>
                </div>
              )}
            </div>

            <DialogFooter>
              {terminalId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onViewTerminal}
                >
                  <Terminal className="size-3.5" />
                  View Terminal
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={onCancel}>
                Cancel
              </Button>
            </DialogFooter>
          </>
        )}

        {/* ── Step 3: Results Review ────────────────────────────────────── */}
        {step === 'review' && analysisResult && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-text-primary">
                <CheckCircle className="size-5 text-success" />
                Analysis Complete
              </DialogTitle>
              <DialogDescription className="text-text-secondary">
                Review the analysis results and select what to import into your
                SubFrame project.
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="max-h-[400px] pr-3">
              <div className="space-y-4">
                {/* ── Structure section ──────────────────────────────────── */}
                <ReviewSection
                  checked={selections.structure}
                  onCheckedChange={(checked) =>
                    setSelections((prev) => ({ ...prev, structure: checked }))
                  }
                  label="Structure"
                  icon={<FileText className="size-4 text-blue-400" />}
                >
                  <div className="space-y-1.5 text-xs text-text-secondary">
                    {analysisResult.structure.description && (
                      <p className="line-clamp-2">
                        {analysisResult.structure.description}
                      </p>
                    )}
                    {analysisResult.structure.architecture && (
                      <p className="line-clamp-2 text-text-muted">
                        {analysisResult.structure.architecture}
                      </p>
                    )}
                    <div className="flex gap-3 text-text-muted">
                      {analysisResult.structure.conventions && (
                        <span>
                          {analysisResult.structure.conventions.length} conventions
                        </span>
                      )}
                      {analysisResult.structure.modules && (
                        <span>
                          {Object.keys(analysisResult.structure.modules).length} modules
                        </span>
                      )}
                    </div>
                  </div>
                </ReviewSection>

                {/* ── Project Notes section ──────────────────────────────── */}
                <ReviewSection
                  checked={selections.projectNotes}
                  onCheckedChange={(checked) =>
                    setSelections((prev) => ({
                      ...prev,
                      projectNotes: checked,
                    }))
                  }
                  label="Project Notes"
                  icon={<BookOpen className="size-4 text-green-400" />}
                >
                  <div className="space-y-1.5 text-xs text-text-secondary">
                    {analysisResult.projectNotes.vision && (
                      <p className="line-clamp-2">
                        {analysisResult.projectNotes.vision}
                      </p>
                    )}
                    <div className="flex gap-3 text-text-muted">
                      {analysisResult.projectNotes.decisions && (
                        <span>
                          {analysisResult.projectNotes.decisions.length} decisions
                        </span>
                      )}
                      {analysisResult.projectNotes.techStack &&
                        analysisResult.projectNotes.techStack.length > 0 && (
                          <span>
                            {analysisResult.projectNotes.techStack.join(', ')}
                          </span>
                        )}
                    </div>
                  </div>
                </ReviewSection>

                {/* ── Suggested Tasks section ────────────────────────────── */}
                {analysisResult.suggestedTasks.length > 0 && (
                  <div className="rounded-md border border-border-subtle bg-bg-secondary p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Terminal className="size-4 text-accent" />
                        <span className="text-sm font-medium text-text-primary">
                          Suggested Tasks
                        </span>
                      </div>
                      <span className="text-xs text-text-muted">
                        {selections.taskIds.length}/
                        {analysisResult.suggestedTasks.length} selected
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {analysisResult.suggestedTasks.map((task, index) => (
                        <label
                          key={index}
                          className="flex items-start gap-2.5 rounded px-1.5 py-1 transition-colors hover:bg-bg-hover cursor-pointer"
                        >
                          <Checkbox
                            checked={selections.taskIds.includes(index)}
                            onCheckedChange={() => toggleTask(index)}
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-text-primary truncate">
                                {task.title}
                              </span>
                              <PriorityBadge priority={task.priority} />
                            </div>
                            {task.category && (
                              <span className="text-[10px] text-text-muted">
                                {task.category}
                              </span>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <DialogFooter>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  onImport(selections);
                  toast.success('Project intelligence imported');
                  onOpenChange(false);
                }}
                disabled={
                  !selections.structure &&
                  !selections.projectNotes &&
                  selections.taskIds.length === 0
                }
              >
                Apply Selected
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── ReviewSection helper ─────────────────────────────────────────────────────

function ReviewSection({
  checked,
  onCheckedChange,
  label,
  icon,
  children,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-border-subtle bg-bg-secondary p-3">
      <label className="flex items-start gap-2.5 cursor-pointer">
        <Checkbox
          checked={checked}
          onCheckedChange={(val) => onCheckedChange(val === true)}
          className="mt-0.5"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            {icon}
            <span className="text-sm font-medium text-text-primary">
              {label}
            </span>
          </div>
          {children}
        </div>
      </label>
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
