import { EditorView } from '@codemirror/view';
import { type Extension, Compartment } from '@codemirror/state';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

// ── Theme Compartment (module-level singleton) ─────────────────────────
export const themeCompartment = new Compartment();

// ── SubFrame Color Tokens ──────────────────────────────────────────────
// Mirrors the CSS custom properties in globals.css so the editor
// matches the rest of the UI without relying on runtime CSS vars.

const bg = {
  deep: '#0f0f10',
  primary: '#151516',
  secondary: '#1a1a1c',
  tertiary: '#222225',
  elevated: '#28282c',
  hover: '#2e2e33',
};

const text = {
  primary: '#e8e6e3',
  secondary: '#a09b94',
  tertiary: '#6b6660',
  muted: '#4a4642',
};

const accent = {
  base: '#d4a574',
  secondary: '#c9956a',
  subtle: 'rgba(212, 165, 116, 0.15)',
  glow: 'rgba(212, 165, 116, 0.08)',
};

const semantic = {
  success: '#7cb382',
  warning: '#e0a458',
  error: '#d47878',
  info: '#78a5d4',
};

const border = {
  subtle: 'rgba(255, 255, 255, 0.06)',
  default: 'rgba(255, 255, 255, 0.08)',
};

const shadow = {
  md: '0 4px 12px rgba(0, 0, 0, 0.4)',
};

const fontMono = "'JetBrains Mono', 'SF Mono', 'Consolas', monospace";

// ── Editor Chrome Theme ────────────────────────────────────────────────

