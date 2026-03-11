---
id: task-mmm3ivrs-7w35
title: Upgrade recharts to v3 (breaking API migration)
status: pending
priority: medium
category: chore
blockedBy: []
blocks: []
createdAt: '2026-03-11T13:49:57.207Z'
updatedAt: '2026-03-11T13:49:57.207Z'
completedAt: null
context: Session 2026-03-11
---
Dependabot PR #11 closed — recharts 2→3 has breaking API changes affecting src/renderer/components/ui/chart.tsx. Tooltip payload/label props removed from type, legend payload type changed. Currently deferred in dependabot.yml ignore rules.

## Steps
- [ ] Review recharts v3 migration guide
- [ ] Audit chart.tsx for all breaking API usage
- [ ] Update chart.tsx tooltip and legend types/props
- [ ] Visually verify all charts render correctly
- [ ] Run npm run check — all gates pass
- [ ] Remove recharts ignore rule from dependabot.yml

## User Request
> Deferred dependency upgrade identified during Dependabot PR triage

## Acceptance Criteria
recharts upgraded to v3, chart.tsx updated for new API, all charts render correctly, npm run check passes, dependabot.yml ignore rule removed
