import type { ReactElement, ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Reorder, AnimatePresence } from 'framer-motion';
import {
  SquareTerminal,
  FileCode2,
  LayoutPanelLeft,
  LayoutDashboard,
  ListTodo,
  BarChart3,
  BookOpen,
  Network,
  GitBranch,
  Activity,
  Keyboard,
  Cpu,
  Layers,
  Plus,
  X,
  Pin,
  PinOff,
  Pause,
  Play,
  RotateCcw,
  ExternalLink,
  Bot,
  Loader2,
  ChevronDown,
} from 'lucide-react';
import type { LeafNode, LeafTab, PanelTab } from '../lib/splitTree';
import { createTerminalTab } from '../lib/splitTree';
import { useTerminalStore } from '../stores/useTerminalStore';
import { useUIStore } from '../stores/useUIStore';
import { Terminal } from './Terminal';
import { Editor } from './Editor';
import { ErrorBoundary } from './ErrorBoundary';
import { OverviewPanel } from './OverviewPanel';
import { StructureMap } from './StructureMap';
import { TasksPanel } from './TasksPanel';
import { StatsDetailView } from './StatsDetailView';
import { DecisionsDetailView } from './DecisionsDetailView';
import { PipelinePanel } from './PipelinePanel';
import { AgentStateView } from './AgentStateView';
import { ShortcutsPanel } from './ShortcutsPanel';
import { SystemPanel } from './SystemPanel';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from './ui/context-menu';
import { toast } from 'sonner';
import { useSettings } from '../hooks/useSettings';
import { IPC } from '../../shared/ipcChannels';
import type { ShellInfo } from '../../shared/ipcChannels';
import { typedInvoke, typedSend } from '../lib/ipc';
import { getTransport } from '../lib/transportProvider';
import * as terminalRegistry from '../lib/terminalRegistry';

const PANEL_LABELS: Record<string, string> = {
  overview: 'Overview',
  structureMap: 'Structure Map',
  tasks: 'Tasks',
  stats: 'Stats',
  decisions: 'Decisions',
  pipeline: 'Pipeline',
  agentState: 'Agent Activity',
  shortcuts: 'Keyboard Shortcuts',
  system: 'System',
};

const PANEL_ICONS: Record<string, typeof Layers> = {
  overview: LayoutDashboard,
  tasks: ListTodo,
  stats: BarChart3,
  decisions: BookOpen,
  structureMap: Network,
  pipeline: GitBranch,
  agentState: Activity,
  shortcuts: Keyboard,
  system: Cpu,
};

export interface LeafGroupViewProps {
  leaf: LeafNode;
  isActive: boolean;
  onFocus: () => void;
  currentProjectPath: string;
}

function basename(p: string): string {
  if (!p) return '';
  const cleaned = p.replace(/[\\/]+$/, '');
  const idx = Math.max(cleaned.lastIndexOf('/'), cleaned.lastIndexOf('\\'));
  return idx >= 0 ? cleaned.slice(idx + 1) : cleaned;
}

function getTabIcon(tab: LeafTab): typeof Layers {
  switch (tab.kind) {
    case 'terminal':
      return SquareTerminal;
    case 'editor':
      return FileCode2;
    case 'panel':
      return PANEL_ICONS[tab.panelId] ?? Layers;
    case 'empty':
      return LayoutPanelLeft;
  }
}

function getTabLabel(
  tab: LeafTab,
  terminalName: string | undefined
): string {
  switch (tab.kind) {
    case 'terminal':
      return terminalName ?? `Terminal ${tab.terminalId.slice(0, 6)}`;
    case 'editor':
      return basename(tab.filePath) || tab.filePath;
    case 'panel':
      return PANEL_LABELS[tab.panelId] ?? tab.panelId;
    case 'empty':
      return 'Empty';
  }
}

