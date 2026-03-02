---
id: task-mm7zk2rx-1xv1
title: Show SubFrame initialization status cleanly in UI
status: completed
priority: low
category: feature
blockedBy: []
blocks: []
createdAt: '2026-03-01T16:50:08.012Z'
updatedAt: '2026-03-01T22:48:11.395Z'
completedAt: '2026-03-01T22:48:11.395Z'
context: Session 2026-03-01
---
Currently project detection is binary — isFrameProject() checks .subframe/config.json existence. Enhance to show richer status: (1) Which SubFrame components are present (config, tasks, structure, hooks, CLI, skill). (2) Visual indicator in project list showing init level (e.g., 'basic' vs 'full' with hooks). (3) Ability to see what's missing and optionally install missing components. Could be a status panel or info tooltip expansion in the project list UI.

## User Request
> Do we show status cleanly?
