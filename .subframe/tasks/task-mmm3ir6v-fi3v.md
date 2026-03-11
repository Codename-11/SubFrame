---
id: task-mmm3ir6v-fi3v
title: Upgrade @eslint/js to v10 (coordinated eslint ecosystem bump)
status: pending
priority: medium
category: chore
blockedBy: []
blocks: []
createdAt: '2026-03-11T13:49:51.270Z'
updatedAt: '2026-03-11T13:49:51.270Z'
completedAt: null
context: Session 2026-03-11
---
Dependabot PR #14 closed — @eslint/js 9→10 requires coordinated bump of eslint, @eslint/js, and typescript-eslint together due to peer dependency conflicts. Currently deferred in dependabot.yml ignore rules.

## Steps
- [ ] Check latest compatible versions of eslint, @eslint/js, typescript-eslint
- [ ] Update all three packages simultaneously
- [ ] Fix any eslint config breaking changes
- [ ] Run npm run check — all gates pass
- [ ] Remove @eslint/js ignore rule from dependabot.yml

## User Request
> Deferred dependency upgrade identified during Dependabot PR triage

## Acceptance Criteria
All three packages upgraded together, eslint config updated if needed, npm run check passes, dependabot.yml ignore rule removed
