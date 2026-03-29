/**
 * SystemPanel — App dashboard for SubFrame itself.
 * Shows version/update status, AI tool picker, health, integrations, and quick access.
 */

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Cpu, Download, RefreshCw, Loader2, CheckCircle,
  Terminal, Keyboard, BookMarked, Globe, Copy, Zap,
  ChevronDown, ChevronUp, RotateCw, Info, Link2,
  FileText, Settings2, Check, X, Plus, ExternalLink,
} from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
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
import { typedSend } from '../lib/ipc';
import { useUIStore } from '../stores/useUIStore';
import { useProjectStore } from '../stores/useProjectStore';
import { IPC } from '../../shared/ipcChannels';
import { getLogoSVG } from '../../shared/logoSVG';
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
  hidden: { opacity: 0, y: 12, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const } },
};

/** Shared hover props for interactive cards */
const cardHover = {
  whileHover: { scale: 1.012, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' },
  transition: { type: 'spring' as const, stiffness: 400, damping: 25 },
};

/** Animated gradient divider — shimmers the logo palette (purple → pink → cyan) */
function SectionDivider({ icon: Icon, label }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string }) {
  return (
    <div className="flex items-center gap-2 mt-3 mb-0.5 px-0.5">
      <Icon size={12} className="text-text-muted" />
      <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">{label}</span>
      <div className="flex-1 h-px relative overflow-hidden">
        <div
          className="absolute inset-0 h-px"
          style={{
            background: 'linear-gradient(90deg, #b480ff40, #ff6eb440, #64d8ff40, #b480ff40)',
            backgroundSize: '200% 100%',
            animation: 'shimmer-divider 4s ease-in-out infinite',
          }}
        />
      </div>
    </div>
  );
}

