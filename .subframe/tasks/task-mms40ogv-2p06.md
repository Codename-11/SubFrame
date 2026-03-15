---
id: task-mms40ogv-2p06
title: Per-workspace UI state persistence
status: pending
priority: high
category: enhancement
blockedBy: []
blocks: []
createdAt: '2026-03-15T18:50:24.606Z'
updatedAt: '2026-03-15T18:50:24.606Z'
completedAt: null
context: Session 2026-03-15
---
When switching workspaces, UI state like active right panel, sidebar collapsed state, grid layout, and editor open files should be saved and restored per-workspace. Currently all UI state is global — switching from a workspace where you had GitHub panel open to one where you were using Sub-Tasks retains the old panel. Save UI preferences (activePanel, sidebarState, gridLayout, viewMode, editorOpenFiles) to the workspace data file and restore on switch.

## Steps
- [ ] Add uiPreferences field to workspace data model
- [ ] Save current UI state on workspace switch-away
- [ ] Restore UI state on workspace switch-to
- [ ] Handle missing preferences gracefully (first switch to a workspace)
