/**
 * Pop-out terminal window UI.
 * Renders a minimal terminal view for detached windows.
 *
 * Supports two modes:
 * - **Standby** (prewarmed): No terminalId yet. Renders the shell (toolbar + theme)
 *   but no Terminal component. Activates when it receives POPOUT_ACTIVATE IPC.
 * - **Active**: Has a terminalId. Renders the full Terminal component.
 */

import { useState, useEffect } from 'react';
import { ArrowLeftToLine, Bot } from 'lucide-react';
import { Terminal } from './Terminal';
import { ThemeProvider } from './ThemeProvider';
import { ErrorBoundary } from './ErrorBoundary';
import { typedInvoke } from '../lib/ipc';
import { IPC } from '../../shared/ipcChannels';
import { getTransport } from '../lib/transportProvider';

interface PopoutTerminalProps {
  /** Initial terminalId — omit for standby (prewarmed) mode */
  terminalId?: string;
}

export function PopoutTerminal({ terminalId: initialTerminalId }: PopoutTerminalProps) {
  const [terminalId, setTerminalId] = useState<string | null>(initialTerminalId ?? null);
  const [claudeActive, setClaudeActive] = useState(false);

  // Listen for activation from main process (prewarmed standby → active)
  useEffect(() => {
    const handler = (_event: unknown, data: { terminalId: string }) => {
      setTerminalId(data.terminalId);
    };
    return getTransport().on(IPC.POPOUT_ACTIVATE, handler);
  }, []);

  // Listen for agent active status
  useEffect(() => {
    if (!terminalId) return;
    const handler = (_event: unknown, data: { terminalId: string; active: boolean }) => {
      if (data.terminalId === terminalId) {
        setClaudeActive(data.active);
        document.title = data.active ? 'Terminal (Agent Active) — SubFrame' : 'Terminal — SubFrame';
      }
    };
    const unsub = getTransport().on(IPC.CLAUDE_ACTIVE_STATUS, handler);
    // Check initial status
    typedInvoke(IPC.IS_TERMINAL_CLAUDE_ACTIVE, terminalId).then((active) => {
      setClaudeActive(active);
    }).catch(() => {});
    return unsub;
  }, [terminalId]);

  // Listen for terminal destroyed — close this window
  useEffect(() => {
    if (!terminalId) return;
    const handler = (_event: unknown, data: { terminalId: string }) => {
      if (data.terminalId === terminalId) {
        window.close();
      }
    };
    return getTransport().on(IPC.TERMINAL_DESTROYED, handler);
  }, [terminalId]);

  const handleDock = () => {
    if (terminalId) {
      typedInvoke(IPC.TERMINAL_DOCK, terminalId).catch(() => {});
    }
  };

  return (
    <>
      <ThemeProvider />
      <div className="flex flex-col h-screen bg-bg-deep text-text-primary">
        {/* Toolbar */}
        <div className="flex items-center justify-between h-9 px-3 bg-bg-secondary border-b border-border-subtle flex-shrink-0">
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <span className="font-medium text-text-primary">Terminal</span>
            {claudeActive && (
              <Bot className="h-3.5 w-3.5 text-success animate-pulse" />
            )}
          </div>
          {terminalId && (
            <button
              onClick={handleDock}
              className="flex items-center gap-1.5 px-2.5 h-6 rounded text-xs text-text-secondary
                         hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer"
              title="Dock back to main window"
            >
              <ArrowLeftToLine className="h-3.5 w-3.5" />
              <span>Dock</span>
            </button>
          )}
        </div>

        {/* Terminal or standby placeholder */}
        <div className="flex-1 min-h-0">
          {terminalId ? (
            <ErrorBoundary name="PopoutTerminal">
              <Terminal terminalId={terminalId} />
            </ErrorBoundary>
          ) : (
            <div className="h-full bg-bg-deep" />
          )}
        </div>
      </div>
    </>
  );
}
