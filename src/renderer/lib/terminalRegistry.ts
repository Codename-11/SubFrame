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
import type { Terminal, IMarker, IDecoration } from 'xterm';
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
  cursorBlink?: boolean;
  cursorStyle?: 'block' | 'underline' | 'bar';
  bellSound?: boolean;
  copyOnSelect?: boolean;
}

export interface UserMessageMarker {
  marker: IMarker;
  decoration?: IDecoration;
}

// Listeners notified when markers change (add/dispose) — keyed by terminal ID
const markerChangeListeners = new Map<string, Set<() => void>>();

/** Subscribe to marker count changes for a terminal. Returns unsubscribe function. */
export function onMarkerChange(id: string, cb: () => void): () => void {
  let set = markerChangeListeners.get(id);
  if (!set) { set = new Set(); markerChangeListeners.set(id, set); }
  set.add(cb);
  return () => { set!.delete(cb); if (set!.size === 0) markerChangeListeners.delete(id); };
}

function notifyMarkerChange(id: string): void {
  const set = markerChangeListeners.get(id);
  if (set) for (const cb of set) cb();
}

/** Saved scroll state — captured on detach, consumed on next attach */
export interface SavedScrollState {
  /** True if terminal was at the bottom of its buffer when detached */
  wasAtBottom: boolean;
  /** xterm buffer viewportY (line-based, survives reflows better than pixel scrollTop) */
  viewportY: number;
}

interface RegistryEntry extends TerminalInstance {
  holderDiv: HTMLDivElement;
  ipcCleanup: () => void;
  userMessageMarkers: UserMessageMarker[];
  /** Timestamp when Claude was last detected as active — used for grace period */
  lastActiveTimestamp: number;
  /** Scroll position saved on detach — consumed (and cleared) on next attach */
  savedScrollState?: SavedScrollState;
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
    cursorBlink: options?.cursorBlink ?? true,
    cursorStyle: options?.cursorStyle ?? 'bar',
    fontSize: options?.fontSize ?? 14,
    fontFamily: options?.fontFamily ?? "'JetBrainsMono Nerd Font', 'CaskaydiaCove Nerd Font', 'FiraCode Nerd Font', 'JetBrains Mono', 'SF Mono', Consolas, monospace",
    theme: TERMINAL_THEME,
    allowProposedApi: true,
    allowTransparency: false,
    scrollback: options?.scrollback ?? 10000,
    lineHeight: options?.lineHeight ?? 1.1,
    letterSpacing: 0,
  });

  terminal.loadAddon(fitAddon);

  // Bell sound — suppress by consuming the onBell event
  if (options?.bellSound === false) {
    terminal.onBell(() => { /* suppressed */ });
  }

  // Copy on select
  if (options?.copyOnSelect) {
    terminal.onSelectionChange(() => {
      const selection = terminal.getSelection();
      if (selection) {
        navigator.clipboard.writeText(selection).catch(() => {});
      }
    });
  }

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

  const entry: RegistryEntry = { terminal, fitAddon, searchAddon, holderDiv, ipcCleanup, userMessageMarkers: [], lastActiveTimestamp: 0 };
  registry.set(id, entry);
  return entry;
}

/**
 * Attach a terminal's DOM to a visible container.
 * Moves the holder div (which contains the xterm DOM tree) into the container.
 * Returns the instance plus any saved scroll state from the last detach (consumed once).
 */
export function attach(id: string, container: HTMLDivElement): (TerminalInstance & { savedScrollState?: SavedScrollState }) | null {
  const entry = registry.get(id);
  if (!entry) return null;

  // Move holder div into the visible container
  container.appendChild(entry.holderDiv);

  // Pop saved scroll state (one-time consumption)
  const savedScrollState = entry.savedScrollState;
  entry.savedScrollState = undefined;

  // Fit is handled by the component's resize effect (which also syncs PTY dimensions)
  return { terminal: entry.terminal, fitAddon: entry.fitAddon, searchAddon: entry.searchAddon, savedScrollState };
}

