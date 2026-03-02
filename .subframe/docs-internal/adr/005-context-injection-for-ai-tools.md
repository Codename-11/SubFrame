# ADR-005: Context Injection for Non-Claude AI Tools

**Date:** 2026-02-05
**Status:** Accepted
**Category:** Architecture

## Context

SubFrame supports multiple AI coding tools (Claude Code, Codex CLI, Gemini CLI). Claude Code automatically reads `CLAUDE.md`, and Gemini CLI reads `GEMINI.md`. But Codex CLI has no native convention for reading project context files.

We needed a universal way to inject SubFrame's project context (`AGENTS.md`) into any AI tool.

## Decision

Use a **wrapper script system** in `.subframe/bin/` that sends "Read AGENTS.md" as the initial prompt to tools that don't natively read project context files. Tools that do read context files natively (Claude Code, Gemini CLI) use **backlink injection** — their respective files (`CLAUDE.md`, `GEMINI.md`) contain a marker block pointing to `AGENTS.md`.

## Alternatives Considered

### System prompt flag (`--system-prompt`)
**Pros:** Clean, no wrapper needed.
**Cons:** Codex CLI doesn't support this flag. Flag names vary per tool. Not future-proof.

### Symlinks (GEMINI.md → AGENTS.md)
**Pros:** Simple, no code needed.
**Cons:** Git doesn't handle symlinks well cross-platform. Windows requires admin privileges for symlinks. Content diverges when tool-specific instructions are needed.

### Monolithic AGENTS.md read by all tools
**Pros:** Single source of truth.
**Cons:** Different tools need different instructions. CLAUDE.md and GEMINI.md serve as tool-specific layers on top of shared AGENTS.md rules.

## Rationale

- Wrapper scripts are tool-agnostic — work with any CLI tool
- Backlink injection preserves tool-specific customization while referencing shared rules
- `<!-- SUBFRAME:BEGIN --> ... <!-- SUBFRAME:END -->` markers are safe in Markdown (rendered as HTML comments)
- `backlinkUtils.ts` handles injection/update programmatically during project init

## Consequences

- `.subframe/bin/` directory created for wrapper scripts
- `backlinkUtils.ts` added to shared utilities
- Each new AI tool integration needs either a wrapper script or a backlink-enabled config file
- AGENTS.md becomes the canonical source of project rules; tool-specific files extend it
