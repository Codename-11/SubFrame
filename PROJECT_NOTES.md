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
**Last Updated:** 2026-02-28
**Status:** SubFrame rebrand complete — Sessions panel, Gemini CLI, overview dashboard shipped

---

## Session Notes

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
