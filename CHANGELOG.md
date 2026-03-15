# Changelog

All notable changes to SubFrame will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Asymmetric terminal grid layouts** — 4 new layouts: 2+1 (two stacked left, one full right), 1+2 (one full left, two stacked right), 2/1 (two top, one full bottom), 1/2 (one full top, two bottom)

## [0.5.4-beta] - 2026-03-15

### Fixed
- **Update check interval** — default lowered from 4 hours to 1 hour for faster beta update delivery
- **Check-on-focus** — silently checks for updates when SubFrame regains focus after 5+ minutes, catching updates within minutes of returning to the app

## [0.5.3-beta] - 2026-03-15

### Fixed
- **CLI edit spawns standalone window** — `subframe edit <file>` now opens a new editor window instead of hijacking the running instance
- **CLI open non-disruptive** — `subframe open <dir>` adds project to workspace without switching the active project

## [0.5.2-beta] - 2026-03-15

### Fixed
- **CLI install auto-PATH** — Windows installer now automatically adds SubFrame\bin to user PATH via PowerShell registry API
- **CLI uninstall** — "Uninstall" button in Settings removes the CLI command and cleans the PATH entry

## [0.5.1-beta] - 2026-03-15

### Fixed
- **Shell selector dropdown** — replaced raw text input with dropdown of detected shells (pwsh, bash, zsh, fish, nushell, WSL, Git Bash)
- **CLI install helper** — "Install CLI to PATH" button in Settings creates symlink/batch file for `subframe` command
- **CLI packaging** — `subframe-cli.js` bundled via `extraResources` for packaged builds
- **Ctrl+G shortcut conflict** — editor Go-to-Line changed to Ctrl+L (no longer conflicts with grid toggle)
- **macOS open-file race** — file path queued when window not yet ready
- **Auto-fetch timer leak** — stopped on app close
- **Auto-fetch minimum interval** — 30-second guard prevents runaway fetch loops
- **Push button stub** — removed non-functional "push" button from sidebar

## [0.5.0-beta] - 2026-03-15

### Added
- **Git auto-fetch** — configurable background fetch interval (3-15min) in Settings, with minimum 30s guard
- **Git sync status** — branch ahead/behind in sidebar and GitHub panel header with "Up to date" indicator
- **Editor find/replace** — Ctrl+H find-and-replace panel via CodeMirror search extension
- **Editor go-to-line** — Ctrl+L go-to-line dialog via toolbar button and keyboard shortcut
- **Editor code folding** — fold gutters with clickable arrows for collapsible code blocks
- **Editor tab mode** — toggle between overlay dialog and inline tabs alongside terminal tabs, with recent files tracking
- **CLI integration** — `subframe edit <file>`, `subframe open <dir>`, `subframe .` via `scripts/subframe-cli.js`
- **Single-instance enforcement** — second app launches forward argv to running instance
- **macOS open-file handler** — Finder/Dock file associations with pre-ready queuing
- **Recent files tracking** — last 10 opened files tracked in localStorage

### Fixed
- **Ctrl+G shortcut conflict** — Go-to-Line changed from Ctrl+G (conflicted with grid toggle) to Ctrl+L
- **macOS open-file race** — file path queued when window not yet ready, flushed on ready-to-show
- **Auto-fetch timer leak** — stopped on app close via `stopAutoFetch()` in closed handler
- **Push button stub** — removed fake "push" button that only showed a toast, kept ↑N indicator

## [0.4.0-beta] - 2026-03-14

