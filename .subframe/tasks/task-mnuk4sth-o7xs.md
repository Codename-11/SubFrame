---
id: task-mnuk4sth-o7xs
title: >-
  Maestro absorption: split tree, MCP marketplace, Tamagotchi, quick actions,
  status enum
status: completed
priority: high
category: feature
blockedBy: []
blocks: []
createdAt: '2026-04-11T16:36:45.412Z'
updatedAt: '2026-04-11T16:36:50.237Z'
completedAt: '2026-04-11T16:36:50.237Z'
context: Session 2026-04-11
---
Absorbed 5 features from Maestro (https://github.com/its-maestro-baby/maestro) in parallel: binary split tree terminal layout, MCP marketplace browse/install panel, Tamagotchi mood mascot overlay, quick action pill bar, and hook-driven 7-state terminal status enum with legend. Also wired shortcut handlers for split/close/focus, auto-derived claudeActive from new status enum (removed ~236 lines of xterm pattern-matching from ptyManager), wired MCP install to ~/.claude.json merge, and added 76 unit tests for new pure modules. Commit graph lives under task-mmbc3vlq-ardz.

## User Request
> I want to look at Maestro and inspect their features, specifically terminal resize, git commit timeline, terminal status indicators, plus MCP marketplace, Tamagotchi mascot, and quick action pills. Do all of that with an agent team.

## Acceptance Criteria
All 6 features land, npm run check passes (typecheck + lint + test + verify:hooks + build), follow-ups cleaned up, sub-tasks updated
