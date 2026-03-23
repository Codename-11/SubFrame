GitHub Actions workflows, Claude Code shortcut fixes, and usage tooltip cleanup.

## What's Changed

### Features
- **GitHub Workflows tab** — new Workflows panel in the GitHub section showing all repo workflows with recent run statuses (success/failure/in-progress), branch, title, and click-to-open on GitHub

### Bug Fixes
- **Claude Code shortcuts unblocked** — Ctrl+T (task toggle), Ctrl+I, Ctrl+H, Ctrl+E no longer intercepted by SubFrame; pass through to Claude Code's native handlers
- **Usage tooltip "(soon)"** — stale reset countdowns now hidden instead of showing "(soon)" indefinitely when cached data has expired
- **GitHub icon** — GitHub panel button now shows the proper GitHub icon instead of a generic diff icon
