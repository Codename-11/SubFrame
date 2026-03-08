# Changelog

All notable changes to SubFrame will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **AI Analysis re-run**: SubFrame Health panel now has "AI Analysis" button to re-run onboarding analysis on already-initialized projects

### Fixed
- **Onboarding not triggered after init**: Project initialization created `.subframe/` files but never opened the AI analysis wizard — now dispatches `start-onboarding` event to open OnboardingDialog
- **"View Terminal" unavailable during analysis**: Terminal ID was only delivered after analysis completed — now sent via progress event immediately when terminal is created
- **Orphaned analysis terminals**: Closing the onboarding dialog during analysis now properly cancels the running analysis and kills the terminal
- **Dialog auto-close on import**: OnboardingDialog now closes automatically after applying selected results

## [0.2.1-beta] - 2026-03-08

### Added
- **Spellcheck app-wide**: Enabled Chromium spellcheck across all text inputs and textareas via `webPreferences.spellcheck`
- **Collapsed sidebar agent badge**: Agent status in collapsed sidebar now shows Bot icon + pulse dot + count badge with tooltip (matches git status pattern)
- **Auto-select folder-picked project**: Projects added via "Select Folder" dialog are now auto-selected in the project list

### Fixed
- **Add Folder not adding to workspace**: "Select Folder..." dialog opened the native picker but never called `workspace.addProject()` — project was silently lost
- **WORKSPACE_UPDATED type mismatch**: IPC channel declared `WorkspaceProject[]` but always sent `{ projects, workspaceName }` — fixed type contract
- **Collapsed sidebar git icon**: Now opens Changes tab instead of Issues tab
- **WorkspaceSelector re-render loop**: Replaced `require()` inside component body with static import, fixing useEffect dependency instability
- **Remove project double-fire**: Removed dead `removeLoading` state that cleared synchronously before async IPC response
- **README promo video**: Replaced `<video>` tag (stripped by GitHub) with user-attachments URL for inline playback

## [0.2.0-beta] - 2026-03-08

### Added
- **Reuse idle terminal for agent**: Starting an agent (Ctrl+Shift+Enter / Play button) now reuses the active terminal if no agent is running, instead of always creating a new one. Configurable via Settings → General → "Reuse idle terminal for agent" (enabled by default)
- **Agent status indicator in tabs**: Pulsing green bot icon appears in terminal tab bar and grid cells when an agent session is active
- **Auto-rename terminal tabs**: Terminal tabs automatically rename to the agent session name when a session starts (respects user-renamed tabs)
- **Agent Activity full-view**: Popout button on Agent Activity panel opens full-screen view with session list sidebar + detail timeline
- **Multi-session agent panel**: Agent Activity panel now shows all active/recent sessions (up to 5) with clickable cards, not just the first active one
- **Multi-session sidebar status**: Sidebar agent status widget shows count badge when multiple agents are active
- **Session differentiation in full-view**: Session list items show relative timestamps ("2m ago"), active tool badges, step counts; detail pane shows session start time
- **Jump to terminal from agent view**: Session cards and full-view detail pane show a terminal icon button that focuses the terminal running that agent session. Uses timestamp-based correlation between ptyManager detection and agent-state.json sessions
- **Usage polling interval setting**: Configurable polling interval for Claude API usage data (Settings → General → Behavior), default 5 minutes, range 30s–10min
- **Grid overflow auto-switch**: When in grid view with more terminals than grid cells, selecting an overflow terminal auto-switches to single view; selecting a grid terminal switches back. Overflow tabs get a warning dot indicator. Configurable via Settings → General → Behavior (enabled by default)
- **Pipeline `with:` config system**: Per-step configuration on workflow YAML steps — `scope` (project/changes), `mode` (agent/print), `focus` (security/documentation/architecture/performance/testing), and custom `prompt` overrides
- **Pipeline scope: project**: AI stages can now analyze entire codebase context (file tree, STRUCTURE.json, package.json, git log, key config files) instead of just git diffs
- **Pipeline agent mode**: `mode: agent` spawns Claude in autonomous multi-turn mode with tool use for deep analysis; `mode: print` (default) uses fast single-turn mode
- **Pipeline full-screen view**: Popout button in sidebar to open pipeline panel in full-screen mode (matching Tasks panel pattern)
- **Pipeline Re-Run and Delete**: Re-run button to re-trigger the same workflow, Delete button to remove pipeline runs
- **Docs Audit workflow template**: `docs-audit.yml` — checks STRUCTURE.json sync + AI documentation review with `scope: project, focus: documentation`
- **Security Scan workflow template**: `security-scan.yml` — npm audit + AI security review with `scope: project, focus: security`
- **Workflow Editor UI**: Visual workflow builder with drag-to-reorder steps, stage type autofill dropdown, AI config fields (scope/mode/focus/prompt), and YAML view toggle via CodeMirror. Create, edit, and delete workflows directly from the Pipeline panel
- **User message highlights**: Detects user messages during agent sessions and marks them with a subtle amber left-border decoration and scrollbar indicator. Configurable via Settings → General → Behavior (enabled by default)
- **Scroll to last message**: Navigation button appears when scrolled up during agent sessions — click to jump back through your messages. Uses xterm markers for accurate, scrollback-safe positioning
- **Nerd Font auto-detection**: Default font stack now prefers Nerd Font variants (JetBrainsMono, CaskaydiaCove, FiraCode, Hack, MesloLGS). Settings panel shows a green checkmark if a Nerd Font is detected, or a link to nerdfonts.com if not. Zero-config: icons from Oh My Posh / Starship just work when a Nerd Font is installed

