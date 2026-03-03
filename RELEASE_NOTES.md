# SubFrame v0.1.0-beta.2

## Highlights

- **Terminal Grid UX** — Keyboard shortcuts, resize persistence, and maximize-in-place
- **Command Palette** — Quick access to all actions via `Ctrl+/` or `Ctrl+Shift+P`
- **Onboarding & Prompt Library** — First-run experience and reusable prompt management
- **Auto-Updater** — Electron auto-update with toast notifications
- **Keyboard Shortcut Audit** — VS Code-aligned shortcuts throughout

## New Features

### Terminal Grid Improvements
- `Ctrl+G` to toggle between grid and tab view
- Grid resize persistence — custom column/row sizes saved per layout, restored on switch
- Maximize-in-place — click Focus button or double-click header to expand a cell full-size; `Esc` to restore
- Wider resize handles (4px) with visible hover indicator lines
- "Next Grid Layout" / "Previous Grid Layout" commands in command palette

### Command Palette (`Ctrl+/` or `Ctrl+Shift+P`)
- Searchable command list for panels, views, terminal actions, sidebar, navigation, and settings
- Keyboard shortcut hints shown inline

### Prompt Library (`Ctrl+Shift+L`)
- Save, organize, and reuse prompts across sessions
- Quick-insert into active terminal

### Onboarding Dialog
- First-run setup wizard for new users
- Project initialization guidance

### What's New Panel
- In-app changelog viewer for tracking new features

### Auto-Updater
- Electron auto-update integration with non-intrusive toast notifications

## Keyboard Shortcut Changes

| Before | After | Action |
|--------|-------|--------|
| — | `Ctrl+G` | Toggle grid view |
| — | `Ctrl+Shift+P` | Command palette (VS Code alias) |
| `Ctrl+Shift+P` | `Ctrl+Shift+X` | Plugins panel (VS Code Extensions alignment) |

## Improvements

- Warp-style terminal UX with GPU rendering and animated tabs
- Enhanced project health checks and AGENTS.md template versioning
- Improved hooks, skills, and task tracking system
- Updated documentation site with guides and accessibility fixes

## Quality

- TypeScript strict-mode: clean
- ESLint: 0 errors
- Tests: 95/95 passing

---

> This is a beta release. Expect rough edges — please report issues on GitHub.