export const subframeTheme = EditorView.theme(
  {
    // Root
    '&': {
      backgroundColor: bg.deep,
      color: text.primary,
      fontFamily: fontMono,
    },

    // Content / caret
    '.cm-content': {
      caretColor: accent.base,
    },

    // Cursor
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: accent.base,
      borderLeftWidth: '2px',
    },

    // Selection
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
      background: accent.subtle,
    },

    // Active line
    '.cm-activeLine': {
      backgroundColor: bg.secondary,
    },

    // Gutters
    '.cm-gutters': {
      backgroundColor: bg.primary,
      color: text.muted,
      borderRight: `1px solid ${border.subtle}`,
    },

    '.cm-activeLineGutter': {
      backgroundColor: bg.secondary,
      color: text.tertiary,
    },

    '.cm-lineNumbers .cm-gutterElement': {
      color: text.muted,
      minWidth: '3.5ch',
      padding: '0 8px 0 4px',
    },

    // Fold placeholder
    '.cm-foldPlaceholder': {
      backgroundColor: bg.tertiary,
      color: text.tertiary,
      border: 'none',
      padding: '0 4px',
    },

    // Tooltips
    '.cm-tooltip': {
      backgroundColor: bg.tertiary,
      color: text.primary,
      border: `1px solid ${border.default}`,
      borderRadius: '6px',
      boxShadow: shadow.md,
    },

    '.cm-tooltip-autocomplete': {
      backgroundColor: bg.tertiary,
      border: `1px solid ${border.default}`,
      borderRadius: '6px',
      boxShadow: shadow.md,
    },

    '.cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]': {
      backgroundColor: bg.hover,
      color: text.primary,
    },

    // Search
    '.cm-searchMatch': {
      backgroundColor: 'rgba(212, 165, 116, 0.2)',
      outline: '1px solid rgba(212, 165, 116, 0.4)',
    },

    '.cm-searchMatch.cm-searchMatch-selected': {
      backgroundColor: 'rgba(212, 165, 116, 0.35)',
    },

    // Matching brackets
    '&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket': {
      backgroundColor: accent.glow,
      outline: `1px solid ${accent.subtle}`,
    },

    // Panels (search bar, etc.)
    '.cm-panels': {
      backgroundColor: bg.primary,
      color: text.primary,
      borderTop: `1px solid ${border.subtle}`,
    },

    '.cm-panels.cm-panels-top': {
      borderBottom: `1px solid ${border.subtle}`,
      borderTop: 'none',
    },

    '.cm-panel.cm-search': {
      padding: '8px 12px',
      gap: '6px',
    },

    '.cm-panel.cm-search input': {
      backgroundColor: bg.tertiary,
      color: text.primary,
      border: `1px solid ${border.default}`,
      borderRadius: '4px',
      padding: '4px 8px',
      fontSize: '12px',
      fontFamily: fontMono,
      outline: 'none',
    },

    '.cm-panel.cm-search input:focus': {
      borderColor: accent.base,
      boxShadow: `0 0 0 1px ${accent.subtle}`,
    },

    '.cm-panel.cm-search button': {
      backgroundColor: bg.tertiary,
      color: text.secondary,
      border: `1px solid ${border.default}`,
      borderRadius: '4px',
      padding: '4px 10px',
      fontSize: '12px',
      cursor: 'pointer',
    },

    '.cm-panel.cm-search button:hover': {
      backgroundColor: bg.hover,
      color: text.primary,
    },

    // Minimap (from @replit/codemirror-minimap)
    '.cm-minimap': {
      backgroundColor: bg.primary,
      borderLeft: `1px solid ${border.subtle}`,
    },

    '.cm-minimap canvas': {
      opacity: '0.85',
    },

    '.cm-minimap-overlay': {
      backgroundColor: 'rgba(212, 165, 116, 0.08)',
      borderTop: `1px solid ${border.subtle}`,
      borderBottom: `1px solid ${border.subtle}`,
    },

    // Scroller
    '.cm-scroller': {
      fontFamily: fontMono,
      fontSize: '12px',
      lineHeight: '1.6',
      overflow: 'auto',
      scrollbarWidth: 'thin',
      scrollbarColor: `rgba(255, 255, 255, 0.1) transparent`,
    },

    // Webkit scrollbar styling
    '.cm-scroller::-webkit-scrollbar': {
      width: '6px',
      height: '6px',
    },

    '.cm-scroller::-webkit-scrollbar-track': {
      background: 'transparent',
    },

    '.cm-scroller::-webkit-scrollbar-thumb': {
      background: 'rgba(255, 255, 255, 0.12)',
      borderRadius: '3px',
    },

    '.cm-scroller::-webkit-scrollbar-thumb:hover': {
      background: 'rgba(255, 255, 255, 0.2)',
    },

    '.cm-scroller::-webkit-scrollbar-corner': {
      background: 'transparent',
    },
  },
  { dark: true }
);

// ── Syntax Highlighting ────────────────────────────────────────────────

