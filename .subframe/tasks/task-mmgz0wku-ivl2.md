---
id: task-mmgz0wku-ivl2
title: Hook-side terminal ID injection for session correlation
status: pending
priority: medium
category: feature
blockedBy: []
blocks: []
createdAt: '2026-03-07T23:45:09.101Z'
updatedAt: '2026-03-07T23:45:09.101Z'
completedAt: null
context: Session 2026-03-07
---
Have Claude hook scripts (pre-tool-use.js, post-tool-use.js) write terminal PID or env var into agent-state.json session entries, enabling deterministic terminal↔session mapping instead of timestamp heuristic.

## User Request
> Improve session↔terminal correlation accuracy

## Acceptance Criteria
agent-state.json sessions include terminal identifier; ptyManager uses it for exact matching instead of timestamp heuristic
