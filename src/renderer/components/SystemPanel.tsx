/**
 * SystemPanel — App dashboard for SubFrame itself.
 * Shows version/update status, AI tool, health, integrations, and quick access.
 */

import { motion } from 'framer-motion';
import {
  Cpu, Download, RefreshCw, Loader2, CheckCircle,
  Terminal, Keyboard, BookMarked, Globe, Copy, Zap, Shield,
} from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { useUpdater } from '../hooks/useUpdater';
import { useAIToolConfig } from '../hooks/useSettings';
import { useSubFrameHealth } from '../hooks/useSubFrameHealth';
import { usePrompts } from '../hooks/usePrompts';
import { useIpcQuery } from '../hooks/useIpc';
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
            <AIToolCard />
            <HealthQuickCard />
          </motion.div>

          {/* Section 2: Integrations */}
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
          </motion.div>

          {/* Section 3: Quick Access */}
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

// ─── Card 2: AI Tool ──────────────────────────────────────────────────────────

function AIToolCard() {
  const { config, isLoading } = useAIToolConfig();
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen);

  const tool = config?.activeTool;

  return (
    <motion.div
      variants={cardVariants}
      className="rounded-lg border border-border-subtle bg-bg-deep/50 p-3 cursor-pointer hover:border-accent/30 transition-colors"
      onClick={() => setSettingsOpen(true)}
    >
      <div className="flex items-center gap-2 mb-2">
        <Terminal size={14} className="text-accent" />
        <span className="text-xs font-medium text-text-primary">AI Tool</span>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center py-3">
          <Loader2 size={14} className="animate-spin text-text-muted" />
        </div>
      ) : tool ? (
        <>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] text-text-secondary">{tool.name}</span>
            <span
              className={cn(
                'w-1.5 h-1.5 rounded-full shrink-0',
                tool.installed ? 'bg-emerald-400' : 'bg-red-400'
              )}
            />
          </div>
          <div className="text-[10px] font-mono text-text-tertiary truncate">{tool.command}</div>
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
  const { data: serverInfo, isLoading } = useIpcQuery(IPC.API_SERVER_INFO, []);

  const enabled = serverInfo?.enabled ?? false;
  const port = serverInfo?.port ?? 0;
  const token = serverInfo?.token ?? '';

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
        <Button size="sm" variant="ghost" onClick={copyConfig} className="h-6 px-2 cursor-pointer">
          <Copy size={12} />
          <span className="text-[10px] ml-1">Copy Config</span>
        </Button>
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
                enabled && port > 0 ? 'bg-emerald-400' : 'bg-red-400'
              )}
            />
            <span className="text-[11px] text-text-secondary">
              {enabled && port > 0 ? 'Running' : 'Stopped'}
            </span>
            {enabled && port > 0 && (
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
              >
                <Copy size={10} />
              </button>
            </div>
          )}

          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
            {endpoints.map((ep) => (
              <span key={ep} className="text-[10px] font-mono text-text-tertiary">{ep}</span>
            ))}
          </div>
        </>
      )}
    </motion.div>
  );
}

// ─── Card 5: Keyboard Shortcuts ───────────────────────────────────────────────

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

// ─── Card 6: Prompt Library ───────────────────────────────────────────────────

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
