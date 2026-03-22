/**
 * SystemPanel — App dashboard for SubFrame itself.
 * Shows version/update status, AI tool picker, health, integrations, and quick access.
 */

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Cpu, Download, RefreshCw, Loader2, CheckCircle,
  Terminal, Keyboard, BookMarked, Globe, Copy, Zap,
  ChevronDown, ChevronUp, RotateCw, Info,
} from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from './ui/dialog';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { useUpdater } from '../hooks/useUpdater';
import { useAIToolConfig } from '../hooks/useSettings';
import { useSubFrameHealth } from '../hooks/useSubFrameHealth';
import { usePrompts } from '../hooks/usePrompts';
import { useIpcQuery, useIpcMutation } from '../hooks/useIpc';
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
      <style>{`@keyframes shimmer-divider { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }`}</style>
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
            <FeatureDetectionCard />
          </motion.div>

          {/* Section 4: Quick Access */}
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
    '/api/terminals/:id/buffer', '/api/selection', '/api/context', '/api/events',
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

          {/* Connected consumers + DTSP */}
          <div className="flex flex-col gap-1 mt-2 pt-1.5 border-t border-border-subtle">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', isRunning ? 'bg-emerald-400' : 'bg-border-default')} />
                <span className="text-[10px] text-text-muted">DTSP</span>
                <span className="text-[10px] text-text-tertiary">
                  {isRunning ? 'Registered' : 'Inactive'}
                </span>
              </div>
              {isRunning && (
                <div className="flex items-center gap-3 text-[10px] text-text-tertiary">
                  <span>{serverInfo?.connectedClients ?? 0} {(serverInfo?.connectedClients ?? 0) === 1 ? 'client' : 'clients'}</span>
                  <span>{serverInfo?.totalRequests ?? 0} requests</span>
                </div>
              )}
            </div>
          </div>
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
              <div className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1">Protocol</div>
              <p>DTSP (Desktop Text Source Protocol) — generic discovery protocol for desktop apps to expose text data. Consumer apps scan <span className="font-mono text-[10px]">~/.dtsp/sources/*.json</span> to find sources.</p>
            </div>
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
                  ['/api/events', 'SSE event stream'],
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
              <div className="font-mono text-[10px] text-text-tertiary space-y-0.5">
                <div>~/.subframe/api.json</div>
                <div>~/.dtsp/sources/subframe.json</div>
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1">Compatible Tools</div>
              <p>Conjure (TTS), custom scripts, Stream Deck plugins, any DTSP-aware app.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

// ─── Card 5: Feature Detection ───────────────────────────────────────────────

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
