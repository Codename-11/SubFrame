/**
 * SubFrameHealthPanel — Health status and management for SubFrame project components.
 * Shows per-component status grouped by category, update actions, and uninstall options.
 */

import { useState } from 'react';
import {
  RefreshCw, CheckCircle, XCircle, AlertTriangle,
  ChevronDown, ChevronRight, Loader2, Trash2, Eye,
  ArrowUpCircle, Sparkles, ShieldOff,
} from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { cn } from '../lib/utils';
import { useSubFrameHealth } from '../hooks/useSubFrameHealth';
import { useProjectStore } from '../stores/useProjectStore';
import { toast } from 'sonner';
import type { SubFrameComponentStatus, UninstallOptions } from '../../shared/ipcChannels';

// ── Category definitions ──

const CATEGORY_LABELS: Record<string, string> = {
  core: 'Core Files',
  hooks: 'Claude Code Hooks',
  skills: 'Claude Code Skills',
  'claude-integration': 'Claude Integration',
  git: 'Git Hooks',
  pipeline: 'Pipeline Workflows',
};

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  core: 'Project documentation and tracking files',
  hooks: 'Event scripts that run during Claude Code sessions',
  skills: 'Slash commands for task management, documentation, and audits',
  'claude-integration': 'Hook configuration in .claude/settings.json',
  git: 'Pre-commit and pre-push hooks for automation',
  pipeline: 'Configurable CI/review workflows in .subframe/workflows/',
};

const CATEGORY_ORDER = ['core', 'hooks', 'skills', 'claude-integration', 'git', 'pipeline'];

function groupByCategory(components: SubFrameComponentStatus[]): Record<string, SubFrameComponentStatus[]> {
  const groups: Record<string, SubFrameComponentStatus[]> = {};
  for (const comp of components) {
    const cat = comp.category;
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(comp);
  }
  return groups;
}

// ── Status helpers ──

function getStatusBadge(comp: SubFrameComponentStatus) {
  if (comp.managedOptOut) {
    return { label: 'User-managed', className: 'bg-blue-900/60 text-blue-300', title: 'User opted out of auto-updates (@subframe-managed: false)' };
  }
  if (!comp.exists) {
    return { label: 'Missing', className: 'bg-red-900/60 text-red-300', title: 'Component file not found — click update to install' };
  }
  if (comp.needsUpdate) {
    const versionInfo = comp.deployedVersion ? ` (${comp.deployedVersion})` : '';
    return { label: 'Outdated', className: 'bg-amber-900/60 text-amber-300', title: `Component exists but differs from the latest version${versionInfo} — click update to sync` };
  }
  return { label: 'Healthy', className: 'bg-emerald-900/60 text-emerald-300', title: 'Component is up to date' };
}

function getStatusIcon(comp: SubFrameComponentStatus) {
  if (comp.managedOptOut) return <ShieldOff size={14} className="text-blue-400 shrink-0" />;
  if (!comp.exists) return <XCircle size={14} className="text-red-400 shrink-0" />;
  if (comp.needsUpdate) return <AlertTriangle size={14} className="text-amber-400 shrink-0" />;
  return <CheckCircle size={14} className="text-emerald-400 shrink-0" />;
}

// ── Default uninstall options ──

const DEFAULT_UNINSTALL: UninstallOptions = {
  removeClaudeHooks: false,
  removeGitHooks: false,
  removeBacklinks: false,
  removeAgentsMd: false,
  removeClaudeSkills: false,
  removeSubframeDir: true,
  dryRun: false,
};

