---
layout: blog-post
title: "Supporting Claude, Codex, and Gemini in One App"
description: "Each AI coding tool reads project context differently. Here's how SubFrame provides unified context injection for Claude Code, Codex CLI, and Gemini CLI using symlinks and wrapper scripts."
date: "2026-02-08"
tag: "Feature"
head:
  - - meta
    - property: og:type
      content: article
  - - meta
    - property: og:title
      content: "Supporting Claude, Codex, and Gemini in One App"
  - - meta
    - property: og:description
      content: "Each AI coding tool reads project context differently. Here's how SubFrame provides unified context injection."
  - - meta
    - name: twitter:card
      content: summary_large_image
---

## The Challenge

SubFrame's context preservation system is built around `AGENTS.md` — a single file containing all project instructions, navigation rules, and conventions. But each AI tool reads context differently:

- **Claude Code** reads `CLAUDE.md` automatically at session start
- **Gemini CLI** reads `GEMINI.md` automatically at session start
- **Codex CLI** has no standard for reading project files

We needed each tool to get the same project context, without maintaining separate instruction files.

## Solution: Symlinks + Wrapper Scripts

### Claude Code and Gemini CLI — Symlinks

Both Claude Code and Gemini CLI have native support for reading a specific file. The solution is simple: create symlinks that point to the single source of truth.

```
AGENTS.md          <- The actual file (single source of truth)
CLAUDE.md -> AGENTS.md   <- Symlink for Claude Code
GEMINI.md -> AGENTS.md   <- Symlink for Gemini CLI
```

One file to maintain, all tools read the same instructions.

### Codex CLI — Wrapper Script

Codex CLI doesn't have a native file-reading convention. Our first attempt was to use a `--system-prompt` flag — but Codex CLI doesn't have that flag.

The final solution: a wrapper script in `.subframe/bin/codex` that sends "Read AGENTS.md" as the initial prompt:

```bash
#!/bin/bash
# .subframe/bin/codex - SubFrame wrapper for Codex CLI
AGENTS_FILE="./AGENTS.md"
if [ -f "$AGENTS_FILE" ]; then
  codex "Please read AGENTS.md and follow the project instructions."
else
  codex "$@"
fi
```

When SubFrame starts Codex CLI, it uses this wrapper instead of the bare `codex` command. The AI reads the file and gets full project context.

## Key Insight

> Instead of trying to pass system prompts via flags (which vary per tool), simply ask the AI to read the AGENTS.md file. This approach is tool-agnostic and works with any AI coding assistant.

## Switching Between Tools

In SubFrame's UI, switching between AI tools is a single click from the toolbar dropdown. Each tool gets proper context injection automatically:

- Select **Claude** -> runs `claude` directly (reads CLAUDE.md natively)
- Select **Gemini** -> runs `gemini` directly (reads GEMINI.md natively)
- Select **Codex** -> runs via `.subframe/bin/codex` wrapper (injects AGENTS.md)

Same project context, different AI engines. Use whichever tool is best for the task at hand.

## Node.js Version Gotcha

One unexpected issue: Gemini CLI's dependency `string-width` uses the `/v` regex flag, which requires Node.js 20+. With Node.js 18, it crashes with `SyntaxError: Invalid regular expression flags`.

If you're adding Gemini CLI support, make sure you're on Node.js 20 or later. And if you use nvm, don't forget `nvm alias default 20` — otherwise terminals spawned by Electron still use the old default version.
