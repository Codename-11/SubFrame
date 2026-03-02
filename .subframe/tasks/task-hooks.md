---
id: task-hooks
title: Research & implement Claude Code hooks for SubFrame
status: completed
priority: medium
category: research
blockedBy: []
blocks: []
createdAt: '2026-02-28T23:30:00Z'
updatedAt: '2026-03-01T16:35:59.662Z'
completedAt: '2026-03-01T16:35:59.662Z'
context: Session 2026-02-28 - CLAUDE.md rewrite and context loading discussion
---
Research Claude Code's hooks system (startup hooks, pre/post command hooks, etc.) and evaluate how SubFrame can leverage them to enforce context loading at session start. Currently CLAUDE.md instructs Claude to read STRUCTURE.json, tasks.json, and PROJECT_NOTES.md — but this is a soft directive. A startup hook could automatically dump key context or run find-module.js on init. Scope: (1) Research available hook types and trigger points. (2) Prototype a startup hook that auto-loads SubFrame context files. (3) Evaluate whether hooks can be bundled with SubFrame project initialization (frameProject.js / projectInit.js). (4) Document findings and recommended hook configurations in AGENTS.md or a new docs file.

## User Request
> User noted that CLAUDE.md 'read at session start' is a directive, not enforced. Suggested hooks as a way to make context loading bulletproof. User said: 'add hooks enhancements/research as a task/todo in our system'

## Acceptance Criteria
1. Documented research on Claude Code hooks API (what's available, how they work). 2. Working prototype of a SubFrame startup hook that auto-loads context. 3. Decision on whether to include hooks in SubFrame project init. 4. If implemented, hooks are registered during Initialize as SubFrame Project flow.

## Notes
Claude Code supports hooks in ~/.claude/settings.json and .claude/settings.json (project-scoped). Could also explore /init command integration. Related to the broader goal of making SubFrame context loading guaranteed rather than best-effort.
[2026-03-01] Implemented: CLI script (scripts/task.js), 3 hooks (session-start, prompt-submit, stop), /sub-tasks skill, archive system. All documented in CLAUDE.md and AGENTS.md.
