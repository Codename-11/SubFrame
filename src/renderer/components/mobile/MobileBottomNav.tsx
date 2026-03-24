/**
 * Mobile bottom navigation bar.
 * Fixed at the bottom of the viewport with four tabs:
 * Terminal, Tasks, Activity, Settings.
 */

import { motion } from 'framer-motion';
import { Terminal as TerminalIcon, ListTodo, Activity, Settings } from 'lucide-react';
import { cn } from '../../lib/utils';

export type MobileTab = 'terminal' | 'tasks' | 'activity' | 'settings';

interface MobileBottomNavProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
}

const tabs: { id: MobileTab; label: string; icon: typeof TerminalIcon }[] = [
  { id: 'terminal', label: 'Terminal', icon: TerminalIcon },
  { id: 'tasks', label: 'Tasks', icon: ListTodo },
  { id: 'activity', label: 'Activity', icon: Activity },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function MobileBottomNav({ activeTab, onTabChange }: MobileBottomNavProps) {
  return (
    <nav className="flex-shrink-0 h-14 bg-bg-primary border-t border-border-subtle flex items-center justify-around px-2 safe-area-bottom">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full',
              'transition-colors duration-150',
              isActive ? 'text-accent' : 'text-text-muted hover:text-text-secondary',
            )}
          >
            {isActive && (
              <motion.div
                layoutId="mobile-tab-indicator"
                className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-accent rounded-b"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <Icon className="size-5" />
            <span className="text-[10px] font-medium leading-none">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
