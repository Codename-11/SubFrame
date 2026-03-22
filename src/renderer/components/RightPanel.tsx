/**
 * RightPanel — Container for all right-side panels.
 * Panels are grouped: solo panels show a title header, grouped panels show
 * only their group's tabs. Terminal bar buttons map to groups:
 *   - Sub-Tasks → solo
 *   - Agent → activity, sessions, history, prompts, skills, plugins (tabbed)
 *   - GitHub → issues, PRs, branches, worktrees (tabbed)
 *   - Overview → full-view (handled by TerminalArea, not here)
 */

import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ListTodo,
  MessageSquare,
  Puzzle,
  CircleDot,
  GitPullRequest,
  GitBranch,
  FolderGit2,
  FileDiff,
  Clock,
  LayoutDashboard,
  FileText,
  Heart,
  Cpu,
  Activity,
  Zap,
  BookMarked,
  Workflow,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Maximize2,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import { useUIStore } from '../stores/useUIStore';
import { cn } from '../lib/utils';
import { ErrorBoundary } from './ErrorBoundary';
import { TasksPanel } from './TasksPanel';
import { SessionsPanel } from './SessionsPanel';
import { PluginsPanel } from './PluginsPanel';
import { GithubIssuesPanel, GithubPRsPanel, GithubBranchesPanel, GithubWorktreesPanel, GithubChangesPanel } from './GithubPanel';
import { HistoryPanel } from './HistoryPanel';
import { OverviewPanel } from './OverviewPanel';
import { AIFilesPanel } from './AIFilesPanel';
import { SubFrameHealthPanel } from './SubFrameHealthPanel';
import { AgentStateView } from './AgentStateView';
import { SkillsPanel } from './SkillsPanel';
import { PromptsPanel } from './PromptsPanel';
import { PipelinePanel } from './PipelinePanel';
import { SystemPanel } from './SystemPanel';

type PanelId = 'tasks' | 'sessions' | 'plugins' | 'gitChanges' | 'githubIssues' | 'githubPRs' | 'githubBranches' | 'githubWorktrees' | 'history' | 'overview' | 'aiFiles' | 'subframeHealth' | 'agentState' | 'skills' | 'prompts' | 'pipeline' | 'system';

interface PanelDef {
  id: PanelId;
  label: string;
  icon: typeof ListTodo;
  shortcut?: string;
}

/** All panel definitions */
const ALL_PANELS: Record<PanelId, PanelDef> = {
  tasks:           { id: 'tasks',           label: 'Sub-Tasks',  icon: ListTodo,       shortcut: 'Ctrl+Shift+S' },
  sessions:        { id: 'sessions',        label: 'Sessions',   icon: MessageSquare },
  plugins:         { id: 'plugins',         label: 'Plugins',    icon: Puzzle,         shortcut: 'Ctrl+Shift+X' },
  gitChanges:      { id: 'gitChanges',      label: 'Changes',    icon: FileDiff,       shortcut: 'Ctrl+Shift+G' },
  githubIssues:    { id: 'githubIssues',    label: 'Issues',     icon: CircleDot },
  githubPRs:       { id: 'githubPRs',       label: 'PRs',        icon: GitPullRequest },
  githubBranches:  { id: 'githubBranches',  label: 'Branches',   icon: GitBranch },
  githubWorktrees: { id: 'githubWorktrees', label: 'Worktrees',  icon: FolderGit2 },
  overview:        { id: 'overview',        label: 'Overview',   icon: LayoutDashboard },
  aiFiles:         { id: 'aiFiles',         label: 'AI Files',   icon: FileText },
  subframeHealth:  { id: 'subframeHealth',  label: 'SubFrame Health', icon: Heart },
  history:         { id: 'history',         label: 'History',    icon: Clock,          shortcut: 'Ctrl+Shift+H' },
  agentState:      { id: 'agentState',      label: 'Activity',   icon: Activity,       shortcut: 'Ctrl+Shift+A' },
  skills:          { id: 'skills',          label: 'Skills',     icon: Zap },
  prompts:         { id: 'prompts',         label: 'Prompts',    icon: BookMarked,     shortcut: 'Ctrl+Shift+L' },
  pipeline:        { id: 'pipeline',        label: 'Pipeline',   icon: Workflow,       shortcut: 'Ctrl+Shift+Y' },
  system:          { id: 'system',          label: 'System',     icon: Cpu,            shortcut: 'Ctrl+Shift+U' },
};