function renderPanel(tab: PanelTab, onClose: () => void): ReactNode {
  switch (tab.panelId) {
    case 'overview':
      return <OverviewPanel isFullView />;
    case 'structureMap':
      return <StructureMap open inline onClose={onClose} />;
    case 'tasks':
      return <TasksPanel isFullView />;
    case 'stats':
      return <StatsDetailView />;
    case 'decisions':
      return <DecisionsDetailView />;
    case 'pipeline':
      return <PipelinePanel isFullView />;
    case 'agentState':
      return <AgentStateView isFullView />;
    case 'shortcuts':
      return <ShortcutsPanel />;
    case 'system':
      return <SystemPanel isFullView />;
    default:
      return (
        <div className="flex h-full items-center justify-center text-xs text-text-tertiary">
          Unknown panel: {tab.panelId}
        </div>
      );
  }
}

export function LeafGroupView({
  leaf,
  isActive,
  onFocus,
  currentProjectPath,
}: LeafGroupViewProps): ReactElement {
  const terminals = useTerminalStore((s) => s.terminals);
  const pinnedTerminals = useTerminalStore((s) => s.pinnedTerminals);
  const frozenTerminals = useTerminalStore((s) => s.frozenTerminals);
  const pinTerminal = useTerminalStore((s) => s.pinTerminal);
  const unpinTerminal = useTerminalStore((s) => s.unpinTerminal);
  const toggleFreezeTerminal = useTerminalStore((s) => s.toggleFreezeTerminal);
  const renameTerminal = useTerminalStore((s) => s.renameTerminal);
  const combineWorkspaceTerminals = useUIStore((s) => s.combineWorkspaceTerminals);
  const { settings } = useSettings();
  const showFreezeHoverAction =
    ((settings?.terminal as Record<string, unknown>)?.showFreezeHoverAction) !== false;

  const [shells, setShells] = useState<ShellInfo[]>([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [creatingTerminal, setCreatingTerminal] = useState(false);

  useEffect(() => {
    const handler = (
      _event: unknown,
      data: { shells: ShellInfo[]; success: boolean }
    ) => {
      if (data.success) setShells(data.shells);
    };
    const unsub = getTransport().on(IPC.AVAILABLE_SHELLS_DATA, handler);
    getTransport().send(IPC.GET_AVAILABLE_SHELLS);
    return unsub;
  }, []);

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  const activeTab = useMemo<LeafTab | undefined>(
    () => leaf.tabs.find((t) => t.id === leaf.activeTabId) ?? leaf.tabs[0],
    [leaf.tabs, leaf.activeTabId]
  );

  const handleActivateTab = (tabId: string): void => {
    useTerminalStore.getState().activateLeafTab(leaf.id, tabId, currentProjectPath);
    onFocus();
  };

  const handleCloseTab = (tabId: string): void => {
    useTerminalStore.getState().closeTabInLeaf(leaf.id, tabId, currentProjectPath);
  };

  const handleReorderTabs = (newTabs: LeafTab[]): void => {
    useTerminalStore
      .getState()
      .reorderLeafTabs(leaf.id, newTabs.map((t) => t.id), currentProjectPath);
  };

  const handleNewTerminal = (shellPath?: string): void => {
    if (creatingTerminal) return;
    setCreatingTerminal(true);
    const safetyTimeout = setTimeout(() => setCreatingTerminal(false), 5000);

    let unsub: (() => void) | null = null;
    const oneShot = (
      _event: unknown,
      data: { terminalId?: string; success: boolean; background?: boolean }
    ) => {
      if (data.background) return;
      clearTimeout(safetyTimeout);
      setCreatingTerminal(false);
      if (unsub) { unsub(); unsub = null; }
      if (!data.success || !data.terminalId) return;
      const newId = data.terminalId;
      queueMicrotask(() => {
        const store = useTerminalStore.getState();
        store.openTabInLeaf(
          leaf.id,
          createTerminalTab(newId),
          true,
          currentProjectPath
        );
        store.setActiveTerminal(newId);
      });
    };
    unsub = getTransport().on(IPC.TERMINAL_CREATED, oneShot);

    const payload: { projectPath?: string; cwd?: string; shell?: string } = {};
    if (currentProjectPath) {
      payload.projectPath = currentProjectPath;
      payload.cwd = currentProjectPath;
    }
    if (shellPath) payload.shell = shellPath;
    typedSend(IPC.TERMINAL_CREATE, payload);
    onFocus();
  };

  const handleOpenFile = (): void => {
    toast.info('Use the file tree to open files');
    onFocus();
  };

  const handleOpenPanel = (panelId: string): void => {
    useTerminalStore.getState().openPanelInActiveLeaf(panelId, currentProjectPath);
    onFocus();
  };

  const startRename = (id: string, currentName: string): void => {
    setRenamingId(id);
    setRenameValue(currentName);
  };

  const finishRename = (): void => {
    if (renamingId) {
      const trimmed = renameValue.trim();
      if (trimmed) renameTerminal(renamingId, trimmed, 'user');
      setRenamingId(null);
      setRenameValue('');
    }
  };

  const refreshSessionName = async (terminalId: string): Promise<void> => {
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
  };

  const resetTerminalName = (terminalId: string, currentIndex: number): void => {
    const defaultName = `Terminal ${currentIndex + 1}`;
    renameTerminal(terminalId, defaultName, 'default');
    toast.info(`Tab reset: ${defaultName}`, { duration: 2000 });
  };

  const toggleFreezeForTerminal = (terminalId: string): void => {
    if (terminalRegistry.isFrozen(terminalId)) {
      terminalRegistry.unfreeze(terminalId);
    } else {
      terminalRegistry.freeze(terminalId);
    }
    toggleFreezeTerminal(terminalId);
  };

  const handlePopOut = (terminalId: string): void => {
    typedInvoke(IPC.TERMINAL_POPOUT, terminalId).catch(() => {});
  };

  const handleDockBack = (terminalId: string): void => {
    typedInvoke(IPC.TERMINAL_DOCK, terminalId).catch(() => {});
  };

  const handleRestartShell = async (terminalId: string): Promise<void> => {
    try {
      const result = await typedInvoke(IPC.TERMINAL_RESTART, terminalId);
      if (result.success) toast.success('Shell restarted');
      else toast.error(result.error || 'Failed to restart shell');
    } catch {
      toast.error('Failed to restart shell');
    }
  };

  const closeOtherTabs = (keepTabId: string): void => {
    const store = useTerminalStore.getState();
    for (const t of leaf.tabs) {
      if (t.id !== keepTabId) {
        store.closeTabInLeaf(leaf.id, t.id, currentProjectPath);
      }
    }
  };

  return (
    <div
      className={`h-full w-full min-h-0 min-w-0 flex flex-col bg-bg-deep ${
        isActive ? 'ring-1 ring-accent/30' : ''
      }`}
      onMouseDown={onFocus}
      data-leaf-id={leaf.id}
    >
      <div className="flex items-stretch h-7 shrink-0 bg-bg-secondary border-b border-border-subtle">
        <Reorder.Group
          as="div"
          axis="x"
          values={leaf.tabs}
          onReorder={handleReorderTabs}
          className="flex min-w-0 flex-1 overflow-x-auto"
        >
          <AnimatePresence initial={false}>
            {leaf.tabs.map((tab, idx) => {
              const Icon = getTabIcon(tab);
              const term =
                tab.kind === 'terminal'
                  ? terminals.get(tab.terminalId)
                  : undefined;
              const label = getTabLabel(tab, term?.name);
              const active = tab.id === leaf.activeTabId;

              const tabContent = (
                <div
                  role="tab"
                  aria-selected={active}
                  data-tab-id={tab.id}
                  data-tab-kind={tab.kind}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                  }}
                  onClick={() => handleActivateTab(tab.id)}
                  onDoubleClick={() => {
                    if (tab.kind === 'terminal' && term) {
                      startRename(tab.terminalId, term.name);
                    }
                  }}
                  className={`group/tab flex items-center gap-1.5 px-2.5 h-full text-[11px] border-r border-border-subtle shrink-0 cursor-pointer select-none transition-colors ${
                    active
                      ? 'bg-bg-primary border-t-2 border-t-accent text-text-primary'
                      : 'bg-bg-secondary hover:bg-bg-hover text-text-tertiary'
                  }`}
                  title={label}
                >
                  <Icon className="w-3 h-3 shrink-0" />
                  {tab.kind === 'terminal' && term && (() => {
                    const isForeign =
                      (term.projectPath || '') !== currentProjectPath;
                    const showProjectBadge =
                      (combineWorkspaceTerminals || isForeign) &&
                      !!term.projectPath;
                    const projectShort =
                      (term.projectPath || '').split(/[/\\]/).pop() || '?';
                    return (
                      <>
                        {showProjectBadge && (
                          <span
                            className={`flex items-center gap-0.5 px-1 py-px rounded text-[9px] font-medium shrink-0 ${
                              pinnedTerminals.has(tab.terminalId)
                                ? 'bg-accent/15 text-accent/80'
                                : isForeign
                                  ? 'bg-info/15 text-info/80'
                                  : 'bg-bg-elevated text-text-muted'
                            }`}
                            title={`${pinnedTerminals.has(tab.terminalId) ? 'Pinned from' : isForeign ? 'From' : ''} ${term.projectPath}`.trim()}
                          >
                            {projectShort}
                          </span>
                        )}
                        {pinnedTerminals.has(tab.terminalId) && !isForeign && (
                          <Pin className="w-2.5 h-2.5 text-accent/60 shrink-0" />
                        )}
                        {frozenTerminals.has(tab.terminalId) && (
                          <Pause className="w-2.5 h-2.5 text-info shrink-0" />
                        )}
                        {term.claudeActive && (
                          <Bot className="w-3 h-3 text-success shrink-0 animate-pulse" />
                        )}
                        {term.poppedOut && (
                          <ExternalLink className="w-3 h-3 text-accent shrink-0" />
                        )}
                      </>
                    );
                  })()}
                  {tab.kind === 'terminal' && renamingId === tab.terminalId ? (
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
                      onClick={(e) => e.stopPropagation()}
                      className="bg-transparent border-none text-[11px] w-24 text-text-primary focus:ring-1 focus:ring-accent focus:outline-none rounded-sm"
                    />
                  ) : (
                    <span className={`truncate max-w-[140px]${tab.kind === 'terminal' && term?.poppedOut ? ' opacity-50' : ''}`}>
                      {label}
                    </span>
                  )}
                  {tab.kind === 'terminal' && term && (
                    <span className="ml-auto flex items-center gap-0.5">
                      <span
                        role="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (pinnedTerminals.has(tab.terminalId)) {
                            unpinTerminal(tab.terminalId);
                          } else {
                            pinTerminal(tab.terminalId);
                          }
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        className={`p-0.5 rounded transition-opacity cursor-pointer ${
                          pinnedTerminals.has(tab.terminalId)
                            ? 'opacity-65 hover:opacity-100 text-accent'
                            : 'opacity-0 group-hover/tab:opacity-40 hover:!opacity-100 text-text-secondary hover:text-accent'
                        }`}
                        title={pinnedTerminals.has(tab.terminalId) ? 'Unpin Terminal' : 'Pin Terminal'}
                      >
                        {pinnedTerminals.has(tab.terminalId) ? <PinOff className="w-2.5 h-2.5" /> : <Pin className="w-2.5 h-2.5" />}
                      </span>
                      {showFreezeHoverAction && (
                        <span
                          role="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFreezeForTerminal(tab.terminalId);
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                          className={`p-0.5 rounded transition-opacity cursor-pointer ${
                            frozenTerminals.has(tab.terminalId)
                              ? 'opacity-65 hover:opacity-100 text-info'
                              : 'opacity-0 group-hover/tab:opacity-40 hover:!opacity-100 text-text-secondary hover:text-info'
                          }`}
                          title={frozenTerminals.has(tab.terminalId) ? 'Resume Output' : 'Freeze Output'}
                        >
                          {frozenTerminals.has(tab.terminalId) ? <Play className="w-2.5 h-2.5" /> : <Pause className="w-2.5 h-2.5" />}
                        </span>
                      )}
                    </span>
                  )}
                  {tab.kind !== 'empty' && (
                    <button
                      type="button"
                      aria-label={`Close ${label}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCloseTab(tab.id);
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      className="ml-1 p-0.5 rounded text-text-muted opacity-0 group-hover/tab:opacity-100 hover:text-text-primary hover:bg-bg-hover transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );

              if (tab.kind === 'empty') {
                return (
                  <Reorder.Item
                    key={tab.id}
                    value={tab}
                    as="div"
                    drag={false}
                  >
                    {tabContent}
                  </Reorder.Item>
                );
              }

              return (
                <Reorder.Item
                  key={tab.id}
                  value={tab}
                  as="div"
                  whileDrag={{ scale: 1.02, zIndex: 50 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                >
                  <ContextMenu>
                    <ContextMenuTrigger asChild>{tabContent}</ContextMenuTrigger>
                    <ContextMenuContent className="w-44">
                      {tab.kind === 'terminal' && term && (
                        <>
                          <ContextMenuItem onClick={() => startRename(tab.terminalId, term.name)}>
                            Rename
                          </ContextMenuItem>
                          <ContextMenuSeparator />
                          <ContextMenuItem
                            onClick={() => refreshSessionName(tab.terminalId)}
                            disabled={term.nameSource === 'user'}
                          >
                            Refresh Name
                          </ContextMenuItem>
                          <ContextMenuItem onClick={() => resetTerminalName(tab.terminalId, idx)}>
                            Reset Name
                          </ContextMenuItem>
                          <ContextMenuSeparator />
                          {term.poppedOut ? (
                            <>
                              <ContextMenuItem onClick={() => handlePopOut(tab.terminalId)}>
                                <ExternalLink className="mr-2 h-3.5 w-3.5" />
                                Focus Window
                              </ContextMenuItem>
                              <ContextMenuItem onClick={() => handleDockBack(tab.terminalId)}>
                                Dock Back
                              </ContextMenuItem>
                            </>
                          ) : (
                            <ContextMenuItem onClick={() => handlePopOut(tab.terminalId)}>
                              <ExternalLink className="mr-2 h-3.5 w-3.5" />
                              Pop Out
                            </ContextMenuItem>
                          )}
                          <ContextMenuSeparator />
                          {pinnedTerminals.has(tab.terminalId) ? (
                            <ContextMenuItem onClick={() => unpinTerminal(tab.terminalId)}>
                              <PinOff className="mr-2 h-3.5 w-3.5" />
                              Unpin Terminal
                            </ContextMenuItem>
                          ) : (
                            <ContextMenuItem onClick={() => pinTerminal(tab.terminalId)}>
                              <Pin className="mr-2 h-3.5 w-3.5" />
                              Pin Terminal
                            </ContextMenuItem>
                          )}
                          <ContextMenuSeparator />
                          {frozenTerminals.has(tab.terminalId) ? (
                            <ContextMenuItem onClick={() => toggleFreezeForTerminal(tab.terminalId)}>
                              <Play className="mr-2 h-3.5 w-3.5" />
                              Resume Output
                            </ContextMenuItem>
                          ) : (
                            <ContextMenuItem onClick={() => toggleFreezeForTerminal(tab.terminalId)}>
                              <Pause className="mr-2 h-3.5 w-3.5" />
                              Freeze Output
                            </ContextMenuItem>
                          )}
                          <ContextMenuItem onClick={() => handleRestartShell(tab.terminalId)}>
                            <RotateCcw className="mr-2 h-3.5 w-3.5" />
                            Restart Shell
                          </ContextMenuItem>
                          <ContextMenuSeparator />
                          <ContextMenuItem onClick={() => handleCloseTab(tab.id)}>
                            Close
                          </ContextMenuItem>
                        </>
                      )}
                      {tab.kind === 'editor' && (
                        <>
                          <ContextMenuItem onClick={() => handleCloseTab(tab.id)}>
                            Close
                          </ContextMenuItem>
                          <ContextMenuItem
                            onClick={() => closeOtherTabs(tab.id)}
                            disabled={leaf.tabs.length <= 1}
                          >
                            Close Others
                          </ContextMenuItem>
                        </>
                      )}
                      {tab.kind === 'panel' && (
                        <ContextMenuItem onClick={() => handleCloseTab(tab.id)}>
                          Close
                        </ContextMenuItem>
                      )}
                    </ContextMenuContent>
                  </ContextMenu>
                </Reorder.Item>
              );
            })}
          </AnimatePresence>
        </Reorder.Group>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Add tab"
              onMouseDown={(e) => e.stopPropagation()}
              disabled={creatingTerminal}
              className="flex items-center gap-0.5 px-2 h-full text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer disabled:cursor-wait disabled:text-text-muted"
            >
              {creatingTerminal ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              <ChevronDown className="w-2.5 h-2.5 opacity-50" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[180px]">
            {shells.length > 0 ? (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <SquareTerminal className="w-3.5 h-3.5 mr-2" />
                  New Terminal
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {shells.map((shell) => (
                    <DropdownMenuItem
                      key={shell.path}
                      onClick={() => handleNewTerminal(shell.path)}
                    >
                      {shell.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ) : (
              <DropdownMenuItem onClick={() => handleNewTerminal()}>
                <SquareTerminal className="w-3.5 h-3.5 mr-2" />
                New Terminal
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={handleOpenFile}>
              <FileCode2 className="w-3.5 h-3.5 mr-2" />
              Open File…
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Layers className="w-3.5 h-3.5 mr-2" />
                Open Panel
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {Object.keys(PANEL_LABELS).map((panelId) => {
                  const Icon = PANEL_ICONS[panelId] ?? Layers;
                  return (
                    <DropdownMenuItem
                      key={panelId}
                      onClick={() => handleOpenPanel(panelId)}
                    >
                      <Icon className="w-3.5 h-3.5 mr-2" />
                      {PANEL_LABELS[panelId]}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex-1 min-h-0 relative">
        {activeTab ? (
          <LeafTabContent
            tab={activeTab}
            onCloseSelf={() => handleCloseTab(activeTab.id)}
          />
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  );
}

interface LeafTabContentProps {
  tab: LeafTab;
  onCloseSelf: () => void;
}

function LeafTabContent({ tab, onCloseSelf }: LeafTabContentProps): ReactElement {
  switch (tab.kind) {
    case 'terminal':
      return (
        <ErrorBoundary name="Terminal">
          <Terminal terminalId={tab.terminalId} />
        </ErrorBoundary>
      );
    case 'editor':
      return (
        <ErrorBoundary name="Editor">
          <Editor filePath={tab.filePath} onClose={onCloseSelf} inline />
        </ErrorBoundary>
      );
    case 'panel':
      return (
        <ErrorBoundary name={PANEL_LABELS[tab.panelId] ?? tab.panelId}>
          {renderPanel(tab, onCloseSelf)}
        </ErrorBoundary>
      );
    case 'empty':
      return <EmptyState />;
  }
}

function EmptyState(): ReactElement {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center text-text-tertiary text-xs px-6">
        <LayoutPanelLeft className="w-8 h-8 mx-auto mb-2 text-text-muted" />
        <p>No terminal</p>
        <p className="mt-1 text-text-muted">
          Press{' '}
          <kbd className="px-1.5 py-0.5 rounded bg-bg-secondary border border-border-subtle text-[10px]">
            Ctrl+Shift+T
          </kbd>{' '}
          to create one
        </p>
      </div>
    </div>
  );
}
