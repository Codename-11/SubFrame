---
title: Features
description: Overview of SubFrame's features — multi-terminal management, task tracking, session management, file browsing, and more.
---

# Features

SubFrame is a terminal-centric IDE built for AI-assisted development. It wraps your existing AI coding tools — Claude Code, Codex CLI, and others — in a rich interface designed around the workflows that matter most when working with AI agents.

This page provides an overview of each major feature. For keyboard shortcuts, see the [Keyboard Shortcuts](/guide/keyboard-shortcuts) reference.

## Multi-Terminal Management

The terminal is the heart of SubFrame. You can run multiple terminal sessions simultaneously and switch between them with tabs or view them all at once in a grid.

**Tab Mode** displays one terminal at a time with a tab bar for switching. Each tab shows the terminal name and can be renamed by double-clicking. Right-click a tab for options including rename, refresh session name, and close.

**Grid Mode** displays multiple terminals side-by-side in a configurable grid layout. Toggle between tab and grid mode with the view toggle button in the tab bar or press `Ctrl+Shift+G`. Available grid layouts include symmetric grids (1x2, 1x3, 2x1, 2x2, 3x2, 3x3) and asymmetric layouts — 2+1 (two stacked left, one full right), 1+2 (one full left, two stacked right), 2/1 (two top, one full bottom), and 1/2 (one full top, two bottom). Grid cells have resizable dividers — drag the borders between terminals to adjust sizing.

**Shell Selection** — The new terminal dropdown lets you choose from available shells (bash, PowerShell, zsh, etc.) detected on your system.

**Session Persistence** — Terminal layout, names, and active terminal are saved per-project and restored when you switch back.

**Pop-Out Windows** — Detach any terminal to a separate window with `Ctrl+Shift+D` for multi-monitor workflows. Pop-out terminals are fully functional with independent resize handling.

**File Path Links** — `Ctrl+click` on file paths printed in terminal output to open them directly in the built-in editor.

::: tip Quick Access
- `Ctrl+Shift+T` — New terminal
- `Ctrl+Shift+W` — Close current terminal
- `Ctrl+Tab` / `Ctrl+Shift+Tab` — Next / previous terminal
- `Ctrl+1` through `Ctrl+9` — Jump to terminal by position
:::

## Sub-Task System

SubFrame includes a built-in task tracking system called "Sub-Tasks." Tasks are stored as individual markdown files with YAML frontmatter in `.subframe/tasks/` and can be managed through the UI or the CLI.

### Views

The Sub-Tasks panel offers three visualization modes:

- **List View** — Sortable, filterable table with inline expand for task details. Columns include title, status, category, priority, and last updated. Click the expand arrow to see description, acceptance criteria, notes, dependencies, and step progress.
- **Kanban Board** — Drag-and-drop columns organized by status: Pending, In Progress, and Completed.
- **Dependency Graph** — Visual node graph showing task relationships and blockers. Useful for understanding which tasks are blocked and what needs to be completed first.

### Task Management

Tasks support filtering by status (All, Pending, In Progress, Completed, Blocked) and text search. Each task has inline actions:

- **Start** / **Complete** / **Pause** / **Reopen** — Transition task status
- **Send to Terminal** — Inject the task description into the active terminal as a prompt for your AI tool
- **Open in Editor** — View the underlying markdown file
- **Edit** / **Delete** — Modify or remove tasks

::: tip
Access Sub-Tasks from the terminal tab bar button or press `Ctrl+Shift+S`. Toggle the full-view mode with `Ctrl+Shift+K` for a larger workspace.
:::

## Sessions

The Sessions panel shows all Claude Code conversation sessions for the current project. Sessions are grouped by conversation chain, with a segment timeline showing the history of resumed conversations.

Key capabilities:

- **Resume** — Click the play button to resume any session in a new terminal. The resume command is sent automatically.
- **Resume Options** — The dropdown menu offers multiple resume methods: default tool command, `claude` directly, `--continue` mode, or a custom command.
- **Rename** — Give sessions friendly names for easier identification. The original prompt text is shown as a subtitle.
- **Delete** — Remove individual sessions or clean up all sessions at once.
- **Auto-Detection** — When you start a new Claude Code session, SubFrame automatically detects and displays the session name.

## File Tree & Editor

### File Tree

The sidebar's Files tab provides a recursive file tree for the current project. Features include:

- **Keyboard Navigation** — Arrow keys to move, Enter to open, Left/Right to collapse/expand directories
- **File Type Icons** — Visual indicators for TypeScript, JSON, Markdown, and other file types
- **Context Menu** — Right-click for Open in Editor, Reveal in Explorer, and Copy Path
- **Smart Sorting** — Directories are listed first, then files alphabetically

