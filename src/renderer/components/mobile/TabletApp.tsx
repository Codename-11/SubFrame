/**
 * Tablet layout shell (768-1023px, web mode only).
 * - Collapsed icon sidebar on left (54px) — tap icons to expand as overlay
 * - Terminal area fills center
 * - Right panel slides in as overlay from right
 * Reuses existing Sidebar, TerminalArea, RightPanel, ActivityBar, StatusBar.
 */

import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sidebar } from '../Sidebar';
import { TerminalArea } from '../TerminalArea';
import { RightPanel } from '../RightPanel';
import { ActivityBar } from '../ActivityBar';
import { StatusBar } from '../StatusBar';
import { ErrorBoundary } from '../ErrorBoundary';
import { useUIStore } from '../../stores/useUIStore';

export function TabletApp() {
  const sidebarState = useUIStore((s) => s.sidebarState);
  const setSidebarState = useUIStore((s) => s.setSidebarState);
  const activePanel = useUIStore((s) => s.activePanel);
  const closeRightPanel = useUIStore((s) => s.closeRightPanel);

  // On mount, ensure sidebar starts collapsed
  const initialized = useRef(false);
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      setSidebarState('collapsed');
    }
  }, [setSidebarState]);

  const sidebarExpanded = sidebarState === 'expanded';

  const closeSidebarOverlay = () => {
    setSidebarState('collapsed');
  };

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-bg-deep text-text-primary font-sans">
      {/* Collapsed icon sidebar — always visible at 54px */}
      {!sidebarExpanded && (
        <div className="relative flex-shrink-0 h-full z-20" style={{ width: 54 }}>
          <ErrorBoundary name="Sidebar">
            <Sidebar />
          </ErrorBoundary>
        </div>
      )}

      {/* Placeholder to maintain layout when sidebar is expanded as overlay */}
      {sidebarExpanded && (
        <div className="flex-shrink-0 h-full" style={{ width: 54 }} />
      )}

      {/* Main content — terminal area fills remaining space */}
      <div className="flex-1 min-w-0 flex flex-col bg-bg-deep">
        <div id="terminal-container-react" className="flex-1 min-h-0">
          <ErrorBoundary name="Terminal">
            <TerminalArea />
          </ErrorBoundary>
        </div>
        <ActivityBar />
        <StatusBar />
      </div>

      {/* Expanded sidebar overlay */}
      <AnimatePresence>
        {sidebarExpanded && (
          <>
            {/* Backdrop */}
            <motion.div
              key="sidebar-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/40 z-30"
              onClick={closeSidebarOverlay}
            />
            {/* Full sidebar panel */}
            <motion.div
              key="sidebar-overlay"
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="fixed top-0 left-0 bottom-0 z-40 bg-bg-primary border-r border-border-subtle shadow-lg overflow-hidden"
              style={{ width: 260 }}
            >
              <ErrorBoundary name="Sidebar">
                <Sidebar />
              </ErrorBoundary>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Right panel overlay */}
      <AnimatePresence>
        {activePanel && (
          <>
            {/* Backdrop */}
            <motion.div
              key="right-panel-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/40 z-30"
              onClick={closeRightPanel}
            />
            {/* Right panel */}
            <motion.div
              key="right-panel-overlay"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="fixed top-0 right-0 bottom-0 z-40 bg-bg-primary border-l border-border-subtle shadow-lg overflow-hidden"
              style={{ width: 380 }}
            >
              <ErrorBoundary name="Right Panel">
                <RightPanel />
              </ErrorBoundary>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