const UNINSTALL_OPTIONS: Array<{ key: keyof Omit<UninstallOptions, 'dryRun'>; label: string; description: string }> = [
  { key: 'removeSubframeDir', label: 'Remove .subframe/ directory', description: 'Config, structure map, docs-internal' },
  { key: 'removeClaudeHooks', label: 'Remove Claude hooks', description: 'SessionStart, UserPromptSubmit, Stop hooks from .claude/settings.json' },
  { key: 'removeGitHooks', label: 'Remove Git hooks', description: 'pre-commit hook installed by SubFrame' },
  { key: 'removeBacklinks', label: 'Remove backlinks', description: 'SubFrame backlink blocks from CLAUDE.md, GEMINI.md' },
  { key: 'removeAgentsMd', label: 'Remove AGENTS.md', description: 'The AGENTS.md file managed by SubFrame' },
  { key: 'removeClaudeSkills', label: 'Remove Claude skills', description: '/sub-tasks, /sub-docs, /sub-audit, /onboard from .claude/skills/' },
];

// ── Simple checkbox (no shadcn Checkbox available) ──

function SimpleCheckbox({
  checked,
  onChange,
  id,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id: string;
}) {
  return (
    <input
      type="checkbox"
      id={id}
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="w-3.5 h-3.5 rounded border-border-default bg-bg-deep accent-accent cursor-pointer shrink-0"
    />
  );
}

