# SubFrame Changelog

Notable changes grouped by date and domain.

---

## [Unreleased]

### Added
- **Code editor enhancements** — CM6 compartment-based runtime settings
  - Minimap toggle (default off), word wrap, font size +/- (8–24px), fullscreen mode (F11)
  - Theme switcher: SubFrame Dark (default), SubFrame Light, High Contrast — via dropdown
  - Status bar with cursor position (Ln/Col), total lines, UTF-8 indicator
  - Color-coded save status (Ready/Modified/Saving/Saved/Error) with descriptive tooltips
  - Relative file path in header (strips project root)
  - All preferences persisted via `editor` settings block in `settingsManager.ts`
- **Version display in sidebar** — SubFrame / BETA / v0.1.0-beta.1 stacked layout
  - Pre-release badge auto-detected from SemVer tag, hidden for stable versions
  - Version read from `package.json` at runtime
- **Claude Code skills deployment** — `/sub-tasks`, `/sub-docs`, `/sub-audit` skills deployed to `.claude/skills/` during project init
  - Skills tracked as new `'skills'` category in SubFrame Health panel (18 total components across 5 categories)
  - Deployed `/sub-tasks` uses direct `.subframe/tasks/*.md` file manipulation (no CLI dependency)
  - `/sub-docs` and `/sub-audit` generalized for any SubFrame-managed project
  - Content-comparison health checks — "Outdated" badge + update button when templates change
  - "Remove Claude skills" uninstall option in health panel
  - Overview panel `HealthCard` updated with Skills row
  - AI Files panel `.claude/` section updated to reflect skill deployment
- **Skills panel** — Browse and run Claude Code skills from the right panel
  - `skillsManager.ts` (main process): scans `.claude/skills/` for SKILL.md files, parses YAML frontmatter, compares managed skills against templates for health status
  - `useSkills` hook (TanStack Query): wraps `LOAD_SKILLS` IPC channel
  - `SkillsPanel` component: expandable cards with `/command`, description, health badges, allowed-tools chips, "Run" button (types command into terminal), full SKILL.md content on expand
  - New IPC channel: `LOAD_SKILLS` (handle pattern)
- **Right panel regrouping** — Agent hub consolidates Activity, Sessions, History, Plugins, Skills into one tabbed group
  - `Ctrl+Shift+A` moved from full-view overlay to right-panel toggle (Agent group, Activity tab)
  - Agent Activity full-view overlay removed from TerminalArea
  - Sessions navbar button removed (accessible via Agent group tabs)
  - "Agent Activity" label shortened to "Activity" for tab width
- **Agent timeline reversed** — Newest steps now appear at top, oldest at bottom (auto-scrolls to top on new steps)
- **Real-time agent state visualization** — Live monitoring of Claude Code agent sessions in SubFrame
  - `agentStateManager.ts` (main process): watches `.subframe/agent-state.json` via `fs.watch`, 200ms debounce, dedup by `lastUpdated` timestamp
  - `agentStateTypes.ts` (shared): typed data contract — `AgentStep`, `AgentSession`, `AgentStatePayload`
  - `useAgentState` hook (TanStack Query): send/on IPC pattern with race-condition-safe listener registration
  - `AgentStateView` component: panel mode (compact session card + timeline) and full-view mode (session list + detail)
  - `AgentTimeline` component: vertical stepper with Framer Motion animations, status icons, relative timestamps, auto-scroll
  - `SidebarAgentStatus` component: pulsing green dot + current tool name in sidebar footer
  - Claude Code hooks (`scripts/hooks/pre-tool-use.js`, `post-tool-use.js`): write running/completed steps to agent-state.json
  - 4 new IPC channels: `LOAD_AGENT_STATE`, `AGENT_STATE_DATA`, `WATCH_AGENT_STATE`, `UNWATCH_AGENT_STATE`
  - Keyboard shortcut: `Ctrl+Shift+A` for Agent Activity panel
  - AI-agnostic port: hooks are Claude-specific adapters, renderer only depends on the generic `agent-state.json` format
