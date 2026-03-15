# SubFrame - Project Documentation

## Project Vision

**Problem:** When developing with Claude Code, there's no need for tools like VS Code or Cursor - they are designed for writing code manually. But when staying in the terminal:
- Projects remain disorganized
- Context is lost between sessions
- Decisions are forgotten
- There's no standardization

**Solution:** SubFrame - a terminal-centric development framework. Not an IDE, but a **framework**.

**Why "SubFrame":** Within SubFrame, we create "SubFrame projects" - with standard documents (CLAUDE.md, tasks.json, STRUCTURE.json), every project has the same structure.

**Core Philosophy:**
- **Terminal-first:** The center is not a code editor, but the terminal. Even multiple terminals (grid).
- **Claude Code-native:** This tool is for those who develop with Claude Code.
- **Standardization:** Every project has the same structure, the same documents.
- **Context preservation:** Session notes, decisions, tasks - nothing should be lost.
- **Manageability:** All projects can be viewed and managed from one place.

**Target User:** Developers who do daily development with Claude Code, working terminal-focused.

**What SubFrame is NOT:**
- Not a code editor (there's a file editor but it's not central)
- Not a VS Code/Cursor alternative
- Not optimized for writing code manually

---

## Project Summary
IDE-style desktop application for Claude Code. Features a 3-panel layout with project explorer, multi-terminal support (tabs/grid), file editor, and prompt history.

**App Name:** SubFrame (formerly Claude Code IDE)

---

## Tech Stack

### Core
- **Electron** (v28.0.0): Cross-platform desktop framework
- **xterm.js** (v5.3.0): Terminal emulator (same as VS Code)
- **node-pty** (v1.0.0): PTY management for real terminal experience
- **esbuild**: Fast bundling for modular renderer code

### Why These Technologies?
- **Electron**: Single codebase for Windows, macOS, Linux
- **xterm.js**: Full ANSI support, progress bars, VT100 emulation
- **node-pty**: Real PTY for interactive CLI tools like Claude Code
- **esbuild**: Sub-second builds, ES module support

---

## Architecture

### Modular Structure

```
src/
├── main/                    # Electron Main Process (Node.js)
│   ├── index.js            # Window creation, IPC handlers
│   ├── pty.js              # Single PTY (backward compat)
│   └── ptyManager.js       # Multi-PTY management
│
├── renderer/               # Electron Renderer (bundled by esbuild)
│   ├── index.js           # Entry point
│   ├── terminal.js        # Terminal API (backward compat)
│   ├── terminalManager.js # Multi-terminal state management
│   ├── terminalTabBar.js  # Tab bar UI component
│   ├── terminalGrid.js    # Grid layout UI component
│   ├── multiTerminalUI.js # Orchestrator for terminal UI
│   └── editor.js          # File editor overlay
│
└── shared/                 # Shared between main & renderer
    └── ipcChannels.js     # IPC channel constants
```

### Build System

```bash
# esbuild bundles renderer modules
npm run build:renderer  # One-time build
npm run watch:renderer  # Watch mode for dev
npm start              # Builds + starts app
```

**esbuild.config.js:**
- Entry: `src/renderer/index.js`
- Output: `dist/renderer.bundle.js`
- Platform: browser
- Bundle: true (includes all imports)

### Process Architecture