export const subframeHighlightStyle = HighlightStyle.define([
  // Comments
  { tag: tags.comment, color: text.tertiary, fontStyle: 'italic' },
  { tag: tags.lineComment, color: text.tertiary, fontStyle: 'italic' },
  { tag: tags.blockComment, color: text.tertiary, fontStyle: 'italic' },

  // Keywords
  { tag: tags.keyword, color: accent.base },
  { tag: tags.controlKeyword, color: accent.base },
  { tag: tags.moduleKeyword, color: accent.base },

  // Strings
  { tag: tags.string, color: semantic.success },
  { tag: tags.special(tags.string), color: semantic.success },

  // Numbers
  { tag: tags.number, color: semantic.warning },
  { tag: tags.integer, color: semantic.warning },
  { tag: tags.float, color: semantic.warning },

  // Booleans, null, atoms
  { tag: tags.bool, color: semantic.warning },
  { tag: tags.null, color: semantic.warning },
  { tag: tags.atom, color: semantic.warning },

  // Variables
  { tag: tags.variableName, color: text.primary },
  { tag: tags.definition(tags.variableName), color: text.primary, fontWeight: '600' },

  // Functions
  { tag: tags.function(tags.variableName), color: '#e8c47a' },
  { tag: tags.definition(tags.function(tags.variableName)), color: '#e8c47a' },

  // Types, classes, namespaces
  { tag: tags.typeName, color: semantic.info },
  { tag: tags.className, color: semantic.info },
  { tag: tags.namespace, color: semantic.info },

  // Properties
  { tag: tags.propertyName, color: '#c4b5a0' },

  // Operators, punctuation, brackets
  { tag: tags.operator, color: text.secondary },
  { tag: tags.punctuation, color: text.tertiary },
  { tag: tags.bracket, color: text.secondary },

  // Meta
  { tag: tags.meta, color: text.tertiary },

  // Regex
  { tag: tags.regexp, color: semantic.error },

  // HTML/XML tags and attributes
  { tag: tags.tagName, color: accent.base },
  { tag: tags.attributeName, color: semantic.info },
  { tag: tags.attributeValue, color: semantic.success },

  // Markdown headings
  { tag: tags.heading, color: accent.base, fontWeight: 'bold' },

  // Emphasis / strong
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strong, fontWeight: 'bold' },

  // Links
  { tag: tags.link, color: semantic.info, textDecoration: 'underline' },

  // Invalid
  { tag: tags.invalid, color: semantic.error, textDecoration: 'underline wavy' },

  // Self / this
  { tag: tags.self, color: accent.secondary },
]);

// ── Combined Extension (SubFrame Dark — default) ──────────────────────

export const subframeThemeExtension: Extension = [
  subframeTheme,
  syntaxHighlighting(subframeHighlightStyle),
];

// ── SubFrame Light Theme ──────────────────────────────────────────────

const lightBg = {
  deep: '#f5f3f0',
  primary: '#ebe8e4',
  secondary: '#e0ddd8',
  tertiary: '#d5d1cc',
  elevated: '#cac5bf',
  hover: '#c0bab3',
};

const lightText = {
  primary: '#1a1918',
  secondary: '#4a4642',
  tertiary: '#7a756f',
  muted: '#a09b94',
};

const lightBorder = {
  subtle: 'rgba(0, 0, 0, 0.08)',
  default: 'rgba(0, 0, 0, 0.12)',
};

const subframeLightTheme = EditorView.theme(
  {
    '&': { backgroundColor: lightBg.deep, color: lightText.primary, fontFamily: fontMono },
    '.cm-content': { caretColor: accent.secondary },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: accent.secondary, borderLeftWidth: '2px' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
      background: 'rgba(212, 165, 116, 0.25)',
    },
    '.cm-activeLine': { backgroundColor: lightBg.secondary },
    '.cm-gutters': {
      backgroundColor: lightBg.primary,
      color: lightText.muted,
      borderRight: `1px solid ${lightBorder.subtle}`,
    },
    '.cm-activeLineGutter': { backgroundColor: lightBg.secondary, color: lightText.tertiary },
    '.cm-lineNumbers .cm-gutterElement': { color: lightText.muted, minWidth: '3.5ch', padding: '0 8px 0 4px' },
    '.cm-foldPlaceholder': { backgroundColor: lightBg.tertiary, color: lightText.tertiary, border: 'none', padding: '0 4px' },
    '.cm-tooltip': { backgroundColor: lightBg.tertiary, color: lightText.primary, border: `1px solid ${lightBorder.default}`, borderRadius: '6px' },
    '.cm-tooltip-autocomplete': { backgroundColor: lightBg.tertiary, border: `1px solid ${lightBorder.default}`, borderRadius: '6px' },
    '.cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: lightBg.hover, color: lightText.primary },
    '.cm-searchMatch': { backgroundColor: 'rgba(212, 165, 116, 0.3)', outline: '1px solid rgba(212, 165, 116, 0.5)' },
    '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: 'rgba(212, 165, 116, 0.45)' },
    '&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket': {
      backgroundColor: 'rgba(212, 165, 116, 0.2)',
      outline: '1px solid rgba(212, 165, 116, 0.3)',
    },
    '.cm-panels': { backgroundColor: lightBg.primary, color: lightText.primary, borderTop: `1px solid ${lightBorder.subtle}` },
    '.cm-panels.cm-panels-top': { borderBottom: `1px solid ${lightBorder.subtle}`, borderTop: 'none' },
    '.cm-panel.cm-search input': {
      backgroundColor: lightBg.tertiary, color: lightText.primary,
      border: `1px solid ${lightBorder.default}`, borderRadius: '4px', padding: '4px 8px', fontSize: '12px', fontFamily: fontMono,
    },
    '.cm-panel.cm-search button': {
      backgroundColor: lightBg.tertiary, color: lightText.secondary,
      border: `1px solid ${lightBorder.default}`, borderRadius: '4px', padding: '4px 10px', fontSize: '12px', cursor: 'pointer',
    },
    '.cm-panel.cm-search button:hover': { backgroundColor: lightBg.hover, color: lightText.primary },
    '.cm-minimap': { backgroundColor: lightBg.primary, borderLeft: `1px solid ${lightBorder.subtle}` },
    '.cm-minimap canvas': { opacity: '0.85' },
    '.cm-minimap-overlay': { backgroundColor: 'rgba(212, 165, 116, 0.12)', borderTop: `1px solid ${lightBorder.subtle}`, borderBottom: `1px solid ${lightBorder.subtle}` },
    '.cm-scroller': { fontFamily: fontMono, fontSize: '12px', lineHeight: '1.6', overflow: 'auto', scrollbarWidth: 'thin', scrollbarColor: 'rgba(0, 0, 0, 0.15) transparent' },
  },
  { dark: false }
);

