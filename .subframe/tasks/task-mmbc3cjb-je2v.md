---
id: task-mmbc3cjb-je2v
title: 'Built-in pipeline stages — lint, test, describe, critique, freeze'
status: pending
priority: high
category: feature
blockedBy:
  - task-mmbc33h2-v7or
blocks: []
createdAt: '2026-03-04T01:04:21.046Z'
updatedAt: '2026-03-04T01:04:21.046Z'
completedAt: null
context: Session 2026-03-04
---
Implement the built-in stage handlers in pipelineStages.ts: critique (AI code review → CommentArtifacts), lint (discover+run linters → PatchArtifacts with cached lint.sh), describe (PR title+body+Mermaid → ContentArtifact), test (run/generate tests → ContentArtifact with verdict), freeze (auto-apply pre-freeze patches, lock worktree), push (git push via gitBranchesManager), create-pr (gh pr create from accumulated artifacts). Each handler follows the StageHandler interface. See ADR-007 Section 3.4.
