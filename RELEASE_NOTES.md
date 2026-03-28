This release adds MCP-based AI onboarding analysis, cooperative session control between Electron and web clients, and a redesigned workspace pill bar with smart ordering and hover expansion.

## What's Changed

### Features
- **MCP Onboarding Analysis** — AI analysis now uses Model Context Protocol for structured prompt delivery and result capture, with per-tool support for Claude, Codex, and Gemini
- **Session Control System** — cooperative control handoff between Electron and web clients with activity detection, idle auto-grant (30s), and automatic view-only mode for the non-controlling side
- **Session Control Banner** — persistent top-of-page banner showing connection status with Request/Grant/Take/Release control buttons
- **Terminal Input Gating** — keyboard input blocked on view-only side and during AI sessions, with "Enable Input" override button
- **Embedded Terminal in Onboarding** — real terminal display in the onboarding dialog via registry attach/detach (shows live AI TUI output)
- **Settings > Project Tab** — granular uninstall UI with per-component checkboxes, dry-run preview, and smart detection of user-modified files (e.g., AGENTS.md shared with Codex)
- **"Run AI Analysis" Button** — sidebar button to re-run onboarding analysis for already-initialized projects
- **Onboarding Review Enhancements** — expandable detail previews with tech stack chips, module lists, convention tags, decision cards, and select all/deselect all for suggested tasks

### Improvements
- **Workspace Pill Bar** — moved to left side of top bar; smart ordering (active workspaces first); section-level hover expand (3 collapsed, reveals rest on hover); configurable via Settings > General
- **Web Server Badge** — moved from collapsible Activity Bar to persistent Status Bar with control state indicator (Control/Viewing)
- **Default Theme** — Neon Traces and Logo Glow now enabled by default for SubFrame Classic
- **Per-Tool CLI Flags** — Claude (--dangerously-skip-permissions), Codex (--yolo), Gemini (--yolo) with correct MCP config patterns per tool
- **Analysis Timeout** — reduced from 10 minutes to 5 minutes
- **Onboarding Dialog** — only closable via X button (prevents accidental dismissal during analysis)
- **Activity Stream** — debounced TUI output to eliminate character-by-character noise in activity feed

### Bug Fixes
- **ConPTY Output Delay on Windows** — background AI terminals now use conptyInheritCursor: false, matching agent-forge's approach and eliminating the 30+ second output delay
- **Rollback State** — uninstall now clears main process session cache so re-initialization starts fresh
- **React Error #185 in Web Mode** — Dialog components properly forward refs, SettingsPanel unmounts when closed, dialog states never synced across clients
- **Sidebar Flashing on Web Connect** — live state sync suppressed during initial 1.5s hydration window
- **"Open Terminal" Race Condition** — EmbeddedTerminal detach checks if xterm was already moved by Terminal tab before detaching
- **MCP Permission Prompts** — auto-approval handler for Codex's MCP tool permission dialogs

## Installation and Update

Grab the latest installer from [GitHub Releases](https://github.com/Codename-11/SubFrame/releases/tag/v0.11.0-beta).

- **Windows**: SubFrame-Setup-0.11.0-beta.exe
- **macOS**: SubFrame-0.11.0-beta.dmg
- **Linux**: SubFrame-0.11.0-beta.AppImage

If you already have SubFrame installed, update through the in-app updater or the System Panel.
