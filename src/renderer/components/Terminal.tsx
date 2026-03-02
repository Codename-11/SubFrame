/**
 * Single terminal component.
 * Wraps xterm.js via useTerminal hook. Connects IPC for I/O, provides context menu
 * and a scroll-to-bottom floating button.
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import { ArrowDown, Copy, ClipboardPaste, MousePointerClick, Trash2 } from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from './ui/context-menu';
import { useTerminal } from '../hooks/useTerminal';
import { typedSend } from '../lib/ipc';
import { IPC } from '../../shared/ipcChannels';

const { ipcRenderer, clipboard } = require('electron');

interface TerminalProps {
  terminalId: string;
  /** Called when this terminal resizes — parent can use to sync PTY */
  className?: string;
}

export function Terminal({ terminalId, className }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { terminalRef, fitAddonRef } = useTerminal(containerRef);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  // Wire IPC output → xterm
  useEffect(() => {
    const handler = (_event: unknown, payload: { terminalId: string; data: string }) => {
      if (payload.terminalId === terminalId && terminalRef.current) {
        terminalRef.current.write(payload.data);
      }
    };
    ipcRenderer.on(IPC.TERMINAL_OUTPUT_ID, handler);
    return () => {
      ipcRenderer.removeListener(IPC.TERMINAL_OUTPUT_ID, handler);
    };
  }, [terminalId, terminalRef]);

  // Wire xterm input → IPC and resize → IPC
  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;

    const dataDisposable = terminal.onData((data: string) => {
      typedSend(IPC.TERMINAL_INPUT_ID, { terminalId, data });
    });

    const resizeDisposable = terminal.onResize(({ cols, rows }: { cols: number; rows: number }) => {
      typedSend(IPC.TERMINAL_RESIZE_ID, { terminalId, cols, rows });
    });

    // Send initial resize so PTY matches
    requestAnimationFrame(() => {
      if (fitAddonRef.current) {
        try {
          fitAddonRef.current.fit();
        } catch { /* ignore */ }
      }
      if (terminal.cols && terminal.rows) {
        typedSend(IPC.TERMINAL_RESIZE_ID, {
          terminalId,
          cols: terminal.cols,
          rows: terminal.rows,
        });
      }
    });

    return () => {
      dataDisposable.dispose();
      resizeDisposable.dispose();
    };
  }, [terminalId, terminalRef, fitAddonRef]);

  // Scroll-to-bottom tracking
  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;

    const updateScroll = () => {
      const buf = terminal.buffer.active;
      const atBottom = buf.baseY + terminal.rows >= buf.length;
      setShowScrollBtn(!atBottom);
    };

    const scrollDisposable = terminal.onScroll(updateScroll);
    const renderDisposable = terminal.onRender(updateScroll);

    return () => {
      scrollDisposable.dispose();
      renderDisposable.dispose();
    };
  }, [terminalRef]);

  // Custom key handler: Ctrl+C copy when selection, Ctrl+V paste
  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;

    terminal.attachCustomKeyEventHandler((event: KeyboardEvent) => {
      const modKey = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (event.type !== 'keydown') return true;

      // Copy: Ctrl+C when there is a selection (otherwise let SIGINT go through)
      if (modKey && key === 'c' && !event.shiftKey && terminal.hasSelection()) {
        clipboard.writeText(terminal.getSelection());
        terminal.clearSelection();
        return false;
      }

      // Paste: Ctrl+V (manual paste via electron clipboard)
      // Skip Ctrl+Shift+V — Electron's menu { role: 'paste' } handles it natively
      if (modKey && key === 'v' && !event.shiftKey) {
        const text = clipboard.readText();
        if (text) terminal.paste(text);
        return false;
      }

      // Pass app-level shortcuts through
      if (modKey && event.shiftKey) return false;
      if (modKey && event.key >= '1' && event.key <= '9') return false;
      if (modKey && key === 'k') return false;
      if (modKey && key === 'i') return false;
      if (modKey && key === 'h') return false;
      if (modKey && key === 'b') return false;
      if (modKey && key === 'e') return false;
      if (modKey && !event.shiftKey && key === 't') return false;
      if (modKey && (event.key === '[' || event.key === ']')) return false;
      if (modKey && event.key === 'Tab') return false;

      return true;
    });
  }, [terminalRef]);

  const handleScrollToBottom = useCallback(() => {
    terminalRef.current?.scrollToBottom();
    setShowScrollBtn(false);
  }, [terminalRef]);

  // Context menu actions
  const handleCopy = useCallback(() => {
    const terminal = terminalRef.current;
    if (terminal?.hasSelection()) {
      clipboard.writeText(terminal.getSelection());
      terminal.clearSelection();
    }
  }, [terminalRef]);

  const handlePaste = useCallback(() => {
    const text = clipboard.readText();
    if (text && terminalRef.current) {
      terminalRef.current.paste(text);
    }
  }, [terminalRef]);

  const handleSelectAll = useCallback(() => {
    terminalRef.current?.selectAll();
  }, [terminalRef]);

  const handleClear = useCallback(() => {
    terminalRef.current?.clear();
  }, [terminalRef]);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={`relative h-full w-full ${className ?? ''}`}
          onClick={() => terminalRef.current?.focus()}
        >
          <div ref={containerRef} className="h-full w-full" />

          {/* Scroll-to-bottom floating button */}
          {showScrollBtn && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleScrollToBottom();
              }}
              className="absolute bottom-4 right-4 z-10 flex h-8 w-8 items-center justify-center
                         rounded-full bg-bg-elevated border border-border-subtle
                         text-text-secondary hover:text-accent hover:border-accent
                         transition-all shadow-md cursor-pointer"
              title="Scroll to bottom"
            >
              <ArrowDown className="h-4 w-4" />
            </button>
          )}
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={handleCopy}>
          <Copy className="mr-2 h-4 w-4" />
          Copy
        </ContextMenuItem>
        <ContextMenuItem onClick={handlePaste}>
          <ClipboardPaste className="mr-2 h-4 w-4" />
          Paste
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleSelectAll}>
          <MousePointerClick className="mr-2 h-4 w-4" />
          Select All
        </ContextMenuItem>
        <ContextMenuItem onClick={handleClear}>
          <Trash2 className="mr-2 h-4 w-4" />
          Clear Terminal
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
