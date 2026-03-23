---
title: Features
description: Overview of SubFrame's features — multi-terminal management, task tracking, session management, file browsing, and more.
---

# Features

SubFrame is a terminal-centric IDE built for AI-assisted development. It wraps your existing AI coding tools — Claude Code, Codex CLI, and others — in a rich interface designed around the workflows that matter most when working with AI agents.

This page provides an overview of each major feature. For keyboard shortcuts, see the [Keyboard Shortcuts](/keyboard-shortcuts) reference.

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

Track project work with markdown-based tasks featuring YAML frontmatter, step checklists, and dependency graphs. View tasks in table, kanban, or graph mode from the Sub-Tasks panel (`Ctrl+Shift+S`). Toggle full-view mode with `Ctrl+Shift+K` for a larger workspace.

→ [Full Sub-Tasks reference](/sub-tasks)

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

SubFrame supports multiple AI coding tools — Claude Code, Codex CLI, and custom tools. The sidebar's AI Tool Selector lets you switch between them, and the "Start" button launches your selected tool in a new terminal with automatic session detection.

The AI Files panel manages instruction files (AGENTS.md, CLAUDE.md, GEMINI.md, Codex wrapper) that configure AI tools for your project, with status tracking, backlink injection, and one-click editing.

→ [AI Tool Setup guide](/ai-tool-setup)

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

## Usage Monitoring

The usage pill in the terminal tab bar shows your Claude API utilization at a glance. Click to refresh, hover for a detailed tooltip breakdown.

### Data Sources

SubFrame retrieves usage data through a 4-layer fallback system (first success wins):

| Layer | Source | Speed | Indicator |
|---|---|---|---|
| **Local cache** | Claude's statusline cache file (`claude-statusline-usage-cache.json` in temp) | Instant | Green dot, "Live" |
| **OAuth API** | `api.anthropic.com/api/oauth/usage` with automatic token refresh | ~1-2s | Blue dot, "API" |
| **Credentials** | Account tier from `~/.claude/.credentials.json` (no utilization data) | Instant | Amber dot, "Tier" |
| **Fallback** | In-memory data from a previous successful fetch | Instant | Shows last updated time |

The local cache is the primary path during active Claude Code sessions — Claude writes this file automatically. No configuration needed.

### Usage Windows

| Window | Description |
|---|---|
| **Session (5h)** | Rolling 5-hour utilization — resets periodically |
| **Weekly (7d)** | Rolling 7-day utilization |
| **Sonnet (7d)** | Per-model breakdown for Sonnet |
| **Opus (7d)** | Per-model breakdown for Opus |
| **Extra credits** | Max plan extra usage credits (if enabled) |

The inline pill shows Session usage by default. Hover to expand the Weekly bar. Click the pill or hover for the full tooltip with all windows.

### Configuration

Usage polling is **off by default** (data loads on startup and on click). To enable periodic polling, set the **Usage Polling Interval** in Settings > General > Behavior (30–600 seconds). The system uses exponential backoff on failures and will suggest disabling polling after persistent errors.

::: tip
If usage shows "unavailable", ensure you're logged into Claude Code (`claude` in a terminal) — SubFrame reads its credentials and cache files.
:::

## Structure Map

The Structure Map is an interactive D3.js visualization of your project's module architecture. It reads from `.subframe/STRUCTURE.json` and offers two view modes:

- **Graph View** — Force-directed graph where nodes represent modules and edges represent dependencies or IPC connections. Node size scales with lines of code. Toggle between Deps, IPC, or Both link modes.
- **Tree View** — Hierarchical layout grouping modules by process type (Main, Renderer, Shared).

Both views support zoom, pan, search filtering, and click-to-select for module details. The info panel shows the selected module's file path, LOC, function count, exports, and IPC channels. You can also export the visualization as an SVG file.

Access it from the Overview dashboard by clicking the Structure card, or through the full-view navigation.

## Theme & Appearance

