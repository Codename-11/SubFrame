/**
 * Custom hook for xterm.js terminal lifecycle.
 * Manages Terminal + FitAddon + renderer addons (WebGL/Canvas) + SearchAddon.
 * Auto-fits via ResizeObserver. Safe under React StrictMode (guards double-mount).
 */

import { useEffect, useRef } from 'react';
import type { Terminal } from 'xterm';
import type { FitAddon } from 'xterm-addon-fit';
import type { SearchAddon } from 'xterm-addon-search';

// CommonJS imports — xterm ships CJS in Electron renderer
const { Terminal: XTerminal } = require('xterm') as { Terminal: typeof Terminal };
const { FitAddon: XFitAddon } = require('xterm-addon-fit') as { FitAddon: typeof FitAddon };
const { SearchAddon: XSearchAddon } = require('xterm-addon-search') as { SearchAddon: typeof SearchAddon };

// Renderer addons — loaded dynamically with fallback chain
let XWebglAddon: any = null;
let XCanvasAddon: any = null;
try { XWebglAddon = require('xterm-addon-webgl').WebglAddon; } catch { /* not available */ }
try { XCanvasAddon = require('xterm-addon-canvas').CanvasAddon; } catch { /* not available */ }

const TERMINAL_THEME = {
  background: '#0f0f10',
  foreground: '#e8e6e3',
  cursor: '#d4a574',
  cursorAccent: '#0f0f10',
  selectionBackground: 'rgba(212, 165, 116, 0.25)',
  selectionForeground: '#e8e6e3',
  black: '#1a1a1c',
  red: '#d47878',
  green: '#7cb382',
  yellow: '#e0a458',
  blue: '#78a5d4',
  magenta: '#bc8fd4',
  cyan: '#6cc4c4',
  white: '#e8e6e3',
  brightBlack: '#6b6660',
  brightRed: '#e09090',
  brightGreen: '#96c89c',
  brightYellow: '#eab870',
  brightBlue: '#92bde4',
  brightMagenta: '#d0a8e4',
  brightCyan: '#86d8d8',
  brightWhite: '#f4f2f0',
};

export interface UseTerminalOptions {
  fontSize?: number;
  fontFamily?: string;
  scrollback?: number;
  lineHeight?: number;
}

export interface UseTerminalResult {
  terminalRef: React.MutableRefObject<Terminal | null>;
  fitAddonRef: React.MutableRefObject<FitAddon | null>;
  searchAddonRef: React.MutableRefObject<SearchAddon | null>;
}

/**
 * Hook that creates an xterm.js Terminal, opens it in `containerRef`, loads
 * GPU-accelerated renderer (WebGL → Canvas → DOM fallback), search addon,
 * and auto-fits on container resize.
 */
export function useTerminal(
  containerRef: React.RefObject<HTMLDivElement | null>,
  options?: UseTerminalOptions
): UseTerminalResult {
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mountedRef.current) return;
    mountedRef.current = true;

    // Create terminal + fit addon
    const fitAddon = new XFitAddon();
    const terminal = new XTerminal({
      cursorBlink: true,
      fontSize: options?.fontSize ?? 14,
      fontFamily: options?.fontFamily ?? "'JetBrains Mono', 'SF Mono', Consolas, monospace",
      theme: TERMINAL_THEME,
      allowTransparency: false,
      scrollback: options?.scrollback ?? 10000,
      lineHeight: options?.lineHeight ?? 1.1,
      letterSpacing: 0,
    });

    terminal.loadAddon(fitAddon);
    terminal.open(container);

    // Load search addon
    const searchAddon = new XSearchAddon();
    terminal.loadAddon(searchAddon);
    searchAddonRef.current = searchAddon;

    // Load GPU-accelerated renderer: WebGL → Canvas → DOM (default)
    if (XWebglAddon) {
      try {
        const webglAddon = new XWebglAddon();
        webglAddon.onContextLoss(() => {
          webglAddon.dispose();
          // Fallback to Canvas on context loss
          if (XCanvasAddon) {
            try { terminal.loadAddon(new XCanvasAddon()); } catch { /* DOM fallback */ }
          }
        });
        terminal.loadAddon(webglAddon);
      } catch {
        // WebGL failed, try Canvas
        if (XCanvasAddon) {
          try { terminal.loadAddon(new XCanvasAddon()); } catch { /* DOM fallback */ }
        }
      }
    } else if (XCanvasAddon) {
      try { terminal.loadAddon(new XCanvasAddon()); } catch { /* DOM fallback */ }
    }

    // Initial fit (deferred so container has layout dimensions)
    requestAnimationFrame(() => {
      try {
        fitAddon.fit();
      } catch {
        // Container might not be visible yet
      }
    });

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Auto-fit on container resize
    const observer = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        try {
          fitAddon.fit();
        } catch {
          // Ignore if terminal is disposed
        }
      });
    });
    observer.observe(container);

    return () => {
      mountedRef.current = false;
      observer.disconnect();
      try {
        terminal.dispose();
      } catch {
        // WebGL addon can throw during disposal if the GL context is already lost
        // or the DOM element has been detached — safe to ignore
      }
      terminalRef.current = null;
      fitAddonRef.current = null;
      searchAddonRef.current = null;
    };
    // Intentionally only run once on mount — options are read once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { terminalRef, fitAddonRef, searchAddonRef };
}
