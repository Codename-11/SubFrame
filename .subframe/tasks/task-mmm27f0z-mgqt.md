---
id: task-mmm27f0z-mgqt
title: Expand unit test coverage for renderer hooks and components
status: pending
priority: medium
category: testing
blockedBy: []
blocks: []
createdAt: '2026-03-11T13:13:02.675Z'
updatedAt: '2026-03-11T13:13:02.675Z'
completedAt: null
context: Session 2026-03-11
---
Current test suite (190 tests) covers main-process logic well but has no renderer-side tests. Add unit tests for critical hooks (useTasks, useSettings, useSubFrameHealth) and key components (ViewTabBar, TasksPanel, RightPanel). Use React Testing Library + Vitest. Goal: catch prop/state regressions from dependency updates before they reach production.

## Steps
- [ ] Set up React Testing Library + jsdom environment in Vitest
- [ ] Mock Electron IPC for renderer tests
- [ ] Test useTasks hook (project switch, refetch, stale data)
- [ ] Test useUIStore (tab persistence, sub-view mapping)
- [ ] Test ViewTabBar (workspace badge, tab rendering)
- [ ] Test TasksPanel (filter, sort, CRUD dialogs)
- [ ] Test RightPanel (open in tab, panel switching)
- [ ] Add coverage thresholds to CI

## Acceptance Criteria
Renderer test infrastructure set up, at least 10 hook/component test files with meaningful coverage
