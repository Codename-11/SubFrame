## What's New in v0.5.5-beta

### Features

- **Asymmetric Grid Layouts** — New terminal grid options: 2L1R, 1L2R, 2T1B, 1T2B alongside existing NxN grids. Mix full-height and split panes for flexible workspace layouts.
- **Enhanced CLI** — `subframe init [path]` command with polished colored output (checkmarks, categorized file creation, skip detection). Also adds `subframe --version` and improved `--help`.
- **Update Notification Dismiss** — "Later" button on both update-available and update-ready toasts.

### Fixes

- **Hook guard for sub-repos** — Hook commands now silently exit when `.subframe/hooks/` doesn't exist (e.g., in nested git repos), instead of crashing with MODULE_NOT_FOUND.
- **projectInit.js fully synced** — CLI init now creates all files (tasks dir, docs-internal, workflows, onboard skill) matching the Electron app init.
- **Right panel overflow** — Fixed content cutoff on the right panel.
- **CI workflows fixed** — Both CI and deploy-docs workflows handle cross-platform lock file differences.

### Documentation

- **Full documentation restructure** — New Introduction page, reorganized sidebar (Guide + Reference groups), blog sidebar.
- **3 new reference pages** — Sub-Tasks, Hooks & Skills, Pipeline Workflows.
- **22-issue content audit** — AI tool explanations for beginners, standardized Node.js 20+, fixed shortcuts, removed nonexistent features, added missing feature docs.

### Promo Video

- Updated intro video to match current app UI (ViewTabBar, asymmetric grids, activity bar, 6 panel toggles).