- **Markdown-based task system** — Tasks migrated from single `tasks.json` to individual `.md` files with YAML frontmatter
  - Each task lives at `.subframe/tasks/<id>.md` — human-editable with syntax highlighting + markdown preview
  - `tasks.json` becomes an auto-generated index (backward-compatible with hooks)
  - New `taskMarkdownParser.ts` module with `parseTaskMarkdown()` / `serializeTaskMarkdown()` (gray-matter)
  - Full round-trip fidelity: unknown markdown sections preserved through parse → serialize cycles
  - New fields: `blockedBy[]`, `blocks[]`, `steps[]` (TaskStep: label + completed)
  - Schema version bumped from 1.1 → 1.2
- **Task dependency tracking** — `blockedBy` / `blocks` fields with visual dependency badges
  - Red "Blocked by" badges and amber "Blocking" badges in task detail view
  - "Blocked" status filter shows tasks with incomplete blockers
  - Derived `blockedTaskIds` set in `useTasks` hook
- **Task step/checklist tracking** — `## Steps` section with `- [x]` / `- [ ]` checkboxes
  - `TaskTimeline` component: horizontal stepper with Framer Motion animations
  - Compact progress bar mode for >7 steps, full stepper for ≤7
  - Interactive: click circles to toggle step completion (updates .md file)
  - Step progress count ("2/5") shown inline in task table rows
- **Task dependency graph** — React Flow v12 + dagre auto-layout (replaces D3 force-directed)
  - `TaskGraph` component: card-style nodes with title, status badge, priority dot, step progress bar
  - Hierarchical DAG layout via dagre (TB in full-view, LR in sidebar)
  - Smooth-step edges with arrow markers, animated for in-progress blockers
  - SubFrame dark theme via React Flow CSS variable overrides
  - Zoom, pan, draggable nodes, controls panel
  - Works in both sidebar and full-view modes (`compact` prop)
- **Kanban board view** — Status-grouped columns for task management
  - `TaskKanban` component: 4 columns (In Progress, Pending, Blocked, Completed)
  - Full-view: horizontal columns side by side with scroll
  - Sidebar/compact: vertical stacked sections with collapsible groups
  - Animated task cards with expandable detail (description, dependencies, actions)
  - Full action buttons on expanded cards (start, complete, pause, reopen, delete, open in editor, send to terminal)
- **3-way view toggle** — List / Kanban / Graph available in both sidebar and full-view (previously graph was full-view only)
- **"Open in Editor" button** — Opens task .md file in SubFrame's CodeMirror editor
- **Migration script** — `scripts/migrate-tasks-to-md.js` converts existing tasks.json to individual .md files
- **CLI enhancements** — New commands: `open <id>`, flags: `--blocked-by`, `--blocks`, `--add-step`, `--complete-step`, `--id`
- **CodeMirror 6 editor** — Replaced plain textarea with full-featured code editor
  - Syntax highlighting for 20+ languages (JS/TS, JSON, CSS, HTML, Markdown, Python, YAML, XML, Rust, C/C++, Java, PHP, SQL, Sass, Less, Vue, WAST)
  - Custom SubFrame dark theme matching the app's design system
  - Minimap (via @replit/codemirror-minimap)
  - Autocomplete, find/replace, multi-cursor editing
  - Code folding, bracket matching, active line highlighting
  - JSON syntax linting for .json files
  - Line numbers, indent guides, selection highlighting
  - New lib modules: `codemirror-theme.ts`, `codemirror-extensions.ts`
- **File preview system** — VS Code-style preview modes for supported file types
  - **Markdown preview** — Rendered markdown with GFM support (tables, task lists, strikethrough) via react-markdown + remark-gfm, syntax-highlighted code blocks via highlight.js with SubFrame theme
  - **HTML/CSS preview** — Live HTML rendering via sandboxed iframe (srcdoc), CSS files wrapped in sample HTML scaffold, deferred updates via useDeferredValue
  - **SVG preview** — Dual-mode: code editor (XML syntax) + visual preview with zoom/pan
  - **Image preview** — Binary images (PNG, JPG, GIF, WebP, AVIF, etc.) with zoom/pan via react-zoom-pan-pinch, checkered transparency background, file size display
  - **Code/Preview toggle** — Pill toggle in editor header for previewable files (md, html, css, svg)
  - **Two-phase image IPC** — READ_FILE_IMAGE channel loads binary images as base64 data URIs
  - New components: `MarkdownPreview.tsx`, `HtmlPreview.tsx`, `ImagePreview.tsx`
  - Binary file detection: blocks opening of archives, executables, fonts, etc.
  - Read-only mode: detects unwritable files, disables editing

