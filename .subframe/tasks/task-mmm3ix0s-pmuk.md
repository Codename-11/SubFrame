---
id: task-mmm3ix0s-pmuk
title: Upgrade actions/upload-artifact to v7 (coordinated with download-artifact)
status: completed
priority: low
category: chore
blockedBy: []
blocks: []
createdAt: '2026-03-11T13:49:58.827Z'
updatedAt: '2026-03-11T14:20:17.266Z'
completedAt: '2026-03-11T14:20:17.266Z'
context: Session 2026-03-11
---
Dependabot PR closed — upload-artifact v4→v7 requires coordinated bump with download-artifact v4→v8 (incompatible artifact formats between major versions). Currently deferred in dependabot.yml ignore rules.

## Steps
- [ ] Identify all workflows using upload-artifact and download-artifact
- [ ] Upgrade both actions to v7/v8 simultaneously in all workflows
- [ ] Test CI pipeline (push a test tag or use workflow_dispatch)
- [ ] Remove upload-artifact ignore rule from dependabot.yml

## User Request
> Deferred dependency upgrade identified during Dependabot PR triage

## Acceptance Criteria
Both upload-artifact and download-artifact upgraded together across all workflows, CI passes on all workflows, dependabot.yml ignore rule removed
