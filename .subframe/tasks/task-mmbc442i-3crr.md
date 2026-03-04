---
id: task-mmbc442i-3crr
title: 'Pipeline extensibility — custom stages, env vars, artifact output'
status: pending
priority: medium
category: feature
blockedBy:
  - task-mmbc3vlq-ardz
blocks: []
createdAt: '2026-03-04T01:04:56.729Z'
updatedAt: '2026-03-04T01:04:56.729Z'
completedAt: null
context: Session 2026-03-04
---
Enable custom stage support: 'run:' shell commands and 'uses:' script references in workflow YAML. Expose stage environment variables (PIPELINE_RUN_ID, PIPELINE_BRANCH, PIPELINE_BASE_SHA, PIPELINE_HEAD_SHA, PIPELINE_WORKTREE, PIPELINE_ARTIFACTS, PIPELINE_PROJECT_ROOT, PIPELINE_AI_TOOL). Implement file-based artifact output (custom stages write to PIPELINE_ARTIFACTS/content/*.md, comments/*.json, patches/*.json). Parallel job execution via DAG topological sort. See ADR-007 Sections 3.7-3.8.
