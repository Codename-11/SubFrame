/**
 * SystemPanel — App-level settings hub for SubFrame, AI tools, and integrations.
 * Sidebar-nav layout inspired by Cursor's settings: categorical grouping with
 * clear system-vs-project separation (system/global only here).
 */

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Cpu, Download, RefreshCw, Loader2, CheckCircle,
  Terminal, Keyboard, BookMarked, Globe, Copy, Zap,
  ChevronDown, RotateCw, Info, Link2,
  FileText, Settings2, Check, X, Plus, ExternalLink, AlertTriangle,
  Bot, Shield, Bell, Play, Wrench, Save, RotateCcw, Trash2,
} from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from './ui/dialog';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { useUpdater } from '../hooks/useUpdater';
import { useSettings, useAIToolConfig } from '../hooks/useSettings';
import { useSubFrameHealth } from '../hooks/useSubFrameHealth';
import { usePrompts } from '../hooks/usePrompts';
import { useIpcQuery, useIpcMutation } from '../hooks/useIpc';
import { typedSend, typedInvoke } from '../lib/ipc';
import { getTransport } from '../lib/transportProvider';
import { useUIStore } from '../stores/useUIStore';
import { useProjectStore } from '../stores/useProjectStore';
import { IPC } from '../../shared/ipcChannels';
import { getLogoSVG } from '../../shared/logoSVG';

const FRAME_VERSION: string = require('../../../package.json').version;

// ─── Constants ──────────────────────────────────────────────────────────────

const BUILTIN_TOOL_IDS = new Set(['claude', 'codex', 'gemini']);

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

const HOOK_EVENT_META: Record<string, { label: string; icon: typeof Shield }> = {
  PreToolUse: { label: 'Pre Tool Use', icon: Shield },
  PostToolUse: { label: 'Post Tool Use', icon: Check },
  preToolUse: { label: 'Pre Tool Use', icon: Shield },
  postToolUse: { label: 'Post Tool Use', icon: Check },
  Notification: { label: 'Notification', icon: Bell },
  notification: { label: 'Notification', icon: Bell },
  Stop: { label: 'Stop', icon: Play },
  stop: { label: 'Stop', icon: Play },
  UserPromptSubmit: { label: 'Prompt Submit', icon: FileText },
  beforeSubmitPrompt: { label: 'Prompt Submit', icon: FileText },
  SessionStart: { label: 'Session Start', icon: Zap },
  sessionStart: { label: 'Session Start', icon: Zap },
  SessionEnd: { label: 'Session End', icon: Zap },
  sessionEnd: { label: 'Session End', icon: Zap },
};

// ─── Nav definition ─────────────────────────────────────────────────────────

type NavSection = 'general' | 'agents' | 'configuration' | 'hooks' | 'api-server' | 'dtsp';
type QuickLink = 'health' | 'shortcuts' | 'prompts';

interface NavItem {
  key: NavSection;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'SubFrame',
    items: [
      { key: 'general', label: 'General', icon: Cpu },
    ],
  },
  {
    label: 'AI Tools',
    items: [
      { key: 'agents', label: 'Agents', icon: Bot },
      { key: 'configuration', label: 'Configuration', icon: Settings2 },
      { key: 'hooks', label: 'Hooks', icon: Wrench },
    ],
  },
  {
    label: 'Integrations',
    items: [
      { key: 'api-server', label: 'API Server', icon: Globe },
      { key: 'dtsp', label: 'DTSP', icon: Link2 },
    ],
  },
];