/**
 * Panel groups — determines which tabs show together.
 * Solo panels: array of 1 (no tab bar, just title header).
 * Grouped panels: array of N (shows tab bar with those tabs).
 */
interface PanelGroup {
  panels: PanelId[];
  label: string;
}

const PANEL_GROUPS: PanelGroup[] = [
  { panels: ['tasks'],                                                                      label: 'Sub-Tasks' },
  { panels: ['gitChanges', 'githubIssues', 'githubPRs', 'githubBranches', 'githubWorktrees'], label: 'GitHub' },
  { panels: ['agentState', 'sessions', 'history', 'skills', 'plugins'],                     label: 'Agent' },
  { panels: ['prompts'],                                                                    label: 'Prompts' },
  { panels: ['pipeline'],                                                                   label: 'Pipeline' },
  { panels: ['overview', 'aiFiles', 'subframeHealth', 'system'],                              label: 'Project' },
];

/** Find which group a panel belongs to */
function getGroup(panelId: PanelId): PanelId[] {
  return PANEL_GROUPS.find((g) => g.panels.includes(panelId))?.panels || [panelId];
}

/** Find group index for a panel */
function getGroupIndex(panelId: PanelId): number {
  return PANEL_GROUPS.findIndex((g) => g.panels.includes(panelId));
}

const panelComponents: Record<PanelId, React.ComponentType> = {
  tasks: TasksPanel,
  sessions: SessionsPanel,
  plugins: PluginsPanel,
  gitChanges: GithubChangesPanel,
  githubIssues: GithubIssuesPanel,
  githubPRs: GithubPRsPanel,
  githubBranches: GithubBranchesPanel,
  githubWorktrees: GithubWorktreesPanel,
  history: HistoryPanel,
  overview: OverviewPanel,
  aiFiles: AIFilesPanel,
  subframeHealth: SubFrameHealthPanel,
  agentState: AgentStateView,
  skills: SkillsPanel,
  prompts: PromptsPanel,
  pipeline: PipelinePanel,
  system: SystemPanel,
};

/** Panels that can be opened as a full-view tab (maps panel ID to FullViewContent ID) */
const PANEL_TO_FULLVIEW: Partial<Record<PanelId, string>> = {
  tasks: 'tasks',
  overview: 'overview',
  agentState: 'agentState',
  pipeline: 'pipeline',
};

