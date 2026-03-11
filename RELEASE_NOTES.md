Tab bar restructure, global prompts, project switch stability, and cross-project portability improvements.

## What's Changed

### Features
- **Tab bar restructure** — View shortcuts (Overview, Sub-Tasks, Agent Activity, Pipeline) moved from terminal tab bar to main ViewTabBar with sidebar toggle button
- **Workspace/project badge** — Shows workspace and project name in tab bar when sidebar is collapsed; click to expand
- **Open in tab** — Sidebar panels with full-view equivalents show a maximize icon to open as a tab
- **Tab persistence** — Open tabs saved to localStorage and restored across sessions
- **Tasks refresh button** — Manual refresh icon in TasksPanel toolbar
- **Global prompts** — User-level prompts at `~/.subframe/prompts.json` with promote/demote between project and global scope
- **Private sub-tasks** — Tasks can be marked private, stored in gitignored directory, fully functional in UI/CLI/hooks
- **Configurable source directory** — STRUCTURE.json updater reads `sourceDir` from `.subframe/config.json`

### Bug Fixes
- **Terminal bounce** — Message stepping indicators no longer flicker during active Claude output
- **Sub-view tab leak** — Stats, Decisions, Structure Map render within Overview tab instead of creating separate tabs
- **Stale data on project switch** — 5 hooks clear cached refs when project changes, preventing wrong-project data flash
- **Auto-update components** — Outdated managed components auto-synced on project load with loop prevention
- **Cross-project hooks** — Hooks detect `scripts/task.js` existence and fall back to `npx subframe task`
- **Codex wrapper recursion** — Self-detection via PATH comparison prevents infinite recursion
- **Task timeline pulse** — 3-keyframe seamless loop replacing 2-keyframe flash
- **IPC type mismatch** — `GET_TERMINAL_SESSION_NAME` type includes optional `sessionId`
