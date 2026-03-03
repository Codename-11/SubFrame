---
id: task-claude-detect
title: Detect if Claude Code is actually running
status: completed
priority: low
category: feature
blockedBy: []
blocks: []
createdAt: '2026-01-25T00:00:00.000Z'
updatedAt: '2026-03-02T23:38:15.863Z'
completedAt: '2026-03-02T23:38:15.863Z'
context: Session 2026-01-25 - Task delegation feature
---
Currently we track claudeCodeRunning with a simple boolean. Improve detection to actually check if Claude Code is running in terminal (parse terminal output for Claude prompt patterns).
