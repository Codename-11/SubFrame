Major feature release — adds the Activity Streams system for centralized execution visibility, redesigned Settings with sidebar navigation and search, close-window protection, task panel bulk actions, and numerous UX fixes.

## What's Changed

### Features
- **Activity Streams** - Centralized execution/output system with VS Code-style bottom bar. All AI operations (onboarding, pipeline, task enhance) route through it with real-time log streaming, heartbeat timers, and dismiss controls
- **Settings Sidebar Navigation** - Replaced horizontal tabs with a sidebar layout, added search filter across all settings, and 5 reusable setting components for consistent UI
- **Close-Window Protection** - Native OS warning dialog when closing with active agents, pipelines, or analyses. Themed AlertDialog for individual terminal tab close
- **Task Panel Bulk Actions** - Select mode with themed checkboxes, bulk Complete/Delete with confirmation, bulk Send to Terminal with optional wrapper prompt
- **Pop-Out Terminal Windows** - Detach terminals to separate windows for multi-monitor workflows (Ctrl+Shift+D)
- **Workspace Create Dialog** - Name input when creating new workspaces instead of hardcoded default
- **Prompts Top-Bar Button** - Prompts moved to its own shortcut in the main tab bar

### Improvements
- **Onboarding Analysis Progress** - Auto-shows terminal output during analysis, elapsed timer with line count, logarithmic progress bar creep
- **Pipeline Heartbeat** - Print-mode AI stages now show 10-second heartbeat updates instead of dead silence
- **Task Enhance Safety** - 2-minute timeout, multi-strategy JSON extraction, abort signal on timeout
- **Task Send-to-Terminal** - Now includes task ID, priority, category, status, and steps; auto-starts pending tasks
- **Top Bar Reorder** - Sub-Tasks, GitHub, Agents, Prompts, Pipeline, Overview

### Bug Fixes
- **Terminal Grid Overflow** - Extra grid slots no longer render as phantom rows when switching layouts
- **Terminal Scroll Retention** - Double-RAF restore prevents scrollbar reset on workspace switch
- **Task Edit Dialog** - Fixed overflow with proper flex layout (scrollable middle, fixed header/footer)
- **Reset Layout** - Now clears all persisted state including right panel width, grid layout, and cell sizes
- **Bulk Delete Safety** - Now requires confirmation dialog instead of instant deletion
- **Task Privacy Data Safety** - File write before delete prevents data loss on write failure
- **PTY Output Handlers** - Upgraded to named multi-handler system preventing handler conflicts