/**
 * Detach a terminal from its visible container back to the off-screen holder.
 * Instance and scrollback remain alive. Saves scroll state for restoration on next attach.
 */
export function detach(id: string): void {
  const entry = registry.get(id);
  if (!entry) return;

  // Save scroll state before moving DOM — browser may reset scrollTop during reparent
  const terminal = entry.terminal;
  const buf = terminal.buffer.active;
  const wasAtBottom = buf.viewportY >= buf.baseY;
  entry.savedScrollState = { wasAtBottom, viewportY: buf.viewportY };

  getHolderRoot().appendChild(entry.holderDiv);
}

/**
 * Permanently dispose a terminal instance.
 * Only call when the user explicitly closes a terminal.
 */
export function dispose(id: string): void {
  const entry = registry.get(id);
  if (!entry) return;

  // Clean up user message markers before disposing terminal
  for (const umm of entry.userMessageMarkers) {
    umm.decoration?.dispose();
  }
  entry.userMessageMarkers = [];
  markerChangeListeners.delete(id);

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

/**
 * Register a user message marker at the terminal's current cursor position.
 * Creates an xterm marker + optional left-border decoration.
 */
export function addUserMessageMarker(id: string, showDecoration: boolean, color = '#ff6eb4'): IMarker | null {
  const entry = registry.get(id);
  if (!entry) return null;

  const terminal = entry.terminal;
  // Offset -1: cursor has already moved to the next line by the time onData fires
  const marker = terminal.registerMarker(-1);
  if (!marker) return null;

  let decoration: IDecoration | undefined;
  if (showDecoration) {
    decoration = terminal.registerDecoration({
      marker,
      anchor: 'left',
      width: 1,
      height: 1,
      overviewRulerOptions: { color, position: 'left' },
    });
    if (decoration) {
      decoration.onRender((el) => {
        // Set individual properties — DO NOT use cssText (it wipes xterm's
        // top/left/width/height positioning, making the element invisible)
        el.classList.add('xterm-user-message-marker');
        el.style.width = '4px';
        el.style.background = color;
        el.style.borderRadius = '0 2px 2px 0';
        el.style.boxShadow = `0 0 6px ${color}66, 2px 0 10px ${color}33`;
        el.style.pointerEvents = 'none';
        el.style.zIndex = '6';
      });
    }
  }

  const umm: UserMessageMarker = { marker, decoration };
  entry.userMessageMarkers.push(umm);
  notifyMarkerChange(id);

  // Clean up disposed markers (scrolled out of scrollback)
  marker.onDispose(() => {
    const idx = entry.userMessageMarkers.indexOf(umm);
    if (idx >= 0) {
      entry.userMessageMarkers.splice(idx, 1);
      notifyMarkerChange(id);
    }
  });

  return marker;
}

/** Get all user message markers for a terminal */
export function getUserMessageMarkers(id: string): UserMessageMarker[] {
  return registry.get(id)?.userMessageMarkers ?? [];
}

/** Clear all user message markers for a terminal */
export function clearUserMessageMarkers(id: string): void {
  const entry = registry.get(id);
  if (!entry) return;
  for (const umm of entry.userMessageMarkers) {
    umm.decoration?.dispose();
    umm.marker.dispose();
  }
  entry.userMessageMarkers = [];
}

/** Mark terminal as recently active (Claude detected). Timestamp persists across React remounts. */
export function setLastActive(id: string): void {
  const entry = registry.get(id);
  if (entry) entry.lastActiveTimestamp = Date.now();
}

/** Check if Claude was active within the grace window (default 60s). Survives component remount. */
export function wasRecentlyActive(id: string, windowMs = 60_000): boolean {
  const entry = registry.get(id);
  if (!entry) return false;
  return (Date.now() - entry.lastActiveTimestamp) < windowMs;
}
