# SubFrame - Internal Documentation

This directory holds **internal project documentation** — architecture decisions, references, and technical context for developers and AI assistants.

## Contents

| Path | Description |
|------|-------------|
| `adr/` | Architecture Decision Records — why we chose X over Y |
| `refs/` | Reference material — IPC channel index, design tokens, etc. |
| `architecture.md` | System architecture overview and data flow |
| `changelog.md` | Internal detailed dev log (see also root `CHANGELOG.md` for user-facing keepachangelog) |

## What goes here

- **Architecture Decision Records (ADRs)** — why we chose X over Y, with alternatives and rationale
- **Reference docs** — IPC channels, design tokens, keyboard shortcuts
- **Internal changelog** — detailed dev notes (user-facing changelog is `CHANGELOG.md` at project root)
- **Architecture overview** — system diagrams, data flow, process model

## What does NOT go here

- Public-facing docs (use `docs/` for GitHub Pages)
- AI session context (use `PROJECT_NOTES.md`, `STRUCTURE.json`, `tasks.json`)
- Temporary notes or scratch files

## ADR Format

Each ADR follows a consistent structure:

```markdown
# ADR-NNN: Title

**Date:** YYYY-MM-DD
**Status:** Accepted | Superseded | Deprecated
**Category:** Architecture | Stack | Infrastructure | Process

## Context
[Problem statement]

## Decision
[The choice made]

## Alternatives Considered
[What else was evaluated and why it was rejected]

## Consequences
[Impact, follow-up work, trade-offs]
```

---

*Managed by SubFrame project system.*
