---
id: task-mmgz0wpb-6pzb
title: Agent state session cleanup / rotation
status: pending
priority: low
category: chore
blockedBy: []
blocks: []
createdAt: '2026-03-07T23:45:09.262Z'
updatedAt: '2026-03-07T23:45:09.262Z'
completedAt: null
context: Session 2026-03-07
---
agent-state.json accumulates sessions indefinitely (currently 3300+ lines). Add rotation logic: archive completed sessions older than N days, cap max sessions, or prune on startup.

## User Request
> Prevent agent-state.json from growing unbounded

## Acceptance Criteria
agent-state.json stays bounded; old completed sessions are pruned or archived
