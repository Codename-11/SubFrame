This release makes code editing a first-class experience in SubFrame — files open as persistent tabs alongside terminals, the FileTree gains full CRUD operations and smart filtering, and workspace pills dynamically surface your most active projects.

## What's Changed

### Features
- **Editor Tabs in ViewTabBar** — Files open as dedicated tabs alongside the Terminal tab. Both are accessible simultaneously — no more choosing between editor and terminal
- **Split Code + Preview** — Side-by-side editing and live preview for Markdown, HTML, CSS, and SVG files via a new toolbar button
- **Breadcrumb Navigation** — Clickable path bar above the inline editor for quick orientation in deeply nested files
- **File Linting** — Real-time syntax diagnostics for JSON, YAML, CSS/SCSS/LESS, and HTML directly in the editor
- **New Language Modes** — Syntax highlighting for Go, Shell/Bash, Dockerfile, TOML, and PowerShell
- **File CRUD Context Menu** — VS Code-style right-click menu with New File, New Folder, Rename, Duplicate, Delete, Open in Terminal, Copy Relative Path, Copy File Name, and Collapse All — all with icons
- **`.gitignore` Filtering** — FileTree respects `.gitignore` rules (including nested), significantly reducing noise
- **Lazy Directory Loading** — No more 5-level depth limit. Directories load children on demand with loading spinners
- **File Watcher** — Tree auto-refreshes when files change on disk (chokidar-based, debounced, gitignore-aware)
- **Dynamic Workspace Pills** — Pills auto-sort by activity: running agents first (pulsing green), then terminals (blue), then idle. Smooth Framer Motion animations when order changes
- **Workspace Pill Settings** — Toggle auto-sort and configure max visible pills. Manual drag reorder overrides auto-sort with a reset button

### Improvements
- **Persistent Editor Sessions** — Open editor tabs and the active file survive page reloads and project switches
- **Editor Settings Toggle** — "Open Files in Tabs" setting (default: on) with overlay dialog as opt-in fallback
- **Inline Input for File Operations** — VS Code-style in-tree text input for create and rename with smart filename selection
- **Delete Confirmation Dialog** — Warns about recursive directory deletion before proceeding
- **Three-Tier Activity Indicators** — Workspace pills distinguish between agent sessions (green pulse), terminal-only (blue dot), and idle (muted)

### Bug Fixes
- **Path Traversal Hardening** — File CRUD validates absolute paths and blocks cross-drive `..` traversal
- **Dirty Tab Close Guard** — Closing an editor tab with unsaved changes now prompts for confirmation
- **Session Restore Validation** — Editor tabs filtered to current project scope, preventing ghost tabs from deleted files
- **HTML Linter Accuracy** — Rewrote scanner to handle `>` in quoted attributes, skip comments, and ignore script/style contents
- **CSS Linter Windows CRLF** — No longer falsely reports unterminated strings with `\r\n` line endings
- **File Duplicate Timeout** — 5-second timeout prevents hanging on IPC failure
- **Editor State Race Condition** — Atomic Zustand updates prevent duplicate entries from rapid double-clicks
- **File Watcher Resilience** — Watcher initialization wrapped in try/catch to prevent incomplete state
