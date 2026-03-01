# SubFrame

A lightweight, IDE-style desktop application built for AI-assisted development with [Claude Code](https://claude.com/claude-code), [Codex CLI](https://github.com/openai/codex), and [Gemini CLI](https://github.com/google-gemini/gemini-cli). Think VS Code, but streamlined for AI coding workflows. Cross-platform: Windows, macOS, and Linux.



https://github.com/user-attachments/assets/6fe108d1-70c8-441e-a913-b34583c803b0


## What is this?

SubFrame is a project management IDE for Claude Code that aims to:

1. **Bring a standard to AI coding projects** - Consistent project structure with AGENTS.md, CLAUDE.md, STRUCTURE.json, PROJECT_NOTES.md, and tasks.json
2. **Improve context and memory problems as projects grow** - Automatic context preservation, session notes, and decision tracking
3. **Make project management easier** - Visual task management, plugins panel, and streamlined workflows

This is an Electron-based desktop application that combines:
- **Project Explorer** (left panel) - Browse your project files with a collapsible tree view
- **Multi-Terminal** (center) - Multiple terminal instances with tabs or grid view
- **File Editor** - Quick overlay editor for file viewing and editing
- **Prompt History** (right panel) - See all your commands with timestamps

The key innovation: **Claude Code launches directly in your selected project directory**, so you don't need to `cd` around. Just select a project, click "Start Claude Code", and you're ready to go.

## Why build this?

**The Core Problem**: As projects grow with Claude Code, context gets lost between sessions. Decisions are forgotten, tasks slip through the cracks, and you end up re-explaining the same things over and over.

**SubFrame's Solution**: A standardized project structure that Claude Code reads automatically at the start of each session, combined with tools to track decisions, tasks, and context - so nothing gets lost.

**Design Philosophy**: SubFrame builds on top of your existing AI tools — it never replaces them. Claude Code, Gemini CLI, and Codex CLI work exactly as they normally would. SubFrame adds a structured layer (tasks, codebase mapping, context preservation) that enhances what's already there. Native AI files like CLAUDE.md and GEMINI.md remain user-owned; SubFrame only injects a small backlink reference. When native tools add new features, SubFrame supports and integrates — it never conflicts.

When working with Claude Code, you often need to:
1. See your project structure
2. Run Claude Code in the right directory
3. Track what commands you've run
4. Switch between projects quickly
5. Work with multiple terminals simultaneously

This app does all of that in one window, with a clean VS Code-inspired interface.

## SubFrame Project System

When you initialize a SubFrame project (via the Initialize button or `/init`), SubFrame creates a standardized set of files that give your AI tools persistent context and structure. This is what makes SubFrame more than a terminal — every project speaks the same language.

### What gets created

| File | Purpose |
|------|---------|
| `AGENTS.md` | AI-agnostic instructions file. Contains project rules, conventions, and context that any AI tool can read. Native tool files (`CLAUDE.md`, `GEMINI.md`) contain a small backlink reference to AGENTS.md, and Codex CLI gets context via a wrapper script (`.subframe/bin/codex`). Each tool picks up the same instructions in its native format. |
| `STRUCTURE.json` | Machine-readable module map of your codebase. Tracks exports, dependencies, IPC channels, and functions with line numbers. Includes an `intentIndex` for fast keyword-to-file lookup. Auto-updated via pre-commit hook for JS files. |
| `tasks.json` | Structured task tracking that bridges conversation to project management. AI detects tasks from your conversation and asks to add them. The visual task panel in SubFrame lets you filter, update status, and send tasks directly back to Claude. |
| `PROJECT_NOTES.md` | Session notes and decisions preserved verbatim (not summarized). AI prompts you to save important moments so context carries forward between sessions. |
| `.subframe/config.json` | Project-level settings and configuration. |

### Useful commands

```bash
# Rebuild STRUCTURE.json for the entire project
npm run structure

# Find which file implements a feature by keyword
node scripts/find-module.js <keyword>
```

### Why this matters

Context is not lost between sessions. Every project has the same structure, so AI tools know exactly where to look. Decisions, tasks, and architecture are all tracked in files that both you and your AI tools can read — no re-explaining required.

## Screenshots

```
┌──────────────┬─────────────────────────┬──────────────┐
│   Project    │      Terminal Tabs      │   Prompt     │
│   Explorer   │ [Term 1] [Term 2] [+]   │   History    │
│              ├─────────────────────────┤              │
│ 📁 src/      │                         │ 2026-01-21   │
│   📄 app.js  │  $ claude               │ > claude     │
│ 📁 test/     │  > Help me refactor...  │              │
│ 📄 README.md │                         │ 2026-01-21   │
│              │  [Claude response]      │ > /init      │
│ [Start       │                         │              │
│  Claude]     │                         │              │
└──────────────┴─────────────────────────┴──────────────┘
```

## Features

### Core Features
- **IDE Layout**: 3-panel design (explorer, terminal, history)
- **Real Terminal**: Full PTY support via node-pty - not a fake terminal
- **Multi-Terminal**: Up to 9 terminals with tab or grid view
- **File Tree**: Collapsible folders, 5 levels deep, filters node_modules
- **File Editor**: Overlay editor for quick file viewing/editing
- **Project-Aware**: Terminal starts in your selected project directory
- **Prompt History**: All commands saved with timestamps, viewable in side panel
- **Cross-Platform**: Windows, macOS, Linux support

### SubFrame Project Management
- **Task Detection**: Claude Code automatically detects tasks from conversations and asks to add them to tasks.json
- **Task Panel**: Visual task management with filters (All, Pending, In Progress, Completed)
- **Manual Task Creation**: Add tasks manually through the UI
- **Task Actions**: Start, complete, pause, or reopen tasks with one click
- **Send to Claude**: Click play button to send a task directly to Claude Code terminal
- **Claude Panel**: Sessions and Plugins in a collapsible right-side panel
  - **Sessions Tab** (default): Browse past Claude Code sessions with state indicators (active/recent/inactive), resume with split button (default tool, custom command)
  - **Plugins Tab**: Browse, enable/disable, and install Claude Code plugins
  - **Collapsible**: Collapse arrow shrinks to icon strip, click icons to expand back
- **Overview Dashboard**: Project metrics and stats at a glance — see your project health in one view
- **GitHub Panel**: Browse repository issues directly from the sidebar without leaving SubFrame
- **Git Branches**: View, switch, create, and delete branches from a dedicated panel
- **Settings Panel**: Configure AI tool commands, preferences, and project-level settings
- **AI Tool Switching**: Switch between Claude Code, Codex CLI, and Gemini CLI — each tool gets context injected in its native format
- **Claude Usage Tracking**: Monitor Claude Code usage statistics from within the app
- **Context Preservation**: Automatic prompts to save important decisions to PROJECT_NOTES.md

### Multi-Terminal Features
- **Tab View**: Default view with terminal tabs
- **Grid View**: 2x1, 2x2, 3x1, 3x2, 3x3 layouts
- **Resizable Grid**: Drag borders to resize grid cells
- **Terminal Naming**: Double-click tab to rename terminals
- **Maximum 9 Terminals**: Manage multiple sessions efficiently

### Smart Defaults
- **Shell Selection**: PowerShell Core (Windows), bash/zsh (macOS/Linux)
- **Keyboard Shortcuts**:
  - `Ctrl+K` - Start Claude Code
  - `Ctrl+Shift+H` - Toggle history panel
  - `Ctrl+I` - Run /init
  - `Ctrl+Shift+C` - Run /commit
  - `Ctrl+Shift+T` - New terminal
  - `Ctrl+Shift+W` - Close current terminal
  - `Ctrl+Tab` - Next terminal
  - `Ctrl+Shift+Tab` - Previous terminal
  - `Ctrl+1-9` - Switch to terminal by number
  - `Ctrl+Shift+G` - Toggle grid view
- **Focus Management**: Enter key only works in terminal, never on buttons
- **Auto-resize**: Terminal adjusts when panels open/close

### Quality of Life
- File icons (folders, JS, JSON, MD)
- Alphabetical sorting (folders first)
- VS Code dark theme
- Scrollable history (10,000 lines)
- Menu bar commands for quick access

## Tech Stack

| Component | Technology | Why? |
|-----------|-----------|------|
| Desktop Framework | Electron 28 | Cross-platform, mature, well-documented |
| Terminal Emulator | xterm.js 5.3 | Industry standard (used by VS Code) |
| PTY | node-pty 1.0 | Real pseudo-terminal, not subprocess pipes |
| Bundler | esbuild | Fast bundling for modular renderer code |
| UI | HTML/CSS/JS | Native Electron renderer |

**Why these choices?**
- **Electron**: One codebase, works everywhere
- **xterm.js**: Full VT100/ANSI support, handles colors, progress bars, everything Claude Code outputs
- **node-pty**: Creates a real PTY so Claude Code thinks it's in a real terminal
- **esbuild**: Sub-second builds for modular development

## Installation

### Prerequisites
- Node.js 18+ (https://nodejs.org)
- npm (comes with Node.js)
- Python (for node-gyp native module compilation)
- C++ Build Tools (for compiling `node-pty`):
  - **Windows**: Visual Studio 2022 Build Tools with "Desktop development with C++" workload
  - **macOS**: Xcode Command Line Tools (`xcode-select --install`)
  - **Linux**: `build-essential` (`sudo apt install build-essential`)
- Git (optional, for cloning)

### Windows Quick Setup

Run the automated setup script — it checks and installs all prerequisites:

```
DEV_SETUP.bat
```

### Manual Setup (All Platforms)

```bash
# Clone the repo
git clone https://github.com/Codename-11/SubFrame.git
cd SubFrame

# Install dependencies
npm install

# Run the app (development mode with auto-rebuild)
npm run dev

# Or: single build + launch
npm start
```

### Installing Claude Code
If you don't have Claude Code installed:
```bash
npm install -g @anthropic-ai/claude-code
```

## Usage

### Basic Workflow

1. **Launch the app**: `npm start`
2. **Select a project**:
   - Click "Select Project Folder"
   - Browse to your project directory
   - File tree loads automatically
3. **Start Claude Code**:
   - Click "Start Claude Code" button
   - Or press `Ctrl+K`
   - Claude Code launches in that directory
4. **View history**:
   - Press `Ctrl+Shift+H`
   - See all your commands with timestamps

### Multi-Terminal Usage

1. **Create new terminal**: Click [+] button or `Ctrl+Shift+T`
2. **Switch terminals**: Click tabs or `Ctrl+Tab`
3. **Grid view**: Click grid icon or `Ctrl+Shift+G`
4. **Change grid layout**: Use dropdown menu (2x1, 2x2, 3x1, 3x2, 3x3)
5. **Rename terminal**: Double-click on tab name
6. **Close terminal**: Click X on tab or `Ctrl+Shift+W`

### File Editor

- Click on any file in the file tree to open the editor overlay
- Edit and save changes directly
- Press Escape or click outside to close

### Tips

**Multiple Projects**
- Switch projects anytime with "Select Project Folder"
- Terminal restarts in the new directory
- File tree updates automatically

**Prompt History**
- Automatically logs all terminal input
- Stored at: `%APPDATA%/SubFrame/prompts-history.txt` (Windows) or `~/Library/Application Support/SubFrame/prompts-history.txt` (macOS)
- Open in text editor: `Ctrl+H`
- View in side panel: `Ctrl+Shift+H`

## Development

### Project Structure

```
SubFrame/
├── src/
│   ├── main/                # Electron main process
│   │   ├── index.js         # Main entry, window & IPC management
│   │   ├── ptyManager.js    # Multi-PTY management
│   │   ├── settingsManager.js   # Settings persistence
│   │   ├── tasksManager.js  # Task CRUD with file watching
│   │   └── ...              # Other managers (workspace, sessions, etc.)
│   │
│   ├── renderer/            # Electron renderer (bundled by esbuild)
│   │   ├── index.js         # Entry point
│   │   ├── terminalManager.js    # Multi-terminal state
│   │   ├── multiTerminalUI.js    # Terminal orchestrator
│   │   ├── settingsPanel.js # Settings panel UI
│   │   ├── tasksPanel.js    # Task management UI
│   │   └── ...              # Other UI modules
│   │
│   └── shared/              # Shared between main & renderer
│       └── ipcChannels.js   # IPC channel constants
│
├── scripts/
│   ├── dev.js               # Cross-platform dev script
│   ├── dev_setup.ps1        # Windows prerequisites installer
│   ├── find-module.js       # Module search utility
│   └── update-structure.js  # STRUCTURE.json generator
│
├── index.html               # UI layout and styles
├── package.json             # Dependencies and scripts
├── DEV_SETUP.bat            # Windows setup launcher
├── PROJECT_NOTES.md         # Detailed technical docs
└── README.md                # This file
```

### Key Modules Explained

**src/main/index.js** - The Node.js backend
- Creates splash window + main application window
- Two-stage startup: splash (instant, data URL) → main window (`ready-to-show`)
- Persists window state (bounds, maximized) across sessions
- Handles IPC messages
- Manages file system operations
- Integrates PTY manager

**src/main/ptyManager.js** - Multi-PTY Management
- Creates and manages multiple PTY instances
- Routes input/output by terminal ID
- Handles terminal lifecycle (create/destroy)

**src/renderer/terminalManager.js** - Terminal State
- Manages xterm.js instances
- Tracks active terminal
- Handles view mode (tabs/grid)

**src/renderer/multiTerminalUI.js** - UI Orchestrator
- Combines tab bar, grid, and terminal manager
- Handles keyboard shortcuts
- Manages view transitions

**src/shared/ipcChannels.js** - IPC Constants
- Centralized IPC channel definitions
- Prevents typos in channel names
- Used by both main and renderer

### Startup Flow

```
app.whenReady()
  │
  ├─ Splash window (frameless, data: URL, instant)
  │    Logo + animated progress bar
  │
  ├─ Main window (show: false, loads index.html)
  │    │
  │    ├─ DOMContentLoaded → initCritical()
  │    │    Sidebar, project list, resize, shortcuts
  │    │
  │    ├─ requestAnimationFrame → initDeferred()
  │    │    File tree, editor, panels (tasks, plugins, etc.)
  │    │
  │    └─ ready-to-show → show main, close splash
  │
  └─ Window state restored (bounds + maximized from previous session)
```

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│           Electron Main Process (Node.js)                │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ PTY Manager  │  │ File System  │  │ Prompt Logger│  │
│  │ (Multi-PTY)  │  │              │  │              │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│         │                 │                  │          │
│         └─────────────────┴──────────────────┘          │
│                           │                             │
│                      IPC Channels                       │
│                           │                             │
└───────────────────────────┼─────────────────────────────┘
                            │
┌───────────────────────────┼─────────────────────────────┐
│           Electron Renderer (Browser)                    │
│                           │                             │
│  ┌────────────────────────┴────────────────────────┐   │
│  │              MultiTerminalUI                     │   │
│  │  ┌───────────┐ ┌────────────┐ ┌──────────────┐  │   │
│  │  │  TabBar   │ │   Grid     │ │TerminalMgr  │  │   │
│  │  └───────────┘ └────────────┘ └──────────────┘  │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ┌────────────┬───────────────┬──────────────┐         │
│  │  Sidebar   │  Terminal(s)  │   History    │         │
│  │ (File Tree)│   (xterm.js)  │   Panel      │         │
│  └────────────┴───────────────┴──────────────┘         │
└─────────────────────────────────────────────────────────┘
```

**IPC Messages (Multi-Terminal):**
- `terminal-create` - Create new PTY instance
- `terminal-created` - PTY created response
- `terminal-destroy` - Destroy PTY instance
- `terminal-input-id` - Input to specific terminal
- `terminal-output-id` - Output from specific terminal
- `terminal-resize-id` - Resize specific terminal

### Building Renderer

The renderer uses esbuild for bundling:

```bash
# Build renderer (runs automatically on npm start)
npm run build

# Watch mode for development
npm run watch

# Development mode (watch + Electron, cross-platform)
npm run dev
```

### Adding Features

**Want to add a new terminal feature?**
1. Add IPC channel in `src/shared/ipcChannels.js`
2. Add handler in `src/main/ptyManager.js` or `src/main/index.js`
3. Add UI in `src/renderer/terminalManager.js` or related UI module
4. Run `npm run build` to bundle

**Want to add a new panel?**
1. Add HTML container in `index.html`
2. Add CSS styles
3. Create module in `src/renderer/`
4. Import in `src/renderer/index.js`
5. Build with esbuild

## Building for Production

```bash
# Package for current platform (unpacked)
npm run dist

# Windows installer (NSIS) — auto-requests admin if needed
npm run dist:win

# macOS (signed DMG)
npm run dist:mac

# macOS (unsigned, local testing)
npm run dist:mac:unsigned
```

Output: `release/` folder with installers for your platform

## Troubleshooting

### "claude: command not found"
Claude Code is not installed. Install it:
```bash
npm install -g @anthropic-ai/claude-code
```

### "Cannot find module 'node-pty'"
Dependencies not installed:
```bash
npm install
```

### Terminal shows "Windows PowerShell" header
This is normal if PowerShell Core (`pwsh`) is not installed. The app falls back to Windows PowerShell. To get PowerShell Core:
```bash
winget install Microsoft.PowerShell
```

### File tree not showing
- Check that you selected a valid folder
- Check console for errors: View → Toggle DevTools
- Try clicking "Select Project Folder" again

### Windows build fails with "Cannot create symbolic link"
The `dist:win` script auto-requests admin elevation via UAC. If that fails:
- **Option A:** Enable Developer Mode — Settings → System → For Developers
- **Option B:** Run your terminal as Administrator

### Grid view stuck after switching to tabs
Fixed in latest version. The grid CSS properties are now properly cleared when switching to tab view.

## Roadmap

See [PROJECT_NOTES.md](./PROJECT_NOTES.md) for detailed roadmap.

### Completed
- [x] IDE layout (3 panel)
- [x] File tree explorer
- [x] Prompt history panel
- [x] Multi-terminal (tabs)
- [x] Multi-terminal (grid view)
- [x] File editor overlay
- [x] Modular architecture with esbuild
- [x] Settings panel
- [x] Project renaming
- [x] Custom AI tool start command
- [x] Cross-platform Windows support
- [x] Resizable sidebar
- [x] Terminal scroll-to-bottom button
- [x] Tasks panel with real-time updates
- [x] Git branches panel
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

## Contributing

This is a POC/personal project, but contributions welcome!

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](./LICENSE) file

## Acknowledgments

- Built with [Claude Code](https://claude.com/claude-code) (meta!)
- Terminal powered by [xterm.js](https://xtermjs.org/)
- PTY via [node-pty](https://github.com/microsoft/node-pty)
- Inspired by VS Code's terminal

## Questions?

See [PROJECT_NOTES.md](./PROJECT_NOTES.md) for:
- Detailed architecture
- Implementation decisions
- Code examples
- Lessons learned during development

---

**Status**: Full-featured IDE with multi-terminal, task management, settings, and cross-platform support

**Started**: January 21, 2026
**Author**: Built in collaboration with Claude Code
