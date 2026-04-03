---
id: task-mni6w2tx-upp8
title: Stabilize mutation object identity in useCallback deps across codebase
status: pending
priority: low
category: refactor
blockedBy: []
blocks: []
createdAt: '2026-04-03T00:52:49.364Z'
updatedAt: '2026-04-03T00:52:49.364Z'
completedAt: null
context: Session 2026-04-03
---
43 useCallback instances have TanStack Query mutation objects in dependency arrays, causing unnecessary callback recreation on every mutation state tick. Low severity (perf, not functional bugs). The ref pattern from UpdateNotification.tsx and useActivity.ts is the fix. Key files: Editor.tsx (6), PromptLibrary.tsx (3), PromptsPanel.tsx (4), useOnboarding.ts (5), AIAnalysisPanel.tsx (1), AIToolPalette.tsx (1).