const subframeLightHighlightStyle = HighlightStyle.define([
  { tag: tags.comment, color: lightText.muted, fontStyle: 'italic' },
  { tag: tags.lineComment, color: lightText.muted, fontStyle: 'italic' },
  { tag: tags.blockComment, color: lightText.muted, fontStyle: 'italic' },
  { tag: tags.keyword, color: '#a0522d' },
  { tag: tags.controlKeyword, color: '#a0522d' },
  { tag: tags.moduleKeyword, color: '#a0522d' },
  { tag: tags.string, color: '#2e7d32' },
  { tag: tags.special(tags.string), color: '#2e7d32' },
  { tag: tags.number, color: '#c56200' },
  { tag: tags.integer, color: '#c56200' },
  { tag: tags.float, color: '#c56200' },
  { tag: tags.bool, color: '#c56200' },
  { tag: tags.null, color: '#c56200' },
  { tag: tags.atom, color: '#c56200' },
  { tag: tags.variableName, color: lightText.primary },
  { tag: tags.definition(tags.variableName), color: lightText.primary, fontWeight: '600' },
  { tag: tags.function(tags.variableName), color: '#7b5e00' },
  { tag: tags.definition(tags.function(tags.variableName)), color: '#7b5e00' },
  { tag: tags.typeName, color: '#1565c0' },
  { tag: tags.className, color: '#1565c0' },
  { tag: tags.namespace, color: '#1565c0' },
  { tag: tags.propertyName, color: '#5d4037' },
  { tag: tags.operator, color: lightText.secondary },
  { tag: tags.punctuation, color: lightText.tertiary },
  { tag: tags.bracket, color: lightText.secondary },
  { tag: tags.meta, color: lightText.tertiary },
  { tag: tags.regexp, color: '#c62828' },
  { tag: tags.tagName, color: '#a0522d' },
  { tag: tags.attributeName, color: '#1565c0' },
  { tag: tags.attributeValue, color: '#2e7d32' },
  { tag: tags.heading, color: '#a0522d', fontWeight: 'bold' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strong, fontWeight: 'bold' },
  { tag: tags.link, color: '#1565c0', textDecoration: 'underline' },
  { tag: tags.invalid, color: '#c62828', textDecoration: 'underline wavy' },
  { tag: tags.self, color: '#a0522d' },
]);

