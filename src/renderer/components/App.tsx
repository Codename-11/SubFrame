import { useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { TerminalArea } from './TerminalArea';
import { RightPanel } from './RightPanel';
import { SettingsPanel } from './SettingsPanel';
import { KeyboardShortcuts } from './KeyboardShortcuts';
import { Editor } from './Editor';
import { ErrorBoundary } from './ErrorBoundary';
import { useUIStore } from '../stores/useUIStore';
import { useProjectStore } from '../stores/useProjectStore';

/**
 * Root application layout.
 * Three regions: sidebar (left), terminal area (center), right panel (conditionally visible).
 * Keyboard shortcuts are wired here to match the original app.
 */
export function App() {
  const sidebarState = useUIStore((s) => s.sidebarState);
  const sidebarWidth = useUIStore((s) => s.sidebarWidth);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const setSidebarState = useUIStore((s) => s.setSidebarState);
  const activePanel = useUIStore((s) => s.activePanel);
  const rightPanelCollapsed = useUIStore((s) => s.rightPanelCollapsed);
  const rightPanelWidth = useUIStore((s) => s.rightPanelWidth);
  const togglePanel = useUIStore((s) => s.togglePanel);
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen);
  const setShortcutsHelpOpen = useUIStore((s) => s.setShortcutsHelpOpen);
  const isResizing = useUIStore((s) => s.isResizing);
  const editorFilePath = useUIStore((s) => s.editorFilePath);
  const setEditorFilePath = useUIStore((s) => s.setEditorFilePath);
  const requestSidebarFocus = useUIStore((s) => s.requestSidebarFocus);
  const selectAdjacentProject = useProjectStore((s) => s.selectAdjacentProject);

  // Keyboard shortcuts — matching original src/renderer/index.js
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const modKey = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // Ctrl/Cmd+B — Toggle sidebar (expanded <-> hidden)
      if (modKey && !e.shiftKey && key === 'b') {
        e.preventDefault();
        toggleSidebar();
      }

      // Ctrl/Cmd+Shift+S — Toggle tasks panel (Sub-tasks)
      if (modKey && e.shiftKey && key === 's') {
        e.preventDefault();
        togglePanel('tasks');
      }

      // Ctrl/Cmd+Shift+P — Toggle plugins panel
      if (modKey && e.shiftKey && key === 'p') {
        e.preventDefault();
        togglePanel('plugins');
      }

      // Ctrl/Cmd+Shift+G — Toggle GitHub panel
      if (modKey && e.shiftKey && key === 'g') {
        e.preventDefault();
        togglePanel('githubIssues');
      }

      // Ctrl/Cmd+Shift+H — Toggle history panel
      if (modKey && e.shiftKey && key === 'h') {
        e.preventDefault();
        togglePanel('history');
      }

      // Ctrl/Cmd+Shift+A — Toggle agent activity panel
      if (modKey && e.shiftKey && key === 'a') {
        e.preventDefault();
        togglePanel('agentState');
      }

      // Ctrl/Cmd+, — Toggle settings
      if (modKey && !e.shiftKey && key === ',') {
        e.preventDefault();
        setSettingsOpen(true);
      }

      // Ctrl/Cmd+Shift+[ — Previous project
      if (modKey && e.shiftKey && e.key === '[') {
        e.preventDefault();
        selectAdjacentProject(-1);
      }

      // Ctrl/Cmd+Shift+] — Next project
      if (modKey && e.shiftKey && e.key === ']') {
        e.preventDefault();
        selectAdjacentProject(1);
      }

      // Ctrl/Cmd+E — Focus project list
      if (modKey && !e.shiftKey && key === 'e') {
        e.preventDefault();
        requestSidebarFocus('projects');
      }

      // Ctrl/Cmd+Shift+E — Focus file tree
      if (modKey && e.shiftKey && key === 'e') {
        e.preventDefault();
        requestSidebarFocus('files');
      }

      // Ctrl/Cmd+? (Ctrl+Shift+/) — Keyboard shortcuts help
      if (modKey && e.shiftKey && (key === '?' || key === '/')) {
        e.preventDefault();
        setShortcutsHelpOpen(true);
      }
    },
    [toggleSidebar, togglePanel, setSettingsOpen, setShortcutsHelpOpen, selectAdjacentProject, requestSidebarFocus]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Compute sidebar pixel width for CSS
  const resolvedSidebarWidth =
    sidebarState === 'hidden' ? 0 : sidebarState === 'collapsed' ? 54 : sidebarWidth;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg-deep text-text-primary font-sans">
      {/* Floating logo — shown when sidebar is fully hidden */}
      {sidebarState === 'hidden' && (
        <button
          onClick={() => setSidebarState('expanded')}
          className="fixed top-3 left-3 z-50 flex h-9 w-9 items-center justify-center rounded-md
                     bg-bg-secondary/80 backdrop-blur border border-border-subtle
                     hover:bg-bg-hover transition-colors cursor-pointer"
          title="Show sidebar (Ctrl+B)"
          dangerouslySetInnerHTML={{
            __html: logoSvg(28),
          }}
        />
      )}

      {/* Sidebar */}
      <AnimatePresence initial={false}>
        {sidebarState !== 'hidden' && (
          <motion.div
            key="sidebar"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: resolvedSidebarWidth, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: isResizing ? 0 : 0.2, ease: 'easeInOut' }}
            className="relative flex-shrink-0 overflow-hidden"
          >
            <ErrorBoundary name="Sidebar"><Sidebar /></ErrorBoundary>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content area — terminal placeholder + right panel */}
      <div className="flex flex-1 min-w-0">
        {/* Terminal area — always present, takes remaining space */}
        <div className="flex-1 min-w-0 flex flex-col bg-bg-deep">
          <div id="terminal-container-react" className="flex-1 min-h-0">
            <ErrorBoundary name="Terminal"><TerminalArea /></ErrorBoundary>
          </div>
        </div>

        {/* Right panel — conditionally visible */}
        <AnimatePresence initial={false}>
          {activePanel && (
            <motion.div
              key="right-panel"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: rightPanelCollapsed ? 44 : rightPanelWidth, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: isResizing ? 0 : 0.2, ease: 'easeInOut' }}
              className="flex-shrink-0 overflow-hidden border-l border-border-subtle bg-bg-primary"
            >
              <div className="h-full w-full">
                <ErrorBoundary name="Right Panel"><RightPanel /></ErrorBoundary>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* File editor dialog */}
      <Editor filePath={editorFilePath} onClose={() => setEditorFilePath(null)} />

      {/* Settings dialog (modal, renders above everything) */}
      <SettingsPanel />

      {/* Keyboard shortcuts help overlay */}
      <KeyboardShortcuts />
    </div>
  );
}

/** Minimal inline atom logo SVG for the floating button */
function logoSvg(size: number): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 180 180" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="fl-ag"><stop offset="0%" stop-color="rgba(255,110,180,0.18)"/><stop offset="50%" stop-color="rgba(180,128,255,0.05)"/><stop offset="100%" stop-color="transparent"/></radialGradient>
    </defs>
    <circle cx="90" cy="90" r="40" fill="url(#fl-ag)"/>
    <g transform="rotate(0,90,90)"><ellipse cx="90" cy="90" rx="58" ry="22" fill="none" stroke="rgba(180,128,255,0.3)" stroke-width="1.5"/></g>
    <g transform="rotate(60,90,90)"><ellipse cx="90" cy="90" rx="58" ry="22" fill="none" stroke="rgba(255,110,180,0.25)" stroke-width="1.5" stroke-dasharray="5 3.5"/></g>
    <g transform="rotate(120,90,90)"><ellipse cx="90" cy="90" rx="58" ry="22" fill="none" stroke="rgba(100,216,255,0.22)" stroke-width="1.5"/></g>
    <circle cx="90" cy="90" r="5.5" fill="#ff6eb4"/>
  </svg>`;
}
