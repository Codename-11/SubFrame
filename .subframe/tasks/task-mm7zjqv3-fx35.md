---
id: task-mm7zjqv3-fx35
title: Deploy hooks/CLI/skill to initialized SubFrame projects
status: completed
priority: medium
category: feature
blockedBy: []
blocks: []
createdAt: '2026-03-01T16:49:52.574Z'
updatedAt: '2026-03-01T22:48:07.617Z'
completedAt: '2026-03-01T22:48:07.617Z'
context: Session 2026-03-01
---
Currently, the Sub-Task automation (scripts/task.js CLI, scripts/hooks/*.js hooks, .claude/skills/sub-tasks/ skill, .claude/settings.json hook config) only exists in the SubFrame repo itself. Projects initialized via 'Initialize as SubFrame Project' get tasks.json and docs but not the automated tooling. Add an optional step to initializeProject() in projectInit.ts that deploys lightweight versions of: (1) scripts/task.js CLI script, (2) scripts/hooks/ session-start, prompt-submit, stop hooks, (3) .claude/settings.json hook wiring, (4) .claude/skills/sub-tasks/SKILL.md skill. Consider whether to copy files or generate from templates. Must not overwrite existing .claude/settings.json content (merge hook config).

## User Request
> Will this get 'Installed' when we init a SubFrame project?
