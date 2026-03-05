---
id: task-mmcuw59d-idrl
title: 'Pipeline: worktree isolation for stages'
status: pending
priority: medium
category: feature
blockedBy: []
blocks: []
createdAt: '2026-03-05T02:38:23.905Z'
updatedAt: '2026-03-05T02:38:23.905Z'
completedAt: null
context: Session 2026-03-05
---
Implement git worktree-based isolation for pipeline stages. Create a temporary worktree for the pipeline run so stages can modify files without affecting the user's working directory. The worktreePath field already exists in StageContext but is always null.