```
┌─────────────────────────────────────────────────────────┐
│           Electron Main Process (Node.js)                │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ PTY Manager  │  │ File System  │  │ Prompt Logger│  │
│  │ Map<id,pty>  │  │ (fs module)  │  │ (history.txt)│  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                          │
│                    IPC Channels                          │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────────┐
│           Electron Renderer (Browser)                    │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │              MultiTerminalUI                      │   │
│  │  ┌────────────┐ ┌───────────┐ ┌───────────────┐  │   │
│  │  │  TabBar    │ │   Grid    │ │TerminalManager│  │   │
│  │  └────────────┘ └───────────┘ └───────────────┘  │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌────────────┬──────────────┬────────────────┐         │
│  │  Sidebar   │  Terminals   │  History Panel │         │
│  │ (FileTree) │  (xterm.js)  │                │         │
│  └────────────┴──────────────┴────────────────┘         │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │              File Editor Overlay                  │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Startup Flow

```
app.whenReady()
  │
  ├─ createSplash() — frameless BrowserWindow, data: URL (instant)
  │    Identical branding: amber dot, "SubFrame" text, progress bar
  │
  ├─ createWindow() — main BrowserWindow (show: false)
  │    │  Loads index.html (external CSS, fonts, scripts)
  │    │
  │    ├─ DOMContentLoaded → initCritical()
  │    │    Terminal structure, state, project list, sidebar, shortcuts
  │    │
  │    ├─ requestAnimationFrame → initDeferred()
  │    │    File tree, editor, hidden panels (tasks, plugins, GitHub, settings)
  │    │    Then: fade out in-app loading overlay (#app-loading)
  │    │
  │    └─ ready-to-show → mainWindow.show(), splashWindow.close()
  │
  └─ Window state persistence
       Reads: {userData}/window-state.json on launch
       Writes: bounds + isMaximized on close
       Validates: bounds are on a visible display
```

**Design rationale:** Splash uses `data:` URL (zero I/O) and `frame: false` for
instant display. Two-phase renderer init yields to the browser between phases so
CSS layout can reflow (fixes maximize freeze). `DOMContentLoaded` instead of
`window.load` avoids waiting for CDN resources (Google Fonts, D3.js).

---

## Features

### 1. Multi-Terminal System

**Components:**
- `ptyManager.js` - Main process: Manages Map of PTY instances
- `terminalManager.js` - Renderer: Manages xterm.js instances
- `terminalTabBar.js` - Tab UI with new/close/rename
- `terminalGrid.js` - Grid layout with resizable cells
- `multiTerminalUI.js` - Orchestrates all components

**View Modes:**
- **Tabs** (default): Single terminal with tab switching
- **Grid**: Multiple terminals visible (2x1, 2x2, 3x1, 3x2, 3x3)

**Features:**
- Maximum 9 terminals
- New terminals open in home directory
- Double-click tab to rename
- Resizable grid cells
- Keyboard shortcuts for navigation

**IPC Channels:**
```javascript
TERMINAL_CREATE: 'terminal-create',
TERMINAL_CREATED: 'terminal-created',
TERMINAL_DESTROY: 'terminal-destroy',
TERMINAL_DESTROYED: 'terminal-destroyed',
TERMINAL_INPUT_ID: 'terminal-input-id',
TERMINAL_OUTPUT_ID: 'terminal-output-id',
TERMINAL_RESIZE_ID: 'terminal-resize-id',
```

### 2. File Editor

**Component:** `editor.js`

- Overlay editor for quick file viewing/editing
- Opens on file click in tree
- Save with button or close with Escape
- Monaco-style dark theme

### 3. Project Explorer

- Collapsible file tree (5 levels deep)
- Filters: node_modules, hidden files
- Icons: folders, JS, JSON, MD files
- Alphabetical sort (folders first)

### 4. Prompt History

- Logs all terminal input with timestamps
- Side panel toggle (Ctrl+Shift+H)
- Persisted to user data directory

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+K | Start Claude Code |
| Ctrl+I | Run /init |
| Ctrl+Shift+C | Run /commit |
| Ctrl+H | Open history file |
| Ctrl+Shift+H | Toggle history panel |
| Ctrl+Shift+T | New terminal |
| Ctrl+Shift+W | Close terminal |
| Ctrl+Tab | Next terminal |
| Ctrl+Shift+Tab | Previous terminal |
| Ctrl+1-9 | Switch to terminal N |
| Ctrl+Shift+G | Toggle grid view |

---

## Implementation Details

### Multi-Terminal State Flow

```
User clicks [+]
    │
    ▼
 TerminalTabBar.createTerminal()
    │
    ▼
 TerminalManager.createTerminal()
    │
    ├─── Send IPC: TERMINAL_CREATE
    │
    ▼
Main Process: ptyManager.createTerminal()
    │
    ├─── Create new PTY instance
    ├─── Add to Map<terminalId, pty>
    ├─── Setup output listener
    │
    ▼
Send IPC: TERMINAL_CREATED { terminalId }
    │
    ▼
 TerminalManager._initializeTerminal()
    │
    ├─── Create xterm.js instance
    ├─── Create FitAddon
    ├─── Add to terminals Map
    │
    ▼
MultiTerminalUI._onStateChange()
    │
    ├─── Update TabBar
    └─── Render active terminal
```

### Grid View Implementation

```javascript
// CSS Grid based layout
const GRID_LAYOUTS = {
  '2x1': { rows: 2, cols: 1 },
  '2x2': { rows: 2, cols: 2 },
  '3x1': { rows: 3, cols: 1 },
  '3x2': { rows: 3, cols: 2 },
  '3x3': { rows: 3, cols: 3 }
};

// Each cell contains:
// - Header (name + close button)
// - Terminal content area
// - Resize handles (right, bottom)
```

### View Mode Switching

**Important:** When switching from grid to tab view, all inline grid styles must be cleared:

```javascript
_renderTabView(state) {
  this.contentContainer.innerHTML = '';
  this.contentContainer.className = 'terminal-content tab-view';
  // Clear grid inline styles
  this.contentContainer.style.display = '';
  this.contentContainer.style.gridTemplateRows = '';
  this.contentContainer.style.gridTemplateColumns = '';
  this.contentContainer.style.gap = '';
  this.contentContainer.style.backgroundColor = '';
  // ... mount active terminal
}
```

---

## Development Notes

### Adding New Terminal Feature

1. Add IPC channel in `src/shared/ipcChannels.js`
2. Add handler in `src/main/ptyManager.js`
3. Register IPC in `src/main/index.js`
4. Add UI in renderer module
5. Build: `npm run build:renderer`

### Adding New Panel

1. Add HTML structure in `index.html`
2. Add CSS styles
3. Create module in `src/renderer/`
4. Import in `src/renderer/index.js`
5. Build with esbuild

### Debug Mode

```javascript
// In src/main/index.js
mainWindow.webContents.openDevTools();
```

---

## Lessons Learned

### 1. PTY vs Subprocess
- subprocess.Popen insufficient for interactive CLIs
- node-pty provides real terminal (TTY detection, ANSI, signals)

### 2. Multi-Terminal Architecture
- Each terminal needs unique ID for routing
- Main process manages PTY lifecycle
- Renderer manages xterm.js instances
- State changes trigger UI updates

### 3. CSS Grid for Terminal Layout
- Grid provides flexible multi-terminal layouts
- Must clear inline styles when switching views
- FitAddon.fit() needed after layout changes

### 4. esbuild for Modularity
- Fast bundling enables modular development
- CommonJS require() works in bundled output
- Single bundle simplifies Electron loading

---

## Roadmap

### Completed
- [x] IDE layout (3 panel)
- [x] File tree explorer
- [x] Prompt history panel
- [x] Modular architecture (esbuild)
- [x] Multi-terminal (tabs)
- [x] Multi-terminal (grid view)
- [x] Grid cell resize
- [x] Terminal rename
- [x] File editor overlay
- [x] Resizable sidebar
- [x] Settings panel
- [x] Git integration (branches panel)
- [x] Project renaming
- [x] Custom AI tool start command
- [x] Cross-platform Windows support
- [x] Terminal scroll-to-bottom button
- [x] Tasks panel with real-time updates
- [x] Plugins panel
- [x] Claude sessions panel
- [x] Overview dashboard
- [x] Automated Windows dev setup (DEV_SETUP.bat)
- [x] Multi-workspace support (create, switch, rename, delete)
- [x] Session grouping by conversation chain (slug)
- [x] Session custom titles (customTitle from Claude Code)
- [x] Sidebar restructure (workspace-first layout)

### Short-term
- [ ] Search in files
- [ ] Theme customization

### Medium-term
- [ ] Full Claude chat sidebar
- [ ] Extensions/plugins
- [ ] Remote development (SSH)

### Future Vision
- Auto-documentation (SESSION_LOG.md, DECISIONS.md)
- Claude API integration for context optimization
- Session timeline view
- **SubFrame Server (Web App mode)** — Run SubFrame on headless server, access via browser (like code-server)

---

## File Reference

| File | Purpose |
|------|---------|
| `src/main/index.js` | Main process, window, IPC |
| `src/main/ptyManager.js` | Multi-PTY management |
| `src/main/pty.js` | Single PTY (backward compat) |
| `src/renderer/index.js` | Renderer entry point |
| `src/renderer/terminal.js` | Terminal API wrapper |
| `src/renderer/terminalManager.js` | Terminal state management |
| `src/renderer/terminalTabBar.js` | Tab bar UI |
| `src/renderer/terminalGrid.js` | Grid layout UI |
| `src/renderer/multiTerminalUI.js` | Terminal UI orchestrator |
| `src/renderer/editor.js` | File editor overlay |
| `src/shared/ipcChannels.js` | IPC channel constants |
| `index.html` | UI layout + CSS |
| `esbuild.config.js` | Bundler config |

---

**Project Start:** 2026-01-21
**Last Updated:** 2026-03-01
**Status:** Multi-workspace UI, sidebar restructure, session grouping by conversation chain

---

## Session Notes

### [2026-03-14] Pop-Out Terminal Architecture

**Context:** Users working with multi-monitor setups need to detach terminals from the main window to watch agent output on a second screen while working in the main app.

**Decision:** Hub-and-spoke model — PTY lives in the main process, pop-out windows are independent `BrowserWindow`s that load the same `index.html` in a minimal mode (detected via URL hash). Main process routes terminal events to whichever windows need them.

**Key architectural choices:**
- **Prewarmed hidden window** eliminates cold-start latency — a standby `BrowserWindow` pre-loads the full renderer bundle at startup, activated via `POPOUT_ACTIVATE` IPC when the user pops out. New prewarm scheduled 1s after each use.
- **Output routing via `addOutputHandler`** — the existing named handler system in ptyManager forwards PTY data to pop-out windows without modifying the core `onData` path.
- **Both renderers have their own xterm instance** — the main window's xterm accumulates scrollback in its off-screen holder, so docking back is seamless with full history.
- **Race condition guards** — stale destroyed-window cleanup before creating new entries, `closed`-event identity check (`popoutWindows.get(id) === win`), and `window-all-closed` guard via `getOpenCount()`.

**Files:** `src/main/popoutManager.ts`, `src/renderer/components/PopoutTerminal.tsx`, `src/main/ptyManager.ts` (broadcast helpers)

### [2026-03-01] Claude Code Skills as Deployable Components

**Context:** SubFrame's 3 universal skills (`/sub-tasks`, `/sub-docs`, `/sub-audit`) only existed in SubFrame's own `.claude/skills/` directory. Projects initialized by SubFrame didn't get these skills deployed.

**Decision:** Make skills a first-class deployable component — same lifecycle as hooks (deploy on init, track in health panel, update when outdated, remove on uninstall). New `'skills'` category added to the component registry (18 total components across 5 categories).

**Key architectural choices:**
- Deployed `/sub-tasks` uses direct `.subframe/tasks/*.md` file manipulation instead of `node scripts/task.js` (CLI only exists in SubFrame app, not deployed projects)
- `/sub-docs` and `/sub-audit` generalized to remove SubFrame-app-specific references (no `/sub-ipc`, no hardcoded file lists)
- Skills deployed to `.claude/skills/` — updated AI Files panel description to reflect SubFrame now writes to `.claude/`
- Content-comparison health checks via `getTemplate()` — same pattern as hooks

**Files:** `frameConstants.ts`, `frameTemplates.ts`, `ipcChannels.ts`, `subframeHealth.ts`, `projectInit.ts`, `frameProject.ts`, `SubFrameHealthPanel.tsx`, `OverviewPanel.tsx`, `AIFilesPanel.tsx` (+ CJS mirrors)

---

### CodeMirror 6 for Built-in Editor
**Date:** 2026-03-01
**Decision:** Chose CodeMirror 6 over Monaco Editor for the built-in file editor.
**Rationale:** Native esbuild compatibility (no workers needed), ~500KB vs 5-10MB bundle, zero Electron configuration (no CDN/AMD conflicts), modular extension system. Obsidian (similar Electron app) uses CM6 as precedent.
**Features:** Syntax highlighting (20+ languages via Lezer parser), minimap (@replit/codemirror-minimap), autocomplete, find/replace, multi-cursor, code folding, bracket matching, JSON linting, custom SubFrame dark theme.
**Files:** `src/renderer/lib/codemirror-theme.ts`, `src/renderer/lib/codemirror-extensions.ts`, `src/renderer/components/Editor.tsx`

---

### [2026-03-01] SubFrame Project Enhancement Lifecycle (Install → Status → Update → Uninstall)

**Context:** SubFrame initializes projects with documentation files, task tracking, and git hooks — but the Claude Code hooks (session-start context injection, prompt fuzzy-matching, stop sync-check) were NOT deployed to initialized projects. Every SubFrame project outside of SubFrame's own repo was vulnerable to drift. No way to check what's installed, update outdated components, or cleanly remove SubFrame.

**Decision:** Merge three pending sub-tasks into one coherent feature covering the full lifecycle. Component registry pattern: 15 deployable components across 4 categories (core, hooks, claude-integration, git), each with existence-only or content-comparison checks.

**Key architectural choices:**
- SubFrame hooks identified by `.subframe/hooks/` prefix in command field — unambiguous detection for safe merge/remove without touching user hooks
- `claudeSettingsUtils.ts` handles all `.claude/settings.json` manipulation — read/write/merge/remove as pure functions
- `subframeHealth.ts` uses component registry pattern — each entry defines what to check, where, and how to verify currency
- Uninstall supports dry-run mode — preview what would be removed before committing
- CJS fallback chain (`scripts/init.js` → `projectInit.js` → `frameTemplates.js`) synced with TS versions

**Stale `.js` discovery:** Vitest loaded `.js` files over `.ts` when both existed (standard Node resolution). Fixed with `resolve.extensions: ['.ts', '.tsx', '.js', '.jsx', '.json']` in vitest config. Root cause: legacy CJS files from pre-TypeScript era coexist with `.ts` during migration.

---

### [2026-03-01] Multi-Workspace UI, Sidebar Restructure & Session Grouping

**Context:** The `workspaces.json` data model already supported multiple workspaces (`activeWorkspace` + `workspaces` object) but the UI was locked to "default" with no way to create, switch, rename, or delete workspaces. Additionally, the sidebar had redundant elements and the sessions panel showed every `.jsonl` file as a separate entry.

**Multi-workspace feature:**
- 6 new IPC channels: `WORKSPACE_LIST`, `WORKSPACE_SWITCH`, `WORKSPACE_CREATE`, `WORKSPACE_RENAME`, `WORKSPACE_DELETE` (all use `ipcMain.handle` async invoke pattern)
- Backend (`workspace.js`): Added `slugify()`, `getWorkspaceList()`, `switchWorkspace()`, `createWorkspace()`, `renameWorkspace()`, `deleteWorkspace()`; updated `getProjectsWithScanned()` to return `{ projects, workspaceName }`
- Renderer (`projectListUI.js`): Custom `.ws-dropdown` component (native `<select>` was unstyled on Windows), `⋮` more button for workspace management, inline editing for rename (since `window.prompt()` returns null silently in Electron)
- Flat project list model: only workspace projects shown in main list; discovered projects available via `+` add-project dropdown
- `loadWorkspace()` guard for missing `activeWorkspace` (falls back to 'default')

**Sidebar restructure:**
- Removed `#projects-header` (collapse chevron, "Projects" label, info tooltip, `+` button), `#project-info`, `btn-select-project`, `btn-create-project`
- Workspace selector row at top, flat project list in middle, actions (Start Claude Code, Initialize as SubFrame) at bottom
- `+` add-project button moved into workspace selector row (dynamically created by `projectListUI.js`)
- Add-project dropdown now includes "Create New Project..." option (since standalone button was removed)
- Removed `_initCollapsibleProjects()`, `_initInfoTooltip()`, and ~120 lines of dead CSS

**Session grouping by slug:**
- Claude Code's `.jsonl` files use a `slug` field (e.g., "vast-painting-quiche") as a conversation chain identifier — all continuations share the same slug
- Added `groupSessionsBySlug()` to `claudeSessionsManager.js`: merges files with same slug into one entry, sums message counts, uses newest `sessionId` for resume, oldest `firstPrompt` for context
- Also discovered `customTitle` field (`{"type": "custom-title", "customTitle": "Main"}`) — user-set session names stored in `.jsonl`
- Session display priority: `customTitle` > `firstPrompt` > `slug` > "Untitled session"
- When `customTitle` is set, `firstPrompt` shows as a muted subtitle for context
- Grouped sessions show "N parts" in metadata

**Key Electron lessons:**
- `window.prompt()` does NOT work in Electron (returns null silently) — use inline editing instead
- `window.alert()` and `window.confirm()` DO work
- Native `<select>` on Windows swallows right-click/contextmenu events — use custom dropdown components

---

### [2026-03-01] Real-Time Agent State Visualization — Ports & Adapters Architecture

**Context:** Users wanted to see what Claude Code is doing in real time — which tool it's using, what file it's reading, what command it's running — directly in SubFrame's UI. The `claude-code-by-agents` project demonstrated this with React Flow visualizations, but SubFrame needed a lighter, sidebar-friendly approach.

**Decision:** Implement a "Ports & Adapters" architecture where Claude Code hooks (adapters) write to a generic `.subframe/agent-state.json` file (the port), and the renderer only depends on the port's schema. This allows adding support for other AI tools (Gemini, Copilot) by writing new adapter hooks without touching the UI.

**Key architectural choices:**
- Claude Code `PreToolUse`/`PostToolUse` hooks write running/completed steps to `agent-state.json` — each hook reads stdin JSON, updates state, outputs nothing
- Main process `agentStateManager.ts` watches `.subframe/` directory (not the file — more reliable cross-platform) with 200ms debounce and `lastUpdated` dedup
- Renderer `useAgentState` hook uses send/on IPC pattern with TanStack Query cache — IPC listener registered with empty deps to avoid race condition where response arrives before listener setup
- Three UI layers: `SidebarAgentStatus` (pulsing dot), `AgentStateView` panel (compact timeline), `AgentStateView` full-view (session list + detail)
- 5-minute stale session cleanup prevents ghost "active" sessions from hard kills
- Windows-safe atomic writes: `renameSync` with fallback to direct `writeFileSync` when file is locked

**Files:** `src/shared/agentStateTypes.ts`, `src/main/agentStateManager.ts`, `src/renderer/hooks/useAgentState.ts`, `src/renderer/components/AgentStateView.tsx`, `src/renderer/components/AgentTimeline.tsx`, `src/renderer/components/SidebarAgentStatus.tsx`, `.subframe/hooks/pre-tool-use.js`, `.subframe/hooks/post-tool-use.js`

---

### [2026-02-28] CLAUDE.md Rearchitecture — From Symlinks to Independent Files with Backlink Injection

**Context:** The original init flow created `CLAUDE.md` and `GEMINI.md` as symlinks pointing to `AGENTS.md`. This caused problems: symlinks require elevated permissions on Windows, users couldn't add their own tool-specific instructions to CLAUDE.md without editing the shared AGENTS.md, and it conflicted with the philosophy that native AI files belong to the user.

**Decision:** Replace the symlink approach with independent native files that contain a small backlink reference to AGENTS.md. The backlink is wrapped in HTML comment markers (`<!-- SUBFRAME:BEGIN -->` / `<!-- SUBFRAME:END -->`) so SubFrame can manage its own section without touching user content.

**What changed:**
- `frameProject.js` init flow now creates real CLAUDE.md and GEMINI.md files (not symlinks) with a backlink block referencing AGENTS.md
- `backlinkUtils.js` added — shared utilities for injecting/removing/detecting the backlink block
- `aiFilesManager.js` added — IPC handlers for backlink injection, removal, symlink migration, and file status checks
- `aiFilesPanel.js` added — renderer UI showing status of CLAUDE.md/GEMINI.md with action buttons (inject, remove, create, migrate)
- Existing symlinks are detected and can be migrated to real files via the UI
- `config.json` template updated: `claudeSymlink` key renamed to `claude`
- All documentation updated to replace "symlink" language with "backlink reference"

**Design philosophy established:** "Enhance, not replace." SubFrame builds on top of native AI tools — it never takes over their files or conflicts with their features. CLAUDE.md and GEMINI.md are user-owned. SubFrame only injects a small reference. When native tools add new features, SubFrame supports and integrates.

---

### [2026-01-25] Project Navigation System

**Context:** When Claude Code enters a project, it needs to quickly capture the context.

**Decision:** The trio of STRUCTURE.json + PROJECT_NOTES.md + tasks.json.

**Implementation:**
1. "Project Navigation" section in CLAUDE.md - files to read at session start
2. STRUCTURE.json - module map, architectureNotes
3. Pre-commit hook - STRUCTURE.json updates automatically

**[2026-01-26 Update]:**
- "Token Efficiency Protocol" claim removed (wasn't realistic)
- Line numbers removed (constantly changing, hard to maintain)
- Format simplified - now more practical

---

### [2026-01-25] Task Delegation to Claude Code

**Context:** We wanted to automatically send tasks to Claude Code when pressing the play button in the Tasks panel.

**Decision:**
- Play (▶) button sends the task to Claude Code as a prompt
- If Claude Code is not running, the `claude` command is sent first, waits 2 seconds, then the task is sent

**Implementation:**
- `tasksPanel.js` → `sendTaskToClaude()` function
- Sending to terminal via `terminal.sendCommand()`
- `claudeCodeRunning` state tracking

**Future improvement:** Detecting if Claude Code is actually running by parsing terminal output (task-claude-detect).

---

### [2026-01-25] Pre-commit Hook for STRUCTURE.json

**Context:** Manually updating STRUCTURE.json is difficult and gets forgotten.

**Decision:** Automatic update with Git pre-commit hook.

**Implementation:**
```bash
# .githooks/pre-commit
STAGED_JS=$(git diff --cached --name-only --diff-filter=ACMRD | grep '\.js$')
if [ -n "$STAGED_JS" ]; then
    npm run structure:changed
    git add STRUCTURE.json
fi
```

**Advantage:** Only changed files are parsed (git diff based), the entire project is not scanned.

---

### [2026-01-25] Task Action UX Improvement

**Context:** Changing task status with a checkbox was confusing - users couldn't understand what would happen.

**Decision:** Explicit action buttons instead of checkbox:
- Pending: ▶ Start, ✓ Complete
- In Progress: ✓ Complete, ⏸ Pause
- Completed: ↺ Reopen

**Addition:** Toast notification system added - feedback like "Task started", "Task completed".

---

### [2026-01-26] SubFrame Vision & Context Preservation Feature

**User's explanation:**

> "My problem was this, yes I can develop with claude code. but I only stay in the terminal. I don't feel the need to use a platform like vs code or cursor. because those are tools designed for writing code manually. I don't need such complexity. I need standardization and manageability for my projects. I'm terminal and claude code focused. that's why SubFrame's center is not a code editor, but a terminal, we even have a multi-terminal structure with grid. That's why the name is SubFrame. this is a framework, so we create a SubFrame project within SubFrame, we create these documents to set a standard. so that I can see the projects I develop with claude code in an organized way. so I don't lose context, I note down what's written in sessions."

**SubFrame's True Purpose:**
- Terminal-centric (not a code editor)
- Claude Code-native development
- Standardization across projects
- Preventing context loss
- Tracking session notes and decisions

**Context Preservation Feature Design:**

User: "we shouldn't end session... when we reach a decision, when we say let's do it, maybe when the work is successful we should ask the user, should we add this to notes? because automatically deciding the importance mechanism would be very difficult. we can leave the importance decision to the user. you ask, if they say add, you add, but there should be added exactly as discussed with the user, not a summary."

**Decisions Made:**
1. NO "End session" button/flow - it should be organic
2. When a task/decision is completed, Claude will ask: "Should I add this to PROJECT_NOTES?"
3. Importance decision is with the user - Claude only suggests
4. NOT a summary, the conversation should be added as is (context must be preserved)
5. Should not be asked for every small thing (it becomes spam)

**Completion Detection:**
- User approval: "okay", "done", "it worked", "nice"
- Topic change
- Build/run success

**Implementation:**
- "Context Preservation" section added to CLAUDE.md
- Template in frameTemplates.js updated (for new projects)

**First Implementation:** This note was the first use of this feature. Claude asked "should I add?", the user said "yes", and this note was added.

---

### [2026-01-26] CLAUDE.md Simplification and "Only Requested Changes" Lesson

**Context:** The user requested:
- Remove Token Efficiency claims (80-90% savings wasn't realistic)
- Remove line numbers (hard to maintain)
- Make PROJECT_NOTES format free-form (instead of formal table)

**What happened:**
Claude deleted too much in the first attempt - removed important content under the name of simplification:
- Details of task rules
- "When to Update?" sections
- Update flows

The user warned: "actually everything you deleted in the claude.md file was important. we didn't make a complete simplification decision there. our requests were clear."

**Solution:**
1. Original file restored from Git
2. Only the 3 requested changes were made:
   - "Token Efficiency Protocol" → "Project Navigation"
   - Line numbers removed
   - Format made free-form
3. All other content preserved

**Lesson:** Simplification ≠ deleting content. Do only what the user asked. Don't delete extra things thinking "I think this is also unnecessary".

---

### [2026-01-30] SubFrame Server Feature Request (Web App Mode)

**Context:** GitHub issue request - user has Windows PC for display and headless Debian machine for development.

**User's request:**
> "I have this requirement too. I have a Windows PC that I want to run this on, but my development machine is a headless debian machine. Come to think of it, exposing it as a web app (like code-server) would be useful too - then I can install this on my headless linux dev box and open it on any browser anywhere and start working. Should be doable since this is electron based, no?"

**Analysis:**
- SubFrame is Electron-based (Chromium + Node.js) - already web technologies
- xterm.js is web-native, works in browser
- Main change needed: IPC → WebSocket communication
- Pattern proven by code-server (VS Code in browser)

**Proposed Architecture:**
```
Electron App                    Web App (SubFrame Server)
─────────────                   ─────────────────────
ipcMain/ipcRenderer    →        Express + WebSocket
Electron window        →        Static HTML server
node-pty (same)                 node-pty (same)
xterm.js (same)                 xterm.js (same)
```

**Decision:** Added to roadmap as "SubFrame Server" - will consider for future development based on community interest.

---

### [2026-02-05] Context Injection for Non-Claude AI Tools (Wrapper Script System)

**Context:** SubFrame supports multiple AI tools (Claude Code, Codex CLI, etc.). Claude Code automatically reads CLAUDE.md, but other tools like Codex CLI don't have this convention. We needed a way to inject project context (AGENTS.md) into these tools.

**Problem discussed:**
- Claude Code → reads CLAUDE.md automatically ✓
- Codex CLI → no standard, context is lost

**Solution explored:**
1. First attempt: Use `--system-prompt` flag → Failed (Codex CLI doesn't have this flag)
2. Final solution: Wrapper script that sends "Read AGENTS.md" as initial prompt

**Implementation:**
- `.subframe/bin/` directory created for AI tool wrappers
- `.subframe/bin/codex` wrapper script:
  - Finds AGENTS.md in project directory
  - Runs `codex "Please read AGENTS.md and follow the project instructions."`
- SubFrame init automatically creates wrapper scripts
- `aiToolManager.js` updated to use wrapper for Codex

**Files changed:**
- `src/shared/frameConstants.js` - Added `FRAME_BIN_DIR`
- `src/shared/frameTemplates.js` - Added `getCodexWrapperTemplate()`, `getGenericWrapperTemplate()`
- `src/main/frameProject.js` - Creates `.subframe/bin/codex` on init
- `src/main/aiToolManager.js` - Codex command points to `./.subframe/bin/codex`

**Key insight:** Instead of trying to pass system prompts via flags (which vary per tool), simply ask the AI to read the AGENTS.md file. This approach is tool-agnostic and works with any AI coding assistant.

**Result:** Codex CLI now reads AGENTS.md on startup, maintaining context preservation across different AI tools.

---

### [2026-02-08] Gemini CLI Integration & Node.js Version Upgrade

**Context:** SubFrame already supported Claude Code and Codex CLI. We reviewed the Codex integration pattern and added Gemini CLI to the same multi-tool infrastructure.

**Architectural decision — Symlink vs Wrapper:**
- Codex CLI required a **wrapper script** (no native file reading support, AGENTS.md is injected via `.subframe/bin/codex`)
- Gemini CLI reads `GEMINI.md` **natively** (just like Claude Code reads CLAUDE.md)
- Originally used symlinks (`GEMINI.md → AGENTS.md`), later rearchitected to independent files with backlink injection (see [2026-02-28] session note)

**Files changed:**
- `src/shared/frameConstants.js` - Added `GEMINI_SYMLINK: 'GEMINI.md'` (later renamed to GEMINI constant)
- `src/main/aiToolManager.js` - Added Gemini CLI tool definition (commands: `/init`, `/model`, `/memory`, `/compress`, `/settings`, `/help`)
- `src/main/frameProject.js` - Creates `GEMINI.md` on SubFrame init (originally symlink, now independent file with backlink)
- `src/main/menu.js` - Added Gemini-specific menu commands: Memory, Compress Context, Settings
- `README.md` - Updated to include Gemini CLI support

**Node.js version issue (important):**
Gemini CLI's dependency `string-width` uses the `/v` regex flag which requires Node.js 20+. With Node.js 18, it threw `SyntaxError: Invalid regular expression flags`.

- Before: Node.js v18.20.8 → Gemini CLI crashed on startup
- After: Node.js v20.20.0 → Issue resolved
- Commands: `nvm install 20` + `nvm alias default 20` + `npm install`
- Impact on SubFrame: None — Electron 28, node-pty, xterm.js all compatible with Node 20
- `nvm alias default 20` is critical — without it, terminals spawned by SubFrame still use the old default version

---

### [2026-02-16] Claude Panel — Sessions Tab

**Context:** The Claude panel only had a "Plugins" tab. The user wanted a "Sessions" tab to browse past Claude Code sessions (similar to `/resume`).

**Data source:** Claude Code stores sessions as individual `.jsonl` files in `~/.claude/projects/{encoded-path}/`. Each file is a JSON Lines file where each line is a JSON object. The first line contains session metadata (`sessionId`, `gitBranch`, `isSidechain`, `cwd`, `timestamp`). User messages have `"type":"user"` with the prompt text in the `message` field.

**Important discovery (2026-02-28):** The original implementation looked for a `sessions-index.json` file that does not exist. Claude Code never creates this file — it stores sessions as individual `.jsonl` files (e.g., `8034b39f-7785-4713-832e-1163e65b2e12.jsonl`). The manager was rewritten to scan `.jsonl` files, parse the first line for metadata, find the first real user message as a summary (skipping system-injected messages like `<local-command-caveat>`, `<command-name>`, `<local-command-stdout>`), strip HTML/XML tags, and use file stat for modification time.

**Session state detection:** Based on file modification recency — `active` (< 2 min), `recent` (< 1 hour), `inactive` (older). Shown as colored dots: green with pulse glow for active, amber for recent, muted gray for inactive.

**Collapsible panel (2026-02-28):** The `>` collapse arrow now shrinks the panel to a 44px icon strip showing Sessions and Plugins icons vertically. Clicking an icon expands the panel to that tab. The `✕` button fully hides the panel. This matches VS Code's sidebar collapse pattern.

**Files changed:**
- `src/shared/ipcChannels.js` — Added `LOAD_CLAUDE_SESSIONS`, `REFRESH_CLAUDE_SESSIONS` channels
- `src/main/claudeSessionsManager.js` — Scans `.jsonl` files, extracts metadata from first line, finds first real user prompt, strips HTML tags, detects session state from modification time
- `src/main/index.js` — Manager registration (setupIPC + init)
- `index.html` — Sessions tab first (with SVG icons), collapsed icon strip, `.claude-expanded-content` wrapper
- `src/renderer/pluginsPanel.js` — Session loading, rendering, collapse/expand logic, split resume button with dropdown (default AI tool, claude, claude --continue, custom), formatRelativeTime
- `src/renderer/styles/components/panels.css` — Session state dots with pulse animation, collapsed strip, resume button group, resume dropdown

**Features:**
- Session list: first user prompt as summary, relative time, branch badge, message count
- State indicators: green pulsing dot (active), amber dot (recent), gray dot (inactive)
- Split resume button: play icon for quick resume (uses configured AI tool command), dropdown arrow for options (default tool, claude, claude --continue, custom command)
- Sessions tab is default (first), Plugins tab second — both with SVG icons
- Collapsible to 44px icon strip with expand-on-click
- Refresh button with spinner animation
- Sidechain sessions marked with a warning-color left border
- HTML/XML tags stripped from session titles
- "No project selected" empty state when no project is active

---

### [2026-02-16] SubFrame Server — Browser Mode Technical Planning

**Context:** Discussion about making SubFrame run in the browser so it can be deployed on a remote server and accessed from any device.

**Why it's feasible:**
- UI is already web technologies (HTML/CSS/JS)
- xterm.js is a native browser component
- node-pty stays server-side, unchanged
- Pattern proven by code-server (VS Code in browser)

**What changes:**
- Electron window → Express/Fastify HTTP server
- IPC (`ipcMain`/`ipcRenderer`) → WebSocket
- Terminal I/O streams over WebSocket
- File system, tasks, etc. stay server-side — only the transport layer changes

**Approach decided:** Transport layer abstraction — create a middle layer that works with both Electron IPC and WebSocket. Single codebase, two modes (desktop + web). This avoids maintaining two separate codebases.

**Deployment model:** SubFrame Server + SSH tunnel is the most practical approach. SubFrame runs on the server, SSH tunnel provides security, browser provides the UI. No separate authentication needed since SSH handles it.

**Steps:**
1. Abstract IPC into a transport layer (supports both Electron IPC and WebSocket)
2. Create Express server that serves the UI and handles WebSocket connections
3. SSH tunnel for secure remote access
4. (Optional) Authentication, HTTPS, multi-user support

**Status:** Planned as the next major feature. Not started yet.

---

### [2026-03-01] React + TypeScript Refactor — Full Implementation Plan

**Context:** SubFrame is being refactored from vanilla JavaScript (imperative DOM manipulation) to a modern React stack. This plan was produced by a 4-agent research team that deeply analyzed the codebase in parallel before synthesizing findings.

**Research completed:**
- Renderer architecture: 20 files, 9,100 lines, all DOM patterns + dependencies mapped
- IPC layer: 154 channels fully traced end-to-end (28 handle, 126 on)
- CSS architecture: 7,158 lines, 41 design tokens, 15 keyframe animations, 913 selectors
- Stack integration: 7 topics researched with working configs confirmed

---

#### Target Stack

| Library | Version | Role |
|---------|---------|------|
| React | 19 | Component architecture |
| TypeScript | 5.x (strict) | Type safety across all layers |
| Zustand | 5.x | UI state (panels, terminals, sidebar) |
| TanStack Query | 5.x | IPC data caching + invalidation |
| TanStack Table | 8.x | Headless tables for tasks + sessions |
| shadcn/ui | latest | Component library (Radix + Tailwind) |
| Tailwind CSS | 4.x | Styling (replaces 6 hand-written CSS files) |
| Framer Motion | 12.x | Animations (panel transitions, list stagger) |
| esbuild | kept | Bundler (sub-second builds preserved) |
| Electron | 33+ | Upgrade from EOL v28 |

---

#### Phase 0 — Scaffold & Config (No Code Changes)

**Goal:** Set up the new toolchain alongside existing code. Nothing breaks.

**0.1 — Branch:**
```bash
git checkout -b feature/react-typescript
```

**0.2 — Install dependencies:**
```bash
# Production
npm i react react-dom zustand @tanstack/react-query @tanstack/react-table framer-motion class-variance-authority clsx tailwind-merge lucide-react tw-animate-css

# Dev
npm i -D typescript @types/react @types/react-dom @types/node tailwindcss @tailwindcss/postcss postcss esbuild-plugin-tailwindcss
```

**0.3 — TypeScript config (3 files):**

`tsconfig.json` (base):
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./src/renderer/*"] }
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["node_modules", "dist"]
}
```

`tsconfig.main.json` (extends base, Node.js target):
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "module": "CommonJS", "outDir": "dist/main" },
  "include": ["src/main/**/*.ts", "src/shared/**/*.ts"]
}
```

`tsconfig.renderer.json` (extends base, browser target):
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "outDir": "dist/renderer", "lib": ["ES2020", "DOM", "DOM.Iterable"] },
  "include": ["src/renderer/**/*.ts", "src/renderer/**/*.tsx", "src/shared/**/*.ts"]
}
```

