This release introduces hot-update support so terminal sessions survive app restarts, plus stable workspace pills and shell-ready detection for AI tool launch.

## What's Changed

### Features
- **Terminal Session Snapshot/Restore** — Active terminal sessions are serialized (CWD, shell, scrollback, dimensions, AI agent state) before app quit or update and automatically restored on next launch. Uses atomic file writes to prevent corruption. Respects `restoreOnStartup`, `restoreScrollback`, and `autoResumeAgent` (auto/prompt/never) settings.
- **Renderer Hot Reload** — UI-only updates reload the renderer without killing the main process or terminal sessions. PTYs stay alive; xterm instances resync from backlogs via the new `TERMINAL_RESYNC` IPC channel.
- **Pinned Workspace Pills** — Collapsed workspace pills now maintain stable positions using LRU slot tracking. Switching between pinned workspaces just moves the active highlight — no reordering. Selecting a workspace from the expanded overflow replaces the least-recently-used pill.
- **Shell-Ready Detection** — Starting an AI tool now waits for shell prompt detection (`TERMINAL_SHELL_READY` IPC) instead of a blind 1-second delay, with a 3-second fallback. Fixes garbled first command on slow-starting PowerShell sessions.

### Bug Fixes
- **Double-save race condition** — `before-quit` snapshot is now skipped if graceful shutdown already saved, preventing file corruption from concurrent writes
- **Terminal dimensions** — Session snapshots now capture actual PTY cols/rows instead of hardcoded 80x24
- **Per-tool agent resume** — Snapshot restore uses `claude --continue` for Claude Code and plain relaunch for Codex/Gemini
- **Session ID on resync** — Hot reload now passes `sessionId` through to the Zustand store for proper session tracking

## Installation and Update

Grab the latest installer from [GitHub Releases](https://github.com/Codename-11/SubFrame/releases/tag/v0.13.0-beta).

- **Windows**: SubFrame-Setup-0.13.0-beta.exe
- **macOS**: SubFrame-0.13.0-beta.dmg

If you already have SubFrame installed, update through the in-app updater or the System Panel.
