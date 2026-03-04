/**
 * RightPanel — Container for all right-side panels.
 * Panels are grouped: solo panels show a title header, grouped panels show
 * only their group's tabs. Terminal bar buttons map to groups:
 *   - Sub-Tasks → solo
 *   - Agent → activity, sessions, history, prompts, skills, plugins (tabbed)
 *   - GitHub → issues, PRs, branches, worktrees (tabbed)
 *   - Overview → full-view (handled by TerminalArea, not here)
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  ListTodo,
  MessageSquare,
  Puzzle,
  CircleDot,
  GitPullRequest,
  GitBranch,
  FolderGit2,
  Clock,
  LayoutDashboard,
  FileText,
  Heart,
  Activity,
  Zap,
  BookMarked,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useUIStore } from '../stores/useUIStore';
import { cn } from '../lib/utils';
import { ErrorBoundary } from './ErrorBoundary';
import { TasksPanel } from './TasksPanel';
import { SessionsPanel } from './SessionsPanel';
import { PluginsPanel } from './PluginsPanel';
import { GithubIssuesPanel, GithubPRsPanel, GithubBranchesPanel, GithubWorktreesPanel } from './GithubPanel';
import { HistoryPanel } from './HistoryPanel';
import { OverviewPanel } from './OverviewPanel';
import { AIFilesPanel } from './AIFilesPanel';
import { SubFrameHealthPanel } from './SubFrameHealthPanel';
import { AgentStateView } from './AgentStateView';
import { SkillsPanel } from './SkillsPanel';
import { PromptsPanel } from './PromptsPanel';

type PanelId = 'tasks' | 'sessions' | 'plugins' | 'githubIssues' | 'githubPRs' | 'githubBranches' | 'githubWorktrees' | 'history' | 'overview' | 'aiFiles' | 'subframeHealth' | 'agentState' | 'skills' | 'prompts';

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
  githubIssues:    { id: 'githubIssues',    label: 'Issues',     icon: CircleDot,      shortcut: 'Ctrl+Shift+G' },
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
};

/**
 * Panel groups — determines which tabs show together.
 * Solo panels: array of 1 (no tab bar, just title header).
 * Grouped panels: array of N (shows tab bar with those tabs).
 */
const PANEL_GROUPS: PanelId[][] = [
  ['tasks'],                                                              // Solo — Sub-Tasks
  ['agentState', 'sessions', 'history', 'prompts', 'skills', 'plugins'],    // Group — Agent hub
  ['githubIssues', 'githubPRs', 'githubBranches', 'githubWorktrees'],    // Group — GitHub hub
  ['overview'],                                                           // Solo — Overview
  ['aiFiles'],                                                            // Solo — AI Files
  ['subframeHealth'],                                                     // Solo — SubFrame Health
];

/** Find which group a panel belongs to */
function getGroup(panelId: PanelId): PanelId[] {
  return PANEL_GROUPS.find((g) => g.includes(panelId)) || [panelId];
}

const panelComponents: Record<PanelId, React.ComponentType> = {
  tasks: TasksPanel,
  sessions: SessionsPanel,
  plugins: PluginsPanel,
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
};

export function RightPanel() {
  const activePanel = useUIStore((s) => s.activePanel) as PanelId | null;
  const setActivePanel = useUIStore((s) => s.setActivePanel);
  const rightPanelCollapsed = useUIStore((s) => s.rightPanelCollapsed);
  const setRightPanelCollapsed = useUIStore((s) => s.setRightPanelCollapsed);
  const rightPanelWidth = useUIStore((s) => s.rightPanelWidth);
  const setRightPanelWidth = useUIStore((s) => s.setRightPanelWidth);
  const closeRightPanel = useUIStore((s) => s.closeRightPanel);

  if (!activePanel) return null;

  const group = getGroup(activePanel);
  const isSolo = group.length === 1;
  const activeDef = ALL_PANELS[activePanel];

  // ── Collapsed: vertical icon strip showing only current group's icons ───
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

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-none flex flex-col items-center gap-1 py-1">
          {group.map((panelId) => {
            const def = ALL_PANELS[panelId];
            const Icon = def.icon;
            const isActive = activePanel === panelId;
            return (
              <button
                key={panelId}
                onClick={() => {
                  setActivePanel(panelId);
                  setRightPanelCollapsed(false);
                }}
                className={cn(
                  'p-2 rounded transition-colors cursor-pointer flex-shrink-0',
                  isActive
                    ? 'text-accent bg-accent-subtle'
                    : 'text-text-tertiary hover:text-text-primary hover:bg-bg-hover'
                )}
                title={def.shortcut ? `${def.label} (${def.shortcut})` : def.label}
                aria-label={def.shortcut ? `${def.label} (${def.shortcut})` : def.label}
              >
                <Icon size={16} />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Expanded ────────────────────────────────────────────────────────────
  const ActiveComponent = panelComponents[activePanel];
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
            const newWidth = Math.min(600, Math.max(320, startWidth - (ev.clientX - startX)));
            setRightPanelWidth(newWidth);
          };
          const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            useUIStore.getState().setIsResizing(false);
          };
          document.addEventListener('mousemove', onMouseMove);
          document.addEventListener('mouseup', onMouseUp);
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
      </div>

      {/* Panel content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activePanel}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.15 }}
            className="h-full"
          >
            {ActiveComponent && (
              <ErrorBoundary name={activeDef.label} key={activePanel}>
                <ActiveComponent />
              </ErrorBoundary>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
