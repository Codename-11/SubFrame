/**
 * SystemPanel — App dashboard for SubFrame itself.
 * Shows version/update status, AI tool picker, health, integrations, and quick access.
 */

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Cpu, Download, RefreshCw, Loader2, CheckCircle,
  Terminal, Keyboard, BookMarked, Globe, Copy, Zap, Shield,
  ChevronDown, ChevronUp, RotateCw,
} from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { useUpdater } from '../hooks/useUpdater';
import { useSettings, useAIToolConfig } from '../hooks/useSettings';
import { useSubFrameHealth } from '../hooks/useSubFrameHealth';
import { usePrompts } from '../hooks/usePrompts';
import { useIpcQuery, useIpcMutation } from '../hooks/useIpc';
import { useUIStore } from '../stores/useUIStore';
import { IPC } from '../../shared/ipcChannels';
// Read version from package.json directly (frameConstants uses Node's `path` — unavailable in renderer)
const FRAME_VERSION: string = require('../../../package.json').version;

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export function SystemPanel() {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle shrink-0">
        <div className="text-xs font-medium text-text-primary">System</div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col gap-2 p-3">
          {/* Section 1: SubFrame (no section header) */}
          <motion.div
            className="grid gap-2 grid-cols-2"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <VersionCard />
          </motion.div>

          {/* Section 2: AI Tools */}
          <div className="flex items-center gap-2 mt-2 mb-0.5 px-0.5">
            <Terminal size={12} className="text-text-muted" />
            <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">AI Tools</span>
            <div className="flex-1 h-px bg-border-subtle" />
          </div>
          <motion.div
            className="grid gap-2 grid-cols-2"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <AIToolCard />
          </motion.div>

          {/* Section 3: Integrations */}
          <div className="flex items-center gap-2 mt-2 mb-0.5 px-0.5">
            <Globe size={12} className="text-text-muted" />
            <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">Integrations</span>
            <div className="flex-1 h-px bg-border-subtle" />
          </div>
          <motion.div
            className="grid gap-2 grid-cols-2"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <APIServerCard />
            <FeatureDetectionCard />
          </motion.div>

          {/* Section 4: Quick Access */}
          <div className="flex items-center gap-2 mt-2 mb-0.5 px-0.5">
            <Zap size={12} className="text-text-muted" />
            <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">Quick Access</span>
            <div className="flex-1 h-px bg-border-subtle" />
          </div>
          <motion.div
            className="grid gap-2 grid-cols-2"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <HealthQuickCard />
            <ShortcutsCard />
            <PromptLibraryCard />
          </motion.div>
        </div>
      </ScrollArea>
    </div>
  );
}

// ─── Card 1: Version & Update ─────────────────────────────────────────────────

function VersionCard() {
  const { status, version: updateVersion, error, progress, checkForUpdates, downloadUpdate, installUpdate } = useUpdater();

  return (
    <motion.div
      variants={cardVariants}
      className="rounded-lg border border-border-subtle bg-bg-deep/50 p-3 col-span-2 hover:border-accent/30 transition-colors"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Shield size={14} className="text-accent" />
          <span className="text-xs font-medium text-text-primary">SubFrame</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => checkForUpdates.mutate([])}
          className="h-6 px-2 cursor-pointer"
          disabled={status === 'checking'}
        >
          {status === 'checking' ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <RefreshCw size={12} />
          )}
          <span className="text-[10px] ml-1">Check Now</span>
        </Button>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg font-bold text-text-primary">v{FRAME_VERSION}</span>
      </div>

      <UpdateStatusLine
        status={status}
        updateVersion={updateVersion}
        error={error}
        progress={progress}
        onDownload={() => downloadUpdate.mutate([])}
        onInstall={() => installUpdate.mutate([])}
      />
    </motion.div>
  );
}

