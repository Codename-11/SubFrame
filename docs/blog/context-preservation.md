---
layout: blog-post
title: "Context Preservation — Stop Losing Decisions Between AI Sessions"
description: "As projects grow with AI coding tools, context gets lost between sessions. Decisions are forgotten, tasks slip through the cracks. Here's how SubFrame solves the context problem."
date: "2026-01-26"
tag: "Architecture"
head:
  - - meta
    - property: og:type
      content: article
  - - meta
    - property: og:title
      content: "Context Preservation — Stop Losing Decisions Between AI Sessions"
  - - meta
    - property: og:description
      content: "As projects grow with AI coding tools, context gets lost. Here's how SubFrame solves this with automatic context preservation."
  - - meta
    - name: twitter:card
      content: summary_large_image
---

## The Context Problem

You've been there: you start a new Claude Code session, and you have to re-explain the project architecture, the decisions you made yesterday, and the task you were working on. As projects grow, this problem gets worse.

Decisions are forgotten. Tasks slip through the cracks. You end up re-explaining the same things over and over. The AI has no memory of what happened in previous sessions.

## SubFrame's Approach

SubFrame solves this with a three-part system that the AI reads at the start of every session:

### 1. STRUCTURE.json — The Module Map

A machine-readable map of your codebase: which modules exist, what they export, what they depend on. The AI knows where everything is without scanning the entire project.

```json
{
  "modules": {
    "main/tasksManager": {
      "path": "src/main/tasksManager.ts",
      "purpose": "Task CRUD operations",
      "exports": ["init", "loadTasks", "addTask"],
      "depends": ["fs", "path", "shared/ipcChannels"]
    }
  }
}
```

This updates automatically via a pre-commit hook — only changed files are parsed, not the entire project.

### 2. PROJECT_NOTES.md — Decision Log

This is where decisions and important conversations are captured — *as they happen*, not as summaries after the fact.

> "Don't write a summary — add the conversation as is, with its context. The user's words, the reasoning, the alternatives considered."

The key design decision: the AI asks the user "Should I add this to notes?" at natural breakpoints — when a task is completed, when an architectural decision is made, or when a bug fix reveals something noteworthy. The user decides what's important.

### 3. tasks.json — Task Tracking

Tasks are detected from conversations automatically. When the user says "let's add this feature" or "we'll do this later", the AI recognizes the pattern and offers to add it to the task list.

Each task includes the user's original request (verbatim), acceptance criteria, and technical notes — so a future session has full context on what needs to be done.

## Design Principles

Several key principles shaped this system:

- **No "End Session" button** — context capture should be organic, not forced
- **User decides importance** — the AI suggests, but never auto-saves notes without asking
- **Not summaries, but conversations** — context must be preserved as-is
- **Don't spam** — not every small change deserves a note. Typo fixes, simple corrections — skip those

## How It Works in Practice

When you start a new session with Claude Code in a SubFrame project, the AI reads `AGENTS.md` which tells it to check these three files. Within seconds, it knows:

- The full project structure and module dependencies
- All past decisions and their reasoning
- Pending tasks and their context

No re-explaining. No context loss. The session picks up where the last one left off.

This approach works with *any* AI coding tool — Claude Code reads `CLAUDE.md` natively, Gemini CLI reads `GEMINI.md`, and Codex CLI gets the context injected via a wrapper script. Same system, multiple tools.
