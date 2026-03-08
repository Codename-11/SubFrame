/**
 * Single terminal component.
 * Wraps xterm.js via useTerminal hook. Connects IPC for I/O, provides context menu,
 * scroll-to-bottom button with animation, live output overlay, and inline search.
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowDown, ArrowUp, Copy, ClipboardPaste, MousePointerClick, Trash2, Search, X, MessageSquare } from 'lucide-react';
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
import { useSettings } from '../hooks/useSettings';
import { useTerminalStore } from '../stores/useTerminalStore';
import * as terminalRegistry from '../lib/terminalRegistry';

const { ipcRenderer, clipboard } = require('electron');

/** Strip ANSI escape sequences for overlay display */
function stripAnsi(str: string): string {
  return str
    // eslint-disable-next-line no-control-regex
    .replace(/\x1b\[[?=!>]?[0-9;]*[a-zA-Z~]/g, '')  // CSI sequences (including DEC private mode)
    // eslint-disable-next-line no-control-regex
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '') // OSC sequences (BEL or ST terminated)
    // eslint-disable-next-line no-control-regex
    .replace(/\x1b[()][AB012]/g, '')           // Character set sequences
    // eslint-disable-next-line no-control-regex
    .replace(/\x1b[78DEHM]/g, '')              // Single-char escape sequences (save/restore cursor, etc.)
    // eslint-disable-next-line no-control-regex
    .replace(/\x1b\[[\d;]*[ -/]*[@-~]/g, '')  // Catch-all CSI (handles any remaining)
    .replace(/\r/g, '');
}

const OUTPUT_BUFFER_MAX = 4096;

interface TerminalProps {
  terminalId: string;
  className?: string;
}

export function Terminal({ terminalId, className }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { settings } = useSettings();
  const terminalSettings = (settings?.terminal as Record<string, unknown>) || {};

  const { terminalRef, fitAddonRef, searchAddonRef } = useTerminal(containerRef, terminalId, {
    fontSize: (terminalSettings.fontSize as number) || 14,
    fontFamily: (terminalSettings.fontFamily as string) || undefined,
    scrollback: (terminalSettings.scrollback as number) || 10000,
    lineHeight: (terminalSettings.lineHeight as number) || undefined,
    cursorBlink: terminalSettings.cursorBlink as boolean,
    cursorStyle: terminalSettings.cursorStyle as 'block' | 'underline' | 'bar',
    bellSound: terminalSettings.bellSound as boolean,
    copyOnSelect: terminalSettings.copyOnSelect as boolean,
  });
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  // Live output overlay state
  const [recentOutput, setRecentOutput] = useState<string[]>([]);
  const outputBufferRef = useRef('');

  // Search state
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const renderDisposableRef = useRef<{ dispose: () => void } | null>(null);

  // User message tracking
  const generalSettings = (settings?.general as Record<string, unknown>) || {};
  const highlightUserMessages = generalSettings.highlightUserMessages !== false;
  const claudeActive = useTerminalStore((s) => s.terminals.get(terminalId)?.claudeActive ?? false);
  const [userMessageCount, setUserMessageCount] = useState(0);
  const inputBufferRef = useRef('');
  // Grace period: keep tracking user input for 60s after claudeActive goes false
  // (users often take >8s to compose messages while Claude waits at its prompt)
  const wasRecentlyActiveRef = useRef(false);

  // Capture IPC output for overlay display (terminal.write handled by registry)
  useEffect(() => {
    const handler = (_event: unknown, payload: { terminalId: string; data: string }) => {
      if (payload.terminalId === terminalId) {
        // Rolling output buffer for overlay
        outputBufferRef.current += payload.data;
        if (outputBufferRef.current.length > OUTPUT_BUFFER_MAX) {
          outputBufferRef.current = outputBufferRef.current.slice(-OUTPUT_BUFFER_MAX);
        }

        // Extract last 5 non-empty lines
        const clean = stripAnsi(outputBufferRef.current);
        const lines = clean.split('\n').filter((l) => l.trim().length > 0);
        setRecentOutput(lines.slice(-5));
      }
    };
    ipcRenderer.on(IPC.TERMINAL_OUTPUT_ID, handler);
    return () => {
      ipcRenderer.removeListener(IPC.TERMINAL_OUTPUT_ID, handler);
    };
  }, [terminalId]);

  // Track claudeActive with a grace period so input listener survives prompt wait
  useEffect(() => {
    if (claudeActive) {
      wasRecentlyActiveRef.current = true;
      return;
    }
    // After claudeActive goes false, keep grace period for 60s
    // (Claude's prompt detection timeout is 8s, but users may take much longer to type)
    const timeout = setTimeout(() => {
      wasRecentlyActiveRef.current = false;
    }, 60_000);
    return () => clearTimeout(timeout);
  }, [claudeActive]);

  // Track user messages — detect Enter during agent sessions (with grace period)
  // Listener stays alive while setting is enabled; checks activity at submit time
  useEffect(() => {
    if (!highlightUserMessages) {
      inputBufferRef.current = '';
      return;
    }
    const terminal = terminalRef.current;
    if (!terminal) return;

    const disposable = terminal.onData((data: string) => {
      // Accumulate input to detect non-empty submissions
      if (data === '\r' || data === '\n') {
        const typed = inputBufferRef.current.trim();
        inputBufferRef.current = '';
        // Check activity at submit time (not at listener setup time)
        if (typed.length > 0 && wasRecentlyActiveRef.current) {
          terminalRegistry.addUserMessageMarker(terminalId, true);
        }
      } else if (data === '\x7f' || data === '\b') {
        // Backspace
        inputBufferRef.current = inputBufferRef.current.slice(0, -1);
      } else if (data.length === 1 && data >= ' ') {
        inputBufferRef.current += data;
      } else if (data.length > 1 && !data.startsWith('\x1b')) {
        // Pasted text
        inputBufferRef.current += data;
      }
    });

    return () => disposable.dispose();
  }, [highlightUserMessages, terminalId, terminalRef]);

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

    // Fit + sync PTY dimensions + auto-focus after (re)attach
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
      terminal.focus();
    });

    return () => {
      dataDisposable.dispose();
      resizeDisposable.dispose();
    };
  }, [terminalId, terminalRef, fitAddonRef]);

  // Reset overlay state when terminal changes (e.g. grid slot swap)
  useEffect(() => {
    setShowScrollBtn(false);
    setRecentOutput([]);
    outputBufferRef.current = '';
    inputBufferRef.current = '';
    // Sync marker count from registry (markers persist on the xterm instance)
    setUserMessageCount(terminalRegistry.getUserMessageMarkers(terminalId).length);
  }, [terminalId]);

  // Subscribe to marker count changes (covers both add and scrollback-dispose)
  useEffect(() => {
    return terminalRegistry.onMarkerChange(terminalId, () => {
      setUserMessageCount(terminalRegistry.getUserMessageMarkers(terminalId).length);
    });
  }, [terminalId]);

  // Scroll-to-bottom tracking via xterm viewport DOM element
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // xterm renders a .xterm-viewport element that handles scrolling
    // Poll briefly for it since the terminal mounts asynchronously
    let viewport: HTMLElement | null = null;
    let pollTimer: ReturnType<typeof setTimeout>;

    const updateScroll = () => {
      if (!viewport) return;
      const atBottom = viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 2;
      setShowScrollBtn(!atBottom);
      if (atBottom) {
        setRecentOutput([]);
        outputBufferRef.current = '';
      }
    };

    const attach = () => {
      viewport = container.querySelector('.xterm-viewport');
      if (viewport) {
        viewport.addEventListener('scroll', updateScroll, { passive: true });
        // Also track when new content pushes scroll position
        const terminal = terminalRef.current;
        if (terminal) {
          renderDisposableRef.current = terminal.onRender(updateScroll);
        }
      } else {
        // Terminal not mounted yet, retry
        pollTimer = setTimeout(attach, 50);
      }
    };

    attach();

    return () => {
      clearTimeout(pollTimer);
      if (viewport) {
        viewport.removeEventListener('scroll', updateScroll);
      }
      if (renderDisposableRef.current) {
        renderDisposableRef.current.dispose();
        renderDisposableRef.current = null;
      }
    };
  }, [containerRef, terminalRef, terminalId]);

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
      if (modKey && !event.shiftKey && key === 'g') return false;
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

  // Scroll to the last user message marker
  const handleScrollToLastMessage = useCallback(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;
    const markers = terminalRegistry.getUserMessageMarkers(terminalId);
    if (markers.length === 0) return;

    // Use xterm's buffer viewportY (top visible line in scrollback) for accurate position
    const buf = terminal.buffer.active;
    const topVisibleLine = buf.viewportY;

    // Find the nearest marker above the top of the viewport, or the last one
    let target = markers[markers.length - 1];
    for (let i = markers.length - 1; i >= 0; i--) {
      const markerLine = markers[i].marker.line;
      if (markerLine < topVisibleLine) {
        target = markers[i];
        break;
      }
    }

    terminal.scrollToLine(Math.max(0, target.marker.line - 2));
  }, [terminalRef, terminalId]);

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
                      if (e.shiftKey) { handleSearchPrev(); } else { handleSearchNext(); }
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

          {/* Scroll-to-last-message button — visible when scrolled up and messages exist */}
          <AnimatePresence>
            {showScrollBtn && highlightUserMessages && userMessageCount > 0 && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleScrollToLastMessage();
                }}
                className={`absolute right-4 z-20 flex h-8 items-center gap-1.5 px-2.5
                           rounded-full bg-bg-elevated border border-border-subtle
                           text-text-secondary hover:text-accent hover:border-accent/60
                           transition-all shadow-lg cursor-pointer
                           ${recentOutput.length > 0 ? 'bottom-36' : 'bottom-14'}`}
                title="Scroll to last message"
              >
                <ArrowUp className="h-3.5 w-3.5" />
                <MessageSquare className="h-3 w-3" />
              </motion.button>
            )}
          </AnimatePresence>

          {/* Scroll-to-bottom floating button — always visible when scrolled up */}
          <AnimatePresence>
            {showScrollBtn && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8, boxShadow: '0 0 0 0 rgba(212,165,116,0)' }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  boxShadow: ['0 0 0 0 rgba(212,165,116,0.5)', '0 0 0 8px rgba(212,165,116,0)', '0 0 0 0 rgba(212,165,116,0)'],
                }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{
                  type: 'spring', stiffness: 500, damping: 30,
                  boxShadow: { duration: 0.8, delay: 0.15, ease: 'easeOut' },
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleScrollToBottom();
                }}
                className={`absolute right-4 z-20 flex h-8 w-8 items-center justify-center
                           rounded-full bg-bg-elevated border border-border-subtle
                           text-text-secondary hover:text-accent hover:border-accent/60
                           transition-all shadow-lg cursor-pointer
                           ${recentOutput.length > 0 ? 'bottom-24' : 'bottom-4'}`}
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