export function SubFrameHealthPanel() {
  const projectPath = useProjectStore((s) => s.currentProjectPath);
  const {
    health, isLoading, refetch,
    updateComponents, uninstall,
    updateResult, uninstallResult,
  } = useSubFrameHealth();

  // ── Uninstall section state ──
  const [uninstallOpen, setUninstallOpen] = useState(false);
  const [uninstallOpts, setUninstallOpts] = useState<UninstallOptions>({ ...DEFAULT_UNINSTALL });
  const [confirmUninstall, setConfirmUninstall] = useState(false);

  if (!projectPath) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-text-tertiary text-sm gap-1">
        <span>No project selected</span>
        <span className="text-xs opacity-60">Health status will appear here</span>
      </div>
    );
  }

  const outdatedIds = health?.components.filter((c) => c.needsUpdate || !c.exists).map((c) => c.id) || [];
  const grouped = health ? groupByCategory(health.components) : {};

  const handleUpdateAll = () => {
    if (outdatedIds.length === 0) return;
    updateComponents.mutate(outdatedIds, {
      onSuccess: () => toast.success(`Updating ${outdatedIds.length} component(s)...`),
    });
  };

  const handleUpdateSingle = (id: string) => {
    updateComponents.mutate([id], {
      onSuccess: () => toast.success(`Updating ${id}...`),
    });
  };

  const handlePreview = () => {
    uninstall.mutate({ ...uninstallOpts, dryRun: true }, {
      onSuccess: () => toast.info('Dry run complete — check results below'),
    });
  };

  const handleUninstall = () => {
    if (!confirmUninstall) {
      setConfirmUninstall(true);
      return;
    }
    uninstall.mutate({ ...uninstallOpts, dryRun: false }, {
      onSuccess: () => toast.success('Uninstall initiated'),
    });
    setConfirmUninstall(false);
  };

  const setOpt = (key: keyof Omit<UninstallOptions, 'dryRun'>, value: boolean) => {
    setUninstallOpts((prev) => ({ ...prev, [key]: value }));
    setConfirmUninstall(false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-secondary font-medium">SubFrame Health</span>
          {health && (
            <Badge
              variant="secondary"
              className={cn(
                'text-[9px] px-1.5 py-0',
                health.healthy === health.total
                  ? 'bg-emerald-900/60 text-emerald-300'
                  : 'bg-amber-900/60 text-amber-300'
              )}
            >
              {health.healthy}/{health.total}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (projectPath) {
                window.dispatchEvent(new CustomEvent('start-onboarding', { detail: { projectPath } }));
              }
            }}
            className="h-7 px-2 text-xs gap-1 cursor-pointer"
            title="Run AI analysis to populate STRUCTURE.json, PROJECT_NOTES, and tasks"
          >
            <Sparkles size={13} />
            AI Analysis
          </Button>
          {outdatedIds.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleUpdateAll}
              disabled={updateComponents.isPending}
              className="h-7 px-2 text-xs gap-1 cursor-pointer"
            >
              {updateComponents.isPending ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <ArrowUpCircle size={13} />
              )}
              Update All
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={refetch}
            className="h-7 px-2 cursor-pointer"
          >
            <RefreshCw size={14} />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        {isLoading && !health ? (
          <div className="flex items-center justify-center h-32 text-text-tertiary text-sm">
            Loading...
          </div>
        ) : !health ? (
          <div className="flex flex-col items-center justify-center h-32 text-text-tertiary text-sm gap-1">
            <span>No health data available</span>
            <span className="text-xs opacity-60">Initialize SubFrame in this project first</span>
          </div>
        ) : (
          <div className="flex flex-col gap-3 p-3">
            {/* ── Uninstall section — moved to top ── */}
            <div className="mb-3 pb-3 border-b border-border-subtle/50">
              <button
                onClick={() => {
                  setUninstallOpen(!uninstallOpen);
                  setConfirmUninstall(false);
                }}
                className="flex items-center gap-1.5 text-xs text-red-400/80 hover:text-red-400 transition-colors cursor-pointer w-full"
              >
                {uninstallOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                <Trash2 size={13} />
                <span className="font-medium">Uninstall SubFrame</span>
              </button>

              {uninstallOpen && (
                <div className="mt-3 flex flex-col gap-3">
                  {/* Warning */}
                  <div className="p-2.5 rounded-md bg-red-900/20 border border-red-900/40 text-xs text-red-300">
                    <div className="font-medium mb-1">Danger Zone</div>
                    <p className="text-red-300/80 leading-relaxed">
                      This will remove SubFrame integration from the project.
                      User data in <span className="font-mono">.subframe/tasks/*.md</span> and{' '}
                      <span className="font-mono">.subframe/PROJECT_NOTES.md</span> may be lost
                      if <span className="font-mono">.subframe/</span> is removed. Consider backing up first.
                    </p>
                  </div>

                  {/* Options */}
                  <div className="flex flex-col gap-2">
                    {UNINSTALL_OPTIONS.map((opt) => (
                      <label
                        key={opt.key}
                        htmlFor={`uninstall-${opt.key}`}
                        className="flex items-start gap-2.5 cursor-pointer group"
                      >
                        <SimpleCheckbox
                          id={`uninstall-${opt.key}`}
                          checked={uninstallOpts[opt.key]}
                          onChange={(v) => setOpt(opt.key, v)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-text-primary group-hover:text-accent transition-colors">
                            {opt.label}
                          </div>
                          <div className="text-[10px] text-text-tertiary">{opt.description}</div>
                        </div>
                      </label>
                    ))}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handlePreview}
                      disabled={uninstall.isPending}
                      className="h-7 px-2 text-xs gap-1.5 cursor-pointer"
                    >
                      {uninstall.isPending ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Eye size={13} />
                      )}
                      Preview Changes
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleUninstall}
                      disabled={uninstall.isPending}
                      className={cn(
                        'h-7 px-2 text-xs gap-1.5 cursor-pointer',
                        confirmUninstall
                          ? 'text-red-400 hover:text-red-300 bg-red-900/30 hover:bg-red-900/50'
                          : 'text-text-secondary'
                      )}
                    >
                      <Trash2 size={13} />
                      {confirmUninstall ? 'Confirm Uninstall' : 'Uninstall SubFrame'}
                    </Button>
                  </div>

                  {/* Uninstall result */}
                  {uninstallResult && (
                    <div className="p-2.5 rounded-md bg-bg-deep/50 border border-border-subtle/50 text-xs">
                      <div className="font-medium text-text-primary mb-1.5">
                        {uninstallResult.dryRun ? 'Preview (Dry Run)' : 'Uninstall Result'}
                      </div>
                      {uninstallResult.removed.length > 0 && (
                        <div className="mb-1">
                          <span className="text-text-tertiary">{uninstallResult.dryRun ? 'Would remove:' : 'Removed:'}</span>
                          <ul className="mt-0.5 flex flex-col gap-0.5">
                            {uninstallResult.removed.map((item) => (
                              <li key={item} className="text-red-400 font-mono pl-2">- {item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {uninstallResult.preserved.length > 0 && (
                        <div className="mb-1">
                          <span className="text-text-tertiary">Preserved:</span>
                          <ul className="mt-0.5 flex flex-col gap-0.5">
                            {uninstallResult.preserved.map((item) => (
                              <li key={item} className="text-emerald-400 font-mono pl-2">- {item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {uninstallResult.errors.length > 0 && (
                        <div>
                          <span className="text-text-tertiary">Errors:</span>
                          <ul className="mt-0.5 flex flex-col gap-0.5">
                            {uninstallResult.errors.map((err, i) => (
                              <li key={i} className="text-amber-400 pl-2">- {err}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Component groups ── */}
            {CATEGORY_ORDER.map((cat) => {
              const components = grouped[cat];
              if (!components || components.length === 0) return null;

              return (
                <div key={cat}>
                  <div className="mb-1.5">
                    <div className="text-[10px] uppercase tracking-wider text-text-tertiary font-medium">
                      {CATEGORY_LABELS[cat] || cat}
                    </div>
                    {CATEGORY_DESCRIPTIONS[cat] && (
                      <div className="text-[10px] text-text-muted mt-0.5">{CATEGORY_DESCRIPTIONS[cat]}</div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    {components.map((comp) => {
                      const badge = getStatusBadge(comp);
                      const canUpdate = (comp.needsUpdate || !comp.exists) && !comp.managedOptOut;

                      return (
                        <div
                          key={comp.id}
                          className="flex items-center gap-3 p-2.5 rounded-md bg-bg-deep/50 border border-border-subtle/50"
                        >
                          {getStatusIcon(comp)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-text-primary truncate">{comp.label}</span>
                              <Badge variant="secondary" className={cn('text-[9px] px-1.5 py-0', badge.className)} title={badge.title}>
                                {badge.label}
                              </Badge>
                            </div>
                            <div className="text-[10px] text-text-tertiary mt-0.5 font-mono truncate">
                              {comp.path}
                            </div>
                            {/* Show version transition for outdated components */}
                            {comp.needsUpdate && comp.deployedVersion && (
                              <div className="text-[10px] text-amber-400/80 mt-0.5">
                                v{comp.deployedVersion} → v{health ? 'latest' : '?'}
                              </div>
                            )}
                            {/* Show missing hooks for claude-settings */}
                            {comp.missingHooks && comp.missingHooks.length > 0 && (
                              <div className="text-[10px] text-amber-400/80 mt-0.5">
                                Missing: {comp.missingHooks.join(', ')}
                              </div>
                            )}
                          </div>
                          {canUpdate && (
                            <button
                              onClick={() => handleUpdateSingle(comp.id)}
                              className="p-1.5 rounded text-text-tertiary hover:text-accent hover:bg-bg-hover transition-colors cursor-pointer"
                              title={comp.exists ? 'Update component' : 'Install component'}
                            >
                              <ArrowUpCircle size={13} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* ── Update result feedback ── */}
            {updateResult && (
              <div className="mt-1 p-2.5 rounded-md bg-bg-deep/50 border border-border-subtle/50">
                {updateResult.updated.length > 0 && (
                  <div className="flex items-center gap-2 text-xs text-emerald-400 mb-1">
                    <CheckCircle size={12} />
                    <span>Updated: {updateResult.updated.join(', ')}</span>
                  </div>
                )}
                {updateResult.skipped && updateResult.skipped.length > 0 && (
                  <div className="flex items-center gap-2 text-xs text-blue-400 mb-1">
                    <ShieldOff size={12} />
                    <span>Skipped (user-managed): {updateResult.skipped.join(', ')}</span>
                  </div>
                )}
                {updateResult.failed.length > 0 && (
                  <div className="flex items-center gap-2 text-xs text-red-400">
                    <XCircle size={12} />
                    <span>Failed: {updateResult.failed.join(', ')}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
