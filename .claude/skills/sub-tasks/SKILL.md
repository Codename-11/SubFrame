---
name: sub-tasks
description: View and manage SubFrame Sub-Tasks. Use when starting work, completing tasks, checking what's pending, or creating new tasks from conversation.
disable-model-invocation: false
argument-hint: [list|start|complete|add|get|archive]
allowed-tools: Bash, Read
---

# SubFrame Sub-Tasks

Manage the project's Sub-Task system. Sub-Tasks are SubFrame's project task tracking — not to be confused with sub-tasks as in tasks under a main task.

## Dynamic Context

Current active sub-tasks:
!`node scripts/task.js list`

## Instructions

**Argument:** `$ARGUMENTS`

### Commands Available

Use the CLI script for all task operations:

```bash
node scripts/task.js list [--all]          # Show active sub-tasks (--all includes completed)
node scripts/task.js get <id>              # Show full sub-task details
node scripts/task.js start <id>            # Mark pending → in_progress
node scripts/task.js complete <id>         # Mark → completed
node scripts/task.js add --title "..." [--description "..." --priority medium --category feature]
node scripts/task.js update <id> [options] # Update fields (--status, --notes, --add-note, etc.)
node scripts/task.js archive               # Move completed to .subframe/tasks/archive/
```

### When to use each command

- **Starting work on a task:** `node scripts/task.js start <id>` — always do this BEFORE beginning implementation
- **Finishing a task:** `node scripts/task.js complete <id>` — do this after the work is verified
- **User requests something new:** `node scripts/task.js add --title "..." --description "..." --user-request "..." --priority medium --category feature`
- **Adding progress notes:** `node scripts/task.js update <id> --add-note "Completed X, Y remains"`
- **Checking what to work on:** `node scripts/task.js list`
- **Cleaning up:** `node scripts/task.js archive` — moves completed tasks to yearly archive files

### If invoked without arguments

Show the current sub-task list and ask the user what they'd like to do:
1. Start a pending task
2. Complete an in-progress task
3. Create a new task
4. Archive completed tasks

### If invoked with a task ID

Show full details for that task using `node scripts/task.js get <id>`.

### Creating tasks from conversation

When the user says things like "let's do this later", "add a task for...", or "we should...":
1. Capture the user's exact words as `--user-request`
2. Write a detailed `--description` explaining what, how, and which files
3. Set appropriate `--priority` and `--category`
4. Run the add command
5. Confirm the task was created
