Stability release focused on fixing the updater download toast lifecycle, filling the nearly-empty Output panel with meaningful system logs, and improving editor keyboard handling.

## What's Changed

### Bug Fixes
- **Updater toast download flow** — Clicking "Download" on the update notification no longer silently dismisses the toast. Fixed three independent root causes: sonner action auto-dismiss race condition, TanStack Query mutation identity churn causing spurious effect re-runs, and updater status loss after renderer hot-reloads
- **Editor F11 fullscreen toggle** — Global keydown listener for fullscreen no longer tears down and re-registers on every settings mutation, eliminating brief gaps where the shortcut wouldn't respond
- **SystemPanel layout** — Refactored to sidebar-nav settings layout with categorical grouping

### Improvements
- **Output channel coverage** — 7 managers now write to the Output panel (updater, plugins, settings, agent state, sessions, AI sessions, pipeline). The Extensions channel is no longer permanently empty. System-level events like update checks, plugin operations, AI session lifecycle, and pipeline errors are now visible in the Output tab instead of only in Electron DevTools
- **Updater hot-reload recovery** — The main process now tracks and re-broadcasts the last updater status when the renderer reloads, so download progress or "Restart Now" notifications survive hot-reloads
- **Global hooks IPC** — New `GET_GLOBAL_HOOKS` channel reads hooks configuration from `~/.claude/settings.json` with source label extraction for the System panel
