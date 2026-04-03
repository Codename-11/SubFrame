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
  search,
  openSearchPanel,
  gotoLine,
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
import { go } from '@codemirror/lang-go';
import { StreamLanguage } from '@codemirror/language';
import { shell } from '@codemirror/legacy-modes/mode/shell';
import { dockerFile } from '@codemirror/legacy-modes/mode/dockerfile';
import { toml as tomlMode } from '@codemirror/legacy-modes/mode/toml';
import { powerShell } from '@codemirror/legacy-modes/mode/powershell';

// YAML parser for linting
import YAML from 'yaml';

// Re-export search commands for programmatic use in Editor.tsx
export { openSearchPanel, gotoLine };

// Minimap
import { showMinimap } from '@replit/codemirror-minimap';

// Cache language extensions to avoid recreating parser instances
const languageCache = new Map<string, Extension>();

/**
 * Returns the appropriate CM6 language extension for a given filename,
 * or null if the file type is not recognized. Results are cached per extension.
 */
export function getLanguageExtension(filename: string): Extension | null {
  const baseName = filename.split(/[/\\]/).pop()?.toLowerCase() ?? '';
  const ext = filename.split('.').pop()?.toLowerCase();

  // Handle extensionless filenames (e.g., Dockerfile)
  const key = resolveFilenameKey(baseName, ext);
  if (!key) return null;

  const cached = languageCache.get(key);
  if (cached) return cached;

  const lang = resolveLanguage(key);
  if (lang) languageCache.set(key, lang);
  return lang;
}

