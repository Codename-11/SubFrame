/**
 * Centralized keyboard shortcut registry.
 * Single source of truth for all keyboard shortcuts in SubFrame.
 *
 * Components consume this registry:
 * - ShortcutsPanel.tsx     — auto-generates the shortcuts full-view panel
 * - CommandPalette.tsx     — displays shortcut badges next to commands
 * - App.tsx / TerminalArea.tsx — event handlers reference key combos
 *
 * To add a shortcut: add an entry here, wire the handler, done.
 * The help modal and command palette update automatically.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ShortcutEntry {
  /** Display string for the shortcut, e.g. "Ctrl+Shift+S" */
  keys: string;
  /** Human-readable description */
  description: string;
  /** Category for grouping in the help modal */
  category: ShortcutCategory;
}

export type ShortcutCategory =
  | 'Sidebar'
  | 'Panels'
  | 'Workspaces'
  | 'Terminal'
  | 'Editor'
  | 'Views'
  | 'Navigation'
  | 'Other';

// ── Shortcut IDs ──────────────────────────────────────────────────────────────
// Each shortcut has a unique ID used to reference it across the codebase.

export type ShortcutId =
  // Sidebar
  | 'TOGGLE_SIDEBAR'
  | 'FOCUS_PROJECTS'
  | 'FOCUS_FILE_TREE'
  // Panels
  | 'PANEL_TASKS'
  | 'PANEL_AGENT'
  | 'PANEL_GITHUB'
  | 'PANEL_PLUGINS'
  | 'PANEL_HISTORY'
  | 'PANEL_PIPELINE'
  | 'PANEL_PROMPT_LIBRARY'
  | 'PANEL_SYSTEM'
  // Workspaces
  | 'SWITCH_WORKSPACE'
  | 'WORKSPACE_PREV'
  | 'WORKSPACE_NEXT'
  | 'WORKSPACE_1'
  | 'WORKSPACE_2'
  | 'WORKSPACE_3'
  | 'WORKSPACE_4'
  | 'WORKSPACE_5'
  | 'WORKSPACE_6'
  | 'WORKSPACE_7'
  | 'WORKSPACE_8'
  | 'WORKSPACE_9'
  // Terminal
  | 'AI_TOOL_PALETTE'
  | 'START_AI_TOOL'
  | 'NEW_TERMINAL'
  | 'CLOSE_TERMINAL'
  | 'NEXT_TERMINAL'
  | 'PREV_TERMINAL'
  | 'JUMP_TERMINAL'
  | 'TOGGLE_GRID'
  | 'POPOUT_TERMINAL'
  | 'FREEZE_TERMINAL'
  | 'RESTART_SHELL'
  | 'SEARCH_TERMINAL'
  | 'TERMINAL_SPLIT_RIGHT'
  | 'TERMINAL_SPLIT_DOWN'
  | 'TERMINAL_CLOSE_PANE'
  | 'TERMINAL_FOCUS_PANE_1'
  | 'TERMINAL_FOCUS_PANE_2'
  | 'TERMINAL_FOCUS_PANE_3'
  | 'TERMINAL_FOCUS_PANE_4'
  | 'TERMINAL_FOCUS_PANE_5'
  | 'TERMINAL_FOCUS_PANE_6'
  | 'TERMINAL_FOCUS_PANE_7'
  | 'TERMINAL_FOCUS_PANE_8'
  | 'TERMINAL_FOCUS_PANE_9'
  // Views (full-view overlays)
  | 'VIEW_OVERVIEW'
  | 'VIEW_TASKS'
  // Navigation
  | 'PREV_PROJECT'
  | 'NEXT_PROJECT'
  // Editor
  | 'EDITOR_SEARCH'
  | 'EDITOR_GOTO_LINE'
  // Other
  | 'COMMAND_PALETTE'
  | 'COMMAND_PALETTE_ALT'
  | 'QUICK_TASKS'
  | 'SETTINGS'
  | 'SHORTCUTS_HELP'
  | 'EDITOR_FULLSCREEN';

// ── Registry ──────────────────────────────────────────────────────────────────

