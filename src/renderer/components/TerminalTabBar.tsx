/**
 * Terminal tab bar component.
 * Renders animated tabs with drag-to-reorder (Framer Motion), shell selector dropdown,
 * and view mode toggle. View-switching buttons live in ViewTabBar.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { generateTerminalName, getUsedTerminalNames } from '../lib/terminalNames';
import {
  Plus,
  X,
  Grid2x2,
  Columns2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Bot,
  ExternalLink,
  FileText,
  Pin,
  PinOff,
  Pause,
  Play,
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
import { IPC } from '../../shared/ipcChannels';
import type { ShellInfo } from '../../shared/ipcChannels';
import { typedInvoke } from '../lib/ipc';
import * as terminalRegistry from '../lib/terminalRegistry';

const { ipcRenderer } = require('electron');

interface TerminalTabBarProps {
  onCreateTerminal: (shell?: string) => void;
  onCloseTerminal: (id: string) => void;
  onPopOutTerminal?: (id: string) => void;
  projectTerminals: TerminalInfo[];
  /** Current project path (used to detect cross-project pinned terminals) */
  currentProjectPath?: string;
  /** Terminal IDs that overflow the grid (not visible in grid view) */
  gridOverflowIds?: Set<string>;
  /** Called when any terminal tab is clicked (in addition to store setActiveTerminal) */
  onTerminalTabClick?: (id: string) => void;
  /** Editor file tabs (tab view mode) */
  editorFiles?: string[];
  activeEditorFile?: string | null;
  onSelectEditorFile?: (path: string) => void;
  onCloseEditorFile?: (path: string) => void;
}

