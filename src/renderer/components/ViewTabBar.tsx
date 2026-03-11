import React from 'react';
import { useUIStore, type FullViewContent, getTabIdForContent } from '../stores/useUIStore';
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
} from 'lucide-react';

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

export function ViewTabBar() {
  const openTabs = useUIStore(s => s.openTabs);
  const fullViewContent = useUIStore(s => s.fullViewContent);
  const setFullViewContent = useUIStore(s => s.setFullViewContent);
  const closeTab = useUIStore(s => s.closeTab);

  // Map sub-views to their parent tab for active highlighting
  const activeTabId = fullViewContent ? getTabIdForContent(fullViewContent) : 'terminal';

  // Don't render if only terminal tab is open
  if (openTabs.length <= 1) return null;

  return (
    <div className="flex items-center bg-bg-secondary border-b border-border-subtle overflow-x-auto shrink-0">
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
  );
}
