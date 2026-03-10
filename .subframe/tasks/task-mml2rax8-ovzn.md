---
id: task-mml2rax8-ovzn
title: Version-stamped component update system
status: completed
priority: high
category: feature
blockedBy: []
blocks: []
createdAt: '2026-03-10T20:40:44.300Z'
updatedAt: '2026-03-10T20:40:48.797Z'
completedAt: '2026-03-10T20:40:48.797Z'
context: Session 2026-03-10
---
Add version stamps (@subframe-version, @subframe-managed) to all deployed templates. Improve health check with version-aware detection, structural claude-settings validation, user-edit resilience (opt-out via @subframe-managed: false). Add build pipeline safety (verify:hooks in check/CI/pre-commit). Ensures projects initialized with SubFrame can be reliably updated when SubFrame itself is updated.

## User Request
> Ensure that if we make changes or enhancements or add more hooks, anything we initialize in other projects can be updated along with the version of SubFrame.

## Acceptance Criteria
All deployed files contain @subframe-version header. Health panel detects outdated versions. Users can opt out of managed updates. Build pipeline prevents scripts/hooks/ drift.
