Major UX overhaul for onboarding, terminal persistence, and link interaction — plus workspace reorder and CodeMirror selection fix.

## What's Changed

### Features
- **Onboarding close confirmation** — three-way dialog: Keep Open, Cancel Analysis, or Continue in Background
- **Onboarding stall detection** — yellow warning banner after 30s of no AI output with duration counter
- **Onboarding timeout countdown** — live elapsed/total timer and "Retry with extended timeout" on failures
- **Ctrl+Click terminal links** — web URLs and file paths both require Ctrl+Click with VS Code-style hover tooltips
- **Workspace reorder** — Move Up/Move Down in workspace options menu, persisted to disk
- **Default global prompts** — 7 starter prompts seeded into existing prompt libraries on upgrade
- **Graceful shutdown dialog** — warns about in-progress analysis and pipelines before app close
- **Asymmetric terminal grid layouts** — 4 new 3-slot layouts: 2+1, 1+2, 2/1, 1/2

### Improvements
- **Terminal tab/grid persistence** — two-phase restore fixes reorder and grid slot loss across workspace swaps and app restarts
- **Background terminal focus** — background terminals no longer steal active terminal focus
- **Usage stats** — hybrid 4-layer data source with local cache priority and rich tooltip

### Bug Fixes
- **CodeMirror selection offset** — highlight now aligns with text (lineHeight mismatch fix)
- **Terminal tab order lost on restart** — deferred restoration waits for all terminal IPC events
- **Prompt seeding** — merges missing default prompts into existing libraries instead of skipping

### Other Changes
- Dependency bumps: zustand 5.0.12, esbuild 0.27.4, react-resizable-panels 4.7.3, framer-motion update
