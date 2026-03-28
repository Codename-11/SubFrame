/**
 * EmbeddedTerminal — attaches a real terminal registry entry into any container.
 *
 * Uses the terminal registry's existing xterm instance via attach/detach.
 * Fits the xterm to the container AND resizes the PTY to match, just like
 * regular SubFrame terminals. The TUI adjusts to the available space.
 */

import { useEffect, useRef } from 'react';
import * as terminalRegistry from '../lib/terminalRegistry';
import { typedSend } from '../lib/ipc';
import { IPC } from '../../shared/ipcChannels';

interface EmbeddedTerminalProps {
  terminalId: string;
  className?: string;
}

export function EmbeddedTerminal({ terminalId, className }: EmbeddedTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const instance = terminalRegistry.getOrCreate(terminalId);
    if (!instance) return;

    terminalRegistry.attach(terminalId, container as HTMLDivElement);

    // Fit xterm to container + sync PTY size (same as regular Terminal component).
    // Delay to let dialog animation settle.
    const syncSize = () => {
      try {
        instance.fitAddon.fit();
      } catch { /* ignore */ }
      const term = instance.terminal;
      if (term.cols && term.rows) {
        typedSend(IPC.TERMINAL_RESIZE_ID, { terminalId, cols: term.cols, rows: term.rows });
      }
    };

    const fitTimer = setTimeout(syncSize, 300);
    const settleTimer = setTimeout(syncSize, 600);

    // Track container resizes
    const observer = new ResizeObserver(() => {
      try {
        instance.fitAddon.fit();
      } catch { /* ignore */ }
    });
    observer.observe(container);

    return () => {
      clearTimeout(fitTimer);
      clearTimeout(settleTimer);
      observer.disconnect();
      if (container.childElementCount > 0) {
        terminalRegistry.detach(terminalId);
      }
    };
  }, [terminalId]);

  return (
    <div
      ref={containerRef}
      className={className ?? 'h-full w-full'}
    />
  );
}
