# Changelog

All notable changes to SubFrame will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0-beta.3] - 2026-03-03

### Added
- **Settings panel**: Terminal tab (font, cursor, shell, bell, copy-on-select), Editor tab (font, tab size, theme, word wrap, minimap, line numbers, bracket matching), Updates tab (auto-check, pre-release channel, check interval)
- **Settings About tab**: Version/license badges, GitHub and issue tracker links, What's New trigger, View Changelog button
- **Git Changes tab**: Working tree status in GitHub hub — staged (green), modified (amber), untracked (gray) with collapsible sections and summary bar
- **Prompts panel**: Inline expand-in-place editing, tag-click filtering, sort modes (usage/updated/alpha), collapsible categories with batch rename, template variable highlighting, keyboard navigation
- **File & View menus**: Standard Electron menu bar — New/Close Terminal, Open Project, Settings, Toggle Sidebar/Right Panel, Reset Layout, zoom, fullscreen
- **Workspace-scoped terminal state**: Layout persists per-project, Claude session names auto-detected for tabs, right-click Refresh/Reset Name
- **Task CLI enhancements** (`task.js get`): ANSI colors, word-wrapped sections, progress bars, relative timestamps, resolved dependency titles, action hints; new flags `--json`, `--changes`, `--no-color`
- **Terminal preview overlay**: Shows 5 lines of scrolled-up output with comprehensive ANSI escape stripping
- Pipeline system ADR (007) with 5 implementation sub-tasks

### Fixed
- False-positive success toasts across 10+ components
- `ipcRenderer.on` leak in Sidebar (now uses `.once`)
- Stale closures in terminal DESTROYED handler and closeTerminal callback
- 5s safety timeout on terminal creation guard
- `relativeTime` producing "NaNy ago" for invalid dates in task CLI
- WhatsNew dialog content overflow (removed nested ScrollArea)
- Terminal preview garbled DEC private mode sequences from Claude Code (`?2026h`)
- Pre-release update channel not activating for beta versions

### Changed
- KeyboardShortcuts migrated from Framer Motion overlay to shadcn Dialog
- TasksPanel dialog uses ScrollArea instead of manual overflow
- SettingsPanel toggles use theme tokens (`bg-bg-tertiary`) instead of hardcoded `bg-zinc-600`, visual grouping with card containers and group labels

## [0.1.0-beta.2] - 2026-03-02

### Added
- Electron auto-updater with toast notifications
- Terminal grid UX improvements, command palette, onboarding dialog, prompt library
- Warp-style terminal UX: GPU rendering (WebGL/Canvas addons), animated tabs with drag-to-reorder, inline search (Ctrl+F), Shift+Enter newline, live output overlay, scroll-to-bottom button
- Project system enhancements

### Fixed
- VitePress base path for GitHub Pages subdirectory deployment

## [0.1.0-beta.1] - 2026-03-01

### Added
- SubFrame tooling: hooks, skills, CI pipeline, test suite
- VitePress documentation site with custom theme and user-facing guides
- Default project directory picker and AI files management
- TypeScript + React migration of full codebase
- Complete rebrand from Frame to SubFrame

### Fixed
- Panel animation during resize drag
- Compact task panel columns in sidebar mode
- macOS DMG builds (1024px icon)
- CI compatibility (Node 22/24, lockfile sync)

### Changed
- README rewritten for beta, CLAUDE.md and AGENTS.md updated

## [0.0.1] - 2026-02-01

### Added
- Initial release: multi-terminal IDE for Claude Code
- File tree, code editor, task management system
- GitHub panel with issues integration
- Plugin management for Claude Code
- Keyboard shortcuts with macOS compatibility
- Project-based terminal session management

[Unreleased]: https://github.com/Codename-11/SubFrame/compare/v0.1.0-beta.3...HEAD
[0.1.0-beta.3]: https://github.com/Codename-11/SubFrame/compare/v0.1.0-beta.2...v0.1.0-beta.3
[0.1.0-beta.2]: https://github.com/Codename-11/SubFrame/compare/v0.1.0-beta.1...v0.1.0-beta.2
[0.1.0-beta.1]: https://github.com/Codename-11/SubFrame/compare/v0.0.1...v0.1.0-beta.1
[0.0.1]: https://github.com/Codename-11/SubFrame/releases/tag/v0.0.1
