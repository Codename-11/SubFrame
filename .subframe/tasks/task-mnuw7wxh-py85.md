---
id: task-mnuw7wxh-py85
title: Unify terminal + editor into split-tree editor groups (VS Code style)
status: completed
priority: high
category: feature
blockedBy: []
blocks: []
createdAt: '2026-04-11T22:15:06.100Z'
updatedAt: '2026-04-11T22:42:24.592Z'
completedAt: '2026-04-11T22:42:24.592Z'
context: Session 2026-04-11
---
Generalize LeafNode to hold a tab list of mixed content (terminal | editor file | panel view), making each leaf an editor group. Collapse TerminalArea's 4 mutually-exclusive render branches into a single SplitPaneView. Enables opening a file beside a running terminal, drag-to-split, etc.

## User Request
> I want to look at our termanal and file editor experience. Currently they're split features rea/space - how can we unifiy to make it easier to work in terminals and edit a file or files like vs-code experience

## Acceptance Criteria
Leaf can hold terminal/editor/panel tabs; can open file beside terminal; layout persisted with v1->v2 migration; fullViewContent branch removed; npm run check green
