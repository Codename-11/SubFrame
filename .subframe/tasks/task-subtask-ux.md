---
id: task-subtask-ux
title: Sub-Task panel & modal UX overhaul
status: in_progress
priority: medium
category: feature
blockedBy: []
blocks: []
createdAt: '2026-03-01T00:00:00Z'
updatedAt: '2026-03-02T00:54:07.789Z'
completedAt: null
context: Session 2026-02-28 - Sub-Task system discussion
---
Comprehensive UX improvements to the Sub-Task system's UI. (1) Larger modal — increase max-width from 480px to ~640px, give description a proper resizable textarea. (2) Full schema support in modal — add fields for userRequest, acceptanceCriteria, and notes. These are required by the schema but currently only fillable via JSON. Make userRequest and acceptanceCriteria visible in edit mode but read-only for AI-populated content. (3) Detail/expand view — clicking a sub-task card opens a full detail view (inline expansion or larger modal) showing all fields including userRequest, acceptanceCriteria, notes, dates, and context. (4) Description truncation — cap card descriptions at 2-3 lines with expand/collapse toggle. (5) Search/filter by text — add a search input above the filter buttons to filter by title/description text. (6) Keyboard navigation — arrow keys to navigate cards, Enter to expand, 'n' to add new. (7) Send to Claude — button on detail view to copy sub-task context to clipboard or inject into terminal as a prompt. (8) Better validation — replace raw alert() with inline form validation and error styling.

## User Request
> User said: 'Can we add a sub-task to enhance the task system itself and UI management to have larger modal, better ui/ux, proper support for item list, etc?'

## Acceptance Criteria
1. Modal is larger with full schema fields available. 2. Sub-task cards have truncated descriptions with expand. 3. Detail view shows all fields. 4. Text search works across title/description. 5. Keyboard navigation works. 6. Form validation uses inline errors not alert(). 7. Send-to-Claude copies sub-task context.

## Notes
Separate from task-subtask-enhancements which covers schema changes (blockedBy, sorting, in-progress styling). This sub-task is about the UI/UX of the panel and modal themselves. Files affected: index.html (modal markup), tasksPanel.js (rendering, events, modals), ui.css (modal sizing, card styles, form styles).
