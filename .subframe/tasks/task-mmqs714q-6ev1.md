---
id: task-mmqs714q-6ev1
title: CodeMirror theme reads CSS variables at runtime
status: pending
priority: medium
category: enhancement
blockedBy: []
blocks: []
createdAt: '2026-03-14T20:31:39.385Z'
updatedAt: '2026-03-14T20:31:39.385Z'
completedAt: null
context: Session 2026-03-14
---
codemirror-theme.ts has 16+ hardcoded amber (#d4a574) values for syntax highlighting. Editor stays amber across all themes. Refactor to read --color-accent and other CSS variables at runtime and rebuild the CodeMirror theme when ThemeProvider changes them.

## Steps
- [ ] Read CSS variables in codemirror-theme.ts instead of hardcoded hex
- [ ] Use CodeMirror theme compartment for dynamic updates
- [ ] Call theme refresh from ThemeProvider on settings change
