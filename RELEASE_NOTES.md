# SubFrame v0.1.0-beta.3

## Highlights

- **Expanded Settings** — Terminal, Editor, Updates, and About tabs with live runtime application
- **Git Changes Tab** — See staged/modified/untracked files at a glance in the GitHub hub
- **Enhanced Prompts** — Inline editing, tag filtering, sort modes, keyboard navigation
- **File & View Menus** — Standard Electron menu bar with keyboard shortcuts
- **Terminal Persistence** — Workspace-scoped terminal layout saved per-project
- **UI Polish** — Consistent dialogs, improved terminal preview overlay

## New Features

### Expanded Settings Panel
- **Terminal tab**: Font family, line height, cursor blink/style, default shell, bell sound, copy-on-select
- **Editor tab**: Font size/family, tab size, theme selector, word wrap, minimap, line numbers, bracket matching
- **Updates tab**: Auto-check toggle, pre-release channel (auto/always/never), check interval, manual check

### Git Changes Tab
- New "Changes" tab (first in GitHub hub) shows working tree status
- Files grouped by Staged (green), Modified (amber), Untracked (gray)
- Collapsible sections with file counts and colored status badges
- Summary bar: `+N staged ~N modified ?N untracked`

### Enhanced Prompts Panel
- Inline expand-in-place editing (replaces modal dialog)
- Tag-click filtering with filter bar and sort modes (usage/updated/alpha)
- Collapsible categories with batch rename
- Template variable highlighting and insert buttons
- Keyboard navigation (arrow keys, Enter to insert, `e` to edit)

### File & View Menus
- File: New/Close Terminal, Open Project, Settings (`Ctrl+,`), Exit
- View: Toggle Sidebar (`Ctrl+B`), Toggle Right Panel, Reset Layout, zoom, fullscreen

### Workspace-Scoped Terminal State
- Layout (grid, tab order, maximized state) persists per-project
- Claude session names auto-detected for terminal tabs
- Right-click "Refresh Name" / "Reset Name" context menu items

### Enhanced Task CLI (`task.js get`)
- ANSI colors, word-wrapped sections, progress bars, relative timestamps
- Resolved dependency titles and contextual action hints
- New flags: `--json`, `--changes` (timeline view), `--no-color`

### Settings About Tab
- App identity with version and license badges
- Quick links to GitHub, issue tracker, What's New, and Changelog

### Terminal Preview Overlay
- Shows 5 lines (up from 3) for better visibility of scrolled-up output
- Comprehensive ANSI escape stripping — fixes garbled DEC private mode sequences from Claude Code

## Bug Fixes

- Fixed false-positive success toasts across 10+ components
- Fixed `ipcRenderer.on` leak in Sidebar (now uses `.once`)
- Fixed stale closures in terminal DESTROYED handler and closeTerminal callback
- Added 5s safety timeout on terminal creation guard
- Fixed `relativeTime` producing "NaNy ago" for invalid dates in task CLI

## UI Polish

- **WhatsNew dialog**: Fixed content overflow (removed nested ScrollArea), added Close footer
- **KeyboardShortcuts**: Migrated from custom Framer Motion overlay to shadcn Dialog
- **TasksPanel dialog**: Replaced manual overflow with ScrollArea component
- **SettingsPanel**: Theme-consistent toggle colors, visual grouping with card containers, styled selects, proper padding

## Documentation

- Pipeline system ADR (007) with architecture design
- 5 pipeline implementation sub-tasks planned

## Quality

- TypeScript strict-mode: clean
- ESLint: 0 errors
- Tests: 95/95 passing

---

> This is a beta release. Expect rough edges — please report issues on GitHub.