Access the file tree with `Ctrl+Shift+E`.

### Editor

Clicking a file opens SubFrame's built-in editor powered by CodeMirror 6. The editor supports two view modes, configurable in Settings > Editor:

- **Overlay Mode** (default) — Editor opens as a dialog overlay on top of the terminal area
- **Tab Mode** — Editor opens as an inline tab alongside terminal tabs, replacing the terminal view when active

Editor features include:

- **Syntax Highlighting** — Language support for TypeScript, JavaScript, JSON, Markdown, HTML, CSS, Python, Rust, Go, PHP, SQL, and more
- **Find & Replace** — `Ctrl+H` opens a find-and-replace panel with regex support
- **Go to Line** — `Ctrl+G` or the toolbar button opens a go-to-line dialog
- **Code Folding** — Fold gutters with clickable arrows for collapsible code blocks (functions, classes, objects)
- **Themes** — Multiple editor themes including SubFrame Dark (default), with a theme picker in the toolbar. The editor theme inherits accent colors from the active app theme.
- **Minimap** — Toggle a code minimap for quick navigation through large files
- **Word Wrap** — Toggle word wrapping for long lines
- **Font Size** — Adjustable font size with +/- controls
- **Save** — `Ctrl+S` saves changes with dirty tracking and unsaved-changes warnings on close
- **Preview Mode** — Markdown, HTML, CSS, and SVG files support a Code/Preview toggle
- **Image Viewing** — Image files are displayed with a visual preview
- **Fullscreen** — Press `F11` to toggle fullscreen editing
- **Status Bar** — Shows cursor position (line, column), total lines, and encoding

## AI Tool Integration

### AI Tool Selector

SubFrame supports multiple AI coding tools. The AI Tool Selector dropdown in the sidebar lets you switch between configured tools such as Claude Code, Codex CLI, and any custom tools you define.

When you click "Start" in the sidebar, SubFrame creates a new terminal, launches your selected AI tool, and begins watching for session activity. The terminal tab automatically renames itself to the session name once detected.

### AI Files Panel

The AI Files panel manages instruction files that configure AI tools for your project:

- **AGENTS.md** — Shared AI rules, the source of truth for all tools
- **CLAUDE.md** — Claude Code-specific instructions with backlink injection
- **GEMINI.md** — Gemini CLI instructions with backlink injection
- **Codex wrapper** — Shell wrapper that injects AGENTS.md context on launch

For each file, the panel shows its status (present, missing, backlink active) and provides actions to create, inject/remove backlinks, migrate legacy symlinks, and edit in the built-in editor.

The panel also includes backlink verification and configuration for customizing injected content.

For detailed setup, see the [AI Tool Setup](/guide/ai-tool-setup) guide.

## Plugin System

The Plugins panel manages Claude Code plugins with a toggle interface. Features include:

- **Filter** — View All, Installed, or Enabled plugins
- **Category Icons** — Visual indicators for Tools, Themes, Editor, and other plugin categories
- **Toggle** — Enable or disable installed plugins with a switch control
- **Install** — Install new plugins directly from the panel by sending the install command to your terminal

## GitHub Integration

The GitHub panel group provides four tabbed sub-panels for repository management:

### Issues & Pull Requests

Browse open, closed, or all GitHub issues and pull requests. Each item shows the title, number, labels (with color-matched badges), author, and relative timestamp. Click any item to open it on GitHub.

### Sync Status

The GitHub panel header shows a sync status line with the current branch name, ahead/behind commit counts relative to the remote, and working tree state (staged, modified, untracked file counts). When the local branch is in sync with remote, it displays "Up to date."

### Auto-Fetch

Configure automatic background fetching in Settings > Git. When enabled, SubFrame periodically runs `git fetch` at the configured interval to keep your ahead/behind counts current without manual intervention.

### Branches

View all local and remote branches with the current branch highlighted. Actions include:

- **Switch** — Check out a different branch
- **Create** — Create a new branch with an optional auto-checkout
- **Delete** — Remove local branches (with force-delete confirmation for unmerged branches)

### Worktrees

Manage Git worktrees for working on multiple branches simultaneously. View existing worktrees with their branch names and paths, and remove worktrees when no longer needed.

::: tip
Open the GitHub panel from the terminal tab bar or press `Ctrl+Shift+G`.
:::

## Overview & Stats

The Project Overview is a dashboard view that displays key project metrics in an animated card layout. Access it with `Ctrl+Shift+O` or the Overview button in the terminal tab bar.

### Dashboard Cards

