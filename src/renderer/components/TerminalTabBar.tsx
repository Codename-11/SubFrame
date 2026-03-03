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
} from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from './ui/context-menu';
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

const { ipcRenderer } = require('electron');

interface TerminalTabBarProps {
  onCreateTerminal: (shell?: string) => void;
  onCloseTerminal: (id: string) => void;
  onOverviewToggle?: () => void;
  onTogglePanel?: (panel: 'tasks' | 'githubIssues' | 'agentState' | 'overview') => void;
  projectTerminals: TerminalInfo[];
}

export function TerminalTabBar({
  onCreateTerminal,
  onCloseTerminal,
  onOverviewToggle,
  onTogglePanel,
  projectTerminals,
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

  const [shells, setShells] = useState<ShellInfo[]>([]);
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [panelLabelsExpanded, setPanelLabelsExpanded] = useState(
    () => localStorage.getItem('terminal-panel-labels') !== 'collapsed'
  );
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);
  const tabScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

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

  // Load Claude usage data
  useEffect(() => {
    const handler = (_event: unknown, data: any) => {
      setUsageData(data);
    };
    ipcRenderer.on(IPC.CLAUDE_USAGE_DATA, handler);
    ipcRenderer.send(IPC.LOAD_CLAUDE_USAGE);

    // Refresh every 60s
    const interval = setInterval(() => {
      ipcRenderer.send(IPC.REFRESH_CLAUDE_USAGE);
    }, 60000);

    return () => {
      ipcRenderer.removeListener(IPC.CLAUDE_USAGE_DATA, handler);
      clearInterval(interval);
    };
  }, []);

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
      if (trimmed) renameTerminal(renamingId, trimmed);
      setRenamingId(null);
      setRenameValue('');
    }
  }, [renamingId, renameValue, renameTerminal]);

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
          {terminalList.map((t) => (
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
                    onClick={() => setActiveTerminal(t.id)}
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
                        <span className="truncate max-w-[120px]">{t.name}</span>
                      )}

                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          onCloseTerminal(t.id);
                        }}
                        className="opacity-40 hover:opacity-100 hover:text-error transition-opacity ml-0.5 cursor-pointer"
                      >
                        <X className="h-3 w-3" />
                      </span>
                    </span>
                  </button>
                </ContextMenuTrigger>

                <ContextMenuContent className="w-40">
                  <ContextMenuItem onClick={() => startRename(t.id, t.name)}>
                    Rename
                  </ContextMenuItem>
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
      {usageData && !usageData.error && (usageData.fiveHour || usageData.sevenDay) && (
        <div
          className="group/usage flex items-center gap-2 px-2 py-0.5 bg-bg-tertiary border border-border-subtle
                     rounded-md cursor-pointer hover:bg-bg-hover hover:border-border-default transition-all
                     flex-shrink-0 mr-1 overflow-hidden"
          onClick={() => ipcRenderer.send(IPC.REFRESH_CLAUDE_USAGE)}
          title={usageData.error ? `Error: ${usageData.error}\nClick to refresh` : 'Click to refresh'}
        >
          {usageData.fiveHour && (
            <UsageItem label="Session" utilization={usageData.fiveHour.utilization} resetsAt={usageData.fiveHour.resetsAt} />
          )}
          {usageData.sevenDay && (
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
              { id: 'githubIssues' as const, label: 'GitHub', icon: Github, shortcut: 'Ctrl+Shift+G' },
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