**0.4 — shadcn/ui config (`components.json`):**
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/renderer/styles/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

**0.5 — Tailwind CSS v4 entry (`src/renderer/styles/globals.css`):**
```css
@import "tailwindcss";
@import "tw-animate-css";

@theme {
  /* SubFrame warm-neutral palette */
  --color-bg-deep: #0f0f10;
  --color-bg-primary: #151516;
  --color-bg-secondary: #1a1a1c;
  --color-bg-tertiary: #222225;
  --color-bg-elevated: #28282c;
  --color-bg-hover: #2e2e33;

  --color-text-primary: #e8e6e3;
  --color-text-secondary: #a09b94;
  --color-text-tertiary: #6b6660;
  --color-text-muted: #4a4642;

  --color-accent: #d4a574;
  --color-accent-secondary: #c9956a;
  --color-accent-subtle: rgba(212, 165, 116, 0.15);

  --color-success: #7cb382;
  --color-warning: #e0a458;
  --color-error: #d47878;
  --color-info: #78a5d4;

  --color-border-subtle: rgba(255, 255, 255, 0.06);
  --color-border-default: rgba(255, 255, 255, 0.08);
  --color-border-strong: rgba(255, 255, 255, 0.12);

  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;

  --font-sans: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: 'JetBrains Mono', 'SF Mono', 'Consolas', monospace;
}
```

