Pipeline AI controls, keyboard shortcuts overhaul, workspace navigation, task editor enhancements, and full GitHub repo setup for public readiness.

## What's Changed

### Features
- **Pipeline max-turns control** — AI agent stages support `max-turns` config in workflow YAML (default 25, 0 = unlimited), with "Re-run Unlimited" button when a stage hits the turn limit
- **Pipeline agent heartbeat logging** — Agent-mode stages emit periodic heartbeat logs and elapsed time counter in the timeline, replacing silent long-running stages
- **Pipeline failure tracking** — Stages track failure reason (max-turns, timeout, error) for targeted retry UI and distinct visual indicators
- **Centralized shortcut registry** — Single source of truth for all keyboard shortcuts; help modal now has search filter
- **Workspace keyboard switching** — `Ctrl+Alt+1-9` jumps to workspace by index, `Ctrl+Alt+[/]` cycles prev/next, collapsed sidebar has workspace switcher
- **Quick Tasks palette** — `Ctrl+'` overlay for fuzzy-search across active sub-tasks with status dots and priority badges
- **Command palette enhancements** — Added Pipeline, Prompt Library, and dynamic Workspaces groups
- **Enhanced task detail view** — Two-column layout with metadata card, step progress, dependency resolution, and AI-Enhance button
- **Task dependency linking UI** — Blocked-by and Blocks fields with select + removable badge pattern
- **Terminal grid slot retention** — Drag-swap positions persist across view mode changes and app restarts

### GitHub & CI Setup
- **Claude PR auto-review** — GitHub Action reviews every PR for pattern adherence, code quality, and project fit
- **`@claude` interactive mentions** — Mention `@claude` in any issue or PR comment for on-demand AI help
- **Issue auto-labeling** — Zero-cost keyword-based area and platform labels on issue open
- **Issue triage workflow** — Claude-powered triage when `needs-triage` label is applied
- **Dependabot** — Weekly npm and GitHub Actions dependency updates with grouped dev deps
- **Issue templates** — Bug report and feature request YAML forms with structured fields
- **PR template** — Checklist for quality gates, changelog, and conventions
- **CONTRIBUTING.md, SECURITY.md, REVIEW.md** — Contributor guide, vulnerability reporting, and Claude review rules
- **Ko-fi funding** — GitHub sponsor button

### Bug Fixes
- **Pipeline cancel on Windows** — Process tree kill now uses `taskkill /F /T` instead of SIGTERM
- **CodeMirror text selection in dialogs** — Radix focus trap no longer intercepts CodeMirror mouse events
- **Task priority not sortable** — Split into separate sortable Category and Priority columns
- **Command palette GitHub label** — Corrected to "GitHub" (was "GitHub Issues")
- **Shortcuts modal duplicate** — Removed duplicate Ctrl+Shift+Y entry
- **Prompt Library unreachable from palette** — Added event bridge for command palette trigger
- **Sensitive files tracked in git** — Untracked local settings and pipeline runs files
- **npm audit vulnerabilities** — Fixed minimatch and tar issues in build-time deps

### Other Changes
- Pipeline workflows updated to use agent mode with explicit max-turns limits
- CI and Claude review workflows use concurrency groups to cancel superseded runs
- Removed dead PipelineLogView.tsx component
