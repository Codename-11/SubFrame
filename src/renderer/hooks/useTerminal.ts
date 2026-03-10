/**
 * Custom hook for attaching persistent xterm.js terminals to React containers.
 *
 * Terminal instances live in the terminalRegistry (outside React) and survive
 * component unmount/remount cycles. This hook handles:
 * - Attaching the terminal DOM to the container on mount
 * - Detaching (not destroying) on unmount
 * - Auto-fitting via debounced ResizeObserver
 */

import { useEffect, useRef } from 'react';
import type { Terminal } from 'xterm';
import type { FitAddon } from 'xterm-addon-fit';
import type { SearchAddon } from 'xterm-addon-search';
import * as terminalRegistry from '../lib/terminalRegistry';
import { useUIStore } from '../stores/useUIStore';

export type { TerminalOptions as UseTerminalOptions } from '../lib/terminalRegistry';

export interface UseTerminalResult {
  terminalRef: React.MutableRefObject<Terminal | null>;
  fitAddonRef: React.MutableRefObject<FitAddon | null>;
  searchAddonRef: React.MutableRefObject<SearchAddon | null>;
}

/**
 * Attach a persistent terminal instance to a container element.
 * The terminal survives unmount — only detaches from the DOM, preserving scrollback.
 */
export function useTerminal(
  containerRef: React.RefObject<HTMLDivElement | null>,
  terminalId: string,
  options?: terminalRegistry.TerminalOptions
): UseTerminalResult {
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Get or create persistent instance (survives across mounts)
    const instance = terminalRegistry.getOrCreate(terminalId, options);
    terminalRef.current = instance.terminal;
    fitAddonRef.current = instance.fitAddon;
    searchAddonRef.current = instance.searchAddon;

    // Attach terminal DOM to this container
    terminalRegistry.attach(terminalId, container);

    // Auto-fit on container resize — skips fit() during active panel/sidebar drag
    // to avoid continuous buffer reflow + PTY resize cascades. Fits once on drag end.
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    let needsFitAfterResize = false;

    const doFit = () => {
      requestAnimationFrame(() => {
        try {
          instance.fitAddon.fit();
        } catch {
          // Ignore if terminal is disposed
        }
      });
    };

    const observer = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer);
      // During active panel drag, defer fit until drag ends
      if (useUIStore.getState().isResizing) {
        needsFitAfterResize = true;
        return;
      }
      resizeTimer = setTimeout(doFit, 80);
    });
    observer.observe(container);

    // Subscribe to isResizing changes — fit once when drag ends
    const unsubResize = useUIStore.subscribe((state, prev) => {
      if (prev.isResizing && !state.isResizing && needsFitAfterResize) {
        needsFitAfterResize = false;
        if (resizeTimer) { clearTimeout(resizeTimer); resizeTimer = null; }
        doFit();
      }
    });

    return () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      observer.disconnect();
      unsubResize();
      // Detach — do NOT dispose. Instance stays alive in the registry.
      terminalRegistry.detach(terminalId);
      terminalRef.current = null;
      fitAddonRef.current = null;
      searchAddonRef.current = null;
    };
    // Re-run only when terminalId changes (options are read-once on creation)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terminalId]);

  return { terminalRef, fitAddonRef, searchAddonRef };
}