**0.6 — Update esbuild config:**
```javascript
import tailwindPlugin from "esbuild-plugin-tailwindcss";

esbuild.build({
  entryPoints: ['src/renderer/index.tsx'],
  bundle: true,
  outfile: 'dist/renderer.js',
  platform: 'node',
  external: ['electron'],
  jsx: 'automatic',
  loader: { '.tsx': 'tsx', '.ts': 'ts' },
  plugins: [tailwindPlugin()],
});
```

**0.7 — Create utility files:**
- `src/renderer/lib/utils.ts` — shadcn `cn()` helper
- `src/renderer/lib/ipc.ts` — typed IPC utilities (see Phase 1)

**0.8 — Install initial shadcn components:**
```bash
npx shadcn@latest add button dialog tabs dropdown-menu context-menu command input textarea badge tooltip separator scroll-area resizable sheet table sonner
```

---

#### Phase 1 — Typed IPC Foundation

**Goal:** Type-safe IPC layer that both old JS and new TSX can consume. Zero UI changes.

**1.1 — Convert `src/shared/ipcChannels.js` → `ipcChannels.ts`:**

Define a typed channel map:
```typescript
export const IPC = {
  TERMINAL_CREATE: 'terminal-create',
  TERMINAL_CREATED: 'terminal-created',
  LOAD_TASKS: 'tasks:load',
  // ... all 154 channels
} as const;

// Type-safe channel → payload → return mapping
export interface IPCHandleMap {
  [IPC.LOAD_SETTINGS]: { args: []; return: Settings };
  [IPC.LOAD_TASKS]: { args: [projectPath: string]; return: TasksData };
  // ... 28 handle channels
}

export interface IPCSendMap {
  [IPC.TERMINAL_INPUT_ID]: { terminalId: string; data: string };
  [IPC.PROJECT_SELECTED]: { projectPath: string };
  // ... 126 send channels
}
```

