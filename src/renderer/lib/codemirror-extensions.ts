import { type Extension, Compartment } from '@codemirror/state';
import { EditorState } from '@codemirror/state';
import {
  keymap,
  lineNumbers,
  highlightActiveLineGutter,
  highlightSpecialChars,
  drawSelection,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
  highlightActiveLine,
  EditorView,
} from '@codemirror/view';
import {
  history,
  defaultKeymap,
  historyKeymap,
  indentWithTab,
} from '@codemirror/commands';
import {
  foldGutter,
  indentOnInput,
  bracketMatching,
  foldKeymap,
  indentUnit,
} from '@codemirror/language';
import {
  closeBrackets,
  closeBracketsKeymap,
  autocompletion,
  completionKeymap,
} from '@codemirror/autocomplete';
import {
  highlightSelectionMatches,
  searchKeymap,
} from '@codemirror/search';
import { lintKeymap, linter, type Diagnostic } from '@codemirror/lint';

// Language imports
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { markdown } from '@codemirror/lang-markdown';
import { python } from '@codemirror/lang-python';
import { yaml } from '@codemirror/lang-yaml';
import { xml } from '@codemirror/lang-xml';
import { rust } from '@codemirror/lang-rust';
import { cpp } from '@codemirror/lang-cpp';
import { java } from '@codemirror/lang-java';
import { php } from '@codemirror/lang-php';
import { sql } from '@codemirror/lang-sql';
import { sass } from '@codemirror/lang-sass';
import { less } from '@codemirror/lang-less';
import { vue } from '@codemirror/lang-vue';
import { wast } from '@codemirror/lang-wast';

// Minimap
import { showMinimap } from '@replit/codemirror-minimap';

// Cache language extensions to avoid recreating parser instances
const languageCache = new Map<string, Extension>();

/**
 * Returns the appropriate CM6 language extension for a given filename,
 * or null if the file type is not recognized. Results are cached per extension.
 */
export function getLanguageExtension(filename: string): Extension | null {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (!ext) return null;

  const cached = languageCache.get(ext);
  if (cached) return cached;

  const lang = resolveLanguage(ext);
  if (lang) languageCache.set(ext, lang);
  return lang;
}

function resolveLanguage(ext: string): Extension | null {
  switch (ext) {
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return javascript({ jsx: ext === 'jsx' });
    case 'ts':
    case 'tsx':
      return javascript({ typescript: true, jsx: ext === 'tsx' });
    case 'json':
      return json();
    case 'css':
      return css();
    case 'html':
    case 'htm':
      return html();
    case 'md':
    case 'markdown':
      return markdown();
    case 'py':
    case 'pyw':
      return python();
    case 'yaml':
    case 'yml':
      return yaml();
    case 'xml':
    case 'svg':
    case 'xsl':
      return xml();
    case 'rs':
      return rust();
    case 'cpp':
    case 'c':
    case 'h':
    case 'hpp':
    case 'cc':
    case 'cxx':
      return cpp();
    case 'java':
      return java();
    case 'php':
      return php();
    case 'sql':
      return sql();
    case 'sass':
    case 'scss':
      return sass();
    case 'less':
      return less();
    case 'vue':
      return vue();
    case 'wat':
    case 'wast':
      return wast();
    default:
      return null;
  }
}

/**
 * Returns the core set of CM6 extensions shared by all editor instances.
 * Does NOT include theme or language — those are added separately.
 */
export function getBaseExtensions(options?: { lineNumbers?: boolean; bracketMatching?: boolean }): Extension[] {
  const exts: Extension[] = [
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    history(),
    foldGutter(),
    drawSelection(),
    dropCursor(),
    EditorState.allowMultipleSelections.of(true),
    indentOnInput(),
    closeBrackets(),
    autocompletion(),
    rectangularSelection(),
    crosshairCursor(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    keymap.of([
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...searchKeymap,
      ...historyKeymap,
      ...foldKeymap,
      ...completionKeymap,
      ...lintKeymap,
      indentWithTab,
    ]),
  ];

  if (options?.lineNumbers !== false) {
    exts.push(lineNumbers());
  }
  if (options?.bracketMatching !== false) {
    exts.push(bracketMatching());
  }

  return exts;
}

// ── Compartments (module-level singletons for runtime reconfiguration) ──

export const minimapCompartment = new Compartment();
export const wordWrapCompartment = new Compartment();
export const fontSizeCompartment = new Compartment();

/**
 * Returns a minimap extension (enabled or empty).
 */
export function getMinimapExtension(enabled: boolean): Extension {
  if (!enabled) return [];
  try {
    return showMinimap.compute(['doc'], () => ({
      create: (_view: EditorView) => {
        const dom = document.createElement('div');
        return { dom };
      },
      displayText: 'blocks' as const,
      showOverlay: 'always' as const,
    }));
  } catch {
    return [];
  }
}

/** Reconfigure minimap on an existing editor view. */
export function reconfigureMinimap(view: EditorView, enabled: boolean): void {
  view.dispatch({
    effects: minimapCompartment.reconfigure(getMinimapExtension(enabled)),
  });
}

/** Returns a word-wrap extension (enabled or empty). */
export function getWordWrapExtension(enabled: boolean): Extension {
  return enabled ? EditorView.lineWrapping : [];
}

/** Reconfigure word wrap on an existing editor view. */
export function reconfigureWordWrap(view: EditorView, enabled: boolean): void {
  view.dispatch({
    effects: wordWrapCompartment.reconfigure(getWordWrapExtension(enabled)),
  });
}

/** Returns a font-size theme extension. */
export function getFontSizeExtension(size: number): Extension {
  return EditorView.theme({
    '.cm-content, .cm-gutters': { fontSize: `${size}px` },
  });
}

/** Reconfigure font size on an existing editor view. */
export function reconfigureFontSize(view: EditorView, size: number): void {
  view.dispatch({
    effects: fontSizeCompartment.reconfigure(getFontSizeExtension(size)),
  });
}

// ── Font family compartment ─────────────────────────────────────────────

export const fontFamilyCompartment = new Compartment();

/** Returns a font-family theme extension. */
export function getFontFamilyExtension(family: string): Extension {
  return EditorView.theme({
    '.cm-content, .cm-gutters': { fontFamily: family },
  });
}

/** Reconfigure font family on an existing editor view. */
export function reconfigureFontFamily(view: EditorView, family: string): void {
  view.dispatch({
    effects: fontFamilyCompartment.reconfigure(getFontFamilyExtension(family)),
  });
}

/**
 * Returns a linter extension that validates JSON syntax using JSON.parse.
 */
export function getJsonLinter(): Extension {
  return linter((view) => {
    const diagnostics: Diagnostic[] = [];
    const text = view.state.doc.toString();

    if (text.trim().length === 0) return diagnostics;

    try {
      JSON.parse(text);
    } catch (e) {
      if (e instanceof SyntaxError) {
        // Try to extract position from error message (e.g., "at position 42")
        const posMatch = e.message.match(/position\s+(\d+)/i);
        const pos = posMatch ? Math.min(Number(posMatch[1]), text.length) : 0;

        diagnostics.push({
          from: pos,
          to: Math.min(pos + 1, text.length),
          severity: 'error',
          message: e.message,
        });
      }
    }

    return diagnostics;
  });
}

/**
 * Returns extensions that configure tab size and indent unit.
 */
export function getIndentExtension(tabSize: number = 2): Extension {
  return [
    EditorState.tabSize.of(tabSize),
    indentUnit.of(' '.repeat(tabSize)),
  ];
}
