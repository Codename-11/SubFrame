/**
 * Single terminal component.
 * Wraps xterm.js via useTerminal hook. Connects IPC for I/O, provides context menu,
 * scroll-to-bottom button with animation, live output overlay, and inline search.
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowDown, Copy, ClipboardPaste, MousePointerClick, Trash2, Search, X } from 'lucide-react';
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

/** Strip ANSI escape sequences for overlay display */
function stripAnsi(str: string): string {
  return str
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')  // CSI sequences
    .replace(/\x1b\][^\x07]*\x07/g, '')       // OSC sequences
    .replace(/\x1b[()][AB012]/g, '')           // Character set sequences
    .replace(/\r/g, '');
}

const OUTPUT_BUFFER_MAX = 2048;

interface TerminalProps {
  terminalId: string;
  className?: string;
}

export function Terminal({ terminalId, className }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { terminalRef, fitAddonRef, searchAddonRef } = useTerminal(containerRef);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  // Live output overlay state
  const [recentOutput, setRecentOutput] = useState<string[]>([]);
  const outputBufferRef = useRef('');

  // Search state
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Wire IPC output → xterm + capture for overlay
  useEffect(() => {
    const handler = (_event: unknown, payload: { terminalId: string; data: string }) => {
      if (payload.terminalId === terminalId && terminalRef.current) {
        terminalRef.current.write(payload.data);

        // Rolling output buffer for overlay
        outputBufferRef.current += payload.data;
        if (outputBufferRef.current.length > OUTPUT_BUFFER_MAX) {
          outputBufferRef.current = outputBufferRef.current.slice(-OUTPUT_BUFFER_MAX);
        }

        // Extract last 3 non-empty lines
        const clean = stripAnsi(outputBufferRef.current);
        const lines = clean.split('\n').filter((l) => l.trim().length > 0);
        setRecentOutput(lines.slice(-3));
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
      // Clear overlay when scrolled to bottom
      if (atBottom) {
        setRecentOutput([]);
        outputBufferRef.current = '';
      }
    };

    const scrollDisposable = terminal.onScroll(updateScroll);
    const renderDisposable = terminal.onRender(updateScroll);

    return () => {
      scrollDisposable.dispose();
      renderDisposable.dispose();
    };
  }, [terminalRef]);

  // Custom key handler: Ctrl+C copy, Ctrl+V paste, Shift+Enter newline, Ctrl+F search
  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;

    terminal.attachCustomKeyEventHandler((event: KeyboardEvent) => {
      const modKey = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (event.type !== 'keydown') return true;

      // Shift+Enter: insert literal newline
      if (event.shiftKey && event.key === 'Enter' && !modKey) {
        terminal.paste('\n');
        return false;
      }

      // Ctrl+F: open search (handled by component, not terminal)
      if (modKey && key === 'f' && !event.shiftKey) {
        return false;
      }

      // Copy: Ctrl+C when there is a selection (otherwise let SIGINT go through)
      if (modKey && key === 'c' && !event.shiftKey && terminal.hasSelection()) {
        clipboard.writeText(terminal.getSelection());
        terminal.clearSelection();
        return false;
      }

      // Paste: Ctrl+V (manual paste via electron clipboard)
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

  // Ctrl+F listener scoped to this terminal's container
  useEffect(() => {
    const container = containerRef.current?.parentElement;
    if (!container) return;

    const handler = (e: KeyboardEvent) => {
      const modKey = e.ctrlKey || e.metaKey;
      if (modKey && e.key.toLowerCase() === 'f' && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        setShowSearch(true);
        requestAnimationFrame(() => searchInputRef.current?.focus());
      }
    };

    container.addEventListener('keydown', handler, true);
    return () => container.removeEventListener('keydown', handler, true);
  }, []);

  const handleScrollToBottom = useCallback(() => {
    terminalRef.current?.scrollToBottom();
    setShowScrollBtn(false);
    setRecentOutput([]);
    outputBufferRef.current = '';
  }, [terminalRef]);

  // Search helpers
  const handleSearchNext = useCallback(() => {
    if (searchQuery && searchAddonRef.current) {
      searchAddonRef.current.findNext(searchQuery);
    }
  }, [searchQuery, searchAddonRef]);

  const handleSearchPrev = useCallback(() => {
    if (searchQuery && searchAddonRef.current) {
      searchAddonRef.current.findPrevious(searchQuery);
    }
  }, [searchQuery, searchAddonRef]);

  const handleCloseSearch = useCallback(() => {
    setShowSearch(false);
    setSearchQuery('');
    searchAddonRef.current?.clearDecorations();
    terminalRef.current?.focus();
  }, [searchAddonRef, terminalRef]);

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

          {/* Inline search bar */}
          <AnimatePresence>
            {showSearch && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className="absolute top-2 right-2 z-20 flex items-center gap-1.5 px-2 py-1.5
                           bg-bg-elevated border border-border-default rounded-lg shadow-lg"
              >
                <Search className="h-3 w-3 text-text-tertiary flex-shrink-0" />
                <input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (e.target.value && searchAddonRef.current) {
                      searchAddonRef.current.findNext(e.target.value);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.shiftKey ? handleSearchPrev() : handleSearchNext();
                    }
                    if (e.key === 'Escape') {
                      handleCloseSearch();
                    }
                  }}
                  placeholder="Search..."
                  className="bg-transparent text-xs text-text-primary w-36 focus:outline-none placeholder:text-text-muted"
                />
                <button
                  onClick={handleCloseSearch}
                  className="text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Live output overlay — visible when scrolled up and there's recent output */}
          <AnimatePresence>
            {showScrollBtn && recentOutput.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.15 }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleScrollToBottom();
                }}
                className="absolute bottom-0 left-0 right-0 z-10 px-3 py-2 cursor-pointer
                           bg-gradient-to-t from-[#0f0f10] via-[#0f0f10]/95 to-transparent"
              >
                <div className="font-mono text-[11px] leading-relaxed text-text-tertiary max-w-full overflow-hidden">
                  {recentOutput.map((line, i) => (
                    <div key={i} className="truncate opacity-60">{line}</div>
                  ))}
                </div>
                <div className="flex items-center justify-center gap-1 mt-1 text-[10px] text-accent/70">
                  <ArrowDown className="h-3 w-3" />
                  <span>Click to scroll to bottom</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Scroll-to-bottom floating button — shown when no overlay */}
          <AnimatePresence>
            {showScrollBtn && recentOutput.length === 0 && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
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
              </motion.button>
            )}
          </AnimatePresence>
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