const QUICK_LINKS: { key: QuickLink; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { key: 'health', label: 'Health', icon: Cpu },
  { key: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
  { key: 'prompts', label: 'Prompts', icon: BookMarked },
];

// ─── Main Component ─────────────────────────────────────────────────────────

export function SystemPanel({ isFullView = false }: { isFullView?: boolean }) {
  const [activeSection, setActiveSection] = useState<NavSection>('general');
  const setFullViewContent = useUIStore((s) => s.setFullViewContent);
  const setActivePanel = useUIStore((s) => s.setActivePanel);
  const { prompts, globalPrompts } = usePrompts();
  const totalPrompts = (globalPrompts?.length ?? 0) + (prompts?.length ?? 0);
  const { health } = useSubFrameHealth();

  const handleQuickLink = (key: QuickLink) => {
    if (key === 'health') setActivePanel('subframeHealth');
    else if (key === 'shortcuts') setFullViewContent('shortcuts');
    else if (key === 'prompts') window.dispatchEvent(new CustomEvent('open-prompt-library'));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header — hidden in full-view mode */}
      {!isFullView && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle shrink-0">
          <div className="text-xs font-medium text-text-primary">System</div>
        </div>
      )}

      {/* Sidebar + Content */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar Nav */}
        <div className="w-[160px] shrink-0 border-r border-border-subtle bg-bg-deep/30 flex flex-col">
          <ScrollArea className="flex-1 min-h-0">
            <div className="py-2 px-1.5 space-y-3">
              {NAV_GROUPS.map((group) => (
                <div key={group.label}>
                  <div className="text-[9px] font-semibold text-text-muted uppercase tracking-wider px-2 mb-1">
                    {group.label}
                  </div>
                  {group.items.map((item) => (
                    <button
                      key={item.key}
                      onClick={() => setActiveSection(item.key)}
                      className={cn(
                        'w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-[11px] transition-colors cursor-pointer',
                        activeSection === item.key
                          ? 'bg-accent/10 text-accent'
                          : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
                      )}
                    >
                      <item.icon size={13} className="shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Quick Links at bottom */}
          <div className="border-t border-border-subtle py-2 px-1.5 space-y-0.5 shrink-0">
            <div className="text-[9px] font-semibold text-text-muted uppercase tracking-wider px-2 mb-1">
              Quick Access
            </div>
            {QUICK_LINKS.map((link) => (
              <button
                key={link.key}
                onClick={() => handleQuickLink(link.key)}
                className="w-full flex items-center gap-2 px-2 py-1 rounded text-left text-[11px] text-text-tertiary hover:bg-bg-hover hover:text-text-secondary transition-colors cursor-pointer"
              >
                <link.icon size={12} className="shrink-0" />
                <span className="flex-1">{link.label}</span>
                {link.key === 'health' && health && (
                  <span className={cn('text-[9px]', health.missing > 0 ? 'text-error' : 'text-success')}>
                    {health.healthy}/{health.total}
                  </span>
                )}
                {link.key === 'prompts' && totalPrompts > 0 && (
                  <span className="text-[9px] text-text-muted">{totalPrompts}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <ScrollArea className="flex-1 min-h-0">
          <div className={cn('p-4 max-w-2xl', isFullView && 'max-w-3xl')}>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSection}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
              >
                {activeSection === 'general' && <GeneralSection />}
                {activeSection === 'agents' && <AgentsSection />}
                {activeSection === 'configuration' && <ConfigurationSection />}
                {activeSection === 'hooks' && <HooksSection />}
                {activeSection === 'api-server' && <APIServerSection />}
                {activeSection === 'dtsp' && <DTSPSection />}
              </motion.div>
            </AnimatePresence>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

// ─── Section Header ─────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, description }: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-0.5">
        <Icon size={16} className="text-accent" />
        <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
      </div>
      {description && (
        <p className="text-[11px] text-text-tertiary ml-6">{description}</p>
      )}
    </div>
  );
}

// ─── General Section ────────────────────────────────────────────────────────

function GeneralSection() {
  const { status, version: updateVersion, error, progress, checkForUpdates, downloadUpdate, installUpdate } = useUpdater();

  return (
    <div>
      <SectionHeader icon={Cpu} title="General" description="SubFrame version and updates" />

      {/* Version hero */}
      <div className="rounded-lg border border-border-subtle bg-bg-deep/50 p-4 relative overflow-hidden">
        <div
          className="absolute pointer-events-none"
          style={{
            top: '-30px', left: '50%', transform: 'translateX(-50%)',
            width: 240, height: 240, opacity: 0.06,
            background: 'radial-gradient(circle, #ff6eb4, #b480ff 40%, transparent 70%)',
          }}
        />

        <div className="flex items-center gap-4 relative">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            dangerouslySetInnerHTML={{ __html: getLogoSVG({ size: 56, id: 'system-logo', frame: false }) }}
            className="shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span
                className="text-lg font-bold"
                style={{
                  background: 'linear-gradient(135deg, #b480ff, #ff6eb4, #64d8ff)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                SubFrame
              </span>
              <span className="text-xs text-text-tertiary font-mono">v{FRAME_VERSION}</span>
            </div>
            <div className="text-[11px] text-text-tertiary mt-0.5">Terminal-centric IDE for AI coding tools</div>
          </div>
        </div>

        {/* Update status */}
        <div className="mt-3 pt-3 border-t border-border-subtle flex items-center justify-between relative">
          <UpdateStatusLine
            status={status}
            updateVersion={updateVersion}
            error={error}
            progress={progress}
            onDownload={() => downloadUpdate.mutate([])}
            onInstall={() => installUpdate.mutate([])}
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => checkForUpdates.mutate([])}
            className="h-6 px-2 cursor-pointer shrink-0"
            disabled={status === 'checking'}
          >
            {status === 'checking' ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <RefreshCw size={12} />
            )}
            <span className="text-[10px] ml-1">Check</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

function UpdateStatusLine({
  status, updateVersion, error, progress, onDownload, onInstall,
}: {
  status: string;
  updateVersion?: string;
  error?: string;
  progress?: { percent?: number };
  onDownload: () => void;
  onInstall: () => void;
}) {
  if (status === 'checking') {
    return (
      <div className="flex items-center gap-2 text-[11px] text-text-secondary">
        <Loader2 size={12} className="animate-spin text-text-muted" />
        <span>Checking for updates...</span>
      </div>
    );
  }
  if (status === 'available') {
    return (
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
        <span className="text-[11px] text-text-secondary">v{updateVersion} available</span>
        <Button size="sm" variant="ghost" onClick={onDownload} className="h-6 px-2 cursor-pointer text-[10px]">
          <Download size={12} className="mr-1" />Download
        </Button>
      </div>
    );
  }
  if (status === 'downloading') {
    const pct = Math.round(progress?.percent ?? 0);
    return (
      <div className="flex-1 mr-3">
        <div className="flex items-center justify-between text-[11px] text-text-secondary mb-1">
          <span>Downloading...</span><span>{pct}%</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-bg-hover">
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  }
  if (status === 'downloaded') {
    return (
      <div className="flex items-center gap-2">
        <CheckCircle size={12} className="text-emerald-400" />
        <span className="text-[11px] text-text-secondary">Ready to install</span>
        <Button size="sm" variant="ghost" onClick={onInstall} className="h-6 px-2 cursor-pointer text-[10px]">Restart Now</Button>
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div className="flex items-center gap-2 text-[11px]">
        <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
        <span className="text-red-400 truncate">{error || 'Update error'}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
      <span className="text-text-secondary">Up to date</span>
    </div>
  );
}

// ─── Agents Section ─────────────────────────────────────────────────────────

function AgentsSection() {
  const { config, isLoading, setAITool, refetch: refetchAITools, addCustomTool, removeCustomTool } = useAIToolConfig();
  const { settings, updateSetting } = useSettings();
  const [recheckingTools, setRecheckingTools] = useState(false);
  const [pendingDangerousFlag, setPendingDangerousFlag] = useState<{ toolId: string; toolName: string; flag: ToolFlag } | null>(null);

  // Tool flags + custom args state (synced from saved settings)
  const [toolFlags, setToolFlags] = useState<Record<string, Record<string, boolean>>>({});
  const [toolCustomArgs, setToolCustomArgs] = useState<Record<string, string>>({});
  const [dirtyToolDrafts, setDirtyToolDrafts] = useState<Record<string, boolean>>({});

  // Custom tool form
  const [newToolName, setNewToolName] = useState('');
  const [newToolCommand, setNewToolCommand] = useState('');
  const [newToolDescription, setNewToolDescription] = useState('');

  // Sync flags from settings
  useEffect(() => {
    if (!settings || !config) return;
    const aiTools = (settings as Record<string, unknown>).aiTools as Record<string, Record<string, unknown>> || {};
    const newFlags: Record<string, Record<string, boolean>> = {};
    const newArgs: Record<string, string> = {};

    for (const tool of Object.values(config.availableTools)) {
      const toolSettings = aiTools[tool.id] || {};
      const customCmd = (toolSettings.customCommand as string) || '';
      const knownFlags = TOOL_FLAGS[tool.id] || [];
      const parsedFlags: Record<string, boolean> = {};
      let remaining = customCmd;

      for (const f of knownFlags) {
        if (remaining.includes(f.flag)) {
          parsedFlags[f.key] = true;
          remaining = remaining.replace(f.flag, '').trim();
        } else {
          parsedFlags[f.key] = false;
        }
      }
      // Strip the base command prefix from remaining
      remaining = remaining.replace(new RegExp(`^${tool.command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`), '').trim();
      newFlags[tool.id] = parsedFlags;
      newArgs[tool.id] = remaining;
    }
    setToolFlags(newFlags);
    setToolCustomArgs(newArgs);
  }, [settings, config]);

  function markDirty(toolId: string) {
    setDirtyToolDrafts((prev) => (prev[toolId] ? prev : { ...prev, [toolId]: true }));
  }

  function setFlagSelection(toolId: string, flag: ToolFlag, nextValue: boolean) {
    markDirty(toolId);
    setToolFlags((prev) => {
      const next = { ...(prev[toolId] || {}) };
      if (flag.group && nextValue) {
        for (const sibling of TOOL_FLAGS[toolId] || []) {
          if (sibling.group === flag.group) next[sibling.key] = false;
        }
      }
      next[flag.key] = nextValue;
      return { ...prev, [toolId]: next };
    });
  }

  function composeCommand(toolId: string, baseCommand: string): string {
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

  function saveCommand(toolId: string, baseCommand: string) {
    const composed = composeCommand(toolId, baseCommand);
    const value = composed === baseCommand ? '' : composed;
    updateSetting.mutate(
      [{ key: `aiTools.${toolId}.customCommand`, value }],
      {
        onSuccess: () => {
          setDirtyToolDrafts((prev) => ({ ...prev, [toolId]: false }));
          toast.success('Command saved');
        },
        onError: () => toast.error('Failed to save'),
      },
    );
  }

  const handleRecheck = async () => {
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
  };

  return (
    <div>
      <SectionHeader icon={Bot} title="Agents" description="Manage AI coding tools — selection, commands, and flags" />

      {/* Recheck button */}
      <div className="flex justify-end mb-2">
        <button
          onClick={handleRecheck}
          disabled={recheckingTools}
          className="text-text-muted hover:text-text-primary transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1 text-[11px]"
        >
          <RefreshCw className={cn('w-3 h-3', recheckingTools && 'animate-spin')} />
          Recheck installs
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={16} className="animate-spin text-text-muted" />
        </div>
      ) : config ? (
        <div className="space-y-2">
          {Object.values(config.availableTools).map((tool) => {
            const isActive = config.activeTool.id === tool.id;
            const isCustom = !BUILTIN_TOOL_IDS.has(tool.id);
            const knownFlags = TOOL_FLAGS[tool.id] || [];
            const flags = toolFlags[tool.id] || {};
            const customArgs = toolCustomArgs[tool.id] || '';
            const composed = composeCommand(tool.id, tool.command);
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
                {/* Header: click to activate */}
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
                  <span
                    className={cn(
                      'inline-block w-2.5 h-2.5 rounded-full shrink-0 border',
                      tool.installed === false
                        ? 'bg-text-muted/40 border-text-muted/40'
                        : 'bg-success border-success',
                    )}
                  />
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

                  {isCustom && (
                    <Button
                      size="sm" variant="ghost"
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
                    {/* Base command */}
                    <div>
                      <div className="text-[11px] text-text-tertiary mb-1">Start Command</div>
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
                                    setFlagSelection(tool.id, f, !isOn);
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

                      {/* Custom args */}
                      <div className="mb-2">
                        <div className="text-[10px] text-text-muted mb-1">Custom arguments</div>
                        <Input
                          value={customArgs}
                          onChange={(e) => { markDirty(tool.id); setToolCustomArgs((prev) => ({ ...prev, [tool.id]: e.target.value })); }}
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                          placeholder="e.g. --max-turns 15"
                          className="bg-bg-deep border-border-subtle text-xs"
                        />
                      </div>

                      {/* Resolved command */}
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
                          onClick={() => saveCommand(tool.id, tool.command)}
                          className="bg-accent text-bg-deep hover:bg-accent/80 cursor-pointer"
                        >
                          <Save className="w-3 h-3 mr-1" />Save
                        </Button>
                        <Button
                          size="sm" variant="ghost"
                          onClick={() => {
                            const resetFlags: Record<string, boolean> = {};
                            for (const f of knownFlags) resetFlags[f.key] = false;
                            setToolFlags((prev) => ({ ...prev, [tool.id]: resetFlags }));
                            setToolCustomArgs((prev) => ({ ...prev, [tool.id]: '' }));
                            updateSetting.mutate(
                              [{ key: `aiTools.${tool.id}.customCommand`, value: '' }],
                              {
                                onSuccess: () => {
                                  setDirtyToolDrafts((prev) => ({ ...prev, [tool.id]: false }));
                                  toast.info('Reset to default command');
                                },
                                onError: () => toast.error('Failed to reset command'),
                              },
                            );
                          }}
                          className="cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3 mr-1" />Reset
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Add Custom Tool */}
          <div className="mt-4 pt-4 border-t border-border-subtle">
            <div className="text-xs text-text-primary font-medium mb-1">Add Custom Tool</div>
            <div className="text-[11px] text-text-tertiary mb-2">
              Custom AI tools appear in the tool list, sidebar, and session dropdowns
            </div>
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input value={newToolName} onChange={(e) => setNewToolName(e.target.value)} placeholder="Name (e.g. Aider)" className="bg-bg-deep border-border-subtle text-xs flex-1" />
                <Input value={newToolCommand} onChange={(e) => setNewToolCommand(e.target.value)} placeholder="Command (e.g. aider)" className="bg-bg-deep border-border-subtle text-xs flex-1" />
              </div>
              <div className="flex gap-2">
                <Input value={newToolDescription} onChange={(e) => setNewToolDescription(e.target.value)} placeholder="Description (optional)" className="bg-bg-deep border-border-subtle text-xs flex-1" />
                <Button
                  size="sm"
                  className="bg-accent text-bg-deep hover:bg-accent/80 cursor-pointer shrink-0"
                  disabled={!newToolName.trim() || !newToolCommand.trim()}
                  onClick={() => {
                    const id = newToolName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
                    addCustomTool.mutate([{ id, name: newToolName.trim(), command: newToolCommand.trim(), description: newToolDescription.trim() || undefined }]);
                    setNewToolName(''); setNewToolCommand(''); setNewToolDescription('');
                    toast.success(`Added ${newToolName.trim()}`);
                  }}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />Add
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Dangerous flag confirmation dialog */}
      <Dialog open={!!pendingDangerousFlag} onOpenChange={() => setPendingDangerousFlag(null)}>
        <DialogContent className="bg-bg-primary border-border-subtle text-text-primary sm:max-w-sm" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm text-error">
              <AlertTriangle size={16} />Enable {pendingDangerousFlag?.flag.label}?
            </DialogTitle>
            <DialogDescription className="text-text-secondary text-xs">
              This will skip all permission prompts for <strong>{pendingDangerousFlag?.toolName}</strong>. The agent can execute any command without confirmation.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-2">
            <Button size="sm" variant="ghost" onClick={() => setPendingDangerousFlag(null)} className="cursor-pointer">Cancel</Button>
            <Button
              size="sm"
              className="bg-error text-white hover:bg-error/80 cursor-pointer"
              onClick={() => {
                if (!pendingDangerousFlag) return;
                setFlagSelection(pendingDangerousFlag.toolId, pendingDangerousFlag.flag, true);
                setPendingDangerousFlag(null);
              }}
            >
              Enable
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Configuration Section ──────────────────────────────────────────────────

function ConfigurationSection() {
  const setEditorFilePath = useUIStore((s) => s.setEditorFilePath);

  const { data: configStatus, refetch, isLoading } = useIpcQuery(
    IPC.GET_CLAUDE_CONFIG_STATUS,
    [null], // null = global only, no project
    { staleTime: 10000 },
  );

  const openFile = (filePath: string) => setEditorFilePath(filePath);

  const createFile = (filePath: string, isSettings: boolean) => {
    const basename = filePath.split(/[/\\]/).pop() || '';
    let content: string;
    if (isSettings) content = JSON.stringify({}, null, 2) + '\n';
    else if (basename === 'GEMINI.md') content = '# GEMINI.md\n\n## Instructions\n\n';
    else if (basename === 'AGENTS.md') content = '# AGENTS.md\n\n## Instructions\n\n';
    else if (basename === 'instructions.md') content = '# Codex Instructions\n\n';
    else content = '# CLAUDE.md\n\n## Instructions\n\n';
    typedSend(IPC.WRITE_FILE, { filePath, content });
    setTimeout(() => { setEditorFilePath(filePath); refetch(); }, 300);
  };

  interface FileStatus { exists: boolean; path: string; size?: number; warnings?: string[] }

  const cs = configStatus as {
    global: { claudeMd: FileStatus; settings: FileStatus };
    project: null; // always null since we pass null projectPath
    gemini?: { global: { settings: FileStatus }; project: null };
    codex?: { global: { instructions: FileStatus }; project: null };
  } | undefined;

  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({ claude: true });
  const toggleTool = (tool: string) => setExpandedTools((prev) => ({ ...prev, [tool]: !prev[tool] }));

  function countFiles(files: FileStatus[]): { found: number; total: number; warnings: number } {
    let found = 0; let warnings = 0;
    for (const f of files) {
      if (f.exists) found++;
      if (f.warnings?.length) warnings += f.warnings.length;
    }
    return { found, total: files.length, warnings };
  }

  const toolSections = cs ? [
    {
      id: 'claude', label: 'Claude Code',
      files: [
        ...(cs.global ? [
          { icon: FileText, label: '~/.claude/CLAUDE.md', status: cs.global.claudeMd, isSettings: false },
          { icon: Settings2, label: '~/.claude/settings.json', status: cs.global.settings, isSettings: true },
        ] : []),
      ],
    },
    {
      id: 'gemini', label: 'Gemini CLI',
      files: [
        ...(cs.gemini?.global ? [
          { icon: Settings2, label: '~/.gemini/settings.json', status: cs.gemini.global.settings, isSettings: true },
        ] : []),
      ],
    },
    {
      id: 'codex', label: 'Codex CLI',
      files: [
        ...(cs.codex?.global ? [
          { icon: FileText, label: '~/.codex/instructions.md', status: cs.codex.global.instructions, isSettings: false },
        ] : []),
      ],
    },
  ] : [];

  return (
    <div>
      <SectionHeader icon={Settings2} title="Configuration" description="Global config files for each AI tool (system-level)" />

      <div className="flex justify-end mb-2">
        <Button size="sm" variant="ghost" onClick={() => refetch()} className="h-6 px-2 cursor-pointer" disabled={isLoading}>
          {isLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          <span className="text-[10px] ml-1">Refresh</span>
        </Button>
      </div>

      {isLoading && !cs ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={16} className="animate-spin text-text-muted" />
        </div>
      ) : cs ? (
        <div className="space-y-1.5">
          {toolSections.map((tool) => {
            if (tool.files.length === 0) return null;
            const expanded = !!expandedTools[tool.id];
            const stats = countFiles(tool.files.map((f) => f.status));
            return (
              <div key={tool.id} className="rounded-lg border border-border-subtle bg-bg-secondary/30">
                <button
                  onClick={() => toggleTool(tool.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left cursor-pointer hover:bg-bg-hover/30 transition-colors rounded-lg"
                >
                  <ChevronDown size={10} className={cn('text-text-muted transition-transform shrink-0', !expanded && '-rotate-90')} />
                  <span className="text-xs font-medium text-text-primary flex-1">{tool.label}</span>
                  <span className="text-[10px] text-text-muted">{stats.found}/{stats.total} found</span>
                  {stats.warnings > 0 && (
                    <span className="flex items-center gap-0.5 text-[10px] text-warning">
                      <AlertTriangle size={9} />{stats.warnings}
                    </span>
                  )}
                </button>
                {expanded && (
                  <div className="px-2 pb-2 space-y-0.5">
                    {tool.files.map((f) => (
                      <ConfigFileRow
                        key={f.status.path}
                        icon={f.icon}
                        label={f.label}
                        filePath={f.status.path}
                        exists={f.status.exists}
                        warnings={f.status.warnings}
                        onOpen={() => openFile(f.status.path)}
                        onCreate={() => createFile(f.status.path, f.isSettings)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <div className="text-[10px] text-text-tertiary italic mt-2 px-1">
            Project-level config files are accessible when a project is loaded
          </div>
        </div>
      ) : (
        <div className="text-xs text-text-tertiary">Unable to load config status</div>
      )}
    </div>
  );
}

function ConfigFileRow({
  icon: Icon, label, filePath, exists, warnings, onOpen, onCreate,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  filePath: string;
  exists: boolean;
  warnings?: string[];
  onOpen: () => void;
  onCreate: () => void;
}) {
  const hasWarnings = warnings && warnings.length > 0;
  return (
    <div className="py-1.5 px-2 rounded hover:bg-bg-hover/50 transition-colors group">
      <div className="flex items-center gap-2">
        <Icon size={13} className={cn('shrink-0', hasWarnings ? 'text-warning' : 'text-text-muted')} />
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[11px] font-medium text-text-secondary truncate">{label}</span>
          <span className="text-[10px] text-text-tertiary truncate">{filePath}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {exists ? (
            <>
              <span className={cn('flex items-center gap-1 text-[10px]', hasWarnings ? 'text-warning' : 'text-emerald-400')}>
                {hasWarnings ? <AlertTriangle size={10} /> : <Check size={10} />}
                <span>{hasWarnings ? `${warnings.length} warning${warnings.length > 1 ? 's' : ''}` : 'OK'}</span>
              </span>
              <Button
                size="sm" variant="ghost" onClick={onOpen}
                className="h-5 px-1.5 text-[10px] cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ExternalLink size={10} className="mr-0.5" />Open
              </Button>
            </>
          ) : (
            <>
              <span className="flex items-center gap-1 text-[10px] text-text-muted">
                <X size={10} /><span>Not found</span>
              </span>
              <Button
                size="sm" variant="ghost" onClick={onCreate}
                className="h-5 px-1.5 text-[10px] cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Plus size={10} className="mr-0.5" />Create
              </Button>
            </>
          )}
        </div>
      </div>
      {hasWarnings && (
        <div className="ml-5 mt-0.5 space-y-0.5">
          {warnings.map((w, i) => (
            <div key={i} className="flex items-center gap-1 text-[9px] text-warning">
              <span className="shrink-0">•</span>
              <span className="truncate">{w}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Hooks Section ──────────────────────────────────────────────────────────

function HooksSection() {
  const { data: globalHooks, isLoading, refetch } = useIpcQuery(IPC.GET_GLOBAL_HOOKS, [], { staleTime: 15000 });
  const setEditorFilePath = useUIStore((s) => s.setEditorFilePath);

  const hookEntries = useMemo(() => {
    if (!globalHooks?.hooks) return [];
    const entries: { event: string; matcher?: string; command: string; source: string }[] = [];
    for (const [event, eventEntries] of Object.entries(globalHooks.hooks)) {
      if (!Array.isArray(eventEntries)) continue;
      for (const entry of eventEntries) {
        const matcher = (entry as { matcher?: string }).matcher;
        const cmds = (entry as { hooks?: Array<{ command?: string }> }).hooks || [];
        for (const cmd of cmds) {
          if (cmd.command) {
            entries.push({
              event,
              matcher: matcher || undefined,
              command: cmd.command,
              source: globalHooks.sources[cmd.command] || 'user config',
            });
          }
        }
      }
    }
    return entries;
  }, [globalHooks]);

  // Group by event
  const groupedByEvent = useMemo(() => {
    const groups: Record<string, typeof hookEntries> = {};
    for (const entry of hookEntries) {
      if (!groups[entry.event]) groups[entry.event] = [];
      groups[entry.event].push(entry);
    }
    return groups;
  }, [hookEntries]);

  const totalHooks = hookEntries.length;
  const eventCount = Object.keys(groupedByEvent).length;

  return (
    <div>
      <SectionHeader icon={Wrench} title="Hooks" description="Custom scripts that run during agent execution (global config)" />

      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] text-text-tertiary">
          {totalHooks > 0 ? `${totalHooks} hook${totalHooks !== 1 ? 's' : ''} across ${eventCount} event${eventCount !== 1 ? 's' : ''}` : 'No hooks configured'}
        </div>
        <div className="flex items-center gap-2">
          {globalHooks?.settingsPath && (
            <Button
              size="sm" variant="ghost"
              onClick={() => setEditorFilePath(globalHooks.settingsPath)}
              className="h-6 px-2 cursor-pointer text-[10px]"
            >
              <ExternalLink size={11} className="mr-1" />Edit config
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => refetch()} className="h-6 px-2 cursor-pointer" disabled={isLoading}>
            {isLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            <span className="text-[10px] ml-1">Reload</span>
          </Button>
        </div>
      </div>

      {isLoading && !globalHooks ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={16} className="animate-spin text-text-muted" />
        </div>
      ) : totalHooks === 0 ? (
        <div className="rounded-lg border border-border-subtle bg-bg-secondary/30 p-4 text-center">
          <Wrench size={24} className="mx-auto text-text-muted mb-2 opacity-40" />
          <div className="text-xs text-text-tertiary mb-1">No global hooks configured</div>
          <div className="text-[10px] text-text-muted">
            Hooks let you run scripts at specific points during agent execution.
            {globalHooks?.settingsPath && (
              <> Edit{' '}
                <button
                  onClick={() => setEditorFilePath(globalHooks.settingsPath)}
                  className="text-accent hover:underline cursor-pointer"
                >
                  ~/.claude/settings.json
                </button>
                {' '}to add hooks.
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(groupedByEvent).map(([event, entries]) => {
            const meta = HOOK_EVENT_META[event];
            const EventIcon = meta?.icon || Zap;
            const eventLabel = meta?.label || event;

            return (
              <div key={event} className="rounded-lg border border-border-subtle bg-bg-secondary/30">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-border-subtle">
                  <EventIcon size={13} className="text-accent shrink-0" />
                  <span className="text-xs font-semibold text-text-primary">{eventLabel}</span>
                  <span className="text-[10px] text-text-muted ml-auto">{entries.length} hook{entries.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="divide-y divide-border-subtle">
                  {entries.map((entry, i) => (
                    <div key={i} className="px-3 py-2">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] text-text-muted italic">{entry.source}:</span>
                        {entry.matcher && (
                          <span className="text-[10px] font-mono text-accent bg-accent/10 px-1 rounded">{entry.matcher}</span>
                        )}
                      </div>
                      <code className="block text-[11px] text-text-secondary font-mono break-all leading-relaxed">
                        {entry.command}
                      </code>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── API Server Section ─────────────────────────────────────────────────────

function APIServerSection() {
  const { data: serverInfo, isLoading, refetch: refetchServerInfo } = useIpcQuery(IPC.API_SERVER_INFO, [], {
    refetchInterval: 5000, staleTime: 4000,
  });
  const toggleServer = useIpcMutation(IPC.API_SERVER_TOGGLE, {
    onSuccess: () => { refetchServerInfo(); },
  });
  const regenToken = useIpcMutation(IPC.API_SERVER_REGEN_TOKEN, {
    onSuccess: () => { refetchServerInfo(); toast.success('Token regenerated'); },
  });
  const [showInfo, setShowInfo] = useState(false);

  const enabled = serverInfo?.enabled ?? false;
  const port = serverInfo?.port ?? 0;
  const token = serverInfo?.token ?? '';
  const isRunning = enabled && port > 0;
  const maskedToken = token.length > 8 ? token.slice(0, 8) + '...' : token;

  const copyToken = () => { if (token) { navigator.clipboard.writeText(token); toast.success('Token copied'); } };
  const copyConfig = () => {
    navigator.clipboard.writeText(JSON.stringify({ enabled, port, token }, null, 2));
    toast.success('Config copied');
  };

  const endpoints = [
    { path: '/api/health', desc: 'Server status (public)' },
    { path: '/api/selection', desc: 'Active terminal selection' },
    { path: '/api/context', desc: 'Terminal name, project, agent status' },
    { path: '/api/terminals', desc: 'List all terminals' },
    { path: '/api/buffer', desc: 'Visible terminal buffer' },
    { path: 'POST /api/tts', desc: 'Submit TTS text from hooks' },
    { path: '/api/tts/latest', desc: 'Most recent TTS message' },
    { path: '/api/events', desc: 'SSE stream (incl. tts-speak)' },
  ];

  return (
    <div>
      <SectionHeader icon={Globe} title="API Server" description="Expose terminal state to external tools via localhost HTTP" />

      {/* Controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {/* Toggle */}
          <button
            onClick={() => toggleServer.mutate([!enabled])}
            disabled={toggleServer.isPending}
            className={cn(
              'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              enabled ? 'bg-accent' : 'bg-bg-hover border border-border-default',
            )}
          >
            <span className={cn('inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform', enabled ? 'translate-x-[18px]' : 'translate-x-[3px]')} />
          </button>
          <div className="flex items-center gap-2">
            <span className="relative shrink-0">
              <span className={cn('block w-2 h-2 rounded-full', isRunning ? 'bg-emerald-400' : 'bg-red-400')} />
              {isRunning && <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-40" />}
            </span>
            <span className="text-xs text-text-secondary">{isRunning ? 'Running' : 'Stopped'}</span>
            {isRunning && <span className="text-[11px] font-mono text-text-tertiary">:{port}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setShowInfo(true)} className="text-text-muted hover:text-text-secondary transition-colors cursor-pointer p-0.5" title="About">
            <Info size={13} />
          </button>
          <Button size="sm" variant="ghost" onClick={copyConfig} className="h-6 px-2 cursor-pointer">
            <Copy size={12} /><span className="text-[10px] ml-1">Copy</span>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={16} className="animate-spin text-text-muted" />
        </div>
      ) : (
        <>
          {/* Token */}
          {token && (
            <div className="rounded-lg border border-border-subtle bg-bg-secondary/30 p-3 mb-3">
              <div className="text-[10px] text-text-muted mb-1">Auth Token</div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-text-secondary flex-1">{maskedToken}</span>
                <button onClick={copyToken} className="text-text-muted hover:text-text-secondary transition-colors cursor-pointer" title="Copy">
                  <Copy size={11} />
                </button>
                <button
                  onClick={() => regenToken.mutate([])}
                  disabled={regenToken.isPending}
                  className="text-text-muted hover:text-text-secondary transition-colors cursor-pointer disabled:opacity-50"
                  title="Regenerate"
                >
                  <RotateCw size={11} className={cn(regenToken.isPending && 'animate-spin')} />
                </button>
              </div>
            </div>
          )}

          {/* Endpoints */}
          <div className="rounded-lg border border-border-subtle bg-bg-secondary/30 p-3 mb-3">
            <div className="text-[10px] text-text-muted mb-2">Endpoints</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {endpoints.map((ep) => (
                <div key={ep.path}>
                  <span className="font-mono text-[11px] text-accent">{ep.path}</span>
                  <div className="text-[10px] text-text-tertiary">{ep.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Usage stats */}
          {isRunning && (
            <div className="flex items-center gap-4 text-[11px] text-text-tertiary">
              <span>{serverInfo?.connectedClients ?? 0} {(serverInfo?.connectedClients ?? 0) === 1 ? 'client' : 'clients'}</span>
              <span>{serverInfo?.totalRequests ?? 0} requests</span>
              {(serverInfo?.ttsMessageCount ?? 0) > 0 && (
                <span className="text-accent">{serverInfo?.ttsMessageCount} TTS</span>
              )}
            </div>
          )}
          {isRunning && serverInfo?.lastTtsMessage && (
            <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-text-muted">
              <span className="text-accent">Last TTS:</span>
              <span className="truncate flex-1">{serverInfo.lastTtsMessage.text}</span>
              <span className="shrink-0 text-text-tertiary">
                {(() => {
                  const diff = Date.now() - new Date(serverInfo.lastTtsMessage.timestamp).getTime();
                  const mins = Math.floor(diff / 60000);
                  return mins < 1 ? 'just now' : mins < 60 ? `${mins}m ago` : `${Math.floor(mins / 60)}h ago`;
                })()}
              </span>
            </div>
          )}
        </>
      )}

      {/* Info dialog */}
      <Dialog open={showInfo} onOpenChange={setShowInfo}>
        <DialogContent className="bg-bg-primary border-border-subtle text-text-primary sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Globe size={16} className="text-accent" />Local API Server
            </DialogTitle>
            <DialogDescription className="text-text-secondary text-xs">
              Exposes terminal selection, buffer, and context via localhost HTTP for external tools.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-[11px] text-text-secondary">
            <div>
              <div className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1">Authentication</div>
              <p>Bearer token (auto-generated). Pass via <span className="font-mono text-[10px]">Authorization: Bearer {'<token>'}</span> header or <span className="font-mono text-[10px]">?token=</span> query parameter. Health endpoint is public.</p>
            </div>
            <div>
              <div className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1">Discovery</div>
              <div className="font-mono text-[10px] text-text-tertiary">~/.subframe/api.json</div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── DTSP Section ───────────────────────────────────────────────────────────

function DTSPSection() {
  const { data: serverInfo, refetch: refetchServerInfo } = useIpcQuery(IPC.API_SERVER_INFO, [], {
    refetchInterval: 5000, staleTime: 4000,
  });
  const { updateSetting } = useSettings();
  const [showInfo, setShowInfo] = useState(false);

  const dtspOn = serverInfo?.dtspEnabled ?? true;
  const serverRunning = (serverInfo?.enabled ?? false) && (serverInfo?.port ?? 0) > 0;
  const isRegistered = dtspOn && serverRunning;

  const handleToggle = () => {
    updateSetting.mutate([{ key: 'integrations.dtsp', value: !dtspOn }], {
      onSuccess: () => { setTimeout(() => refetchServerInfo(), 300); },
    });
  };

  return (
    <div>
      <SectionHeader icon={Link2} title="DTSP" description="Desktop Text Source Protocol — app discovery for external tools" />

      {/* Controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={handleToggle}
            className={cn(
              'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
              dtspOn ? 'bg-accent' : 'bg-bg-hover border border-border-default',
            )}
          >
            <span className={cn('inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform', dtspOn ? 'translate-x-[18px]' : 'translate-x-[3px]')} />
          </button>
          <div className="flex items-center gap-2">
            <span className={cn('w-2 h-2 rounded-full shrink-0', isRegistered ? 'bg-emerald-400' : 'bg-border-default')} />
            <span className="text-xs text-text-secondary">
              {isRegistered ? 'Registered' : dtspOn && !serverRunning ? 'Waiting for API Server' : 'Inactive'}
            </span>
          </div>
        </div>
        <button onClick={() => setShowInfo(true)} className="text-text-muted hover:text-text-secondary transition-colors cursor-pointer p-0.5" title="About DTSP">
          <Info size={13} />
        </button>
      </div>

      {isRegistered && (
        <div className="rounded-lg border border-border-subtle bg-bg-secondary/30 p-3 mb-3">
          <div className="text-[10px] text-text-muted mb-1">Registration file</div>
          <span className="text-[11px] font-mono text-text-tertiary">~/.dtsp/sources/subframe.json</span>
        </div>
      )}

      {dtspOn && !serverRunning && (
        <div className="text-xs text-text-muted bg-bg-secondary/30 border border-border-subtle rounded-lg p-3">
          Enable the Local API Server to register as a DTSP source.
        </div>
      )}

      {/* Capabilities */}
      {isRegistered && (
        <div className="rounded-lg border border-border-subtle bg-bg-secondary/30 p-3">
          <div className="text-[10px] text-text-muted mb-1.5">Declared capabilities</div>
          <div className="flex flex-wrap gap-1.5">
            {['selection', 'context', 'buffer', 'events', 'tts'].map((cap) => (
              <span key={cap} className="inline-flex items-center rounded bg-bg-tertiary px-1.5 py-0.5 text-[10px] font-mono text-text-secondary">
                {cap}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Info dialog */}
      <Dialog open={showInfo} onOpenChange={setShowInfo}>
        <DialogContent className="bg-bg-primary border-border-subtle text-text-primary sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Link2 size={16} className="text-cyan-400" />Desktop Text Source Protocol
            </DialogTitle>
            <DialogDescription className="text-text-secondary text-xs">
              Generic discovery protocol for desktop apps to expose text selection and context.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-[11px] text-text-secondary">
            <div>
              <div className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1">How it works</div>
              <p>SubFrame registers as a DTSP source by writing a JSON file to <span className="font-mono text-[10px]">~/.dtsp/sources/subframe.json</span>. Consumer apps scan this directory to discover available text sources, verify the PID is alive, then query the API endpoints.</p>
            </div>
            <div>
              <div className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1">Compatible consumers</div>
              <p>Conjure (TTS via text selection), custom scripts, Stream Deck, any DTSP-aware tool.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
