<!-- SUBFRAME AUTO-GENERATED FILE -->
<!-- Purpose: Quick onboarding guide for developers and AI assistants -->
<!-- For Claude: Read this FIRST to quickly understand how to work with this project. Contains setup instructions, common commands, and key files to know. -->
<!-- Last Updated: 2026-02-28 -->
<!-- Updated: Added init walkthrough, example workflow, keyboard shortcuts, settings section -->

# SubFrame - Quick Start Guide

## Prerequisites

- **Node.js** v18+ ([nodejs.org](https://nodejs.org/))
- **Python** (for node-gyp native module compilation)
- **C++ Build Tools** (for compiling `node-pty`):
  - **Windows**: Visual Studio Build Tools 2022 with "Desktop development with C++" workload
  - **macOS**: Xcode Command Line Tools (`xcode-select --install`)
  - **Linux**: `build-essential` (`sudo apt install build-essential`)

### Windows Quick Setup

Run the automated setup script — it checks and installs all prerequisites:

```
DEV_SETUP.bat
```

This runs `scripts/dev_setup.ps1` which handles Node.js, Python, VS Build Tools, `npm install`, and the initial build.

### macOS / Linux Setup

```bash
git clone https://github.com/Codename-11/SubFrame.git
cd SubFrame
npm install
```

## Common Commands

```bash
# Development (watch mode + Electron, cross-platform)
npm run dev

# Build renderer bundle only
npm run build

# Build + launch
npm start

# Watch mode (renderer only, no Electron)
npm run watch

# Update STRUCTURE.json
npm run structure

# Find a module by name
npm run find-module <name>

# Package for distribution
npm run dist            # current platform, unpacked
npm run dist:win        # Windows installer (NSIS, auto-elevates)
npm run dist:mac        # macOS (signed DMG)
npm run dist:mac:unsigned  # macOS (unsigned, for local testing)
```

### `npm run dev` vs `npm start`

- **`npm run dev`** — Runs `scripts/dev.js` which starts esbuild in watch mode AND Electron concurrently. Renderer auto-rebuilds on file changes. Best for active development.
- **`npm start`** — Runs a single build then launches Electron. Use for quick testing.

## Key Files

| File | Purpose |
|------|---------|
| `STRUCTURE.json` | Module map and architecture |
| `PROJECT_NOTES.md` | Decisions and context |
| `tasks/*.md` | Sub-Task files (markdown + YAML frontmatter) |
| `tasks.json` | Sub-Task index (auto-generated) |
| `AGENTS.md` | Instructions for AI assistants |
| `CLAUDE.md` | Claude Code instructions (with backlink to AGENTS.md) |
| `QUICKSTART.md` | This file |
| `.subframe/config.json` | SubFrame project configuration |

## Project Structure

```
SubFrame/
├── .subframe/           # SubFrame configuration and AI tool wrappers
│   ├── config.json      # Project settings
│   ├── tasks/           # Sub-Task markdown files
│   │   └── <id>.md      # Individual task (YAML frontmatter)
│   ├── tasks.json       # Sub-Task index (auto-generated)
│   └── bin/             # AI tool wrapper scripts
├── src/
│   ├── main/            # Electron main process (Node.js)
│   ├── renderer/        # Electron renderer (UI, bundled by esbuild)
│   └── shared/          # Shared modules (IPC channels, constants)
├── scripts/
│   ├── dev.js           # Cross-platform dev script (esbuild + Electron)
│   ├── dev_setup.ps1    # Windows prerequisites installer
│   ├── find-module.js   # Module search utility
│   └── update-structure.js  # STRUCTURE.json generator
├── dist/                # Built renderer bundle (esbuild output)
├── release/             # Packaged app (after npm run dist)
├── DEV_SETUP.bat        # Windows setup launcher
└── index.html           # Main window HTML
```

## Initializing a Project

When you open a project in SubFrame for the first time, you can initialize it to set up AI-friendly scaffolding.

1. **Select your project** in the sidebar project list
2. **Click "Initialize Frame"** — the button appears at the top of the terminal area for non-initialized projects
3. **Confirm** in the modal dialog that appears
4. SubFrame creates the following files (only if they don't already exist):

| File | Purpose |
|------|---------|
| `.subframe/config.json` | Project settings (name, tools, creation date) |
| `.subframe/bin/codex` | Codex CLI wrapper script |
| `AGENTS.md` | AI assistant instructions |
| `CLAUDE.md` | Claude Code instructions (with backlink to AGENTS.md) |
| `GEMINI.md` | Gemini CLI instructions (with backlink to AGENTS.md) |
| `STRUCTURE.json` | Module map and architecture overview |
| `PROJECT_NOTES.md` | Decisions, context, and roadmap |
| `tasks/` | Sub-Task directory (individual .md files) |
| `tasks.json` | Sub-Task index (auto-generated) |
| `QUICKSTART.md` | Quick-start guide |

5. **Next steps**: Edit `AGENTS.md` to describe your project's conventions, then update `STRUCTURE.json` to reflect your codebase layout.

## Example Workflow

A typical workflow with SubFrame and Claude Code:

1. **Select project** in the sidebar (`Ctrl+E` to focus project list)
2. **Initialize** if needed — click "Initialize Frame" to generate scaffolding
3. **Start Claude Code** — press `Ctrl+K` or click the Claude button in the terminal toolbar
4. Claude reads `CLAUDE.md` automatically (which includes a backlink to `AGENTS.md`)
5. Claude follows the `AGENTS.md` instructions, reads `STRUCTURE.json` for architecture context, and checks `tasks.json` for pending work
6. **Review history** — press `Ctrl+Shift+H` to open the history panel and browse past sessions
7. **Manage tasks** — press `Ctrl+Shift+S` to open the tasks panel and track progress

## Keyboard Shortcuts

### Panel Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+B` | Toggle sidebar |
| `Ctrl+Shift+S` | Toggle tasks panel |
| `Ctrl+Shift+H` | Toggle history panel |
| `Ctrl+Shift+P` | Toggle plugins panel |
| `Ctrl+Shift+G` | Toggle GitHub panel |
| `Ctrl+,` | Toggle settings panel |

### Terminal Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` | Start Claude Code |
| `Ctrl+I` | Run /init |
| `Ctrl+Shift+C` | Run /commit |
| `Ctrl+H` | Open history file |
| `Ctrl+Shift+T` | New terminal |
| `Ctrl+Shift+W` | Close terminal |
| `Ctrl+Tab` | Next terminal |
| `Ctrl+Shift+Tab` | Previous terminal |
| `Ctrl+1-9` | Switch to terminal N |
| `Ctrl+Shift+G` | Toggle grid view |

### Navigation Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+E` | Focus project list |
| `Ctrl+Shift+E` | Focus file tree |
| `Ctrl+Shift+[` | Previous project |
| `Ctrl+Shift+]` | Next project |

> **Note**: On macOS, use `Cmd` instead of `Ctrl` for all shortcuts.

## Settings

Open the settings panel with `Ctrl+,` to configure:

- **AI tool paths** — Custom paths for Claude Code, Codex CLI, and Gemini CLI
- **Default shell** — Override the default terminal shell
- **Theme** — Appearance preferences
- **Terminal behavior** — Scroll-to-bottom, font size, and other terminal options

Settings are persisted via localStorage and the settings manager.

## For AI Assistants (Claude)

SubFrame enhances your native capabilities — all built-in Claude Code features (`/init`, `/commit`, `/compact`, `/memory`, etc.) work exactly as normal. SubFrame adds structured context on top.

1. **First**: Read `STRUCTURE.json` for architecture overview
2. **Then**: Check `PROJECT_NOTES.md` for current context and decisions
3. **Check**: `tasks.json` for pending tasks
4. **Follow**: Existing code patterns and conventions
5. **Update**: These files as you make changes

## Quick Context

SubFrame is a project management IDE for Claude Code. It provides:
- Visual task management with real-time file watching
- Context preservation between sessions
- Settings panel for AI tool configuration
- Plugins panel for Claude Code plugins
- Multi-terminal support with scroll-to-bottom
- File explorer and editor
- Project renaming and organization
- Cross-platform support (Windows, macOS, Linux)
