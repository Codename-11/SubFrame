---
id: task-mm8csxn4-kz29
title: Prompt library overlay with smart search and terminal insert
status: pending
priority: medium
category: feature
blockedBy: []
blocks: []
createdAt: '2026-03-01T23:00:56.271Z'
updatedAt: '2026-03-01T23:00:56.271Z'
completedAt: null
context: Session 2026-03-01
---
Command-palette-style overlay for saved/common prompts. Triggered by keyboard shortcut, fuzzy searches across title + content + tags, and pastes selected prompt into the active terminal via PTY write.

**Core features:**
- Overlay UI (Command palette pattern via shadcn Command component)
- Fuzzy search across title, prompt content, and tags
- Insert into active terminal on select (PTY write)
- CRUD: add/edit/delete prompts from overlay + dedicated management view
- Categories/tags for organization

**Storage:**
- Project-level: .subframe/prompts.json
- Optional global: ~/.subframe/prompts.json (shared across projects)

**Nice-to-have:**
- Template variables ({{project}}, {{file}}) that resolve on insert
- Import/export prompt collections
- Usage frequency tracking for smart sorting
