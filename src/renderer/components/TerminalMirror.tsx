import { useEffect, useRef } from 'react';
import type { Terminal } from 'xterm';
import type { FitAddon } from 'xterm-addon-fit';
import { IPC } from '../../shared/ipcChannels';
import { typedInvoke, typedSend } from '../lib/ipc';
import { getTransport } from '../lib/transportProvider';
import { useSettings } from '../hooks/useSettings';
import { getTerminalTheme } from '../lib/terminalRegistry';

const { Terminal: XTerminal } = require('xterm') as { Terminal: typeof Terminal };
const { FitAddon: XFitAddon } = require('xterm-addon-fit') as { FitAddon: typeof FitAddon };

interface TerminalMirrorProps {
  terminalId: string;
  className?: string;
  autoScroll?: boolean;
  interactive?: boolean;
  autoFocus?: boolean;
  syncPtySize?: boolean | 'initial';
}

/**
 * Poll interval for backlog-based output rendering.
 * IPC event listeners (TERMINAL_OUTPUT_ID) don't reliably fire inside
 * Radix Dialog portals, so we use polling as the primary data source.
 */
const POLL_INTERVAL_MS = 500;

export function TerminalMirror({
  terminalId,
  className,
  autoScroll = true,
  interactive = false,
  autoFocus = false,
  syncPtySize = false,
}: TerminalMirrorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const { settings } = useSettings();
  const terminalSettings = (settings?.terminal as Record<string, unknown>) || {};

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const fitAddon = new XFitAddon();
    const terminal = new XTerminal({
      cursorBlink: interactive,
      cursorStyle: interactive ? 'block' : 'bar',
      disableStdin: !interactive,
      convertEol: false,
      fontSize: (terminalSettings.fontSize as number) || 14,
      fontFamily: (terminalSettings.fontFamily as string) || "'JetBrainsMono Nerd Font', 'CaskaydiaCove Nerd Font', 'FiraCode Nerd Font', 'JetBrains Mono', 'SF Mono', Consolas, monospace",
      scrollback: (terminalSettings.scrollback as number) || 10000,
      lineHeight: (terminalSettings.lineHeight as number) || 1.1,
      theme: getTerminalTheme(),
      allowTransparency: false,
    });

    terminal.loadAddon(fitAddon);
    terminal.open(container);
    fitAddon.fit();
    if (interactive && autoFocus) {
      terminal.focus();
    }

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    let disposed = false;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;
    let mountRaf: number | null = null;

    const syncTerminalSize = () => {
      if (disposed) return;
      try {
        fitAddon.fit();
        if (terminal.cols && terminal.rows) {
          typedSend(IPC.TERMINAL_RESIZE_ID, { terminalId, cols: terminal.cols, rows: terminal.rows });
        }
      } catch {
        /* ignore fit after dispose or hidden mount */
      }
    };

    const syncOnMount = syncPtySize === true || syncPtySize === 'initial';
    if (syncOnMount) {
      mountRaf = requestAnimationFrame(() => {
        syncTerminalSize();
        if (syncPtySize === 'initial') {
          settleTimer = setTimeout(syncTerminalSize, 120);
        }
      });
    }

    // ── Primary: Backlog polling ────────────────────────────────────────────
    // IPC event listeners (TERMINAL_OUTPUT_ID) don't reliably fire inside
    // dialog portals. Instead, poll the backlog and write only the new delta.
    let lastBacklogLength = 0;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const pollBacklog = () => {
      if (disposed) return;
      typedInvoke(IPC.GET_TERMINAL_BACKLOG, { terminalId }).then((result) => {
        if (disposed || !result.data) return;
        const data = result.data;
        if (data.length > lastBacklogLength) {
          // Write only the NEW portion of the backlog
          const delta = data.slice(lastBacklogLength);
          terminal.write(delta);
          lastBacklogLength = data.length;
          if (autoScroll) {
            terminal.scrollToBottom();
          }
        }
      }).catch(() => {
        /* best-effort polling */
      });
    };

    // Initial load + start polling
    pollBacklog();
    pollTimer = setInterval(pollBacklog, POLL_INTERVAL_MS);

    // ── Secondary: IPC event listener (opportunistic) ───────────────────────
    // When events do arrive, write them immediately for lower latency.
    // Track what we've written via events so the poller doesn't double-write.
    const unsub = getTransport().on(IPC.TERMINAL_OUTPUT_ID, (_event: unknown, payload: { terminalId: string; data: string }) => {
      if (payload.terminalId !== terminalId) return;
      terminal.write(payload.data);
      // Advance the pointer so the poller skips this data
      lastBacklogLength += payload.data.length;
      if (autoScroll) {
        terminal.scrollToBottom();
      }
    });

    // ── Input forwarding (interactive mode) ─────────────────────────────────
    const inputDisposable = interactive
      ? terminal.onData((data) => {
          typedSend(IPC.TERMINAL_INPUT_ID, { terminalId, data });
        })
      : null;

    // ── Resize observer ─────────────────────────────────────────────────────
    const observer = new ResizeObserver(() => {
      try {
        fitAddon.fit();
        if (syncPtySize === true && terminal.cols && terminal.rows) {
          typedSend(IPC.TERMINAL_RESIZE_ID, { terminalId, cols: terminal.cols, rows: terminal.rows });
        }
      } catch {
        /* ignore resize after dispose */
      }
    });
    observer.observe(container);

    return () => {
      disposed = true;
      if (mountRaf !== null) {
        cancelAnimationFrame(mountRaf);
      }
      if (settleTimer) {
        clearTimeout(settleTimer);
      }
      if (pollTimer) {
        clearInterval(pollTimer);
      }
      observer.disconnect();
      unsub();
      inputDisposable?.dispose();
      try {
        terminal.dispose();
      } catch {
        /* ignore */
      }
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [autoFocus, autoScroll, interactive, syncPtySize, terminalId, terminalSettings.fontFamily, terminalSettings.fontSize, terminalSettings.lineHeight, terminalSettings.scrollback]);

  useEffect(() => {
    if (!terminalRef.current) return;
    terminalRef.current.options.theme = getTerminalTheme();
  }, [settings]);

  return (
    <div
      ref={containerRef}
      className={className ?? 'h-full w-full'}
      onMouseDown={() => {
        if (interactive) {
          terminalRef.current?.focus();
        }
      }}
    />
  );
}
