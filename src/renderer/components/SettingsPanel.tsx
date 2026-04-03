/**
 * SettingsPanel — Settings dialog/modal with sidebar navigation.
 * Opens via useUIStore.settingsOpen.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import QRCode from 'qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
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
import { Input } from './ui/input';
import { Button } from './ui/button';
import {
  FolderSearch, FolderOpen, Plus, Trash2, X as XIcon, RefreshCw, ExternalLink,
  Github, FileText, Sparkles, Scale, Info, Check, RotateCcw, Save,
  Palette, SlidersHorizontal, TerminalSquare, Code2, Bot, Download, Search, Globe,
  Zap, ChevronDown, ChevronRight, Pencil, Wand2, Play, Shield, FileCode, Bell,
  Monitor, Wifi, Copy, QrCode, AlertTriangle, Smartphone, FolderX, Eye,
} from 'lucide-react';
import { useUIStore } from '../stores/useUIStore';
import { useProjectStore } from '../stores/useProjectStore';
import { useTerminalStore } from '../stores/useTerminalStore';
import { useSettings, useAIToolConfig } from '../hooks/useSettings';
import { typedInvoke, typedSend } from '../lib/ipc';
import { useIpcQuery } from '../hooks/useIpc';
import { useIPCEvent } from '../hooks/useIPCListener';
import { IPC, type ShellInfo, type WorkspaceListResult, type UninstallOptions, type UninstallResult } from '../../shared/ipcChannels';
import { WebServerSetup } from './WebServerSetup';
import { toast } from 'sonner';
import { EDITOR_THEMES } from '../lib/codemirror-theme';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';
import {
  DEFAULT_WORKSPACE_PILL_DISPLAY,
  WORKSPACE_ACCENT_OPTIONS,
  WORKSPACE_ICON_COMPONENTS,
  WORKSPACE_ICON_OPTIONS,
  getWorkspacePillPresentation,
  normalizeWorkspaceAccentColor,
  normalizeWorkspaceIcon,
  normalizeWorkspacePillDisplay,
  normalizeWorkspaceShortLabel,
  withWorkspaceAccentAlpha,
  type WorkspacePillDisplaySettings,
} from '../lib/workspacePills';
import {
  type ThemeTokens,
  type ThemeDefinition,
  BUILTIN_THEMES,
  THEME_CLASSIC_AMBER,
  getThemeById,
} from '../../shared/themeTypes';

import { getTransport } from '../lib/transportProvider';
import { useUpdater } from '../hooks/useUpdater';
const APP_VERSION = require('../../../package.json').version;

const BUILTIN_TOOL_IDS = new Set(['claude', 'codex', 'gemini']);

/** Known flag chips per AI tool. Each flag has a key, display label, the actual CLI flag, and whether it's dangerous. */
interface ToolFlag {
  key: string;
  label: string;
  flag: string;
  group?: string;
  dangerous?: boolean;
  description?: string;
}

const TOOL_FLAGS: Record<string, ToolFlag[]> = {
  claude: [
    { key: 'dangerously-skip-permissions', label: 'YOLO Mode', flag: '--dangerously-skip-permissions', group: 'permission-mode', dangerous: true, description: 'Bypasses all permission checks' },
    { key: 'accept-edits', label: 'Accept Edits', flag: '--permission-mode acceptEdits', group: 'permission-mode', description: 'Auto-accept edits while keeping command approvals' },
    { key: 'plan-mode', label: 'Plan Mode', flag: '--permission-mode plan', group: 'permission-mode', description: 'Use Claude planning mode instead of acting directly' },
    { key: 'continue', label: 'Resume Last', flag: '--continue', description: 'Continue the latest conversation in this directory' },
    { key: 'verbose', label: 'Verbose', flag: '--verbose', description: 'Enable verbose output' },
  ],
  codex: [
    { key: 'danger-full-access', label: 'YOLO Mode', flag: '--dangerously-bypass-approvals-and-sandbox', group: 'execution-mode', dangerous: true, description: 'Skips approvals and sandboxing entirely' },
    { key: 'full-auto', label: 'Full Auto', flag: '--full-auto', group: 'execution-mode', description: 'Low-friction automatic execution in workspace-write sandbox' },
    { key: 'read-only', label: 'Read Only', flag: '--sandbox read-only', group: 'execution-mode', description: 'Force read-only sandbox execution' },
    { key: 'workspace-write', label: 'Workspace Write', flag: '--sandbox workspace-write', group: 'execution-mode', description: 'Allow writes inside the workspace sandbox' },
    { key: 'search', label: 'Web Search', flag: '--search', description: 'Enable native live web search' },
  ],
  gemini: [
    { key: 'yolo', label: 'YOLO Mode', flag: '--yolo', group: 'approval-mode', dangerous: true, description: 'Automatically accept all actions' },
    { key: 'auto-edit', label: 'Auto Edit', flag: '--approval-mode auto_edit', group: 'approval-mode', description: 'Auto-approve edit tools only' },
    { key: 'plan-mode', label: 'Plan Mode', flag: '--approval-mode plan', group: 'approval-mode', description: 'Read-only planning mode' },
    { key: 'sandbox', label: 'Sandbox', flag: '--sandbox', description: 'Run with Gemini sandboxing enabled' },
    { key: 'debug', label: 'Debug', flag: '--debug', description: 'Open Gemini debug tools' },
  ],
};

const DEFAULT_FONT = "'JetBrainsMono Nerd Font', 'CaskaydiaCove Nerd Font', 'FiraCode Nerd Font', 'JetBrains Mono', 'Cascadia Code', 'Fira Code', monospace";

/** Nerd Font families to probe — the font-family name as installed on disk. */
const NERD_FONTS = [
  'JetBrainsMono Nerd Font',
  'CaskaydiaCove Nerd Font',
  'FiraCode Nerd Font',
  'Hack Nerd Font',
  'MesloLGS Nerd Font',
];

function detectNerdFont(): string | null {
  if (typeof document === 'undefined') return null;
  for (const font of NERD_FONTS) {
    if (document.fonts.check(`12px "${font}"`)) return font;
  }
  return null;
}

/* ---------- Navigation items ---------- */

const NAV_ITEMS = [
  { key: 'appearance', label: 'Appearance', icon: Palette },
  { key: 'general', label: 'General', icon: SlidersHorizontal },
  { key: 'terminal', label: 'Terminal', icon: TerminalSquare },
  { key: 'editor', label: 'Editor', icon: Code2 },
  { key: 'ai-tool', label: 'AI Tool', icon: Bot },
  { key: 'hooks', label: 'Hooks', icon: Zap },
  { key: 'integrations', label: 'Integrations', icon: Globe },
  { key: 'project', label: 'Project', icon: FolderOpen },
  { key: 'updates', label: 'Updates', icon: Download },
  { key: 'about', label: 'About', icon: Info },
] as const;

/* ---------- Searchable setting metadata per section ---------- */

const SECTION_LABELS: Record<string, string[]> = {
  appearance: [
    'Theme Presets', 'Customize', 'Neon Traces', 'CRT Scanlines', 'Logo Glow',
    'Accent', 'Neon Purple', 'Neon Pink', 'Neon Cyan', 'Save as Custom Theme',
    'Workspace Pills', 'Workspace Pill Style', 'Short Label', 'Icon', 'Icon + Short Label',
  ],
  general: [
    'Open terminal on startup', 'Reuse idle terminal for agent',
    'Show hidden files (.dotfiles)', 'Confirm before closing',
    'Auto-poll usage', 'Grid overflow auto-switch',
    'Highlight user messages', 'Default Project Directory',
    'Startup', 'Behavior', 'Paths', 'Git', 'Auto-fetch', 'Install CLI', 'CLI',
    'Collapsed Workspace Count', 'Max Visible Workspaces', 'Workspace Bar', 'Collapsed Pill Count',
    'Auto-sort Workspace Pills', 'Max Visible Workspace Pills',
  ],
  terminal: [
    'Font Size', 'Font Family', 'Line Height', 'Scrollback Lines',
    'Cursor Style', 'Cursor Blink', 'Default Shell', 'Bell Sound',
    'Copy on Select', 'Max Terminals', 'Font', 'Display', 'Behavior', 'Nerd Font',
    'Restore on Startup', 'Restore Scrollback', 'Auto-resume Agent', 'Persistence',
    'Session Recovery', 'Resume Agent', 'Freeze Hover Action', 'Hover Freeze Button',
    'Paused Output Overlay', 'Freeze Overlay',
  ],
  editor: [
    'Font Size', 'Font Family', 'Tab Size', 'Theme',
    'Word Wrap', 'Minimap', 'Line Numbers', 'Bracket Matching',
    'Font', 'Display',
  ],
  'ai-tool': [
    'AI Tools', 'Start Command', 'Custom Tools',
    'Add custom AI tools', 'Dangerous Mode', 'YOLO Mode',
    'Accept Edits', 'Plan Mode', 'Resume Last', 'Full Auto',
    'Read Only', 'Workspace Write', 'Web Search', 'Auto Edit', 'Debug',
  ],
  hooks: [
    'Hooks', 'PreToolUse', 'PostToolUse', 'Notification', 'Stop',
    'UserPromptSubmit', 'SessionStart', 'Add Hook', 'Templates',
    'AI Generate', 'Block .env writes', 'Log all commands',
    'Auto-approve reads', 'Notify on completion',
  ],
  integrations: [
    'Local API Server', 'API Server', 'Enable API', 'DTSP', 'Desktop Text Source Protocol',
    'SubFrame Server', 'Web Server', 'Remote Access', 'SSH Tunnel', 'LAN', 'Local Network', 'Android', 'Pairing',
    'Preferred Port', 'Static Port', 'Connection URL', 'Session Token', 'Remote Cursor', 'Cursor Tracking',
    'Shell Integration', 'CLI Status', 'Context Menu', 'Explorer',
  ],
  updates: [
    'Auto-check for updates', 'Pre-release Channel',
    'Check Interval', 'Update Preferences',
  ],
  project: [
    'Uninstall', 'Remove SubFrame', 'AGENTS.md', 'Hooks', 'Git Hooks',
    'Backlinks', 'Skills', 'Danger Zone', 'Rollback',
  ],
  about: [
    'SubFrame', 'GitHub', 'Report Issue', "What's New",
    'Changelog', 'Links', 'About',
  ],
};

/* ---------- Hooks types & constants ---------- */

/** A single hook command entry in Claude Code's settings.json */
interface HookCommand {
  type: 'command';
  command: string;
}

/** A hook entry (matcher + list of commands) */
interface HookEntry {
  matcher: string;
  hooks: HookCommand[];
}

/** The hooks object from .claude/settings.json */
interface HooksConfig {
  [eventType: string]: HookEntry[];
}

/** All supported hook event types */
const HOOK_EVENT_TYPES = [
  { key: 'PreToolUse', label: 'Pre Tool Use', description: 'Runs before a tool is executed', icon: Shield },
  { key: 'PostToolUse', label: 'Post Tool Use', description: 'Runs after a tool completes', icon: Check },
  { key: 'Notification', label: 'Notification', description: 'Runs on notifications', icon: Bell },
  { key: 'Stop', label: 'Stop', description: 'Runs when Claude stops responding', icon: Play },
  { key: 'UserPromptSubmit', label: 'Prompt Submit', description: 'Runs when user submits a prompt', icon: FileText },
  { key: 'SessionStart', label: 'Session Start', description: 'Runs at session start', icon: Zap },
] as const;

/** Common matcher suggestions per event type */
const MATCHER_SUGGESTIONS: Record<string, string[]> = {
  PreToolUse: ['Bash', 'Write', 'Read', 'Edit', 'Glob', 'Grep', '*'],
  PostToolUse: ['Bash', 'Write', 'Read', 'Edit', '*'],
  Notification: [''],
  Stop: [''],
  UserPromptSubmit: [''],
  SessionStart: [''],
};

/** Quick hook templates */
const HOOK_TEMPLATES = [
  {
    name: 'Block .env writes',
    description: 'Prevent writing to .env files',
    eventType: 'PreToolUse',
    matcher: 'Write',
    scriptDescription: 'Block any writes to files matching .env* patterns. If the tool_input.file_path contains ".env", output a JSON object with { "decision": "block", "reason": "Writing to .env files is not allowed" }.',
  },
  {
    name: 'Log all commands',
    description: 'Log tool usage to a file',
    eventType: 'PostToolUse',
    matcher: '*',
    scriptDescription: 'Log the tool name, timestamp, and a summary of the tool input to a file at .claude/hooks/tool-log.txt. Append each entry as a new line.',
  },
  {
    name: 'Auto-approve reads',
    description: 'Auto-approve read-only tools',
    eventType: 'PreToolUse',
    matcher: 'Read',
    scriptDescription: 'Auto-approve all Read tool invocations by outputting a JSON object with { "decision": "approve" }.',
  },
  {
    name: 'Notify on completion',
    description: 'Desktop notification when agent stops',
    eventType: 'Stop',
    matcher: '',
    scriptDescription: 'Send a desktop notification (using node-notifier or native OS commands) saying "Claude has finished responding" when the agent stops.',
  },
];

/* ---------- Reusable setting components (file-local) ---------- */

function SettingGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div data-setting-group={label}>
      <div className="text-[10px] uppercase tracking-wider text-text-tertiary font-medium mb-1.5">{label}</div>
      <div className="bg-bg-secondary/50 rounded-lg p-3 space-y-3">{children}</div>
    </div>
  );
}

/* ---------- Project Uninstall Section ---------- */

const UNINSTALL_ITEMS: Array<{
  key: keyof UninstallOptions;
  label: string;
  description: string;
  warnIfModified?: string;
}> = [
  { key: 'removeSubframeDir', label: '.subframe/ directory', description: 'Config, structure map, tasks, notes, internal docs' },
  { key: 'removeClaudeHooks', label: 'Claude hooks', description: 'SessionStart, UserPromptSubmit, Stop hooks from .claude/settings.json' },
  { key: 'removeClaudeSkills', label: 'Claude skills', description: '/sub-tasks, /sub-docs, /sub-audit, /onboard from .claude/skills/' },
  { key: 'removeGitHooks', label: 'Git hooks', description: 'pre-commit hook installed by SubFrame' },
  { key: 'removeBacklinks', label: 'Backlinks', description: 'SubFrame reference blocks from CLAUDE.md, GEMINI.md' },
  { key: 'removeAgentsMd', label: 'AGENTS.md', description: 'The AGENTS.md file managed by SubFrame', warnIfModified: 'Other tools (Claude Code, Codex) may also use this file' },
];

