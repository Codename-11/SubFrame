Bug fix release targeting tab naming reliability, UI layout consistency, and usage pill placement.

## What's Changed

### Bug Fixes
- **Tab Name Cross-Contamination** - Terminals no longer swap names with each other; removed a fallback that picked the most recent project session when the correct session wasn't immediately available
- **Duplicate Rename Toasts** - Auto-rename events no longer fire multiple toasts from retry broadcasts; added deduplication guard and sessionId validation
- **Sub-View Close Button** - X button in Stats, Decisions, and Structure Map views now correctly closes the parent Overview tab instead of silently failing
- **Panel Buttons Restored to Sidebar** - ViewTabBar shortcut buttons (Sub-Tasks, Agent Activity, Pipeline, Overview) open the right sidebar panel again, restoring the original open/collapse/hide cycle
- **Agent Activity Stale Selection** - Removed fallback that could display an unrelated idle session when no active agent session exists

### Improvements
- **Usage Pill in Main Tab Bar** - Session and weekly usage indicators moved from the terminal tab bar to the main tab bar for persistent visibility
- **Full Text+Icon Shortcut Buttons** - View shortcuts restored to showing both icon and label instead of compact icon-only squares

### Other Changes
- Dependency bumps: @eslint/js, esbuild, CodeMirror, postcss, react-resizable-panels, actions/github-script, actions/upload-pages-artifact, electron-builder
- CI improvements: upgraded actions/checkout and actions/setup-node to v5, added build step to quality gates
