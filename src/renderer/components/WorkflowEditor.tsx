/**
 * WorkflowEditor — Visual workflow builder + YAML editor for pipeline workflows.
 * Follows TasksPanel's dual-mode (Form / YAML) dialog pattern.
 */

import { useState, useCallback, useEffect } from 'react';
import { AnimatePresence, motion, Reorder } from 'framer-motion';
import {
  Plus,
  X,
  GripVertical,
  ChevronDown,
  ChevronRight,
  Play,
  Shield,
  FileText,
  Code,
  Search,
  Zap,
  Terminal,
  Trash2,
  Copy,
  Save,
  Sparkles,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from './ui/dropdown-menu';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import type { WorkflowDefinition } from '../../shared/ipcChannels';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Built-in stage types with metadata for autofill */
const STAGE_TYPES = [
  { value: 'lint',       label: 'Lint',        icon: <Search size={12} />,   description: 'Run project linters' },
  { value: 'test',       label: 'Test',        icon: <Play size={12} />,     description: 'Run test suite' },
  { value: 'describe',   label: 'Describe',    icon: <FileText size={12} />, description: 'AI project/PR description' },
  { value: 'critique',   label: 'Critique',    icon: <Shield size={12} />,   description: 'AI code review' },
  { value: 'freeze',     label: 'Freeze',      icon: <Zap size={12} />,      description: 'Freeze subsequent stages' },
  { value: 'push',       label: 'Push',        icon: <Code size={12} />,     description: 'Git push changes' },
  { value: 'create-pr',  label: 'Create PR',   icon: <Code size={12} />,     description: 'Create pull request' },
] as const;

const SCOPE_OPTIONS = ['changes', 'project'] as const;
const MODE_OPTIONS = ['print', 'agent'] as const;
const FOCUS_PRESETS = ['security', 'documentation', 'architecture', 'performance', 'testing'] as const;

const APPROVAL_OPTIONS = [
  { value: 'false', label: 'No' },
  { value: 'true', label: 'Always' },
  { value: 'if_patches', label: 'If patches' },
] as const;

/** Template presets for quick workflow creation */
const WORKFLOW_TEMPLATES = [
  {
    id: 'health-check',
    label: 'Health Check',
    description: 'Project audit with lint, test, and AI review',
  },
  {
    id: 'docs-audit',
    label: 'Docs Audit',
    description: 'Documentation sync and AI review',
  },
  {
    id: 'security-scan',
    label: 'Security Scan',
    description: 'Dependency audit and AI security review',
  },
  {
    id: 'review',
    label: 'Code Review',
    description: 'Full CI/CD pipeline with review and approval',
  },
  {
    id: 'blank',
    label: 'Blank',
    description: 'Start from scratch',
  },
] as const;

// ─── Types ───────────────────────────────────────────────────────────────────

interface EditorStep {
  id: string;
  name: string;
  uses: string;
  run: string;
  requireApproval: string; // 'false' | 'true' | 'if_patches'
  continueOnError: boolean;
  timeout: string;
  withScope: string;
  withMode: string;
  withFocus: string;
  withPrompt: string;
  expanded: boolean;
}

interface EditorJob {
  id: string;
  key: string; // YAML key
  name: string;
  needs: string;
  steps: EditorStep[];
}

interface EditorState {
  name: string;
  manualTrigger: boolean;
  pushTrigger: boolean;
  pushBranches: string;
  jobs: EditorJob[];
}

// ─── Utilities ───────────────────────────────────────────────────────────────

let _nextId = 0;
function uid(): string {
  return `ws-${Date.now()}-${++_nextId}`;
}

function createBlankStep(): EditorStep {
  return {
    id: uid(),
    name: '',
    uses: '',
    run: '',
    requireApproval: 'false',
    continueOnError: false,
    timeout: '',
    withScope: '',
    withMode: '',
    withFocus: '',
    withPrompt: '',
    expanded: true,
  };
}

function createBlankJob(): EditorJob {
  return {
    id: uid(),
    key: 'job1',
    name: '',
    needs: '',
    steps: [createBlankStep()],
  };
}

function createBlankState(): EditorState {
  return {
    name: '',
    manualTrigger: true,
    pushTrigger: false,
    pushBranches: '*',
    jobs: [createBlankJob()],
  };
}

/** Convert a WorkflowDefinition to editor state */
function definitionToState(def: WorkflowDefinition): EditorState {
  const state: EditorState = {
    name: def.name,
    manualTrigger: !!def.on?.manual,
    pushTrigger: !!def.on?.push,
    pushBranches: def.on?.push?.branches?.join(', ') ?? '*',
    jobs: [],
  };

  for (const [key, job] of Object.entries(def.jobs)) {
    state.jobs.push({
      id: uid(),
      key,
      name: job.name ?? '',
      needs: job.needs?.join(', ') ?? '',
      steps: job.steps.map((step) => ({
        id: uid(),
        name: step.name,
        uses: step.uses ?? '',
        run: step.run ?? '',
        requireApproval: step['require-approval'] === true ? 'true'
          : step['require-approval'] === 'if_patches' ? 'if_patches' : 'false',
        continueOnError: !!step['continue-on-error'],
        timeout: step.timeout ? String(step.timeout) : '',
        withScope: step.with?.scope ?? '',
        withMode: step.with?.mode ?? '',
        withFocus: step.with?.focus ?? '',
        withPrompt: step.with?.prompt ?? '',
        expanded: false,
      })),
    });
  }

  return state;
}

/** YAML keywords that must be quoted to avoid being parsed as booleans/nulls */
const YAML_KEYWORDS = new Set(['true', 'false', 'null', 'yes', 'no', 'on', 'off', 'True', 'False', 'Null', 'Yes', 'No', 'On', 'Off', 'TRUE', 'FALSE', 'NULL', 'YES', 'NO', 'ON', 'OFF']);

/** YAML-safe scalar quoting — wraps in single quotes if value contains special chars */
function yamlQuote(val: string): string {
  // Empty string must be quoted
  if (!val) return "''";
  // YAML keywords must be quoted
  if (YAML_KEYWORDS.has(val)) return `'${val}'`;
  // Safe bare scalars: simple alphanumeric, hyphens, dots, slashes, spaces (no leading special chars)
  if (/^[a-zA-Z0-9][a-zA-Z0-9 ._/-]*$/.test(val) && !val.includes(': ') && !val.includes('#')) {
    return val;
  }
  // Single-quote and escape internal single quotes ('' in YAML)
  return `'${val.replace(/'/g, "''")}'`;
}

/** Convert editor state to YAML string */
function stateToYaml(state: EditorState): string {
  const lines: string[] = [];
  lines.push(`name: ${yamlQuote(state.name || 'untitled')}`);
  lines.push('on:');
  if (state.pushTrigger) {
    lines.push('  push:');
    const branches = state.pushBranches.split(',').map((b) => b.trim()).filter(Boolean);
    if (branches.length > 0) {
      lines.push(`    branches: [${branches.map((b) => `'${b}'`).join(', ')}]`);
    }
  }
  if (state.manualTrigger) {
    lines.push('  manual: true');
  }
  lines.push('');
  lines.push('jobs:');

  for (const job of state.jobs) {
    const jobKey = job.key || 'job1';
    lines.push(`  ${jobKey}:`);
    if (job.name) lines.push(`    name: ${yamlQuote(job.name)}`);
    if (job.needs) {
      const needsList = job.needs.split(',').map((n) => n.trim()).filter(Boolean);
      if (needsList.length > 0) {
        lines.push(`    needs: [${needsList.join(', ')}]`);
      }
    }
    lines.push('    steps:');

    for (const step of job.steps) {
      lines.push(`      - name: ${yamlQuote(step.name || 'Untitled Step')}`);
      if (step.uses) lines.push(`        uses: ${step.uses}`);
      if (step.run) {
        // Multi-line run commands
        if (step.run.includes('\n')) {
          lines.push('        run: |');
          for (const line of step.run.split('\n')) {
            lines.push(`          ${line}`);
          }
        } else {
          lines.push(`        run: ${yamlQuote(step.run)}`);
        }
      }
      if (step.requireApproval === 'true') lines.push('        require-approval: true');
      if (step.requireApproval === 'if_patches') lines.push('        require-approval: if_patches');
      if (step.continueOnError) lines.push('        continue-on-error: true');
      if (step.timeout) lines.push(`        timeout: ${step.timeout}`);

      // with: config
      const withEntries: [string, string][] = [];
      if (step.withScope) withEntries.push(['scope', step.withScope]);
      if (step.withMode) withEntries.push(['mode', step.withMode]);
      if (step.withFocus) withEntries.push(['focus', step.withFocus]);
      if (step.withPrompt) withEntries.push(['prompt', yamlQuote(step.withPrompt)]);

      if (withEntries.length > 0) {
        lines.push('        with:');
        for (const [k, v] of withEntries) {
          lines.push(`          ${k}: ${v}`);
        }
      }
    }
  }

  return lines.join('\n') + '\n';
}

/** Check if a stage type supports with: config (AI stages) */
function stageSupportsConfig(uses: string): boolean {
  return ['test', 'describe', 'critique'].includes(uses);
}

// ─── Step Card ───────────────────────────────────────────────────────────────

function StepCard({
  step,
  index,
  onUpdate,
  onRemove,
  onDuplicate,
}: {
  step: EditorStep;
  index: number;
  onUpdate: (updates: Partial<EditorStep>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
}) {
  const isCustom = !step.uses && step.run;
  const isAI = stageSupportsConfig(step.uses);
  const stageInfo = STAGE_TYPES.find((s) => s.value === step.uses);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, height: 0 }}
      transition={{ duration: 0.15 }}
      className="border border-border-subtle rounded-md bg-bg-deep overflow-hidden"
    >
      {/* Step header — always visible */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 bg-bg-secondary/50">
        <GripVertical size={12} className="text-text-muted cursor-grab shrink-0" />
        <span className="text-[10px] text-text-muted w-4 text-center shrink-0">{index + 1}</span>

        {stageInfo && (
          <span className="text-text-tertiary shrink-0">{stageInfo.icon}</span>
        )}
        {isCustom && <Terminal size={12} className="text-text-tertiary shrink-0" />}

        <span className="text-xs text-text-primary truncate flex-1 font-medium">
          {step.name || (stageInfo?.label ?? (isCustom ? 'Custom Command' : 'New Step'))}
        </span>

        {step.continueOnError && (
          <span className="text-[9px] text-warning px-1 rounded bg-warning/10">skip-errors</span>
        )}
        {step.requireApproval !== 'false' && (
          <span className="text-[9px] text-info px-1 rounded bg-info/10">approval</span>
        )}
        {isAI && step.withScope === 'project' && (
          <span className="text-[9px] text-accent px-1 rounded bg-accent/10">project</span>
        )}

        <button
          type="button"
          onClick={onDuplicate}
          className="p-0.5 text-text-muted hover:text-text-secondary transition-colors cursor-pointer"
          title="Duplicate step"
        >
          <Copy size={10} />
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="p-0.5 text-text-muted hover:text-error transition-colors cursor-pointer"
          title="Remove step"
        >
          <X size={10} />
        </button>
        <button
          type="button"
          onClick={() => onUpdate({ expanded: !step.expanded })}
          className="p-0.5 text-text-muted hover:text-text-primary transition-colors cursor-pointer"
        >
          {step.expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
      </div>

      {/* Expanded editor */}
      <AnimatePresence>
        {step.expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-3 py-2.5 space-y-2.5 border-t border-border-subtle">
              {/* Row 1: Name + Stage Type */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[10px] text-text-tertiary mb-0.5 block">Name</label>
                  <Input
                    value={step.name}
                    onChange={(e) => onUpdate({ name: e.target.value })}
                    placeholder="Step name"
                    className="bg-bg-primary border-border-subtle text-xs h-7"
                  />
                </div>
                <div className="w-[140px]">
                  <label className="text-[10px] text-text-tertiary mb-0.5 block">Stage Type</label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="w-full h-7 px-2 rounded-md bg-bg-primary border border-border-subtle text-xs text-left flex items-center gap-1.5 hover:border-accent/50 transition-colors cursor-pointer"
                      >
                        {stageInfo ? (
                          <>
                            <span className="text-text-tertiary">{stageInfo.icon}</span>
                            <span className="text-text-primary">{stageInfo.label}</span>
                          </>
                        ) : step.uses ? (
                          <span className="text-text-primary">{step.uses}</span>
                        ) : (
                          <span className="text-text-muted">Custom / Run</span>
                        )}
                        <ChevronDown size={10} className="ml-auto text-text-muted" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="min-w-[180px]">
                      <DropdownMenuLabel className="text-[10px]">Built-in Stages</DropdownMenuLabel>
                      {STAGE_TYPES.map((stage) => (
                        <DropdownMenuItem
                          key={stage.value}
                          onClick={() => {
                            onUpdate({ uses: stage.value, run: '' });
                            // Auto-fill name if empty
                            if (!step.name) onUpdate({ uses: stage.value, run: '', name: stage.label });
                          }}
                          className="text-xs"
                        >
                          <span className="mr-2 text-text-tertiary">{stage.icon}</span>
                          <div>
                            <div>{stage.label}</div>
                            <div className="text-[10px] text-text-muted">{stage.description}</div>
                          </div>
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => onUpdate({ uses: '', run: step.run || '' })}
                        className="text-xs"
                      >
                        <Terminal size={12} className="mr-2 text-text-tertiary" />
                        <div>
                          <div>Custom Command</div>
                          <div className="text-[10px] text-text-muted">Run a shell command</div>
                        </div>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Custom run command (shown when no uses: or when custom) */}
              {!step.uses && (
                <div>
                  <label className="text-[10px] text-text-tertiary mb-0.5 block">Command</label>
                  <Input
                    value={step.run}
                    onChange={(e) => onUpdate({ run: e.target.value })}
                    placeholder="npm run lint"
                    className="bg-bg-primary border-border-subtle text-xs h-7 font-mono"
                  />
                </div>
              )}

              {/* Row 2: Options */}
              <div className="flex gap-3 items-center flex-wrap">
                <label className="flex items-center gap-1.5 text-[10px] text-text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={step.continueOnError}
                    onChange={(e) => onUpdate({ continueOnError: e.target.checked })}
                    className="accent-accent cursor-pointer"
                  />
                  Continue on error
                </label>

                <div className="flex items-center gap-1.5">
                  <label className="text-[10px] text-text-secondary">Approval</label>
                  <select
                    value={step.requireApproval}
                    onChange={(e) => onUpdate({ requireApproval: e.target.value })}
                    className="h-6 px-1.5 rounded bg-bg-primary border border-border-subtle text-[10px] text-text-primary cursor-pointer"
                  >
                    {APPROVAL_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <label className="text-[10px] text-text-secondary">Timeout</label>
                  <Input
                    value={step.timeout}
                    onChange={(e) => onUpdate({ timeout: e.target.value })}
                    placeholder="300"
                    className="bg-bg-primary border-border-subtle text-[10px] h-6 w-16"
                  />
                </div>
              </div>

              {/* with: config — only for AI stages */}
              {isAI && (
                <div className="border-t border-border-subtle pt-2 mt-1">
                  <div className="flex items-center gap-1 mb-2">
                    <Sparkles size={10} className="text-accent" />
                    <span className="text-[10px] text-accent font-medium">AI Configuration</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-text-tertiary mb-0.5 block">Scope</label>
                      <select
                        value={step.withScope}
                        onChange={(e) => onUpdate({ withScope: e.target.value })}
                        className="w-full h-7 px-2 rounded-md bg-bg-primary border border-border-subtle text-xs text-text-primary cursor-pointer"
                      >
                        <option value="">Default (changes)</option>
                        {SCOPE_OPTIONS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-text-tertiary mb-0.5 block">Mode</label>
                      <select
                        value={step.withMode}
                        onChange={(e) => onUpdate({ withMode: e.target.value })}
                        className="w-full h-7 px-2 rounded-md bg-bg-primary border border-border-subtle text-xs text-text-primary cursor-pointer"
                      >
                        <option value="">Default (print)</option>
                        {MODE_OPTIONS.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-text-tertiary mb-0.5 block">Focus</label>
                      <div className="relative">
                        <Input
                          value={step.withFocus}
                          onChange={(e) => onUpdate({ withFocus: e.target.value })}
                          placeholder="e.g. security"
                          list={`focus-${step.id}`}
                          className="bg-bg-primary border-border-subtle text-xs h-7"
                        />
                        <datalist id={`focus-${step.id}`}>
                          {FOCUS_PRESETS.map((f) => (
                            <option key={f} value={f} />
                          ))}
                        </datalist>
                      </div>
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] text-text-tertiary mb-0.5 block">Custom Prompt (overrides default)</label>
                      <textarea
                        value={step.withPrompt}
                        onChange={(e) => onUpdate({ withPrompt: e.target.value })}
                        placeholder="Leave empty for default AI prompt..."
                        rows={2}
                        className="w-full rounded-md bg-bg-primary border border-border-subtle px-2 py-1.5 text-xs text-text-primary resize-y focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── YAML Editor (lightweight CodeMirror wrapper) ────────────────────────────

function YamlEditorPane({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  // Lazy-load CodeMirror to keep initial bundle smaller
  const [CodeMirror, setCodeMirror] = useState<typeof import('@uiw/react-codemirror').default | null>(null);
  const [extensions, setExtensions] = useState<import('@codemirror/state').Extension[]>([]);

  useEffect(() => {
    // Dynamic imports for CodeMirror and YAML language
    Promise.all([
      import('@uiw/react-codemirror'),
      import('../lib/codemirror-extensions'),
      import('../lib/codemirror-theme'),
    ]).then(([cm, ext, theme]) => {
      setCodeMirror(() => cm.default);
      const exts = [
        ...ext.getBaseExtensions({ lineNumbers: true, bracketMatching: true }),
        ext.getLanguageExtension('yaml'),
        ext.getIndentExtension(2),
        theme.getThemeExtension('subframe-dark'),
      ].filter((e): e is import('@codemirror/state').Extension => e != null);
      setExtensions(exts);
    });
  }, []);

  if (!CodeMirror) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted text-xs">
        Loading editor...
      </div>
    );
  }

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={extensions}
      theme="none"
      className="h-full [&_.cm-editor]:h-full [&_.cm-scroller]:!overflow-auto text-xs"
      basicSetup={false}
    />
  );
}

// ─── Main Dialog ─────────────────────────────────────────────────────────────

interface WorkflowEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Existing workflow to edit, or null for create */
  editingWorkflow: WorkflowDefinition | null;
  /** Original filename for editing (e.g. "health-check.yml") */
  editingFilename: string | null;
  onSave: (filename: string, content: string) => void;
  onDelete?: (filename: string) => void;
}

export function WorkflowEditorDialog({
  open,
  onOpenChange,
  editingWorkflow,
  editingFilename,
  onSave,
  onDelete,
}: WorkflowEditorProps) {
  const [mode, setMode] = useState<'form' | 'yaml'>('form');
  const [state, setState] = useState<EditorState>(createBlankState);
  const [yamlContent, setYamlContent] = useState('');
  const [dirty, setDirty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Initialize state when dialog opens or workflow changes
  useEffect(() => {
    if (!open) return;
    if (editingWorkflow) {
      const s = definitionToState(editingWorkflow);
      setState(s);
      setYamlContent(stateToYaml(s));
    } else {
      const s = createBlankState();
      setState(s);
      setYamlContent(stateToYaml(s));
    }
    setDirty(false);
    setMode('form');
  }, [open, editingWorkflow]);

  // Sync form → YAML when switching modes
  const handleModeSwitch = useCallback((newMode: 'form' | 'yaml') => {
    if (newMode === 'yaml' && mode === 'form') {
      setYamlContent(stateToYaml(state));
    }
    // Note: YAML → form is lossy / complex, so we don't auto-convert back.
    // User stays in YAML mode once they switch. They can switch back but form state won't update from YAML edits.
    setMode(newMode);
  }, [mode, state]);

  // Update helpers
  const updateState = useCallback((updates: Partial<EditorState>) => {
    setState((prev) => ({ ...prev, ...updates }));
    setDirty(true);
  }, []);

  const updateJob = useCallback((jobId: string, updates: Partial<EditorJob>) => {
    setState((prev) => ({
      ...prev,
      jobs: prev.jobs.map((j) => j.id === jobId ? { ...j, ...updates } : j),
    }));
    setDirty(true);
  }, []);

  const updateStep = useCallback((jobId: string, stepId: string, updates: Partial<EditorStep>) => {
    setState((prev) => ({
      ...prev,
      jobs: prev.jobs.map((j) =>
        j.id === jobId
          ? { ...j, steps: j.steps.map((s) => s.id === stepId ? { ...s, ...updates } : s) }
          : j
      ),
    }));
    setDirty(true);
  }, []);

  const addStep = useCallback((jobId: string) => {
    const newStep = createBlankStep();
    setState((prev) => ({
      ...prev,
      jobs: prev.jobs.map((j) =>
        j.id === jobId ? { ...j, steps: [...j.steps, newStep] } : j
      ),
    }));
    setDirty(true);
  }, []);

  const removeStep = useCallback((jobId: string, stepId: string) => {
    setState((prev) => ({
      ...prev,
      jobs: prev.jobs.map((j) =>
        j.id === jobId ? { ...j, steps: j.steps.filter((s) => s.id !== stepId) } : j
      ),
    }));
    setDirty(true);
  }, []);

  const duplicateStep = useCallback((jobId: string, stepId: string) => {
    setState((prev) => ({
      ...prev,
      jobs: prev.jobs.map((j) => {
        if (j.id !== jobId) return j;
        const idx = j.steps.findIndex((s) => s.id === stepId);
        if (idx < 0) return j;
        const copy = { ...j.steps[idx], id: uid(), name: `${j.steps[idx].name} (copy)`, expanded: true };
        const steps = [...j.steps];
        steps.splice(idx + 1, 0, copy);
        return { ...j, steps };
      }),
    }));
    setDirty(true);
  }, []);

  const reorderSteps = useCallback((jobId: string, newSteps: EditorStep[]) => {
    setState((prev) => ({
      ...prev,
      jobs: prev.jobs.map((j) => j.id === jobId ? { ...j, steps: newSteps } : j),
    }));
    setDirty(true);
  }, []);

  // Template application
  const applyTemplate = useCallback((templateId: string) => {
    const templateYaml: Record<string, string> = {
      'health-check': `name: health-check
on:
  manual: true

jobs:
  audit:
    name: Project Audit
    steps:
      - name: Lint Check
        uses: lint
        continue-on-error: true
      - name: Test Suite
        uses: test
        continue-on-error: true
      - name: Architecture Review
        uses: describe
        with:
          scope: project
      - name: Code Quality Review
        uses: critique
        with:
          scope: project
          focus: architecture
`,
      'docs-audit': `name: docs-audit
on:
  manual: true

jobs:
  audit:
    name: Documentation Audit
    steps:
      - name: Structure Sync
        run: npm run structure && git diff --exit-code .subframe/STRUCTURE.json
        continue-on-error: true
      - name: Documentation Review
        uses: critique
        with:
          scope: project
          focus: documentation
`,
      'security-scan': `name: security-scan
on:
  manual: true

jobs:
  scan:
    name: Security Scan
    steps:
      - name: Dependency Audit
        run: npm audit --audit-level=moderate 2>&1 || true
        continue-on-error: true
      - name: Security Review
        uses: critique
        with:
          scope: project
          focus: security
`,
      review: `name: review
on:
  push:
    branches: ['*']
  manual: true

jobs:
  quality:
    name: Quality Checks
    steps:
      - name: Lint
        uses: lint
      - name: Test
        uses: test
        continue-on-error: true

  review:
    name: Code Review
    needs: [quality]
    steps:
      - name: Describe Changes
        uses: describe
      - name: Code Review
        uses: critique
        require-approval: if_patches
`,
    };

    const yaml = templateYaml[templateId];
    if (yaml) {
      // Parse to get a WorkflowDefinition, then convert to state
      // Simple approach: set YAML and parse manually
      setYamlContent(yaml);
      // Also parse into form state
      try {
        // Parse YAML to get structured data — use a simple regex-based approach
        // since we know our template format
        const nameMatch = yaml.match(/^name:\s*(.+)$/m);
        const name = nameMatch?.[1] ?? templateId;

        // Build a simplified state from the template
        const newState: EditorState = {
          name,
          manualTrigger: yaml.includes('manual: true'),
          pushTrigger: yaml.includes('push:'),
          pushBranches: '*',
          jobs: [],
        };

        // Parse jobs using regex (templates have known structure)
        const jobMatches = yaml.matchAll(/^\s{2}(\w+):\n\s{4}name:\s*(.+)$/gm);
        for (const match of jobMatches) {
          const jobKey = match[1];
          const jobName = match[2];
          const needsMatch = yaml.match(new RegExp(`${jobKey}:[\\s\\S]*?needs:\\s*\\[([^\\]]+)\\]`));

          newState.jobs.push({
            id: uid(),
            key: jobKey,
            name: jobName,
            needs: needsMatch?.[1]?.replace(/'/g, '') ?? '',
            steps: [], // Steps filled below
          });
        }

        // Parse steps within each job
        const jobKeys = newState.jobs.map((j) => j.key);

        // Simple approach: split by job boundaries and parse steps
        for (let ji = 0; ji < newState.jobs.length; ji++) {
          const job = newState.jobs[ji];
          const jobStart = yaml.indexOf(`${job.key}:`);
          const nextJobKey = jobKeys[ji + 1];
          const jobEnd = nextJobKey ? yaml.indexOf(`${nextJobKey}:`, jobStart + 1) : yaml.length;
          const jobSection = yaml.slice(jobStart, jobEnd);

          const stepBlocks = jobSection.split(/(?=- name:)/);
          for (const block of stepBlocks) {
            const nameM = block.match(/- name:\s*(.+)/);
            if (!nameM) continue;

            const usesM = block.match(/uses:\s*(\S+)/);
            const runM = block.match(/run:\s*(.+)/);
            const approvalM = block.match(/require-approval:\s*(\S+)/);
            const continueM = block.match(/continue-on-error:\s*true/);
            const scopeM = block.match(/scope:\s*(\S+)/);
            const modeM = block.match(/mode:\s*(\S+)/);
            const focusM = block.match(/focus:\s*(\S+)/);

            job.steps.push({
              id: uid(),
              name: nameM[1],
              uses: usesM?.[1] ?? '',
              run: runM?.[1] ?? '',
              requireApproval: approvalM?.[1] === 'true' ? 'true'
                : approvalM?.[1] === 'if_patches' ? 'if_patches' : 'false',
              continueOnError: !!continueM,
              timeout: '',
              withScope: scopeM?.[1] ?? '',
              withMode: modeM?.[1] ?? '',
              withFocus: focusM?.[1] ?? '',
              withPrompt: '',
              expanded: false,
            });
          }
        }

        // Fallback: if no jobs parsed, create one with blank step
        if (newState.jobs.length === 0) {
          newState.jobs = [createBlankJob()];
        }

        setState(newState);
      } catch {
        // If parsing fails, just set YAML and switch to YAML mode
        setMode('yaml');
      }
    } else {
      // Blank template
      setState(createBlankState());
      setYamlContent(stateToYaml(createBlankState()));
    }
    setDirty(true);
  }, []);

  // Save handler
  const handleSave = useCallback(() => {
    const content = mode === 'yaml' ? yamlContent : stateToYaml(state);
    const name = mode === 'yaml'
      ? (yamlContent.match(/^name:\s*(.+)$/m)?.[1] ?? 'untitled')
      : (state.name || 'untitled');

    const filename = editingFilename ?? `${name.replace(/[^a-z0-9_-]/gi, '-').toLowerCase()}.yml`;

    if (!content.trim()) {
      toast.error('Workflow content is empty');
      return;
    }

    onSave(filename, content);
    setDirty(false);
  }, [mode, yamlContent, state, editingFilename, onSave]);

  // Delete handler
  const handleDelete = useCallback(() => {
    if (!editingFilename || !onDelete) return;
    onDelete(editingFilename);
    onOpenChange(false);
  }, [editingFilename, onDelete, onOpenChange]);

  const isEditing = !!editingWorkflow;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'bg-bg-primary border-border-subtle text-text-primary',
          'sm:max-w-2xl max-h-[85vh] flex flex-col',
        )}
        aria-describedby={undefined}
      >
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle>
              {isEditing ? 'Edit Workflow' : 'New Workflow'}
              {dirty && <span className="text-accent ml-1 text-xs font-normal">*</span>}
            </DialogTitle>
            <div className="flex items-center gap-2 shrink-0">
              {/* Template presets (new workflow only) */}
              {!isEditing && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="px-2 py-0.5 text-[11px] text-text-tertiary hover:text-accent border border-border-subtle rounded transition-colors cursor-pointer flex items-center gap-1">
                      <Sparkles size={10} />
                      Templates
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[200px]">
                    {WORKFLOW_TEMPLATES.map((t) => (
                      <DropdownMenuItem
                        key={t.id}
                        onClick={() => applyTemplate(t.id)}
                        className="text-xs"
                      >
                        <div>
                          <div className="font-medium">{t.label}</div>
                          <div className="text-[10px] text-text-muted">{t.description}</div>
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Form / YAML toggle */}
              <div className="flex bg-bg-deep rounded-md p-0.5 text-[11px]">
                <button
                  onClick={() => handleModeSwitch('form')}
                  className={cn(
                    'px-2 py-0.5 rounded transition-colors cursor-pointer',
                    mode === 'form' ? 'bg-accent/20 text-accent' : 'text-text-tertiary hover:text-text-primary',
                  )}
                >
                  Visual
                </button>
                <button
                  onClick={() => handleModeSwitch('yaml')}
                  className={cn(
                    'px-2 py-0.5 rounded transition-colors cursor-pointer',
                    mode === 'yaml' ? 'bg-accent/20 text-accent' : 'text-text-tertiary hover:text-text-primary',
                  )}
                >
                  YAML
                </button>
              </div>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="py-2">
            {mode === 'form' ? (
              <div className="space-y-4 px-1">
                {/* Workflow metadata */}
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] text-text-tertiary mb-0.5 block">Workflow Name</label>
                    <Input
                      value={state.name}
                      onChange={(e) => updateState({ name: e.target.value })}
                      placeholder="my-workflow"
                      className="bg-bg-deep border-border-subtle text-xs h-7"
                      autoFocus
                    />
                  </div>
                </div>

                {/* Triggers */}
                <div>
                  <label className="text-[10px] text-text-tertiary mb-1 block">Triggers</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer">
                      <input
                        type="checkbox"
                        checked={state.manualTrigger}
                        onChange={(e) => updateState({ manualTrigger: e.target.checked })}
                        className="accent-accent cursor-pointer"
                      />
                      Manual
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer">
                      <input
                        type="checkbox"
                        checked={state.pushTrigger}
                        onChange={(e) => updateState({ pushTrigger: e.target.checked })}
                        className="accent-accent cursor-pointer"
                      />
                      On Push
                    </label>
                    {state.pushTrigger && (
                      <Input
                        value={state.pushBranches}
                        onChange={(e) => updateState({ pushBranches: e.target.value })}
                        placeholder="*, main, feature/*"
                        className="bg-bg-deep border-border-subtle text-xs h-6 w-40"
                      />
                    )}
                  </div>
                </div>

                {/* Jobs */}
                {state.jobs.map((job) => (
                  <div key={job.id} className="border border-border-subtle rounded-lg p-3 bg-bg-secondary/30">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex-1">
                        <label className="text-[10px] text-text-tertiary mb-0.5 block">Job Name</label>
                        <div className="flex gap-2">
                          <Input
                            value={job.key}
                            onChange={(e) => updateJob(job.id, { key: e.target.value.replace(/\s/g, '-') })}
                            placeholder="job-key"
                            className="bg-bg-deep border-border-subtle text-xs h-7 w-28 font-mono"
                          />
                          <Input
                            value={job.name}
                            onChange={(e) => updateJob(job.id, { name: e.target.value })}
                            placeholder="Display name"
                            className="bg-bg-deep border-border-subtle text-xs h-7 flex-1"
                          />
                        </div>
                      </div>
                      {state.jobs.length > 1 && (
                        <div>
                          <label className="text-[10px] text-text-tertiary mb-0.5 block">Depends on</label>
                          <Input
                            value={job.needs}
                            onChange={(e) => updateJob(job.id, { needs: e.target.value })}
                            placeholder="job-key"
                            className="bg-bg-deep border-border-subtle text-xs h-7 w-28 font-mono"
                          />
                        </div>
                      )}
                      {state.jobs.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setState((prev) => ({
                            ...prev,
                            jobs: prev.jobs.filter((j) => j.id !== job.id),
                          }))}
                          className="p-1 text-text-muted hover:text-error transition-colors cursor-pointer mt-4"
                          title="Remove job"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>

                    {/* Steps */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-text-tertiary block">Steps</label>
                      <Reorder.Group
                        axis="y"
                        values={job.steps}
                        onReorder={(newSteps) => reorderSteps(job.id, newSteps)}
                        className="space-y-1.5"
                      >
                        <AnimatePresence initial={false}>
                          {job.steps.map((step, stepIdx) => (
                            <Reorder.Item
                              key={step.id}
                              value={step}
                              className="list-none"
                            >
                              <StepCard
                                step={step}
                                index={stepIdx}
                                onUpdate={(updates) => updateStep(job.id, step.id, updates)}
                                onRemove={() => removeStep(job.id, step.id)}
                                onDuplicate={() => duplicateStep(job.id, step.id)}
                              />
                            </Reorder.Item>
                          ))}
                        </AnimatePresence>
                      </Reorder.Group>

                      <button
                        type="button"
                        onClick={() => addStep(job.id)}
                        className="flex items-center gap-1 text-xs text-text-tertiary hover:text-accent transition-colors cursor-pointer mt-1"
                      >
                        <Plus size={12} /> Add step
                      </button>
                    </div>
                  </div>
                ))}

                {/* Add job button */}
                <button
                  type="button"
                  onClick={() => setState((prev) => ({
                    ...prev,
                    jobs: [...prev.jobs, { ...createBlankJob(), key: `job${prev.jobs.length + 1}` }],
                  }))}
                  className="flex items-center gap-1 text-xs text-text-tertiary hover:text-accent transition-colors cursor-pointer"
                >
                  <Plus size={12} /> Add job
                </button>
              </div>
            ) : (
              /* YAML editor mode */
              <div className="h-[50vh] border border-border-subtle rounded-md overflow-hidden mx-1">
                <YamlEditorPane
                  value={yamlContent}
                  onChange={(val) => { setYamlContent(val); setDirty(true); }}
                />
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center gap-2 pt-2 border-t border-border-subtle">
          {isEditing && onDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-error hover:text-error gap-1"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={12} />
              Delete
            </Button>
          )}
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="text-xs gap-1 bg-accent text-bg-deep hover:bg-accent/90"
            onClick={handleSave}
          >
            <Save size={12} />
            {isEditing ? 'Save' : 'Create'}
          </Button>
        </div>
      </DialogContent>

      {/* Delete confirmation */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent className="bg-bg-primary border-border-subtle text-text-primary">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Workflow</AlertDialogTitle>
            <AlertDialogDescription className="text-text-secondary">
              This will permanently delete <strong>{editingFilename}</strong>. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-error text-white hover:bg-error/90 text-xs"
              onClick={() => { setConfirmDelete(false); handleDelete(); }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