function ProjectUninstallSection({ projectPath }: { projectPath: string | null }) {
  const isFrameProject = useProjectStore((s) => s.isFrameProject);
  const [opts, setOpts] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    UNINSTALL_ITEMS.forEach((item) => { initial[item.key] = true; });
    return initial;
  });
  const [previewResult, setPreviewResult] = useState<UninstallResult | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [confirmStep, setConfirmStep] = useState(0); // 0=idle, 1=confirmed once, 2=executing
  const [result, setResult] = useState<UninstallResult | null>(null);

  // Listen for uninstall results
  useEffect(() => {
    const handler = (_event: unknown, data: { projectPath: string; result: UninstallResult | null }) => {
      if (data.result) {
        if (data.result.dryRun) {
          setPreviewResult(data.result);
          setShowPreview(true);
        } else {
          setResult(data.result);
          setConfirmStep(0);
          if (data.result.success) {
            useProjectStore.getState().setIsFrameProject(false);
            toast.success('SubFrame removed from project');
          }
        }
      }
    };
    return getTransport().on(IPC.SUBFRAME_UNINSTALLED, handler);
  }, []);

  const toggle = (key: string) => {
    setOpts((prev) => ({ ...prev, [key]: !prev[key] }));
    setPreviewResult(null);
    setShowPreview(false);
    setConfirmStep(0);
  };

  const buildOptions = (dryRun: boolean): UninstallOptions => ({
    removeClaudeHooks: opts.removeClaudeHooks ?? true,
    removeGitHooks: opts.removeGitHooks ?? true,
    removeBacklinks: opts.removeBacklinks ?? true,
    removeAgentsMd: opts.removeAgentsMd ?? true,
    removeClaudeSkills: opts.removeClaudeSkills ?? true,
    removeSubframeDir: opts.removeSubframeDir ?? true,
    dryRun,
  });

  const handlePreview = () => {
    if (!projectPath) return;
    typedSend(IPC.UNINSTALL_SUBFRAME, { projectPath, options: buildOptions(true) });
  };

  const handleUninstall = () => {
    if (!projectPath) return;
    if (confirmStep === 0) {
      setConfirmStep(1);
      return;
    }
    setConfirmStep(2);
    typedSend(IPC.UNINSTALL_SUBFRAME, { projectPath, options: buildOptions(false) });
  };

  if (!projectPath) {
    return (
      <SettingGroup label="Project">
        <div className="text-sm text-text-tertiary py-4 text-center">No project selected</div>
      </SettingGroup>
    );
  }

  if (!isFrameProject) {
    return (
      <SettingGroup label="Project">
        <div className="text-sm text-text-tertiary py-4 text-center">
          This project is not initialized as a SubFrame project
        </div>
      </SettingGroup>
    );
  }

  const selectedCount = Object.values(opts).filter(Boolean).length;

  return (
    <>
      {/* Success result */}
      {result?.success && !result.dryRun && (
        <SettingGroup label="Result">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-success">
              <Check className="w-4 h-4" />
              SubFrame has been removed from this project
            </div>
            {result.removed.length > 0 && (
              <div className="text-xs text-text-tertiary">
                <div className="font-medium text-text-secondary mb-1">Removed:</div>
                {result.removed.map((item, i) => (
                  <div key={i} className="flex items-center gap-1.5 pl-2">
                    <Trash2 className="w-3 h-3 text-error/60 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            )}
            {result.preserved.length > 0 && (
              <div className="text-xs text-text-tertiary">
                <div className="font-medium text-text-secondary mb-1">Preserved:</div>
                {result.preserved.map((item, i) => (
                  <div key={i} className="flex items-center gap-1.5 pl-2">
                    <Shield className="w-3 h-3 text-success/60 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SettingGroup>
      )}

      {/* Main uninstall UI (only when not already uninstalled) */}
      {!(result?.success && !result.dryRun) && (
        <>
          <SettingGroup label="Remove SubFrame">
            <div className="text-xs text-text-tertiary mb-2">
              Select which SubFrame components to remove from this project.
              Your source code is never affected.
            </div>
            <div className="space-y-1">
              {UNINSTALL_ITEMS.map((item) => {
                const isSelected = opts[item.key] ?? true;
                const preservedEntry = previewResult?.preserved.find((p) =>
                  p.toLowerCase().includes(item.label.toLowerCase().replace(/[./]/g, ''))
                  || (item.key === 'removeAgentsMd' && p.toLowerCase().includes('agents'))
                );
                const isModified = !!preservedEntry;
                return (
                  <button
                    key={item.key}
                    onClick={() => toggle(item.key)}
                    className={cn(
                      'flex items-start gap-3 w-full text-left px-2.5 py-2 rounded-md transition-colors cursor-pointer',
                      isSelected ? 'bg-error/5 hover:bg-error/10' : 'hover:bg-bg-hover',
                    )}
                  >
                    <div className={cn(
                      'mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                      isSelected ? 'bg-error/80 border-error/80 text-white' : 'border-border-default bg-bg-deep',
                    )}>
                      {isSelected && <Check className="w-3 h-3" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-text-primary">{item.label}</div>
                      <div className="text-xs text-text-tertiary">{item.description}</div>
                      {isModified && isSelected && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-warning">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          <span>Modified — {preservedEntry}</span>
                          {item.warnIfModified && (
                            <span className="text-text-muted">({item.warnIfModified})</span>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </SettingGroup>

          {/* Preview results */}
          {showPreview && previewResult && (
            <SettingGroup label="Preview">
              <div className="space-y-2 text-xs">
                {previewResult.removed.length > 0 && (
                  <div>
                    <div className="font-medium text-error/80 mb-1">Will be removed:</div>
                    {previewResult.removed.map((item, i) => (
                      <div key={i} className="flex items-center gap-1.5 pl-2 text-text-secondary">
                        <Trash2 className="w-3 h-3 text-error/50 shrink-0" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                )}
                {previewResult.preserved.length > 0 && (
                  <div>
                    <div className="font-medium text-success/80 mb-1">Will be preserved:</div>
                    {previewResult.preserved.map((item, i) => (
                      <div key={i} className="flex items-center gap-1.5 pl-2 text-text-secondary">
                        <Shield className="w-3 h-3 text-success/50 shrink-0" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </SettingGroup>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreview}
              disabled={selectedCount === 0 || confirmStep === 2}
              className="text-xs"
            >
              <Eye className="w-3.5 h-3.5 mr-1" />
              Preview Changes
            </Button>
            <Button
              variant={confirmStep >= 1 ? 'destructive' : 'outline'}
              size="sm"
              onClick={handleUninstall}
              disabled={selectedCount === 0 || confirmStep === 2}
              className={cn('text-xs', confirmStep === 0 && 'text-error hover:bg-error/10 hover:text-error border-error/30')}
            >
              {confirmStep === 2 ? (
                <><RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" />Removing...</>
              ) : confirmStep === 1 ? (
                <><AlertTriangle className="w-3.5 h-3.5 mr-1" />Confirm Remove</>
              ) : (
                <><FolderX className="w-3.5 h-3.5 mr-1" />Remove SubFrame</>
              )}
            </Button>
            {confirmStep === 1 && (
              <button
                onClick={() => setConfirmStep(0)}
                className="text-xs text-text-muted hover:text-text-secondary cursor-pointer"
              >
                Cancel
              </button>
            )}
          </div>
        </>
      )}
    </>
  );
}

interface SettingToggleProps {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  extra?: React.ReactNode;
}
function SettingToggle({ label, description, value, onChange, extra }: SettingToggleProps) {
  return (
    <div className="flex items-center justify-between" data-setting-label={label}>
      <div className="flex-1 min-w-0 mr-3">
        <div className="text-sm text-text-primary">{label}</div>
        {description && <div className="text-xs text-text-tertiary">{description}</div>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {extra}
        <button
          onClick={() => onChange(!value)}
          className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${value ? 'bg-accent' : 'bg-bg-tertiary'}`}
        >
          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${value ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
        </button>
      </div>
    </div>
  );
}

interface SettingSelectProps {
  label: string;
  description?: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}
function SettingSelect({ label, description, value, onChange, options }: SettingSelectProps) {
  return (
    <div data-setting-label={label}>
      <div className="text-sm text-text-primary mb-1">{label}</div>
      {description && <div className="text-xs text-text-tertiary mb-1">{description}</div>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-bg-deep border border-border-subtle rounded px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

interface SettingInputProps {
  label: string;
  description?: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: 'text' | 'number';
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  readOnly?: boolean;
  extra?: React.ReactNode;
}
function SettingInput({ label, description, value, onChange, type = 'text', placeholder, min, max, step, readOnly, extra }: SettingInputProps) {
  return (
    <div data-setting-label={label}>
      <div className="text-sm text-text-primary mb-1">{label}</div>
      {description && <div className="text-xs text-text-tertiary mb-1">{description}</div>}
      <div className="flex gap-2">
        <Input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          min={min}
          max={max}
          step={step}
          readOnly={readOnly}
          className="bg-bg-deep border-border-subtle text-sm flex-1"
        />
        {extra}
      </div>
    </div>
  );
}

interface SettingSliderProps {
  label: string;
  description?: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  formatValue?: (v: number) => string;
}
function SettingSlider({ label, description, value, onChange, min, max, step, formatValue }: SettingSliderProps) {
  return (
    <div data-setting-label={label}>
      <div className="text-sm text-text-primary mb-1">{label}</div>
      {description && <div className="text-xs text-text-tertiary mb-1">{description}</div>}
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 accent-accent cursor-pointer"
        />
        <span className="text-xs text-text-secondary w-14 text-right tabular-nums">
          {formatValue ? formatValue(value) : value}
        </span>
      </div>
    </div>
  );
}

function WorkspacePillAppearanceRow({
  workspace,
  index,
  display,
  highlighted = false,
  onSaved,
}: {
  workspace: WorkspaceListResult['workspaces'][number];
  index: number;
  display: WorkspacePillDisplaySettings;
  highlighted?: boolean;
  onSaved: () => void | Promise<unknown>;
}) {
  const [shortLabel, setShortLabel] = useState(workspace.shortLabel ?? '');
  const [icon, setIcon] = useState(workspace.icon ?? '');
  const [accentColor, setAccentColor] = useState(workspace.accentColor ?? '');
  const [defaultProjectPath, setDefaultProjectPath] = useState(workspace.defaultProjectPath ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setShortLabel(workspace.shortLabel ?? '');
    setIcon(workspace.icon ?? '');
    setAccentColor(workspace.accentColor ?? '');
    setDefaultProjectPath(workspace.defaultProjectPath ?? '');
  }, [workspace.accentColor, workspace.defaultProjectPath, workspace.icon, workspace.key, workspace.shortLabel]);

  const normalizedShortLabel = normalizeWorkspaceShortLabel(shortLabel) ?? '';
  const normalizedIcon = normalizeWorkspaceIcon(icon) ?? '';
  const normalizedAccentColor = normalizeWorkspaceAccentColor(accentColor) ?? '';
  const normalizedDefaultProjectPath = defaultProjectPath.trim();
  const savedShortLabel = normalizeWorkspaceShortLabel(workspace.shortLabel) ?? '';
  const savedIcon = normalizeWorkspaceIcon(workspace.icon) ?? '';
  const savedAccentColor = normalizeWorkspaceAccentColor(workspace.accentColor) ?? '';
  const savedDefaultProjectPath = workspace.defaultProjectPath ?? '';
  const availableProjects = workspace.projects ?? [];
  const isDirty =
    normalizedShortLabel !== savedShortLabel
    || normalizedIcon !== savedIcon
    || normalizedAccentColor !== savedAccentColor
    || normalizedDefaultProjectPath !== savedDefaultProjectPath;

  const preview = getWorkspacePillPresentation({
    display,
    index,
    name: workspace.name,
    shortLabel: normalizedShortLabel,
    icon: normalizedIcon,
  });
  const PreviewIcon = preview.icon ? WORKSPACE_ICON_COMPONENTS[preview.icon] : null;
  const previewAccent = normalizedAccentColor || null;
  const previewStyle = previewAccent ? {
    backgroundColor: withWorkspaceAccentAlpha(previewAccent, '22') ?? undefined,
    borderColor: withWorkspaceAccentAlpha(previewAccent, '66') ?? previewAccent,
    color: previewAccent,
  } : undefined;

  const handleSave = useCallback(async () => {
    if (!isDirty || saving) return;
    setSaving(true);
    try {
      await typedInvoke(IPC.WORKSPACE_RENAME, {
        key: workspace.key,
        shortLabel: normalizedShortLabel || null,
        icon: normalizedIcon || null,
        accentColor: normalizedAccentColor || null,
        defaultProjectPath: normalizedDefaultProjectPath || null,
      });
      await onSaved();
      typedSend(IPC.LOAD_WORKSPACE);
      toast.success(`Updated "${workspace.name}"`);
    } catch {
      toast.error('Failed to update workspace pill');
    } finally {
      setSaving(false);
    }
  }, [
    isDirty,
    normalizedAccentColor,
    normalizedDefaultProjectPath,
    normalizedIcon,
    normalizedShortLabel,
    onSaved,
    saving,
    workspace.key,
    workspace.name,
  ]);

  const handleReset = useCallback(() => {
    setShortLabel(workspace.shortLabel ?? '');
    setIcon(workspace.icon ?? '');
    setAccentColor(workspace.accentColor ?? '');
    setDefaultProjectPath(workspace.defaultProjectPath ?? '');
  }, [workspace.accentColor, workspace.defaultProjectPath, workspace.icon, workspace.shortLabel]);

  return (
    <div
      data-workspace-key={workspace.key}
      className={cn(
        'rounded-lg border bg-bg-secondary/40 p-3 space-y-3 transition-colors',
        highlighted ? 'border-accent bg-accent/5 ring-1 ring-accent/30' : 'border-border-subtle',
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex items-center justify-center min-w-[34px] h-7 px-2 rounded-md border border-border-subtle bg-bg-deep text-[10px] font-semibold tracking-wide text-text-primary"
          style={previewStyle}
        >
          {preview.indexText && <span className="font-mono">{preview.indexText}</span>}
          {PreviewIcon && <PreviewIcon className="w-3.5 h-3.5 shrink-0" />}
          {preview.text && (
            <span className={cn((PreviewIcon || preview.indexText) ? 'ml-1' : '')}>
              {preview.text}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <div className="text-sm text-text-primary truncate">{workspace.name}</div>
            {workspace.inactive && (
              <span className="rounded border border-border-subtle px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-text-muted">
                Inactive
              </span>
            )}
          </div>
          <div className="text-[10px] text-text-muted">
            #{index} · {workspace.projectCount} project{workspace.projectCount === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_160px]">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-text-tertiary font-medium mb-1">Short Label</div>
          <Input
            value={shortLabel}
            onChange={(e) => setShortLabel((e.target.value || '').replace(/\s+/g, '').toUpperCase().slice(0, 4))}
            placeholder="Optional"
            maxLength={4}
            className="bg-bg-deep border-border-subtle text-sm"
          />
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-wider text-text-tertiary font-medium mb-1">Icon</div>
          <select
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            className="w-full h-9 bg-bg-deep border border-border-subtle rounded px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 cursor-pointer"
          >
            <option value="">None</option>
            {WORKSPACE_ICON_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-text-tertiary font-medium mb-1">Accent Color</div>
          <div className="flex flex-wrap gap-2">
            {WORKSPACE_ACCENT_OPTIONS.map((option) => {
              const isSelected = (option.value ?? '') === normalizedAccentColor;
              return (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => setAccentColor(option.value ?? '')}
                  className={cn(
                    'flex items-center gap-2 rounded-md border px-2 py-1 text-[11px] transition-colors cursor-pointer',
                    isSelected
                      ? 'border-accent bg-accent/10 text-text-primary'
                      : 'border-border-subtle bg-bg-deep text-text-secondary hover:bg-bg-hover',
                  )}
                  title={option.label}
                >
                  <span
                    className="h-3 w-3 rounded-full border border-black/20"
                    style={{ backgroundColor: option.value ?? 'var(--color-accent)' }}
                  />
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-wider text-text-tertiary font-medium mb-1">Default Project</div>
          <select
            value={normalizedDefaultProjectPath}
            onChange={(e) => setDefaultProjectPath(e.target.value)}
            disabled={availableProjects.length === 0}
            className="w-full h-9 bg-bg-deep border border-border-subtle rounded px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 disabled:opacity-60"
          >
            <option value="">No default project</option>
            {availableProjects.map((project) => (
              <option key={project.path} value={project.path}>
                {project.name}
              </option>
            ))}
          </select>
          <div className="mt-1 text-[10px] text-text-muted">
            {availableProjects.length > 0
              ? 'When this workspace becomes active, SubFrame will prefer this project instead of falling back to the first entry.'
              : 'Add projects to this workspace first to choose a default landing project.'}
          </div>
        </div>
      </div>

      <div className="flex gap-2 md:justify-end">
        <Button
          size="sm"
          variant="ghost"
          onClick={handleReset}
          disabled={saving || !isDirty}
          className="cursor-pointer"
        >
          Reset
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving || !isDirty}
          className="bg-accent text-bg-deep hover:bg-accent/80 cursor-pointer"
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>

      <div className="text-[10px] text-text-muted">
        Short labels are optional and capped at 4 characters. Icon-only mode falls back to the label when no icon is set.
      </div>
    </div>
  );
}

/* ---------- Main component ---------- */

export function SettingsPanel() {
  const settingsOpenStore = useUIStore((s) => s.settingsOpen);
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen);
  // Don't render the Dialog tree at all when closed — prevents Radix Presence
  // ref errors (React #185) in web mode where the portal mount races with hydration.
  const settingsOpen = settingsOpenStore;
  const { settings, updateSetting } = useSettings();
  const { config: aiToolConfig, setAITool, addCustomTool, removeCustomTool, refetch: refetchAITools } = useAIToolConfig();
  const [recheckingTools, setRecheckingTools] = useState(false);
  const [cliInstalling, setCliInstalling] = useState(false);
  const [cliUninstalling, setCliUninstalling] = useState(false);
  const [scanning, setScanning] = useState(false);

  // Local form state
  const [activeTab, setActiveTab] = useState('appearance');
  const [focusedWorkspaceKey, setFocusedWorkspaceKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [fontSize, setFontSize] = useState(14);
  const [scrollback, setScrollback] = useState(10000);
  const [maxTerminals, setMaxTerminals] = useState(9);

  // Terminal settings
  const [nerdFontDetected] = useState(() => detectNerdFont());
  const [fontFamily, setFontFamily] = useState(DEFAULT_FONT);
  const [lineHeight, setLineHeight] = useState(1.2);
  const [cursorBlink, setCursorBlink] = useState(true);
  const [cursorStyle, setCursorStyle] = useState('bar');
  const [defaultShell, setDefaultShell] = useState('');
  const [availableShells, setAvailableShells] = useState<ShellInfo[]>([]);
  const [bellSound, setBellSound] = useState(false);
  const [copyOnSelect, setCopyOnSelect] = useState(false);
  const [restoreOnStartup, setRestoreOnStartup] = useState(true);
  const [restoreScrollback, setRestoreScrollback] = useState(false);
  const [autoResumeAgent, setAutoResumeAgent] = useState<'auto' | 'prompt' | 'never'>('prompt');

  // Editor settings
  const [editorFontSize, setEditorFontSize] = useState(12);
  const [editorFontFamily, setEditorFontFamily] = useState(DEFAULT_FONT);
  const [editorWordWrap, setEditorWordWrap] = useState(false);
  const [editorMinimap, setEditorMinimap] = useState(false);
  const [editorLineNumbers, setEditorLineNumbers] = useState(true);
  const [editorBracketMatching, setEditorBracketMatching] = useState(true);
  const [editorTabSize, setEditorTabSize] = useState(2);
  const [editorTheme, setEditorTheme] = useState<string>('subframe-dark');

  // Updater settings
  const [autoCheck, setAutoCheck] = useState(true);
  const [allowPrerelease, setAllowPrerelease] = useState('auto');
  const [checkIntervalHours, setCheckIntervalHours] = useState(4);
  const updater = useUpdater();

  // Appearance / theme state
  const [activeThemeId, setActiveThemeId] = useState('classic-amber');
  const [customTokenOverrides, setCustomTokenOverrides] = useState<Partial<ThemeTokens>>({});
  const [customThemeName, setCustomThemeName] = useState('');
  const [showSaveThemeInput, setShowSaveThemeInput] = useState(false);

  // Custom tool form state
  const [newToolName, setNewToolName] = useState('');
  const [newToolCommand, setNewToolCommand] = useState('');
  const [newToolDescription, setNewToolDescription] = useState('');

  // Per-tool flag state: { toolId: { flagKey: boolean } }
  const [toolFlags, setToolFlags] = useState<Record<string, Record<string, boolean>>>({});
  // Per-tool custom args: { toolId: string }
  const [toolCustomArgs, setToolCustomArgs] = useState<Record<string, string>>({});
  const [dirtyToolDrafts, setDirtyToolDrafts] = useState<Record<string, boolean>>({});
  const [pendingDangerousFlag, setPendingDangerousFlag] = useState<{
    toolId: string;
    toolName: string;
    flag: ToolFlag;
  } | null>(null);

  // Hooks state
  const currentProjectPath = useProjectStore((s) => s.currentProjectPath);
  const activeTerminalId = useTerminalStore((s) => s.activeTerminalId);
  const [hooksConfig, setHooksConfig] = useState<HooksConfig>({});
  const [hooksLoading, setHooksLoading] = useState(false);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set(['PreToolUse', 'PostToolUse']));
  const [showAddHookDialog, setShowAddHookDialog] = useState(false);
  const [editingHook, setEditingHook] = useState<{ eventType: string; entryIndex: number } | null>(null);
  const [hookFormEvent, setHookFormEvent] = useState('PreToolUse');
  const [hookFormMatcher, setHookFormMatcher] = useState('');
  const [hookFormCommand, setHookFormCommand] = useState('');
  const [showAIGenerate, setShowAIGenerate] = useState(false);
  const [aiGeneratePrompt, setAiGeneratePrompt] = useState('');
  const [disabledHooks, setDisabledHooks] = useState<Set<string>>(new Set());

  // Web Server setup dialog
  const [webServerSetupOpen, setWebServerSetupOpen] = useState(false);
  const [webServerPairingCode, setWebServerPairingCode] = useState<string | null>(null);
  const [webServerQrVisible, setWebServerQrVisible] = useState(false);
  const [webServerQrDataUrl, setWebServerQrDataUrl] = useState<string | null>(null);
  const [webServerPortInput, setWebServerPortInput] = useState('');

  // Shell integration status
  const [cliStatus, setCliStatus] = useState<{ installed: boolean; inPath: boolean; path: string | null } | null>(null);
  const [contextMenuInstalled, setContextMenuInstalled] = useState(false);

  // Web Server info query — only active when integrations tab is shown
  const isAppearanceTab = activeTab === 'appearance';
  const isIntegrationsTab = activeTab === 'integrations';
  const { data: workspaceListRaw, refetch: refetchWorkspaceList } = useIpcQuery(
    IPC.WORKSPACE_LIST,
    [],
    { enabled: settingsOpen && isAppearanceTab, staleTime: 10000 }
  );
  const { data: webServerInfo, refetch: refetchWebServerInfo } = useIpcQuery(
    IPC.WEB_SERVER_INFO,
    [],
    { enabled: settingsOpen && isIntegrationsTab, refetchInterval: isIntegrationsTab ? 5000 : false }
  );
  const webServerAccessHost = webServerInfo?.enabled && webServerInfo.port
    ? (webServerInfo.lanMode && webServerInfo.lanIp ? webServerInfo.lanIp : 'localhost')
    : '';
  const webServerAccessPort = webServerInfo?.enabled && webServerInfo.port
    ? (webServerInfo.lanMode ? webServerInfo.port : 8080)
    : 0;
  const webServerBaseUrl = webServerInfo?.enabled && webServerInfo.port
    ? `http://${webServerAccessHost}:${webServerAccessPort}`
    : '';
  const webServerConnectionUrl = webServerInfo?.enabled && webServerInfo.port && webServerInfo.token
    ? `${webServerBaseUrl}/?token=${webServerInfo.token}`
    : '';
  const configuredWebServerPort = typeof webServerInfo?.configuredPort === 'number'
    ? webServerInfo.configuredPort
    : Number(((settings?.server as Record<string, unknown>)?.port as number | undefined) ?? 0);
  const webServerRunning = webServerInfo?.enabled === true && webServerInfo.port > 0;
  const effectiveWebServerPort = webServerRunning
    ? webServerInfo?.port ?? null
    : configuredWebServerPort > 0
      ? configuredWebServerPort
      : null;

  // Listen for web client connect/disconnect to refresh server info
  useIPCEvent(
    IPC.WEB_CLIENT_CONNECTED,
    useCallback(() => { refetchWebServerInfo(); }, [refetchWebServerInfo])
  );
  useIPCEvent(
    IPC.WEB_CLIENT_DISCONNECTED,
    useCallback(() => { refetchWebServerInfo(); }, [refetchWebServerInfo])
  );

  // Generate QR code for SubFrame Server when toggled visible
  useEffect(() => {
    if (
      webServerQrVisible &&
      webServerInfo?.enabled &&
      webServerInfo.port &&
      webServerInfo.token &&
      webServerInfo.lanMode &&
      webServerInfo.lanIp
    ) {
      const url = `http://${webServerInfo.lanIp}:${webServerInfo.port}/?token=${webServerInfo.token}`;
      QRCode.toDataURL(url, {
        width: 150,
        margin: 2,
        color: { dark: '#e8e6e3', light: '#0f0f10' },
      }).then(setWebServerQrDataUrl).catch(() => setWebServerQrDataUrl(null));
    } else {
      setWebServerQrDataUrl(null);
    }
  }, [webServerQrVisible, webServerInfo?.enabled, webServerInfo?.port, webServerInfo?.token, webServerInfo?.lanMode, webServerInfo?.lanIp]);

  useEffect(() => {
    setWebServerPortInput(configuredWebServerPort > 0 ? String(configuredWebServerPort) : '');
  }, [configuredWebServerPort]);

  // Check CLI and context menu status when integrations tab is active
  useEffect(() => {
    if (!isIntegrationsTab) return;
    typedInvoke(IPC.CHECK_CLI_STATUS).then(setCliStatus).catch(() => {});
    if (process.platform === 'win32') {
      typedInvoke(IPC.CHECK_CONTEXT_MENU).then((r) => setContextMenuInstalled(r.installed)).catch(() => {});
    }
  }, [isIntegrationsTab]);

  const checkContextMenu = useCallback(() => {
    typedInvoke(IPC.CHECK_CONTEXT_MENU).then((r) => setContextMenuInstalled(r.installed)).catch(() => {});
  }, []);

  const refreshCliStatus = useCallback(() => {
    typedInvoke(IPC.CHECK_CLI_STATUS).then(setCliStatus).catch(() => {});
  }, []);

  const applyWebServerPort = useCallback(() => {
    const trimmed = webServerPortInput.trim();
    const nextPort = trimmed === '' ? 0 : Number.parseInt(trimmed, 10);

    if (!Number.isFinite(nextPort) || Number.isNaN(nextPort) || nextPort < 0 || nextPort > 65535) {
      toast.error('Preferred port must be between 0 and 65535');
      return;
    }

    typedInvoke(IPC.UPDATE_SETTING, { key: 'server.port', value: nextPort })
      .then(() => {
        setWebServerPortInput(nextPort > 0 ? String(nextPort) : '');
        refetchWebServerInfo();
        toast.success(nextPort > 0 ? `Preferred port set to ${nextPort}` : 'Preferred port reset to auto');
      })
      .catch(() => toast.error('Failed to update preferred port'));
  }, [refetchWebServerInfo, webServerPortInput]);

  const copyTextToClipboard = useCallback(async (value: string): Promise<boolean> => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return true;
      }
    } catch {
      // fall through
    }

    try {
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand('copy');
      document.body.removeChild(textarea);
      return copied;
    } catch {
      return false;
    }
  }, []);

  const handleInstallCli = useCallback(async () => {
    setCliInstalling(true);
    try {
      const result = await typedInvoke(IPC.INSTALL_CLI);
      if (result.success) {
        toast.success(result.message);
        refreshCliStatus();
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error('Failed to install CLI');
    } finally {
      setCliInstalling(false);
    }
  }, [refreshCliStatus]);

  const handleUninstallCli = useCallback(async () => {
    setCliUninstalling(true);
    try {
      const result = await typedInvoke(IPC.UNINSTALL_CLI);
      if (result.success) {
        toast.success(result.message);
        refreshCliStatus();
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error('Failed to uninstall CLI');
    } finally {
      setCliUninstalling(false);
    }
  }, [refreshCliStatus]);

  // Sync form state from loaded data
  useEffect(() => {
    if (!settings) return;
    const terminal = (settings.terminal as Record<string, unknown>) || {};
    setFontSize((terminal.fontSize as number) || 14);
    setScrollback((terminal.scrollback as number) || 10000);
    setMaxTerminals((terminal.maxTerminals as number) || 9);
    setFontFamily((terminal.fontFamily as string) || DEFAULT_FONT);
    setLineHeight((terminal.lineHeight as number) || 1.2);
    setCursorBlink(terminal.cursorBlink !== false);
    setCursorStyle((terminal.cursorStyle as string) || 'bar');
    setDefaultShell((terminal.defaultShell as string) || '');
    setBellSound((terminal.bellSound as boolean) || false);
    setCopyOnSelect((terminal.copyOnSelect as boolean) || false);
    setRestoreOnStartup(terminal.restoreOnStartup !== false);
    setRestoreScrollback(terminal.restoreScrollback === true);
    setAutoResumeAgent((terminal.autoResumeAgent as 'auto' | 'prompt' | 'never') || 'prompt');

    const editor = (settings.editor as Record<string, unknown>) || {};
    setEditorFontSize((editor.fontSize as number) || 12);
    setEditorFontFamily((editor.fontFamily as string) || DEFAULT_FONT);
    setEditorWordWrap((editor.wordWrap as boolean) || false);
    setEditorMinimap((editor.minimap as boolean) || false);
    setEditorLineNumbers(editor.lineNumbers !== false);
    setEditorBracketMatching(editor.bracketMatching !== false);
    setEditorTabSize((editor.tabSize as number) || 2);
    setEditorTheme((editor.theme as string) || 'subframe-dark');

    const updater = (settings.updater as Record<string, unknown>) || {};
    setAutoCheck(updater.autoCheck !== false);
    setAllowPrerelease((updater.allowPrerelease as string) || 'auto');
    setCheckIntervalHours((updater.checkIntervalHours as number) || 4);

    const appearance = (settings.appearance as Record<string, unknown>) || {};
    setActiveThemeId((appearance.activeThemeId as string) || 'classic-amber');
    setCustomTokenOverrides({});

    if (aiToolConfig) {
      const aiTools = (settings.aiTools as Record<string, Record<string, unknown>>) || {};
      // Parse per-tool flags and custom args from saved custom commands
      const newFlags: Record<string, Record<string, boolean>> = {};
      const newCustomArgs: Record<string, string> = {};
      for (const tool of Object.values(aiToolConfig.availableTools)) {
        const toolSettings = aiTools[tool.id] || {};
        const customCmd = (toolSettings.customCommand as string) || '';
        const knownFlags = TOOL_FLAGS[tool.id] || [];
        const parsedFlags: Record<string, boolean> = {};
        let remaining = customCmd;
        // Strip the base command if it starts with it
        if (remaining.startsWith(tool.command)) {
          remaining = remaining.slice(tool.command.length).trim();
        }
        for (const f of knownFlags) {
          if (remaining.includes(f.flag)) {
            parsedFlags[f.key] = true;
            remaining = remaining.replace(f.flag, '').trim();
          } else {
            parsedFlags[f.key] = false;
          }
        }
        newFlags[tool.id] = parsedFlags;
        newCustomArgs[tool.id] = remaining.replace(/\s+/g, ' ').trim();
      }
      setToolFlags((prev) => {
        const merged = { ...prev };
        for (const [toolId, parsedFlags] of Object.entries(newFlags)) {
          if (!dirtyToolDrafts[toolId]) merged[toolId] = parsedFlags;
        }
        return merged;
      });
      setToolCustomArgs((prev) => {
        const merged = { ...prev };
        for (const [toolId, customArgs] of Object.entries(newCustomArgs)) {
          if (!dirtyToolDrafts[toolId]) merged[toolId] = customArgs;
        }
        return merged;
      });
    }
  }, [settings, aiToolConfig, dirtyToolDrafts]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ key?: string }>).detail;
      setSettingsOpen(true);
      setActiveTab('appearance');
      setSearchQuery('');
      setFocusedWorkspaceKey(detail?.key ?? null);
    };

    window.addEventListener('open-workspace-settings', handler);

    // Generic section opener (e.g. from StatusBar web badge)
    const sectionHandler = (event: Event) => {
      const detail = (event as CustomEvent<{ key?: string }>).detail;
      if (detail?.key) {
        setSettingsOpen(true);
        setActiveTab(detail.key);
        setSearchQuery('');
      }
    };
    window.addEventListener('open-settings-section', sectionHandler);

    return () => {
      window.removeEventListener('open-workspace-settings', handler);
      window.removeEventListener('open-settings-section', sectionHandler);
    };
  }, [setSettingsOpen]);

  const appearanceWorkspaceList = (workspaceListRaw as WorkspaceListResult | undefined)?.workspaces ?? [];

  useEffect(() => {
    if (!settingsOpen || activeTab !== 'appearance' || !focusedWorkspaceKey) return;
    const frame = window.requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(`[data-workspace-key="${focusedWorkspaceKey}"]`);
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeTab, focusedWorkspaceKey, settingsOpen, workspaceListRaw]);

  // Fetch available shells for the terminal shell dropdown
  useEffect(() => {
    const handler = (_event: unknown, data: { shells: ShellInfo[]; success: boolean }) => {
      if (data.success) setAvailableShells(data.shells);
    };
    const unsub = getTransport().on(IPC.AVAILABLE_SHELLS_DATA, handler);
    getTransport().send(IPC.GET_AVAILABLE_SHELLS);
    return unsub;
  }, []);

  const general = (settings.general as Record<string, unknown>) || {};
  const appearanceSettings = (settings.appearance as Record<string, unknown>) || {};
  const terminalSettings = (settings.terminal as Record<string, unknown>) || {};
  const workspacePillDisplay = normalizeWorkspacePillDisplay(appearanceSettings.workspacePillDisplay ?? appearanceSettings.workspacePillStyle);
  const autoCreateTerminal = (general.autoCreateTerminal as boolean) || false;
  const reuseIdleTerminal = general.reuseIdleTerminal !== false; // default true
  const showDotfiles = (general.showDotfiles as boolean) || false;
  const confirmBeforeClose = (general.confirmBeforeClose !== false);
  const defaultProjectDir = (general.defaultProjectDir as string) || '';
  const usagePollingInterval = (general.usagePollingInterval as number) || 0;
  const gridOverflowAutoSwitch = general.gridOverflowAutoSwitch !== false;
  const highlightUserMessages = general.highlightUserMessages !== false; // default true
  const userMessageColor = (general.userMessageColor as string) || '#ff6eb4';
  const showFreezeHoverAction = terminalSettings.showFreezeHoverAction !== false;
  const showFreezeOverlay = terminalSettings.showFreezeOverlay !== false;

  function saveToggle(key: string, value: boolean) {
    updateSetting.mutate([{ key, value }]);
  }

  function markToolDraftDirty(toolId: string) {
    setDirtyToolDrafts((prev) => (prev[toolId] ? prev : { ...prev, [toolId]: true }));
  }

  function clearToolDraftDirty(toolId: string) {
    setDirtyToolDrafts((prev) => {
      if (!prev[toolId]) return prev;
      const next = { ...prev };
      delete next[toolId];
      return next;
    });
  }

  function setToolFlagSelection(toolId: string, flag: ToolFlag, nextValue: boolean) {
    markToolDraftDirty(toolId);
    setToolFlags((prev) => {
      const nextToolFlags = { ...(prev[toolId] || {}) };
      if (flag.group && nextValue) {
        for (const sibling of TOOL_FLAGS[toolId] || []) {
          if (sibling.group === flag.group) nextToolFlags[sibling.key] = false;
        }
      }
      nextToolFlags[flag.key] = nextValue;
      return {
        ...prev,
        [toolId]: nextToolFlags,
      };
    });
  }

  /** Compose the full command for a tool from its base command, toggled flags, and custom args. */
  function composeToolCommand(toolId: string, baseCommand: string): string {
    const flags = toolFlags[toolId] || {};
    const knownFlags = TOOL_FLAGS[toolId] || [];
    const customArgs = (toolCustomArgs[toolId] || '').trim();
    const parts = [baseCommand];
    for (const f of knownFlags) {
      if (flags[f.key]) parts.push(f.flag);
    }
    if (customArgs) parts.push(customArgs);
    return parts.join(' ');
  }

  /** Save composed command for a specific tool. */
  function saveToolCommand(toolId: string, baseCommand: string) {
    const composed = composeToolCommand(toolId, baseCommand);
    // Only store a custom command if it differs from the bare base command
    const value = composed === baseCommand ? '' : composed;
    updateSetting.mutate(
      [{ key: `aiTools.${toolId}.customCommand`, value }],
      {
        onSuccess: () => {
          clearToolDraftDirty(toolId);
          toast.success('Start command saved');
        },
        onError: () => toast.error('Failed to save start command'),
      }
    );
  }

  function saveTerminal() {
    updateSetting.mutate([{ key: 'terminal.fontSize', value: fontSize }]);
    updateSetting.mutate([{ key: 'terminal.scrollback', value: scrollback }]);
    updateSetting.mutate([{ key: 'terminal.fontFamily', value: fontFamily }]);
    updateSetting.mutate([{ key: 'terminal.lineHeight', value: lineHeight }]);
    updateSetting.mutate([{ key: 'terminal.cursorBlink', value: cursorBlink }]);
    updateSetting.mutate([{ key: 'terminal.cursorStyle', value: cursorStyle }]);
    updateSetting.mutate([{ key: 'terminal.defaultShell', value: defaultShell }]);
    updateSetting.mutate([{ key: 'terminal.bellSound', value: bellSound }]);
    updateSetting.mutate([{ key: 'terminal.copyOnSelect', value: copyOnSelect }]);
    updateSetting.mutate([{ key: 'terminal.maxTerminals', value: maxTerminals }]);
    updateSetting.mutate([{ key: 'terminal.restoreOnStartup', value: restoreOnStartup }]);
    updateSetting.mutate([{ key: 'terminal.restoreScrollback', value: restoreScrollback }]);
    updateSetting.mutate([{ key: 'terminal.autoResumeAgent', value: autoResumeAgent }]);
    toast.success('Terminal settings saved');
  }

  function saveEditor() {
    updateSetting.mutate([{ key: 'editor.fontSize', value: editorFontSize }]);
    updateSetting.mutate([{ key: 'editor.fontFamily', value: editorFontFamily }]);
    updateSetting.mutate([{ key: 'editor.wordWrap', value: editorWordWrap }]);
    updateSetting.mutate([{ key: 'editor.minimap', value: editorMinimap }]);
    updateSetting.mutate([{ key: 'editor.lineNumbers', value: editorLineNumbers }]);
    updateSetting.mutate([{ key: 'editor.bracketMatching', value: editorBracketMatching }]);
    updateSetting.mutate([{ key: 'editor.tabSize', value: editorTabSize }]);
    updateSetting.mutate([{ key: 'editor.theme', value: editorTheme }]);
    toast.success('Editor settings saved');
  }

  function saveUpdater() {
    updateSetting.mutate([{ key: 'updater.autoCheck', value: autoCheck }]);
    updateSetting.mutate([{ key: 'updater.allowPrerelease', value: allowPrerelease }]);
    updateSetting.mutate([{ key: 'updater.checkIntervalHours', value: checkIntervalHours }]);
    toast.success('Update settings saved');
  }

  /* ---------- Hooks helpers ---------- */

  const claudeSettingsPath = currentProjectPath
    ? `${currentProjectPath.replace(/\\/g, '/')}/.claude/settings.json`
    : null;

  /** Load hooks from .claude/settings.json via IPC send/response */
  const loadHooks = useCallback(() => {
    if (!claudeSettingsPath) return;
    setHooksLoading(true);

    let unsub: (() => void) | null = null;
    unsub = getTransport().on(IPC.FILE_CONTENT, (_event: unknown, result: { filePath: string; content?: string; error?: string }) => {
      if (result.filePath !== claudeSettingsPath) return;
      unsub?.();
      setHooksLoading(false);

      if (result.error || !result.content) {
        setHooksConfig({});
        return;
      }
      try {
        const parsed = JSON.parse(result.content);
        setHooksConfig((parsed.hooks as HooksConfig) || {});
      } catch {
        setHooksConfig({});
      }
    });

    typedSend(IPC.READ_FILE, claudeSettingsPath);
  }, [claudeSettingsPath]);

  /** Save hooks back to .claude/settings.json */
  const saveHooks = useCallback((newHooks: HooksConfig) => {
    if (!claudeSettingsPath) return;

    // First read the full file to preserve other keys, then merge hooks
    let unsubRead: (() => void) | null = null;
    const readTimer = setTimeout(() => { unsubRead?.(); }, 10_000);
    unsubRead = getTransport().on(IPC.FILE_CONTENT, (_event: unknown, result: { filePath: string; content?: string; error?: string }) => {
      if (result.filePath !== claudeSettingsPath) return;
      unsubRead?.();
      clearTimeout(readTimer);

      let existing: Record<string, unknown> = {};
      if (!result.error && result.content) {
        try { existing = JSON.parse(result.content); } catch { /* start fresh */ }
      }
      existing.hooks = newHooks;

      let unsubSave: (() => void) | null = null;
      const saveTimer = setTimeout(() => { unsubSave?.(); }, 10_000);
      unsubSave = getTransport().on(IPC.FILE_SAVED, (_e: unknown, saveResult: { filePath: string; success?: boolean; error?: string }) => {
        if (saveResult.filePath !== claudeSettingsPath) return;
        unsubSave?.();
        clearTimeout(saveTimer);
        if (saveResult.success) {
          setHooksConfig(newHooks);
          toast.success('Hooks saved');
        } else {
          toast.error('Failed to save hooks');
        }
      });
      typedSend(IPC.WRITE_FILE, { filePath: claudeSettingsPath, content: JSON.stringify(existing, null, 2) + '\n' });
    });

    typedSend(IPC.READ_FILE, claudeSettingsPath);
  }, [claudeSettingsPath]);

  /** Load hooks when switching to the hooks tab */
  useEffect(() => {
    if (activeTab === 'hooks' && claudeSettingsPath) {
      loadHooks();
    }
  }, [activeTab, claudeSettingsPath, loadHooks]);

  function toggleEventExpanded(eventKey: string) {
    setExpandedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(eventKey)) next.delete(eventKey);
      else next.add(eventKey);
      return next;
    });
  }

  function addHookEntry(eventType: string, matcher: string, command: string) {
    const newHooks = { ...hooksConfig };
    if (!newHooks[eventType]) newHooks[eventType] = [];
    newHooks[eventType] = [
      ...newHooks[eventType],
      { matcher, hooks: [{ type: 'command', command }] },
    ];
    saveHooks(newHooks);
  }

  function updateHookEntry(eventType: string, entryIndex: number, matcher: string, command: string) {
    const newHooks = { ...hooksConfig };
    if (!newHooks[eventType] || !newHooks[eventType][entryIndex]) return;
    newHooks[eventType] = [...newHooks[eventType]];
    newHooks[eventType][entryIndex] = {
      matcher,
      hooks: [{ type: 'command', command }],
    };
    saveHooks(newHooks);
  }

  function deleteHookEntry(eventType: string, entryIndex: number) {
    const newHooks = { ...hooksConfig };
    if (!newHooks[eventType]) return;
    newHooks[eventType] = newHooks[eventType].filter((_, i) => i !== entryIndex);
    if (newHooks[eventType].length === 0) delete newHooks[eventType];
    saveHooks(newHooks);
  }

  function toggleHookDisabled(eventType: string, entryIndex: number) {
    const key = `${eventType}:${entryIndex}`;
    setDisabledHooks((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function resetHookForm() {
    setHookFormEvent('PreToolUse');
    setHookFormMatcher('');
    setHookFormCommand('');
    setShowAIGenerate(false);
    setAiGeneratePrompt('');
    setEditingHook(null);
  }

  function openAddHookDialog() {
    resetHookForm();
    setShowAddHookDialog(true);
  }

  function openEditHookDialog(eventType: string, entryIndex: number) {
    const entry = hooksConfig[eventType]?.[entryIndex];
    if (!entry) return;
    setHookFormEvent(eventType);
    setHookFormMatcher(entry.matcher);
    setHookFormCommand(entry.hooks[0]?.command || '');
    setEditingHook({ eventType, entryIndex });
    setShowAddHookDialog(true);
  }

  function handleHookFormSubmit() {
    if (!hookFormCommand.trim()) {
      toast.warning('Command is required');
      return;
    }
    if (editingHook) {
      updateHookEntry(editingHook.eventType, editingHook.entryIndex, hookFormMatcher.trim(), hookFormCommand.trim());
    } else {
      addHookEntry(hookFormEvent, hookFormMatcher.trim(), hookFormCommand.trim());
    }
    setShowAddHookDialog(false);
    resetHookForm();
  }

  function handleAIGenerate() {
    if (!activeTerminalId) {
      toast.warning('No active terminal — open a terminal first');
      return;
    }
    if (!aiGeneratePrompt.trim()) {
      toast.warning('Describe what you want the hook to do');
      return;
    }
    const safeMatcher = hookFormMatcher || '*';
    const hookDir = '.claude/hooks';
    const fileName = `${hookFormEvent.toLowerCase()}-${safeMatcher.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}.js`;
    const prompt = [
      `Generate a Claude Code hook script for the ${hookFormEvent} event with matcher "${safeMatcher}".`,
      `The hook should: ${aiGeneratePrompt.trim().replace(/[\r\n]+/g, ' ')}`,
      '',
      `Write it to ${hookDir}/${fileName} and output ONLY the absolute file path when done.`,
      `Make sure to create the ${hookDir} directory if it doesn't exist.`,
      '',
      'The hook receives JSON on stdin with tool_name, tool_input, etc.',
      hookFormEvent.startsWith('Pre') ? 'It can output JSON with { "decision": "approve"|"block"|"deny", "reason": "..." } to control the tool.' : '',
    ].filter(Boolean).join('\n');

    getTransport().send(IPC.TERMINAL_INPUT_ID, { terminalId: activeTerminalId, data: prompt + '\r' });
    toast.info('Sent to agent — check your terminal');
    setShowAIGenerate(false);
    setAiGeneratePrompt('');
  }

  function applyTemplate(template: (typeof HOOK_TEMPLATES)[number]) {
    setHookFormEvent(template.eventType);
    setHookFormMatcher(template.matcher);
    setShowAIGenerate(true);
    setAiGeneratePrompt(template.scriptDescription);
    setShowAddHookDialog(true);
    setEditingHook(null);
  }

  /** Total hook entries count */
  const totalHookCount = useMemo(() => {
    return Object.values(hooksConfig).reduce((sum, entries) => sum + entries.length, 0);
  }, [hooksConfig]);

  /* ---------- Search logic ---------- */

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const sectionMatchCounts = useMemo(() => {
    if (!normalizedQuery) return null;
    const counts: Record<string, number> = {};
    for (const [section, labels] of Object.entries(SECTION_LABELS)) {
      counts[section] = labels.filter((l) => l.toLowerCase().includes(normalizedQuery)).length;
    }
    return counts;
  }, [normalizedQuery]);

  // Auto-switch to the first section with matches when searching
  useEffect(() => {
    if (!sectionMatchCounts) return;
    const currentCount = sectionMatchCounts[activeTab] ?? 0;
    if (currentCount > 0) return; // Current section has matches, stay
    const firstMatch = NAV_ITEMS.find((item) => (sectionMatchCounts[item.key] ?? 0) > 0);
    if (firstMatch) setActiveTab(firstMatch.key);
  }, [sectionMatchCounts]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Returns true if a setting label matches the current search query (or if no search is active). */
  function matchesSearch(label: string): boolean {
    if (!normalizedQuery) return true;
    return label.toLowerCase().includes(normalizedQuery);
  }

  // Don't mount Dialog tree when closed — avoids Radix Presence ref errors in web mode
  if (!settingsOpen) return null;

  return (
    <>
    <Dialog open onOpenChange={setSettingsOpen}>
      <DialogContent className="bg-bg-primary border-border-subtle text-text-primary sm:max-w-[1100px] !flex !flex-col h-[88vh] max-h-[920px] overflow-hidden p-0" aria-describedby={undefined}>
        <DialogHeader className="shrink-0 px-6 pt-6">
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 min-h-0 bg-bg-deep/35">
          {/* Sidebar navigation */}
          <div className="w-52 lg:w-56 border-r border-border-subtle bg-bg-secondary/35 shrink-0 flex flex-col">
            {/* Search input */}
            <div className="px-3.5 pt-3.5 pb-2.5">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="w-full bg-bg-deep border border-border-subtle rounded px-2 py-1 pl-7 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent/50"
                />
                {searchQuery && (
                  <button
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary cursor-pointer"
                    onClick={() => setSearchQuery('')}
                  >
                    <XIcon className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Nav items */}
            <nav className="flex-1 overflow-y-auto px-2.5 pb-4 space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.key;
                const matchCount = sectionMatchCounts?.[item.key] ?? 0;
                const isHidden = sectionMatchCounts && matchCount === 0;
                if (isHidden) return null;
                return (
                  <button
                    key={item.key}
                    onClick={() => setActiveTab(item.key)}
                    className={cn(
                      'flex items-center gap-2.5 w-full text-left px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer',
                      isActive
                        ? 'bg-bg-hover text-text-primary border border-accent/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]'
                        : 'text-text-secondary hover:bg-bg-hover/60 hover:text-text-primary border border-transparent'
                    )}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="flex-1 truncate">{item.label}</span>
                    {sectionMatchCounts && matchCount > 0 && (
                      <span className="text-[10px] bg-accent/20 text-accent px-1.5 rounded-full">{matchCount}</span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Content pane */}
          <div className="flex-1 overflow-y-auto px-6 py-5 lg:px-8">
            <div className="mx-auto w-full max-w-[920px] space-y-5">

            {/* ===== Appearance ===== */}
            {activeTab === 'appearance' && (
              <>
                {/* Theme Presets */}
                {matchesSearch('Theme Presets') && (
                  <div data-setting-group="Theme Presets">
                    <div className="text-[10px] uppercase tracking-wider text-text-tertiary font-medium mb-1.5">Theme Presets</div>
                    <div className="grid grid-cols-2 gap-2">
                      {(() => {
                        const appearance = (settings.appearance as Record<string, unknown>) || {};
                        const customThemes = (appearance.customThemes as ThemeDefinition[]) || [];
                        const allThemes = [...BUILTIN_THEMES, ...customThemes];
                        return allThemes.map((theme) => (
                          <motion.div
                            key={theme.id}
                            whileTap={{ scale: 0.97 }}
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              setActiveThemeId(theme.id);
                              setCustomTokenOverrides({});
                              // Clear independent toggle overrides so the new theme's defaults apply
                              updateSetting.mutate([{ key: 'appearance.activeThemeId', value: theme.id }]);
                              updateSetting.mutate([{ key: 'appearance.enableNeonTraces', value: undefined }]);
                              updateSetting.mutate([{ key: 'appearance.enableScanlines', value: undefined }]);
                              updateSetting.mutate([{ key: 'appearance.enableLogoGlow', value: undefined }]);
                            }}
                            onKeyDown={(e: React.KeyboardEvent) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setActiveThemeId(theme.id);
                                setCustomTokenOverrides({});
                                updateSetting.mutate([{ key: 'appearance.activeThemeId', value: theme.id }]);
                                updateSetting.mutate([{ key: 'appearance.enableNeonTraces', value: undefined }]);
                                updateSetting.mutate([{ key: 'appearance.enableScanlines', value: undefined }]);
                                updateSetting.mutate([{ key: 'appearance.enableLogoGlow', value: undefined }]);
                              }
                            }}
                            className={`relative text-left rounded-lg p-3 border transition-colors cursor-pointer ${
                              activeThemeId === theme.id
                                ? 'border-accent bg-bg-elevated'
                                : 'border-border-subtle bg-bg-secondary/50 hover:bg-bg-hover'
                            }`}
                          >
                            {activeThemeId === theme.id && (
                              <div className="absolute top-2 right-2">
                                <Check className="w-3.5 h-3.5 text-accent" />
                              </div>
                            )}
                            <div className="text-sm text-text-primary font-medium mb-0.5">{theme.name}</div>
                            <div className="text-xs text-text-tertiary mb-2 line-clamp-1">{theme.description}</div>
                            <div className="flex gap-1.5">
                              <div className="w-4 h-4 rounded-full border border-border-subtle" style={{ background: theme.tokens.bgDeep }} />
                              <div className="w-4 h-4 rounded-full border border-border-subtle" style={{ background: theme.tokens.accent }} />
                              <div className="w-4 h-4 rounded-full border border-border-subtle" style={{ background: theme.tokens.neonPurple }} />
                              <div className="w-4 h-4 rounded-full border border-border-subtle" style={{ background: theme.tokens.neonPink }} />
                              <div className="w-4 h-4 rounded-full border border-border-subtle" style={{ background: theme.tokens.neonCyan }} />
                            </div>
                            {!theme.builtIn && (
                              <button
                                className="absolute bottom-2 right-2 text-text-muted hover:text-red-400 transition-colors cursor-pointer"
                                title="Delete custom theme"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const updated = customThemes.filter((t: ThemeDefinition) => t.id !== theme.id);
                                  updateSetting.mutate([{ key: 'appearance.customThemes', value: updated }]);
                                  if (activeThemeId === theme.id) {
                                    setActiveThemeId('classic-amber');
                                    updateSetting.mutate([{ key: 'appearance.activeThemeId', value: 'classic-amber' }]);
                                    updateSetting.mutate([{ key: 'appearance.enableNeonTraces', value: undefined }]);
                                    updateSetting.mutate([{ key: 'appearance.enableScanlines', value: undefined }]);
                                    updateSetting.mutate([{ key: 'appearance.enableLogoGlow', value: undefined }]);
                                  }
                                  toast.success(`Deleted "${theme.name}"`);
                                }}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </motion.div>
                        ));
                      })()}
                    </div>
                  </div>
                )}

                {/* Customization */}
                {matchesSearch('Customize') && (
                  <SettingGroup label="Customize">
                    {/* Color pickers */}
                    {(() => {
                      const appearance = (settings.appearance as Record<string, unknown>) || {};
                      const customThemes = (appearance.customThemes as ThemeDefinition[]) || [];
                      const baseTheme = getThemeById(activeThemeId, customThemes) ?? THEME_CLASSIC_AMBER;
                      const currentTokens = { ...baseTheme.tokens, ...customTokenOverrides };

                      const colorFields: { key: keyof ThemeTokens; label: string }[] = [
                        { key: 'accent', label: 'Accent' },
                        { key: 'neonPurple', label: 'Neon Purple' },
                        { key: 'neonPink', label: 'Neon Pink' },
                        { key: 'neonCyan', label: 'Neon Cyan' },
                      ];

                      const hasOverrides = Object.keys(customTokenOverrides).length > 0;

                      return (
                        <>
                          <div className="grid grid-cols-2 gap-3">
                            {colorFields.map(({ key, label }) => (
                              <div key={key} className="flex items-center gap-2" data-setting-label={label}>
                                <input
                                  type="color"
                                  value={currentTokens[key] as string}
                                  onChange={(e) => {
                                    setCustomTokenOverrides((prev) => ({ ...prev, [key]: e.target.value }));
                                  }}
                                  className="w-8 h-8 rounded border border-border-subtle cursor-pointer bg-transparent"
                                />
                                <div className="text-sm text-text-primary">{label}</div>
                              </div>
                            ))}
                          </div>

                          {/* Live preview swatch */}
                          {hasOverrides && (
                            <div className="mt-2 space-y-1.5">
                              <div className="text-[10px] uppercase tracking-wider text-text-tertiary font-medium">Preview</div>
                              <div
                                className="rounded-lg p-3 border border-border-subtle overflow-hidden"
                                style={{ backgroundColor: currentTokens.bgPrimary }}
                              >
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: currentTokens.accent }} />
                                  <span className="text-xs font-medium" style={{ color: currentTokens.textPrimary }}>Sample text</span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: `${currentTokens.accent}20`, color: currentTokens.accent }}>Badge</span>
                                </div>
                                <div className="flex gap-1.5">
                                  <div className="h-1.5 flex-1 rounded-full" style={{ backgroundColor: currentTokens.accent }} />
                                  <div className="h-1.5 w-8 rounded-full" style={{ backgroundColor: currentTokens.bgTertiary }} />
                                </div>
                                {currentTokens.enableNeonTraces && (
                                  <div className="flex gap-1 mt-2">
                                    <div className="h-1 w-6 rounded-full" style={{ backgroundColor: currentTokens.neonPurple, opacity: 0.6 }} />
                                    <div className="h-1 w-4 rounded-full" style={{ backgroundColor: currentTokens.neonPink, opacity: 0.6 }} />
                                    <div className="h-1 w-5 rounded-full" style={{ backgroundColor: currentTokens.neonCyan, opacity: 0.6 }} />
                                  </div>
                                )}
                              </div>
                              <p className="text-[10px] text-text-muted">Save as custom theme to apply color changes</p>
                            </div>
                          )}

                          {/* Feature toggles — saved independently, apply in real time */}
                          <div className="border-t border-border-subtle pt-3 mt-3 space-y-3">
                            <p className="text-[10px] text-text-muted -mb-1">Toggles apply instantly to any theme</p>
                            <SettingToggle
                              label="Neon Traces"
                              description="Synthwave glow effects on scrollbars and selections"
                              value={!!((settings.appearance as Record<string, unknown>)?.enableNeonTraces ?? currentTokens.enableNeonTraces)}
                              onChange={(v) => updateSetting.mutate([{ key: 'appearance.enableNeonTraces', value: v }])}
                            />
                            <SettingToggle
                              label="CRT Scanlines"
                              description="Subtle scanline overlay for retro feel"
                              value={!!((settings.appearance as Record<string, unknown>)?.enableScanlines ?? currentTokens.enableScanlines)}
                              onChange={(v) => updateSetting.mutate([{ key: 'appearance.enableScanlines', value: v }])}
                            />
                            <SettingToggle
                              label="Logo Glow"
                              description="Ambient glow effect on sidebar logo"
                              value={!!((settings.appearance as Record<string, unknown>)?.enableLogoGlow ?? currentTokens.enableLogoGlow)}
                              onChange={(v) => updateSetting.mutate([{ key: 'appearance.enableLogoGlow', value: v }])}
                            />
                          </div>
                        </>
                      );
                    })()}
                  </SettingGroup>
                )}

                {(matchesSearch('Save as Custom Theme') || showSaveThemeInput || Object.keys(customTokenOverrides).length > 0) && (
                  <SettingGroup label="Theme Actions">
                    <div className="flex gap-2 flex-wrap">
                      {showSaveThemeInput ? (
                        <div className="flex gap-2 items-center flex-1">
                          <Input
                            value={customThemeName}
                            onChange={(e) => setCustomThemeName(e.target.value)}
                            placeholder="Theme name"
                            className="bg-bg-deep border-border-subtle text-sm flex-1"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') {
                                setShowSaveThemeInput(false);
                                setCustomThemeName('');
                              }
                            }}
                          />
                          <Button
                            size="sm"
                            className="bg-accent text-bg-deep hover:bg-accent/80 cursor-pointer shrink-0"
                            disabled={!customThemeName.trim()}
                            onClick={() => {
                              const appearance = (settings.appearance as Record<string, unknown>) || {};
                              const customThemes = (appearance.customThemes as ThemeDefinition[]) || [];
                              const base = getThemeById(activeThemeId, customThemes) ?? THEME_CLASSIC_AMBER;
                              const newTheme: ThemeDefinition = {
                                id: `custom-${Date.now()}`,
                                name: customThemeName.trim(),
                                description: 'Custom theme',
                                tokens: { ...base.tokens, ...customTokenOverrides } as ThemeTokens,
                                builtIn: false,
                                createdAt: new Date().toISOString(),
                              };
                              const updated = [...customThemes, newTheme];
                              updateSetting.mutate([{ key: 'appearance.customThemes', value: updated }]);
                              updateSetting.mutate([{ key: 'appearance.activeThemeId', value: newTheme.id }]);
                              setActiveThemeId(newTheme.id);
                              setCustomTokenOverrides({});
                              setShowSaveThemeInput(false);
                              setCustomThemeName('');
                              toast.success(`Saved theme "${newTheme.name}"`);
                            }}
                          >
                            <Save className="h-3.5 w-3.5 mr-1" />
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="cursor-pointer shrink-0"
                            onClick={() => {
                              setShowSaveThemeInput(false);
                              setCustomThemeName('');
                            }}
                          >
                            <XIcon className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            className={cn(
                              'cursor-pointer',
                              Object.keys(customTokenOverrides).length > 0
                                ? 'bg-accent text-bg-deep hover:bg-accent/80'
                                : 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover',
                            )}
                            onClick={() => setShowSaveThemeInput(true)}
                          >
                            <Save className="h-3.5 w-3.5 mr-1" />
                            Save as Custom Theme
                          </Button>
                          {Object.keys(customTokenOverrides).length > 0 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="cursor-pointer"
                              onClick={() => {
                                setCustomTokenOverrides({});
                                toast.info('Reset to preset defaults');
                              }}
                            >
                              <RotateCcw className="h-3.5 w-3.5 mr-1" />
                              Reset
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </SettingGroup>
                )}

                {(
                  matchesSearch('Workspace Pills') ||
                  matchesSearch('Workspace Pill Style') ||
                  matchesSearch('Short Label') ||
                  matchesSearch('Icon')
                ) && (
                  <SettingGroup label="Workspace Pills">
                    <div data-setting-label="Workspace Pill Style">
                      <div className="text-sm text-text-primary mb-1">Workspace Pill Content</div>
                      <div className="text-xs text-text-tertiary mb-2">
                        Mix and match number, short label, and icon. If a workspace has a custom short label, enabling Index will show `# + short label` automatically.
                      </div>
                      <div className="grid gap-2 sm:grid-cols-3">
                        {([
                          {
                            key: 'showIndex',
                            label: 'Index',
                            description: 'Keep the #1 shortcut marker visible and pair it with a custom short label when set',
                          },
                          {
                            key: 'showShortLabel',
                            label: 'Short Label',
                            description: 'Show the workspace short name or monogram',
                          },
                          {
                            key: 'showIcon',
                            label: 'Icon',
                            description: 'Show the optional workspace icon',
                          },
                        ] as const).map((option) => {
                          const enabled = workspacePillDisplay[option.key];
                          return (
                            <button
                              key={option.key}
                              onClick={() => {
                                const nextDisplay = {
                                  ...workspacePillDisplay,
                                  [option.key]: !enabled,
                                };
                                const hasAnyEnabled = nextDisplay.showIndex || nextDisplay.showShortLabel || nextDisplay.showIcon;
                                updateSetting.mutate([{
                                  key: 'appearance.workspacePillDisplay',
                                  value: hasAnyEnabled ? nextDisplay : DEFAULT_WORKSPACE_PILL_DISPLAY,
                                }]);
                              }}
                              className={cn(
                                'rounded-lg border p-3 text-left transition-colors cursor-pointer',
                                enabled
                                  ? 'border-accent bg-accent/10 text-text-primary'
                                  : 'border-border-subtle bg-bg-deep text-text-secondary hover:bg-bg-hover',
                              )}
                            >
                              <div className="text-sm font-medium">{option.label}</div>
                              <div className="text-[10px] text-text-tertiary mt-1">{option.description}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs text-text-tertiary">
                        Set per-workspace short labels, icons, accent colors, and default landing projects. Short labels are capped at 4 characters.
                      </div>
                      {appearanceWorkspaceList.length > 0 ? (
                        appearanceWorkspaceList.map((workspace, index) => (
                          <WorkspacePillAppearanceRow
                            key={workspace.key}
                            workspace={workspace}
                            index={index + 1}
                            display={workspacePillDisplay}
                            highlighted={focusedWorkspaceKey === workspace.key}
                            onSaved={refetchWorkspaceList}
                          />
                        ))
                      ) : (
                        <div className="rounded-lg border border-dashed border-border-subtle bg-bg-deep/40 px-3 py-4 text-xs text-text-muted">
                          Create a workspace first to customize its pill label or icon.
                        </div>
                      )}
                    </div>
                  </SettingGroup>
                )}
              </>
            )}

            {/* ===== General ===== */}
            {activeTab === 'general' && (
              <>
                {/* Startup group */}
                {(matchesSearch('Open terminal on startup') || matchesSearch('Reuse idle terminal for agent') || matchesSearch('Show hidden files (.dotfiles)') || matchesSearch('Startup')) && (
                  <SettingGroup label="Startup">
                    {matchesSearch('Open terminal on startup') && (
                      <SettingToggle
                        label="Open terminal on startup"
                        description="Automatically create a terminal when SubFrame launches"
                        value={autoCreateTerminal}
                        onChange={(v) => saveToggle('general.autoCreateTerminal', v)}
                      />
                    )}
                    {matchesSearch('Reuse idle terminal for agent') && (
                      <SettingToggle
                        label="Reuse idle terminal for agent"
                        description="Start agent in the active terminal if no agent is running, instead of creating a new one"
                        value={reuseIdleTerminal}
                        onChange={(v) => saveToggle('general.reuseIdleTerminal', v)}
                      />
                    )}
                    {matchesSearch('Show hidden files (.dotfiles)') && (
                      <SettingToggle
                        label="Show hidden files (.dotfiles)"
                        description="Show files starting with a dot in the file tree"
                        value={showDotfiles}
                        onChange={(v) => saveToggle('general.showDotfiles', v)}
                      />
                    )}
                  </SettingGroup>
                )}

                {/* Behavior group */}
                {(matchesSearch('Confirm before closing') || matchesSearch('Auto-poll usage') || matchesSearch('Grid overflow auto-switch') || matchesSearch('Highlight user messages') || matchesSearch('Behavior')) && (
                  <SettingGroup label="Behavior">
                    {matchesSearch('Confirm before closing') && (
                      <SettingToggle
                        label="Confirm before closing"
                        description="Show a confirmation dialog before closing the window"
                        value={confirmBeforeClose}
                        onChange={(v) => saveToggle('general.confirmBeforeClose', v)}
                      />
                    )}

                    {matchesSearch('Auto-poll usage') && (
                      <div data-setting-label="Auto-poll usage">
                        <SettingToggle
                          label="Auto-poll usage"
                          description="Periodically check Claude API usage. Off = on-demand only (click to refresh)."
                          value={usagePollingInterval > 0}
                          onChange={() => {
                            updateSetting.mutate([{ key: 'general.usagePollingInterval', value: usagePollingInterval === 0 ? 300 : 0 }]);
                          }}
                        />
                        {usagePollingInterval > 0 && (
                          <div className="mt-2">
                            <SettingSlider
                              label=""
                              value={usagePollingInterval}
                              onChange={(v) => updateSetting.mutate([{ key: 'general.usagePollingInterval', value: v }])}
                              min={30}
                              max={600}
                              step={30}
                              formatValue={(v) =>
                                v >= 60
                                  ? `${Math.floor(v / 60)}m${v % 60 ? ` ${v % 60}s` : ''}`
                                  : `${v}s`
                              }
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {matchesSearch('Grid overflow auto-switch') && (
                      <SettingToggle
                        label="Grid overflow auto-switch"
                        description="Auto-switch to single view when selecting a terminal outside the grid, and back when selecting one inside"
                        value={gridOverflowAutoSwitch}
                        onChange={(v) => saveToggle('general.gridOverflowAutoSwitch', v)}
                      />
                    )}

                    {matchesSearch('Highlight user messages') && (
                      <SettingToggle
                        label="Highlight user messages"
                        description="Mark your messages in agent sessions with a left border and enable scroll-to-last-message navigation"
                        value={highlightUserMessages}
                        onChange={(v) => saveToggle('general.highlightUserMessages', v)}
                        extra={highlightUserMessages ? (
                          <input
                            type="color"
                            value={userMessageColor}
                            onChange={(e) => updateSetting.mutate([{ key: 'general.userMessageColor', value: e.target.value }])}
                            className="w-7 h-5 rounded cursor-pointer border border-border-subtle bg-transparent"
                            title="Message border color"
                          />
                        ) : undefined}
                      />
                    )}
                  </SettingGroup>
                )}

                {/* Paths group */}
                {(matchesSearch('Default Project Directory') || matchesSearch('Paths')) && (
                  <SettingGroup label="Paths">
                    <SettingInput
                      label="Default Project Directory"
                      description="Subdirectories appear automatically in the project list"
                      value={defaultProjectDir}
                      onChange={() => {}}
                      readOnly
                      placeholder="No directory selected"
                      extra={
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="cursor-pointer shrink-0"
                            title="Browse for directory"
                            onClick={async () => {
                              const selected = await typedInvoke(IPC.SELECT_DEFAULT_PROJECT_DIR);
                              if (selected) {
                                updateSetting.mutate([{ key: 'general.defaultProjectDir', value: selected }]);
                                toast.success('Default project directory set');
                              }
                            }}
                          >
                            <FolderOpen className="h-4 w-4" />
                          </Button>
                          {defaultProjectDir && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="cursor-pointer shrink-0"
                              title="Clear directory"
                              onClick={() => {
                                updateSetting.mutate([{ key: 'general.defaultProjectDir', value: '' }]);
                                toast.info('Default project directory cleared');
                              }}
                            >
                              <XIcon className="h-4 w-4" />
                            </Button>
                          )}
                        </>
                      }
                    />
                    {defaultProjectDir && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="cursor-pointer mt-2 text-xs"
                        disabled={scanning}
                        onClick={async () => {
                          setScanning(true);
                          try {
                            toast.info('Scanning directory...');
                            await typedInvoke(IPC.SCAN_PROJECT_DIR, defaultProjectDir);
                            toast.success('Scan complete');
                          } catch {
                            toast.error('Failed to scan directory');
                          } finally {
                            setScanning(false);
                          }
                        }}
                      >
                        {scanning ? <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <FolderSearch className="h-3.5 w-3.5 mr-1.5" />}
                        Scan Now
                      </Button>
                    )}
                  </SettingGroup>
                )}

                {/* Git group */}
                {(matchesSearch('Auto-fetch') || matchesSearch('Git')) && (
                  <SettingGroup label="Git">
                    {matchesSearch('Auto-fetch') && (
                      <SettingSelect
                        label="Auto-fetch"
                        description="Periodically run git fetch in the background to keep remote refs up to date"
                        value={localStorage.getItem('git-auto-fetch-interval') || '0'}
                        onChange={(v) => {
                          localStorage.setItem('git-auto-fetch-interval', v);
                          toast.success(v === '0' ? 'Auto-fetch disabled' : `Auto-fetch set to every ${v === '180' ? '3' : v === '300' ? '5' : v === '600' ? '10' : '15'} minutes`);
                        }}
                        options={[
                          { value: '0', label: 'Off' },
                          { value: '180', label: 'Every 3 minutes' },
                          { value: '300', label: 'Every 5 minutes' },
                          { value: '600', label: 'Every 10 minutes' },
                          { value: '900', label: 'Every 15 minutes' },
                        ]}
                      />
                    )}
                  </SettingGroup>
                )}

                {/* CLI group */}
                {(matchesSearch('Install CLI') || matchesSearch('CLI')) && (
                  <SettingGroup label="CLI">
                    <div data-setting-label="Install CLI">
                      <div className="text-sm text-text-primary mb-1">SubFrame CLI</div>
                      <div className="text-xs text-text-tertiary mb-2">
                        Install the <code className="text-accent">subframe</code> command to open files and projects from your terminal.
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs"
                        disabled={cliInstalling || cliUninstalling}
                        onClick={handleInstallCli}
                      >
                        {cliInstalling && <RefreshCw className="w-3 h-3 mr-1 animate-spin" />}
                        Install CLI to PATH
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs text-text-muted hover:text-error ml-2"
                        disabled={cliInstalling || cliUninstalling}
                        onClick={handleUninstallCli}
                      >
                        {cliUninstalling && <RefreshCw className="w-3 h-3 mr-1 animate-spin" />}
                        Uninstall
                      </Button>
                    </div>
                  </SettingGroup>
                )}

                {/* Workspace Bar */}
                {(matchesSearch('Collapsed Workspace Count') || matchesSearch('Max Visible Workspaces') || matchesSearch('Workspace Bar') || matchesSearch('Auto-sort Workspace Pills') || matchesSearch('Max Visible Workspace Pills')) && (
                  <SettingGroup label="Workspace Bar">
                    {matchesSearch('Auto-sort Workspace Pills') && (
                      <SettingToggle
                        label="Auto-sort workspace pills by activity"
                        description="Active projects (with running agents/terminals) appear first in the pill bar"
                        value={(settings?.general as Record<string, unknown>)?.autoSortWorkspacePills !== false}
                        onChange={(v) => updateSetting.mutate([{ key: 'general.autoSortWorkspacePills', value: v }])}
                      />
                    )}
                    {matchesSearch('Max Visible Workspace Pills') && (
                      <SettingSelect
                        label="Max visible workspace pills"
                        description="0 = auto (expand for active workspaces). Otherwise cap at this number, always showing active ones"
                        value={String((settings?.general as Record<string, unknown>)?.maxVisibleWorkspacePills ?? 0)}
                        onChange={(v) => updateSetting.mutate([{ key: 'general.maxVisibleWorkspacePills', value: parseInt(v, 10) }])}
                        options={[
                          { value: '0', label: '0 (auto)' },
                          { value: '3', label: '3' },
                          { value: '4', label: '4' },
                          { value: '5', label: '5' },
                          { value: '6', label: '6' },
                          { value: '8', label: '8' },
                          { value: '10', label: '10' },
                          { value: '12', label: '12' },
                        ]}
                      />
                    )}
                    {matchesSearch('Collapsed Workspace Count') && (
                      <SettingSelect
                        label="Collapsed pill count"
                        description="Workspace pills visible before hovering to expand (active workspaces shown first)"
                        value={String((settings?.general as Record<string, unknown>)?.collapsedWorkspaceCount ?? 3)}
                        onChange={(v) => updateSetting.mutate([{ key: 'general.collapsedWorkspaceCount', value: parseInt(v, 10) }])}
                        options={[
                          { value: '2', label: '2' },
                          { value: '3', label: '3 (default)' },
                          { value: '4', label: '4' },
                          { value: '5', label: '5' },
                          { value: '6', label: '6' },
                        ]}
                      />
                    )}
                    {matchesSearch('Max Visible Workspaces') && (
                      <SettingSelect
                        label="Max expanded workspaces"
                        description="Maximum workspace pills visible on hover before horizontal scroll"
                        value={String((settings?.general as Record<string, unknown>)?.maxVisibleWorkspaces ?? 12)}
                        onChange={(v) => updateSetting.mutate([{ key: 'general.maxVisibleWorkspaces', value: parseInt(v, 10) }])}
                        options={[
                          { value: '6', label: '6' },
                          { value: '8', label: '8' },
                          { value: '10', label: '10' },
                          { value: '12', label: '12 (default)' },
                          { value: '15', label: '15' },
                          { value: '20', label: '20' },
                        ]}
                      />
                    )}
                  </SettingGroup>
                )}
              </>
            )}

            {/* ===== Terminal ===== */}
            {activeTab === 'terminal' && (
              <>
                {/* Font group */}
                {(matchesSearch('Font Size') || matchesSearch('Font Family') || matchesSearch('Font') || matchesSearch('Nerd Font')) && (
                  <SettingGroup label="Font">
                    {matchesSearch('Font Size') && (
                      <SettingSlider
                        label="Font Size"
                        value={fontSize}
                        onChange={setFontSize}
                        min={10}
                        max={24}
                        step={1}
                        formatValue={(v) => `${v}px`}
                      />
                    )}
                    {(matchesSearch('Font Family') || matchesSearch('Nerd Font')) && (
                      <div data-setting-label="Font Family">
                        <SettingInput
                          label="Font Family"
                          value={fontFamily}
                          onChange={setFontFamily}
                        />
                        {nerdFontDetected ? (
                          <p className="text-xs text-success mt-1 flex items-center gap-1">
                            <Check className="w-3 h-3" /> Nerd Font detected: {nerdFontDetected}
                          </p>
                        ) : (
                          <p className="text-xs text-text-tertiary mt-1">
                            For Oh My Posh / Starship icons, install a{' '}
                            <a
                              href="https://www.nerdfonts.com/font-downloads"
                              target="_blank"
                              rel="noreferrer"
                              className="text-accent hover:underline"
                            >
                              Nerd Font
                            </a>
                            {' '}(e.g. JetBrainsMono Nerd Font)
                          </p>
                        )}
                      </div>
                    )}
                  </SettingGroup>
                )}

                {/* Display group */}
                {(matchesSearch('Line Height') || matchesSearch('Scrollback Lines') || matchesSearch('Cursor Style') || matchesSearch('Cursor Blink') || matchesSearch('Display')) && (
                  <SettingGroup label="Display">
                    {matchesSearch('Line Height') && (
                      <SettingInput
                        label="Line Height"
                        value={lineHeight}
                        onChange={(v) => setLineHeight(Number(v))}
                        type="number"
                        min={1.0}
                        max={2.0}
                        step={0.1}
                      />
                    )}
                    {matchesSearch('Scrollback Lines') && (
                      <SettingInput
                        label="Scrollback Lines"
                        value={scrollback}
                        onChange={(v) => setScrollback(Number(v))}
                        type="number"
                        min={1000}
                        max={100000}
                        step={1000}
                      />
                    )}
                    {matchesSearch('Cursor Style') && (
                      <SettingSelect
                        label="Cursor Style"
                        value={cursorStyle}
                        onChange={setCursorStyle}
                        options={[
                          { value: 'block', label: 'Block' },
                          { value: 'underline', label: 'Underline' },
                          { value: 'bar', label: 'Bar' },
                        ]}
                      />
                    )}
                    {matchesSearch('Cursor Blink') && (
                      <SettingToggle
                        label="Cursor Blink"
                        description="Enable blinking cursor in the terminal"
                        value={cursorBlink}
                        onChange={setCursorBlink}
                      />
                    )}
                  </SettingGroup>
                )}

                {/* Behavior group */}
                {(matchesSearch('Default Shell') || matchesSearch('Bell Sound') || matchesSearch('Copy on Select') || matchesSearch('Max Terminals') || matchesSearch('Freeze Hover Action') || matchesSearch('Paused Output Overlay') || matchesSearch('Behavior')) && (
                  <SettingGroup label="Behavior">
                    {matchesSearch('Default Shell') && availableShells.length > 0 && (
                      <SettingSelect
                        label="Default Shell"
                        description="Shell used for new terminals"
                        value={defaultShell}
                        onChange={(v) => setDefaultShell(v)}
                        options={[
                          { value: '', label: 'System Default' },
                          ...availableShells.map((s) => ({
                            value: s.path,
                            label: `${s.name}${s.isDefault ? ' (default)' : ''}`,
                          })),
                        ]}
                      />
                    )}
                    {matchesSearch('Default Shell') && availableShells.length === 0 && (
                      <SettingInput
                        label="Default Shell"
                        description="Leave empty for system default"
                        value={defaultShell}
                        onChange={setDefaultShell}
                        placeholder="System default"
                      />
                    )}
                    {matchesSearch('Bell Sound') && (
                      <SettingToggle
                        label="Bell Sound"
                        description="Play a sound on terminal bell"
                        value={bellSound}
                        onChange={setBellSound}
                      />
                    )}
                    {matchesSearch('Copy on Select') && (
                      <SettingToggle
                        label="Copy on Select"
                        description="Automatically copy selected text to clipboard"
                        value={copyOnSelect}
                        onChange={setCopyOnSelect}
                      />
                    )}
                    {matchesSearch('Max Terminals') && (
                      <SettingSlider
                        label="Max Terminals"
                        description="Maximum number of terminal instances allowed (global, across all projects)"
                        value={maxTerminals}
                        onChange={setMaxTerminals}
                        min={1}
                        max={20}
                        step={1}
                      />
                    )}
                    {matchesSearch('Freeze Hover Action') && (
                      <SettingToggle
                        label="Freeze Hover Action"
                        description="Show a pause or resume icon on terminal tabs when you hover them"
                        value={showFreezeHoverAction}
                        onChange={(v) => saveToggle('terminal.showFreezeHoverAction', v)}
                      />
                    )}
                    {matchesSearch('Paused Output Overlay') && (
                      <SettingToggle
                        label="Paused Output Overlay"
                        description="Show the in-terminal paused banner with a resume action when output is frozen"
                        value={showFreezeOverlay}
                        onChange={(v) => saveToggle('terminal.showFreezeOverlay', v)}
                      />
                    )}
                  </SettingGroup>
                )}

                {/* Persistence group */}
                {(matchesSearch('Restore on Startup') || matchesSearch('Restore Scrollback') || matchesSearch('Auto-resume Agent') || matchesSearch('Persistence')) && (
                  <SettingGroup label="Persistence">
                    {matchesSearch('Restore on Startup') && (
                      <SettingToggle
                        label="Restore on Startup"
                        description="Reopen terminals that were open when SubFrame closed"
                        value={restoreOnStartup}
                        onChange={setRestoreOnStartup}
                      />
                    )}
                    {matchesSearch('Restore Scrollback') && (
                      <SettingToggle
                        label="Restore Scrollback"
                        description="Restore terminal scrollback history (may increase memory usage)"
                        value={restoreScrollback}
                        onChange={setRestoreScrollback}
                      />
                    )}
                    {matchesSearch('Auto-resume Agent') && (
                      <SettingSelect
                        label="Auto-resume Agent"
                        description="Behavior when reopening a terminal that had an active agent"
                        value={autoResumeAgent}
                        onChange={(v) => setAutoResumeAgent(v as 'auto' | 'prompt' | 'never')}
                        options={[
                          { value: 'auto', label: 'Auto (Resume immediately)' },
                          { value: 'prompt', label: 'Prompt (Ask to resume)' },
                          { value: 'never', label: 'Never (Start fresh)' },
                        ]}
                      />
                    )}
                  </SettingGroup>
                )}

                <Button size="sm" onClick={saveTerminal} className="bg-accent text-bg-deep hover:bg-accent/80 cursor-pointer">
                  Save
                </Button>
              </>
            )}

            {/* ===== Editor ===== */}
            {activeTab === 'editor' && (
              <>
                {/* Font group */}
                {(matchesSearch('Font Size') || matchesSearch('Font Family') || matchesSearch('Tab Size') || matchesSearch('Font')) && (
                  <SettingGroup label="Font">
                    {matchesSearch('Font Size') && (
                      <SettingSlider
                        label="Font Size"
                        value={editorFontSize}
                        onChange={setEditorFontSize}
                        min={8}
                        max={24}
                        step={1}
                        formatValue={(v) => `${v}px`}
                      />
                    )}
                    {matchesSearch('Font Family') && (
                      <SettingInput
                        label="Font Family"
                        value={editorFontFamily}
                        onChange={setEditorFontFamily}
                      />
                    )}
                    {matchesSearch('Tab Size') && (
                      <SettingSelect
                        label="Tab Size"
                        value={String(editorTabSize)}
                        onChange={(v) => setEditorTabSize(Number(v))}
                        options={[
                          { value: '2', label: '2 spaces' },
                          { value: '4', label: '4 spaces' },
                        ]}
                      />
                    )}
                  </SettingGroup>
                )}

                {/* Display group */}
                {(matchesSearch('Theme') || matchesSearch('Word Wrap') || matchesSearch('Minimap') || matchesSearch('Line Numbers') || matchesSearch('Bracket Matching') || matchesSearch('Display')) && (
                  <SettingGroup label="Display">
                    {matchesSearch('Theme') && (
                      <SettingSelect
                        label="Theme"
                        value={editorTheme}
                        onChange={setEditorTheme}
                        options={Object.values(EDITOR_THEMES).map((theme) => ({
                          value: theme.id,
                          label: theme.label,
                        }))}
                      />
                    )}
                    {matchesSearch('Word Wrap') && (
                      <SettingToggle
                        label="Word Wrap"
                        description="Wrap long lines in the editor"
                        value={editorWordWrap}
                        onChange={setEditorWordWrap}
                      />
                    )}
                    {matchesSearch('Minimap') && (
                      <SettingToggle
                        label="Minimap"
                        description="Show a minimap overview of the file"
                        value={editorMinimap}
                        onChange={setEditorMinimap}
                      />
                    )}
                    {matchesSearch('Line Numbers') && (
                      <SettingToggle
                        label="Line Numbers"
                        description="Show line numbers in the gutter"
                        value={editorLineNumbers}
                        onChange={setEditorLineNumbers}
                      />
                    )}
                    {matchesSearch('Bracket Matching') && (
                      <SettingToggle
                        label="Bracket Matching"
                        description="Highlight matching brackets"
                        value={editorBracketMatching}
                        onChange={setEditorBracketMatching}
                      />
                    )}
                  </SettingGroup>
                )}

                <Button size="sm" onClick={saveEditor} className="bg-accent text-bg-deep hover:bg-accent/80 cursor-pointer">
                  Save
                </Button>
              </>
            )}

            {/* ===== AI Tool ===== */}
            {activeTab === 'ai-tool' && (
              <>
                {/* All Tools — shown as cards */}
                {matchesSearch('AI Tools') && (
                  <div data-setting-label="AI Tools">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm text-text-primary">AI Tools</div>
                      <button
                        onClick={async () => {
                          setRecheckingTools(true);
                          try {
                            await typedInvoke(IPC.RECHECK_AI_TOOLS);
                            await refetchAITools();
                            toast.success('Install status refreshed');
                          } catch {
                            toast.error('Failed to check tools');
                          } finally {
                            setRecheckingTools(false);
                          }
                        }}
                        disabled={recheckingTools}
                        className="text-text-muted hover:text-text-primary transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1 text-xs"
                        title="Recheck install status for all tools"
                      >
                        <RefreshCw className={`w-3 h-3 ${recheckingTools ? 'animate-spin' : ''}`} />
                        Recheck
                      </button>
                    </div>
                    <div className="text-xs text-text-tertiary mb-3">
                      Click a tool to set it as active. All detected tools are shown below.
                    </div>

                    <div className="space-y-2">
                      {aiToolConfig && Object.values(aiToolConfig.availableTools).map((tool) => {
                        const isActive = aiToolConfig.activeTool.id === tool.id;
                        const isCustom = !BUILTIN_TOOL_IDS.has(tool.id);
                        const knownFlags = TOOL_FLAGS[tool.id] || [];
                        const flags = toolFlags[tool.id] || {};
                        const customArgs = toolCustomArgs[tool.id] || '';
                        const composed = composeToolCommand(tool.id, tool.command);
                        const hasDangerousFlag = knownFlags.some((f) => f.dangerous && flags[f.key]);

                        return (
                          <div
                            key={tool.id}
                            className={cn(
                              'rounded-lg border p-3 transition-colors',
                              isActive
                                ? 'border-accent/60 bg-accent/5'
                                : 'border-border-subtle bg-bg-secondary/50 hover:border-border-default',
                            )}
                          >
                            {/* Card header: click to activate */}
                            <button
                              className="w-full flex items-center gap-3 text-left cursor-pointer"
                              onClick={async () => {
                                if (isActive) return;
                                try {
                                  await setAITool.mutateAsync([tool.id]);
                                  toast.success(`Switched to ${tool.name}`);
                                } catch {
                                  toast.error('Failed to switch tool');
                                }
                              }}
                            >
                              {/* Availability dot */}
                              <span
                                className={cn(
                                  'inline-block w-2.5 h-2.5 rounded-full shrink-0 border',
                                  tool.installed === false
                                    ? 'bg-text-muted/40 border-text-muted/40'
                                    : 'bg-success border-success',
                                )}
                                title={tool.installed === false ? 'Not found on PATH' : 'Available'}
                              />

                              {/* Name + description */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-text-primary truncate">{tool.name}</span>
                                  {isActive && (
                                    <span className="text-[10px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded bg-accent/20 text-accent shrink-0">
                                      Active
                                    </span>
                                  )}
                                  {isCustom && (
                                    <span className="text-[10px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded bg-bg-tertiary text-text-tertiary shrink-0">
                                      Custom
                                    </span>
                                  )}
                                  {hasDangerousFlag && (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded bg-error/15 text-error shrink-0">
                                      <AlertTriangle className="w-2.5 h-2.5" />
                                      YOLO
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-text-tertiary truncate mt-0.5">
                                  {tool.installed === false
                                    ? <span className="text-error">
                                        Not installed
                                        {tool.installUrl && (
                                          <> — <a
                                            href="#"
                                            className="underline hover:text-accent"
                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); getTransport().platform.openExternal(tool.installUrl!); }}
                                          >install guide</a></>
                                        )}
                                      </span>
                                    : <span>{tool.description}</span>
                                  }
                                </div>
                              </div>

                              {/* Remove button for custom tools */}
                              {isCustom && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="cursor-pointer shrink-0 text-text-muted hover:text-red-400"
                                  title={`Remove ${tool.name}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeCustomTool.mutate([tool.id]);
                                    toast.success(`Removed ${tool.name}`);
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </button>

                            {/* Expanded details for active tool */}
                            {isActive && (
                              <div className="mt-3 pt-3 border-t border-border-subtle space-y-3">
                                {/* Start command display */}
                                <div data-setting-label="Start Command">
                                  <div className="text-xs text-text-tertiary mb-1.5">Start Command</div>
                                  {/* Base command (read-only) */}
                                  <div className="flex items-center gap-2 mb-2">
                                    <code className="flex-1 text-xs bg-bg-deep border border-border-subtle rounded px-2 py-1.5 text-text-secondary select-all">
                                      {tool.command}
                                    </code>
                                    <span className="text-[10px] text-text-muted shrink-0">base</span>
                                  </div>

                                  {/* Flag chips */}
                                  {knownFlags.length > 0 && (
                                    <div className="mb-2">
                                      <div className="text-[10px] text-text-muted mb-1">Flags</div>
                                      <div className="flex flex-wrap gap-1.5">
                                        {knownFlags.map((f) => {
                                          const isOn = flags[f.key] ?? false;
                                          return (
                                            <button
                                              key={f.key}
                                              onClick={() => {
                                                if (!isOn && f.dangerous) {
                                                  setPendingDangerousFlag({ toolId: tool.id, toolName: tool.name, flag: f });
                                                  return;
                                                }
                                                setToolFlagSelection(tool.id, f, !isOn);
                                              }}
                                              className={cn(
                                                'inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border transition-colors cursor-pointer',
                                                isOn
                                                  ? f.dangerous
                                                    ? 'bg-error/15 border-error/40 text-error'
                                                    : 'bg-accent/15 border-accent/40 text-accent'
                                                  : 'bg-bg-deep border-border-subtle text-text-muted hover:text-text-secondary hover:border-border-default',
                                              )}
                                              title={`${f.flag}${f.description ? ` — ${f.description}` : ''}`}
                                            >
                                              {f.dangerous && isOn && <AlertTriangle className="w-3 h-3" />}
                                              <code className="text-[11px]">{f.label}</code>
                                            </button>
                                          );
                                        })}
                                      </div>
                                      {hasDangerousFlag && (
                                        <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-warning">
                                          <AlertTriangle className="w-3 h-3 shrink-0" />
                                          Skips all permission prompts — use with caution
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Custom arguments input */}
                                  <div className="mb-2">
                                    <div className="text-[10px] text-text-muted mb-1">Custom arguments</div>
                                    <Input
                                      value={customArgs}
                                      onChange={(e) => {
                                        markToolDraftDirty(tool.id);
                                        setToolCustomArgs((prev) => ({ ...prev, [tool.id]: e.target.value }));
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      onMouseDown={(e) => e.stopPropagation()}
                                      onKeyDown={(e) => e.stopPropagation()}
                                      placeholder="e.g. --max-turns 15"
                                      className="bg-bg-deep border-border-subtle text-xs"
                                    />
                                  </div>

                                  {/* Composed command preview */}
                                  <div className="mb-2">
                                    <div className="text-[10px] text-text-muted mb-1">Resolved command</div>
                                    <code className="block text-xs bg-bg-deep border border-border-subtle rounded px-2 py-1.5 text-text-primary select-all break-all">
                                      {composed}
                                    </code>
                                  </div>

                                  {/* Save / Reset */}
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      onClick={() => saveToolCommand(tool.id, tool.command)}
                                      className="bg-accent text-bg-deep hover:bg-accent/80 cursor-pointer"
                                    >
                                      <Save className="w-3 h-3 mr-1" />
                                      Save
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        const resetFlags: Record<string, boolean> = {};
                                        for (const f of knownFlags) resetFlags[f.key] = false;
                                        setToolFlags((prev) => ({ ...prev, [tool.id]: resetFlags }));
                                        setToolCustomArgs((prev) => ({ ...prev, [tool.id]: '' }));
                                        updateSetting.mutate(
                                          [{ key: `aiTools.${tool.id}.customCommand`, value: '' }],
                                          {
                                            onSuccess: () => {
                                              clearToolDraftDirty(tool.id);
                                              toast.info('Reset to default command');
                                            },
                                            onError: () => toast.error('Failed to reset command'),
                                          }
                                        );
                                      }}
                                      className="cursor-pointer"
                                    >
                                      <RotateCcw className="w-3 h-3 mr-1" />
                                      Reset
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Custom Tools — add form */}
                {matchesSearch('Custom Tools') && (
                  <div className="border-t border-border-subtle pt-4 mt-4" data-setting-label="Custom Tools">
                    <div className="text-sm text-text-primary mb-2">Add Custom Tool</div>
                    <div className="text-xs text-text-tertiary mb-3">
                      Add custom AI tools that appear in the tool list, sidebar, and session dropdowns
                    </div>

                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Input
                          value={newToolName}
                          onChange={(e) => setNewToolName(e.target.value)}
                          placeholder="Name (e.g. Aider)"
                          className="bg-bg-deep border-border-subtle text-sm flex-1"
                        />
                        <Input
                          value={newToolCommand}
                          onChange={(e) => setNewToolCommand(e.target.value)}
                          placeholder="Command (e.g. aider)"
                          className="bg-bg-deep border-border-subtle text-sm flex-1"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={newToolDescription}
                          onChange={(e) => setNewToolDescription(e.target.value)}
                          placeholder="Description (optional)"
                          className="bg-bg-deep border-border-subtle text-sm flex-1"
                        />
                        <Button
                          size="sm"
                          className="bg-accent text-bg-deep hover:bg-accent/80 cursor-pointer shrink-0"
                          disabled={!newToolName.trim() || !newToolCommand.trim()}
                          onClick={() => {
                            const id = newToolName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
                            addCustomTool.mutate([{
                              id,
                              name: newToolName.trim(),
                              command: newToolCommand.trim(),
                              description: newToolDescription.trim() || undefined,
                            }]);
                            setNewToolName('');
                            setNewToolCommand('');
                            setNewToolDescription('');
                            toast.success(`Added ${newToolName.trim()}`);
                          }}
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" />
                          Add
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ===== Hooks ===== */}
            {activeTab === 'hooks' && (
              <>
                {/* Header */}
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <div className="text-sm text-text-primary font-medium">Claude Code Hooks</div>
                    <div className="text-xs text-text-tertiary">
                      Manage hook scripts that run on Claude Code events.
                      {totalHookCount > 0 && <span className="text-accent ml-1">{totalHookCount} hook{totalHookCount !== 1 ? 's' : ''} configured</span>}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="bg-accent text-bg-deep hover:bg-accent/80 cursor-pointer"
                    onClick={openAddHookDialog}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add Hook
                  </Button>
                </div>

                {!currentProjectPath && (
                  <div className="text-xs text-warning bg-warning/10 border border-warning/20 rounded-md p-3">
                    Select a project to manage hooks. Hooks are stored in each project's <code className="text-accent">.claude/settings.json</code>.
                  </div>
                )}

                {currentProjectPath && hooksLoading && (
                  <div className="flex items-center gap-2 py-8 justify-center text-text-muted">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Loading hooks...</span>
                  </div>
                )}

                {/* Event Type Groups */}
                {currentProjectPath && !hooksLoading && (
                  <div className="space-y-2">
                    {HOOK_EVENT_TYPES.map(({ key: eventKey, label, description, icon: EventIcon }) => {
                      const entries = hooksConfig[eventKey] || [];
                      const isExpanded = expandedEvents.has(eventKey);

                      return (
                        <div key={eventKey} className="rounded-lg border border-border-subtle bg-bg-secondary/50 overflow-hidden">
                          {/* Event header — collapsible */}
                          <button
                            onClick={() => toggleEventExpanded(eventKey)}
                            className="flex items-center gap-2.5 w-full text-left px-3 py-2 hover:bg-bg-hover/50 transition-colors cursor-pointer"
                          >
                            {isExpanded
                              ? <ChevronDown className="w-3.5 h-3.5 text-text-muted shrink-0" />
                              : <ChevronRight className="w-3.5 h-3.5 text-text-muted shrink-0" />
                            }
                            <EventIcon className="w-3.5 h-3.5 text-text-tertiary shrink-0" />
                            <span className="text-sm text-text-primary font-medium flex-1">{label}</span>
                            <span className="text-[10px] text-text-tertiary">{description}</span>
                            {entries.length > 0 && (
                              <span className="text-[10px] bg-accent/20 text-accent px-1.5 py-0.5 rounded-full ml-1">
                                {entries.length}
                              </span>
                            )}
                          </button>

                          {/* Expanded content */}
                          {isExpanded && (
                            <div className="border-t border-border-subtle">
                              {entries.length === 0 ? (
                                <div className="px-3 py-3 text-xs text-text-muted text-center">
                                  No hooks configured for this event
                                </div>
                              ) : (
                                <div className="divide-y divide-border-subtle">
                                  {entries.map((entry, entryIndex) => {
                                    const isDisabled = disabledHooks.has(`${eventKey}:${entryIndex}`);
                                    return (
                                      <div
                                        key={entryIndex}
                                        className={cn(
                                          'px-3 py-2 flex items-start gap-2.5 group',
                                          isDisabled && 'opacity-40',
                                        )}
                                      >
                                        {/* Matcher badge */}
                                        <div className="shrink-0 mt-0.5">
                                          <span className="inline-flex items-center text-[10px] font-mono bg-bg-deep border border-border-subtle text-text-secondary px-1.5 py-0.5 rounded">
                                            {entry.matcher || '*'}
                                          </span>
                                        </div>

                                        {/* Command(s) */}
                                        <div className="flex-1 min-w-0">
                                          {entry.hooks.map((hook, hookIdx) => (
                                            <div key={hookIdx} className="text-xs text-text-primary font-mono truncate" title={hook.command}>
                                              {hook.command}
                                            </div>
                                          ))}
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                          {/* Edit */}
                                          <button
                                            onClick={() => openEditHookDialog(eventKey, entryIndex)}
                                            className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer"
                                            title="Edit hook"
                                          >
                                            <Pencil className="w-3 h-3" />
                                          </button>
                                          {/* Delete */}
                                          <button
                                            onClick={() => {
                                              if (confirm('Delete this hook entry?')) {
                                                deleteHookEntry(eventKey, entryIndex);
                                              }
                                            }}
                                            className="p-1 rounded text-text-muted hover:text-red-400 hover:bg-bg-hover transition-colors cursor-pointer"
                                            title="Delete hook"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Quick add for this event type */}
                              <div className="px-3 py-1.5 border-t border-border-subtle">
                                <button
                                  onClick={() => {
                                    resetHookForm();
                                    setHookFormEvent(eventKey);
                                    setShowAddHookDialog(true);
                                  }}
                                  className="text-[11px] text-text-muted hover:text-accent transition-colors cursor-pointer"
                                >
                                  + Add hook to {label}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Quick Templates */}
                {currentProjectPath && !hooksLoading && (matchesSearch('Templates') || matchesSearch('Block .env writes') || matchesSearch('Log all commands') || matchesSearch('Auto-approve reads') || matchesSearch('Notify on completion')) && (
                  <div className="mt-4">
                    <div className="text-[10px] uppercase tracking-wider text-text-tertiary font-medium mb-1.5">Quick Templates</div>
                    <div className="grid grid-cols-2 gap-2">
                      {HOOK_TEMPLATES.map((template) => (
                        <button
                          key={template.name}
                          onClick={() => applyTemplate(template)}
                          className="text-left rounded-md border border-border-subtle bg-bg-secondary/30 p-3 hover:bg-bg-hover/30 cursor-pointer transition-colors group"
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            <FileCode className="w-3 h-3 text-text-tertiary group-hover:text-accent transition-colors" />
                            <span className="text-xs text-text-primary font-medium">{template.name}</span>
                          </div>
                          <div className="text-[10px] text-text-tertiary">{template.description}</div>
                          <div className="flex items-center gap-1 mt-1.5">
                            <span className="text-[9px] font-mono bg-bg-deep border border-border-subtle px-1 py-0.5 rounded text-text-muted">
                              {template.eventType}
                            </span>
                            {template.matcher && (
                              <span className="text-[9px] font-mono bg-bg-deep border border-border-subtle px-1 py-0.5 rounded text-text-muted">
                                {template.matcher}
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reload button */}
                {currentProjectPath && !hooksLoading && (
                  <div className="flex items-center gap-2 mt-3">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs cursor-pointer"
                      onClick={loadHooks}
                    >
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                      Reload from disk
                    </Button>
                    <span className="text-[10px] text-text-muted">
                      {claudeSettingsPath && <>Source: <code className="text-text-tertiary">.claude/settings.json</code></>}
                    </span>
                  </div>
                )}

                {/* ===== Add/Edit Hook Dialog ===== */}
                {showAddHookDialog && (
                  <Dialog open={showAddHookDialog} onOpenChange={(open) => { if (!open) { setShowAddHookDialog(false); resetHookForm(); } }}>
                    <DialogContent className="bg-bg-primary border-border-subtle text-text-primary sm:max-w-[520px] p-0" aria-describedby={undefined}>
                      <DialogHeader className="px-5 pt-5 pb-0">
                        <DialogTitle>{editingHook ? 'Edit Hook' : 'Add Hook'}</DialogTitle>
                      </DialogHeader>

                      <div className="px-5 pb-5 space-y-4 mt-2">
                        {/* Event Type */}
                        <div>
                          <div className="text-sm text-text-primary mb-1">Event Type</div>
                          <select
                            value={hookFormEvent}
                            onChange={(e) => setHookFormEvent(e.target.value)}
                            disabled={!!editingHook}
                            className="w-full bg-bg-deep border border-border-subtle rounded px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 cursor-pointer disabled:opacity-50"
                          >
                            {HOOK_EVENT_TYPES.map(({ key, label: lbl }) => (
                              <option key={key} value={key}>{lbl} ({key})</option>
                            ))}
                          </select>
                        </div>

                        {/* Matcher */}
                        <div>
                          <div className="text-sm text-text-primary mb-1">Matcher</div>
                          <div className="text-xs text-text-tertiary mb-1">
                            Tool name pattern to match (e.g., "Bash", "Write", "*" for all). Leave empty for events without tools.
                          </div>
                          <Input
                            value={hookFormMatcher}
                            onChange={(e) => setHookFormMatcher(e.target.value)}
                            placeholder={hookFormEvent === 'PreToolUse' || hookFormEvent === 'PostToolUse' ? 'e.g., Bash, Write, *' : 'Leave empty'}
                            className="bg-bg-deep border-border-subtle text-sm"
                          />
                          {/* Matcher suggestions */}
                          {(MATCHER_SUGGESTIONS[hookFormEvent] || []).length > 0 && (
                            <div className="flex gap-1 mt-1.5 flex-wrap">
                              {MATCHER_SUGGESTIONS[hookFormEvent].filter(Boolean).map((s) => (
                                <button
                                  key={s}
                                  onClick={() => setHookFormMatcher(s)}
                                  className={cn(
                                    'text-[10px] font-mono px-1.5 py-0.5 rounded border cursor-pointer transition-colors',
                                    hookFormMatcher === s
                                      ? 'bg-accent/20 border-accent/40 text-accent'
                                      : 'bg-bg-deep border-border-subtle text-text-muted hover:text-text-secondary hover:border-border-default',
                                  )}
                                >
                                  {s}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Command */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <div className="text-sm text-text-primary">Command</div>
                            <button
                              onClick={() => setShowAIGenerate(!showAIGenerate)}
                              className="flex items-center gap-1 text-[11px] text-accent hover:text-accent/80 transition-colors cursor-pointer"
                            >
                              <Wand2 className="w-3 h-3" />
                              {showAIGenerate ? 'Manual' : 'Generate with AI'}
                            </button>
                          </div>

                          {!showAIGenerate ? (
                            <>
                              <Input
                                value={hookFormCommand}
                                onChange={(e) => setHookFormCommand(e.target.value)}
                                placeholder="node .claude/hooks/my-hook.js"
                                className="bg-bg-deep border-border-subtle text-sm font-mono"
                              />
                              <div className="text-[10px] text-text-muted mt-1">
                                Point to a .js file that will be executed when this event fires.
                                Hook receives JSON on stdin with tool_name, tool_input, etc.
                              </div>
                            </>
                          ) : (
                            <>
                              <textarea
                                value={aiGeneratePrompt}
                                onChange={(e) => setAiGeneratePrompt(e.target.value)}
                                placeholder="Describe what you want the hook to do..."
                                rows={3}
                                className="w-full bg-bg-deep border border-border-subtle rounded px-2 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none"
                              />
                              <div className="text-[10px] text-text-muted mt-1 space-y-0.5">
                                <div>Examples:</div>
                                <div className="text-text-tertiary">"Block writes to .env files"</div>
                                <div className="text-text-tertiary">"Log all Bash commands to a file"</div>
                                <div className="text-text-tertiary">"Auto-approve read-only tools"</div>
                              </div>
                              <Button
                                size="sm"
                                className="mt-2 bg-accent text-bg-deep hover:bg-accent/80 cursor-pointer"
                                disabled={!aiGeneratePrompt.trim() || !activeTerminalId}
                                onClick={handleAIGenerate}
                              >
                                <Wand2 className="h-3.5 w-3.5 mr-1" />
                                Send to Agent
                              </Button>
                              {!activeTerminalId && (
                                <div className="text-[10px] text-warning mt-1">No active terminal. Open a terminal first.</div>
                              )}
                            </>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-2 border-t border-border-subtle">
                          {!showAIGenerate && (
                            <Button
                              size="sm"
                              className="bg-accent text-bg-deep hover:bg-accent/80 cursor-pointer"
                              disabled={!hookFormCommand.trim()}
                              onClick={handleHookFormSubmit}
                            >
                              {editingHook ? 'Update Hook' : 'Add Hook'}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="cursor-pointer"
                            onClick={() => { setShowAddHookDialog(false); resetHookForm(); }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </>
            )}

            {/* ===== Integrations ===== */}
            {activeTab === 'integrations' && (
              <>
                {matchesSearch('Local API Server') && (
                  <SettingGroup label="Local API Server">
                    <SettingToggle
                      label="Enable API Server"
                      description="Expose terminal state via localhost HTTP for external tools (Conjure, scripts, etc.)"
                      value={(settings?.integrations as Record<string, unknown>)?.apiServer !== false}
                      onChange={(v) => updateSetting.mutate([{ key: 'integrations.apiServer', value: v }])}
                    />
                    <SettingToggle
                      label="DTSP Registration"
                      description="Register as a Desktop Text Source Protocol source for auto-discovery by external tools"
                      value={(settings?.integrations as Record<string, unknown>)?.dtsp !== false}
                      onChange={(v) => updateSetting.mutate([{ key: 'integrations.dtsp', value: v }])}
                    />
                    <div className="text-[10px] text-text-tertiary mt-1 px-1">
                      API: <span className="font-mono">~/.subframe/api.json</span>
                      {' · '}
                      DTSP: <span className="font-mono">~/.dtsp/sources/subframe.json</span>
                    </div>
                  </SettingGroup>
                )}

                {matchesSearch('SubFrame Server') && (
                  <SettingGroup label="SubFrame Server">
                    <SettingToggle
                      label="Run SubFrame Server"
                      description="Start or stop the remote web UI for this SubFrame session"
                      value={webServerInfo?.enabled === true}
                      onChange={(v) => {
                        typedInvoke(IPC.WEB_SERVER_TOGGLE, v)
                          .then(() => {
                            refetchWebServerInfo();
                            toast.success(v ? 'SubFrame Server started' : 'SubFrame Server stopped');
                          })
                          .catch(() => {});
                      }}
                    />

                    <SettingToggle
                      label="Start Server on Launch"
                      description="Automatically start SubFrame Server whenever SubFrame opens"
                      value={(settings?.server as Record<string, unknown>)?.startOnLaunch === true}
                      onChange={(v) => {
                        typedInvoke(IPC.UPDATE_SETTING, { key: 'server.startOnLaunch', value: v })
                          .then(() => toast.success(v ? 'Server will start on launch' : 'Server launch auto-start disabled'))
                          .catch(() => toast.error('Failed to update launch behavior'));
                      }}
                    />

                    <SettingInput
                      label="Preferred Port"
                      description="Use a fixed port for bookmarks and integrations. Leave blank or enter 0 for auto; auto mode reuses the last successful port when it is still available."
                      type="number"
                      min={0}
                      max={65535}
                      step={1}
                      value={webServerPortInput}
                      onChange={setWebServerPortInput}
                      placeholder={configuredWebServerPort > 0 ? undefined : (effectiveWebServerPort ? String(effectiveWebServerPort) : 'Auto')}
                      extra={
                        <Button
                          size="sm"
                          variant="outline"
                          className="cursor-pointer shrink-0"
                          onClick={applyWebServerPort}
                        >
                          Apply
                        </Button>
                      }
                    />
                    <div className="text-[10px] text-text-muted px-1 -mt-1">
                      Mode: {configuredWebServerPort > 0 ? `Fixed port ${configuredWebServerPort}` : 'Auto reuse'}
                      {effectiveWebServerPort ? ` · Current port ${effectiveWebServerPort}` : ''}
                    </div>

                    <SettingToggle
                      label="Remote Cursor Tracking"
                      description="Show remote mouse or touch activity on the host desktop while a web client is controlling this SubFrame instance"
                      value={(settings?.server as Record<string, unknown>)?.showRemoteCursor === true}
                      onChange={(v) => {
                        typedInvoke(IPC.UPDATE_SETTING, { key: 'server.showRemoteCursor', value: v })
                          .then(() => {
                            toast.success(v ? 'Remote cursor tracking enabled' : 'Remote cursor tracking disabled');
                          })
                          .catch(() => toast.error('Failed to update remote cursor tracking'));
                      }}
                    />

                    {/* Server status — shown when enabled */}
                    {webServerInfo?.enabled && (
                      <>
                        <SettingToggle
                          label="Allow LAN access"
                          description="Bind SubFrame Server to your local network so phones and tablets on the same Wi-Fi can connect directly"
                          value={webServerInfo.lanMode}
                          onChange={(v) => {
                            typedInvoke(IPC.UPDATE_SETTING, { key: 'server.lanMode', value: v })
                              .then(() => {
                                refetchWebServerInfo();
                                toast.success(v ? 'LAN access enabled' : 'LAN access disabled');
                              })
                              .catch(() => toast.error('Failed to update LAN access'));
                          }}
                          extra={webServerInfo.lanMode ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 font-medium">
                              Trusted networks only
                            </span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 font-medium">
                              SSH recommended
                            </span>
                          )}
                        />

                        {webServerInfo.lanMode ? (
                          <div className="rounded-lg border border-amber-500/25 bg-amber-500/7 p-3 space-y-2">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                              <div className="text-xs text-amber-200/80">
                                LAN mode exposes SubFrame Server to every device on this network. Use it only on trusted home or office Wi-Fi, and disable it when you are done.
                              </div>
                            </div>
                            {webServerInfo.lanIp ? (
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-amber-200/70">
                                  <Wifi className="w-3 h-3" />
                                  <span>Android / Mobile Access</span>
                                </div>
                                <div className="text-xs text-text-secondary">
                                  Open <span className="font-mono">http://{webServerInfo.lanIp}:{webServerInfo.port}</span> on the same Wi-Fi, or scan the QR code below. No SSH app is required on Android.
                                </div>
                                {webServerInfo.lanIps.length > 1 && (
                                  <div className="text-[10px] text-text-muted">
                                    Other detected addresses: {webServerInfo.lanIps.filter((ip) => ip !== webServerInfo.lanIp).join(', ')}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-xs text-text-muted">
                                No LAN IP detected yet. Connect this machine to Wi-Fi or Ethernet to enable direct mobile access.
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="rounded-lg border border-border-subtle bg-bg-deep p-3">
                            <div className="flex items-start gap-2">
                              <Shield className="w-3.5 h-3.5 text-green-400 shrink-0 mt-0.5" />
                              <div className="text-xs text-text-tertiary">
                                SSH tunnel mode keeps the server bound to localhost. Use this for the safest remote access path or whenever you are not on a trusted network.
                              </div>
                            </div>
                          </div>
                        )}

                        {webServerInfo.lastStartError && (
                          <div className="rounded-lg border border-red-500/25 bg-red-500/7 p-3 space-y-1.5">
                            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-red-200/80">
                              <AlertTriangle className="w-3.5 h-3.5 text-red-300" />
                              <span>Server Start Failed</span>
                            </div>
                            <div className="text-xs text-red-100/85">
                              {webServerInfo.lastStartError}
                            </div>
                            {configuredWebServerPort > 0 && (
                              <div className="text-[10px] text-red-100/65">
                                Choose a different fixed port, or clear Preferred Port to let SubFrame reuse the last open port automatically.
                              </div>
                            )}
                          </div>
                        )}

                        <div className="bg-bg-deep rounded-lg p-2.5 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <div className={cn('w-2 h-2 rounded-full', webServerRunning ? 'bg-green-500 animate-pulse' : 'bg-amber-400')} />
                            <span className="text-xs text-text-secondary">
                              {webServerRunning ? 'Server running' : 'Waiting for port'}
                            </span>
                            <span className="text-[10px] text-text-muted ml-auto font-mono">
                              {webServerRunning ? `port ${webServerInfo.port}` : configuredWebServerPort > 0 ? `fixed ${configuredWebServerPort}` : 'auto'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-text-muted">
                            {webServerInfo.lanMode ? (
                              <>
                                <Smartphone className="w-3 h-3 text-blue-400" />
                                <span>Access: LAN</span>
                                {webServerInfo.lanIp && <span className="font-mono">{webServerInfo.lanIp}</span>}
                              </>
                            ) : (
                              <>
                                <Shield className="w-3 h-3 text-green-400" />
                                <span>Access: SSH tunnel / localhost only</span>
                                <span className="font-mono">remote :8080</span>
                              </>
                            )}
                          </div>

                          {webServerBaseUrl && (
                            <div className="pt-1 border-t border-border-subtle space-y-1.5">
                              <div className="flex items-center gap-2 text-[10px] text-text-muted uppercase tracking-wider">
                                <Globe className="w-3 h-3" />
                                <span>{webServerInfo.lanMode ? 'Base URL' : 'Remote Base URL (After SSH Tunnel)'}</span>
                              </div>
                              <div className="flex items-start gap-2">
                                <code className="flex-1 text-[10px] font-mono text-text-secondary bg-bg-primary rounded px-2 py-1.5 break-all select-all">
                                  {webServerBaseUrl}
                                </code>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="shrink-0 h-7 px-2 cursor-pointer"
                                  onClick={() => {
                                    navigator.clipboard.writeText(webServerBaseUrl)
                                      .then(() => toast.success('Base URL copied'))
                                      .catch(() => toast.error('Failed to copy base URL'));
                                  }}
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                              <div className="text-[10px] text-text-muted">
                                {webServerInfo.lanMode
                                  ? 'Open this base URL on another device, then pair with a code or paste a token directly in the browser.'
                                  : 'Open this URL on the remote machine after the SSH tunnel is active. It points at the tunnel endpoint on that remote device, not the host machine\'s private server port.'}
                              </div>
                            </div>
                          )}

                          {webServerConnectionUrl && (
                            <div className="pt-1 border-t border-border-subtle space-y-1.5">
                              <div className="flex items-center gap-2 text-[10px] text-text-muted uppercase tracking-wider">
                                <Globe className="w-3 h-3" />
                                <span>{webServerInfo.lanMode ? 'Connection URL' : 'Remote Connection URL (Token Included)'}</span>
                              </div>
                              <div className="flex items-start gap-2">
                                <code className="flex-1 text-[10px] font-mono text-text-secondary bg-bg-primary rounded px-2 py-1.5 break-all select-all">
                                  {webServerConnectionUrl}
                                </code>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="shrink-0 h-7 px-2 cursor-pointer"
                                  onClick={() => {
                                    navigator.clipboard.writeText(webServerConnectionUrl)
                                      .then(() => toast.success('Connection URL copied'))
                                      .catch(() => toast.error('Failed to copy connection URL'));
                                  }}
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                              <div className="text-[10px] text-text-muted">
                                {webServerInfo.lanMode
                                  ? 'Open this exact URL on the connecting device. It includes the current auth token.'
                                  : 'Open this exact URL on the remote machine after the tunnel is active. It already includes the current auth token.'}
                              </div>
                            </div>
                          )}

                          {/* Connected client indicator */}
                          {webServerInfo.clientConnected && webServerInfo.clientInfo ? (
                            <div className="flex items-center gap-2 pt-1 border-t border-border-subtle">
                              <Monitor className="w-3.5 h-3.5 text-accent shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="text-xs text-text-secondary truncate">
                                  {webServerInfo.clientInfo.userAgent.split(' ').slice(0, 3).join(' ')}
                                </div>
                                <div className="text-[10px] text-text-muted">
                                  Connected {new Date(webServerInfo.clientInfo.connectedAt).toLocaleTimeString()}
                                </div>
                                {webServerInfo.sessionContext && (
                                  <div className="text-[10px] text-text-muted truncate">
                                    Mirroring {webServerInfo.sessionContext.workspaceName}
                                    {webServerInfo.sessionContext.projectName ? ` / ${webServerInfo.sessionContext.projectName}` : ''}
                                  </div>
                                )}
                              </div>
                              <Wifi className="w-3 h-3 text-green-500 shrink-0" />
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 pt-1 border-t border-border-subtle">
                              <div className="min-w-0">
                                <div className="text-[10px] text-text-muted">No client connected</div>
                                {webServerInfo.sessionContext && (
                                  <div className="text-[10px] text-text-muted truncate">
                                    Ready to mirror {webServerInfo.sessionContext.workspaceName}
                                    {webServerInfo.sessionContext.projectName ? ` / ${webServerInfo.sessionContext.projectName}` : ''}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="cursor-pointer text-xs"
                            onClick={() => setWebServerSetupOpen(true)}
                          >
                            <Globe className="w-3 h-3 mr-1.5" />
                            Setup Guide
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="cursor-pointer text-xs"
                            onClick={() => {
                              typedInvoke(IPC.WEB_SERVER_REGEN_TOKEN)
                                .then(() => {
                                  refetchWebServerInfo();
                                  toast.success('Auth token regenerated');
                                })
                                .catch(() => toast.error('Failed to regenerate token'));
                            }}
                          >
                            <RefreshCw className="w-3 h-3 mr-1.5" />
                            Regenerate Token
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="cursor-pointer text-xs"
                            onClick={async () => {
                              try {
                                const code = webServerPairingCode
                                  ?? (await typedInvoke(IPC.WEB_SERVER_GENERATE_PAIRING)).code;
                                setWebServerPairingCode(code);

                                const copied = await copyTextToClipboard(code);
                                if (copied) {
                                  toast.success(`Pairing code copied: ${code}`, { duration: 10000 });
                                } else {
                                  toast.success(`Pairing code ready: ${code}`, { duration: 10000 });
                                  toast.error('Clipboard access failed. Copy the code manually from the button label.');
                                }
                              } catch {
                                toast.error('Failed to generate pairing code');
                              }
                            }}
                          >
                            <Copy className="w-3 h-3 mr-1.5" />
                            {webServerPairingCode ? `Copy Code: ${webServerPairingCode}` : 'Generate + Copy Code'}
                          </Button>
                          {webServerInfo.lanMode ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="cursor-pointer text-xs"
                              onClick={() => setWebServerQrVisible((v) => !v)}
                            >
                              <QrCode className="w-3 h-3 mr-1.5" />
                              {webServerQrVisible ? 'Hide QR Code' : 'Show QR Code'}
                            </Button>
                          ) : null}
                        </div>

                        {/* Inline QR Code */}
                        {webServerQrVisible && webServerQrDataUrl && (
                          <div className="flex flex-col items-center gap-1.5 py-2">
                            <img src={webServerQrDataUrl} alt="QR Code for connection URL" className="rounded-lg" style={{ width: 150, height: 150 }} />
                            {webServerInfo.lanMode && (
                              <div className="text-[10px] text-text-muted">
                                Scan from Android/iPhone on the same Wi-Fi
                              </div>
                            )}
                          </div>
                        )}
                        {!webServerInfo.lanMode && (
                          <div className="text-[10px] text-text-muted">
                            QR code sharing is available in LAN mode. In SSH mode, copy the remote base URL or tokenized remote connection URL instead.
                          </div>
                        )}
                      </>
                    )}

                    {/* Setup guide button when server is not enabled */}
                    {!webServerInfo?.enabled && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="cursor-pointer text-xs"
                        onClick={() => setWebServerSetupOpen(true)}
                      >
                        <Globe className="w-3 h-3 mr-1.5" />
                        Setup Guide
                      </Button>
                    )}
                  </SettingGroup>
                )}

                {/* Shell Integration (Experimental) */}
                {(matchesSearch('Shell Integration') || matchesSearch('CLI Status') || matchesSearch('Context Menu') || matchesSearch('Explorer')) && (
                  <SettingGroup label="Shell Integration">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-warning/15 text-warning border border-warning/30">
                        Experimental
                      </span>
                    </div>
                    <p className="text-xs text-text-tertiary mb-3">
                      Integrate SubFrame with your operating system for quick access from file explorers and terminal.
                    </p>

                    {/* CLI Status */}
                    <div className="p-3 rounded-md border border-border-subtle bg-bg-secondary/30">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-medium text-text-primary">CLI Tool</span>
                          <p className="text-[10px] text-text-muted mt-0.5">
                            {cliStatus?.installed
                              ? cliStatus.inPath
                                ? `Installed at ${cliStatus.path}`
                                : 'Installed but not in PATH'
                              : 'Not installed'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {cliStatus?.installed && !cliStatus.inPath && (
                            <span className="text-[9px] text-warning px-1.5 py-0.5 rounded bg-warning/10 border border-warning/20">PATH issue</span>
                          )}
                          <div className={`w-2 h-2 rounded-full ${cliStatus?.installed ? (cliStatus.inPath ? 'bg-success' : 'bg-warning') : 'bg-text-muted'}`} />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleInstallCli}
                          disabled={cliInstalling || cliUninstalling}
                          className="h-7 px-3 text-xs cursor-pointer"
                        >
                          {cliInstalling && <RefreshCw className="w-3 h-3 mr-1.5 animate-spin" />}
                          Install
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleUninstallCli}
                          disabled={cliInstalling || cliUninstalling}
                          className="h-7 px-2 text-xs text-error hover:text-error cursor-pointer"
                        >
                          {cliUninstalling && <RefreshCw className="w-3 h-3 mr-1.5 animate-spin" />}
                          Remove
                        </Button>
                      </div>
                    </div>

                    {/* Windows Context Menu */}
                    {process.platform === 'win32' && (
                      <div className="flex items-center justify-between p-3 rounded-md border border-border-subtle bg-bg-secondary/30 mt-2">
                        <div>
                          <span className="text-xs font-medium text-text-primary">Explorer Context Menu</span>
                          <p className="text-[10px] text-text-muted mt-0.5">
                            Add &quot;Open with SubFrame&quot; to right-click menu in Windows Explorer
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {contextMenuInstalled && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={async () => {
                                try {
                                  const r = await typedInvoke(IPC.UNINSTALL_CONTEXT_MENU);
                                  if (r.success) { toast.success('Context menu removed'); checkContextMenu(); }
                                  else toast.error(r.message);
                                } catch { toast.error('Failed to remove context menu'); }
                              }}
                              className="h-7 px-2 text-xs text-error hover:text-error cursor-pointer"
                            >
                              Remove
                            </Button>
                          )}
                          <Button
                            size="sm"
                            onClick={async () => {
                              try {
                                const r = await typedInvoke(IPC.INSTALL_CONTEXT_MENU);
                                if (r.success) { toast.success('Context menu registered'); checkContextMenu(); }
                                else toast.error(r.message);
                              } catch { toast.error('Failed to register context menu'); }
                            }}
                            className="h-7 px-3 text-xs bg-accent text-bg-deep hover:bg-accent/80 cursor-pointer"
                          >
                            {contextMenuInstalled ? 'Reinstall' : 'Install'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </SettingGroup>
                )}
              </>
            )}

            {/* ===== Updates ===== */}
            {activeTab === 'updates' && (
              <>
                <div className="text-xs text-text-tertiary">
                  Current version: <code className="text-text-secondary">v{APP_VERSION}</code>
                </div>

                {(matchesSearch('Auto-check for updates') || matchesSearch('Pre-release Channel') || matchesSearch('Check Interval') || matchesSearch('Update Preferences')) && (
                  <SettingGroup label="Update Preferences">
                    {matchesSearch('Auto-check for updates') && (
                      <SettingToggle
                        label="Auto-check for updates"
                        description="Automatically check for new versions in the background"
                        value={autoCheck}
                        onChange={setAutoCheck}
                      />
                    )}
                    {matchesSearch('Pre-release Channel') && (
                      <SettingSelect
                        label="Pre-release Channel"
                        description="Auto detects based on your current version"
                        value={allowPrerelease}
                        onChange={setAllowPrerelease}
                        options={[
                          { value: 'auto', label: 'Auto' },
                          { value: 'always', label: 'Always' },
                          { value: 'never', label: 'Never' },
                        ]}
                      />
                    )}
                    {matchesSearch('Check Interval') && (
                      <SettingInput
                        label="Check Interval (hours)"
                        value={checkIntervalHours}
                        onChange={(v) => setCheckIntervalHours(Number(v))}
                        type="number"
                        min={1}
                        max={24}
                      />
                    )}
                  </SettingGroup>
                )}

                <div className="flex gap-2">
                  <Button size="sm" onClick={saveUpdater} className="bg-accent text-bg-deep hover:bg-accent/80 cursor-pointer">
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="cursor-pointer"
                    onClick={() => {
                      // Fire and forget — UpdateNotification handles all toast feedback
                      typedInvoke(IPC.UPDATER_CHECK).catch(() => {});
                    }}
                  >
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    Check Now
                  </Button>
                </div>

                {/* Update status & actions */}
                {updater.status !== 'idle' && updater.status !== 'not-available' && (
                  <SettingGroup label="Update Status">
                    <div className="flex items-center justify-between">
                      <div className="text-xs">
                        {updater.status === 'checking' && (
                          <span className="text-text-secondary">Checking for updates...</span>
                        )}
                        {updater.status === 'available' && (
                          <span className="text-accent">v{updater.version ?? '?'} available</span>
                        )}
                        {updater.status === 'downloading' && (
                          <span className="text-info">
                            Downloading... {updater.progress ? `${Math.round(updater.progress.percent)}%` : ''}
                          </span>
                        )}
                        {updater.status === 'downloaded' && (
                          <span className="text-success">v{updater.version ?? '?'} ready to install</span>
                        )}
                        {updater.status === 'error' && (
                          <span className="text-error">{updater.error ?? 'Update failed'}</span>
                        )}
                      </div>
                      <div className="flex gap-1.5">
                        {(updater.status === 'available' || updater.status === 'error') && (
                          <Button
                            size="sm"
                            className="bg-accent text-bg-deep hover:bg-accent/80 cursor-pointer"
                            disabled={updater.downloadUpdate.isPending}
                            onClick={() => updater.downloadUpdate.mutate([])}
                          >
                            <Download className="h-3 w-3 mr-1" />
                            {updater.downloadUpdate.isPending ? 'Starting...' : 'Download'}
                          </Button>
                        )}
                        {updater.status === 'downloading' && !updater.progress && (
                          <span className="text-xs text-text-secondary animate-pulse">Connecting...</span>
                        )}
                        {updater.status === 'downloaded' && (
                          <Button
                            size="sm"
                            className="bg-success text-bg-deep hover:bg-success/80 cursor-pointer"
                            onClick={() => updater.installUpdate.mutate([])}
                          >
                            Restart &amp; Install
                          </Button>
                        )}
                      </div>
                    </div>
                    {updater.status === 'downloading' && updater.progress && (
                      <div className="w-full h-1.5 rounded-full bg-bg-deep overflow-hidden mt-2">
                        <div
                          className="h-full rounded-full bg-info transition-all duration-300"
                          style={{ width: `${Math.round(updater.progress.percent)}%` }}
                        />
                      </div>
                    )}
                  </SettingGroup>
                )}
              </>
            )}

            {/* ===== Project ===== */}
            {activeTab === 'project' && (
              <ProjectUninstallSection projectPath={currentProjectPath} />
            )}

            {/* ===== About ===== */}
            {activeTab === 'about' && (
              <>
                {/* App identity */}
                <div className="flex flex-col items-center text-center py-4">
                  <div className="text-lg font-bold text-text-primary">SubFrame</div>
                  <div className="text-xs text-text-tertiary mt-0.5">Terminal-first IDE for AI coding tools</div>
                  <div className="flex items-center gap-2 mt-2.5">
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-bg-tertiary text-accent px-2 py-0.5 rounded-full">
                      v{APP_VERSION}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-bg-tertiary text-text-secondary px-2 py-0.5 rounded-full">
                      <Scale className="w-2.5 h-2.5" />
                      MIT
                    </span>
                  </div>
                </div>

                {/* Links group */}
                <SettingGroup label="Links">
                  <button
                    className="flex items-center gap-3 w-full text-left px-2 py-2 rounded-md hover:bg-bg-hover transition-colors cursor-pointer"
                    onClick={() => getTransport().platform.openExternal('https://github.com/Codename-11/SubFrame')}
                  >
                    <Github className="w-4 h-4 text-text-tertiary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-text-primary">GitHub</div>
                      <div className="text-xs text-text-tertiary">View source code and documentation</div>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-text-muted shrink-0" />
                  </button>

                  <button
                    className="flex items-center gap-3 w-full text-left px-2 py-2 rounded-md hover:bg-bg-hover transition-colors cursor-pointer"
                    onClick={() => getTransport().platform.openExternal('https://github.com/Codename-11/SubFrame/issues')}
                  >
                    <Info className="w-4 h-4 text-text-tertiary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-text-primary">Report Issue</div>
                      <div className="text-xs text-text-tertiary">File a bug report or feature request</div>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-text-muted shrink-0" />
                  </button>

                  <button
                    className="flex items-center gap-3 w-full text-left px-2 py-2 rounded-md hover:bg-bg-hover transition-colors cursor-pointer"
                    onClick={() => {
                      setSettingsOpen(false);
                      setTimeout(() => window.dispatchEvent(new Event('open-whats-new')), 200);
                    }}
                  >
                    <Sparkles className="w-4 h-4 text-text-tertiary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-text-primary">What&apos;s New</div>
                      <div className="text-xs text-text-tertiary">View release notes for the current version</div>
                    </div>
                  </button>
                </SettingGroup>

                {/* Changelog */}
                <SettingGroup label="Changelog">
                  <button
                    className="flex items-center gap-3 w-full text-left px-2 py-2 rounded-md hover:bg-bg-hover transition-colors cursor-pointer"
                    onClick={() => getTransport().platform.openExternal('https://github.com/Codename-11/SubFrame/blob/main/CHANGELOG.md')}
                  >
                    <FileText className="w-4 h-4 text-text-tertiary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-text-primary">View Changelog</div>
                      <div className="text-xs text-text-tertiary">Full history of changes and releases</div>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-text-muted shrink-0" />
                  </button>
                </SettingGroup>
              </>
            )}

            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <AlertDialog open={!!pendingDangerousFlag} onOpenChange={(open) => { if (!open) setPendingDangerousFlag(null); }}>
      <AlertDialogContent className="bg-bg-primary border-border-subtle text-text-primary" size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-sm">Enable {pendingDangerousFlag?.flag.label}?</AlertDialogTitle>
          <AlertDialogDescription className="text-xs text-text-secondary">
            {pendingDangerousFlag?.toolName} will start with{' '}
            <code className="text-[11px] text-warning">{pendingDangerousFlag?.flag.flag}</code>.
            {' '}This reduces or bypasses normal safety checks, so it should only be used in a trusted sandbox.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel variant="ghost" size="sm" className="cursor-pointer">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            variant="default"
            size="sm"
            className="bg-error hover:bg-error/80 cursor-pointer text-white"
            onClick={() => {
              if (!pendingDangerousFlag) return;
              setToolFlagSelection(pendingDangerousFlag.toolId, pendingDangerousFlag.flag, true);
              setPendingDangerousFlag(null);
            }}
          >
            Enable
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* SubFrame Server setup wizard */}
    <WebServerSetup open={webServerSetupOpen} onOpenChange={setWebServerSetupOpen} />
    </>
  );
}
