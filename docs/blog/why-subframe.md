---
layout: blog-post
title: "Why SubFrame? Building a Terminal-First IDE for AI Coding"
description: "VS Code and Cursor are designed for writing code manually. When you develop primarily through AI tools like Claude Code, you need something different. Here's why we built SubFrame."
date: "2026-01-26"
tag: "Vision"
head:
  - - meta
    - property: og:type
      content: article
  - - meta
    - property: og:title
      content: "Why SubFrame? Building a Terminal-First IDE for AI Coding"
  - - meta
    - property: og:description
      content: "VS Code and Cursor are designed for writing code manually. When you develop primarily through AI tools, you need something different."
  - - meta
    - name: twitter:card
      content: summary_large_image
---

## The Problem

When developing with Claude Code, there's no real need for tools like VS Code or Cursor. Those editors are designed for *writing code manually* — syntax highlighting, autocomplete, multi-cursor editing. But when an AI is writing your code, you don't need that complexity.

What you actually need is:

- A way to organize and manage your projects
- A real terminal (or multiple terminals) where AI tools run
- Context that persists between sessions
- Task tracking so nothing falls through the cracks
- Quick project switching without losing your place

Staying in the terminal means projects remain disorganized. Context is lost. Decisions are forgotten. There's no standardization across projects.

## The Solution: SubFrame

SubFrame is not an IDE in the traditional sense. It's a *framework* — that's where the name comes from. Within SubFrame, you create "SubFrame projects" with a standard structure:

- `AGENTS.md` — AI instructions that get read at session start
- `STRUCTURE.json` — a module map of your codebase
- `PROJECT_NOTES.md` — decisions and session notes
- `tasks.json` — task tracking

Every project gets the same structure. Every AI session starts with context. Nothing is lost.

## Terminal-First Philosophy

SubFrame's center is not a code editor — it's the terminal. Even multiple terminals, in a grid layout. This is intentional.

> "I need standardization and manageability for my projects. I'm terminal and Claude Code focused. That's why SubFrame's center is not a code editor, but a terminal."

SubFrame supports up to 9 terminals simultaneously, with both tab and grid views. You can run Claude Code in one terminal, tests in another, and a dev server in a third — all visible at once.

## What SubFrame is NOT

- **Not a code editor** — there's a file editor for quick edits, but it's not the focus
- **Not a VS Code replacement** — if you write code manually, VS Code is still better
- **Not optimized for manual coding** — it's optimized for AI-assisted development

## Target User

SubFrame is for developers who do daily development with AI coding tools, working terminal-focused. If you find yourself spending most of your time in Claude Code, Codex CLI, or Gemini CLI — and just need a better way to manage your projects and preserve context — SubFrame is for you.

[Get started with SubFrame](https://sub-frame.dev/guide/) or check out the [GitHub repository](https://github.com/Codename-11/SubFrame).