### Added
- **Activity Streams system** — centralized execution/output manager with VS Code-style bottom bar (ActivityBar), real-time log streaming, heartbeat timers, and timeout management with dismiss controls
- **Settings panel sidebar navigation** — replaced horizontal tabs with sidebar nav, search filter, and 5 reusable setting components (SettingToggle, SettingInput, SettingSelect, SettingSlider, SettingGroup)
- **Close-window protection** — native warning dialog when closing with active AI agents, pipelines, or analyses running; themed AlertDialog for terminal tab close
- **Onboarding analysis streaming progress** — auto-show terminal output, elapsed timer, line count, logarithmic progress bar creep via named PTY output handlers
- **Pipeline print-mode heartbeat** — 10-second heartbeat timer in spawnAIToolRaw for feedback during AI tool execution
- **Task enhance timeout and JSON extraction** — 2-minute timeout guard and multi-strategy JSON extraction (direct, fenced, brace-search) for ENHANCE_TASK
- **Workspace create dialog** — name input dialog when creating new workspace (previously hardcoded "New Workspace")
- **Task panel bulk actions** — select mode toggle, themed Checkbox column, bulk Complete/Delete with confirmation, bulk Send to Terminal with optional wrapper prompt
- **Task panel Copy ID** — context menu item to copy task ID to clipboard
- **Task send-to-terminal enhancement** — includes task ID, priority, category, status, and steps; auto-starts pending tasks
- **Pop-out terminal windows** — detach terminals to separate windows for multi-monitor workflows (Ctrl+Shift+D)
- **Prompts top-bar shortcut** — Prompts moved to own button in main tab bar (out of Agents group)

### Fixed
- **Terminal grid overflow** — extra grid slots no longer render as phantom rows when switching from larger to smaller grid layouts
- **Terminal scroll position retention** — double-RAF restore after fit() prevents scrollbar reset on workspace switch
- **Task edit dialog overflow** — flex column layout with fixed header/footer and scrollable middle
- **Reset layout completeness** — now clears all persisted state (sidebar, right panel, grid layout, cell sizes)
- **Named PTY output handlers** — upgraded from single to multi-handler Map, preventing handler clobbering between trust prompt and streaming progress
- **Onboarding audit fixes** — trust handler given explicit ID, elapsed timer guarded on isAnalyzing, immediate first-output progress tick
- **Bulk delete safety** — bulk delete now requires confirmation dialog (was instant/irreversible)
- **Task privacy change data safety** — file write before delete to prevent data loss on write failure

### Changed
- **"Agent Activity" tab renamed to "Agents"** — shorter label in ViewTabBar
- **Default grid layout** — changed from 2x2 to 1x2
- **Right panel minimum width** — increased from 320px to 380px
- **Top bar reorder** — Sub-Tasks, GitHub, Agents, Prompts, Pipeline, Overview

## [0.3.1-beta] - 2026-03-12

### Fixed
- **Missing GitHub button in top bar**: Added GitHub panel shortcut to ViewTabBar alongside Sub-Tasks, Agents, Pipeline, and Overview
- **Update check "latest version" toast**: Manual update checks no longer show a success toast when already on the latest version — the checking toast dismisses silently instead
- **Auto-check error noise**: Background update check failures no longer show error toasts to the user — only manual checks surface errors

### Changed
- **Unified update notification flow**: Settings "Check Now" and menu "Check for Updates" now share centralized toast feedback via UpdateNotification component, with manual vs auto check distinction

## [0.3.0-beta] - 2026-03-11