/** Maps special filenames (without extensions) to language keys. */
function resolveFilenameKey(baseName: string, ext: string | undefined): string | null {
  // Dockerfile, Dockerfile.dev, etc.
  if (baseName === 'dockerfile' || baseName.startsWith('dockerfile.')) return 'dockerfile';
  if (ext) return ext;
  return null;
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
    case 'go':
      return go();
    case 'sh':
    case 'bash':
    case 'zsh':
    case 'fish':
      return StreamLanguage.define(shell);
    case 'dockerfile':
      return StreamLanguage.define(dockerFile);
    case 'toml':
      return StreamLanguage.define(tomlMode);
    case 'ps1':
    case 'psm1':
    case 'psd1':
      return StreamLanguage.define(powerShell);
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
    highlightSelectionMatches({ highlightWordAroundCursor: true, wholeWords: true }),
    search(),
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

/** Returns a font-size theme extension. lineHeight must match .cm-scroller
 *  to prevent selection highlight offset (CM6 computes selection rects from content metrics). */
export function getFontSizeExtension(size: number): Extension {
  return EditorView.theme({
    '.cm-content, .cm-gutters': { fontSize: `${size}px`, lineHeight: '1.6' },
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
 * Handles edge cases: empty files, BOM, and improved position extraction.
 */
export function getJsonLinter(): Extension {
  return linter((view) => {
    const diagnostics: Diagnostic[] = [];
    let text = view.state.doc.toString();

    // Strip BOM if present
    if (text.charCodeAt(0) === 0xFEFF) {
      text = text.slice(1);
    }

    if (text.trim().length === 0) return diagnostics;

    try {
      JSON.parse(text);
    } catch (e) {
      if (e instanceof SyntaxError) {
        const docLen = view.state.doc.length;

        // Try to extract position from error message (e.g., "at position 42")
        const posMatch = e.message.match(/position\s+(\d+)/i);
        // Also try "at line X column Y" format (some engines)
        const lineColMatch = e.message.match(/line\s+(\d+)\s+column\s+(\d+)/i);

        let from = 0;
        if (posMatch) {
          from = Math.min(Number(posMatch[1]), docLen);
        } else if (lineColMatch) {
          const line = Math.min(Number(lineColMatch[1]), view.state.doc.lines);
          const col = Number(lineColMatch[2]);
          const lineInfo = view.state.doc.line(line);
          from = Math.min(lineInfo.from + col - 1, docLen);
        }

        // Ensure valid range
        from = Math.max(0, Math.min(from, docLen));
        const to = Math.min(from + 1, docLen);

        // Clean up the error message — strip the verbose position suffix
        let message = e.message;
        const cleanMatch = message.match(/^(.+?)(?:\s+at position \d+)?$/i);
        if (cleanMatch) message = cleanMatch[1];

        diagnostics.push({ from, to: Math.max(to, from), severity: 'error', message });
      }
    }

    return diagnostics;
  });
}

/**
 * Returns a linter extension that validates YAML syntax using the `yaml` package.
 * Reports all parse errors and warnings with accurate positions.
 */
export function getYamlLinter(): Extension {
  return linter((view) => {
    const diagnostics: Diagnostic[] = [];
    let text = view.state.doc.toString();

    // Strip BOM if present
    if (text.charCodeAt(0) === 0xFEFF) {
      text = text.slice(1);
    }

    if (text.trim().length === 0) return diagnostics;

    try {
      const doc = YAML.parseDocument(text);
      const docLen = view.state.doc.length;

      for (const error of doc.errors) {
        const [from, to] = error.pos ?? [0, 1];
        diagnostics.push({
          from: Math.max(0, Math.min(from, docLen)),
          to: Math.max(0, Math.min(Math.max(to, from + 1), docLen)),
          severity: 'error',
          message: error.code ? `[${error.code}] ${error.message.split('\n')[0]}` : error.message.split('\n')[0],
        });
      }

      for (const warning of doc.warnings) {
        const [from, to] = warning.pos ?? [0, 1];
        diagnostics.push({
          from: Math.max(0, Math.min(from, docLen)),
          to: Math.max(0, Math.min(Math.max(to, from + 1), docLen)),
          severity: 'warning',
          message: warning.code ? `[${warning.code}] ${warning.message.split('\n')[0]}` : warning.message.split('\n')[0],
        });
      }
    } catch {
      // Gracefully handle unexpected errors — never throw from a linter
    }

    return diagnostics;
  });
}

/**
 * Returns a linter extension that validates CSS for common syntax errors:
 * unclosed braces, unclosed strings, and unclosed comments.
 * Works for CSS, SCSS, and LESS files.
 */
export function getCssLinter(): Extension {
  return linter((view) => {
    const diagnostics: Diagnostic[] = [];
    const text = view.state.doc.toString();

    if (text.trim().length === 0) return diagnostics;

    try {
      const docLen = view.state.doc.length;

      // Track brace balance
      let braceDepth = 0;
      let lastOpenBrace = -1;
      let inString: string | null = null;
      let inComment = false;
      let inLineComment = false;
      let commentStart = -1;

      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        const next = text[i + 1];

        // Handle line comments (SCSS/LESS only — // style)
        if (inLineComment) {
          if (ch === '\n') inLineComment = false;
          continue;
        }

        // Handle block comments
        if (inComment) {
          if (ch === '*' && next === '/') {
            inComment = false;
            i++; // skip /
          }
          continue;
        }

        // Handle strings
        if (inString) {
          if (ch === '\\') { i++; continue; } // skip escaped char
          if (ch === inString) inString = null;
          else if ((ch === '\n' || ch === '\r') && inString !== '`') {
            // Unterminated string (newline inside single/double quote)
            // Check for \r\n to avoid double-reporting
            if (ch === '\r' && text[i + 1] === '\n') i++;
            diagnostics.push({
              from: i,
              to: Math.min(i + 1, docLen),
              severity: 'error',
              message: `Unterminated string`,
            });
            inString = null;
          }
          continue;
        }

        // Detect comment starts
        if (ch === '/' && next === '*') {
          inComment = true;
          commentStart = i;
          i++; // skip *
          continue;
        }
        if (ch === '/' && next === '/') {
          inLineComment = true;
          i++;
          continue;
        }

        // Detect string starts
        if (ch === '"' || ch === "'") {
          inString = ch;
          continue;
        }

        // Track braces
        if (ch === '{') {
          braceDepth++;
          lastOpenBrace = i;
        } else if (ch === '}') {
          if (braceDepth <= 0) {
            diagnostics.push({
              from: i,
              to: Math.min(i + 1, docLen),
              severity: 'error',
              message: 'Unexpected closing brace',
            });
          } else {
            braceDepth--;
          }
        }
      }

      // Report unclosed constructs
      if (braceDepth > 0 && lastOpenBrace >= 0) {
        diagnostics.push({
          from: lastOpenBrace,
          to: Math.min(lastOpenBrace + 1, docLen),
          severity: 'error',
          message: `Unclosed brace — ${braceDepth} opening brace(s) without matching close`,
        });
      }

      if (inComment) {
        diagnostics.push({
          from: commentStart,
          to: Math.min(commentStart + 2, docLen),
          severity: 'error',
          message: 'Unterminated comment',
        });
      }

      if (inString) {
        diagnostics.push({
          from: Math.max(0, docLen - 1),
          to: docLen,
          severity: 'error',
          message: 'Unterminated string at end of file',
        });
      }
    } catch {
      // Gracefully handle unexpected errors
    }

    return diagnostics;
  });
}

/**
 * Returns a linter extension that validates HTML for common issues:
 * mismatched tags and unclosed tags.
 *
 * Uses a character-level scanner to properly handle:
 * - Quoted attributes containing `>` characters
 * - HTML comments (<!-- ... -->)
 * - Script/style tag contents (skipped entirely)
 */
export function getHtmlLinter(): Extension {
  const VOID_ELEMENTS = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'link', 'meta', 'param', 'source', 'track', 'wbr',
  ]);
  // Tags whose content is raw text (not parsed as HTML)
  const RAW_TEXT_TAGS = new Set(['script', 'style', 'textarea']);

  return linter((view) => {
    const diagnostics: Diagnostic[] = [];
    const text = view.state.doc.toString();
    if (text.trim().length === 0) return diagnostics;

    try {
      const docLen = text.length;
      const stack: { tag: string; from: number }[] = [];
      let i = 0;

      while (i < docLen) {
        // Skip HTML comments: <!-- ... -->
        if (text[i] === '<' && text.startsWith('<!--', i)) {
          const end = text.indexOf('-->', i + 4);
          i = end >= 0 ? end + 3 : docLen;
          continue;
        }

        // Skip doctype: <!DOCTYPE ...>
        if (text[i] === '<' && text.startsWith('<!', i) && !text.startsWith('<!--', i)) {
          const end = text.indexOf('>', i + 2);
          i = end >= 0 ? end + 1 : docLen;
          continue;
        }

        // Detect tag start
        if (text[i] === '<' && i + 1 < docLen && (text[i + 1] === '/' || /[a-zA-Z]/.test(text[i + 1]))) {
          const tagStart = i;
          const isClosing = text[i + 1] === '/';
          const nameStart = isClosing ? i + 2 : i + 1;

          // Extract tag name
          let nameEnd = nameStart;
          while (nameEnd < docLen && /[a-zA-Z0-9-]/.test(text[nameEnd])) nameEnd++;
          if (nameEnd === nameStart) { i++; continue; } // not a valid tag

          const tagName = text.slice(nameStart, nameEnd).toLowerCase();

          // Scan to closing `>`, respecting quoted attributes
          let j = nameEnd;
          let selfClosing = false;
          while (j < docLen && text[j] !== '>') {
            if (text[j] === '"' || text[j] === "'") {
              const quote = text[j];
              j++;
              while (j < docLen && text[j] !== quote) j++;
              if (j < docLen) j++; // skip closing quote
            } else {
              if (text[j] === '/' && j + 1 < docLen && text[j + 1] === '>') {
                selfClosing = true;
              }
              j++;
            }
          }
          if (j < docLen) j++; // skip >
          i = j;

          // Skip void and self-closing tags
          if (VOID_ELEMENTS.has(tagName) || selfClosing) continue;

          if (isClosing) {
            // Closing tag
            if (stack.length === 0) {
              diagnostics.push({
                from: tagStart,
                to: Math.min(j, docLen),
                severity: 'error',
                message: `Closing tag </${tagName}> has no matching opening tag`,
              });
            } else if (stack[stack.length - 1].tag === tagName) {
              stack.pop();
            } else {
              const idx = stack.map(s => s.tag).lastIndexOf(tagName);
              if (idx >= 0) {
                for (let k = stack.length - 1; k > idx; k--) {
                  const unclosed = stack[k];
                  diagnostics.push({
                    from: unclosed.from,
                    to: Math.min(unclosed.from + unclosed.tag.length + 2, docLen),
                    severity: 'warning',
                    message: `Tag <${unclosed.tag}> is not closed before </${tagName}>`,
                  });
                }
                stack.splice(idx); // remove matched + everything above
              } else {
                diagnostics.push({
                  from: tagStart,
                  to: Math.min(j, docLen),
                  severity: 'error',
                  message: `Closing tag </${tagName}> has no matching opening tag`,
                });
              }
            }
          } else {
            // Opening tag
            stack.push({ tag: tagName, from: tagStart });

            // Skip raw text content for script/style/textarea
            if (RAW_TEXT_TAGS.has(tagName)) {
              const closeTag = `</${tagName}`;
              const closeIdx = text.toLowerCase().indexOf(closeTag, i);
              if (closeIdx >= 0) {
                i = closeIdx; // will be parsed as closing tag on next iteration
              } else {
                i = docLen; // no closing tag found — will be reported as unclosed
              }
            }
          }
          continue;
        }

        i++;
      }

      // Remaining unclosed tags
      for (const unclosed of stack) {
        diagnostics.push({
          from: unclosed.from,
          to: Math.min(unclosed.from + unclosed.tag.length + 2, docLen),
          severity: 'warning',
          message: `Tag <${unclosed.tag}> is never closed`,
        });
      }
    } catch {
      // Gracefully handle unexpected errors
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
