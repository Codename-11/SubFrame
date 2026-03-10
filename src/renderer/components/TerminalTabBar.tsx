/**
 * Terminal tab bar component.
 * Renders animated tabs with drag-to-reorder (Framer Motion), shell selector dropdown,
 * view mode toggle, and panel toggle buttons.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import {
  Plus,
  X,
  Grid2x2,
  Columns2,
  Eye,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  ChevronsLeft,
  ListTodo,
  Github,
  Activity,
  LayoutDashboard,
  Workflow,
  Bot,
  Loader2,
} from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from './ui/context-menu';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import { useTerminalStore, type TerminalInfo } from '../stores/useTerminalStore';
import { useUIStore } from '../stores/useUIStore';
import { IPC } from '../../shared/ipcChannels';
import type { ShellInfo } from '../../shared/ipcChannels';
import { typedInvoke } from '../lib/ipc';
import { useSettings } from '../hooks/useSettings';
import * as terminalRegistry from '../lib/terminalRegistry';

const { ipcRenderer } = require('electron');

interface TerminalTabBarProps {
  onCreateTerminal: (shell?: string) => void;
  onCloseTerminal: (id: string) => void;
  onOverviewToggle?: () => void;
  onTogglePanel?: (panel: 'tasks' | 'gitChanges' | 'agentState' | 'overview' | 'pipeline') => void;
  projectTerminals: TerminalInfo[];
  /** Terminal IDs that overflow the grid (not visible in grid view) */
  gridOverflowIds?: Set<string>;
}

