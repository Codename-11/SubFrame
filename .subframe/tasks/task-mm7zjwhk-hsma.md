---
id: task-mm7zjwhk-hsma
title: Add clean uninitialize/cleanup flow for SubFrame projects
status: completed
priority: medium
category: feature
blockedBy: []
blocks: []
createdAt: '2026-03-01T16:49:59.863Z'
updatedAt: '2026-03-01T22:48:09.377Z'
completedAt: '2026-03-01T22:48:09.377Z'
context: Session 2026-03-01
---
No uninit/cleanup flow exists. Add the ability to cleanly remove SubFrame from a project without breaking anything. Should remove: .subframe/ directory, AGENTS.md (if SubFrame-generated), CLAUDE.md/GEMINI.md backlinks (preserve user content), .githooks/ (if SubFrame-created), .claude/settings.json hook entries (if SubFrame-added), .claude/skills/sub-tasks/ (if deployed). Must be safe — warn before destructive actions, confirm with user, never delete user content. Could be a CLI command (node scripts/init.js --uninit) and/or a UI button in SubFrame app.

## User Request
> Do we allow cleanly and properly uninitializing a project/cleanup without breaking?