### Fixed
- **`filePath` leaked into `tasks.json` index** — `regenerateIndex()` now strips `filePath` and `_unknownSections` before writing, matching CLI behavior
- **Watcher dedup broken** — `lastWatchedHash` compared `lastUpdated` timestamp which was regenerated fresh every call; replaced with content-based fingerprint (`computeTasksFingerprint`)
- **Empty `id` from missing frontmatter** — `parseTaskMarkdown()` now derives ID from filename via `path.basename(filePath, '.md')` instead of defaulting to `''`
- **`completedAt` not cleared on reopen** — `updateTask()` now nulls out `completedAt` when a completed task is moved back to pending/in_progress
- **Health panel checked `tasks.json`** instead of `tasks/` directory — registry entry updated to use `FRAME_TASKS_DIR`
- **Health panel uninstall warning** referenced `tasks.json` as user data — updated to `.subframe/tasks/*.md`
- **`checkExistingFiles()` missed `tasks/` directory** — added to file check list in `projectInit.ts`
- **QUICKSTART template missing `tasks/`** in project structure tree — added `tasks/` directory and `<id>.md` entry
- **`regenerateIndex()` mutated caller's object** — now builds a clean copy (`indexData`)
- **`substr()` deprecated** in task ID generation — replaced with `substring(2, 11)`
- **`chore` missing from category enum** — added to AGENTS.md, frameTemplates.ts taskSchema, and getAgentsTemplate()
- **`research` orphaned category** — replaced with `chore` in frameTemplates.ts categories map (research was never in the enum)
- **Category shown as plain text** in TaskKanban and TaskGraph — now uses styled `Badge` with `CATEGORY_COLORS`/`CATEGORY_SHORT` matching TasksPanel list view
- **Health test missing `skills` category** — test assertions and `deployFullProject()` updated for 3 new skill registry entries

---

## 2026-03-01 — Overview Panel Enhancements & UI Polish

### Overview Panel
- **Stats Hero section** — Dedicated full-width hero above the card grid with 4-column layout (LOC, Source Files, Commits, Branch), refresh button, click-through to detail view
- **Stats Detail View** (`StatsDetailView.tsx`) — Full-view panel with LOC breakdown by extension (proportional bars), git info section, refresh
- **Decisions Detail View** (`DecisionsDetailView.tsx`) — Full-view panel with complete decisions list from PROJECT_NOTES.md (increased backend limit from 10 → 50)
- **DecisionsCard** now clickable → opens Decisions detail view
- **Sub-Tasks full view** — Maximize button in TasksPanel sidebar opens full-view tasks (closes sidebar first)

### Sidebar
- **Animated logo** — Replaced static SVG with `getLogoSVG()` animated version (56px expanded, 36px collapsed)
- **Settings in collapsed view** — Settings icon now opens settings directly without expanding sidebar first
- **Ctrl+B cycles 3 states** — `expanded → collapsed → hidden → expanded` (was toggle between 2)

### Keyboard Shortcuts
- **Ctrl+T → Ctrl+Shift+S** — Remapped Sub-Tasks shortcut to avoid conflicting with Claude Code's built-in Ctrl+T (todos). Updated across App, TerminalTabBar, RightPanel, KeyboardShortcuts, QUICKSTART.md

### Terminal Area
- **Enhanced empty state** — Animated logo, keyboard shortcuts grid (Ctrl+Shift+T, Ctrl+B, Ctrl+Shift+O, Ctrl+?), clickable "All Shortcuts" link

### SubFrame Health Panel
- **Uninstall moved to top** — Collapsible uninstall section now appears above component groups for easier access