export function RightPanel() {
  const activePanel = useUIStore((s) => s.activePanel) as PanelId | null;
  const setActivePanel = useUIStore((s) => s.setActivePanel);
  const rightPanelCollapsed = useUIStore((s) => s.rightPanelCollapsed);
  const setRightPanelCollapsed = useUIStore((s) => s.setRightPanelCollapsed);
  const rightPanelWidth = useUIStore((s) => s.rightPanelWidth);
  const setRightPanelWidth = useUIStore((s) => s.setRightPanelWidth);
  const closeRightPanel = useUIStore((s) => s.closeRightPanel);
  const openTab = useUIStore((s) => s.openTab);
  const [expandedDrawer, setExpandedDrawer] = useState<number | null>(null);
  // Keep-alive: track panels that have been mounted at least once
  const visitedPanelsRef = useRef<Set<PanelId>>(new Set());
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    if (activePanel && !visitedPanelsRef.current.has(activePanel)) {
      visitedPanelsRef.current.add(activePanel);
      forceUpdate((n) => n + 1);
    }
  }, [activePanel]);

  if (!activePanel) return null;

  const group = getGroup(activePanel);
  const isSolo = group.length === 1;
  const activeDef = ALL_PANELS[activePanel];
  const activeGroupIdx = getGroupIndex(activePanel);

  // ── Collapsed: vertical icon strip with drawer groups ──────────────────
  if (rightPanelCollapsed) {
    return (
      <div className="flex flex-col items-center bg-bg-primary h-full w-full border-l border-border-subtle">
        <div className="flex-shrink-0 py-2 pb-1">
          <button
            onClick={() => setRightPanelCollapsed(false)}
            className="p-1.5 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer"
            title="Expand panel"
            aria-label="Expand panel"
          >
            <ChevronLeft size={14} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-none flex flex-col items-center gap-0.5 py-1 w-full px-1">
          {PANEL_GROUPS.map((pg, groupIdx) => {
            const isMulti = pg.panels.length > 1;
            const groupContainsActive = groupIdx === activeGroupIdx;
            const isDrawerOpen = expandedDrawer === groupIdx;
            const representativePanel = pg.panels[0];
            const RepIcon = ALL_PANELS[representativePanel].icon;

            if (!isMulti) {
              // Solo group — single icon, click to expand
              const def = ALL_PANELS[representativePanel];
              return (
                <button
                  key={groupIdx}
                  onClick={() => {
                    setActivePanel(representativePanel);
                    setRightPanelCollapsed(false);
                    setExpandedDrawer(null);
                  }}
                  className={cn(
                    'p-2 rounded transition-colors cursor-pointer flex-shrink-0',
                    groupContainsActive
                      ? 'text-accent bg-accent-subtle'
                      : 'text-text-tertiary hover:text-text-primary hover:bg-bg-hover'
                  )}
                  title={def.shortcut ? `${def.label} (${def.shortcut})` : def.label}
                  aria-label={def.shortcut ? `${def.label} (${def.shortcut})` : def.label}
                >
                  <RepIcon size={16} />
                </button>
              );
            }

            // Multi-panel group — icon with drawer toggle
            return (
              <div key={groupIdx} className="w-full flex flex-col items-center">
                <button
                  onClick={() => setExpandedDrawer(isDrawerOpen ? null : groupIdx)}
                  className={cn(
                    'p-2 rounded transition-colors cursor-pointer flex-shrink-0 relative',
                    groupContainsActive
                      ? 'text-accent bg-accent-subtle'
                      : 'text-text-tertiary hover:text-text-primary hover:bg-bg-hover'
                  )}
                  title={pg.label}
                  aria-label={pg.label}
                >
                  <RepIcon size={16} />
                  <ChevronDown
                    size={8}
                    className={cn(
                      'absolute -bottom-0.5 left-1/2 -translate-x-1/2 transition-transform duration-150',
                      isDrawerOpen ? 'rotate-180' : '',
                      groupContainsActive ? 'text-accent/60' : 'text-text-muted'
                    )}
                  />
                </button>

                {/* Drawer: sub-panel icons */}
                <AnimatePresence>
                  {isDrawerOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15, ease: 'easeInOut' }}
                      className="overflow-hidden w-full"
                    >
                      <div className="flex flex-col items-center gap-0.5 py-1 mx-1 border-l border-border-subtle ml-3">
                        {pg.panels.map((panelId) => {
                          const def = ALL_PANELS[panelId];
                          const Icon = def.icon;
                          const isActive = activePanel === panelId;
                          return (
                            <button
                              key={panelId}
                              onClick={() => {
                                setActivePanel(panelId);
                                setRightPanelCollapsed(false);
                                setExpandedDrawer(null);
                              }}
                              className={cn(
                                'p-1.5 rounded transition-colors cursor-pointer flex-shrink-0',
                                isActive
                                  ? 'text-accent bg-accent-subtle'
                                  : 'text-text-tertiary hover:text-text-primary hover:bg-bg-hover'
                              )}
                              title={def.shortcut ? `${def.label} (${def.shortcut})` : def.label}
                              aria-label={def.shortcut ? `${def.label} (${def.shortcut})` : def.label}
                            >
                              <Icon size={14} />
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Expanded ────────────────────────────────────────────────────────────
  const ActiveIcon = activeDef.icon;

  return (
    <div className="relative flex h-full w-full flex-col bg-bg-primary">
      {/* Resize handle — LEFT edge */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-accent/30 active:bg-accent/50 transition-colors z-10"
        onMouseDown={(e) => {
          e.preventDefault();
          const startX = e.clientX;
          const startWidth = rightPanelWidth;
          useUIStore.getState().setIsResizing(true);
          const onMouseMove = (ev: MouseEvent) => {
            const newWidth = Math.min(600, Math.max(380, startWidth - (ev.clientX - startX)));
            setRightPanelWidth(newWidth);
          };
          const cleanup = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', cleanup);
            window.removeEventListener('blur', cleanup);
            useUIStore.getState().setIsResizing(false);
          };
          document.addEventListener('mousemove', onMouseMove);
          document.addEventListener('mouseup', cleanup);
          window.addEventListener('blur', cleanup);
        }}
        onDoubleClick={() => setRightPanelWidth(380)}
        title="Drag to resize, double-click to reset"
      />

      {/* Header */}
      <div className="flex items-center gap-0.5 border-b border-border-subtle px-2 py-1.5 shrink-0">
        {/* Left: collapse + close */}
        <div className="flex items-center gap-0.5 mr-1">
          <button
            onClick={() => setRightPanelCollapsed(true)}
            className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer"
            title="Collapse panel"
            aria-label="Collapse panel"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={closeRightPanel}
            className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer"
            title="Close panel"
            aria-label="Close panel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {isSolo ? (
          /* Solo panel — show title with icon */
          <div className="flex items-center gap-1.5 px-1">
            <ActiveIcon size={14} className="text-accent" />
            <span className="text-xs font-semibold text-text-primary">{activeDef.label}</span>
          </div>
        ) : (
          /* Grouped panel — show group's tab buttons (scrollable for large groups) */
          <div className="flex-1 min-w-0 overflow-x-auto scrollbar-none">
            <div className="flex items-center gap-0.5">
              {group.map((panelId) => {
                const def = ALL_PANELS[panelId];
                const Icon = def.icon;
                const isActive = activePanel === panelId;
                return (
                  <button
                    key={panelId}
                    onClick={() => setActivePanel(panelId)}
                    className={cn(
                      'flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap cursor-pointer flex-shrink-0',
                      isActive
                        ? 'bg-bg-hover text-accent'
                        : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover/50'
                    )}
                    title={def.shortcut ? `${def.label} (${def.shortcut})` : def.label}
                    aria-label={def.shortcut ? `${def.label} (${def.shortcut})` : def.label}
                  >
                    <Icon size={13} />
                    <span>{def.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Open in tab button — only for panels that support full-view */}
        {PANEL_TO_FULLVIEW[activePanel] && (
          <TooltipProvider delayDuration={400}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => {
                    const fullViewId = PANEL_TO_FULLVIEW[activePanel]!;
                    openTab(fullViewId);
                  }}
                  className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer ml-auto flex-shrink-0"
                  aria-label="Open in tab"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Open in tab</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {/* Panel content — keep-alive: visited panels stay mounted, inactive hidden */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        {Array.from(visitedPanelsRef.current).map((panelId) => {
          const Component = panelComponents[panelId];
          const isActive = activePanel === panelId;
          return (
            <div
              key={panelId}
              className={cn('h-full w-full overflow-x-hidden', isActive ? 'block' : 'hidden')}
            >
              <ErrorBoundary name={ALL_PANELS[panelId].label}>
                <Component />
              </ErrorBoundary>
            </div>
          );
        })}
      </div>
    </div>
  );
}
