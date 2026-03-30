---
id: task-mndoup0a-fkmr
title: 'Hot-update: renderer-only reload + session snapshot/restore (B+C hybrid)'
status: completed
priority: high
category: feature
blockedBy: []
blocks: []
createdAt: '2026-03-30T21:16:47.001Z'
updatedAt: '2026-03-30T22:47:52.464Z'
completedAt: '2026-03-30T22:47:52.464Z'
context: Session 2026-03-30
---
Allow updating SubFrame without destroying terminal sessions. Phase 1 (C): Snapshot session state (scrollback, CWD, running command, agent context) before update, restore after restart with auto-resume via --continue. Phase 2 (B): Detect renderer-only updates and hot-reload BrowserWindow without restarting main process — PTYs survive natively. Phase 3 (future/A): PTY broker daemon that owns PTYs independently of Electron lifecycle, enabling true detach→update→reattach.

## User Request
> Allow updating without destroying terminal sessions. Keep 10+ claude/codex sessions open across updates.

## Acceptance Criteria
Renderer-only changes hot-reload without PTY interruption. Main process changes snapshot and restore terminal sessions with scrollback and auto-resume agents.
