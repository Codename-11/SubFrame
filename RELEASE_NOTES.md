Fix release focused on terminal stability, task panel UX, and audit-driven hardening across the codebase.

## What's Changed

### Features
- **View tab bar** — VS Code-style tab bar for managing open full-view panels with close buttons and keyboard navigation
- **Terminal user message stepping** — Directional up/down navigation between user message markers in terminal scrollback, replacing the single "jump to last" button
- **Shortcuts panel** — Full-view panel replacing the modal dialog, integrated with the view tab bar system
- **Keyboard badge component** — Shared `<Kbd>` component for consistent shortcut display across the UI
- **Terminal tab index numbers** — Tabs 1-9 show index numbers for quick keyboard switching reference

### Improvements
- **Version-stamped deployments** — All deployed files (hooks, git hooks, workflows) include `@subframe-version` and `@subframe-managed` headers for tracking
- **Version-aware health check** — SubFrame Health detects outdated deployments by comparing embedded version stamps to current app version
- **Structural claude-settings validation** — Health check verifies all 5 hook event types are configured
- **User-edit resilience** — Files marked `@subframe-managed: false` are skipped during updates
- **Build pipeline safety** — `npm run verify:hooks` prevents hook script drift; included in quality gates and CI
- **Health panel UI** — Shows version transitions, missing hooks, user-managed badges, and skipped component counts
- **Task detail layout** — Single-column stacked layout in side panel, two-column grid in full-view; inline edit button next to Copy ID

### Bug Fixes
- **Terminal indicators lost on workspace switch** — Grace period state moved from React ref to terminal registry, surviving component remounts
- **Terminal onData race condition** — Reads terminal from registry instead of React ref, eliminating null-ref during terminal switch
- **Terminal resize choppiness during panel drag** — Skips fit() during active resize, single fit on drag end
- **Panel resize stuck on mouse-release outside window** — Window blur listener clears isResizing state as safety net
- **TaskDetail crash on undefined steps** — Guards `task.steps` with `?? []` fallback
- **Task dependency selects** — Replaced `document.getElementById` with controlled React state
- **Task markdown link security** — URL scheme validation before `shell.openExternal` (https/http only)
- **Managed-file opt-out check truncated** — Full content check instead of first 1024 bytes
- **Empty task steps silently dropped** — Filters empty-label steps before markdown conversion
- **Double terminal fit on drag end** — Clears debounce timer when subscriber fires
- **TaskTimeline pulse flash** — 3-keyframe seamless loop replaces abrupt opacity jump
- **Workspace switching context** — Ctrl+Alt shortcuts moved to always-mounted App component
- **Loading screen not dismissing** — React callback pattern for reliable overlay removal
- **Semver pre-release comparison** — Segment-by-segment numeric-aware comparison

### Other Changes
- `execSync` moved to top-level import in frameProject
- Hook system refactored with build/verify scripts
- Claude settings utilities extracted to shared module