SubFrame includes a full theme system with 4 built-in presets (Classic Amber, Synthwave Traces, Midnight Purple, Terminal Green), custom theme support, and optional visual effects like neon traces and scanlines. Themes apply instantly across all UI elements.

→ [Configuration reference](/configuration#appearance-settings)

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

## Pipeline Workflows

Run automated workflows defined in YAML — code review, testing, health checks with AI-powered stages. Access from the Pipeline panel (`Ctrl+Shift+Y`).

→ [Pipeline Workflows reference](/pipelines)

## Command Palette

Press `Ctrl+/` to open the Command Palette — a quick-search overlay for navigating to any panel, view, or action. Type to filter, arrow keys to navigate, Enter to select.

## Prompt Library

Access reusable prompts from the Prompts panel (`Ctrl+Shift+L`). Create, edit, and organize prompt templates with variable support (`{{branch}}`, `{{date}}`, `{{aiTool}}`). Send prompts directly to the active terminal.

## History Panel

View past prompt and session history from the History panel (`Ctrl+Shift+H`). Search and replay previous interactions.

## Integrations & System Panel

SubFrame exposes terminal state to external tools via a **Local API Server** and the **DTSP** (Desktop Text Source Protocol) discovery standard.

### System Panel

The System Panel (`Ctrl+Shift+U`) is an app dashboard showing version/update status, AI tool management, integration controls, and feature detection. It opens as a full-page view (like Overview) and includes:

- **Version & Update** — current version, update status with download/restart controls
- **AI Tool Picker** — switch between AI tools directly, with installed status indicators
- **API Server** — toggle on/off, port, auth token (copy/regenerate), connected clients, request count, TTS activity
- **DTSP** — toggle discovery registration on/off, registration status
- **Feature Detection** — scans Claude Code config for hooks, MCP servers, and skills
- **Quick Access** — health, shortcuts reference, prompt library

### Local API Server

SubFrame runs a localhost HTTP server (auto-assigned port, token auth) that external tools can query for terminal data:

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Server status (public, no auth) |
| `GET /api/selection` | Active terminal's selected text |
| `GET /api/context` | Terminal name, project, agent status |
| `GET /api/terminals` | List all terminals |
| `GET /api/buffer` | Visible terminal buffer content |
| `POST /api/tts` | Submit TTS text from hooks/scripts |
| `GET /api/tts/latest` | Most recent TTS message |
| `GET /api/events` | SSE event stream (selection-changed, tts-speak) |

Auth: `Authorization: Bearer <token>` header or `?token=<token>`. Token and port are in `~/.subframe/api.json`.

### DTSP (Desktop Text Source Protocol)

SubFrame registers as a DTSP source by writing `~/.dtsp/sources/subframe.json` on startup. Consumer apps (like [Conjure](https://github.com/user/conjure)) scan this directory to discover available text sources, verify the PID is alive, then query the API endpoints.

DTSP capabilities declared: `selection`, `context`, `buffer`, `events`, `tts`.

### TTS Endpoint

The `POST /api/tts` endpoint accepts speech-formatted text from Claude Code hooks with voice profiles (`summary`, `error`, `status`, `insight`, `general`) and priority levels (`high`, `normal`, `low`). Messages are broadcast as `tts-speak` SSE events for consumers like Conjure to auto-speak.

This enables **agent-initiated speech** — Claude generates a spoken summary via a hook, SubFrame stores and broadcasts it, and the TTS consumer speaks it. The text is pre-formatted for hearing, not reading.

> For the full integration spec, see the [Integrations](/integrations) reference.

### Settings > Integrations

Toggle the API Server and DTSP independently in Settings > Integrations. Both default to enabled.

## Keyboard Shortcuts

SubFrame has extensive keyboard shortcuts for navigating the interface without leaving the keyboard. Press `Ctrl+?` to open the shortcuts reference overlay at any time.

For the complete list, see the [Keyboard Shortcuts](/keyboard-shortcuts) reference.
