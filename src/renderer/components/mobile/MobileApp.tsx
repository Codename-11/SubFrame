/**
 * Mobile layout shell.
 * Renders a bottom tab bar and swaps content based on the active tab.
 * Reuses existing desktop components at full width.
 */

import { useState, useEffect } from 'react';
import { MobileBottomNav, type MobileTab } from './MobileBottomNav';
import { MobilePanelsView } from './MobilePanelsView';
import { TerminalArea } from '../TerminalArea';
import { TasksPanel } from '../TasksPanel';
import { ActivityBar } from '../ActivityBar';
import { useUIStore } from '../../stores/useUIStore';

function MobileTabContent({ tab }: { tab: MobileTab }) {
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen);

  // When the settings tab is selected, open the settings dialog
  // and show a placeholder behind it
  useEffect(() => {
    if (tab === 'settings') {
      setSettingsOpen(true);
    }
  }, [tab, setSettingsOpen]);

  switch (tab) {
    case 'terminal':
      return (
        <div className="flex-1 min-h-0 bg-bg-deep">
          <TerminalArea />
        </div>
      );
    case 'tasks':
      return (
        <div className="flex flex-1 min-h-0 flex-col bg-bg-deep">
          <TasksPanel />
        </div>
      );
    case 'panels':
      return <MobilePanelsView />;
    case 'activity':
      return (
        <div className="flex-1 min-h-0 overflow-auto bg-bg-deep">
          <ActivityBar />
        </div>
      );
    case 'settings':
      return (
        <div className="flex-1 flex items-center justify-center bg-bg-deep text-text-muted">
          <p className="text-sm">Settings panel is open</p>
        </div>
      );
    default:
      return null;
  }
}

export function MobileApp() {
  const [activeTab, setActiveTab] = useState<MobileTab>('terminal');
  const activePanel = useUIStore((s) => s.activePanel);

  useEffect(() => {
    if (activePanel === 'tasks') {
      setActiveTab('tasks');
    } else if (activePanel) {
      setActiveTab('panels');
    }
  }, [activePanel]);

  return (
    <div className="flex flex-col h-screen w-screen bg-bg-deep text-text-primary font-sans">
      <MobileTabContent tab={activeTab} />
      <MobileBottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
