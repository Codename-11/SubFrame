/**
 * Single terminal component.
 * Wraps xterm.js via useTerminal hook. Connects IPC for I/O, provides context menu,
 * scroll-to-bottom button with animation, live output overlay, and inline search.
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowDown, ArrowDownToLine, ArrowUp, Copy, ClipboardPaste, MousePointerClick, Trash2, Search, X, MessageSquare, Pause } from 'lucide-react';
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
import { useProjectStore } from '../stores/useProjectStore';
import { useUIStore } from '../stores/useUIStore';
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
const SCROLL_THROTTLE_MS = 100;

interface TerminalProps {
  terminalId: string;
  className?: string;
}

export function Terminal({ terminalId, className }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { settings } = useSettings();
  const terminalSettings = (settings?.terminal as Record<string, unknown>) || {};

  const { terminalRef, fitAddonRef, searchAddonRef, savedScrollStateRef } = useTerminal(containerRef, terminalId, {
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
  const userMessageColor = (generalSettings.userMessageColor as string) || '#ff6eb4';
  const claudeActive = useTerminalStore((s) => s.terminals.get(terminalId)?.claudeActive ?? false);
  const isFrozen = useTerminalStore((s) => s.frozenTerminals.has(terminalId));
  const unfreezeTerminal = useTerminalStore((s) => s.unfreezeTerminal);
  const [userMessageCount, setUserMessageCount] = useState(0);
  const [hasMessageAbove, setHasMessageAbove] = useState(false);
  const [hasMessageBelow, setHasMessageBelow] = useState(false);
  const inputBufferRef = useRef('');
  // Stable refs for message stepping — avoids stale closures in attachCustomKeyEventHandler
  const prevMessageRef = useRef<() => void>(() => {});
  const nextMessageRef = useRef<() => void>(() => {});

  // Capture IPC output for overlay display (terminal.write handled by registry)
  // Throttled: accumulate data in ref, flush to state at most every 100ms
  useEffect(() => {
    let outputFlushTimer: ReturnType<typeof setTimeout> | null = null;
    const handler = (_event: unknown, payload: { terminalId: string; data: string }) => {
      if (payload.terminalId === terminalId) {
        outputBufferRef.current += payload.data;
        if (outputBufferRef.current.length > OUTPUT_BUFFER_MAX) {
          outputBufferRef.current = outputBufferRef.current.slice(-OUTPUT_BUFFER_MAX);
        }
        // Throttle setState to avoid render storm during rapid output
        if (!outputFlushTimer) {
          outputFlushTimer = setTimeout(() => {
            outputFlushTimer = null;
            const clean = stripAnsi(outputBufferRef.current);
            const lines = clean.split('\n').filter((l) => l.trim().length > 0);
            setRecentOutput(lines.slice(-5));
          }, SCROLL_THROTTLE_MS);
        }
      }
    };
    ipcRenderer.on(IPC.TERMINAL_OUTPUT_ID, handler);
    return () => {
      ipcRenderer.removeListener(IPC.TERMINAL_OUTPUT_ID, handler);
      if (outputFlushTimer) clearTimeout(outputFlushTimer);
    };
  }, [terminalId]);

  // Persist activity timestamp in registry — survives component remount during workspace switch.
  // Set timestamp on true→false transition so the 60s grace period starts when Claude goes INACTIVE.
  const prevClaudeActiveRef = useRef(false);
  useEffect(() => {
    if (claudeActive && !prevClaudeActiveRef.current) {
      // Claude just became active — set timestamp (also covers fresh mounts with active terminal)
      terminalRegistry.setLastActive(terminalId);
    }
    if (!claudeActive && prevClaudeActiveRef.current) {
      // Claude just became inactive — refresh timestamp so grace period starts from NOW
      terminalRegistry.setLastActive(terminalId);
      // Force scroll button re-evaluation — during active output we freeze showScrollBtn,
      // so after output stops we need one final check in case no more render events fire
      setTimeout(() => {
        const viewport = containerRef.current?.querySelector('.xterm-viewport');
        if (viewport) {
          const atBottom = viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 2;
          setShowScrollBtn(!atBottom);
        }
      }, 150);
    }
    prevClaudeActiveRef.current = claudeActive;
  }, [claudeActive, terminalId]);

  // Track user messages via hook-based IPC signal (primary, foolproof) + pattern fallback.
  // The prompt-submit hook writes to agent-state.json on every user message, which the
  // main process detects and emits USER_MESSAGE_SIGNAL with the terminal ID.
  //
  // Fallback: pattern detection via xterm onData — for terminals without hooks installed.

  // Ref to suppress duplicate markers when both IPC and pattern fire for the same message
  const lastIpcMarkerTime = useRef(0);
  const lastPatternMarkerTime = useRef(0);

  // Primary: IPC-based detection from prompt-submit hook
  useEffect(() => {
    if (!highlightUserMessages) return;

    const handler = (_event: unknown, data: { terminalId: string; timestamp: string }) => {
      if (data.terminalId !== terminalId) return;

      const now = Date.now();
      // Suppress if a pattern-based marker was placed in the last 2 seconds (same message)
      if (now - lastPatternMarkerTime.current < 2000) return;

      lastIpcMarkerTime.current = now;
      terminalRegistry.addUserMessageMarker(terminalId, true, userMessageColor);
    };
    ipcRenderer.on(IPC.USER_MESSAGE_SIGNAL, handler);
    return () => { ipcRenderer.removeListener(IPC.USER_MESSAGE_SIGNAL, handler); };
  }, [highlightUserMessages, terminalId, userMessageColor]);

  // Fallback: pattern-based detection via xterm onData (for terminals without hooks)
  useEffect(() => {
    if (!highlightUserMessages) {
      inputBufferRef.current = '';
      return;
    }
    const instance = terminalRegistry.get(terminalId);
    if (!instance) return;

    const disposable = instance.terminal.onData((data: string) => {
      if (data === '\r' || data === '\n') {
        const typed = inputBufferRef.current.trim();
        inputBufferRef.current = '';
        if (typed.length === 0) return;
        if (!terminalRegistry.wasRecentlyActive(terminalId)) return;

        // Check the buffer line at cursor-1 for the Claude prompt marker `❯`
        const terminal = instance.terminal;
        const cursorY = terminal.buffer.active.cursorY + terminal.buffer.active.baseY;
        const lineIndex = Math.max(0, cursorY - 1);
        const line = terminal.buffer.active.getLine(lineIndex);
        const lineText = line?.translateToString(true) ?? '';

        const hasPromptMarker = lineText.includes('❯');
        const isSlashCommand = /^\/\w/.test(typed);
        const isSubstantial = typed.length > 10;

        if (hasPromptMarker || isSlashCommand || isSubstantial) {
          const now = Date.now();
          // Suppress if IPC already placed a marker in the last 2 seconds (same message)
          if (now - lastIpcMarkerTime.current < 2000) return;

          lastPatternMarkerTime.current = now;
          terminalRegistry.addUserMessageMarker(terminalId, true, userMessageColor);
        }
      } else if (data === '\x7f' || data === '\b') {
        inputBufferRef.current = inputBufferRef.current.slice(0, -1);
      } else if (data.length === 1 && data >= ' ') {
        inputBufferRef.current += data;
      } else if (data.length > 1 && !data.startsWith('\x1b')) {
        inputBufferRef.current += data;
      }
    });

    return () => disposable.dispose();
  }, [highlightUserMessages, terminalId, userMessageColor]);

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

    // Fit + sync PTY dimensions + restore scroll + auto-focus after (re)attach
    const scrollState = savedScrollStateRef.current;
    savedScrollStateRef.current = undefined; // consume once
    let deferredSyncTimer: ReturnType<typeof setTimeout> | null = null;
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
      // Restore scroll position after fit reflow — use a second RAF to ensure
      // fit() has fully settled (its internal resize callbacks run async and can
      // reset scrollTop after our restore if we do it in the same frame)
      requestAnimationFrame(() => {
        if (scrollState) {
          if (scrollState.wasAtBottom) {
            terminal.scrollToBottom();
          } else {
            terminal.scrollToLine(scrollState.viewportY);
          }
        } else {
          // No saved state (first mount) — default to bottom
          terminal.scrollToBottom();
        }
        terminal.focus();

        // Deferred viewport sync — when terminals are reparented from the
        // off-screen holder (1px container), xterm's viewport DOM has stale
        // scroll dimensions. The initial scrollToBottom() sets xterm's internal
        // buffer state (ydisp=ybase) but the DOM viewport's scrollTop may not
        // update because scrollHeight hasn't been re-measured by the browser
        // after reparenting. Re-scroll after a short delay to ensure the
        // viewport has been laid out at its new visible dimensions.
        deferredSyncTimer = setTimeout(() => {
          deferredSyncTimer = null;
          if (!terminalRef.current) return;
          const shouldScrollToBottom = !scrollState || scrollState.wasAtBottom;
          if (shouldScrollToBottom) {
            terminalRef.current.scrollToBottom();
          } else {
            terminalRef.current.scrollToLine(scrollState.viewportY);
          }
          // Direct DOM fallback — if xterm's internal scroll sync still hasn't
          // propagated to the DOM, set scrollTop explicitly
          const viewport = containerRef.current?.querySelector('.xterm-viewport') as HTMLElement | null;
          if (viewport && shouldScrollToBottom) {
            viewport.scrollTop = viewport.scrollHeight;
          }
        }, 80);
      });
    });

    return () => {
      dataDisposable.dispose();
      resizeDisposable.dispose();
      if (deferredSyncTimer) clearTimeout(deferredSyncTimer);
    };
  }, [terminalId, terminalRef, fitAddonRef]);

  // Reset overlay state when terminal changes (e.g. grid slot swap, tab switch, view return)
  useEffect(() => {
    setRecentOutput([]);
    outputBufferRef.current = '';
    inputBufferRef.current = '';
    // Sync marker count from registry (markers persist on the xterm instance)
    setUserMessageCount(terminalRegistry.getUserMessageMarkers(terminalId).length);
    // After attach + fit + scroll restoration completes (all in the first rAF above),
    // check actual scroll position so the overlay shows immediately if scrolled up.
    // Triple rAF ensures we run after the attach effect's rAF + one layout pass.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const viewport = containerRef.current?.querySelector('.xterm-viewport');
          if (viewport) {
            const atBottom = viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 2;
            setShowScrollBtn(!atBottom);
          } else {
            setShowScrollBtn(false);
          }
          computeMessageNavRef.current();
        });
      });
    });
  }, [terminalId]);

  // Subscribe to marker count changes (covers both add and scrollback-dispose)
  useEffect(() => {
    return terminalRegistry.onMarkerChange(terminalId, () => {
      setUserMessageCount(terminalRegistry.getUserMessageMarkers(terminalId).length);
      computeMessageNavRef.current();
    });
  }, [terminalId]);

  // Reset nav state when user message highlighting is toggled off
  useEffect(() => {
    if (!highlightUserMessages) {
      setHasMessageAbove(false);
      setHasMessageBelow(false);
    }
  }, [highlightUserMessages]);

  // Compute message navigation state (above/below viewport) — stored in ref so
  // scroll handler and marker handler can call without stale closures
  const computeMessageNavRef = useRef<() => void>(() => {});
  computeMessageNavRef.current = () => {
    if (!highlightUserMessages) {
      setHasMessageAbove(false);
      setHasMessageBelow(false);
      return;
    }
    const terminal = terminalRef.current;
    if (!terminal) return;
    const markers = terminalRegistry.getUserMessageMarkers(terminalId);
    if (markers.length === 0) {
      setHasMessageAbove(false);
      setHasMessageBelow(false);
      return;
    }
    const vY = terminal.buffer.active.viewportY;
    const vBottom = vY + terminal.rows;
    let above = false, below = false;
    for (const m of markers) {
      if (m.marker.line < vY) above = true;
      if (m.marker.line >= vBottom) below = true;
      if (above && below) break;
    }
    setHasMessageAbove(above);
    setHasMessageBelow(below);
  };

  // Scroll-to-bottom tracking via xterm viewport DOM element
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // xterm renders a .xterm-viewport element that handles scrolling
    // Poll briefly for it since the terminal mounts asynchronously
    let viewport: HTMLElement | null = null;
    let pollTimer: ReturnType<typeof setTimeout>;

    let scrollThrottleTimer: ReturnType<typeof setTimeout> | null = null;
    const updateScroll = () => {
      if (!viewport || scrollThrottleTimer) return;
      scrollThrottleTimer = setTimeout(() => {
        scrollThrottleTimer = null;
        if (!viewport) return;
        const atBottom = viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 2;
        // When Claude is actively writing and terminal is at bottom, don't toggle
        // showScrollBtn — prevents rapid true/false flicker that bounces stepping buttons
        const isActive = useTerminalStore.getState().terminals.get(terminalId)?.claudeActive ?? false;
        if (!(isActive && atBottom)) {
          setShowScrollBtn(!atBottom);
        }
        if (atBottom) {
          setRecentOutput([]);
          outputBufferRef.current = '';
        }
        computeMessageNavRef.current();
      }, SCROLL_THROTTLE_MS);
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
      if (scrollThrottleTimer) clearTimeout(scrollThrottleTimer);
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

      // Ctrl+Up/Down: message stepping (navigate between user messages)
      if (modKey && !event.shiftKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
        event.preventDefault();
        if (event.key === 'ArrowUp') {
          prevMessageRef.current();
        } else {
          nextMessageRef.current();
        }
        return false;
      }

      // Copy: Ctrl+C when there is a selection (otherwise let SIGINT go through)
      if (modKey && key === 'c' && !event.shiftKey && terminal.hasSelection()) {
        event.preventDefault();
        clipboard.writeText(terminal.getSelection());
        terminal.clearSelection();
        return false;
      }

      // Paste: Ctrl+V (manual paste via electron clipboard)
      if (modKey && key === 'v' && !event.shiftKey) {
        event.preventDefault();
        const text = clipboard.readText();
        if (text) terminal.paste(text);
        return false;
      }

      // Pass app-level shortcuts through (return false = SubFrame handles, not terminal)
      // Ctrl+Shift+* combos are always SubFrame shortcuts (panels, new terminal, etc.)
      if (modKey && event.shiftKey) return false;
      // Ctrl+1-9: switch terminal tabs
      if (modKey && event.key >= '1' && event.key <= '9') return false;
      // Ctrl+B: toggle sidebar | Ctrl+G: toggle grid | Ctrl+K: command palette
      if (modKey && !event.shiftKey && key === 'b') return false;
      if (modKey && !event.shiftKey && key === 'g') return false;
      if (modKey && key === 'k') return false;
      // Ctrl+[/]: project switching | Ctrl+Tab: terminal switching
      if (modKey && (event.key === '[' || event.key === ']')) return false;
      if (modKey && event.key === 'Tab') return false;
      // Note: Ctrl+T, Ctrl+I, Ctrl+H, Ctrl+E pass through to the terminal
      // so Claude Code's native shortcuts (task toggle, etc.) work

      return true;
    });
  }, [terminalRef]);

  // Register file path link provider — Ctrl+click to open files in editor
  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;

    const linkDisposable = terminalRegistry.registerFilePathLinkProvider(
      terminal,
      () => useProjectStore.getState().currentProjectPath,
      (filePath: string, _line?: number) => {
        useUIStore.getState().setEditorFilePath(filePath);
      },
    );

    // Register selection sync for the Local API Server
    const selectionDisposable = terminalRegistry.registerSelectionSync(terminalId);

    return () => { linkDisposable.dispose(); selectionDisposable.dispose(); };
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
    // Direct viewport DOM fallback — when xterm's viewport is desynced after
    // reparenting (workspace switch), scrollToBottom() sets internal state but
    // the DOM scrollTop may not update. Explicitly set scrollTop as backup.
    const viewport = containerRef.current?.querySelector('.xterm-viewport') as HTMLElement | null;
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
    setShowScrollBtn(false);
    setRecentOutput([]);
    outputBufferRef.current = '';
  }, [terminalRef]);

  // Navigate to previous user message (above viewport)
  const handleScrollToPrevMessage = useCallback(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;
    // Fit before reading viewport to avoid stale positions after reattach reflow
    try { fitAddonRef.current?.fit(); } catch { /* ignore */ }
    const markers = terminalRegistry.getUserMessageMarkers(terminalId);
    if (markers.length === 0) return;

    const viewportY = terminal.buffer.active.viewportY;
    for (let i = markers.length - 1; i >= 0; i--) {
      if (markers[i].marker.line < viewportY) {
        terminal.scrollToLine(Math.max(0, markers[i].marker.line - 2));
        return;
      }
    }
  }, [terminalRef, fitAddonRef, terminalId]);
  prevMessageRef.current = handleScrollToPrevMessage;

  // Navigate to next user message (below viewport)
  const handleScrollToNextMessage = useCallback(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;
    try { fitAddonRef.current?.fit(); } catch { /* ignore */ }
    const markers = terminalRegistry.getUserMessageMarkers(terminalId);
    if (markers.length === 0) return;

    const viewportBottom = terminal.buffer.active.viewportY + terminal.rows;
    for (const m of markers) {
      if (m.marker.line >= viewportBottom) {
        terminal.scrollToLine(Math.max(0, m.marker.line - 2));
        return;
      }
    }
  }, [terminalRef, fitAddonRef, terminalId]);
  nextMessageRef.current = handleScrollToNextMessage;

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

          {/* Frozen overlay indicator */}
          <AnimatePresence>
            {isFrozen && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className={`absolute ${showSearch ? 'top-12' : 'top-2'} right-2 z-20 flex items-center gap-1.5 px-2 py-1 rounded-md
                           bg-info/15 border border-info/30 text-info text-[10px] font-medium backdrop-blur-sm`}
              >
                <Pause className="h-3 w-3" />
                Output paused
                <button
                  onClick={() => {
                    terminalRegistry.unfreeze(terminalId);
                    unfreezeTerminal(terminalId);
                  }}
                  className="ml-1 px-1.5 py-0.5 rounded bg-info/20 hover:bg-info/30 transition-colors cursor-pointer"
                >
                  Resume
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
                  <ArrowDownToLine className="h-3 w-3" />
                  <span>Click to scroll to bottom</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Message stepping buttons — navigate between user messages */}
          <AnimatePresence>
            {highlightUserMessages && hasMessageAbove && (
              <motion.button
                key="prev-msg"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  bottom: `${((showScrollBtn ? (hasMessageBelow ? 2 : 1) : (hasMessageBelow ? 1 : 0)) * 2.5 + (recentOutput.length > 0 ? 6 : 1))}rem`,
                }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleScrollToPrevMessage();
                }}
                className="absolute right-4 z-20 flex h-8 items-center gap-1.5 px-2.5
                           rounded-full bg-bg-elevated border border-border-subtle
                           text-text-secondary hover:text-accent hover:border-accent/60
                           transition-all shadow-lg cursor-pointer"
                title="Previous user message"
              >
                <ArrowUp className="h-3.5 w-3.5" />
                <MessageSquare className="h-3 w-3" />
              </motion.button>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {highlightUserMessages && hasMessageBelow && (
              <motion.button
                key="next-msg"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  bottom: `${((showScrollBtn ? 1 : 0) * 2.5 + (recentOutput.length > 0 ? 6 : 1))}rem`,
                }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleScrollToNextMessage();
                }}
                className="absolute right-4 z-20 flex h-8 items-center gap-1.5 px-2.5
                           rounded-full bg-bg-elevated border border-border-subtle
                           text-text-secondary hover:text-accent hover:border-accent/60
                           transition-all shadow-lg cursor-pointer"
                title="Next user message"
              >
                <ArrowDown className="h-3.5 w-3.5" />
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
                <ArrowDownToLine className="h-4 w-4" />
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