**1.2 — Create typed IPC utilities (`src/renderer/lib/ipc.ts`):**
```typescript
export function typedInvoke<K extends keyof IPCHandleMap>(
  channel: K, ...args: IPCHandleMap[K]['args']
): Promise<IPCHandleMap[K]['return']> {
  return ipcRenderer.invoke(channel, ...args);
}
```

**1.3 — Create TanStack Query hooks (`src/renderer/hooks/useIpc.ts`):**
```typescript
export function useIpcQuery<K extends keyof IPCHandleMap>(
  channel: K,
  args: IPCHandleMap[K]['args'],
  options?: UseQueryOptions
) {
  return useQuery({
    queryKey: [channel, ...args],
    queryFn: () => typedInvoke(channel, ...args),
    ...options,
  });
}
```

**1.4 — Convert remaining shared modules:**
- `frameConstants.js` → `frameConstants.ts`
- `frameTemplates.js` → `frameTemplates.ts`
- `backlinkUtils.js` → `backlinkUtils.ts`
- `projectInit.js` → `projectInit.ts`

**Files changed:** 6 shared files converted. Old renderer JS can still `require()` the compiled output.

---

#### Phase 2 — Main Process TypeScript (No UI Changes)

**Goal:** All 20 main process files converted to TypeScript with interfaces.

