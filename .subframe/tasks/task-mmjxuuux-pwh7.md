---
id: task-mmjxuuux-pwh7
title: 'Repo setup: issue templates, PR template, Claude CI review, contributing guide'
status: completed
priority: high
category: infrastructure
blockedBy: []
blocks: []
createdAt: '2026-03-10T01:35:45.848Z'
updatedAt: '2026-03-10T01:41:20.104Z'
completedAt: '2026-03-10T01:41:20.104Z'
context: Session 2026-03-10
---
Full GitHub repo setup for public readiness. Add issue templates (bug report, feature request, question), PR template, CONTRIBUTING.md, Claude-powered PR review workflow, SECURITY.md, and CODE_OF_CONDUCT.md. Configure Claude to review PRs for pattern adherence, code quality, and project fit.

## Steps
- [ ] Create .github/ISSUE_TEMPLATE/ (bug, feature, question)
- [ ] Create .github/PULL_REQUEST_TEMPLATE.md
- [ ] Create CONTRIBUTING.md
- [ ] Add Claude PR review workflow (.github/workflows/claude-review.yml)
- [ ] Create SECURITY.md
- [x] Verify all templates render correctly

## User Request
> Create proper issue templates, ensure Claude is configured for CI and PR review (@claude inspect for pattern adherence, suggestions, project fit), contributing guide — goal is public readiness for external contributors.

## Acceptance Criteria
Issue templates exist and work, PR template guides contributors, Claude reviews PRs automatically on open/update, CONTRIBUTING.md explains workflow, repo is ready for external contributors
