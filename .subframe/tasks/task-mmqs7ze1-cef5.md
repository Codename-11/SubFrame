---
id: task-mmqs7ze1-cef5
title: MarkdownPreview syntax highlighting respects theme
status: pending
priority: low
category: enhancement
blockedBy: []
blocks: []
createdAt: '2026-03-14T20:32:23.784Z'
updatedAt: '2026-03-14T20:32:23.784Z'
completedAt: null
context: Session 2026-03-14
---
MarkdownPreview.tsx has 2 hardcoded #d4a574 amber values in highlight.js inline CSS string. Code blocks in previews stay amber across all themes. Replace with CSS variable references.

## Steps
- [ ] Replace hardcoded colors in highlight.js CSS with var() references
- [ ] Verify rendering across all theme presets