**Migration order (by dependency — leaves first):**
1. `dialogs.ts`, `promptLogger.ts` (standalone utilities)
2. `fileEditor.ts`, `fileTree.ts` (fs operations)
3. `settingsManager.ts`, `tasksManager.ts` (CRUD managers)
4. `pluginsManager.ts`, `claudeUsageManager.ts`, `aiFilesManager.ts`
5. `claudeSessionsManager.ts`, `gitBranchesManager.ts`, `githubManager.ts`
6. `overviewManager.ts`, `aiToolManager.ts`, `workspace.ts`
7. `ptyManager.ts`, `pty.ts` (PTY with node-pty types)
8. `frameProject.ts` (orchestrator)
9. `menu.ts` (Electron Menu types)
10. `index.ts` (main entry — wire everything)

**Key interfaces to define:**
```typescript
interface SubFrameSettings { autoCreateTerminal: boolean; aiTool: string; /* ... */ }
interface TaskData { id: string; title: string; status: 'pending'|'in_progress'|'completed'; /* ... */ }
interface SessionData { sessionId: string; slug: string; firstPrompt: string; /* ... */ }
interface ProjectInfo { path: string; name: string; isFrame: boolean; /* ... */ }
```

**Files changed:** 20 main process files `.js` → `.ts`. No renderer changes.

---

#### Phase 3 — React Renderer (The Big Phase)

**Goal:** Replace all 20 vanilla JS renderer files with React TSX components.

**3.0 — React root setup:**
- Simplify `index.html` to `<div id="root">` + loading screen
- Create `src/renderer/index.tsx` as React entry:
```tsx
createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <App />
    <Toaster />
  </QueryClientProvider>
);
```

**3.1 — Zustand stores (replaces state.js):**
```
src/renderer/stores/
├── useUIStore.ts        — activePanel, sidebarState, sidebarWidth
├── useProjectStore.ts   — currentProject, isFrameProject, workspace
└── useTerminalStore.ts  — terminals Map, activeTerminalId, viewMode, gridLayout
```

**3.2 — Component migration order (leaf → root):**

| Order | Component | Replaces | Complexity | shadcn used |
|-------|-----------|----------|------------|-------------|
| 1 | `<SidebarResize>` | sidebarResize.js | Low | ResizablePanelGroup |
| 2 | `<AIToolSelector>` | aiToolSelector.js | Low | DropdownMenu |
| 3 | `<Editor>` | editor.js | Low | Dialog, Textarea |
| 4 | `<HistoryPanel>` | historyPanel.js | Low | ScrollArea |
| 5 | `<FileTree>` | fileTreeUI.js | Medium | Collapsible, lucide icons |
| 6 | `<ProjectList>` | projectListUI.js | Medium | DropdownMenu, ContextMenu |
| 7 | `<SettingsPanel>` | settingsPanel.js | Medium | Dialog, Tabs, Input |
| 8 | `<AIFilesPanel>` | aiFilesPanel.js | Medium | Badge, Button |
| 9 | `<TasksPanel>` | tasksPanel.js | Medium | Table (TanStack), Dialog, Badge |
| 10 | `<SessionsPanel>` | pluginsPanel.js (sessions) | Medium | Table (TanStack), Badge |
| 11 | `<PluginsPanel>` | pluginsPanel.js (plugins) | Medium | Badge, Button |
| 12 | `<GithubPanel>` | githubPanel.js | Medium | Tabs, Table, Badge |
| 13 | `<OverviewPanel>` | overviewPanel.js | Medium | Cards + motion.div |
| 14 | `<StructureMap>` | structureMap.js | High | useRef + D3 (imperative) |
| 15 | `<Terminal>` | terminal.js + terminalManager.js | High | useRef + xterm.js |
| 16 | `<TerminalTabBar>` | terminalTabBar.js | Medium | Tabs, ContextMenu |
| 17 | `<TerminalGrid>` | terminalGrid.js | High | CSS Grid + resize hooks |
| 18 | `<TerminalArea>` | multiTerminalUI.js | High | Orchestrator component |
| 19 | `<Sidebar>` | (part of index.js) | Medium | ResizablePanelGroup |
| 20 | `<App>` | index.js | Medium | Root layout |

**3.3 — TanStack Query hooks:**
```
src/renderer/hooks/
├── useFileTree.ts       — queryKey: ['fileTree', projectPath]
├── useTasks.ts          — queryKey: ['tasks', projectPath] + mutations
├── useSessions.ts       — queryKey: ['sessions'] + refetchInterval
├── usePlugins.ts        — queryKey: ['plugins']
├── useSettings.ts       — queryKey: ['settings'] + mutation
├── useOverview.ts       — queryKey: ['overview', projectPath]
├── useGithub.ts         — queryKey: ['github', tab, projectPath]
└── useAIFiles.ts        — queryKey: ['aiFiles', projectPath]
```

**Invalidation strategy:** Main process push events → `ipcRenderer.on()` in a `useIPCListener` hook → `queryClient.invalidateQueries()`.

**3.4 — TanStack Table instances:**

Tasks table columns: title, status (Badge), priority (Badge), category, updatedAt
Sessions table columns: title/firstPrompt, state (dot indicator), branch, messageCount, lastModified
Both support: sorting (click column header), text filtering (search input), column visibility toggle.

**3.5 — Framer Motion integration:**
- `<AnimatePresence>` wrapping panel show/hide
- `motion.div` with `layout` prop on sidebar resize
- Staggered `variants` for task/session list items
- `exit` animations on modal close (impossible with CSS alone)

**3.6 — xterm.js React pattern (custom hook, NOT a wrapper library):**
```typescript
function useTerminal(containerRef: RefObject<HTMLDivElement>, options: ITerminalOptions) {
  const terminalRef = useRef<Terminal | null>(null);
  useEffect(() => {
    const term = new Terminal(options);
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current!);
    fitAddon.fit();
    terminalRef.current = term;
    const observer = new ResizeObserver(() => fitAddon.fit());
    observer.observe(containerRef.current!);
    return () => { observer.disconnect(); term.dispose(); };
  }, []);
  return terminalRef;
}
```

---

#### Phase 4 — Styles Migration (CSS → Tailwind)

**Goal:** Delete all 6 hand-written CSS files. Tailwind + shadcn handle everything.

**4.1 — Token mapping already defined** (see CSS analysis above — 41 tokens → Tailwind @theme)

**4.2 — Delete files:**
- `src/renderer/styles/variables.css` (→ Tailwind @theme in globals.css)
- `src/renderer/styles/main.css` (→ globals.css imports)
- `src/renderer/styles/layout.css` (→ Tailwind utilities in components)
- `src/renderer/styles/components/ui.css` (→ shadcn components)
- `src/renderer/styles/components/panels.css` (→ Tailwind utilities in components)
- `src/renderer/styles/components/terminal.css` (→ Tailwind utilities + terminal component)

