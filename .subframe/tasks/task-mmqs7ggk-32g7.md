---
id: task-mmqs7ggk-32g7
title: StructureMap D3 graph uses CSS variables for colors
status: pending
priority: low
category: enhancement
blockedBy: []
blocks: []
createdAt: '2026-03-14T20:31:59.251Z'
updatedAt: '2026-03-14T20:31:59.251Z'
completedAt: null
context: Session 2026-03-14
---
StructureMap.tsx has 14+ hardcoded amber and background color values in D3 SVG rendering. Module graph stays amber across all themes. Refactor MODULE_COLORS and inline styles to read from CSS variables.

## Steps
- [ ] Replace MODULE_COLORS hardcoded values with CSS variable reads
- [ ] Replace inline style background/text colors with CSS variable reads
- [ ] Add runtime refresh when theme changes
