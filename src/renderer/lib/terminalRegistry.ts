/**
 * Persistent terminal instance registry.
 * Decouples xterm.js Terminal lifecycle from React component mount/unmount.
 *
 * Terminal instances are created once and live until explicitly disposed (terminal close).
 * React components attach/detach to display them, but unmounting does NOT destroy
 * the instance or its scrollback buffer.
 *
 * IPC output listeners are always-on — data streams into the xterm buffer even when
 * the terminal is not visible, preserving full scrollback history.
 */

import { IPC } from '../../shared/ipcChannels';
import type { Terminal } from 'xterm';
import type { FitAddon } from 'xterm-addon-fit';
import type { SearchAddon } from 'xterm-addon-search';

const { Terminal: XTerminal } = require('xterm') as { Terminal: typeof Terminal };
const { FitAddon: XFitAddon } = require('xterm-addon-fit') as { FitAddon: typeof FitAddon };
const { SearchAddon: XSearchAddon } = require('xterm-addon-search') as {
  SearchAddon: typeof SearchAddon;
};

let XWebglAddon: any = null;
let XCanvasAddon: any = null;
try {
  XWebglAddon = require('xterm-addon-webgl').WebglAddon;
} catch {
  /* not available */
}
try {
  XCanvasAddon = require('xterm-addon-canvas').CanvasAddon;
} catch {
  /* not available */
}

const { ipcRenderer } = require('electron');

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

export interface TerminalInstance {
  terminal: Terminal;
  fitAddon: FitAddon;
  searchAddon: SearchAddon;
}

export interface TerminalOptions {
  fontSize?: number;
  fontFamily?: string;
  scrollback?: number;
  lineHeight?: number;
}

interface RegistryEntry extends TerminalInstance {
  holderDiv: HTMLDivElement;
  ipcCleanup: () => void;
}

const registry = new Map<string, RegistryEntry>();

// Off-screen holder for detached terminals — stays in the DOM so xterm buffers work
let holderRoot: HTMLDivElement | null = null;
function getHolderRoot(): HTMLDivElement {
  if (!holderRoot) {
    holderRoot = document.createElement('div');
    holderRoot.style.cssText =
      'position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;pointer-events:none;opacity:0;';
    holderRoot.setAttribute('aria-hidden', 'true');
    document.body.appendChild(holderRoot);
  }
  return holderRoot;
}

function loadGpuRenderer(terminal: Terminal): void {
  if (XWebglAddon) {
    try {
      const webglAddon = new XWebglAddon();
      webglAddon.onContextLoss(() => {
        webglAddon.dispose();
        if (XCanvasAddon) {
          try {
            terminal.loadAddon(new XCanvasAddon());
          } catch {
            /* DOM fallback */
          }
        }
      });
      terminal.loadAddon(webglAddon);
    } catch {
      if (XCanvasAddon) {
        try {
          terminal.loadAddon(new XCanvasAddon());
        } catch {
          /* DOM fallback */
        }
      }
    }
  } else if (XCanvasAddon) {
    try {
      terminal.loadAddon(new XCanvasAddon());
    } catch {
      /* DOM fallback */
    }
  }
}

/**
 * Get an existing terminal instance or create a new one.
 * Instances persist across React component mount/unmount cycles.
 */
export function getOrCreate(id: string, options?: TerminalOptions): TerminalInstance {
  const existing = registry.get(id);
  if (existing) return existing;

  const fitAddon = new XFitAddon();
  const searchAddon = new XSearchAddon();
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

  // Open into a persistent holder div (off-screen until attached)
  const holderDiv = document.createElement('div');
  holderDiv.style.cssText = 'width:100%;height:100%;';
  getHolderRoot().appendChild(holderDiv);
  terminal.open(holderDiv);

  terminal.loadAddon(searchAddon);
  loadGpuRenderer(terminal);

  // Persistent IPC output listener — keeps scrollback alive even when not visible
  const handler = (_event: unknown, payload: { terminalId: string; data: string }) => {
    if (payload.terminalId === id) {
      terminal.write(payload.data);
    }
  };
  ipcRenderer.on(IPC.TERMINAL_OUTPUT_ID, handler);
  const ipcCleanup = () => ipcRenderer.removeListener(IPC.TERMINAL_OUTPUT_ID, handler);

  const entry: RegistryEntry = { terminal, fitAddon, searchAddon, holderDiv, ipcCleanup };
  registry.set(id, entry);
  return entry;
}

/**
 * Attach a terminal's DOM to a visible container.
 * Moves the holder div (which contains the xterm DOM tree) into the container.
 */
export function attach(id: string, container: HTMLDivElement): TerminalInstance | null {
  const entry = registry.get(id);
  if (!entry) return null;

  // Move holder div into the visible container
  container.appendChild(entry.holderDiv);

  // Fit is handled by the component's resize effect (which also syncs PTY dimensions)
  return entry;
}

/**
 * Detach a terminal from its visible container back to the off-screen holder.
 * Instance and scrollback remain alive.
 */
export function detach(id: string): void {
  const entry = registry.get(id);
  if (!entry) return;

  getHolderRoot().appendChild(entry.holderDiv);
}

/**
 * Permanently dispose a terminal instance.
 * Only call when the user explicitly closes a terminal.
 */
export function dispose(id: string): void {
  const entry = registry.get(id);
  if (!entry) return;

  entry.ipcCleanup();
  try {
    entry.terminal.dispose();
  } catch {
    /* WebGL addon can throw during disposal */
  }
  entry.holderDiv.remove();
  registry.delete(id);
}

/** Check if a terminal exists in the registry */
export function has(id: string): boolean {
  return registry.has(id);
}

/** Get an existing instance (returns null if not found) */
export function get(id: string): TerminalInstance | null {
  return registry.get(id) ?? null;
}
