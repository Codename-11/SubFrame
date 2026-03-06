Theme system, pipeline engine, and a wave of terminal grid and IPC stability fixes.

## What's Changed

### Features
- **Theme System** - Full theme customization with 4 built-in presets (Classic Amber, Synthwave Traces, Midnight Purple, Terminal Green), custom color pickers, and feature toggles (neon traces, CRT scanlines, logo glow)
- **Appearance Settings** - New first tab in Settings with preset gallery, live theme switching, and save/delete custom themes
- **Pipeline System** - Configurable CI/review pipelines with AI-powered stages, YAML workflow templates (review, task-verify, health-check), and run history tracking
- **Terminal Grid Drag-to-Swap** - Slot-based grid model supports dragging terminals between filled and empty cells with visual feedback
- **Pane-Targeted Terminal Creation** - Clicking "New Terminal" in an empty grid pane places the terminal in that specific pane
- **Usage Element Resilience** - Session usage pill persists through API errors with stale-while-revalidate pattern and contextual error tooltips
- **Docs Site Theme** - Landing page redesigned with synthwave palette (purple/pink/cyan), OG image, platform-aware downloads

### Improvements
- **Task Categories** - Added `enhancement`, `research`, and `bug` categories with color-coded badges across all task views (Kanban, Graph, Timeline)
- **Task Creation** - Enhanced dialog with step management, progress tracking, and markdown description support

### Bug Fixes
- **IPC Clone Error** - Fixed "An object could not be cloned" firing on every terminal creation (React MouseEvent leaking through `onClick={handler}` into optional parameter)
- **Grid Drag** - Fixed drag-to-empty pane and pane swapping not working (replaced ordered-list model with slot-based positions)
- **Nested Button Violation** - Fixed `<button>` inside `<button>` HTML error in Settings theme preset gallery
- **Usage Text Readability** - Fixed unreadable "Usage unavailable" text in error state
- **Hook Paths** - Fixed hook commands failing when working directory is a subdirectory (anchored to git root via `git rev-parse`)
- **Ctrl+Shift+T in Grid** - Fixed keyboard shortcut not spawning terminal in grid mode

### Documentation
- Docs site restructured for beta launch with community section and updated guides
- Social preview meta tags and OG image added
- Hook path safety guidance added to AGENTS.md

---

> This is a beta release. Expect rough edges — please report issues on GitHub.