export const SHORTCUTS: Record<ShortcutId, ShortcutEntry> = {
  // ── Sidebar ───────────────────────────────────────
  TOGGLE_SIDEBAR:      { keys: 'Ctrl+B',        description: 'Toggle sidebar',      category: 'Sidebar' },
  FOCUS_PROJECTS:      { keys: 'Ctrl+E',        description: 'Focus projects',       category: 'Sidebar' },
  FOCUS_FILE_TREE:     { keys: 'Ctrl+Shift+E',  description: 'Focus file tree',      category: 'Sidebar' },

  // ── Panels ────────────────────────────────────────
  PANEL_TASKS:         { keys: 'Ctrl+Shift+S',  description: 'Sub-Tasks',            category: 'Panels' },
  PANEL_AGENT:         { keys: 'Ctrl+Shift+A',  description: 'Agent Activity',       category: 'Panels' },
  PANEL_GITHUB:        { keys: 'Ctrl+Shift+G',  description: 'GitHub',               category: 'Panels' },
  PANEL_PLUGINS:       { keys: 'Ctrl+Shift+X',  description: 'Plugins',              category: 'Panels' },
  PANEL_HISTORY:       { keys: 'Ctrl+Shift+H',  description: 'Prompt History',       category: 'Panels' },
  PANEL_PIPELINE:      { keys: 'Ctrl+Shift+Y',  description: 'Pipeline',             category: 'Panels' },
  PANEL_PROMPT_LIBRARY:{ keys: 'Ctrl+Shift+L',  description: 'Prompt Library',       category: 'Panels' },
  PANEL_SYSTEM:        { keys: 'Ctrl+Shift+U',  description: 'System',               category: 'Panels' },

  // ── Workspaces ────────────────────────────────────
  SWITCH_WORKSPACE:    { keys: 'Ctrl+Alt+W',    description: 'Switch workspace',     category: 'Workspaces' },
  WORKSPACE_PREV:      { keys: 'Ctrl+Alt+[',    description: 'Previous workspace',   category: 'Workspaces' },
  WORKSPACE_NEXT:      { keys: 'Ctrl+Alt+]',    description: 'Next workspace',       category: 'Workspaces' },
  WORKSPACE_1:         { keys: 'Ctrl+Alt+1',    description: 'Workspace #1',         category: 'Workspaces' },
  WORKSPACE_2:         { keys: 'Ctrl+Alt+2',    description: 'Workspace #2',         category: 'Workspaces' },
  WORKSPACE_3:         { keys: 'Ctrl+Alt+3',    description: 'Workspace #3',         category: 'Workspaces' },
  WORKSPACE_4:         { keys: 'Ctrl+Alt+4',    description: 'Workspace #4',         category: 'Workspaces' },
  WORKSPACE_5:         { keys: 'Ctrl+Alt+5',    description: 'Workspace #5',         category: 'Workspaces' },
  WORKSPACE_6:         { keys: 'Ctrl+Alt+6',    description: 'Workspace #6',         category: 'Workspaces' },
  WORKSPACE_7:         { keys: 'Ctrl+Alt+7',    description: 'Workspace #7',         category: 'Workspaces' },
  WORKSPACE_8:         { keys: 'Ctrl+Alt+8',    description: 'Workspace #8',         category: 'Workspaces' },
  WORKSPACE_9:         { keys: 'Ctrl+Alt+9',    description: 'Workspace #9',         category: 'Workspaces' },

  // ── Terminal ──────────────────────────────────────
  AI_TOOL_PALETTE:     { keys: 'Ctrl+.',            description: 'Switch AI tool',     category: 'Terminal' },
  START_AI_TOOL:       { keys: 'Ctrl+Shift+Enter', description: 'Start AI tool',     category: 'Terminal' },
  NEW_TERMINAL:        { keys: 'Ctrl+Shift+T',  description: 'New terminal',         category: 'Terminal' },
  CLOSE_TERMINAL:      { keys: 'Ctrl+Shift+W',  description: 'Close terminal',       category: 'Terminal' },
  NEXT_TERMINAL:       { keys: 'Ctrl+Tab',      description: 'Next terminal',        category: 'Terminal' },
  PREV_TERMINAL:       { keys: 'Ctrl+Shift+Tab',description: 'Previous terminal',    category: 'Terminal' },
  JUMP_TERMINAL:       { keys: 'Ctrl+1-9',      description: 'Jump to terminal',     category: 'Terminal' },
  TOGGLE_GRID:         { keys: 'Ctrl+G',        description: 'Toggle grid view',     category: 'Terminal' },
  POPOUT_TERMINAL:     { keys: 'Ctrl+Shift+D',  description: 'Pop out terminal',     category: 'Terminal' },
  FREEZE_TERMINAL:     { keys: 'Ctrl+Shift+F',  description: 'Freeze/resume output', category: 'Terminal' },
  RESTART_SHELL:       { keys: 'Ctrl+Shift+R',  description: 'Restart terminal shell', category: 'Terminal' },
  SEARCH_TERMINAL:     { keys: 'Ctrl+F',        description: 'Search in terminal',   category: 'Terminal' },
  TERMINAL_SPLIT_RIGHT:  { keys: 'Ctrl+D',         description: 'Split pane right',     category: 'Terminal' },
  TERMINAL_SPLIT_DOWN:   { keys: 'Ctrl+Alt+D',     description: 'Split pane down',      category: 'Terminal' },
  TERMINAL_CLOSE_PANE:   { keys: 'Ctrl+W',         description: 'Close focused pane',   category: 'Terminal' },
  TERMINAL_FOCUS_PANE_1: { keys: 'Ctrl+1',         description: 'Focus pane #1',        category: 'Terminal' },
  TERMINAL_FOCUS_PANE_2: { keys: 'Ctrl+2',         description: 'Focus pane #2',        category: 'Terminal' },
  TERMINAL_FOCUS_PANE_3: { keys: 'Ctrl+3',         description: 'Focus pane #3',        category: 'Terminal' },
  TERMINAL_FOCUS_PANE_4: { keys: 'Ctrl+4',         description: 'Focus pane #4',        category: 'Terminal' },
  TERMINAL_FOCUS_PANE_5: { keys: 'Ctrl+5',         description: 'Focus pane #5',        category: 'Terminal' },
  TERMINAL_FOCUS_PANE_6: { keys: 'Ctrl+6',         description: 'Focus pane #6',        category: 'Terminal' },
  TERMINAL_FOCUS_PANE_7: { keys: 'Ctrl+7',         description: 'Focus pane #7',        category: 'Terminal' },
  TERMINAL_FOCUS_PANE_8: { keys: 'Ctrl+8',         description: 'Focus pane #8',        category: 'Terminal' },
  TERMINAL_FOCUS_PANE_9: { keys: 'Ctrl+9',         description: 'Focus pane #9',        category: 'Terminal' },

  // ── Views (full-view overlays) ────────────────────
  VIEW_OVERVIEW:       { keys: 'Ctrl+Shift+O',  description: 'Project overview',     category: 'Views' },
  VIEW_TASKS:          { keys: 'Ctrl+Shift+K',  description: 'Tasks full view',      category: 'Views' },
  // Note: Pipeline full-view shares Ctrl+Shift+Y with PANEL_PIPELINE (intentional — one key toggles both)

  // ── Navigation ────────────────────────────────────
  PREV_PROJECT:        { keys: 'Ctrl+Shift+[',  description: 'Previous project',     category: 'Navigation' },
  NEXT_PROJECT:        { keys: 'Ctrl+Shift+]',  description: 'Next project',         category: 'Navigation' },

  // ── Editor ──────────────────────────────────────────
  EDITOR_SEARCH:       { keys: 'Ctrl+H',        description: 'Find & Replace',        category: 'Editor' },
  EDITOR_GOTO_LINE:    { keys: 'Ctrl+L',        description: 'Go to Line',            category: 'Editor' },
  EDITOR_FULLSCREEN:   { keys: 'F11',           description: 'Editor fullscreen',     category: 'Editor' },

  // ── Other ─────────────────────────────────────────
  COMMAND_PALETTE:     { keys: 'Ctrl+/',        description: 'Command palette',       category: 'Other' },
  COMMAND_PALETTE_ALT: { keys: 'Ctrl+Shift+P',  description: 'Command palette (alt)', category: 'Other' },
  QUICK_TASKS:         { keys: 'Ctrl+\'',       description: 'Quick tasks',           category: 'Other' },
  SETTINGS:            { keys: 'Ctrl+,',        description: 'Settings',              category: 'Other' },
  SHORTCUTS_HELP:      { keys: 'Ctrl+Shift+/',  description: 'Keyboard shortcuts',    category: 'Views' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Category display order for the shortcuts modal */
export const CATEGORY_ORDER: ShortcutCategory[] = [
  'Sidebar',
  'Panels',
  'Workspaces',
  'Terminal',
  'Editor',
  'Views',
  'Navigation',
  'Other',
];

/** Get all shortcuts grouped by category (in display order) */
export function getShortcutsByCategory(): { title: ShortcutCategory; shortcuts: ShortcutEntry[] }[] {
  const grouped = new Map<ShortcutCategory, ShortcutEntry[]>();
  for (const entry of Object.values(SHORTCUTS)) {
    const list = grouped.get(entry.category) || [];
    list.push(entry);
    grouped.set(entry.category, list);
  }
  return CATEGORY_ORDER
    .filter((cat) => grouped.has(cat))
    .map((cat) => ({ title: cat, shortcuts: grouped.get(cat)! }));
}

/** Get the display keys string for a shortcut ID */
export function getKeys(id: ShortcutId): string {
  return SHORTCUTS[id].keys;
}