**4.3 — Keep:** `node_modules/xterm/css/xterm.css` (xterm.js's own styles)

**4.4 — Special cases:**
- Custom scrollbar styles → Tailwind plugin or small global CSS block
- Pseudo-elements (18 instances) → Tailwind `before:` / `after:` variants or component-level styles
- Keyframe animations (15) → Framer Motion for interactive, Tailwind `animate-*` for decorative (spin, pulse)

---

#### Phase 5 — Testing, Cleanup & Docs

**5.1 — Delete old files:** All 20 vanilla renderer `.js` files, 6 CSS files
**5.2 — Verify:** All IPC channels work, xterm.js lifecycle (mount/unmount/resize), TanStack Table sort/filter, Framer Motion animations, keyboard shortcuts, cross-platform (Windows + macOS)
**5.3 — Update docs:**
- CLAUDE.md CSS Design System section → reference Tailwind + shadcn
- STRUCTURE.json → full rebuild (`npm run structure`)
- AGENTS.md → update file references if any changed
- README.md → update tech stack

---

#### Risk Areas & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| xterm.js React lifecycle | Terminals don't mount/resize correctly | Custom `useTerminal` hook with ResizeObserver, test in StrictMode |
| 154 IPC channels to type | Tedious, error-prone | Type one category at a time (terminal first, then tasks, etc.) |
| Tailwind v4 + esbuild | New toolchain, less community examples | `esbuild-plugin-tailwindcss` v2.x confirmed working |
| shadcn in Electron | CLI assumes Next.js | Manual setup confirmed working with `components.json` rsc:false |
| Electron 28 EOL | No security patches since Oct 2025 | Bundle Electron upgrade into Phase 0 |
| D3.js + React | Two DOM managers conflict | Isolate D3 in useRef container, React never touches D3's subtree |
| Grid resize drag | Imperative mouse tracking in React | Keep in useEffect with refs, don't try to make it declarative |
| Big-bang risk | Breaking everything at once | Phased migration — each phase is independently deployable |

---

#### Estimated Scope

| Phase | Files Changed | New Files | Deletions |
|-------|--------------|-----------|-----------|
| 0 — Scaffold | 2 (package.json, esbuild config) | ~8 (tsconfigs, components.json, globals.css, utils.ts) | 0 |
| 1 — Typed IPC | 6 shared files | 2 (ipc.ts, useIpc.ts) | 0 |
| 2 — Main TS | 20 main files (.js→.ts) | 0 | 20 .js files |
| 3 — React | 0 (old files stay until replaced) | ~25 (components, hooks, stores) | 20 renderer .js files |
| 4 — Styles | 1 (globals.css) | 0 | 6 CSS files |
| 5 — Cleanup | 3 (CLAUDE.md, README, AGENTS.md) | 0 | 0 |
| **Total** | **32** | **~35** | **46** |

---

### [2026-03-01] Quality Infrastructure & Documentation Audit

**Context:** Session focused on auditing all docs/refs against actual code, comparing with Axiom-Portal's internal docs pattern, and adding quality infrastructure (tests, linting, CI).

**Decision — Vitest over Jest:**
- Vitest chosen because the project already uses esbuild as its bundler. Vitest uses esbuild/Vite transforms internally, so TypeScript files compile with zero extra config. Jest would require `ts-jest` or `babel-jest` + presets.
- Tests target Node.js shared modules (`backlinkUtils.ts`, `frameConstants.ts`) — no Electron mocking needed.

**Decision — ESLint 9 (not 10):**
- `eslint-plugin-react-hooks` (v5) has a peer dependency on `eslint@^9`. ESLint 10 was released but the hooks plugin hasn't caught up. Pinned to `eslint@^9` to avoid peer dep conflict.
- Used flat config format (`.mjs` file) since the project has no `"type": "module"` in package.json.

**Decision — CI with `--ignore-scripts`:**
- GitHub Actions CI uses `npm ci --ignore-scripts` to skip `electron-builder install-app-deps`. This avoids compiling native modules (`node-pty`) in CI, which would require platform-specific build tools.
- Trade-off: main process tests that need `node-pty` can't run in CI. Current tests only cover shared modules, so this is fine. If main-process tests are added later, the CI step should be split.

**Decision — ADR pattern from Axiom-Portal:**
- Adopted Architecture Decision Records in `.subframe/docs-internal/adr/`. Axiom-Portal uses `docs/decisions/` with rich Context/Decision/Alternatives/Consequences format.
- SubFrame's implementation lives inside `.subframe/` (not root `docs/`) to stay within SubFrame's project folder convention.

**Decision — IPC channels reference doc:**
- Created `.subframe/docs-internal/refs/ipc-channels.md` as a human-readable reference derived from `ipcChannels.ts`.
- Initial version had 93 channels. Audit found 112 actual channels (19 were missing from doc). Regenerated with accurate counts: 32 handle, 41 send, 32 event, 8 untyped/legacy.
- Channels not in any TypeScript type map (`IPCHandleMap`, `IPCSendMap`, `IPCEventMap`) are marked with ⚠ — candidates for cleanup or typing.

**Structure script TypeScript support:**
- `update-structure.js` was only parsing `.js` files and CJS `require`/`module.exports`.
- Updated to handle `.ts`/`.tsx` files, ESM `import`/`export` syntax, TypeScript generics in function signatures (`<T>`), and type annotation stripping.
- Path segment matching for exclusions (previously substring — `'dist'` would match `'distributed'`).
- STRUCTURE.json went from 6 modules to 66.

**Code review fixes (13 issues):**
- `vitest.config.ts` — `__dirname` is CJS-only, fixed with `fileURLToPath(import.meta.url)` for ESM.
- `tsconfig.test.json` created — test files weren't type-checked by any tsconfig.
- Function regex in structure script — failed on TypeScript generics `function foo<T>(...)`, added `(?:<[^>]*>)?` lookahead.
- `frameConstants.js` diverged from `.ts` — synced both (`.ts` is source of truth, `.js` is CJS fallback).
- `getDeletedFiles()` in structure script — wasn't filtering excluded paths.
- Backlink tests — added mid-file removal test, made line-count assertion resilient.

---

### [2026-03-01] Overview Panel Enhancements & Build Config Fix

#### Stats Hero Pattern
- **Decision:** Elevated Stats from a card in the grid to a dedicated full-width hero section above the card grid. Stats and Decisions both gained full-view detail panels (like Structure Map and Tasks already had).
- **Rationale:** Stats are the first thing users look for when opening Overview — treating them equally with other cards buried them. The hero pattern gives immediate visibility with click-through for deeper analysis.
- **New files:** `StatsDetailView.tsx`, `DecisionsDetailView.tsx`
- **Store change:** `FullViewContent` type extended with `'stats' | 'decisions'`

#### esbuild Platform: browser + IIFE for Electron Renderer
- **Decision:** Changed `build-react.js` from `platform: 'node'` to `platform: 'browser'` with `format: 'iife'` and `mainFields: ['module', 'browser', 'main']`.
- **Problem 1:** `style-mod` (CodeMirror dependency) declares `const top = globalThis` at module scope. With CJS output and `platform: 'node'`, this collided with the read-only `window.top` in Electron's browser-like renderer context.
- **Problem 2:** `@lezer/highlight` + `@lezer/css` had circular dependencies. CJS `require()` uses snapshot-at-require-time, causing `tags.className` to be `undefined` during initialization. ESM uses live bindings, resolving this.
- **Solution:** `platform: 'browser'` resolves ESM entry points (`"module"` field) with live bindings. `format: 'iife'` wraps everything in `(() => { ... })()`, making `const top` function-scoped. `external: ['electron']` preserves `require('electron')` for Electron's `nodeIntegration`.
- **Key insight:** Electron's renderer IS a browser context for bundling purposes — `platform: 'browser'` is correct despite Node.js APIs being available.

#### Keyboard Shortcut Conflict Avoidance (Ctrl+T → Ctrl+Shift+S)
- **Decision:** Remapped Sub-Tasks shortcut from Ctrl+T to Ctrl+Shift+S across all files.
- **Rationale:** SubFrame enhances Claude Code — it must not override Claude Code's built-in shortcuts. Ctrl+T is Claude Code's internal todos shortcut. SubFrame shortcuts should use modifier combinations (Ctrl+Shift+X) to stay out of the way.
- **Files changed:** App.tsx, TerminalTabBar.tsx, RightPanel.tsx, KeyboardShortcuts.tsx, QUICKSTART.md

#### Sidebar State Cycling
- **Decision:** Ctrl+B now cycles through 3 states: `expanded → collapsed → hidden → expanded` (was a 2-state toggle).
- **Rationale:** Users sometimes want the sidebar completely hidden for maximum terminal space, not just collapsed to an icon strip.

---

### React Refactor — Runtime Bug Fixes (Session 2026-03-01)

#### Usage Bar Displaying 3000%/4400%
- **Root cause:** `claudeUsageManager.ts` sends `utilization` as 0–100 (already a percentage from the Anthropic API). The React `UsageBar` component was multiplying by 100 again (`Math.round(utilization * 100)`), turning 30% into 3000%.
- **Fix:** Changed to `Math.round(Math.min(utilization, 100))` — no multiplication.
- **Original behavior reference:** Old code in `src/renderer/terminalTabBar.js` `_updateUsageItem()` used `Math.round(sessionUsage) + '%'` and `Math.min(usage, 100)%` for bar width, confirming 0–100 range.

#### Usage Component Design Mismatch
- **Root cause:** React version rendered bare inline text with progress bars. Original was a styled container (bg-tertiary, border, rounded) with hover-to-expand: Session bar always visible, Weekly bar collapsed by default (`max-width:0; opacity:0`), expanding to `max-width:160px; opacity:1` on container hover via CSS transition.
- **Fix:** Rewrote as a `group/usage` container with Tailwind `group-hover/usage:` utilities reproducing the CSS transition expand pattern.
- **Original CSS:** `.claude-usage-bars` in `src/renderer/styles/components/terminal.css`, commit `e29c895` ("show weekly on hover event").

#### SubFrame Project Detection Not Working
- **Root cause:** `Sidebar.tsx` showed "Initialize as SubFrame Project" whenever `currentProjectPath` was truthy, but never checked `isFrameProject` from the store. Additionally, no renderer code listened for `IS_FRAME_PROJECT_RESULT` or `FRAME_PROJECT_INITIALIZED` IPC events.
- **Fix:** (1) Gate button on `!isFrameProject`, (2) Add `useEffect` IPC listeners for both events that call `setIsFrameProject()`.

#### ClaudeUsageData Type Mismatch
- **Root cause:** `ipcChannels.ts` defined `ClaudeUsageData` as `{ totalCost, totalTokens, sessions }` but `claudeUsageManager.ts` actually sends `{ fiveHour, sevenDay, lastUpdated, error }`.
- **Fix:** Updated the type to match the actual data shape.

#### Dark Theme Not Applying to shadcn/ui Components (Dropdowns, Tooltips, Dialogs)
- **Root cause:** shadcn/ui components use standard Tailwind color tokens (`bg-popover`, `text-popover-foreground`, `bg-foreground`, `text-muted-foreground`, `bg-background`, `border`, `bg-input`, `ring-ring`, etc.) but `globals.css` only defined SubFrame-specific tokens (`--color-bg-deep`, `--color-bg-primary`, etc.). The standard tokens had no values, so Tailwind fell through to white/light defaults.
- **Secondary issue:** shadcn uses `focus:bg-accent`/`hover:bg-accent` for menu item hover states, but SubFrame's `--color-accent` is amber (#d4a574), not a subtle grey. This would make every menu hover bright orange.
- **Tertiary issue:** Tailwind v4 `dark:` variants use `prefers-color-scheme` by default, which fails when OS is in light mode. SubFrame is always dark.
- **Fix:**
  1. Added full shadcn standard token mappings in `globals.css` `@theme {}`, mapped to SubFrame dark theme values (e.g., `--color-popover: #1a1a1c`, `--color-foreground: #e8e6e3`).
  2. Replaced `focus:bg-accent`/`hover:bg-accent` with `focus:bg-bg-hover`/`hover:bg-bg-hover` in all shadcn component files to avoid the amber collision.
  3. Added `@variant dark (&:is(.dark *))` to `globals.css` and `class="dark"` to `index.html` so `dark:` variants work via class selector instead of media query.
- **Files changed:** `globals.css`, `index.html`, `dropdown-menu.tsx`, `context-menu.tsx`, `command.tsx`, `button.tsx`, `dialog.tsx`, `sheet.tsx`.

#### TasksPanel Infinite Render Loop (UI Freeze)
- **Symptom:** TasksPanel re-rendered ~3x/sec continuously (67+ renders with no user interaction), making the entire UI unresponsive.
- **Root cause:** `tasksManager.ts` file watcher sent `TASKS_DATA` IPC events repeatedly (Windows `fs.watch` fires multiple events). Each event called `queryClient.setQueryData()` with a new object reference. Unlike `queryFn`, `setQueryData` does NOT apply TanStack Query's `structuralSharing` — every call creates a new cache entry and triggers a re-render, even when data is identical.
- **Fix (3 layers):**
  1. **Main process** (`tasksManager.ts`): File watcher deduplicates via `lastUpdated` timestamp before sending IPC.
  2. **Renderer hook** (`useTasks.ts`): IPC handler compares `lastUpdated` before calling `setQueryData`.
  3. **Derived memoization** (`useTasks.ts`): `allTasks` and `grouped` wrapped in `useMemo([query.data])` for stable references.
- **Key lesson:** Always deduplicate `setQueryData` calls in IPC-driven hooks — `structuralSharing` only applies to `queryFn` results.

### [2026-03-01] Markdown-Based Task System Migration

**Decision:** Migrate sub-task storage from single `tasks.json` to individual `.md` files with YAML frontmatter.

**Rationale:**
- Tasks are human-editable in any text editor, including SubFrame's own CodeMirror editor with syntax highlighting + markdown preview
- Each task is its own file → Git diffs show per-task changes, merge conflicts are localized
- YAML frontmatter gives structured data while markdown body supports rich content (steps, notes, criteria)
- `tasks.json` kept as auto-generated index → backward-compatible with all hooks (session-start, prompt-submit, stop)

**New fields:** `blockedBy[]`, `blocks[]`, `steps[]` (parsed from `## Steps` checkboxes)

**Schema version:** 1.1 → 1.2

**Parser:** `gray-matter` npm package for frontmatter, regex for body sections. Round-trip tested.

**Migration:** `scripts/migrate-tasks-to-md.js` — idempotent, creates backup at `.subframe/tasks.json.pre-migration-backup`

**Files created:** `taskMarkdownParser.ts`, `TaskTimeline.tsx`, `TaskGraph.tsx`, `migrate-tasks-to-md.js`
**Files modified:** `tasksManager.ts` (complete rewrite), `task.js` (complete rewrite), `ipcChannels.ts`, `frameConstants.ts`, `frameTemplates.ts`, `useTasks.ts`, `useUIStore.ts`, `TasksPanel.tsx`

### [2026-03-10] Version-Stamped Component Update System

**Decision:** Add `@subframe-version` and `@subframe-managed` headers to all files deployed by SubFrame (hooks, git hooks, skills, workflows, codex wrapper).

**Why version stamps over content comparison:**
- Content comparison is brittle — any whitespace or formatting change triggers false positives
- Version stamps give a clear, ordered comparison: "deployed at 0.2.3, current is 0.2.4, update available"
- Enables efficient health checks without reading full file contents or computing hashes
- Version stamps are human-readable — users can see at a glance which SubFrame version deployed a file

**The `@subframe-managed: false` opt-out mechanism:**
- Users may customize deployed hooks or workflows beyond what SubFrame generates
- If SubFrame blindly overwrites, user edits are lost
- Setting `@subframe-managed: false` in a deployed file tells SubFrame to skip it during updates
- The health panel shows a badge for user-managed files so the user knows they're responsible for keeping them current
- `frameProject.ts` reports skipped components back to the UI so the user sees what was not updated

**Build pipeline safety net:**
- `scripts/verify-hooks.js` compares `scripts/hooks/` (the committed hook files) against what `frameTemplates.ts` would generate
- Catches drift where a template is updated but the committed hook files are stale (or vice versa)
- Runs in `npm run check`, pre-commit hook, and CI — prevents shipping mismatched hooks
- Fail-fast: blocks commit/CI if hooks are out of sync with templates

**Files:** `frameTemplates.ts`, `frameTemplates.js`, `subframeHealth.ts`, `claudeSettingsUtils.ts`, `frameProject.ts`, `ipcChannels.ts`, `SubFrameHealthPanel.tsx`, `scripts/verify-hooks.js`


## AI Analysis

_Generated by SubFrame onboarding on 2026-03-10_

**Vision:** A terminal-centric IDE that enhances AI coding tools with persistent context, task tracking, and structured workspaces so nothing gets lost between sessions.

**Tech Stack:**
- Electron 28
- React 19
- TypeScript (strict)
- Zustand 5 (state management)
- TanStack Query 5 (IPC caching)
- TanStack Table 8 (data tables)
- shadcn/ui + Radix UI (components)
- Tailwind CSS v4 (styling)
- Framer Motion (animations)
- CodeMirror 6 (editor)
- xterm.js 5 (terminal emulation)
- node-pty (pseudo-terminal)
- esbuild (bundler)
- Vitest (testing)
- ESLint 9 + Prettier (linting/formatting)
- VitePress (documentation site)
- electron-builder (packaging)
- electron-updater (auto-updates)
- Recharts (charts/graphs)
- React Flow / XYFlow (dependency graphs)
- gray-matter (YAML frontmatter parsing)
- highlight.js (syntax highlighting)

**Key Decisions:**
- **Electron two-process architecture** (2025-01-01): Chose Electron with strict separation between main (Node.js) and renderer (React) processes communicating over typed IPC channels for type safety and clear boundaries.
- **Manager pattern for main process** (2025-01-01): Each main process module follows an init() + setupIPC() pattern, registered in main/index.ts, providing consistent initialization and IPC handler setup.
- **Markdown-based task storage** (2025-01-01): Tasks stored as individual markdown files with YAML frontmatter rather than a database, enabling git-tracked task history and easy AI consumption.
- **esbuild over webpack/vite for bundling** (2025-01-01): Selected esbuild for both main and renderer builds for fast compilation, with custom build scripts rather than framework CLI tools.
- **Multi-AI-tool support** (2025-01-01): Designed to support Claude Code, Codex CLI, and Gemini CLI simultaneously through tool-agnostic AGENTS.md with tool-specific backlinks (CLAUDE.md, GEMINI.md).
- **Hook-based context automation** (2025-01-01): Implemented SessionStart, UserPromptSubmit, Stop, and tool-use hooks to automate context injection and task awareness without manual effort.
- **Tailwind CSS v4 with semantic design tokens** (2025-01-01): Uses warm neutral palette with amber accent, semantic surface hierarchy (bg-deep through bg-hover), and theme presets with optional neon trace effects.
