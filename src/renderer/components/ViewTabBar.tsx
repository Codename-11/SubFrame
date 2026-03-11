import React from 'react';
import { useUIStore, type FullViewContent, getTabIdForContent } from '../stores/useUIStore';
import { useProjectStore } from '../stores/useProjectStore';
import {
  X,
  TerminalSquare,
  LayoutDashboard,
  GitFork,
  CheckSquare,
  BarChart3,
  Lightbulb,
  Workflow,
  Bot,
  Keyboard,
  ListTodo,
  Activity,
  PanelLeft,
  FolderOpen,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';

const TAB_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  terminal: TerminalSquare,
  overview: LayoutDashboard,
  structureMap: GitFork,
  tasks: CheckSquare,
  stats: BarChart3,
  decisions: Lightbulb,
  pipeline: Workflow,
  agentState: Bot,
  shortcuts: Keyboard,
};

/** View shortcut buttons shown on the right side of the tab bar */
const VIEW_SHORTCUTS = [
  { id: 'overview' as const, label: 'Overview', icon: LayoutDashboard, shortcut: 'Ctrl+Shift+O' },
  { id: 'tasks' as const, label: 'Sub-Tasks', icon: ListTodo, shortcut: 'Ctrl+Shift+K' },
  { id: 'agentState' as const, label: 'Agent Activity', icon: Activity, shortcut: 'Ctrl+Shift+A' },
  { id: 'pipeline' as const, label: 'Pipeline', icon: Workflow, shortcut: 'Ctrl+Shift+Y' },
] as const;

export function ViewTabBar() {
  const openTabs = useUIStore(s => s.openTabs);
  const fullViewContent = useUIStore(s => s.fullViewContent);
  const setFullViewContent = useUIStore(s => s.setFullViewContent);
  const closeTab = useUIStore(s => s.closeTab);
  const toggleFullView = useUIStore(s => s.toggleFullView);
  const sidebarState = useUIStore(s => s.sidebarState);
  const setSidebarState = useUIStore(s => s.setSidebarState);
  const currentProjectPath = useProjectStore(s => s.currentProjectPath);
  const workspaceName = useProjectStore(s => s.workspaceName);

  // Map sub-views to their parent tab for active highlighting
  const activeTabId = fullViewContent ? getTabIdForContent(fullViewContent) : 'terminal';

  // Extract project folder name from path
  const projectName = currentProjectPath
    ? currentProjectPath.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? null
    : null;

  return (
    <div className="flex items-center bg-bg-secondary border-b border-border-subtle shrink-0">
      {/* Workspace + project badge — visible when sidebar is not expanded */}
      {sidebarState !== 'expanded' && (
        <TooltipProvider delayDuration={400}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setSidebarState('expanded')}
                className="flex items-center gap-1 px-2.5 py-1 text-xs
                           hover:bg-bg-hover transition-colors cursor-pointer
                           border-r border-border-subtle shrink-0"
              >
                <FolderOpen className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                {workspaceName && workspaceName !== 'default' && (
                  <>
                    <span className="font-semibold text-text-primary truncate max-w-[100px]">{workspaceName}</span>
                    {projectName && <span className="text-text-muted">/</span>}
                  </>
                )}
                {projectName && (
                  <span className="text-text-secondary truncate max-w-[120px]">{projectName}</span>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{workspaceName && workspaceName !== 'default' ? `${workspaceName} — ` : ''}{currentProjectPath}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Open tabs */}
      <div className="flex items-center overflow-x-auto scrollbar-none flex-1 min-w-0">
        {openTabs.map(tab => {
          const isActive = tab.id === activeTabId;
          const Icon = TAB_ICONS[tab.id];
          return (
            <button
              key={tab.id}
              onClick={() => {
                const content = tab.id === 'terminal' ? null : (tab.id as FullViewContent);
                setFullViewContent(content);
              }}
              className={`group flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 transition-colors shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-bg-primary text-text-primary border-accent'
                  : 'text-text-tertiary hover:text-text-secondary hover:bg-bg-hover border-transparent'
              }`}
            >
              {Icon && <Icon className="w-3.5 h-3.5" />}
              <span>{tab.label}</span>
              {tab.closable && (
                <span
                  role="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className={`ml-1 p-0.5 rounded hover:bg-bg-tertiary transition-colors ${
                    isActive ? 'opacity-60 hover:opacity-100' : 'opacity-0 group-hover:opacity-60 hover:!opacity-100'
                  }`}
                >
                  <X className="w-3 h-3" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* View shortcut buttons + sidebar toggle on the right */}
      <div className="flex items-center gap-0.5 px-1.5 flex-shrink-0">
        <div className="h-4 w-px bg-border-subtle mx-0.5" />

        {VIEW_SHORTCUTS.map((view) => {
          const Icon = view.icon;
          const isActive = fullViewContent === view.id;
          return (
            <TooltipProvider key={view.id} delayDuration={400}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => toggleFullView(view.id)}
                    className={`flex items-center justify-center h-6 w-6 rounded transition-colors cursor-pointer ${
                      isActive
                        ? 'text-accent bg-accent-subtle'
                        : 'text-text-tertiary hover:text-text-secondary hover:bg-bg-hover'
                    }`}
                    aria-label={`${view.label} (${view.shortcut})`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>{view.label} ({view.shortcut})</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}

        <div className="h-4 w-px bg-border-subtle mx-0.5" />

        {/* Sidebar toggle */}
        <TooltipProvider delayDuration={400}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setSidebarState(sidebarState === 'expanded' ? 'collapsed' : 'expanded')}
                className={`flex items-center justify-center h-6 w-6 rounded transition-colors cursor-pointer ${
                  sidebarState === 'collapsed'
                    ? 'text-accent bg-accent-subtle'
                    : 'text-text-tertiary hover:text-text-secondary hover:bg-bg-hover'
                }`}
                aria-label={sidebarState === 'expanded' ? 'Collapse sidebar' : 'Expand sidebar'}
              >
                <PanelLeft className="w-3.5 h-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{sidebarState === 'expanded' ? 'Collapse Sidebar' : 'Expand Sidebar'} (Ctrl+B)</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