### Added
- **Global prompts in PromptsPanel**: Sidebar panel now shows both global and project prompts with scope toggle (All/Global/Project), scope badges, scope-aware CRUD, and scope-change-as-move semantics
- **Seed prompts**: 7 starter prompts auto-seeded on first launch — Quick Audit, Explain This, Refactor Suggestions, Write Tests, PR Description, Security Review, Summarize Session
- **Template variables**: 3 new prompt variables — `{{branch}}` (current git branch), `{{date}}` (today's date), `{{aiTool}}` (active AI tool name) — resolved at insert time from live data
- **AI tool install guards**: All AI tool spawn paths (task enhance, pipeline, onboarding) now check install status and fail gracefully with actionable error messages
- **AI tool recheck button**: Settings panel shows a compact recheck button to re-detect tool installation status
- **Agent state types**: Shared type definitions for agent state tracking
- **AIToolPalette**: Renamed from AIToolSelector with install warning toast when binding an uninstalled tool

### Fixed
- **Async AI tool detection**: Converted blocking `execSync` to async `execFile` across the full call chain (aiToolManager → menu → onboarding → pipeline → tasks) — eliminates UI freezes during tool detection
- **Menu Start disabled for uninstalled tools**: Start menu item grayed out when the active AI tool is not installed
- **Onboarding duplicate install check**: Replaced standalone `checkAIToolAvailable()` with delegation to shared `aiToolManager.getActiveTool()` + install cache
- **Recheck toast timing**: Settings and AIToolPalette now `await refetch()` before showing success toast, ensuring accurate feedback

### Changed
- **"Agent Activity" tab renamed to "Agents"**: Shorter label in ViewTabBar

## [0.2.7-beta] - 2026-03-11

### Fixed
- **Tab name cross-contamination**: Terminals no longer adopt names from unrelated sessions — removed dangerous `sessions[0]` fallback that caused tab names to swap between terminals
- **Duplicate rename toasts**: Auto-rename no longer fires duplicate toasts from ptyManager retry broadcasts; added `pendingRenames` guard and sessionId validation
- **Sub-view X button not closing tab**: Clicking X while in Stats/Decisions/Structure Map sub-views now correctly closes the parent Overview tab
- **Panel buttons opening as full-view**: ViewTabBar shortcut buttons (Sub-Tasks, Agent Activity, Pipeline, Overview) now open the right sidebar panel instead of full-view overlays, restoring the original cycle (open → collapsed → hidden)
- **Agent Activity fallback selection**: Removed `sessions[0]` fallback in AgentStateView that could display unrelated session data when no active session exists

### Changed
- **Usage pill moved to main tab bar**: Session/weekly usage indicator relocated from TerminalTabBar to ViewTabBar for better visibility as a global status element
- **View shortcut buttons restored to full text+icon**: Buttons show both icon and label (Overview, Sub-Tasks, etc.) instead of icon-only squares; tooltips now show just the keyboard shortcut

## [0.2.6-beta] - 2026-03-10

### Added
- **Private sub-tasks**: Tasks can be marked private — stored in `.subframe/tasks/private/` (gitignored), excluded from the `tasks.json` index, but fully functional in UI, CLI, and hooks
- **Tab bar restructure**: View shortcuts (Overview, Sub-Tasks, Agent Activity, Pipeline) moved from terminal tab bar to main ViewTabBar with sidebar toggle
- **Workspace/project badge**: Shows workspace and project name in tab bar when sidebar is collapsed
- **Open in tab button**: Sidebar panels with full-view equivalents show a maximize icon to open as a tab
- **Tab persistence**: Open tabs saved to localStorage and restored across sessions
- **Tasks refresh button**: Manual refresh icon in TasksPanel toolbar
- **Global prompts**: User-level prompts stored at `~/.subframe/prompts.json` with promote/demote between project and global scope
- **Configurable source directory**: STRUCTURE.json updater reads `sourceDir` from `.subframe/config.json` instead of hardcoding `src/`

### Fixed
- **Terminal bounce**: Message stepping indicators no longer flicker during active Claude output
- **Sub-view tab leak**: Stats, Decisions, Structure Map render within Overview tab instead of creating separate tabs
- **Stale data on project switch**: 5 hooks (tasks, agent state, AI files, pipeline, health) now clear cached refs when project changes
- **Auto-update managed components**: Outdated SubFrame components auto-synced on project load with loop prevention
- **Cross-project hook portability**: Hooks detect `scripts/task.js` existence and fall back to `npx subframe task`
- **Codex wrapper recursion**: Self-detection via PATH comparison prevents infinite recursion
- **Task timeline pulse**: 3-keyframe seamless loop replacing 2-keyframe flash
- **IPC type mismatch**: `GET_TERMINAL_SESSION_NAME` type updated to include optional `sessionId`

## [0.2.5-beta] - 2026-03-10

### Added
- **View tab bar**: VS Code-style tab bar for managing open full-view panels with close buttons and keyboard navigation
- **Terminal user message stepping**: Directional up/down navigation between user message markers in terminal scrollback (replaces single "jump to last" button)
- **Scroll-to-bottom icon**: Updated to ArrowDownToLine for clearer visual meaning
- **Shortcuts panel**: Full-view panel replacing the modal dialog, integrated with the tab bar system
- **Keyboard badge component**: Shared `<Kbd>` component for consistent shortcut display across UI
- **Terminal tab index numbers**: Tabs 1-9 show index numbers for quick switching reference
- **Version-stamped component deployment**: All deployed files now include `@subframe-version` and `@subframe-managed` headers for tracking origin and version
- **Version-aware health check**: SubFrame Health detects outdated deployments by comparing `@subframe-version` in deployed files to current app version
- **Structural claude-settings validation**: Health check verifies all 5 hook event types are configured and reports which are missing
- **User-edit resilience**: Files marked with `@subframe-managed: false` are skipped during updates — opt out of managed updates per file
- **Build pipeline safety**: `npm run verify:hooks` prevents `scripts/hooks/` drift from templates; included in `npm run check`, pre-commit hook, and CI
- **Health panel improvements**: Shows deployed version transitions, missing hooks list, user-managed badges, and skipped component count after updates

### Fixed
- **Terminal user message indicators lost on workspace switch**: Moved grace period state from React ref to terminal registry so it persists across component remounts
- **Terminal onData race condition**: Read terminal from registry instead of React ref, eliminating null-ref window during terminal switch
- **Terminal resize choppiness during panel drag**: Skip fit() during active resize, single fit on drag end via Zustand store subscription
- **Terminal message nav state lingering**: Reset hasMessageAbove/hasMessageBelow when highlightUserMessages setting toggled off
- **Panel resize stuck on mouse-release outside window**: Added window blur listener as safety net to clear isResizing state
- **TaskDetail crash on undefined steps**: Guard `task.steps` with `?? []` fallback (prevents crash on tasks from older format)
- **Task dependency selects using global DOM queries**: Replaced `document.getElementById` with controlled React state to prevent ID collisions and stale DOM
- **Task markdown link security**: Validate URL scheme before `shell.openExternal` — only allows `https:` and `http:`
- **Managed-file opt-out check truncated**: Removed `.slice(0, 1024)` so `@subframe-managed: false` marker is found anywhere in the file
- **Empty task steps lost on form/markdown round-trip**: Filter empty-label steps before markdown conversion to prevent silent data loss
- **Double terminal fit on drag end**: Clear debounce timer when Zustand subscriber fires fit, preventing redundant reflow
- **TaskTimeline pulse animation flash**: Replaced 2-keyframe loop (opacity jump) with 3-keyframe seamless loop (fade-in → fade-out → no gap)
- **TasksPanel two-column layout cramped in side panel**: Single-column stacked layout in panel mode, two-column grid only in full-view
- **Workspace switching not working from all contexts**: Moved Ctrl+Alt workspace shortcuts to App.tsx (always mounted)
- **Loading screen not dismissing**: Added React callback pattern for reliable loading overlay removal
- **Semver pre-release comparison**: Segment-by-segment numeric-aware comparison instead of lexicographic

### Changed
- **TaskDetail expanded row**: Inline edit button (Pencil icon) next to Copy ID; inline badges row replaces sidebar card in panel mode
- **`execSync` import in frameProject**: Moved from conditional `require()` to top-level import

## [0.2.4-beta] - 2026-03-10

### Added
- **Pipeline max-turns control**: AI agent stages now support `max-turns` config in workflow YAML (`with: { max-turns: 25 }`). Default 25 for agent mode, 0 = unlimited. Configurable in Workflow Editor UI
- **Pipeline "Re-run Unlimited" button**: When a stage fails due to turn limit, an amber warning indicator and "Unlimited" re-run button appear to bypass the limit
- **Pipeline agent heartbeat logging**: Agent-mode stages emit periodic heartbeat logs (`[Agent] 1m 30s elapsed | ~5 turns`) and a final summary, replacing silent long-running stages
- **Pipeline elapsed time in timeline**: Running stages show a live elapsed time counter under the stage node
- **Pipeline runtime overrides**: `startPipeline` accepts runtime `overrides` that merge into all stage configs (used by the unlimited re-run flow)
- **Pipeline failure reasons**: Stages track `failureReason` (`max-turns`, `timeout`, `error`) for targeted retry UI and distinct visual indicators
- **Centralized shortcut registry**: Single source of truth (`src/renderer/lib/shortcuts.ts`) for all keyboard shortcuts — KeyboardShortcuts modal and CommandPalette auto-generate from it
- **Keyboard shortcuts search**: Shortcuts help modal now has a filter input to search by key or description
- **Workspace keyboard switching**: `Ctrl+Alt+1-9` jumps to workspace by index, `Ctrl+Alt+[/]` cycles prev/next
- **Workspace dropdown UI**: `#N` index prefix, project count badge, and shortcut hints in the dropdown
- **Collapsed sidebar workspace switcher**: Layers icon between logo and tab icons opens compact workspace dropdown
- **Quick Tasks palette**: New `Ctrl+'` overlay for fast fuzzy-search across active sub-tasks (in-progress, pending, blocked) with status dots and priority badges
- **Command palette enhancements**: Added Pipeline panel, Prompt Library, and dynamic Workspaces group; all shortcut labels now sourced from registry
- **Enhanced task detail view**: Two-column layout with metadata card, step progress bar, user request display, dependency resolution with icons, and copy task ID button
- **Task dependency linking UI**: Blocked-by and Blocks fields in edit dialog Advanced section with select + removable badge pattern
- **AI-Enhance button for tasks**: Sparkles button in task dialog uses active AI tool to auto-improve title, description, steps, acceptance criteria, and priority/category
- **Terminal grid slot retention**: Drag-swap slot positions now persist across view mode changes, project switches, and app restarts via Zustand store + session persistence
- **GitHub issue templates**: Bug report and feature request YAML form templates with structured fields
- **GitHub PR template**: Checklist for quality gates, changelog, and conventions
- **Claude PR auto-review**: GitHub Action workflow reviews PRs for pattern adherence, code quality, and project fit using OAuth
- **Claude interactive `@claude` mentions**: Respond to `@claude` in any issue or PR comment for on-demand AI help
- **Issue auto-labeling**: Zero-cost keyword-based labeling on issue open (area and platform tags)
- **Issue triage workflow**: Claude-powered triage when `needs-triage` label is applied
- **Dependabot configuration**: Weekly npm and GitHub Actions dependency updates with grouped dev deps
- **CONTRIBUTING.md**: Developer setup, workflow, conventions, and PR expectations
- **SECURITY.md**: Vulnerability reporting via GitHub private advisory
- **REVIEW.md**: Claude review rules — patterns to enforce, things to skip, project fit criteria
- **Ko-fi funding**: GitHub sponsor button linked to Ko-fi

### Fixed
- **Pipeline cancel on Windows**: Process tree kill now uses `taskkill /F /T` on Windows instead of `SIGTERM` (which only killed the shell, not the Claude CLI child process)
- **CodeMirror text selection in dialogs**: Added `onOpenAutoFocus`/`onPointerDownOutside` preventDefault to Editor and WorkflowEditor dialogs — prevents Radix focus trap from intercepting CodeMirror mouse events
- **Task priority not sortable**: Split combined Tags column into separate Category and Priority columns (both sortable with multi-sort). Default sort: status asc → priority high-to-low
- **Command palette GitHub label**: "GitHub Issues" corrected to "GitHub" (toggles the panel group, not a sub-tab)
- **Shortcuts modal duplicate**: Removed duplicate `Ctrl+Shift+Y` entry (was listed in both Panels and Terminal)
- **Prompt Library unreachable from palette**: Added `open-prompt-library` event bridge so command palette can trigger it
- **Sensitive files tracked in git**: Untracked `.claude/settings.local.json` and `.subframe/pipelines/runs.json` (contained local filesystem paths)
- **npm audit vulnerabilities**: Fixed minimatch ReDoS and tar path traversal in build-time dependencies

### Changed
- **Pipeline workflows use agent mode**: `health-check`, `docs-audit`, and `security-scan` workflows now use `mode: agent` for project-scope AI stages, with explicit `max-turns` limits (25-30)
- **CI concurrency groups**: CI and Claude review workflows cancel superseded runs on the same PR branch

### Removed
- **Dead `PipelineLogView.tsx`**: Standalone component was never imported — removed (inline version in PipelinePanel is used)

## [0.2.3-beta] - 2026-03-09

### Fixed
- **Usage polling off by default**: Polling now disabled by default (on-demand only); when enabled uses exponential backoff with persistent failure notification and one-click disable
- **Collapsed right panel shows all groups**: All panel group icons visible in collapsed sidebar with animated drawers for multi-panel groups (Agent hub, GitHub hub)
- **GitHub default view**: Changes panel is now the default entry point (Ctrl+Shift+G) instead of Issues
- **Usage fetch indicator**: Loading spinner shown in usage pill during API fetch with click debouncing

## [0.2.2-beta] - 2026-03-08

### Added
- **AI Analysis re-run**: SubFrame Health panel now has "AI Analysis" button to re-run onboarding analysis on already-initialized projects

### Fixed
- **Onboarding not triggered after init**: Project initialization created `.subframe/` files but never opened the AI analysis wizard — now dispatches `start-onboarding` event to open OnboardingDialog
- **"View Terminal" unavailable during analysis**: Terminal ID was only delivered after analysis completed — now sent via progress event immediately when terminal is created
- **Orphaned analysis terminals**: Closing the onboarding dialog during analysis now properly cancels the running analysis and kills the terminal
- **Dialog auto-close on import**: OnboardingDialog now closes automatically after applying selected results
- **Uninstall missing artifacts**: `pre-push` git hook and `onboard` Claude skill now properly cleaned up during uninstall
- **Terminal copy/paste double-fire**: Fixed xterm decoration API and duplicate event handling
- **Terminal render storm**: Throttled output overlay and scroll button setState to reduce re-renders during rapid PTY output
- **Session/Skills/Plugins commands not executing**: Replaced dead `window.terminalSendCommand` with working `sendCommandToTerminal()` utility

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

[Unreleased]: https://github.com/Codename-11/SubFrame/compare/v0.5.4-beta...HEAD
[0.5.4-beta]: https://github.com/Codename-11/SubFrame/compare/v0.5.3-beta...v0.5.4-beta
[0.5.3-beta]: https://github.com/Codename-11/SubFrame/compare/v0.5.2-beta...v0.5.3-beta
[0.5.2-beta]: https://github.com/Codename-11/SubFrame/compare/v0.5.1-beta...v0.5.2-beta
[0.5.1-beta]: https://github.com/Codename-11/SubFrame/compare/v0.5.0-beta...v0.5.1-beta
[0.5.0-beta]: https://github.com/Codename-11/SubFrame/compare/v0.4.0-beta...v0.5.0-beta
[0.4.0-beta]: https://github.com/Codename-11/SubFrame/compare/v0.3.1-beta...v0.4.0-beta
[0.3.1-beta]: https://github.com/Codename-11/SubFrame/compare/v0.3.0-beta...v0.3.1-beta
[0.3.0-beta]: https://github.com/Codename-11/SubFrame/compare/v0.2.7-beta...v0.3.0-beta
[0.2.7-beta]: https://github.com/Codename-11/SubFrame/compare/v0.2.6-beta...v0.2.7-beta
[0.2.6-beta]: https://github.com/Codename-11/SubFrame/compare/v0.2.5-beta...v0.2.6-beta
[0.2.5-beta]: https://github.com/Codename-11/SubFrame/compare/v0.2.4-beta...v0.2.5-beta
[0.2.4-beta]: https://github.com/Codename-11/SubFrame/compare/v0.2.3-beta...v0.2.4-beta
[0.2.3-beta]: https://github.com/Codename-11/SubFrame/compare/v0.2.2-beta...v0.2.3-beta
[0.2.2-beta]: https://github.com/Codename-11/SubFrame/compare/v0.2.1-beta...v0.2.2-beta
[0.2.1-beta]: https://github.com/Codename-11/SubFrame/compare/v0.2.0-beta...v0.2.1-beta
[0.2.0-beta]: https://github.com/Codename-11/SubFrame/compare/v0.1.0-beta.4...v0.2.0-beta
[0.1.0-beta.4]: https://github.com/Codename-11/SubFrame/compare/v0.1.0-beta.3...v0.1.0-beta.4
[0.1.0-beta.3]: https://github.com/Codename-11/SubFrame/compare/v0.1.0-beta.2...v0.1.0-beta.3
[0.1.0-beta.2]: https://github.com/Codename-11/SubFrame/compare/v0.1.0-beta.1...v0.1.0-beta.2
[0.1.0-beta.1]: https://github.com/Codename-11/SubFrame/compare/v0.0.1...v0.1.0-beta.1
[0.0.1]: https://github.com/Codename-11/SubFrame/releases/tag/v0.0.1
