# v0.2.3-beta

## Highlights

**Usage polling rearchitected** — Off by default, fetch once on startup, click to refresh. Optional auto-polling with exponential backoff and persistent failure notification.

**Collapsed sidebar drawers** — All panel groups now visible in collapsed right panel with animated drawers for multi-panel groups.

**GitHub Changes default** — Changes panel replaces Issues as the entry point for the GitHub group.

## Improvements

- Usage indicator shows loading spinner during fetch with click debouncing
- Settings: toggle + conditional slider for usage auto-polling
- Collapsed right panel: 7 group icons with drawer expand for Agent hub (6 panels) and GitHub hub (5 panels)
- Exponential backoff on usage polling errors (doubles up to 8min cap)
- Toast notification after 5 consecutive polling failures with one-click disable

## Bug Fixes

- Usage polling no longer runs by default, eliminating unnecessary API calls and 429 errors
- GitHub keyboard shortcut (Ctrl+Shift+G) now opens Changes instead of Issues