### Changed
- **Health Check workflow**: Now uses `scope: project` for describe/critique stages (audits whole codebase, not just recent diffs)
- **Pipeline stage handlers**: All AI stages (test, describe, critique) now use configurable scope, mode, focus, and prompt via `with:` config

### Fixed
- Pipeline critique/patches/log tabs showing no data (Radix Tabs breaking flex height chain — replaced with plain button tab bar)
- Pipeline sidebar scroll not working (removed wrapper div breaking flex chain, matching TasksPanel flat layout pattern)
- AI tool JSON envelope not unwrapped (Claude CLI `--output-format json` wraps in `{"type":"result","result":"..."}`)
- Shell mangling of AI prompts with backticks/quotes (now piped via stdin instead of positional args)
- Empty diff when baseSha === headSha on main branch (graceful skip with meaningful message)
- Removed redundant renderer-side usage polling timer (main process already pushes updates)
- Terminal grid slot swap losing scrollbar and scroll overlay (React keyed by slot index instead of terminal ID, causing stale DOM reuse — now keys by terminal ID so React moves DOM nodes correctly)
- Scroll tracking effect not re-attaching after grid swap (`containerRef`/`terminalRef` deps are stable ref objects — added `terminalId` to dependency array)

## [0.1.0-beta.4] - 2026-03-05

### Added
- **Theme system**: Full theme customization with 4 built-in presets (Classic Amber, Synthwave Traces, Midnight Purple, Terminal Green), custom theme creation, color pickers, and feature toggles (neon traces, CRT scanlines, logo glow)
- **Appearance tab**: New first tab in Settings — preset gallery with live switching, color customization, save/delete custom themes
- **ThemeProvider component**: Runtime CSS variable injection, shadcn/ui token sync, data-attribute feature toggles
- **Neon trace CSS system**: `[data-neon-traces]` and `[data-scanlines]` attribute-driven styles in globals.css
- **Docs site theme**: Replaced generic amber accent with logo's neon synthwave palette (purple/pink/cyan) across landing, docs, and blog pages
- **Terminal grid drag-to-swap**: Slot-based grid model supports dragging terminals between filled and empty cells
- **Usage element resilience**: Session usage pill persists through API errors with stale-while-revalidate; shows "Usage unavailable" with contextual tooltip on cold start 429/401 errors
- **Pipeline system**: Configurable CI/review pipelines with AI-powered stages, YAML workflow templates, and run history tracking

### Fixed
- Terminal grid drag-to-empty pane not working (replaced ordered-list model with slot-based grid positions)
- Ctrl+Shift+T not spawning terminal in grid mode (Electron menu accelerator intercept, now routes through CustomEvent)
- "An object could not be cloned" Electron IPC error on terminal creation (React `MouseEvent` leaking through `onClick={handler}` into optional `shell` parameter)
- Nested `<button>` inside `<button>` HTML violation in Settings theme preset gallery
- Grid empty pane "New Terminal" button now places the terminal in the clicked pane instead of the first empty slot
- Usage element text unreadable in error state (upgraded from `text-text-muted` to `text-text-secondary`, removed compounding opacity)
- Hook commands failing in subdirectories (relative paths resolved to wrong CWD; now anchored to git root via `git rev-parse`)

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

[Unreleased]: https://github.com/Codename-11/SubFrame/compare/v0.2.1-beta...HEAD
[0.2.1-beta]: https://github.com/Codename-11/SubFrame/compare/v0.2.0-beta...v0.2.1-beta
[0.2.0-beta]: https://github.com/Codename-11/SubFrame/compare/v0.1.0-beta.4...v0.2.0-beta
[0.1.0-beta.4]: https://github.com/Codename-11/SubFrame/compare/v0.1.0-beta.3...v0.1.0-beta.4
[0.1.0-beta.3]: https://github.com/Codename-11/SubFrame/compare/v0.1.0-beta.2...v0.1.0-beta.3
[0.1.0-beta.2]: https://github.com/Codename-11/SubFrame/compare/v0.1.0-beta.1...v0.1.0-beta.2
[0.1.0-beta.1]: https://github.com/Codename-11/SubFrame/compare/v0.0.1...v0.1.0-beta.1
[0.0.1]: https://github.com/Codename-11/SubFrame/releases/tag/v0.0.1