export function TerminalTabBar({
  onCreateTerminal,
  onCloseTerminal,
  onOverviewToggle,
  onTogglePanel,
  projectTerminals,
  gridOverflowIds,
}: TerminalTabBarProps) {
  const activeTerminalId = useTerminalStore((s) => s.activeTerminalId);
  const viewMode = useTerminalStore((s) => s.viewMode);
  const setActiveTerminal = useTerminalStore((s) => s.setActiveTerminal);
  const setViewMode = useTerminalStore((s) => s.setViewMode);
  const renameTerminal = useTerminalStore((s) => s.renameTerminal);
  const reorderTerminals = useTerminalStore((s) => s.reorderTerminals);
  const gridLayout = useTerminalStore((s) => s.gridLayout);
  const setGridLayout = useTerminalStore((s) => s.setGridLayout);
  const toggleFullView = useUIStore((s) => s.toggleFullView);
  const fullViewContent = useUIStore((s) => s.fullViewContent);
  const { updateSetting } = useSettings();

  const [shells, setShells] = useState<ShellInfo[]>([]);
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [usageFetching, setUsageFetching] = useState(false);
  const [panelLabelsExpanded, setPanelLabelsExpanded] = useState(
    () => localStorage.getItem('terminal-panel-labels') !== 'collapsed'
  );
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);
  const tabScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // (Agent active status tracked in useTerminalStore.claudeActive, updated by TerminalArea)

  // Load available shells
  useEffect(() => {
    const handler = (_event: unknown, data: { shells: ShellInfo[]; success: boolean }) => {
      if (data.success) setShells(data.shells);
    };
    ipcRenderer.on(IPC.AVAILABLE_SHELLS_DATA, handler);
    ipcRenderer.send(IPC.GET_AVAILABLE_SHELLS);
    return () => {
      ipcRenderer.removeListener(IPC.AVAILABLE_SHELLS_DATA, handler);
    };
  }, []);

  // Load Claude usage data (main process handles periodic polling via settings)
  useEffect(() => {
    const handler = (_event: unknown, data: any) => {
      setUsageFetching(false);
      // On error, preserve existing usage values if backend didn't
      if (data?.error && !(data.fiveHour || data.sevenDay)) {
        setUsageData(prev => prev?.fiveHour || prev?.sevenDay
          ? { ...prev, error: data.error, lastUpdated: data.lastUpdated }
          : data
        );
      } else {
        setUsageData(data);
      }
    };
    ipcRenderer.on(IPC.CLAUDE_USAGE_DATA, handler);
    setUsageFetching(true);
    ipcRenderer.send(IPC.LOAD_CLAUDE_USAGE);

    return () => {
      ipcRenderer.removeListener(IPC.CLAUDE_USAGE_DATA, handler);
    };
  }, []);

  // Show toast on persistent usage polling failures with option to disable
  const persistentFailureShown = useRef(false);
  useEffect(() => {
    if (usageData?.persistentFailure && !persistentFailureShown.current) {
      persistentFailureShown.current = true;
      toast.warning('Usage polling is failing repeatedly', {
        description: 'The Claude API usage endpoint is unreachable. You can disable auto-polling and refresh manually instead.',
        duration: 15000,
        action: {
          label: 'Disable polling',
          onClick: () => {
            updateSetting.mutate([{ key: 'general.usagePollingInterval', value: 0 }]);
            toast.success('Usage auto-polling disabled');
          },
        },
      });
    }
    // Reset flag when errors clear
    if (usageData && !usageData.error) {
      persistentFailureShown.current = false;
    }
  }, [usageData?.persistentFailure, usageData?.error]);

  // Focus rename input when renaming starts
  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  // Update scroll indicators
  const updateScrollState = useCallback(() => {
    const el = tabScrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    updateScrollState();
  }, [projectTerminals, updateScrollState]);

  useEffect(() => {
    const el = tabScrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateScrollState);
    return () => el.removeEventListener('scroll', updateScrollState);
  }, [updateScrollState]);

  // Use projectTerminals prop directly (already sorted by parent)
  const terminalList = projectTerminals;

  const startRename = useCallback((id: string, currentName: string) => {
    setRenamingId(id);
    setRenameValue(currentName);
  }, []);

  const finishRename = useCallback(() => {
    if (renamingId) {
      const trimmed = renameValue.trim();
      if (trimmed) renameTerminal(renamingId, trimmed, 'user');
      setRenamingId(null);
      setRenameValue('');
    }
  }, [renamingId, renameValue, renameTerminal]);

  const refreshSessionName = useCallback(async (terminalId: string) => {
    try {
      const result = await typedInvoke(IPC.GET_TERMINAL_SESSION_NAME, { terminalId });
      if (result.name) {
        renameTerminal(terminalId, result.name, 'session');
      } else {
        toast.info('No Claude session found for this terminal');
      }
    } catch {
      toast.error('Failed to fetch session name');
    }
  }, [renameTerminal]);

  const resetTerminalName = useCallback((terminal: TerminalInfo) => {
    const index = terminalList.indexOf(terminal) + 1;
    renameTerminal(terminal.id, `Terminal ${index}`, 'default');
  }, [terminalList, renameTerminal]);

  const handleReorder = useCallback(
    (newOrder: TerminalInfo[]) => {
      reorderTerminals(newOrder.map((t) => t.id));
    },
    [reorderTerminals]
  );

  return (
    <div className="flex items-center h-9 bg-bg-secondary border-b border-border-subtle px-1 gap-0.5 flex-shrink-0">
      {/* Tabs */}
      <div className="relative flex-1 min-w-0">
        <AnimatePresence>
          {canScrollLeft && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => tabScrollRef.current?.scrollBy({ left: -150, behavior: 'smooth' })}
              className="absolute left-0 top-0 bottom-0 w-6 flex items-center justify-center bg-gradient-to-r from-bg-secondary to-transparent z-10 cursor-pointer text-text-secondary hover:text-text-primary"
              aria-label="Scroll tabs left"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </motion.button>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {canScrollRight && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => tabScrollRef.current?.scrollBy({ left: 150, behavior: 'smooth' })}
              className="absolute right-0 top-0 bottom-0 w-6 flex items-center justify-center bg-gradient-to-l from-bg-secondary to-transparent z-10 cursor-pointer text-text-secondary hover:text-text-primary"
              aria-label="Scroll tabs right"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </motion.button>
          )}
        </AnimatePresence>

      <Reorder.Group
        ref={tabScrollRef}
        axis="x"
        values={terminalList}
        onReorder={handleReorder}
        className="flex items-center gap-0.5 overflow-x-auto scrollbar-none"
        as="div"
      >
        <AnimatePresence initial={false}>
          {terminalList.map((t, idx) => (
            <Reorder.Item
              key={t.id}
              value={t}
              as="div"
              whileDrag={{ scale: 1.03, boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 50 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
            >
              <ContextMenu>
                <ContextMenuTrigger asChild>
                  <button
                    className={`group relative flex items-center gap-1.5 px-3 h-7 rounded-md text-xs
                               whitespace-nowrap transition-colors cursor-pointer select-none
                               ${
                                 t.id === activeTerminalId
                                   ? 'text-accent'
                                   : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                               }`}
                    onClick={() => {
                      setActiveTerminal(t.id);
                      // Ensure terminal receives focus after React re-renders
                      setTimeout(() => {
                        const instance = terminalRegistry.get(t.id);
                        if (instance) instance.terminal.focus();
                      }, 50);
                    }}
                    onDoubleClick={() => startRename(t.id, t.name)}
                  >
                    {/* Sliding active indicator */}
                    {t.id === activeTerminalId && (
                      <motion.div
                        layoutId="active-tab-indicator"
                        className="absolute inset-0 bg-bg-tertiary border border-accent/20 rounded-md"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}

                    <span className="relative z-10 flex items-center gap-1.5">
                      {/* Agent active indicator */}
                      {t.claudeActive && (
                        <Bot className="h-3 w-3 text-success flex-shrink-0 animate-pulse" />
                      )}
                      {renamingId === t.id ? (
                        <input
                          ref={renameInputRef}
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={finishRename}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') finishRename();
                            if (e.key === 'Escape') {
                              setRenamingId(null);
                              setRenameValue('');
                            }
                          }}
                          className="bg-transparent border-none text-xs w-20 text-text-primary focus:ring-1 focus:ring-accent focus:outline-none rounded-sm"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <>
                          {idx < 9 && (
                            <span className="font-mono text-[10px] text-text-muted opacity-70 mr-0.5">{idx + 1}</span>
                          )}
                          <span className="truncate max-w-[120px]">{t.name}</span>
                          {gridOverflowIds?.has(t.id) && (
                            <span
                              className="h-1.5 w-1.5 rounded-full bg-warning/70 flex-shrink-0"
                              title="Not visible in grid — click to view"
                            />
                          )}
                        </>
                      )}

                      <span
                        role="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCloseTerminal(t.id);
                        }}
                        className="opacity-40 hover:opacity-100 hover:text-error transition-opacity ml-0.5 cursor-pointer"
                        aria-label={`Close terminal ${t.name}`}
                      >
                        <X className="h-3 w-3" />
                      </span>
                    </span>
                  </button>
                </ContextMenuTrigger>

                <ContextMenuContent className="w-44">
                  <ContextMenuItem onClick={() => startRename(t.id, t.name)}>
                    Rename
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    onClick={() => refreshSessionName(t.id)}
                    disabled={t.nameSource === 'user'}
                  >
                    Refresh Name
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => resetTerminalName(t)}>
                    Reset Name
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem onClick={() => onCloseTerminal(t.id)}>
                    Close
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            </Reorder.Item>
          ))}
        </AnimatePresence>
      </Reorder.Group>
      </div>

      {/* Context usage bars — collapsed by default, weekly expands on hover */}
      {(usageFetching || (usageData && (usageData.fiveHour || usageData.sevenDay || usageData.error))) && (
        <div
          className={`group/usage flex items-center gap-2 px-2 py-0.5 bg-bg-tertiary border border-border-subtle
                     rounded-md cursor-pointer hover:bg-bg-hover hover:border-border-default transition-all
                     flex-shrink-0 mr-1 overflow-hidden ${usageData?.error && usageData.fiveHour ? 'opacity-80' : ''}`}
          onClick={() => {
            if (!usageFetching) {
              setUsageFetching(true);
              ipcRenderer.send(IPC.REFRESH_CLAUDE_USAGE);
            }
          }}
          title={usageFetching
            ? 'Fetching usage data…'
            : usageData?.error
              ? `${usageData.error}\n${usageData.error.includes('429') ? 'Rate limited by Anthropic API — will retry automatically' : usageData.error.includes('401') ? 'OAuth token may be expired — re-authenticate Claude Code' : usageData.error.includes('No OAuth') ? 'No OAuth token found — sign in to Claude Code first' : 'Temporary error'}${usageData.fiveHour ? '\nShowing cached data' : ''}\nClick to retry now`
              : 'Click to refresh'}
        >
          {usageFetching && (
            <Loader2 className="h-3 w-3 text-text-tertiary animate-spin flex-shrink-0" />
          )}
          {!usageFetching && usageData?.error && (
            <span className="h-1.5 w-1.5 rounded-full bg-warning flex-shrink-0 animate-pulse" title={usageData.fiveHour ? 'Stale data' : 'Unavailable'} />
          )}
          {usageData?.fiveHour ? (
            <UsageItem label="Session" utilization={usageData.fiveHour.utilization} resetsAt={usageData.fiveHour.resetsAt} />
          ) : usageData?.error && (
            <span className="text-[10px] text-text-secondary whitespace-nowrap">Usage unavailable</span>
          )}
          {usageData?.sevenDay && (
            <div className="max-w-0 opacity-0 overflow-hidden transition-all duration-300 ease-in-out
                            group-hover/usage:max-w-[160px] group-hover/usage:opacity-100 group-hover/usage:ml-1">
              <UsageItem label="Weekly" utilization={usageData.sevenDay.utilization} resetsAt={usageData.sevenDay.resetsAt} />
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-0.5 flex-shrink-0 ml-1">
        {/* New terminal — dropdown with shell picker */}
        <DropdownMenu>
          <TooltipProvider delayDuration={400}>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex items-center gap-0.5 h-7 px-1.5 rounded-md text-text-secondary
                               hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer"
                    aria-label="New terminal"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <ChevronDown className="h-2.5 w-2.5 opacity-50" />
                  </button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>New Terminal (Ctrl+Shift+T)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="text-xs text-text-tertiary">
              Select Shell
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {shells.length > 0 ? (
              shells.map((shell) => (
                <DropdownMenuItem
                  key={shell.path}
                  onClick={() => onCreateTerminal(shell.path)}
                  className="text-xs"
                >
                  {shell.name}
                </DropdownMenuItem>
              ))
            ) : (
              <DropdownMenuItem onClick={() => onCreateTerminal()} className="text-xs">
                Default Shell
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* View mode toggle */}
        <TooltipProvider delayDuration={400}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setViewMode(viewMode === 'tabs' ? 'grid' : 'tabs')}
                className={`flex items-center h-7 px-1.5 rounded-md transition-colors cursor-pointer
                           ${
                             viewMode === 'grid'
                               ? 'text-accent bg-accent-subtle'
                               : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                           }`}
                aria-label={viewMode === 'tabs' ? 'Grid view' : 'Tab view'}
              >
                {viewMode === 'tabs' ? (
                  <Grid2x2 className="h-3.5 w-3.5" />
                ) : (
                  <Columns2 className="h-3.5 w-3.5" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{viewMode === 'tabs' ? 'Grid View' : 'Tab View'}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Grid layout selector — only visible in grid mode */}
        {viewMode === 'grid' && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-0.5 h-7 px-1.5 rounded-md text-xs text-text-secondary
                           hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer
                           border border-border-subtle bg-bg-tertiary"
                aria-label={`Grid layout ${gridLayout}`}
              >
                <span className="tabular-nums">{gridLayout.replace('x', '\u00d7')}</span>
                <ChevronDown className="h-2.5 w-2.5 opacity-50" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-20">
              {(['1x2', '1x3', '1x4', '2x1', '2x2', '3x1', '3x2', '3x3'] as const).map((layout) => (
                <DropdownMenuItem
                  key={layout}
                  onClick={() => setGridLayout(layout)}
                  className={`text-xs justify-center tabular-nums ${gridLayout === layout ? 'text-accent font-medium' : ''}`}
                >
                  {layout.replace('x', '\u00d7')}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Panel toggle separator */}
        <div className="h-4 w-px bg-border-subtle mx-0.5" />

        {/* Panel toggles — labeled pills by default, icon-only when collapsed */}
        {onTogglePanel && (
          <>
            {([
              { id: 'tasks' as const, label: 'Sub-Tasks', icon: ListTodo, shortcut: 'Ctrl+Shift+S' },
              { id: 'agentState' as const, label: 'Agent', icon: Activity, shortcut: 'Ctrl+Shift+A' },
              { id: 'gitChanges' as const, label: 'GitHub', icon: Github, shortcut: 'Ctrl+Shift+G' },
              { id: 'pipeline' as const, label: 'Pipeline', icon: Workflow, shortcut: 'Ctrl+Shift+Y' },
            ] as const).map((panel) => {
              const Icon = panel.icon;
              return (
                <TooltipProvider key={panel.id} delayDuration={400}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => onTogglePanel(panel.id)}
                        className="flex items-center gap-1.5 h-7 px-2 rounded-md text-text-secondary
                                   hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer
                                   border border-transparent hover:border-border-subtle whitespace-nowrap"
                        aria-label={`${panel.label}${panel.shortcut ? ` (${panel.shortcut})` : ''}`}
                      >
                        <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                        {panelLabelsExpanded && <span className="text-xs">{panel.label}</span>}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p>{panel.label}{panel.shortcut ? ` (${panel.shortcut})` : ''}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}
            <TooltipProvider delayDuration={400}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => toggleFullView('overview')}
                    className={`flex items-center gap-1.5 h-7 px-2 rounded-md transition-colors cursor-pointer
                               border whitespace-nowrap
                      ${fullViewContent === 'overview'
                        ? 'text-accent bg-accent-subtle border-accent/20'
                        : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover border-transparent hover:border-border-subtle'
                      }`}
                    aria-label="Overview (Ctrl+Shift+O)"
                  >
                    <LayoutDashboard className="h-3.5 w-3.5 flex-shrink-0" />
                    {panelLabelsExpanded && <span className="text-xs">Overview</span>}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom"><p>Overview (Ctrl+Shift+O)</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </>
        )}

        {/* Overview toggle — only show if no panel toggles (fallback) */}
        {onOverviewToggle && !onTogglePanel && (
          <TooltipProvider delayDuration={400}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onOverviewToggle}
                  className="flex items-center h-7 px-1.5 rounded-md text-text-secondary
                             hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer"
                  aria-label="Project overview"
                >
                  <Eye className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Project Overview</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Collapse/expand panel labels chevron */}
        {onTogglePanel && (
          <TooltipProvider delayDuration={400}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => {
                    const next = !panelLabelsExpanded;
                    localStorage.setItem('terminal-panel-labels', next ? 'expanded' : 'collapsed');
                    setPanelLabelsExpanded(next);
                  }}
                  className="flex items-center h-7 px-0.5 rounded-md text-text-tertiary
                             hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer"
                  aria-label={panelLabelsExpanded ? 'Collapse labels' : 'Show labels'}
                >
                  {panelLabelsExpanded
                    ? <ChevronsRight className="h-3 w-3" />
                    : <ChevronsLeft className="h-3 w-3" />
                  }
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{panelLabelsExpanded ? 'Collapse labels' : 'Show labels'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}

/** Usage data shape from claudeUsageManager */
interface UsageWindow {
  utilization: number; // 0–100 (already a percentage)
  resetsAt: string | null;
}

interface UsageData {
  fiveHour: UsageWindow | null;
  sevenDay: UsageWindow | null;
  lastUpdated?: string;
  error?: string | null;
  persistentFailure?: boolean;
}

/** A single usage row: LABEL [BAR] PERCENT (RESET) */
function UsageItem({ label, utilization, resetsAt }: { label: string; utilization: number; resetsAt: string | null }) {
  // utilization is already 0–100 from the API — do NOT multiply by 100
  const pct = Math.round(Math.min(utilization, 100));
  const colorClass = pct >= 80 ? 'bg-error' : pct >= 50 ? 'bg-warning' : 'bg-success';

  return (
    <div className="flex items-center gap-1 pointer-events-none whitespace-nowrap">
      <span className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide">{label}</span>
      <div className="w-10 h-[5px] rounded-[3px] bg-bg-deep overflow-hidden flex-shrink-0">
        <div
          className={`h-full rounded-[3px] transition-all duration-300 ${colorClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] font-semibold text-text-secondary tabular-nums font-mono min-w-[22px] text-right">
        {pct}%
      </span>
      {resetsAt && <ResetTime resetsAt={resetsAt} />}
    </div>
  );
}

/** Formats reset time as relative countdown: "42m", "3h 15m", "2d 5h" */
function ResetTime({ resetsAt }: { resetsAt: string }) {
  const diff = new Date(resetsAt).getTime() - Date.now();
  if (diff <= 0) return <span className="text-[9px] text-text-muted font-mono">(soon)</span>;

  const mins = Math.floor(diff / 60000);
  let label: string;
  if (mins < 60) {
    label = `${mins}m`;
  } else {
    const hours = Math.floor(mins / 60);
    if (hours < 24) {
      label = `${hours}h ${mins % 60}m`;
    } else {
      const days = Math.floor(hours / 24);
      label = `${days}d ${hours % 24}h`;
    }
  }
  return <span className="text-[9px] text-text-muted font-mono">({label})</span>;
}