const subframeLightExtension: Extension = [
  subframeLightTheme,
  syntaxHighlighting(subframeLightHighlightStyle),
];

// ── High Contrast Theme ───────────────────────────────────────────────

const hcBg = {
  deep: '#000000',
  primary: '#0a0a0a',
  secondary: '#141414',
  tertiary: '#1e1e1e',
  elevated: '#282828',
  hover: '#333333',
};

const hcText = {
  primary: '#ffffff',
  secondary: '#cccccc',
  tertiary: '#888888',
  muted: '#666666',
};

const hcBorder = {
  subtle: 'rgba(255, 255, 255, 0.15)',
  default: 'rgba(255, 255, 255, 0.25)',
};

const highContrastTheme = EditorView.theme(
  {
    '&': { backgroundColor: hcBg.deep, color: hcText.primary, fontFamily: fontMono },
    '.cm-content': { caretColor: '#ffcc00' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#ffcc00', borderLeftWidth: '2px' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
      background: 'rgba(255, 204, 0, 0.25)',
    },
    '.cm-activeLine': { backgroundColor: hcBg.secondary },
    '.cm-gutters': { backgroundColor: hcBg.primary, color: hcText.muted, borderRight: `1px solid ${hcBorder.default}` },
    '.cm-activeLineGutter': { backgroundColor: hcBg.secondary, color: hcText.secondary },
    '.cm-lineNumbers .cm-gutterElement': { color: hcText.muted, minWidth: '3.5ch', padding: '0 8px 0 4px' },
    '.cm-foldPlaceholder': { backgroundColor: hcBg.tertiary, color: hcText.tertiary, border: 'none', padding: '0 4px' },
    '.cm-tooltip': { backgroundColor: hcBg.tertiary, color: hcText.primary, border: `1px solid ${hcBorder.default}`, borderRadius: '6px' },
    '.cm-tooltip-autocomplete': { backgroundColor: hcBg.tertiary, border: `1px solid ${hcBorder.default}`, borderRadius: '6px' },
    '.cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: hcBg.hover, color: hcText.primary },
    '.cm-searchMatch': { backgroundColor: 'rgba(255, 204, 0, 0.3)', outline: '1px solid rgba(255, 204, 0, 0.5)' },
    '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: 'rgba(255, 204, 0, 0.5)' },
    '&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket': {
      backgroundColor: 'rgba(255, 204, 0, 0.15)',
      outline: `1px solid rgba(255, 204, 0, 0.4)`,
    },
    '.cm-panels': { backgroundColor: hcBg.primary, color: hcText.primary, borderTop: `1px solid ${hcBorder.default}` },
    '.cm-panels.cm-panels-top': { borderBottom: `1px solid ${hcBorder.default}`, borderTop: 'none' },
    '.cm-panel.cm-search input': {
      backgroundColor: hcBg.tertiary, color: hcText.primary,
      border: `1px solid ${hcBorder.default}`, borderRadius: '4px', padding: '4px 8px', fontSize: '12px', fontFamily: fontMono,
    },
    '.cm-panel.cm-search button': {
      backgroundColor: hcBg.tertiary, color: hcText.secondary,
      border: `1px solid ${hcBorder.default}`, borderRadius: '4px', padding: '4px 10px', fontSize: '12px', cursor: 'pointer',
    },
    '.cm-panel.cm-search button:hover': { backgroundColor: hcBg.hover, color: hcText.primary },
    '.cm-minimap': { backgroundColor: hcBg.primary, borderLeft: `1px solid ${hcBorder.default}` },
    '.cm-minimap canvas': { opacity: '0.9' },
    '.cm-minimap-overlay': { backgroundColor: 'rgba(255, 204, 0, 0.1)', borderTop: `1px solid ${hcBorder.subtle}`, borderBottom: `1px solid ${hcBorder.subtle}` },
    '.cm-scroller': { fontFamily: fontMono, fontSize: '12px', lineHeight: '1.6', overflow: 'auto', scrollbarWidth: 'thin', scrollbarColor: 'rgba(255, 255, 255, 0.2) transparent' },
  },
  { dark: true }
);

