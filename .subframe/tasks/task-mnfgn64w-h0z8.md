---
id: task-mnfgn64w-h0z8
title: Periodic AI tool capability verification workflow
status: pending
priority: low
category: docs
blockedBy: []
blocks: []
createdAt: '2026-04-01T03:02:31.375Z'
updatedAt: '2026-04-01T03:02:31.375Z'
completedAt: null
context: Session 2026-04-01
---
Create a checklist/workflow for verifying AI tool capabilities against live docs before releases. Could be a pipeline workflow, a script, or documented in AGENTS.md. Should check the hooksDocsUrl for each tool, compare against AIToolFeatures defaults, and flag discrepancies. Update the Last verified date in ai-tool-capabilities.md.

## Steps
- [ ] Document verification checklist in AGENTS.md or docs-internal
- [ ] Optionally: create a pipeline workflow that fetches live docs and compares
- [ ] Update Last verified date in ai-tool-capabilities.md

## Acceptance Criteria
Documented process for verifying tool capabilities. Can be run before releases to catch stale feature flags.
