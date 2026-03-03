---
id: task-struct-desc
title: Improve description parsing in structure script
status: completed
priority: low
category: fix
blockedBy: []
blocks: []
createdAt: '2026-01-25T00:00:00.000Z'
updatedAt: '2026-03-02T23:30:23.064Z'
completedAt: '2026-03-02T23:30:23.064Z'
context: Session 2026-01-25 - Structure auto-update script
---
update-structure.js currently parses file descriptions as single letters. Fix extractDescription() to properly extract JSDoc comments and multi-line descriptions.
