System Panel, Local API Server with DTSP integration, and a wave of UX polish across terminal persistence, prompts, and app lifecycle.

## What's Changed

### Features
- **System Panel** — full app dashboard (Ctrl+Shift+U) with version/update status, AI tool picker, health, integrations, feature detection, shortcuts, and prompt library cards
- **AI Tool Picker** — switch AI tools directly from the System Panel with installed status indicators and start command display
- **Local API Server** — localhost HTTP server with token auth exposing terminal state to external tools; 7 endpoints for terminals, selection, buffer, context, and SSE events
- **DTSP Integration** — Desktop Text Source Protocol registration for auto-discovery by tools like Conjure; independent enable/disable toggle
- **Feature Detection** — scans Claude Code config for hooks, MCP servers, and skills; shows counts and availability hints
- **Integration Info Dialogs** — standardized info icon on each integration card with protocol docs, endpoints, and usage
- **Prompt Execution** — Shift+Click or Shift+Enter inserts prompt AND executes in terminal
- **Per-Project Panel State** — right sidebar remembers open/closed state per project
- **Overview/System Full-View** — dashboard panels open as full-page tabs by default
- **Copy Path** — right-click any project to copy its path
- **Settings > Integrations** — new tab with API Server and DTSP enable/disable toggles

### Improvements
- **Workspace selector always visible** — stays visible in file tree view, not just project list
- **CodeMirror selection highlight** — word under cursor now highlighted with whole-word matching
- **Terminal link tooltips** — Ctrl+Click links show hover tooltips with target URL/path
- **Usage tooltip cleanup** — cleaner data source indicators, mutual exclusion of stale/cache displays

### Bug Fixes
- **Close dialog uses in-app UI** — replaced native system dialog with themed SubFrame dialog
- **GracefulShutdownDialog styling** — fixed broken Tailwind class names (bg-deep → bg-bg-deep, etc.)
- **Terminal scroll-to-bottom** — fixed after workspace switch via deferred viewport sync
- **API server stale config** — cleans up api.json and DTSP file on crash recovery
- **Feature detection** — reads actual Claude config files, not SubFrame's own settings

### Other Changes
- Configurable max terminals (1–20 in Settings)
- API server audit fixes: stale PID cleanup, OPTIONS excluded from request count, 5s polling for live counters
