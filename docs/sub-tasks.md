---
title: Sub-Tasks
description: SubFrame's built-in task tracking system — schema, CLI, views, and workflows.
---

# Sub-Tasks

Sub-Tasks are SubFrame's project task tracking system. Each task is a markdown file in `.subframe/tasks/` with YAML frontmatter, providing a persistent record of work that survives across AI sessions. The name plays on "Sub" from SubFrame and disambiguates from Claude Code's internal todo tools.

## Task Schema

Each task file (`.subframe/tasks/<id>.md`) contains YAML frontmatter and markdown body sections:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique identifier (auto-generated) |
| `title` | string | Yes | Short, action-oriented title (max 60 characters) |
| `description` | string | Yes | Detailed explanation — what, how, which files affected |
| `status` | enum | Yes | `pending`, `in_progress`, or `completed` |
| `priority` | enum | Yes | `high`, `medium`, or `low` |
| `category` | enum | Yes | `feature`, `enhancement`, `bug`, `fix`, `refactor`, `research`, `docs`, `test`, `chore` |
| `userRequest` | string | Yes | Original user request that spawned this task |
| `acceptanceCriteria` | string | Yes | Concrete, testable criteria for when it's done |
| `steps` | list | No | Checklist items (`- [ ] Label` or `- [x] Label`) |
| `notes` | string | No | Progress notes, decisions, blockers (date-prefixed entries) |
| `blockedBy` | list | No | Task IDs this depends on |
| `blocks` | list | No | Task IDs that depend on this |
| `private` | boolean | No | If true, stored in `.subframe/tasks/private/` (gitignored) |
| `createdAt` | ISO date | Auto | Set when the task is created |
| `updatedAt` | ISO date | Auto | Updated on every change |
| `completedAt` | ISO date | Auto | Set when the task is completed |

### File structure

```yaml
---
id: task-abc12345
title: Add dark mode toggle
status: pending
priority: medium
category: feature
description: Implement a theme toggle in the settings panel...
userRequest: Can we add dark mode?
acceptanceCriteria: Theme toggle works and persists across sessions
blockedBy: []
blocks: []
createdAt: 2026-03-01T12:00:00.000Z
updatedAt: 2026-03-01T12:00:00.000Z
completedAt: null
---

## Notes

[2026-03-01] Initial scope defined. Will use CSS custom properties.

## Steps

- [x] Design token system
- [ ] Implement toggle UI
- [ ] Persist preference
```

### Private tasks

Private tasks are stored in `.subframe/tasks/private/` (gitignored). They work identically to regular tasks — visible in the UI, CLI, and hooks — but are excluded from version control. Create them with `--private` via the CLI or toggle the checkbox in the UI. To make a private task public: `node scripts/task.js update <id> --public`.

## Status Lifecycle

```
pending → in_progress → completed
```

- **Start work** — Move to `in_progress` before beginning. Prevents duplicate effort when hooks fuzzy-match your prompts.
- **Complete** — Move to `completed` when acceptance criteria are met. Sets the `completedAt` timestamp.
- **Reopen** — Move back to `pending` with a note explaining why (rare).
- **Incomplete at session end** — Leave as `in_progress` and add notes describing what was done and what remains.

### Priority guidelines

| Priority | When to use |
|----------|-------------|
| **high** | Blocking other work or explicitly flagged as urgent |
| **medium** | Normal feature work and standard bug fixes |
| **low** | Nice-to-have improvements, deferred items, minor polish |

## CLI Commands

The Sub-Task CLI (`scripts/task.js`) is the preferred way to manage tasks from the terminal. All commands read and write individual `.md` files in `.subframe/tasks/`.

```bash
node scripts/task.js list [--all]           # Show active tasks (--all includes completed)
node scripts/task.js get <id>               # Full task details with step progress
node scripts/task.js start <id>             # pending → in_progress
node scripts/task.js complete <id>          # → completed
node scripts/task.js add --title "..."      # Create a new task
node scripts/task.js update <id> [options]  # Update task fields
node scripts/task.js open <id>              # Print absolute path to the .md file
node scripts/task.js archive               # Move completed tasks to archive/YYYY/
```

### Creating a task

```bash
node scripts/task.js add \
  --title "Add dark mode" \
  --description "Implement dark/light theme toggle" \
  --priority medium \
  --category feature \
  --user-request "Can we add dark mode?" \
  --acceptance-criteria "Theme toggle works, persists across sessions" \
  --add-step "Design token system" \
  --add-step "Implement toggle UI" \
  --add-step "Persist preference" \
  --private
```

### Updating a task

```bash
node scripts/task.js update <id> --add-note "Finished the token system"
node scripts/task.js update <id> --complete-step 0      # Mark first step done
node scripts/task.js update <id> --add-step "New step"   # Append a step
node scripts/task.js update <id> --title "Updated title"
node scripts/task.js update <id> --status pending --add-note "Reopening because..."
node scripts/task.js update <id> --public                # Move from private to public
```

## Views

The Sub-Tasks panel (`Ctrl+Shift+S`) offers three visualization modes:

### Table view

Sortable, filterable list with inline expand for task details. Columns include title, status, category, priority, and last updated. Click the expand arrow on any row to see description, acceptance criteria, notes, dependencies, and step progress (rendered as an interactive timeline).

### Kanban board

Drag-and-drop columns organized by status: Pending, In Progress, and Completed. Provides a visual overview of work distribution across stages.

### Dependency graph

Visual node graph showing task relationships via `blockedBy` and `blocks` fields. Useful for understanding which tasks are blocked and what needs to be completed first.

::: tip
Toggle full-view mode with `Ctrl+Shift+K` for a larger workspace.
:::

## Bulk Actions

Select multiple tasks with checkboxes for batch operations:

- **Complete** — Mark selected tasks as completed
- **Delete** — Remove selected tasks (with confirmation)
- **Send to Chat** — Send selected task details to the active terminal with an optional wrapper prompt

## Integration with AI Tools

SubFrame hooks automatically integrate tasks with your AI sessions:

- **SessionStart** — Injects pending and in-progress tasks into context so the AI always knows what work is tracked, even after context compaction.
- **UserPromptSubmit** — Fuzzy-matches each prompt against pending task titles. If there's a match, it suggests starting the task before diving into work.
- **Stop** — Reminds about in-progress tasks when the AI finishes responding, and flags modified source files not tracked by any task.

The `/sub-tasks` skill provides interactive task management directly in your AI session — list, start, complete, create, and update tasks without leaving the conversation.

## Task Index

A generated index is maintained at `.subframe/tasks.json` for hooks and quick lookups. This file is regenerated automatically from the individual `.md` files. You should not edit it by hand — use the CLI or UI instead.
