import { useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { TerminalArea } from './TerminalArea';
import { RightPanel } from './RightPanel';
import { SettingsPanel } from './SettingsPanel';
import { KeyboardShortcuts } from './KeyboardShortcuts';
import { CommandPalette } from './CommandPalette';
import { PromptLibrary } from './PromptLibrary';
import { WhatsNew } from './WhatsNew';
import { UpdateNotification } from './UpdateNotification';
import { OnboardingDialog } from './OnboardingDialog';
import { Editor } from './Editor';
import { ErrorBoundary } from './ErrorBoundary';
import { ThemeProvider } from './ThemeProvider';
import { useUIStore } from '../stores/useUIStore';
import { useProjectStore } from '../stores/useProjectStore';
import { useTerminalStore } from '../stores/useTerminalStore';

import { useOnboarding } from '../hooks/useOnboarding';
import { useAIToolConfig } from '../hooks/useSettings';
import { IPC } from '../../shared/ipcChannels';

const { ipcRenderer } = require('electron');

/**
 * Root application layout.
 * Three regions: sidebar (left), terminal area (center), right panel (conditionally visible).
 * Keyboard shortcuts are wired here to match the original app.
 */
export function App() {
  const sidebarState = useUIStore((s) => s.sidebarState);
  const sidebarWidth = useUIStore((s) => s.sidebarWidth);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
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
  const currentProjectPath = useProjectStore((s) => s.currentProjectPath);
  const selectAdjacentProject = useProjectStore((s) => s.selectAdjacentProject);
  const onboarding = useOnboarding();
  const { config: aiToolConfig } = useAIToolConfig();

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

      // Ctrl/Cmd+Shift+X — Toggle plugins panel
      if (modKey && e.shiftKey && key === 'x') {
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

      // Ctrl/Cmd+Shift+Y — Toggle pipeline panel
      if (modKey && e.shiftKey && key === 'y') {
        e.preventDefault();
        togglePanel('pipeline');
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

      // Ctrl/Cmd+Shift+Enter — Start AI tool
      if (modKey && e.shiftKey && key === 'enter') {
        e.preventDefault();
        window.dispatchEvent(new Event('start-ai-tool'));
      }
    },
    [toggleSidebar, togglePanel, setSettingsOpen, setShortcutsHelpOpen, selectAdjacentProject, requestSidebarFocus]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Listen for menu-triggered actions from main process
  useEffect(() => {
    const onToggleSidebar = () => useUIStore.getState().toggleSidebar();
    const onToggleRightPanel = () => {
      const { activePanel, togglePanel, setActivePanel } = useUIStore.getState();
      if (activePanel) {
        togglePanel(activePanel);
      } else {
        setActivePanel('tasks');
      }
    };
    const onResetLayout = () => {
      const store = useUIStore.getState();
      store.setSidebarState('expanded');
      store.setSidebarWidth(260);
      store.setActivePanel(null);
    };
    const onCloseTerminal = () => {
      window.dispatchEvent(new CustomEvent('menu-close-terminal'));
    };
    const onOpenSettings = () => useUIStore.getState().setSettingsOpen(true);
    const onNewTerminal = () => {
      window.dispatchEvent(new CustomEvent('menu-new-terminal'));
    };

    ipcRenderer.on(IPC.MENU_TOGGLE_SIDEBAR, onToggleSidebar);
    ipcRenderer.on(IPC.MENU_TOGGLE_RIGHT_PANEL, onToggleRightPanel);
    ipcRenderer.on(IPC.MENU_RESET_LAYOUT, onResetLayout);
    ipcRenderer.on(IPC.MENU_CLOSE_TERMINAL, onCloseTerminal);
    ipcRenderer.on(IPC.MENU_OPEN_SETTINGS, onOpenSettings);
    ipcRenderer.on(IPC.MENU_NEW_TERMINAL, onNewTerminal);

    return () => {
      ipcRenderer.removeListener(IPC.MENU_TOGGLE_SIDEBAR, onToggleSidebar);
      ipcRenderer.removeListener(IPC.MENU_TOGGLE_RIGHT_PANEL, onToggleRightPanel);
      ipcRenderer.removeListener(IPC.MENU_RESET_LAYOUT, onResetLayout);
      ipcRenderer.removeListener(IPC.MENU_CLOSE_TERMINAL, onCloseTerminal);
      ipcRenderer.removeListener(IPC.MENU_OPEN_SETTINGS, onOpenSettings);
      ipcRenderer.removeListener(IPC.MENU_NEW_TERMINAL, onNewTerminal);
    };
  }, []);

  // Listen for onboarding trigger after project init
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.projectPath) {
        onboarding.detect(detail.projectPath);
      }
    };
    window.addEventListener('start-onboarding', handler);
    return () => window.removeEventListener('start-onboarding', handler);
  }, [onboarding]);

  // Compute sidebar pixel width for CSS
  const resolvedSidebarWidth =
    sidebarState === 'hidden' ? 0 : sidebarState === 'collapsed' ? 54 : sidebarWidth;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg-deep text-text-primary font-sans">
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

      {/* Command palette (Ctrl+/) */}
      <CommandPalette />

      {/* Prompt library (Ctrl+Shift+L) */}
      <PromptLibrary />

      {/* What's New dialog (auto-shows after updates) */}
      <WhatsNew />

      {/* Auto-updater notification (side-effect only, renders null) */}
      <UpdateNotification />

      {/* Theme provider (side-effect only, applies CSS custom properties) */}
      <ThemeProvider />

      {/* Onboarding dialog for project intelligence */}
      <OnboardingDialog
        open={onboarding.detection !== null}
        onOpenChange={(open) => { if (!open) onboarding.reset(); }}
        detection={onboarding.detection}
        analysisResult={onboarding.analysisResult}
        progress={onboarding.progress}
        terminalId={onboarding.terminalId}
        isAnalyzing={onboarding.isAnalyzing}
        error={onboarding.error}
        aiToolName={aiToolConfig?.activeTool.name || 'Claude Code'}
        onAnalyze={() => { if (currentProjectPath) onboarding.analyze(currentProjectPath); }}
        onImport={(selections) => {
          if (currentProjectPath && onboarding.analysisResult) {
            onboarding.importResults(currentProjectPath, onboarding.analysisResult, selections);
          }
        }}
        onCancel={() => { if (currentProjectPath) onboarding.cancel(currentProjectPath); }}
        onViewTerminal={() => {
          if (onboarding.terminalId) {
            // Close right panel and switch to the analysis terminal
            useUIStore.getState().setActivePanel(null);
            useTerminalStore.getState().setActiveTerminal(onboarding.terminalId);
          }
        }}
      />
    </div>
  );
}

