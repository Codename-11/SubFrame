---
id: task-mn14eui7-b72d
title: SubFrame System Panel — app dashboard with AI tool management
status: completed
priority: medium
category: feature
blockedBy: []
blocks: []
createdAt: '2026-03-22T02:11:21.197Z'
updatedAt: '2026-03-22T14:54:53.699Z'
completedAt: '2026-03-22T14:54:53.699Z'
context: Session 2026-03-22
---
Add a dedicated System panel/view (similar to Overview but for SubFrame itself) that surfaces app-level information and management in a clean, unified UI. Includes: version info and update status, AI tool configuration and feature detection, keyboard shortcuts reference, integration status, tips/hints, and system health. Should also detect and surface AI tool capabilities (e.g. Claude Code channels, MCP servers, permissions) and suggest relevant features the user hasn't tried yet.

## Steps
- [ ] Design panel layout and sections (version, AI tools, shortcuts, integrations, tips)
- [ ] Implement AI tool feature detection (scan capabilities, suggest unused features)
- [ ] Build System panel component with all sections
- [x] Add sidebar entry and routing

## User Request
> Add a subtask for enhancing our SubFrame system itself with a System panel/view similar to overview but for SubFrame itself - updates, version, integrations, hints, shortcuts, etc. Also manage AI tools - detect used features and link/suggest such as the new channels feature for claude code

## Acceptance Criteria
Panel accessible from sidebar or view tabs. Shows: app version + update status, AI tool config with feature detection, shortcuts summary, integration/plugin status, contextual tips. Clean, scannable layout — not a settings dump.
