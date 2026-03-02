---
id: task-subtask-enhancements
title: Sub-Task system enhancements (schema + UI)
status: pending
priority: medium
category: feature
blockedBy: []
blocks: []
createdAt: '2026-03-01T00:00:00Z'
updatedAt: '2026-03-01T22:56:20.875Z'
completedAt: null
context: Session 2026-02-28 - Sub-Task system discussion and CLAUDE.md improvements
---
Multiple improvements to the Sub-Task system. (1) Schema: Add `blockedBy` / `dependsOn` array fields to the task schema, allowing sub-tasks to reference other sub-task IDs they depend on. Update taskSchema in tasks.json, AGENTS.md, CLAUDE.md, and frameTemplates.js. (2) UI - In-Progress visual distinction: The Sub-Tasks panel should visually distinguish `in_progress` sub-tasks from `pending` — e.g., highlighted border, accent color indicator, or a pulsing dot similar to active sessions. (3) UI - Sort by priority: Sub-tasks should sort by priority (high → medium → low) within each status group, so high-priority items surface first. (4) UI - Blocked indicator: If `blockedBy` is populated and those sub-tasks aren't completed, show a blocked badge/icon on the sub-task card. (5) Schema update in templates: Update frameTemplates.js getTasksTemplate() to include the new fields in taskSchema.
(Bonus: Ability to pipe handwritten through AI to format properly per SubFrames task schema cleanly and appropriately without loss)

## User Request
> User said: 'we should add blockedBy or dependsOn fields - we should show task in_progress as you suggested - also sort by priority - etc enhancements'

## Acceptance Criteria
1. tasks.json schema includes `blockedBy` array field. 2. AGENTS.md and CLAUDE.md document the new field. 3. In-progress sub-tasks are visually distinct from pending in the UI. 4. Sub-tasks sort by priority within status groups. 5. Blocked sub-tasks show a visual indicator. 6. New project templates include updated schema.

## Notes
Keep backward compatible — `blockedBy` should be optional (default empty array). Existing sub-tasks without it should render normally. Consider whether `dependsOn` is a separate concept from `blockedBy` or an alias — recommend using `blockedBy` only for simplicity.
