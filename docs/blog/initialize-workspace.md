---
layout: blog-post
title: "Initialize Workspace: What Happens When You Set Up SubFrame"
description: "A deep dive into what subframe init creates — hooks, skills, context files, health monitoring, and how they work together to keep your AI tools informed."
date: "2026-03-01"
tag: "Guide"
head:
  - - meta
    - property: og:type
      content: article
  - - meta
    - property: og:title
      content: "Initialize Workspace: What Happens When You Set Up SubFrame"
  - - meta
    - property: og:description
      content: "A deep dive into what subframe init creates — hooks, skills, context files, health monitoring, and how they work together."
  - - meta
    - name: twitter:card
      content: summary_large_image
---

## What Just Happened?

You've installed SubFrame, opened a project, and clicked **Initialize Workspace**. What just happened?

A single command set up an entire project management layer — context files, hooks, skills, and health monitoring — that your AI tools read automatically. No configuration needed. Let's walk through everything it creates and why each piece matters.

## What Gets Created

After initialization, your project gains this structure:

```
.subframe/
  config.json              # Project configuration
  STRUCTURE.json           # Codebase module map
  PROJECT_NOTES.md         # Session notes and decisions
  tasks.json               # Sub-Task index
  tasks/                   # Individual task markdown files
  QUICKSTART.md            # Getting started guide
  docs-internal/           # Internal docs (ADRs, changelog, IPC ref)
  bin/codex                # Codex CLI wrapper script
AGENTS.md                  # AI instructions (tool-agnostic)
CLAUDE.md                  # Backlink → AGENTS.md
GEMINI.md                  # Backlink → AGENTS.md
.githooks/pre-commit       # Auto-updates STRUCTURE.json
.claude/settings.json      # Hook wiring
.claude/skills/            # Slash command skills
```

An important detail: `CLAUDE.md` and `GEMINI.md` are **not** copies of `AGENTS.md`. They contain a small backlink reference wrapped in `<!-- SUBFRAME:BEGIN -->` / `<!-- SUBFRAME:END -->` markers that points AI tools to the single source of truth. You can freely add your own instructions to `CLAUDE.md` or `GEMINI.md` — SubFrame will never overwrite content outside those markers.

## Hooks: Automated Context Awareness

SubFrame installs five hooks that run alongside your AI tools, keeping them informed without changing how they work.

**SessionStart** (`scripts/hooks/session-start.js`) fires at startup, resume, and after context compaction. It injects pending and in-progress sub-tasks into Claude's context so it always knows what work is tracked — even after the context window has been compressed.

**UserPromptSubmit** (`scripts/hooks/prompt-submit.js`) fires on every user message. It fuzzy-matches your prompt against pending sub-task titles. If there's a match, it suggests starting the task before diving into work — preventing duplicate effort.

**Stop** (`scripts/hooks/stop.js`) fires when Claude finishes responding. It checks for in-progress sub-tasks and reminds about them, flagging modified source files that aren't tracked by any task.

**PreToolUse / PostToolUse** (`scripts/hooks/pre-tool-use.js`, `post-tool-use.js`) monitor agent tool usage for the **Agent Activity Timeline**. They track which tools are called and on which files, building a visual timeline of everything the agent does during a session.

**Git pre-commit** (`.githooks/pre-commit`) runs `npm run structure` before each commit, keeping `STRUCTURE.json` in sync with source code changes automatically.

## Skills: Slash Commands for Your AI

Five **skills** get installed to `.claude/skills/`, giving you slash commands that extend what your AI can do:

- **`/sub-tasks`** — Interactive sub-task management. List pending tasks, start work, mark complete, create new tasks from conversation. Uses `node scripts/task.js` under the hood.
- **`/sub-audit`** — Two-phase audit: code review (bugs, type safety, security) plus documentation audit (CLAUDE.md, changelog, STRUCTURE.json completeness). Reports findings with `file:line` references.
- **`/sub-docs`** — Syncs all SubFrame documentation after feature work. Updates CLAUDE.md module lists, changelog entries, PROJECT_NOTES decisions, and regenerates STRUCTURE.json.
- **`/sub-ipc`** — Regenerates the IPC channel reference doc from `ipcChannels.ts` type maps. Classifies each channel as handle, send, or event pattern.
- **`/release`** — Full release workflow: version bump, docs sync, release notes generation, commit, and git tag. Supports `patch`, `minor`, `major`, and explicit pre-release versions.

## Health Panel: See Everything at a Glance

The **SubFrame Health** panel in the IDE gives you a real-time view of every component's status. Components are grouped by category — Core Files, Claude Code Hooks, Claude Code Skills, Claude Integration, and Git Hooks.

Each component shows a status badge: **Healthy** (green), **Outdated** (amber), or **Missing** (red). An "Update All" button fixes every outdated or missing component at once, with individual update buttons available per component.

Need to remove SubFrame from a project? The health panel includes an expandable uninstall section with granular checkboxes: remove the `.subframe/` directory, Claude hooks, Git hooks, backlinks from `CLAUDE.md`/`GEMINI.md`, `AGENTS.md`, or Claude skills — individually or all at once. A dry run preview shows exactly what will change before anything is deleted.

## Agent Activity Monitor

The **Agent Activity** panel provides a real-time view of Claude Code agent sessions. It shows active, busy, idle, and completed status with color-coded badges, displays the current tool being used (Read, Edit, Bash, etc.), and builds a step-by-step timeline of everything the agent did. A full-view mode gives you a session list alongside a detail timeline for deeper inspection.

## The Philosophy: Enhance, Don't Replace

SubFrame doesn't change how Claude Code, Codex, or Gemini work. It layers structure on top.

Claude Code still reads `CLAUDE.md` natively — SubFrame just adds a backlink to `AGENTS.md`. Hooks run alongside Claude's normal behavior, not instead of it. Skills are standard Claude Code slash commands. Everything can be cleanly uninstalled via the Health panel.

Your AI tools work exactly as they always have. SubFrame just makes sure they have the context they need.