### Build System
- **esbuild platform change** — Switched from `platform: 'node'` to `platform: 'browser'` + `format: 'iife'` for the renderer bundle
  - Fixes `style-mod.js` collision with read-only `window.top` (IIFE scoping)
  - Fixes `@lezer/highlight` initialization order bug (ESM live bindings vs CJS snapshots)
  - `external: ['electron']` preserves `require('electron')` for Electron's nodeIntegration

### Internal
- Extended `FullViewContent` type: added `'stats'` and `'decisions'` variants
- TerminalArea refactored title mapping from nested ternary to `Record<string, string>` lookup
- STRUCTURE.json regenerated (74 modules)

---

## 2026-03-01 — SubFrame Project Enhancement Lifecycle

### Install
- Project init now deploys Claude Code hooks: `.subframe/hooks/session-start.js`, `prompt-submit.js`, `stop.js`
- Init merges hook configuration into `.claude/settings.json` (preserves existing settings)
- New `claudeHooks` init option (default `true`) — hooks are deployed alongside git hooks
- Both `.ts` and `.js` (CJS fallback) init chains updated

### Status (Health Panel)
- New `subframeHealth.ts` module: component registry (15 entries, 4 categories) + health checking
- `claudeSettingsUtils.ts`: safe read/write/merge/remove of `.claude/settings.json`
- Overview panel shows HealthCard with healthy/total count and per-category breakdown
- New SubFrame Health right panel: per-component status (Healthy/Outdated/Missing), Update buttons

### Update
- Content comparison for hooks/git files detects outdated deployments
- Per-component and "Update All" regeneration from templates
- Claude settings re-merge for hook config updates

### Uninstall
- Safe removal with dry-run preview
- Granular options: Claude hooks, git hooks, backlinks, AGENTS.md, .subframe/ directory
- User data files (tasks.json, PROJECT_NOTES.md) preserved with warnings
- Workspace status updated after uninstall

### Testing
- 38 new tests: `claudeSettingsUtils.test.ts` (23 tests), `subframeHealth.test.ts` (16 tests)
- Vitest config: `resolve.extensions` prioritizes `.ts` over stale `.js` during tests
- All 75 tests pass, 0 errors

### CJS Sync
- `frameConstants.js` synced: added `SUBFRAME_HOOKS_DIR` and 4 new `FRAME_FILES` entries
- `frameTemplates.js` synced: 4 new template functions, pre-commit TS extension fix, ESM import parsing
- `projectInit.js` synced: Claude hooks deployment logic
- New `claudeSettingsUtils.js`: CJS fallback for CLI init chain

---

## 2026-03-01 — Quality Infrastructure & Documentation Overhaul

### Quality & Testing
- Vitest test suite: 36 tests across 2 suites (`tests/shared/backlinkUtils.test.ts`, `tests/shared/frameConstants.test.ts`)
- ESLint 9 + TypeScript-ESLint configured (`eslint.config.mjs`) — pinned to ESLint 9 (react-hooks plugin peer dep)
- Prettier configured for consistent formatting (`.prettierrc`)
- GitHub Actions CI workflow (typecheck + lint + test on push/PR) — uses `--ignore-scripts` to skip native modules
- Pre-commit hook updated: runs `npm run typecheck` before allowing commits, includes skip hint
- `tsconfig.test.json` added so test files are type-checked
- New scripts: `npm test`, `npm run lint`, `npm run check` (all quality gates)

### Code Review Fixes
- `vitest.config.ts`: fixed `__dirname` (CJS) → `fileURLToPath` (ESM)
- `update-structure.js`: function regex handles TypeScript generics `<T>`, `isExcluded` uses path segment matching, `getDeletedFiles` filters excluded paths
- `frameConstants.js` synced with `.ts` (CJS fallback had diverged — missing `path.join` prefixes and `DOCS_INTERNAL` key)
- `workspace.ts`: `let baseSlug` → `const baseSlug` (was only ESLint error)

