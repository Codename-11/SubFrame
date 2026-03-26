import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Bell,
  BookMarked,
  CircleDot,
  Clock,
  Cpu,
  FileDiff,
  FileText,
  FolderGit2,
  GitBranch,
  GitPullRequest,
  Heart,
  LayoutDashboard,
  ListTodo,
  MessageSquare,
  PlayCircle,
  Puzzle,
  Workflow,
  Zap,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useUIStore } from '../../stores/useUIStore';
import { OverviewPanel } from '../OverviewPanel';
import { AIFilesPanel } from '../AIFilesPanel';
import { SubFrameHealthPanel } from '../SubFrameHealthPanel';
import { SystemPanel } from '../SystemPanel';
import { TasksPanel } from '../TasksPanel';
import { GithubBranchesPanel, GithubChangesPanel, GithubIssuesPanel, GithubNotificationsPanel, GithubPRsPanel, GithubWorkflowsPanel, GithubWorktreesPanel } from '../GithubPanel';
import { AgentStateView } from '../AgentStateView';
import { SessionsPanel } from '../SessionsPanel';
import { HistoryPanel } from '../HistoryPanel';
import { SkillsPanel } from '../SkillsPanel';
import { PluginsPanel } from '../PluginsPanel';
import { PromptsPanel } from '../PromptsPanel';
import { PipelinePanel } from '../PipelinePanel';

type MobilePanelId =
  | 'tasks'
  | 'overview'
  | 'aiFiles'
  | 'subframeHealth'
  | 'system'
  | 'gitChanges'
  | 'githubIssues'
  | 'githubPRs'
  | 'githubBranches'
  | 'githubWorktrees'
  | 'githubWorkflows'
  | 'githubNotifications'
  | 'agentState'
  | 'sessions'
  | 'history'
  | 'skills'
  | 'plugins'
  | 'prompts'
  | 'pipeline';

const PANEL_SECTIONS: Array<{
  title: string;
  panels: Array<{ id: MobilePanelId; label: string; icon: typeof LayoutDashboard }>;
}> = [
  {
    title: 'Work',
    panels: [
      { id: 'tasks', label: 'Sub-Tasks', icon: ListTodo },
    ],
  },
  {
    title: 'Project',
    panels: [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard },
      { id: 'aiFiles', label: 'AI Files', icon: FileText },
      { id: 'subframeHealth', label: 'Health', icon: Heart },
      { id: 'system', label: 'System', icon: Cpu },
    ],
  },
  {
    title: 'GitHub',
    panels: [
      { id: 'gitChanges', label: 'Changes', icon: FileDiff },
      { id: 'githubIssues', label: 'Issues', icon: CircleDot },
      { id: 'githubPRs', label: 'PRs', icon: GitPullRequest },
      { id: 'githubBranches', label: 'Branches', icon: GitBranch },
      { id: 'githubWorktrees', label: 'Worktrees', icon: FolderGit2 },
      { id: 'githubWorkflows', label: 'Workflows', icon: PlayCircle },
      { id: 'githubNotifications', label: 'Alerts', icon: Bell },
    ],
  },
  {
    title: 'Agent',
    panels: [
      { id: 'agentState', label: 'Activity', icon: Activity },
      { id: 'sessions', label: 'Sessions', icon: MessageSquare },
      { id: 'history', label: 'History', icon: Clock },
      { id: 'skills', label: 'Skills', icon: Zap },
      { id: 'plugins', label: 'Plugins', icon: Puzzle },
    ],
  },
  {
    title: 'Automation',
    panels: [
      { id: 'prompts', label: 'Prompts', icon: BookMarked },
      { id: 'pipeline', label: 'Pipeline', icon: Workflow },
    ],
  },
];

function PanelBody({ panel }: { panel: MobilePanelId }) {
  switch (panel) {
    case 'tasks':
      return <TasksPanel />;
    case 'overview':
      return <OverviewPanel isFullView />;
    case 'aiFiles':
      return <AIFilesPanel />;
    case 'subframeHealth':
      return <SubFrameHealthPanel />;
    case 'system':
      return <SystemPanel isFullView />;
    case 'gitChanges':
      return <GithubChangesPanel />;
    case 'githubIssues':
      return <GithubIssuesPanel />;
    case 'githubPRs':
      return <GithubPRsPanel />;
    case 'githubBranches':
      return <GithubBranchesPanel />;
    case 'githubWorktrees':
      return <GithubWorktreesPanel />;
    case 'githubWorkflows':
      return <GithubWorkflowsPanel />;
    case 'githubNotifications':
      return <GithubNotificationsPanel />;
    case 'agentState':
      return <AgentStateView isFullView />;
    case 'sessions':
      return <SessionsPanel />;
    case 'history':
      return <HistoryPanel />;
    case 'skills':
      return <SkillsPanel />;
    case 'plugins':
      return <PluginsPanel />;
    case 'prompts':
      return <PromptsPanel />;
    case 'pipeline':
      return <PipelinePanel isFullView />;
    default:
      return null;
  }
}

export function MobilePanelsView() {
  const storeActivePanel = useUIStore((s) => s.activePanel);
  const setStoreActivePanel = useUIStore((s) => s.setActivePanel);
  const [fallbackPanel, setFallbackPanel] = useState<MobilePanelId>('tasks');

  useEffect(() => {
    if (!storeActivePanel) return;
    setFallbackPanel(storeActivePanel as MobilePanelId);
  }, [storeActivePanel]);

  const activePanel = (storeActivePanel ?? fallbackPanel) as MobilePanelId;
  const activeMeta = useMemo(
    () => PANEL_SECTIONS.flatMap((section) => section.panels).find((panel) => panel.id === activePanel),
    [activePanel]
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg-deep">
      <div className="border-b border-border-subtle bg-bg-primary/95 px-3 py-3 backdrop-blur">
        <div className="text-sm font-semibold text-text-primary">Panels</div>
        <div className="mt-1 text-xs text-text-muted">
          Access the same project, GitHub, agent, and automation panels that are available in the desktop right sidebar.
        </div>
      </div>

      <div className="border-b border-border-subtle bg-bg-primary/70 px-3 py-2">
        <div className="space-y-2 overflow-x-auto pb-1">
          {PANEL_SECTIONS.map((section) => (
            <div key={section.title} className="space-y-1">
              <div className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                {section.title}
              </div>
              <div className="flex gap-1.5">
                {section.panels.map((panel) => {
                  const Icon = panel.icon;
                  const isActive = panel.id === activePanel;
                  return (
                    <button
                      key={panel.id}
                      type="button"
                      onClick={() => {
                        setFallbackPanel(panel.id);
                        setStoreActivePanel(panel.id);
                      }}
                      className={cn(
                        'flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs whitespace-nowrap transition-colors',
                        isActive
                          ? 'border-accent bg-accent/15 text-accent'
                          : 'border-border-subtle bg-bg-deep text-text-secondary',
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{panel.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col bg-bg-deep">
        <div className="border-b border-border-subtle px-3 py-2 text-xs text-text-secondary">
          {activeMeta?.label ?? 'Panel'}
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <PanelBody panel={activePanel} />
        </div>
      </div>
    </div>
  );
}
