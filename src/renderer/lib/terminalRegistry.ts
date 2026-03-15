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
import type { Terminal, IMarker, IDecoration, IDisposable, ILinkProvider, ILink, IBufferRange } from 'xterm';
import type { FitAddon } from 'xterm-addon-fit';
import type { SearchAddon } from 'xterm-addon-search';
import type { WebLinksAddon } from 'xterm-addon-web-links';
import type { Unicode11Addon } from 'xterm-addon-unicode11';

const { Terminal: XTerminal } = require('xterm') as { Terminal: typeof Terminal };
const { FitAddon: XFitAddon } = require('xterm-addon-fit') as { FitAddon: typeof FitAddon };
const { SearchAddon: XSearchAddon } = require('xterm-addon-search') as {
  SearchAddon: typeof SearchAddon;
};

let XWebglAddon: any = null;
let XCanvasAddon: any = null;
let XWebLinksAddon: (typeof WebLinksAddon) | null = null;
let XUnicode11Addon: (typeof Unicode11Addon) | null = null;
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
try {
  XWebLinksAddon = require('xterm-addon-web-links').WebLinksAddon;
} catch {
  /* not available */
}
try {
  XUnicode11Addon = require('xterm-addon-unicode11').Unicode11Addon;
} catch {
  /* not available */
}

const { ipcRenderer, shell } = require('electron');

/** Static ANSI palette — these rarely change across themes */
const ANSI_COLORS = {
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

/** Read accent-sensitive terminal theme from CSS variables (falls back to defaults) */
function getTerminalTheme() {
  const root = document.documentElement;
  const css = (v: string, fallback: string) => getComputedStyle(root).getPropertyValue(v).trim() || fallback;
  return {
    background: css('--color-bg-deep', '#0f0f10'),
    foreground: css('--color-text-primary', '#e8e6e3'),
    cursor: css('--color-accent', '#d4a574'),
    cursorAccent: css('--color-bg-deep', '#0f0f10'),
    selectionBackground: css('--color-accent-subtle', 'rgba(212, 165, 116, 0.25)'),
    selectionForeground: css('--color-text-primary', '#e8e6e3'),
    ...ANSI_COLORS,
  };
}

/** Update the theme on all existing terminal instances (called when CSS variables change) */
export function refreshTerminalThemes(): void {
  const theme = getTerminalTheme();
  for (const [, entry] of registry) {
    entry.terminal.options.theme = theme;
  }
}

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
    theme: getTerminalTheme(),
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

  // Web links — makes URLs clickable, opens in default browser
  if (XWebLinksAddon) {
    try {
      terminal.loadAddon(new XWebLinksAddon((_event: MouseEvent, uri: string) => {
        try {
          const { protocol } = new URL(uri);
          if (protocol === 'https:' || protocol === 'http:') {
            shell.openExternal(uri);
          }
        } catch { /* malformed URL — ignore */ }
      }));
    } catch {
      /* addon failed to load */
    }
  }

  // Unicode 11 — fixes emoji width calculation and CJK character rendering
  if (XUnicode11Addon) {
    try {
      terminal.loadAddon(new XUnicode11Addon());
      terminal.unicode.activeVersion = '11';
    } catch {
      /* addon failed to load */
    }
  }

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

// ---------------------------------------------------------------------------
// File path link provider — Ctrl+click to open files in editor
// ---------------------------------------------------------------------------

/** Common source file extensions for link detection */
const FILE_EXTENSIONS = '(?:ts|tsx|js|jsx|json|md|css|html|yml|yaml|toml|py|go|rs|vue|svelte|rb|sh|bash|zsh|java|kt|swift|c|cpp|h|hpp|cs|php|lua|zig|ex|exs|erl|hrl|hs|ml|mli|r|R|sql|graphql|gql|proto|tf|hcl|Dockerfile|Makefile)';

/**
 * Regex to detect file paths in terminal output.
 * Matches:
 *   - Relative paths: src/renderer/App.tsx, ./package.json, ../utils/helper.ts
 *   - Paths with line numbers: src/App.tsx:42, src/App.tsx:42:10
 *   - Windows backslash paths: src\renderer\App.tsx
 *   - Quoted paths: "src/App.tsx", 'src/App.tsx'
 *
 * The regex requires at least one directory separator (/ or \) or a dot-prefixed
 * relative path to avoid matching bare filenames that are likely not paths.
 */
const FILE_PATH_REGEX = new RegExp(
  // Optional opening quote
  `(?:^|(?<=[\\s"'(\`]))` +
  // Path: optional ./ or ../ prefix, then segments with / or \, ending with known extension
  `((?:\\.{1,2}[/\\\\])?(?:[\\w.@-]+[/\\\\])+[\\w.@-]+\\.${FILE_EXTENSIONS})` +
  // Optional :line and :col suffixes
  `(?::(\\d+))?(?::(\\d+))?` +
  // Optional closing quote or boundary
  `(?=[\\s"')\`,:;]|$)`,
  'g'
);

/**
 * Register a file path link provider on a terminal instance.
 * Detects file paths in terminal output and opens them in the editor on Ctrl+click.
 *
 * @param terminal The xterm.js Terminal instance
 * @param getProjectPath Callback to get the current project path (may change over time)
 * @param openFile Callback to open a file in the editor (receives absolute path and optional line number)
 * @returns Disposable to unregister the provider
 */
export function registerFilePathLinkProvider(
  terminal: Terminal,
  getProjectPath: () => string | null,
  openFile: (filePath: string, line?: number) => void,
): IDisposable {
  const provider: ILinkProvider = {
    provideLinks(bufferLineNumber: number, callback: (links: ILink[] | undefined) => void): void {
      const line = terminal.buffer.active.getLine(bufferLineNumber - 1);
      if (!line) {
        callback(undefined);
        return;
      }

      const lineText = line.translateToString(true);
      const links: ILink[] = [];

      // Create fresh regex per call to avoid shared lastIndex state
      const regex = new RegExp(FILE_PATH_REGEX.source, 'g');
      let match: RegExpExecArray | null;

      while ((match = regex.exec(lineText)) !== null) {
        const fullMatch = match[0];
        const filePath = match[1];
        const lineNum = match[2] ? parseInt(match[2], 10) : undefined;
        // match[3] is column — captured but not used currently

        // Compute 1-based x positions within the line
        const startX = match.index + 1;
        const endX = match.index + fullMatch.length;

        const range: IBufferRange = {
          start: { x: startX, y: bufferLineNumber },
          end: { x: endX, y: bufferLineNumber },
        };

        links.push({
          range,
          text: fullMatch,
          decorations: { underline: false, pointerCursor: false },

          activate(event: MouseEvent, _text: string): void {
            if (!event.ctrlKey && !event.metaKey) return;

            const projectPath = getProjectPath();
            if (!projectPath) return;

            const normalized = filePath.replace(/\\/g, '/');
            const resolved = normalized.startsWith('/')
              ? normalized
              : `${projectPath}/${normalized}`;

            openFile(resolved, lineNum);
          },

          hover(event: MouseEvent, _text: string): void {
            if (event.ctrlKey || event.metaKey) {
              this.decorations = { underline: true, pointerCursor: true };
            }
          },

          leave(_event: MouseEvent, _text: string): void {
            this.decorations = { underline: false, pointerCursor: false };
          },
        });
      }

      callback(links.length > 0 ? links : undefined);
    },
  };

  return terminal.registerLinkProvider(provider);
}
