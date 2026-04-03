---
id: task-mni6vy55-djk1
title: Add RENDERER_RELOADED handlers to managers with sticky broadcast state
status: pending
priority: medium
category: fix
blockedBy: []
blocks: []
createdAt: '2026-04-03T00:52:43.288Z'
updatedAt: '2026-04-03T00:52:43.288Z'
completedAt: null
context: Session 2026-04-03
---
5 managers broadcast sticky state but don't re-send on RENDERER_RELOADED: aiSessionManager, ptyManager (CLAUDE_ACTIVE_STATUS), aiToolManager, webServerManager, popoutManager/editorPopoutManager. Follow the pattern from updaterManager (track lastStatus, re-broadcast on RENDERER_RELOADED). Each is ~5 lines.
