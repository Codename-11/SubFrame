/**
 * PluginsPanel — Plugin management with toggle controls, filter buttons,
 * category icons, and install support.
 */

import { RefreshCw, Wrench, Paintbrush, Code, Puzzle, Download } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { cn } from '../lib/utils';
import { usePlugins } from '../hooks/usePlugins';
import { useState, useMemo } from 'react';
import type { Plugin } from '../../shared/ipcChannels';
import { toast } from 'sonner';

type PluginFilter = 'all' | 'installed' | 'enabled';

const FILTERS: { label: string; value: PluginFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Installed', value: 'installed' },
  { label: 'Enabled', value: 'enabled' },
];

/** Get a lucide-react icon component based on plugin category */
function getCategoryIcon(category?: string) {
  switch (category?.toLowerCase()) {
    case 'tools':
    case 'tool':
      return Wrench;
    case 'themes':
    case 'theme':
      return Paintbrush;
    case 'editor':
    case 'language':
    case 'lsp':
      return Code;
    default:
      return Puzzle;
  }
}

export function PluginsPanel() {
  const { plugins, isLoading, refetch, togglePlugin } = usePlugins();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<PluginFilter>('all');

  const filteredPlugins = useMemo(() => {
    switch (activeFilter) {
      case 'installed':
        return plugins.filter((p: Plugin) => p.installed !== false);
      case 'enabled':
        return plugins.filter((p: Plugin) => p.enabled);
      default:
        return plugins;
    }
  }, [plugins, activeFilter]);

  async function handleRefresh() {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  }

  async function handleToggle(pluginId: string) {
    try {
      await togglePlugin.mutateAsync([pluginId]);
      toast.info('Plugin toggled - restart Claude Code to apply');
    } catch {
      toast.error('Failed to toggle plugin');
    }
  }

  function handleInstall(pluginName: string) {
    // Send install command to terminal if available
    const win = window as unknown as { terminalSendCommand?: (cmd: string) => void };
    if (typeof win.terminalSendCommand === 'function') {
      win.terminalSendCommand(`claude plugin install ${pluginName}`);
      toast.info(`Installing ${pluginName}...`);
    } else {
      toast.info(`Run: claude plugin install ${pluginName}`);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle shrink-0">
        <span className="text-xs text-text-secondary">
          {filteredPlugins.length} plugin{filteredPlugins.length !== 1 ? 's' : ''}
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="h-7 px-2 cursor-pointer"
        >
          <RefreshCw size={14} className={cn(isRefreshing && 'animate-spin')} />
        </Button>
      </div>

      {/* Filter buttons */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border-subtle shrink-0">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setActiveFilter(f.value)}
            className={cn(
              'px-2.5 py-0.5 rounded-full text-[10px] font-medium transition-colors cursor-pointer',
              activeFilter === f.value
                ? 'bg-accent/20 text-accent'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover/50'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Plugin list */}
      <ScrollArea className="flex-1 min-h-0">
        {isLoading && plugins.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-text-tertiary text-sm">
            Loading plugins...
          </div>
        ) : filteredPlugins.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-text-tertiary text-sm gap-1 px-4 text-center">
            <span>
              {activeFilter === 'all'
                ? 'No marketplace plugins found'
                : `No ${activeFilter} plugins`}
            </span>
            {activeFilter === 'all' && (
              <span className="text-xs opacity-60">
                MCP servers and global settings are managed in your Claude Code config (~/.claude/)
              </span>
            )}
          </div>
        ) : (
          <div className="flex flex-col">
            {filteredPlugins.map((plugin: Plugin) => {
              const CategoryIcon = getCategoryIcon(plugin.category);
              const isInstalled = plugin.installed !== false;

              return (
                <div
                  key={plugin.id}
                  className="flex items-center gap-3 px-3 py-3 border-b border-border-subtle/50 hover:bg-bg-hover/30 transition-colors"
                >
                  {/* Category icon */}
                  <div className="w-8 h-8 rounded bg-bg-hover flex items-center justify-center text-text-tertiary shrink-0">
                    <CategoryIcon size={16} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-text-primary">{plugin.name}</span>
                      <Badge
                        variant="secondary"
                        className={cn(
                          'text-[9px] px-1.5 py-0',
                          plugin.enabled
                            ? 'bg-emerald-900/60 text-emerald-300'
                            : isInstalled
                              ? 'bg-zinc-700 text-zinc-300'
                              : 'bg-blue-900/40 text-blue-300'
                        )}
                      >
                        {plugin.enabled ? 'Enabled' : isInstalled ? 'Installed' : 'Available'}
                      </Badge>
                    </div>
                    {plugin.description && (
                      <div className="text-[10px] text-text-tertiary mt-0.5 truncate">
                        {plugin.description}
                      </div>
                    )}
                  </div>

                  {/* Toggle or Install */}
                  {isInstalled ? (
                    <button
                      onClick={() => handleToggle(plugin.id)}
                      className={cn(
                        'relative w-8 h-4.5 rounded-full transition-colors cursor-pointer shrink-0',
                        plugin.enabled ? 'bg-accent' : 'bg-zinc-600'
                      )}
                      title={plugin.enabled ? 'Disable' : 'Enable'}
                    >
                      <div
                        className={cn(
                          'absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform',
                          plugin.enabled ? 'translate-x-4' : 'translate-x-0.5'
                        )}
                      />
                    </button>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleInstall(plugin.name)}
                      className="h-7 px-2 text-xs gap-1 text-accent hover:text-accent cursor-pointer shrink-0"
                      title="Install plugin"
                    >
                      <Download size={12} />
                      Install
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