function UpdateStatusLine({
  status,
  updateVersion,
  error,
  progress,
  onDownload,
  onInstall,
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px]">
          <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
          <span className="text-text-secondary">v{updateVersion} available</span>
        </div>
        <Button size="sm" variant="ghost" onClick={onDownload} className="h-6 px-2 cursor-pointer text-[10px]">
          <Download size={12} className="mr-1" />
          Download
        </Button>
      </div>
    );
  }

  if (status === 'downloading') {
    const pct = Math.round(progress?.percent ?? 0);
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-[11px] text-text-secondary">
          <span>Downloading...</span>
          <span>{pct}%</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-bg-hover">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  }

  if (status === 'downloaded') {
    return (
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px]">
          <CheckCircle size={12} className="text-emerald-400" />
          <span className="text-text-secondary">Ready to install</span>
        </div>
        <Button size="sm" variant="ghost" onClick={onInstall} className="h-6 px-2 cursor-pointer text-[10px]">
          Restart Now
        </Button>
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

  // idle / not-available
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
      <span className="text-text-secondary">Up to date</span>
    </div>
  );
}

// ─── Card 2: AI Tool Picker ──────────────────────────────────────────────────

function AIToolCard() {
  const { config, isLoading, setAITool } = useAIToolConfig();

  return (
    <motion.div
      variants={cardVariants}
      className="rounded-lg border border-border-subtle bg-bg-deep/50 p-3 col-span-2 hover:border-accent/30 transition-colors"
    >
      <div className="flex items-center gap-2 mb-2">
        <Terminal size={14} className="text-accent" />
        <span className="text-xs font-medium text-text-primary">AI Tool</span>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center py-3">
          <Loader2 size={14} className="animate-spin text-text-muted" />
        </div>
      ) : config ? (
        <>
          <div className="space-y-1.5">
            {Object.entries(config.availableTools).map(([id, tool]) => (
              <button
                key={id}
                onClick={() => setAITool.mutate([id])}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-[11px] transition-colors cursor-pointer',
                  id === config.activeTool.id
                    ? 'bg-accent/10 border border-accent/30 text-text-primary'
                    : 'hover:bg-bg-hover text-text-secondary border border-transparent'
                )}
              >
                <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', tool.installed ? 'bg-emerald-400' : 'bg-red-400')} />
                <span className="font-medium">{tool.name}</span>
                {id === config.activeTool.id && (
                  <CheckCircle size={12} className="ml-auto text-accent" />
                )}
              </button>
            ))}
          </div>
          <div className="mt-2 px-2 py-1 rounded bg-bg-deep font-mono text-[10px] text-text-tertiary truncate">
            {config.activeTool.command || config.activeTool.name}
          </div>
        </>
      ) : (
        <div className="text-[10px] text-text-tertiary">No AI tool configured</div>
      )}
    </motion.div>
  );
}

// ─── Card 3: Health Quick ─────────────────────────────────────────────────────