### Documentation
- `docs-internal/refs/ipc-channels.md` regenerated: 93 → 112 channels (19 were missing), all patterns verified against type maps
- `docs-internal/` populated: 6 ADRs, architecture overview, changelog, IPC reference
- CLAUDE.md updated with quality tooling commands and `docs-internal/` reference
- PROJECT_NOTES.md updated with session decisions (Vitest, ESLint 9, CI strategy, ADR adoption)
- STRUCTURE.json regenerated: 65 → 66 modules (after review fixes)

---

## 2026-03-01 — React + TypeScript Refactor & Documentation Overhaul

### Architecture
- Full renderer refactor from vanilla JS to React 19 + TypeScript (strict)
- Zustand stores replace global state variables (`useUIStore`, `useProjectStore`, `useTerminalStore`)
- TanStack Query replaces manual IPC data fetching with cached hooks
- Tailwind CSS v4 replaces 7,158 lines of hand-written CSS
- shadcn/ui components replace custom HTML elements
- Framer Motion added for panel animations

### Main Process
- All 20 manager modules converted from JavaScript to TypeScript
- Same `init()` + `setupIPC()` pattern preserved
- Typed IPC channels via `ipcChannels.ts`

### Tooling
- `update-structure.js` updated to parse TypeScript `import`/`export` syntax
- STRUCTURE.json now includes renderer components, hooks, stores, and lib modules (65 total, up from 6)
- Architecture entry points auto-detected (`.ts`/`.tsx`)
- `npm run watch` added for React-only development

### Documentation
- `docs-internal/` populated with 6 ADRs, architecture overview, and this changelog
- CLAUDE.md updated with missing modules (`KeyboardShortcuts`, `HistoryPanel`, `useIPCListener`, `backlinkUtils`, `lib/`)
- STRUCTURE.json description updated from "Claude Code IDE" to "SubFrame"

---

## 2026-02-28 — CLAUDE.md Rearchitecture (Symlinks → Backlinks)

### Architecture
- Replaced symlink approach (`GEMINI.md → AGENTS.md`) with backlink injection
- `backlinkUtils.ts` created to programmatically inject/update backlink blocks
- `<!-- SUBFRAME:BEGIN --> ... <!-- SUBFRAME:END -->` markers in CLAUDE.md and GEMINI.md
- Each tool-specific file can now have custom content alongside shared SubFrame rules

---

## 2026-02-16 — Sessions Tab & SubFrame Server Planning

### Features
- Claude Sessions tab added to right panel (scans `~/.claude/projects/` for `.jsonl` files)
- Session state detection: active (< 2 min), recent (< 1 hour), inactive
- Split resume button with dropdown (default tool, claude, claude --continue, custom)
- Collapsible right panel (44px icon strip mode)

### Planning
- SubFrame Server (browser mode) technical architecture defined
- Transport layer abstraction designed (IPC ↔ WebSocket)

---

## 2026-02-08 — Gemini CLI Integration

### Features
- Gemini CLI added as supported AI tool
- GEMINI.md created with backlink to AGENTS.md
- Menu commands for Gemini (Memory, Compress Context, Settings)

### Infrastructure
- Node.js minimum version bumped to 20 (required by Gemini CLI's `string-width` dependency)

---

## 2026-02-05 — AI Tool Context Injection

### Architecture
- Wrapper script system created (`.subframe/bin/`)
- Codex CLI wrapper sends "Read AGENTS.md" as initial prompt
- Framework for adding new AI tool wrappers

---

## 2026-01-25 — Project Navigation System

### Features
- `STRUCTURE.json` auto-updater (`scripts/update-structure.js`)
- Intent index for fast module lookup by feature name
- `find-module.js` CLI for quick file discovery

---

## 2025-12-01 — Initial Release (v0.1.0-beta.1)

### Core
- Electron-based terminal IDE for Claude Code
- Multi-terminal support (tabs + grid layout)
- File explorer with tree view
- Code editor (Monaco-based)
- SubFrame project system (STRUCTURE.json, tasks.json, PROJECT_NOTES.md)
- Sub-task management CLI (`scripts/task.js`)
- Plugin system
- GitHub integration panel
- AI Files panel
- Prompt history logging
- Keyboard shortcuts system
- Settings panel with persistence
