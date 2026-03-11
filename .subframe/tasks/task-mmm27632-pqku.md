---
id: task-mmm27632-pqku
title: E2E testing with Playwright/Electron
status: pending
priority: medium
category: testing
blockedBy: []
blocks: []
createdAt: '2026-03-11T13:12:51.086Z'
updatedAt: '2026-03-11T13:12:51.086Z'
completedAt: null
context: Session 2026-03-11
---
Set up end-to-end testing for SubFrame using Playwright with Electron support. Cover critical user flows: project switching, terminal creation, task management, settings persistence. This catches runtime/visual regressions that unit tests miss — especially important for dependency updates that pass typecheck but break UI behavior.

## Steps
- [ ] Research Playwright Electron testing setup
- [ ] Configure Playwright with electron launch
- [ ] Write test: project open and terminal creation
- [ ] Write test: workspace switching
- [ ] Write test: task panel CRUD
- [ ] Write test: settings persistence across restart
- [ ] Write test: tab bar navigation and persistence
- [ ] Add E2E job to CI workflow

## Acceptance Criteria
Playwright configured for Electron, at least 5 core user flow tests passing in CI
