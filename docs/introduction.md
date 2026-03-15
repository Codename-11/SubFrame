---
title: What is SubFrame?
description: SubFrame is a terminal-first IDE for AI coding tools like Claude Code, Codex CLI, and Gemini CLI.
---

# What is SubFrame?

SubFrame is a terminal-first IDE built for developers who work primarily through AI coding tools. Instead of centering around a code editor with syntax highlighting and autocomplete, SubFrame centers around the terminal — giving you a structured workspace where AI tools run, context persists, and nothing falls through the cracks.

::: info What are AI coding tools?
Claude Code, Codex CLI, and Gemini CLI are terminal-based AI assistants — you chat with AI in your terminal and it writes, edits, and reviews code. SubFrame wraps these tools in a structured workspace so nothing gets lost between sessions.
:::

## The Problem

When developing with AI coding tools like Claude Code, traditional editors like VS Code and Cursor add complexity you don't need. They're designed for *writing code manually* — syntax highlighting, autocomplete, multi-cursor editing. But when an AI is writing your code, those features aren't the priority.

What you actually need is:

- A way to organize and manage your projects
- A real terminal (or multiple terminals) where AI tools run
- Context that persists between sessions
- Task tracking so nothing falls through the cracks
- Quick project switching without losing your place

Staying in the terminal alone means projects remain disorganized. Context is lost. Decisions are forgotten. There's no standardization across projects.

## The Solution

SubFrame is not an IDE in the traditional sense. It's a *framework* — that's where the name comes from. Within SubFrame, you create projects with a standard structure:

- **`AGENTS.md`** — AI instructions that get read at session start
- **`STRUCTURE.json`** — A module map of your codebase
- **`PROJECT_NOTES.md`** — Decisions and session notes
- **`tasks.json`** — Task tracking

Every project gets the same structure. Every AI session starts with context. Nothing is lost.

SubFrame supports up to 9 terminals simultaneously, with both tab and grid views. You can run Claude Code in one terminal, tests in another, and a dev server in a third — all visible at once.

## What SubFrame is NOT

- **Not a code editor** — there's a file editor for quick edits, but it's not the focus
- **Not a VS Code replacement** — if you write code manually, VS Code is still better
- **Not optimized for manual coding** — it's optimized for AI-assisted development

## Who is SubFrame for?

SubFrame is for developers who do daily development with AI coding tools, working terminal-focused. If you find yourself spending most of your time in Claude Code, Codex CLI, or Gemini CLI — and just need a better way to manage your projects and preserve context — SubFrame is for you.

## Next Steps

- [Getting Started](/getting-started) — Install and set up SubFrame
- [AI Tool Setup](/ai-tool-setup) — Configure Claude Code, Codex, or Gemini
- [Features Overview](/features) — Explore what SubFrame can do