export function SystemPanel({ isFullView = false }: { isFullView?: boolean }) {
  return (
    <div className="flex flex-col h-full">
      {/* Header — hidden in full-view mode (TerminalArea provides its own) */}
      {!isFullView && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle shrink-0">
          <div className="text-xs font-medium text-text-primary">System</div>
        </div>
      )}

      {/* Content */}
      <ScrollArea className="flex-1 min-h-0">
        <div className={cn('flex flex-col gap-2', isFullView ? 'p-4' : 'p-3')}>
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
          <SectionDivider icon={Terminal} label="AI Tools" />
          <motion.div
            className="grid gap-2 grid-cols-2"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <AIToolCard />
          </motion.div>

          {/* Section 3: Integrations */}
          <SectionDivider icon={Globe} label="Integrations" />
          <motion.div
            className="grid gap-2 grid-cols-2"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <APIServerCard />
            <DTSPCard />
            <FeatureDetectionCard />
          </motion.div>

          {/* Section 4: Claude Configuration */}
          <SectionDivider icon={FileText} label="Claude Configuration" />
          <motion.div
            className="grid gap-2 grid-cols-2"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <ClaudeConfigCard />
          </motion.div>

          {/* Section 5: Quick Access */}
          <SectionDivider icon={Zap} label="Quick Access" />
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
      className="rounded-lg border border-border-subtle bg-bg-deep/50 p-3 col-span-2 hover:border-accent/30 transition-colors overflow-hidden relative"
    >
      {/* Subtle radial glow behind the logo */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: '-20px', left: '50%', transform: 'translateX(-50%)',
          width: 200, height: 200, opacity: 0.08,
          background: 'radial-gradient(circle, #ff6eb4, #b480ff 40%, transparent 70%)',
        }}
      />

      {/* Logo + version hero */}
      <div className="flex flex-col items-center pt-1 pb-3 relative">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] as const }}
          dangerouslySetInnerHTML={{ __html: getLogoSVG({ size: 80, id: 'system-logo', frame: false }) }}
        />
        <motion.span
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="text-xl font-bold mt-1"
          style={{
            background: 'linear-gradient(135deg, #b480ff, #ff6eb4, #64d8ff)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          v{FRAME_VERSION}
        </motion.span>
      </div>

      {/* Update status + check button */}
      <div className="flex items-center justify-between relative">
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
      {...cardHover}
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
  const { data: serverInfo, isLoading, refetch: refetchServerInfo } = useIpcQuery(IPC.API_SERVER_INFO, [], {
    refetchInterval: 5000, // Live counters (clients, requests) refresh while panel is open
    staleTime: 4000,
  });
  const toggleServer = useIpcMutation(IPC.API_SERVER_TOGGLE, {
    onSuccess: () => { refetchServerInfo(); },
  });
  const regenToken = useIpcMutation(IPC.API_SERVER_REGEN_TOKEN, {
    onSuccess: () => { refetchServerInfo(); toast.success('Token regenerated'); },
  });
  const [endpointsExpanded, setEndpointsExpanded] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

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
  };

  const endpoints = [
    '/api/health', '/api/terminals', '/api/terminals/:id/selection',
    '/api/terminals/:id/buffer', '/api/selection', '/api/context',
    '/api/tts', '/api/tts/latest', '/api/tts/history', '/api/events',
  ];

  return (
    <motion.div
      variants={cardVariants}
      className="rounded-lg border border-border-subtle bg-bg-deep/50 p-3 col-span-2 hover:border-accent/30 transition-colors"
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Globe size={14} className="text-accent" />
          <div>
            <span className="text-xs font-medium text-text-primary">Local API Server</span>
            <div className="text-[10px] text-text-tertiary">Expose terminal state to external tools</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowInfo(true)}
            className="text-text-muted hover:text-text-secondary transition-colors cursor-pointer p-0.5"
            title="About this integration"
          >
            <Info size={12} />
          </button>
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
            <span className="relative shrink-0">
              <span className={cn('block w-2 h-2 rounded-full', isRunning ? 'bg-emerald-400' : 'bg-red-400')} />
              {isRunning && (
                <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-40" />
              )}
            </span>
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

          {/* Usage stats + TTS activity */}
          {isRunning && (
            <div className="flex items-center gap-3 mt-1.5 text-[10px] text-text-tertiary">
              <span>{serverInfo?.connectedClients ?? 0} {(serverInfo?.connectedClients ?? 0) === 1 ? 'client' : 'clients'}</span>
              <span>{serverInfo?.totalRequests ?? 0} requests</span>
              {(serverInfo?.ttsMessageCount ?? 0) > 0 && (
                <span className="text-accent">{serverInfo?.ttsMessageCount} TTS</span>
              )}
            </div>
          )}
          {isRunning && serverInfo?.lastTtsMessage && (
            <div className="flex items-center gap-1.5 mt-1 text-[10px] text-text-muted">
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
              <Globe size={16} className="text-accent" />
              Local API Server
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
              <div className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1">Endpoints</div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                {[
                  ['/api/health', 'Server status (public)'],
                  ['/api/selection', 'Active terminal selection'],
                  ['/api/context', 'Terminal name, project, agent status'],
                  ['/api/terminals', 'List all terminals'],
                  ['/api/buffer', 'Visible terminal buffer'],
                  ['POST /api/tts', 'Submit TTS text from hooks'],
                  ['/api/tts/latest', 'Most recent TTS message'],
                  ['/api/events', 'SSE stream (incl. tts-speak)'],
                ].map(([ep, desc]) => (
                  <div key={ep}>
                    <span className="font-mono text-accent text-[10px]">{ep}</span>
                    <div className="text-[10px] text-text-tertiary">{desc}</div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1">Discovery</div>
              <div className="font-mono text-[10px] text-text-tertiary">~/.subframe/api.json</div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

// ─── Card 5: DTSP Registration ────────────────────────────────────────────────

function DTSPCard() {
  const { data: serverInfo, refetch: refetchServerInfo } = useIpcQuery(IPC.API_SERVER_INFO, [], {
    refetchInterval: 5000,
    staleTime: 4000,
  });
  const { settings, updateSetting } = useSettings();
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
    <motion.div
      variants={cardVariants}
      className="rounded-lg border border-border-subtle bg-bg-deep/50 p-3 col-span-2 hover:border-accent/30 transition-colors"
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Link2 size={14} className="text-cyan-400" />
          <div>
            <span className="text-xs font-medium text-text-primary">DTSP</span>
            <div className="text-[10px] text-text-tertiary">Desktop Text Source Protocol — app discovery for external tools</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowInfo(true)}
            className="text-text-muted hover:text-text-secondary transition-colors cursor-pointer p-0.5"
            title="About DTSP"
          >
            <Info size={12} />
          </button>
          {/* Toggle switch */}
          <button
            onClick={handleToggle}
            className={cn(
              'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
              dtspOn ? 'bg-accent' : 'bg-bg-hover border border-border-default'
            )}
          >
            <span
              className={cn(
                'inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform',
                dtspOn ? 'translate-x-[18px]' : 'translate-x-[3px]'
              )}
            />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className={cn('w-2 h-2 rounded-full shrink-0', isRegistered ? 'bg-emerald-400' : 'bg-border-default')} />
        <span className="text-[11px] text-text-secondary">
          {isRegistered ? 'Registered' : dtspOn && !serverRunning ? 'Waiting for API Server' : 'Inactive'}
        </span>
        {isRegistered && (
          <span className="text-[10px] font-mono text-text-tertiary">~/.dtsp/sources/subframe.json</span>
        )}
      </div>
      {dtspOn && !serverRunning && (
        <div className="text-[10px] text-text-muted mt-1">Enable the Local API Server to register as a DTSP source.</div>
      )}

      {/* Info dialog */}
      <Dialog open={showInfo} onOpenChange={setShowInfo}>
        <DialogContent className="bg-bg-primary border-border-subtle text-text-primary sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Link2 size={16} className="text-cyan-400" />
              Desktop Text Source Protocol
            </DialogTitle>
            <DialogDescription className="text-text-secondary text-xs">
              Generic discovery protocol for desktop apps to expose text selection and context.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-[11px] text-text-secondary">
            <div>
              <div className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1">How it works</div>
              <p>SubFrame registers as a DTSP source by writing a JSON file to <span className="font-mono text-[10px]">~/.dtsp/sources/subframe.json</span>. Consumer apps (like Conjure) scan this directory to discover available text sources, verify the PID is alive, then query the API endpoints.</p>
            </div>
            <div>
              <div className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1">Capabilities declared</div>
              <div className="flex flex-wrap gap-1.5 mt-0.5">
                {['selection', 'context', 'buffer', 'events', 'tts'].map((cap) => (
                  <span key={cap} className="inline-flex items-center gap-1 rounded bg-bg-tertiary px-1.5 py-0.5 text-[10px] font-mono text-text-secondary">
                    {cap}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1">Registration file</div>
              <div className="rounded bg-bg-deep p-2 font-mono text-[10px] text-text-tertiary">
                {'{ name, port, token, pid, protocolVersion, appVersion, capabilities }'}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1">Compatible consumers</div>
              <p>Conjure (TTS via text selection), custom scripts, Stream Deck, any DTSP-aware tool.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

// ─── Card 6: Feature Detection ───────────────────────────────────────────────

function FeatureDetectionCard() {
  const { config: aiToolConfig } = useAIToolConfig();
  const projectPath = useProjectStore((s) => s.currentProjectPath);
  // Query main process for actual AI tool config files (Claude's .claude/settings.json)
  const { data: aiFeatures } = useIpcQuery(IPC.DETECT_AI_FEATURES, [projectPath ?? ''], {
    enabled: !!projectPath && aiToolConfig?.activeTool?.id === 'claude',
    staleTime: 30000,
  });

  const features = useMemo(() => {
    if (!aiToolConfig) return [];
    const tool = aiToolConfig.activeTool;
    const isClaude = tool.id === 'claude';

    return [
      { name: 'AI Tool Installed', detected: !!tool.installed, hint: `Install ${tool.name}` },
      ...(isClaude ? [
        {
          name: 'Hooks',
          detected: !!aiFeatures?.hooks,
          hint: aiFeatures?.hooks ? `${aiFeatures.hookCount} event types configured` : 'Configure hooks for automation',
        },
        {
          name: 'MCP Servers',
          detected: !!aiFeatures?.mcpServers,
          hint: aiFeatures?.mcpServers ? `${aiFeatures.mcpServerCount} servers configured` : 'Add MCP servers for extended capabilities',
        },
        {
          name: 'Skills',
          detected: !!aiFeatures?.skills,
          hint: aiFeatures?.skills ? 'Custom slash commands available' : 'Add .claude/skills/ for custom commands',
        },
      ] : []),
    ];
  }, [aiToolConfig, aiFeatures]);

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

// ─── Card: Claude Configuration ──────────────────────────────────────────────

/** Single config file row */
function ConfigFileRow({
  icon: Icon,
  label,
  filePath,
  exists,
  onOpen,
  onCreate,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  filePath: string;
  exists: boolean;
  onOpen: () => void;
  onCreate: () => void;
}) {
  return (
    <div className="flex items-center gap-2 py-1 px-1 rounded hover:bg-bg-hover/50 transition-colors group">
      <Icon size={13} className="text-text-muted shrink-0" />
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-[11px] font-medium text-text-secondary truncate">{label}</span>
        <span className="text-[10px] text-text-tertiary truncate">{filePath}</span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {exists ? (
          <>
            <span className="flex items-center gap-1 text-[10px] text-emerald-400">
              <Check size={10} />
              <span>Exists</span>
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={onOpen}
              className="h-5 px-1.5 text-[10px] cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ExternalLink size={10} className="mr-0.5" />
              Open
            </Button>
          </>
        ) : (
          <>
            <span className="flex items-center gap-1 text-[10px] text-text-muted">
              <X size={10} />
              <span>Not found</span>
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={onCreate}
              className="h-5 px-1.5 text-[10px] cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Plus size={10} className="mr-0.5" />
              Create
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function ProjectConfigSection({
  project,
  onOpen,
  onCreate,
}: {
  project: { claudeMd: { exists: boolean; path: string }; settings: { exists: boolean; path: string }; privateMd: { exists: boolean; path: string } };
  onOpen: (path: string) => void;
  onCreate: (path: string, isSettings: boolean) => void;
}) {
  return (
    <div>
      <div className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1.5">
        Project
      </div>
      <div className="rounded border border-border-subtle bg-bg-primary/50 p-1.5 space-y-0.5">
        <ConfigFileRow
          icon={FileText}
          label="CLAUDE.md"
          filePath={project.claudeMd.path}
          exists={project.claudeMd.exists}
          onOpen={() => onOpen(project.claudeMd.path)}
          onCreate={() => onCreate(project.claudeMd.path, false)}
        />
        <ConfigFileRow
          icon={Settings2}
          label=".claude/settings.json"
          filePath={project.settings.path}
          exists={project.settings.exists}
          onOpen={() => onOpen(project.settings.path)}
          onCreate={() => onCreate(project.settings.path, true)}
        />
        <ConfigFileRow
          icon={FileText}
          label=".claude/CLAUDE.md (private)"
          filePath={project.privateMd.path}
          exists={project.privateMd.exists}
          onOpen={() => onOpen(project.privateMd.path)}
          onCreate={() => onCreate(project.privateMd.path, false)}
        />
      </div>
    </div>
  );
}

function ClaudeConfigCard() {
  const projectPath = useProjectStore((s) => s.currentProjectPath);
  const setEditorFilePath = useUIStore((s) => s.setEditorFilePath);

  const { data: configStatus, refetch, isLoading } = useIpcQuery(
    IPC.GET_CLAUDE_CONFIG_STATUS,
    [projectPath],
    { staleTime: 10000 }
  );

  const openFile = (filePath: string) => {
    setEditorFilePath(filePath);
  };

  const createFile = (filePath: string, isSettings: boolean) => {
    const content = isSettings
      ? JSON.stringify({}, null, 2) + '\n'
      : '# CLAUDE.md\n\n## Instructions\n\n';

    // Ensure parent directory exists by writing the file via IPC
    typedSend(IPC.WRITE_FILE, { filePath, content });
    // Open in editor after a brief delay to allow fs write
    setTimeout(() => {
      setEditorFilePath(filePath);
      refetch();
    }, 300);
  };

  return (
    <motion.div
      variants={cardVariants}
      className="rounded-lg border border-border-subtle bg-bg-deep/50 p-3 col-span-2 hover:border-accent/30 transition-colors"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-accent" />
          <span className="text-xs font-medium text-text-primary">Claude Configuration</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => refetch()}
          className="h-6 px-2 cursor-pointer shrink-0"
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <RefreshCw size={12} />
          )}
          <span className="text-[10px] ml-1">Refresh</span>
        </Button>
      </div>

      {isLoading && !configStatus ? (
        <div className="flex items-center justify-center py-3">
          <Loader2 size={14} className="animate-spin text-text-muted" />
        </div>
      ) : configStatus ? (
        <div className="space-y-3">
          {/* Global Configuration */}
          <div>
            <div className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1.5">
              Global (~/.claude/)
            </div>
            <div className="rounded border border-border-subtle bg-bg-primary/50 p-1.5 space-y-0.5">
              <ConfigFileRow
                icon={FileText}
                label="CLAUDE.md"
                filePath={configStatus.global.claudeMd.path}
                exists={configStatus.global.claudeMd.exists}
                onOpen={() => openFile(configStatus.global.claudeMd.path)}
                onCreate={() => createFile(configStatus.global.claudeMd.path, false)}
              />
              <ConfigFileRow
                icon={Settings2}
                label="settings.json"
                filePath={configStatus.global.settings.path}
                exists={configStatus.global.settings.exists}
                onOpen={() => openFile(configStatus.global.settings.path)}
                onCreate={() => createFile(configStatus.global.settings.path, true)}
              />
            </div>
          </div>

          {/* Project Configuration */}
          {configStatus.project ? (
            <ProjectConfigSection
              project={configStatus.project}
              onOpen={openFile}
              onCreate={createFile}
            />
          ) : (
            <div className="text-[10px] text-text-tertiary italic">
              Select a project to view project-level configuration
            </div>
          )}
        </div>
      ) : (
        <div className="text-[10px] text-text-tertiary">Unable to load config status</div>
      )}
    </motion.div>
  );
}

// ─── Card 6: Keyboard Shortcuts ───────────────────────────────────────────────

function ShortcutsCard() {
  const setFullViewContent = useUIStore((s) => s.setFullViewContent);

  return (
    <motion.div
      variants={cardVariants}
      {...cardHover}
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
      {...cardHover}
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
