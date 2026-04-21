/**
 * MCPMarketplacePanel — browse and install MCP (Model Context Protocol) servers.
 *
 * Greenfield panel: the registry is a hardcoded list returned by the main
 * process. Clicking a card opens an inline detail view with full info and
 * install / uninstall controls. Installed state is tracked in
 * ~/.subframe/mcp-installed.json.
 */

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Store,
  Search,
  ArrowLeft,
  Check,
  ExternalLink,
  RefreshCw,
  Loader2,
  Package,
  Users,
  Download,
} from 'lucide-react';
import {
  useMarketplace,
  useInstalledMCP,
  useInstallMCP,
  useUninstallMCP,
} from '../hooks/useMCPMarketplace';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { cn } from '../lib/utils';
import type { MCPServerEntry } from '../../shared/ipcChannels';

function formatInstallCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

interface CardProps {
  server: MCPServerEntry;
  installed: boolean;
  pending: boolean;
  onOpen: () => void;
  onInstall: () => void;
  onUninstall: () => void;
}

function ServerCard({ server, installed, pending, onOpen, onInstall, onUninstall }: CardProps) {
  const handleAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (installed) {
      onUninstall();
    } else {
      onInstall();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      className="text-left border border-border-subtle rounded-lg bg-bg-secondary hover:bg-bg-hover/60 hover:border-border-default transition-colors p-4 flex flex-col gap-3 cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          <div className="p-1.5 rounded-md bg-accent-subtle text-accent shrink-0">
            <Package size={14} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-medium text-sm text-text-primary truncate">{server.name}</div>
            <div className="text-[11px] text-text-muted flex items-center gap-1 mt-0.5">
              <Users size={10} />
              {server.publisher}
              <span className="mx-1">·</span>
              <Download size={10} />
              {formatInstallCount(server.installCount)}
            </div>
          </div>
        </div>
      </div>

      <p className="text-xs text-text-secondary line-clamp-2 min-h-[2lh]">{server.description}</p>

      <div className="flex items-center gap-1.5 flex-wrap">
        {server.tags.slice(0, 3).map((tag) => (
          <Badge
            key={tag}
            variant="outline"
            className="text-[10px] px-1.5 py-0 h-5 text-text-tertiary border-border-subtle"
          >
            {tag}
          </Badge>
        ))}
      </div>

      <div className="pt-1 mt-auto">
        <Button
          size="xs"
          variant={installed ? 'outline' : 'default'}
          disabled={pending}
          onClick={handleAction}
          className="w-full"
        >
          {pending ? (
            <Loader2 size={10} className="animate-spin" />
          ) : installed ? (
            <>
              <Check size={10} />
              Installed
            </>
          ) : (
            <>
              <Download size={10} />
              Install
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

interface DetailProps {
  server: MCPServerEntry;
  installed: boolean;
  pending: boolean;
  onBack: () => void;
  onInstall: () => void;
  onUninstall: () => void;
}

function ServerDetail({ server, installed, pending, onBack, onInstall, onUninstall }: DetailProps) {
  const configSnippet = useMemo(
    () =>
      JSON.stringify(
        {
          mcpServers: {
            [server.id]: {
              command: 'npx',
              args: ['-y', server.packageName],
            },
          },
        },
        null,
        2
      ),
    [server]
  );

  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16 }}
      transition={{ duration: 0.15 }}
      className="flex flex-col h-full"
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border-subtle shrink-0">
        <button
          onClick={onBack}
          className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer"
          title="Back to marketplace"
        >
          <ArrowLeft size={14} />
        </button>
        <span className="text-xs text-text-secondary truncate">{server.name}</span>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-md bg-accent-subtle text-accent shrink-0">
              <Package size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold text-text-primary">{server.name}</h2>
              <div className="text-xs text-text-muted flex items-center gap-1.5 mt-1">
                <Users size={11} />
                {server.publisher}
                <span className="mx-0.5">·</span>
                <Download size={11} />
                {formatInstallCount(server.installCount)} installs
              </div>
              <div className="font-mono text-[11px] text-text-tertiary mt-1 break-all">
                {server.packageName}
              </div>
            </div>
          </div>

          <Button
            size="sm"
            variant={installed ? 'outline' : 'default'}
            disabled={pending}
            onClick={installed ? onUninstall : onInstall}
            className="w-full"
          >
            {pending ? (
              <Loader2 size={12} className="animate-spin" />
            ) : installed ? (
              <>
                <Check size={12} />
                Installed — Click to Uninstall
              </>
            ) : (
              <>
                <Download size={12} />
                Install
              </>
            )}
          </Button>

          <div>
            <div className="text-[11px] uppercase tracking-wide text-text-muted font-medium mb-1.5">
              Description
            </div>
            <p className="text-sm text-text-secondary leading-relaxed">{server.description}</p>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-wide text-text-muted font-medium mb-1.5">
              Tags
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {server.tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 h-5 text-text-tertiary border-border-subtle"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-wide text-text-muted font-medium mb-1.5">
              Config snippet
            </div>
            <pre className="text-[11px] font-mono bg-bg-deep border border-border-subtle rounded p-3 overflow-x-auto text-text-secondary">
              {configSnippet}
            </pre>
            <p className="text-[10px] text-text-muted mt-1.5">
              Installation is tracked locally. Actual AI tool config updates will land in a future
              release.
            </p>
          </div>

          <div>
            <a
              href={server.homepage}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline"
            >
              <ExternalLink size={11} />
              View on GitHub
            </a>
          </div>
        </div>
      </ScrollArea>
    </motion.div>
  );
}

export function MCPMarketplacePanel() {
  const { servers, isLoading, refetch } = useMarketplace();
  const { installed } = useInstalledMCP();
  const installMutation = useInstallMCP();
  const uninstallMutation = useUninstallMCP();

  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const installedIds = useMemo(() => new Set(installed.map((e) => e.id)), [installed]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return servers;
    return servers.filter((s) => {
      return (
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.packageName.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [servers, query]);

  const selected = useMemo(
    () => servers.find((s) => s.id === selectedId) ?? null,
    [servers, selectedId]
  );

  const handleInstall = async (id: string) => {
    setPendingId(id);
    try {
      await installMutation.mutateAsync([{ id }]);
    } finally {
      setPendingId(null);
    }
  };

  const handleUninstall = async (id: string) => {
    setPendingId(id);
    try {
      await uninstallMutation.mutateAsync([{ id }]);
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <AnimatePresence mode="wait">
        {selected ? (
          <ServerDetail
            key="detail"
            server={selected}
            installed={installedIds.has(selected.id)}
            pending={pendingId === selected.id}
            onBack={() => setSelectedId(null)}
            onInstall={() => handleInstall(selected.id)}
            onUninstall={() => handleUninstall(selected.id)}
          />
        ) : (
          <motion.div
            key="browse"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col h-full"
          >
            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border-subtle shrink-0">
              <div className="relative flex-1 min-w-0">
                <Search
                  size={12}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
                />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search MCP servers..."
                  className="h-7 text-xs pl-7"
                />
              </div>
              <button
                onClick={() => refetch()}
                className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer shrink-0"
                title="Refresh marketplace"
                aria-label="Refresh marketplace"
              >
                <RefreshCw size={13} />
              </button>
            </div>

            {/* Summary line */}
            <div className="px-3 py-1.5 text-[11px] text-text-muted border-b border-border-subtle shrink-0">
              {isLoading
                ? 'Loading marketplace...'
                : `${filtered.length} of ${servers.length} servers · ${installed.length} installed`}
            </div>

            {/* Grid */}
            <ScrollArea className="flex-1">
              <div className="p-3">
                {filtered.length === 0 && !isLoading ? (
                  <div className="text-center py-10">
                    <Store size={22} className="mx-auto mb-2 text-text-muted" />
                    <p className="text-xs text-text-tertiary">No MCP servers match your search</p>
                  </div>
                ) : (
                  <div
                    className={cn(
                      'grid gap-3',
                      'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                    )}
                  >
                    {filtered.map((server) => (
                      <ServerCard
                        key={server.id}
                        server={server}
                        installed={installedIds.has(server.id)}
                        pending={pendingId === server.id}
                        onOpen={() => setSelectedId(server.id)}
                        onInstall={() => handleInstall(server.id)}
                        onUninstall={() => handleUninstall(server.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