export function TerminalTabBar({
  onCreateTerminal,
  onCloseTerminal,
  onPopOutTerminal,
  projectTerminals,
  currentProjectPath,
  gridOverflowIds,
  onTerminalTabClick,
  editorFiles,
  activeEditorFile,
  onSelectEditorFile,
  onCloseEditorFile,
}: TerminalTabBarProps) {
  const activeTerminalId = useTerminalStore((s) => s.activeTerminalId);
  const viewMode = useTerminalStore((s) => s.viewMode);
  const setActiveTerminal = useTerminalStore((s) => s.setActiveTerminal);
  const setViewMode = useTerminalStore((s) => s.setViewMode);
  const renameTerminal = useTerminalStore((s) => s.renameTerminal);
  const reorderTerminals = useTerminalStore((s) => s.reorderTerminals);
  const gridLayout = useTerminalStore((s) => s.gridLayout);
  const setGridLayout = useTerminalStore((s) => s.setGridLayout);
  const pinnedTerminals = useTerminalStore((s) => s.pinnedTerminals);
  const pinTerminal = useTerminalStore((s) => s.pinTerminal);
  const unpinTerminal = useTerminalStore((s) => s.unpinTerminal);
  const frozenTerminals = useTerminalStore((s) => s.frozenTerminals);
  const toggleFreezeTerminal = useTerminalStore((s) => s.toggleFreezeTerminal);
  const [shells, setShells] = useState<ShellInfo[]>([]);
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

  // Use projectTerminals prop directly (already sorted by parent — includes pinned cross-project terminals)
  const terminalList = projectTerminals;

  // Identify cross-project pinned terminals (pinned terminals whose projectPath differs from current)
  const normalizedCurrentPath = currentProjectPath ?? '';
  const crossProjectIds = new Set(
    projectTerminals
      .filter((t) => pinnedTerminals.has(t.id) && (t.projectPath || '') !== normalizedCurrentPath)
      .map((t) => t.id)
  );

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
      const terminal = useTerminalStore.getState().terminals.get(terminalId);
      const result = await typedInvoke(IPC.GET_TERMINAL_SESSION_NAME, {
        terminalId,
        sessionId: terminal?.claudeSessionId,
      });
      if (result.name) {
        renameTerminal(terminalId, result.name, 'session');
        toast.success(`Tab renamed: ${result.name}`, { duration: 2000 });
      } else {
        toast.info('No Claude session found for this terminal');
      }
    } catch {
      toast.error('Failed to fetch session name');
    }
  }, [renameTerminal]);

  const resetTerminalName = useCallback((terminal: TerminalInfo) => {
    const allTerminals = useTerminalStore.getState().terminals;
    const usedNames = getUsedTerminalNames(allTerminals);
    usedNames.delete(terminal.name.toLowerCase()); // Exclude current name so it can be reused
    const defaultName = generateTerminalName(usedNames);
    renameTerminal(terminal.id, defaultName, 'default');
    toast.info(`Tab reset: ${defaultName}`, { duration: 2000 });
  }, [renameTerminal]);

  const handleReorder = useCallback(
    (newOrder: TerminalInfo[]) => {
      reorderTerminals(newOrder.map((t) => t.id));
    },
    [reorderTerminals]
  );

  /** Toggle freeze on the active terminal (syncs registry + store) */
  const handleToggleFreeze = useCallback(() => {
    if (!activeTerminalId) return;
    if (terminalRegistry.isFrozen(activeTerminalId)) {
      terminalRegistry.unfreeze(activeTerminalId);
    } else {
      terminalRegistry.freeze(activeTerminalId);
    }
    toggleFreezeTerminal(activeTerminalId);
  }, [activeTerminalId, toggleFreezeTerminal]);

  const isActiveFrozen = activeTerminalId ? frozenTerminals.has(activeTerminalId) : false;

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
                               ${crossProjectIds.has(t.id) ? 'border-l-2 border-accent/40' : ''}
                               ${
                                 t.id === activeTerminalId && !activeEditorFile
                                   ? 'text-accent'
                                   : crossProjectIds.has(t.id)
                                     ? 'text-text-secondary hover:text-text-primary hover:bg-bg-hover bg-bg-tertiary/50'
                                     : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                               }`}
                    onClick={() => {
                      setActiveTerminal(t.id);
                      onTerminalTabClick?.(t.id);
                      // Ensure terminal receives focus after React re-renders
                      setTimeout(() => {
                        const instance = terminalRegistry.get(t.id);
                        if (instance) instance.terminal.focus();
                      }, 50);
                    }}
                    onDoubleClick={() => startRename(t.id, t.name)}
                  >
                    {/* Sliding active indicator */}
                    {t.id === activeTerminalId && !activeEditorFile && (
                      <motion.div
                        layoutId="active-tab-indicator"
                        className="absolute inset-0 bg-bg-tertiary border border-accent/20 rounded-md"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}

                    <span className="relative z-10 flex items-center gap-1.5">
                      {/* Cross-project pinned badge */}
                      {crossProjectIds.has(t.id) && (
                        <span
                          className="flex items-center gap-0.5 px-1 py-px rounded text-[9px] font-medium bg-accent/15 text-accent/80 flex-shrink-0"
                          title={`Pinned from ${t.projectPath || 'unknown'}`}
                        >
                          <Pin className="h-2.5 w-2.5" />
                          {(t.projectPath || '').split(/[/\\]/).pop() || '?'}
                        </span>
                      )}
                      {/* Pin indicator for native terminals that are pinned */}
                      {pinnedTerminals.has(t.id) && !crossProjectIds.has(t.id) && (
                        <span title="Pinned — visible across workspaces" className="flex-shrink-0 flex items-center">
                          <Pin className="h-2.5 w-2.5 text-accent/60" />
                        </span>
                      )}
                      {/* Frozen indicator */}
                      {frozenTerminals.has(t.id) && (
                        <span title="Output frozen"><Pause className="h-2.5 w-2.5 text-info flex-shrink-0" /></span>
                      )}
                      {/* Agent active indicator */}
                      {t.claudeActive && (
                        <Bot className="h-3 w-3 text-success flex-shrink-0 animate-pulse" />
                      )}
                      {t.poppedOut && (
                        <ExternalLink className="h-3 w-3 text-accent flex-shrink-0" />
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
                          <span className={`truncate max-w-[120px]${t.poppedOut ? ' opacity-50' : ''}`}>{t.name}</span>
                          {gridOverflowIds?.has(t.id) && (
                            <span
                              className="h-1.5 w-1.5 rounded-full bg-warning/70 flex-shrink-0"
                              title="Not visible in grid — click to view"
                            />
                          )}
                        </>
                      )}

                      {!t.poppedOut && onPopOutTerminal && (
                        <span
                          role="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onPopOutTerminal(t.id);
                          }}
                          className="opacity-0 group-hover:opacity-40 hover:!opacity-100 hover:text-accent transition-opacity cursor-pointer"
                          aria-label={`Pop out terminal ${t.name}`}
                          title="Pop Out (Ctrl+Shift+D)"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </span>
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
                  {t.poppedOut ? (
                    <>
                      <ContextMenuItem onClick={() => onPopOutTerminal?.(t.id)}>
                        <ExternalLink className="mr-2 h-3.5 w-3.5" />
                        Focus Window
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => {
                        typedInvoke(IPC.TERMINAL_DOCK, t.id).catch(() => {});
                      }}>
                        Dock Back
                      </ContextMenuItem>
                    </>
                  ) : (
                    <ContextMenuItem onClick={() => onPopOutTerminal?.(t.id)}>
                      <ExternalLink className="mr-2 h-3.5 w-3.5" />
                      Pop Out
                    </ContextMenuItem>
                  )}
                  <ContextMenuSeparator />
                  {pinnedTerminals.has(t.id) ? (
                    <ContextMenuItem onClick={() => unpinTerminal(t.id)}>
                      <PinOff className="mr-2 h-3.5 w-3.5" />
                      Unpin Terminal
                    </ContextMenuItem>
                  ) : (
                    <ContextMenuItem onClick={() => pinTerminal(t.id)}>
                      <Pin className="mr-2 h-3.5 w-3.5" />
                      Pin Terminal
                    </ContextMenuItem>
                  )}
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

        {/* Editor file tabs (tab view mode) */}
        {editorFiles && editorFiles.length > 0 && (
          <>
            <div className="w-px h-4 bg-border-subtle mx-1 flex-shrink-0" />
            <div className="flex items-center gap-0.5">
              {editorFiles.map((fp) => {
                const fName = fp.split(/[/\\]/).pop() || fp;
                const isActive = activeEditorFile === fp;
                return (
                  <button
                    key={fp}
                    onClick={() => onSelectEditorFile?.(fp)}
                    className={`group relative flex items-center gap-1.5 px-3 h-7 rounded-md text-xs
                               whitespace-nowrap transition-colors cursor-pointer select-none
                               ${
                                 isActive
                                   ? 'text-accent'
                                   : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                               }`}
                    title={fp}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="active-editor-tab-indicator"
                        className="absolute inset-0 bg-bg-tertiary border border-accent/20 rounded-md"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-1.5">
                      <FileText className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate max-w-[120px]">{fName}</span>
                      <span
                        role="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCloseEditorFile?.(fp);
                        }}
                        className="opacity-40 hover:opacity-100 hover:text-error transition-opacity ml-0.5 cursor-pointer"
                        aria-label={`Close ${fName}`}
                      >
                        <X className="h-3 w-3" />
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

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

        {/* Freeze/resume output toggle */}
        <TooltipProvider delayDuration={400}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleToggleFreeze}
                className={`flex items-center h-7 px-1.5 rounded-md transition-colors cursor-pointer
                           ${
                             isActiveFrozen
                               ? 'text-info bg-info/10'
                               : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                           }`}
                aria-label={isActiveFrozen ? 'Resume output' : 'Freeze output'}
              >
                {isActiveFrozen ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{isActiveFrozen ? 'Resume — flush buffered output (Ctrl+Shift+F)' : 'Freeze — pause output scrolling (Ctrl+Shift+F)'}</p>
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
                <span className="tabular-nums">{gridLayout.includes('x') ? gridLayout.replace('x', '\u00d7') : gridLayout}</span>
                <ChevronDown className="h-2.5 w-2.5 opacity-50" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-20">
              {(['1x1', '1x2', '1x3', '1x4', '2x1', '2x2', '3x1', '3x2', '3x3'] as const).map((layout) => (
                <DropdownMenuItem
                  key={layout}
                  onClick={() => setGridLayout(layout)}
                  className={`text-xs justify-center tabular-nums ${gridLayout === layout ? 'text-accent font-medium' : ''}`}
                >
                  {layout.replace('x', '\u00d7')}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              {([
                { id: '2L1R' as const, label: '\u2b12 2+1' },
                { id: '1L2R' as const, label: '\u2b13 1+2' },
                { id: '2T1B' as const, label: '\u2b14 2/1' },
                { id: '1T2B' as const, label: '\u2b15 1/2' },
              ]).map(({ id, label }) => (
                <DropdownMenuItem
                  key={id}
                  onClick={() => setGridLayout(id)}
                  className={`text-xs justify-center ${gridLayout === id ? 'text-accent font-medium' : ''}`}
                >
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

      </div>
    </div>
  );
}

