---
id: task-mmbc3vlq-ardz
title: Git integration and workflow configuration
status: pending
priority: medium
category: feature
blockedBy:
  - task-mmbc3cjb-je2v
  - task-mmbc3ly5-o4ih
blocks: []
createdAt: '2026-03-04T01:04:45.757Z'
updatedAt: '2026-03-04T01:04:45.757Z'
completedAt: null
context: Session 2026-03-04
---
Implement git hook integration: optional pre-push hook that triggers pipeline runs, worktree isolation for mutable stages (via gitBranchesManager.addWorktree), branch filtering from workflow YAML (on.push.branches glob matching). Add WorkflowEditor component using CodeMirror for YAML editing. Store workflows per-project in .subframe/workflows/. Add default review.yml workflow template to frameTemplates.ts. See ADR-007 Sections 3.6-3.7.