- **Stats Hero** — Lines of code, source file count, commit count, current branch, and last commit message
- **Progress** — Sub-Task completion percentage with a progress bar and status breakdown
- **Structure** — Module count and group breakdown from STRUCTURE.json
- **Active Tasks** — Quick view of in-progress and pending tasks with priority indicators
- **Recent Files** — Recently modified source files, clickable to open in the editor
- **Decisions** — Project decisions recorded in PROJECT_NOTES.md
- **SubFrame Status** — Component health across core, hooks, skills, Claude integration, and git
- **AI Files** — Status of instruction files (CLAUDE.md, GEMINI.md, AGENTS.md, Codex wrapper)

### Detail Views

Click on the Stats or Decisions cards to open full detail views with expanded information. The Structure card opens the Structure Map (see below). Navigation between overview and detail views supports back-button (Escape or mouse back button).

## Agent State Monitoring

The Agent Activity panel provides real-time visibility into what your AI coding agent is doing. It reads agent state from `.subframe/agent-state.json` and displays:

**Panel Mode** (sidebar) — Shows the active session with its current status (active, busy, idle, completed), the tool currently in use, step count, and a compact timeline of recent actions.

**Full-View Mode** — A split layout with a session list on the left and a detailed step-by-step timeline for the selected session on the right. Each step shows the tool used, status, and progress.

::: tip
Open the Agent panel from the terminal tab bar or press `Ctrl+Shift+A`.
:::

## Structure Map

The Structure Map is an interactive D3.js visualization of your project's module architecture. It reads from `.subframe/STRUCTURE.json` and offers two view modes:

- **Graph View** — Force-directed graph where nodes represent modules and edges represent dependencies or IPC connections. Node size scales with lines of code. Toggle between Deps, IPC, or Both link modes.
- **Tree View** — Hierarchical layout grouping modules by process type (Main, Renderer, Shared).

Both views support zoom, pan, search filtering, and click-to-select for module details. The info panel shows the selected module's file path, LOC, function count, exports, and IPC channels. You can also export the visualization as an SVG file.

Access it from the Overview dashboard by clicking the Structure card, or through the full-view navigation.

## Theme & Appearance

SubFrame includes a full theme system with built-in presets and custom theme support.

### Built-in Presets

Choose from 4 presets in Settings > Appearance:

- **Classic Amber** — Warm neutrals with amber accent (default)
- **Synthwave Traces** — Purple/pink/cyan neon with optional scanlines and glow effects
- **Midnight Purple** — Deep purple tones with violet accents
- **Terminal Green** — Classic green-on-black terminal aesthetic

Presets apply instantly and affect all UI elements — panels, buttons, badges, borders, and the editor.

### Custom Themes

Adjust individual color tokens (accent, background, text) and save as a custom theme. Custom themes persist across sessions and appear alongside the built-in presets.

### Feature Toggles

Optional visual effects that can be enabled independently of the active theme:

- **Neon Traces** — Glowing border accents on panels and interactive elements
- **Scanlines** — Subtle CRT-style scanline overlay
- **Logo Glow** — Soft glow effect on the SubFrame logo in the sidebar

## Activity Streams

The Activity Bar sits at the bottom of the window (VS Code-style) and provides centralized visibility into all running background operations:

- **Real-time log streaming** — Onboarding analysis, pipeline stages, and task enhancement all route their output through the activity system
- **Heartbeat timers** — Long-running operations show elapsed time with periodic heartbeat updates
- **Timeout management** — Operations that exceed their time limit can be dismissed or cancelled
- **Dismiss controls** — Completed or failed activities can be dismissed individually

## CLI Integration

SubFrame supports external CLI commands for integration with other tools and scripts:

- **`subframe edit <file>`** — Open a file in the SubFrame editor from the command line
- **`subframe open <dir>`** — Open a directory as a project in SubFrame
- **Single-instance** — If SubFrame is already running, CLI commands are forwarded to the existing instance instead of launching a new one
- **macOS open-file** — Files opened via Finder or Dock are handled by the running SubFrame instance

## Auto-Updater

SubFrame includes a built-in auto-updater powered by electron-updater. When a new version is published on GitHub Releases:

1. SubFrame checks periodically (configurable, default every 4 hours)
2. A notification appears when an update is available
3. You choose when to download — updates are never automatic
4. After downloading, the update installs on next app restart

Pre-release versions (beta, alpha, RC) are offered based on your current version type by default. You can override this in Settings > Updater.

## Keyboard Shortcuts

SubFrame has extensive keyboard shortcuts for navigating the interface without leaving the keyboard. Press `Ctrl+?` to open the shortcuts reference overlay at any time.

For the complete list, see the [Keyboard Shortcuts](/guide/keyboard-shortcuts) reference.
