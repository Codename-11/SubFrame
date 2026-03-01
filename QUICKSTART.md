<!-- SUBFRAME AUTO-GENERATED FILE -->
<!-- Purpose: Quick onboarding guide for developers and AI assistants -->
<!-- For Claude: Read this FIRST to quickly understand how to work with this project. Contains setup instructions, common commands, and key files to know. -->
<!-- Last Updated: 2026-02-28 -->

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
npm run dist:win        # Windows installer (NSIS)
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
| `tasks.json` | Task tracking |
| `AGENTS.md` | Instructions for AI assistants |
| `CLAUDE.md` | Symlink to AGENTS.md (Claude Code compatibility) |
| `QUICKSTART.md` | This file |
| `.subframe/config.json` | SubFrame project configuration |

## Project Structure

```
SubFrame/
├── .subframe/           # SubFrame configuration and AI tool wrappers
│   ├── config.json      # Project settings
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

## For AI Assistants (Claude)

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
