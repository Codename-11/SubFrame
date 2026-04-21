---
id: task-mn3t6lif-8ogg
title: Settings UI for terminal persistence
status: in_progress
priority: medium
category: feature
blockedBy: []
blocks: []
createdAt: '2026-03-23T23:20:19.046Z'
updatedAt: '2026-04-11T22:42:24.721Z'
completedAt: null
context: Session 2026-03-23
---
Add UI controls in SettingsPanel for the new terminal persistence settings: restoreOnStartup toggle, restoreScrollback toggle, autoResumeAgent dropdown (auto/prompt/never), agentExitTimeout slider, maxScrollbackExport input. These settings exist in settingsManager but have no UI yet.

## Notes
[2026-04-11] Split-tree is now a unified editor-group container (Phase 1-3 of task-mnuw7wxh-py85). Persistence layer bumped to v2 (backward compat in deserializeTree). Remaining Settings UI work: restore-on-launch toggle, per-project vs global preference, respect tab-kind in hydration.

## Notes
[2026-04-11] Layout persistence refactor landed via binary split tree — remaining work is user-facing Settings toggle UI for terminal persistence preferences (restore on launch, per-project vs global, etc.). Tree serialization + hydration is in useTerminalStore with localStorage key 'subframe-layout-trees-v1'.