function HealthQuickCard() {
  const { health, isLoading } = useSubFrameHealth();
  const setActivePanel = useUIStore((s) => s.setActivePanel);

  const healthyCount = health?.healthy ?? 0;
  const totalCount = health?.total ?? 0;
  const warningCount = health?.needsUpdate ?? 0;
  const errorCount = health?.missing ?? 0;

  return (
    <motion.div
      variants={cardVariants}
      className="rounded-lg border border-border-subtle bg-bg-deep/50 p-3 cursor-pointer hover:border-accent/30 transition-colors"
      onClick={() => setActivePanel('subframeHealth')}
    >
      <div className="flex items-center gap-2 mb-2">
        <Cpu size={14} className="text-accent" />
        <span className="text-xs font-medium text-text-primary">Health</span>
      </div>
      {isLoading && !health ? (
        <div className="flex items-center justify-center py-3">
          <Loader2 size={14} className="animate-spin text-text-muted" />
        </div>
      ) : !health ? (
        <div className="text-[10px] text-text-tertiary">No data available</div>
      ) : (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              <span className="text-text-secondary">{healthyCount}</span>
            </div>
            {warningCount > 0 && (
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                <span className="text-text-secondary">{warningCount}</span>
              </div>
            )}
            {errorCount > 0 && (
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
                <span className="text-text-secondary">{errorCount}</span>
              </div>
            )}
          </div>
          <div className="text-[10px] text-text-tertiary">
            {healthyCount}/{totalCount} components OK
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ─── Card 4: Local API Server ─────────────────────────────────────────────────

function APIServerCard() {
  const { data: serverInfo, isLoading, refetch: refetchServerInfo } = useIpcQuery(IPC.API_SERVER_INFO, []);
  const toggleServer = useIpcMutation(IPC.API_SERVER_TOGGLE, {
    onSuccess: () => { refetchServerInfo(); },
  });
  const regenToken = useIpcMutation(IPC.API_SERVER_REGEN_TOKEN, {
    onSuccess: () => { refetchServerInfo(); },
  });
  const [endpointsExpanded, setEndpointsExpanded] = useState(false);

  const enabled = serverInfo?.enabled ?? false;
  const port = serverInfo?.port ?? 0;
  const token = serverInfo?.token ?? '';
  const isRunning = enabled && port > 0;

  const maskedToken = token.length > 8 ? token.slice(0, 8) + '...' : token;

  const copyToken = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (token) {
      navigator.clipboard.writeText(token);
      toast.success('Token copied');
    }
  };

  const copyConfig = (e: React.MouseEvent) => {
    e.stopPropagation();
    const config = JSON.stringify({ enabled, port, token }, null, 2);
    navigator.clipboard.writeText(config);
    toast.success('Config copied');
  };

  const handleToggle = () => {
    toggleServer.mutate([!enabled]);
  };

  const handleRegenToken = (e: React.MouseEvent) => {
    e.stopPropagation();
    regenToken.mutate([]);
    toast.success('Token regenerated');
  };

  const endpoints = ['/api/selection', '/api/context', '/api/events'];

  return (
    <motion.div
      variants={cardVariants}
      className="rounded-lg border border-border-subtle bg-bg-deep/50 p-3 col-span-2 hover:border-accent/30 transition-colors"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Globe size={14} className="text-accent" />
          <span className="text-xs font-medium text-text-primary">Local API Server</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="ghost" onClick={copyConfig} className="h-6 px-2 cursor-pointer">
            <Copy size={12} />
            <span className="text-[10px] ml-1">Copy</span>
          </Button>
          {/* Toggle switch */}
          <button
            onClick={handleToggle}
            disabled={toggleServer.isPending}
            className={cn(
              'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              enabled ? 'bg-accent' : 'bg-bg-hover border border-border-default'
            )}
          >
            <span
              className={cn(
                'inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform',
                enabled ? 'translate-x-[18px]' : 'translate-x-[3px]'
              )}
            />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-3">
          <Loader2 size={14} className="animate-spin text-text-muted" />
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className={cn(
                'w-2 h-2 rounded-full shrink-0',
                isRunning ? 'bg-emerald-400' : 'bg-red-400'
              )}
            />
            <span className="text-[11px] text-text-secondary">
              {isRunning ? 'Running' : 'Stopped'}
            </span>
            {isRunning && (
              <span className="text-[10px] font-mono text-text-tertiary">:{port}</span>
            )}
          </div>

          {token && (
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] text-text-tertiary">Token:</span>
              <span className="text-[10px] font-mono text-text-secondary">{maskedToken}</span>
              <button
                onClick={copyToken}
                className="text-text-muted hover:text-text-secondary transition-colors cursor-pointer"
                title="Copy token"
              >
                <Copy size={10} />
              </button>
              <button
                onClick={handleRegenToken}
                disabled={regenToken.isPending}
                className="text-text-muted hover:text-text-secondary transition-colors cursor-pointer disabled:opacity-50"
                title="Regenerate token"
              >
                <RotateCw size={10} className={cn(regenToken.isPending && 'animate-spin')} />
              </button>
            </div>
          )}

          {/* Collapsible endpoints */}
          <button
            onClick={() => setEndpointsExpanded(!endpointsExpanded)}
            className="flex items-center gap-1 text-[10px] text-text-muted hover:text-text-secondary transition-colors cursor-pointer mt-1"
          >
            {endpointsExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            <span>{endpoints.length} endpoints</span>
          </button>
          {endpointsExpanded && (
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 pl-3.5">
              {endpoints.map((ep) => (
                <span key={ep} className="text-[10px] font-mono text-text-tertiary">{ep}</span>
              ))}
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}

// ─── Card 5: Feature Detection ───────────────────────────────────────────────

function FeatureDetectionCard() {
  const { config: aiToolConfig } = useAIToolConfig();
  const { settings } = useSettings();

  const features = useMemo(() => {
    if (!aiToolConfig) return [];
    const tool = aiToolConfig.activeTool;
    const isClaude = tool.id === 'claude';

    // Detect hooks: settings.hooks should be a non-empty object
    const hooksConfigured = (() => {
      if (!settings || typeof settings !== 'object') return false;
      const hooks = settings.hooks;
      if (!hooks || typeof hooks !== 'object') return false;
      return Object.keys(hooks as Record<string, unknown>).length > 0;
    })();

    return [
      { name: 'AI Tool Installed', detected: !!tool.installed, hint: `Install ${tool.name}` },
      ...(isClaude ? [
        { name: 'Hooks Configured', detected: hooksConfigured, hint: 'Enable in Settings' },
        { name: 'MCP Servers', detected: false, hint: 'Add MCP servers for extended capabilities' },
        { name: 'Channels', detected: false, hint: 'New in Claude Code -- multiplexed sessions' },
        { name: 'Custom Slash Commands', detected: false, hint: 'Create project-specific commands' },
      ] : []),
    ];
  }, [aiToolConfig, settings]);

  if (!aiToolConfig) return null;

  return (
    <motion.div
      variants={cardVariants}
      className="rounded-lg border border-border-subtle bg-bg-deep/50 p-3 col-span-2 hover:border-accent/30 transition-colors"
    >
      <div className="flex items-center gap-2 mb-2">
        <Zap size={14} className="text-purple-400" />
        <span className="text-xs font-medium text-text-primary">Feature Detection</span>
        <span className="text-[10px] text-text-tertiary ml-auto">{aiToolConfig.activeTool.name}</span>
      </div>

      <div className="space-y-1">
        {features.map((feature) => (
          <div key={feature.name} className="flex items-center gap-2 text-[11px]">
            {feature.detected ? (
              <CheckCircle size={12} className="text-emerald-400 shrink-0" />
            ) : (
              <span className="w-3 h-3 rounded-full border border-border-default shrink-0" />
            )}
            <span className={feature.detected ? 'text-text-secondary' : 'text-text-muted'}>
              {feature.name}
            </span>
            {!feature.detected && feature.hint && (
              <span className="text-[10px] text-accent ml-auto">{feature.hint}</span>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Card 6: Keyboard Shortcuts ───────────────────────────────────────────────

function ShortcutsCard() {
  const setFullViewContent = useUIStore((s) => s.setFullViewContent);

  return (
    <motion.div
      variants={cardVariants}
      className="rounded-lg border border-border-subtle bg-bg-deep/50 p-3 cursor-pointer hover:border-accent/30 transition-colors"
      onClick={() => setFullViewContent('shortcuts')}
    >
      <div className="flex items-center gap-2 mb-2">
        <Keyboard size={14} className="text-accent" />
        <span className="text-xs font-medium text-text-primary">Keyboard Shortcuts</span>
      </div>
      <div className="text-[11px] text-text-secondary">View all shortcuts</div>
    </motion.div>
  );
}

// ─── Card 7: Prompt Library ───────────────────────────────────────────────────

function PromptLibraryCard() {
  const { prompts, globalPrompts } = usePrompts();
  const totalPrompts = (globalPrompts?.length ?? 0) + (prompts?.length ?? 0);

  return (
    <motion.div
      variants={cardVariants}
      className="rounded-lg border border-border-subtle bg-bg-deep/50 p-3 cursor-pointer hover:border-accent/30 transition-colors"
      onClick={() => window.dispatchEvent(new CustomEvent('open-prompt-library'))}
    >
      <div className="flex items-center gap-2 mb-2">
        <BookMarked size={14} className="text-accent" />
        <span className="text-xs font-medium text-text-primary">Prompt Library</span>
      </div>
      <div className="text-[11px] text-text-secondary">
        {totalPrompts > 0 ? `${totalPrompts} prompt${totalPrompts !== 1 ? 's' : ''} saved` : 'No prompts yet'}
      </div>
    </motion.div>
  );
}