const highContrastHighlightStyle = HighlightStyle.define([
  { tag: tags.comment, color: '#888888', fontStyle: 'italic' },
  { tag: tags.lineComment, color: '#888888', fontStyle: 'italic' },
  { tag: tags.blockComment, color: '#888888', fontStyle: 'italic' },
  { tag: tags.keyword, color: '#ff9900' },
  { tag: tags.controlKeyword, color: '#ff9900' },
  { tag: tags.moduleKeyword, color: '#ff9900' },
  { tag: tags.string, color: '#66ff66' },
  { tag: tags.special(tags.string), color: '#66ff66' },
  { tag: tags.number, color: '#ffcc00' },
  { tag: tags.integer, color: '#ffcc00' },
  { tag: tags.float, color: '#ffcc00' },
  { tag: tags.bool, color: '#ffcc00' },
  { tag: tags.null, color: '#ffcc00' },
  { tag: tags.atom, color: '#ffcc00' },
  { tag: tags.variableName, color: '#ffffff' },
  { tag: tags.definition(tags.variableName), color: '#ffffff', fontWeight: '600' },
  { tag: tags.function(tags.variableName), color: '#ffdd55' },
  { tag: tags.definition(tags.function(tags.variableName)), color: '#ffdd55' },
  { tag: tags.typeName, color: '#66ccff' },
  { tag: tags.className, color: '#66ccff' },
  { tag: tags.namespace, color: '#66ccff' },
  { tag: tags.propertyName, color: '#ddcc99' },
  { tag: tags.operator, color: '#cccccc' },
  { tag: tags.punctuation, color: '#999999' },
  { tag: tags.bracket, color: '#cccccc' },
  { tag: tags.meta, color: '#888888' },
  { tag: tags.regexp, color: '#ff6666' },
  { tag: tags.tagName, color: '#ff9900' },
  { tag: tags.attributeName, color: '#66ccff' },
  { tag: tags.attributeValue, color: '#66ff66' },
  { tag: tags.heading, color: '#ff9900', fontWeight: 'bold' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strong, fontWeight: 'bold' },
  { tag: tags.link, color: '#66ccff', textDecoration: 'underline' },
  { tag: tags.invalid, color: '#ff4444', textDecoration: 'underline wavy' },
  { tag: tags.self, color: '#ff9900' },
]);

const highContrastExtension: Extension = [
  highContrastTheme,
  syntaxHighlighting(highContrastHighlightStyle),
];

// ── Theme Registry ────────────────────────────────────────────────────

export type EditorThemeId = 'subframe-dark' | 'subframe-light' | 'high-contrast';

export interface EditorThemeInfo {
  id: EditorThemeId;
  label: string;
  extension: Extension;
}

export const EDITOR_THEMES: Record<EditorThemeId, EditorThemeInfo> = {
  'subframe-dark': { id: 'subframe-dark', label: 'SubFrame Dark', extension: subframeThemeExtension },
  'subframe-light': { id: 'subframe-light', label: 'SubFrame Light', extension: subframeLightExtension },
  'high-contrast': { id: 'high-contrast', label: 'High Contrast', extension: highContrastExtension },
};

/** Get theme extension by ID (falls back to dark). */
export function getThemeExtension(id: string): Extension {
  return (EDITOR_THEMES[id as EditorThemeId] ?? EDITOR_THEMES['subframe-dark']).extension;
}

/** Reconfigure theme on an existing editor view. */
export function reconfigureTheme(view: EditorView, id: string): void {
  view.dispatch({
    effects: themeCompartment.reconfigure(getThemeExtension(id)),
  });
}
