/**
 * SubFrame Templates
 * Templates for auto-generated SubFrame project files
 * Each template includes instructions header for Claude Code
 */

interface FrameConfigTemplate {
  version: string;
  name: string;
  description: string;
  createdAt: string;
  initializedBy: string;
  settings: {
    autoUpdateStructure: boolean;
    autoUpdateNotes: boolean;
    taskRecognition: boolean;
  };
  backlink: {
    customMessage: string;
    additionalRefs: string[];
  };
  files: Record<string, string>;
}

interface StructureTemplate {
  _frame_metadata: {
    purpose: string;
    forAI: string;
    lastUpdated: string;
    generatedBy: string;
  };
  version: string;
  description: string;
  architecture: {
    type: string;
    entryPoint: string;
    notes: string;
  };
  modules: Record<string, unknown>;
  dataFlow: unknown[];
  conventions: Record<string, unknown>;
}

interface TasksTemplate {
  _frame_metadata: {
    purpose: string;
    forAI: string;
    lastUpdated: string;
    generatedBy: string;
  };
  project: string;
  version: string;
  lastUpdated: string;
  tasks: {
    pending: unknown[];
    inProgress: unknown[];
    completed: unknown[];
  };
  taskSchema: Record<string, string>;
  metadata: {
    totalCreated: number;
    totalCompleted: number;
  };
  categories: Record<string, string>;
}

/**
 * Current template version for AGENTS.md.
 * Bump this when the template content changes significantly.
 * Files without a version marker are treated as version 0 (pre-versioning).
 */
export const AGENTS_TEMPLATE_VERSION = 1;

/**
 * Get current date in YYYY-MM-DD format
 */
function getDateString(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get current ISO timestamp
 */
function getISOTimestamp(): string {
  return new Date().toISOString();
}

/**
 * AGENTS.md template - Main instructions file for AI assistants
 */
export function getAgentsTemplate(projectName: string): string {
  const date = getDateString();
  return `# ${projectName} - SubFrame Project

This project is managed with **SubFrame**. AI assistants should follow the rules below to keep documentation up to date.

> **Note:** This file is named \`AGENTS.md\` to be AI-tool agnostic. CLAUDE.md and GEMINI.md contain a reference to this file.

---

## Core Working Principle

**Only do what the user asks.** Do not go beyond the scope of the request.

- Implement exactly what the user requested — nothing more, nothing less.
- Do not change business logic, flow, or architecture unless the user explicitly asks for it.
- If a user asks for a design change, only change the design. Do not refactor, restructure, or modify functionality alongside it.
- If you have additional suggestions or improvements, **present them as suggestions** to the user. Never implement them without approval.
- The user's request must be completed first. Additional ideas come after, as proposals.

---

## Relationship to Native AI Tools

SubFrame **enhances** native AI coding tools — it does not replace them.

**Claude Code** works exactly as normal. Built-in features (\`/init\`, \`/commit\`, \`/review-pr\`, \`/compact\`, \`/memory\`, CLAUDE.md) are fully supported. CLAUDE.md is Claude Code's native instruction file — users can add their own tool-specific instructions freely. SubFrame adds a small backlink reference pointing to this AGENTS.md file using HTML comment markers (\`<!-- SUBFRAME:BEGIN -->\` / \`<!-- SUBFRAME:END -->\`). SubFrame will never overwrite user content in CLAUDE.md.

**Gemini CLI** works exactly as normal. Built-in features (\`/init\`, \`/model\`, \`/memory\`, \`/compress\`, \`/settings\`, GEMINI.md) are fully supported. GEMINI.md is Gemini CLI's native instruction file — same backlink approach as CLAUDE.md. Users can add their own instructions freely and SubFrame won't overwrite them.

**Codex CLI** gets SubFrame context via a wrapper script at \`.subframe/bin/codex\` that injects AGENTS.md as an initial prompt.

**This file (AGENTS.md)** contains SubFrame-specific rules that apply across all tools:
- Sub-Task management (\`.subframe/tasks/*.md\`, index at \`.subframe/tasks.json\`)
- Codebase mapping (\`.subframe/STRUCTURE.json\`)
- Context preservation (\`.subframe/PROJECT_NOTES.md\`)
- Internal docs and changelog (\`.subframe/docs-internal/\`)
- Session notes and decision tracking

---

## Session Start

**Read these files at the start of each session:**

1. **\`.subframe/STRUCTURE.json\`** — Module map, file locations, architecture notes
2. **\`.subframe/PROJECT_NOTES.md\`** — Project vision, past decisions, session notes
3. **\`.subframe/tasks.json\`** — Sub-task index (pending, in-progress, completed)

This gives you full project context before making any changes. The session-start hook (if configured) automatically injects pending/in-progress sub-tasks into your context, but you should still read these files for deeper understanding.

### Concurrent Work & Worktrees

Before making changes, check whether other AI sessions or agent teams are already working on this repository. Signs of concurrent work include:
- In-progress sub-tasks you didn't start (check \`.subframe/tasks.json\`)
- Recent uncommitted changes in \`git status\` that aren't yours
- Lock files or active worktrees (\`git worktree list\`)

**If concurrent work is detected**, ask the user: "Another session appears to be working on this project. Should I use a git worktree to avoid conflicts?"

**Git worktrees** create an isolated copy of the repo on a separate branch, allowing parallel work without merge conflicts:
- Each worktree has its own working directory and branch
- Changes in one worktree don't affect others until merged
- Use worktrees when multiple agents or sessions work on different features simultaneously

**When to suggest a worktree:**
- Agent teams spawning multiple workers on the same repo
- User asks to work on a feature while another is in progress
- The session-start hook flags concurrent sessions

**When worktrees are NOT needed:**
- Single-session work with no concurrent agents
- Read-only exploration or research tasks
- Quick fixes that won't conflict with in-progress work

---

## Hooks (Automatic Awareness)

SubFrame can configure project-level hooks that automate sub-task awareness. These hooks fire automatically — no manual intervention needed.

| Hook | When it fires | What it does |
|------|---------------|--------------|
| **SessionStart** | Startup, resume, after compaction | Injects pending/in-progress sub-tasks into context |
| **UserPromptSubmit** | Each user prompt | Fuzzy-matches prompt against pending sub-tasks, suggests starting a match |
| **Stop** | When AI finishes responding | Reminds about in-progress sub-tasks; flags untracked work if source files changed |
| **PreToolUse** | Before tool execution | Project-specific guardrails (if configured) |
| **PostToolUse** | After tool execution | Project-specific follow-ups (if configured) |

These hooks ensure sub-task awareness even after context compaction. Hook configuration lives in \`.claude/settings.json\`.

---

## Skills (Slash Commands)

SubFrame provides optional slash commands for AI coding tools that support them (e.g., Claude Code):

| Skill | Purpose |
|-------|---------|
| \`/sub-tasks\` | Interactive sub-task management — list, start, complete, add, archive |
| \`/sub-docs\` | Sync all SubFrame documentation after feature work (changelog, CLAUDE.md, PROJECT_NOTES, STRUCTURE) |
| \`/sub-audit\` | Code review + documentation audit on recent changes |
| \`/onboard\` | Bootstrap SubFrame files from existing codebase context |

Skills are deployed to \`.claude/skills/\` and enhance the workflow — but direct file editing always works as a fallback. If your AI tool doesn't support skills, follow the manual instructions in each section below.

---

## Sub-Task Management

> **Terminology:** "Sub-Tasks" are SubFrame's project task tracking system. The name plays on "Sub" from SubFrame and disambiguates from Claude Code's internal todo tools. When the user says "sub-task", they mean this system.

### Sub-Task File Format

Each sub-task lives in its own markdown file at \`.subframe/tasks/<id>.md\` with YAML frontmatter:

\`\`\`yaml
---
id: task-abc12345
title: Short and clear title (max 60 characters)
status: pending | in_progress | completed
priority: high | medium | low
category: feature | fix | refactor | docs | test | chore
description: AI's detailed explanation — what, how, which files affected
userRequest: User's original prompt/request — copy exactly
acceptanceCriteria: When is this task done? Concrete testable criteria
blockedBy: []          # task IDs this depends on
blocks: []             # task IDs that depend on this
createdAt: ISO timestamp
updatedAt: ISO timestamp
completedAt: ISO timestamp | null
---

## Notes

[YYYY-MM-DD] Session notes, alternatives considered, dependencies.

## Steps

- [x] Completed step
- [ ] Pending step
\`\`\`

A generated index is kept at \`.subframe/tasks.json\` for hooks and quick lookups. After creating or modifying task \`.md\` files, regenerate the index by reading all \`.subframe/tasks/*.md\` files (excluding \`archive/\`) and building the JSON with tasks grouped by status.

### Sub-Task Recognition Rules

**These ARE SUB-TASKS:**
- When the user requests a feature or change
- Decisions like "Let's do this", "Let's add this", "Improve this"
- Deferred work: "We'll do this later", "Let's leave it for now"
- Gaps or improvement opportunities discovered while coding
- Situations requiring bug fixes

**These are NOT SUB-TASKS:**
- Error messages and debugging sessions
- Questions, explanations, information exchange
- Temporary experiments and tests
- Work already completed and closed
- Instant fixes (like typo fixes)

### Sub-Task Creation Flow

1. Detect sub-task patterns during conversation
2. **Check existing sub-tasks first** — read \`.subframe/tasks.json\` to avoid duplicates
3. Ask the user: "I identified these sub-tasks from our conversation, should I add them?"
4. If approved, create \`.subframe/tasks/<id>.md\` with all required frontmatter fields
5. Regenerate the \`.subframe/tasks.json\` index

### Sub-Task Content Rules

**title:** Short, action-oriented
- OK: "Add tasks button to terminal toolbar"
- Bad: "Tasks"

**description:** AI's detailed technical explanation
- What will be done, how, which files affected
- Minimum 2-3 sentences

**userRequest:** User's original words — copy verbatim for context preservation

**acceptanceCriteria:** Concrete, testable completion criteria

### Sub-Task Status Updates

**Before starting any work**, check \`.subframe/tasks.json\` for an existing sub-task that matches. If found, set it to \`in_progress\` — do not create a duplicate.

- \`pending\` → \`in_progress\` — immediately when you begin working (update \`updatedAt\`)
- \`in_progress\` → \`completed\` — when done and verified (set \`completedAt\`, update \`updatedAt\`)
- \`completed\` → \`pending\` — when reopening, add a note explaining why
- After commit: check and update the status of all related sub-tasks
- **Incomplete work:** If partially done at session end, leave as \`in_progress\` and add a notes entry

### Sub-Task Lifecycle

- If a sub-task grows beyond its original scope, split it — create new sub-tasks and reference the parent ID in notes
- Cross-reference relevant commit hashes or PR numbers in notes
- Update the description if the approach changes significantly

### Priority Guidelines

- **high** — Blocking other work or explicitly flagged as urgent by the user
- **medium** — Normal feature work and standard bug fixes
- **low** — Nice-to-have improvements, deferred items, minor polish

---

## .subframe/PROJECT_NOTES.md Rules

### When to Update?
- When an important architectural decision is made
- When a technology choice is made
- When an important problem is solved and the solution method is noteworthy
- When an approach is determined together with the user

### Format
Free format. Date + title is sufficient:
\`\`\`markdown
### [YYYY-MM-DD] Topic title
Conversation/decision as is, with its context...
\`\`\`

### Update Flow
- Update immediately after a decision is made
- You can add without asking the user (for important decisions)
- You can accumulate small decisions and add them in bulk

### Organization Rules
- Keep **"Project Vision"** at the top, then **"Session Notes"** in chronological order
- Notes should capture the **why** (decisions, trade-offs, alternatives rejected), not the **what** (code structure belongs in STRUCTURE.json)
- When the same topic spans multiple sessions, consolidate related notes under the original heading rather than creating duplicates
- When notes grow beyond ~500 lines, consider archiving older session notes or grouping by month

---

## Context Preservation (Automatic Note Taking)

SubFrame's core purpose is to prevent context loss. Capture important moments and ask the user.

### When to Ask?

Ask the user: **"Should I add this to .subframe/PROJECT_NOTES.md?"** when:

- A sub-task is successfully completed
- An important architectural/technical decision is made
- A bug is fixed and the solution method is noteworthy
- "Let's do this later" is said (also add as a sub-task)
- A new pattern or best practice is discovered

### Importance Threshold

**Would it take more than 5 minutes to re-derive or re-explain in a future session?** If yes, capture it.

**Always capture:** Architecture decisions, technology choices, approach changes, user preferences discovered during work.

**Never capture:** Routine debugging steps, simple config changes, typo fixes.

**Note failed approaches too** — a brief "We tried X, it didn't work because Y" prevents future re-exploration of dead ends.

### Completion Detection

Pay attention to these signals:
- User approval: "okay", "done", "it worked", "nice", "fixed", "yes"
- Moving from one topic to another
- User continuing after build/run succeeds

### How to Add?

1. **DON'T write a summary** — Add the conversation as is, with its context
2. **Add date** — In \`### [YYYY-MM-DD] Title\` format
3. **Add to Session Notes section** — At the end of PROJECT_NOTES.md

### When NOT to Ask

- For every small change (it becomes spam)
- Typo fixes, simple corrections
- If the user already said "no" or "not needed", don't ask again for that topic

### If User Says "No"

No problem, continue. The user can also say what they consider important themselves: "add this to notes"

---

## .subframe/STRUCTURE.json Rules

**This file is the map of the codebase.**

### When to Update?
- When a new file/folder is created
- When a file/folder is deleted or moved
- When module dependencies change
- When an IPC channel is added or changed
- When an important architectural pattern is discovered (architectureNotes)

### Full Schema

\`\`\`json
{
  "modules": {
    "main/moduleName": {
      "file": "src/main/moduleName.ts",
      "description": "What this module does",
      "exports": ["init", "loadData"],
      "depends": ["fs", "path", "shared/ipcChannels"],
      "functions": {
        "init": { "line": 15 },
        "loadData": { "line": 42 }
      }
    }
  },
  "ipcChannels": {
    "CHANNEL_NAME": {
      "direction": "renderer → main",
      "handler": "main/moduleName"
    }
  },
  "architectureNotes": {
    "topicName": {
      "issue": "Description of the pattern or concern",
      "solution": "How it was resolved"
    }
  }
}
\`\`\`

### Update Rules
- The pre-commit hook (if configured) auto-updates STRUCTURE.json when source files in \`src/\` are committed
- When deleting files, remove their entries from \`modules\` and update any \`depends\` arrays that referenced them
- When adding IPC channels, also add them to the \`ipcChannels\` section with \`direction\` and \`handler\`
- \`architectureNotes\` is for **structural patterns** (e.g., circular dependency workarounds, init ordering). Use PROJECT_NOTES.md for **decisions and session context**
- If function line numbers drift significantly after edits, re-run the pre-commit hook or update manually

---

## .subframe/docs-internal/ Directory

This directory holds project documentation that doesn't belong in the root:

| File | Purpose |
|------|---------|
| \`changelog.md\` | Track changes under \`## [Unreleased]\`, grouped by Added/Changed/Fixed/Removed |
| \`*.md\` (ADRs) | Architecture Decision Records for significant design choices |

**What goes here:** Changelog entries, architecture decision records, internal reference docs.

**What does NOT go here:** User-facing docs (those go in \`docs/\` or project root), task files (those go in \`.subframe/tasks/\`).

---

## .subframe/QUICKSTART.md Rules

### When to Update?
- When installation steps change
- When new requirements are added
- When important commands change

---

## Before Ending Work

After significant work (code changes, architecture decisions), verify SubFrame files are in sync:

1. **Sub-Tasks** — Was this work tracked? Check \`.subframe/tasks.json\` → create/complete as needed
2. **PROJECT_NOTES.md** — Any decisions worth preserving? Ask the user
3. **Changelog** — Does \`.subframe/docs-internal/changelog.md\` reflect the changes?
4. **STRUCTURE.json** — Source files changed? The pre-commit hook handles this automatically if configured; otherwise update manually

The stop hook (if configured) will flag untracked work automatically.

---

## General Rules

1. **Language:** Write documentation in English (except code examples)
2. **Date Format:** ISO 8601 (YYYY-MM-DDTHH:mm:ssZ)
3. **After Commit:** Check sub-tasks (\`.subframe/tasks/*.md\`) and \`.subframe/STRUCTURE.json\`
4. **Session Start:** Read STRUCTURE.json, PROJECT_NOTES.md, and tasks.json before making changes
5. **Don't Duplicate:** Always check existing sub-tasks before creating new ones

---

*This file was automatically created by SubFrame.*
*Creation date: ${date}*

<!-- subframe-template-version: ${AGENTS_TEMPLATE_VERSION} -->
`;
}

/**
 * STRUCTURE.json template
 */
export function getStructureTemplate(projectName: string): StructureTemplate {
  return {
    _frame_metadata: {
      purpose: "Project structure and module map for AI assistants",
      forAI: "Read this file FIRST when starting work on this project. It contains the module structure, data flow, and conventions. Update this file when you add new modules or change the architecture.",
      lastUpdated: getDateString(),
      generatedBy: "SubFrame"
    },
    version: "1.0",
    description: `${projectName} - update this description`,
    architecture: {
      type: "",
      entryPoint: "",
      notes: ""
    },
    modules: {},
    dataFlow: [],
    conventions: {}
  };
}

/**
 * PROJECT_NOTES.md template
 */
export function getNotesTemplate(projectName: string): string {
  const date = getDateString();
  return `# ${projectName} - Project Notes

## Project Vision

*What is this project? Why does it exist? Who is it for?*

---

## Session Notes

### [${date}] Initial Setup
- SubFrame project initialized
`;
}

/**
 * tasks.json template
 */
export function getTasksTemplate(projectName: string): TasksTemplate {
  return {
    _frame_metadata: {
      purpose: "Sub-Task tracking index — auto-generated from .subframe/tasks/*.md files",
      forAI: "Auto-generated from .subframe/tasks/*.md — edit the .md files directly. This index is regenerated on every change. Each task lives in its own markdown file with YAML frontmatter. Use the CLI: node scripts/task.js <command>",
      lastUpdated: getDateString(),
      generatedBy: "SubFrame"
    },
    project: projectName,
    version: "1.2",
    lastUpdated: getISOTimestamp(),
    tasks: {
      pending: [],
      inProgress: [],
      completed: []
    },
    taskSchema: {
      _comment: "This schema shows the expected structure for each task",
      id: "unique-id (task-xxx format)",
      title: "Short actionable title (max 60 chars)",
      description: "Claude's detailed explanation - what, how, which files affected",
      userRequest: "Original user prompt/request - copy verbatim",
      acceptanceCriteria: "When is this task done? Concrete testable criteria",
      notes: "Discussion notes, alternatives considered, dependencies (optional)",
      status: "pending | in_progress | completed",
      priority: "high | medium | low",
      category: "feature | fix | refactor | docs | test | chore",
      context: "Session date and context",
      blockedBy: "Array of task IDs this task depends on",
      blocks: "Array of task IDs that depend on this task",
      steps: "Array of { label, completed } — parsed from ## Steps checkboxes",
      createdAt: "ISO timestamp",
      updatedAt: "ISO timestamp",
      completedAt: "ISO timestamp | null"
    },
    metadata: {
      totalCreated: 0,
      totalCompleted: 0
    },
    categories: {
      feature: "New features",
      fix: "Bug fixes",
      refactor: "Code improvements",
      docs: "Documentation",
      test: "Testing",
      chore: "Maintenance and housekeeping"
    }
  };
}

/**
 * Generate a blank task markdown template for a new task.
 */
export function getTaskMarkdownTemplate(task: { id: string; title: string; priority?: string; category?: string; description?: string }): string {
  const now = getISOTimestamp();
  return `---
id: ${task.id}
title: "${task.title.replace(/"/g, '\\"')}"
status: pending
priority: ${task.priority || 'medium'}
category: ${task.category || 'feature'}
blockedBy: []
blocks: []
createdAt: "${now}"
updatedAt: "${now}"
completedAt: null
---

${task.description || ''}

## Steps
- [ ] TODO

## User Request
>

## Acceptance Criteria


## Notes
[${getDateString()}] Created.
`;
}

/**
 * QUICKSTART.md template
 */
export function getQuickstartTemplate(projectName: string): string {
  const date = getDateString();
  return `<!-- SUBFRAME AUTO-GENERATED FILE -->
<!-- Purpose: Quick onboarding guide for developers and AI assistants -->
<!-- For Claude: Read this FIRST to quickly understand how to work with this project. Contains setup instructions, common commands, and key files to know. -->
<!-- Last Updated: ${date} -->

# ${projectName} - Quick Start Guide

## Setup

\`\`\`bash
# Clone and install
git clone <repo-url>
cd ${projectName}
npm install  # or appropriate package manager
\`\`\`

## Common Commands

\`\`\`bash
# Development
npm run dev

# Build
npm run build

# Test
npm test
\`\`\`

## Key Files

| File | Purpose |
|------|---------|
| \`.subframe/STRUCTURE.json\` | Module map and architecture |
| \`.subframe/PROJECT_NOTES.md\` | Decisions and context |
| \`.subframe/tasks/*.md\` | Sub-Task files (markdown + YAML frontmatter) |
| \`.subframe/tasks.json\` | Sub-Task index (auto-generated) |
| \`.subframe/QUICKSTART.md\` | This file |
| \`.subframe/docs-internal/\` | Internal documentation |

## Project Structure

\`\`\`
${projectName}/
\u251c\u2500\u2500 .subframe/              # SubFrame project files
\u2502   \u251c\u2500\u2500 config.json         # Project configuration
\u2502   \u251c\u2500\u2500 STRUCTURE.json      # Module map
\u2502   \u251c\u2500\u2500 PROJECT_NOTES.md    # Session notes
\u2502   \u251c\u2500\u2500 tasks/              # Sub-Task markdown files
\u2502   \u2502   \u2514\u2500\u2500 <id>.md         # Individual task (YAML frontmatter)
\u2502   \u251c\u2500\u2500 tasks.json          # Sub-Task index (auto-generated)
\u2502   \u251c\u2500\u2500 QUICKSTART.md       # This file
\u2502   \u2514\u2500\u2500 docs-internal/      # Internal documentation
\u251c\u2500\u2500 AGENTS.md               # AI instructions (tool-agnostic)
\u251c\u2500\u2500 CLAUDE.md               # Claude Code instructions
\u251c\u2500\u2500 src/                    # Source code
\u2514\u2500\u2500 ...
\`\`\`

## For AI Assistants (Claude)

1. **First**: Read \`.subframe/STRUCTURE.json\` for architecture overview
2. **Then**: Check \`.subframe/PROJECT_NOTES.md\` for current context and decisions
3. **Check**: \`.subframe/tasks.json\` for pending sub-tasks
4. **Follow**: Existing code patterns and conventions
5. **Update**: These files as you make changes

## Quick Context

*Add a brief summary of what this project does and its current state here*
`;
}

/**
 * docs-internal/README.md template
 */
export function getDocsInternalReadme(projectName: string): string {
  return `# ${projectName} - Internal Documentation

This directory is for **internal project documentation** \u2014 architecture decisions, API references, setup guides, and anything that helps developers (human or AI) understand the project.

## What goes here

- **Architecture Decision Records (ADRs)** \u2014 why we chose X over Y
- **API documentation** \u2014 internal/external API notes, endpoint specs
- **Setup & deployment guides** \u2014 environment setup, deploy procedures
- **Design specs** \u2014 feature designs, data models, flow diagrams
- **Third-party references** \u2014 integration notes, credential structures, env var docs
- **Troubleshooting** \u2014 known issues, debugging guides, gotchas

## What does NOT go here

- Public-facing docs (use \`docs/\` for GitHub Pages or similar)
- AI session context (use \`.subframe/PROJECT_NOTES.md\`, \`.subframe/STRUCTURE.json\`, \`.subframe/tasks.json\`)
- Temporary notes or scratch files

## Suggested structure

\`\`\`
docs-internal/
\u251c\u2500\u2500 README.md          # This file
\u251c\u2500\u2500 architecture.md    # System architecture overview
\u251c\u2500\u2500 adr/               # Architecture Decision Records
\u2502   \u2514\u2500\u2500 001-example.md
\u251c\u2500\u2500 api/               # API documentation
\u251c\u2500\u2500 setup/             # Setup and deployment guides
\u2514\u2500\u2500 refs/              # Third-party references and integration notes
\`\`\`

---

*Created by SubFrame project initialization.*
`;
}

/**
 * .subframe/config.json template
 */
export function getFrameConfigTemplate(projectName: string): FrameConfigTemplate {
  return {
    version: "1.0",
    name: projectName,
    description: "",
    createdAt: getISOTimestamp(),
    initializedBy: "SubFrame",
    settings: {
      autoUpdateStructure: true,
      autoUpdateNotes: false,
      taskRecognition: true
    },
    backlink: {
      customMessage: "",
      additionalRefs: []
    },
    files: {
      agents: "AGENTS.md",
      claude: "CLAUDE.md",
      gemini: "GEMINI.md",
      structure: ".subframe/STRUCTURE.json",
      notes: ".subframe/PROJECT_NOTES.md",
      tasks: ".subframe/tasks.json",
      quickstart: ".subframe/QUICKSTART.md",
      docsInternal: ".subframe/docs-internal"
    }
  };
}

/**
 * Codex CLI wrapper script
 */
export function getCodexWrapperTemplate(): string {
  return `#!/usr/bin/env bash
# SubFrame AI Tool Wrapper for Codex CLI
# This script injects AGENTS.md as initial prompt

AGENTS_FILE="AGENTS.md"

# Find AGENTS.md in current directory or parent directories
find_agents_file() {
  local dir="$PWD"
  while [ "$dir" != "/" ]; do
    if [ -f "$dir/$AGENTS_FILE" ]; then
      echo "$dir/$AGENTS_FILE"
      return 0
    fi
    dir="$(dirname "$dir")"
  done
  return 1
}

AGENTS_PATH=$(find_agents_file)

# Run codex with initial prompt to read AGENTS.md
if [ -n "$AGENTS_PATH" ]; then
  exec codex "Please read AGENTS.md and follow the project instructions. This file contains important rules for this project." "$@"
else
  exec codex "$@"
fi
`;
}

/**
 * Generic AI tool wrapper template
 */
export function getGenericWrapperTemplate(toolCommand: string, promptFlag: string = ''): string {
  const flagPart = promptFlag ? `${promptFlag} ` : '';
  return `#!/usr/bin/env bash
# SubFrame AI Tool Wrapper for ${toolCommand}
# This script injects AGENTS.md as initial prompt

AGENTS_FILE="AGENTS.md"

# Find AGENTS.md in current directory or parent directories
find_agents_file() {
  local dir="$PWD"
  while [ "$dir" != "/" ]; do
    if [ -f "$dir/$AGENTS_FILE" ]; then
      echo "$dir/$AGENTS_FILE"
      return 0
    fi
    dir="$(dirname "$dir")"
  done
  return 1
}

AGENTS_PATH=$(find_agents_file)

# Run tool with initial prompt to read AGENTS.md
if [ -n "$AGENTS_PATH" ]; then
  exec ${toolCommand} ${flagPart}"Please read AGENTS.md and follow the project instructions." "$@"
else
  exec ${toolCommand} "$@"
fi
`;
}

/**
 * Native AI file template (CLAUDE.md, GEMINI.md)
 * Returns just the backlink block that references AGENTS.md
 */
export function getNativeFileTemplate(): string {
  // Dynamic require to avoid circular deps — backlinkUtils is in same directory
  const { getBacklinkBlock } = require('./backlinkUtils');
  return getBacklinkBlock() + '\n';
}

/**
 * Pre-commit hook template for user projects
 */
export function getPreCommitHookTemplate(): string {
  return `#!/bin/bash
#
# SubFrame pre-commit hook
# Auto-updates STRUCTURE.json when JS files in src/ are committed.
#

# Check if any JS files in src/ are staged
STAGED_JS=$(git diff --cached --name-only --diff-filter=ACMRD | grep -E '^src/.*\\.(js|ts|tsx|jsx)$' || true)

# Also check for deleted source files
DELETED_JS=$(git diff --cached --name-only --diff-filter=D | grep -E '^src/.*\\.(js|ts|tsx|jsx)$' || true)

if [ -z "$STAGED_JS" ] && [ -z "$DELETED_JS" ]; then
  exit 0
fi

# Only update if .subframe/STRUCTURE.json exists (SubFrame project)
if [ ! -f ".subframe/STRUCTURE.json" ]; then
  exit 0
fi

# Only update if the updater script exists
UPDATER=".githooks/update-structure.js"
if [ ! -f "$UPDATER" ]; then
  exit 0
fi

echo "[SubFrame] Source files changed, updating .subframe/STRUCTURE.json..."

# Run the updater with staged/deleted file lists as env vars
STAGED_FILES="$STAGED_JS" DELETED_FILES="$DELETED_JS" node "$UPDATER"

# Stage the updated .subframe/STRUCTURE.json
git add .subframe/STRUCTURE.json

echo "[SubFrame] .subframe/STRUCTURE.json updated and staged."

exit 0
`;
}

/**
 * Pre-push git hook template.
 * Triggers pipeline workflows configured with "on: { push: true }".
 */
export function getPrePushHookTemplate(): string {
  return `#!/bin/bash
# SubFrame pre-push hook
# Triggers pipeline workflows configured with "on: { push: true }"
# To bypass: git push --no-verify

SUBFRAME_DIR=".subframe"
PIPELINES_DIR="$SUBFRAME_DIR/pipelines"
TRIGGER_FILE="$PIPELINES_DIR/.pre-push-trigger"

# Only trigger if SubFrame is initialized
if [ ! -d "$SUBFRAME_DIR" ]; then
  exit 0
fi

# Write trigger file for SubFrame to detect
mkdir -p "$PIPELINES_DIR"
echo "{\\"trigger\\": \\"pre-push\\", \\"timestamp\\": \\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\\"}" > "$TRIGGER_FILE"

# Don't block the push — pipeline runs async via SubFrame UI
exit 0
`;
}

/**
 * Pre-commit hook updater script (Node.js)
 */
export function getHookUpdaterScript(): string {
  return `#!/usr/bin/env node
/**
 * SubFrame STRUCTURE.json Updater
 * Called by .githooks/pre-commit when source files in src/ are staged.
 * Reads STAGED_FILES and DELETED_FILES from environment variables.
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const STRUCTURE_FILE = path.join(ROOT, '.subframe', 'STRUCTURE.json');
const SRC_DIR = path.join(ROOT, 'src');

// Strip any JS/TS extension for module key
function stripExt(p) {
  return p.replace(/\\.(js|ts|tsx|jsx)$/, '');
}

// Load existing STRUCTURE.json
let structure;
try {
  structure = JSON.parse(fs.readFileSync(STRUCTURE_FILE, 'utf-8'));
} catch (e) {
  process.exit(0);
}

if (!structure.modules) {
  structure.modules = {};
}

const files = (process.env.STAGED_FILES || '').split('\\n').filter(Boolean);
const deleted = (process.env.DELETED_FILES || '').split('\\n').filter(Boolean);

// Remove deleted modules
for (const file of deleted) {
  const key = stripExt(path.relative(SRC_DIR, path.join(ROOT, file)))
    .replace(/\\\\/g, '/');
  if (structure.modules[key]) {
    delete structure.modules[key];
  }
}

// Parse each staged file
for (const file of files) {
  const fullPath = path.join(ROOT, file);
  if (!fs.existsSync(fullPath)) continue;

  let content;
  try {
    content = fs.readFileSync(fullPath, 'utf-8');
  } catch (e) {
    continue;
  }

  const key = stripExt(path.relative(SRC_DIR, fullPath))
    .replace(/\\\\/g, '/');

  // Extract description from top JSDoc comment
  let description = '';
  const docMatch = content.match(/^\\/\\*\\*\\s*\\n\\s*\\*\\s*([^\\n]+)/);
  if (docMatch) description = docMatch[1].trim();

  // Extract exports — CJS (module.exports) and ESM (export { ... }, export function)
  const xports = [];
  const cjsMatch = content.match(/module\\.exports\\s*=\\s*\\{([^}]+)\\}/);
  if (cjsMatch) {
    cjsMatch[1].split(',').forEach(function(s) {
      const name = s.trim().split(':')[0].trim();
      if (name && !name.startsWith('//')) xports.push(name);
    });
  }
  // ESM named exports: export { foo, bar } or export function foo
  const esmExportRe = /^export\\s+(?:function|const|let|class|async\\s+function)\\s+(\\w+)/gm;
  let em;
  while ((em = esmExportRe.exec(content)) !== null) {
    if (!xports.includes(em[1])) xports.push(em[1]);
  }

  // Extract dependencies — CJS require() and ESM import
  const deps = [];
  const reqRe = /require\\s*\\(\\s*['"]([^'"]+)['"]\\s*\\)/g;
  let m;
  while ((m = reqRe.exec(content)) !== null) {
    const dep = m[1];
    if (dep.startsWith('./') || dep.startsWith('../')) {
      deps.push(stripExt(dep.replace(/^\\.+\\//, '')));
    } else {
      deps.push(dep);
    }
  }
  const importRe = /import\\s+.*?from\\s+['"]([^'"]+)['"]/g;
  while ((m = importRe.exec(content)) !== null) {
    const dep = m[1];
    if (dep.startsWith('./') || dep.startsWith('../')) {
      deps.push(stripExt(dep.replace(/^\\.+\\//, '')));
    } else {
      deps.push(dep);
    }
  }

  // Extract function names with line numbers
  const functions = {};
  const fnRe = /^(?:export\\s+)?(?:async\\s+)?function\\s+(\\w+)\\s*\\(/gm;
  while ((m = fnRe.exec(content)) !== null) {
    const lineNum = content.substring(0, m.index).split('\\n').length;
    functions[m[1]] = { line: lineNum };
  }

  const existing = structure.modules[key] || {};
  structure.modules[key] = {
    file: file,
    description: description || existing.description || '',
    exports: xports,
    depends: deps.filter(function(v, i, a) { return a.indexOf(v) === i; }),
    functions: Object.keys(functions).length > 0 ? functions : (existing.functions || {})
  };
}

// Update timestamp and save
structure.lastUpdated = new Date().toISOString().split('T')[0];
if (structure._frame_metadata) {
  structure._frame_metadata.lastUpdated = structure.lastUpdated;
}
fs.writeFileSync(STRUCTURE_FILE, JSON.stringify(structure, null, 2) + '\\n');
`;
}

/**
 * Session-start hook template (deployed to .subframe/hooks/session-start.js)
 * Injects pending/in-progress sub-tasks into Claude's context at session start.
 */
export function getSessionStartHookTemplate(): string {
  return `#!/usr/bin/env node
/**
 * SubFrame SessionStart Hook
 *
 * Injects pending/in-progress sub-tasks into Claude's context at session start.
 * Also injects a compact session checklist that survives context compaction.
 *
 * Fires on: startup, resume, compact (re-injects after context compaction).
 *
 * Output on stdout is added to Claude's conversation context.
 */

const fs = require('fs');
const path = require('path');

function findTasksFile(startDir) {
  let dir = startDir || process.cwd();
  while (dir !== path.dirname(dir)) {
    const tasksPath = path.join(dir, '.subframe', 'tasks.json');
    if (fs.existsSync(tasksPath)) return tasksPath;
    dir = path.dirname(dir);
  }
  return null;
}

function main() {
  const tasksPath = findTasksFile();
  if (!tasksPath) process.exit(0);

  let data;
  try {
    const raw = fs.readFileSync(tasksPath, 'utf8').replace(/,\\s*([\\]}])/g, '$1');
    data = JSON.parse(raw);
  } catch {
    process.exit(0);
  }

  const inProgress = data.tasks?.inProgress || [];
  const pending = data.tasks?.pending || [];

  // Priority icons
  function pi(p) { return p === 'high' ? '\\u25B2' : p === 'low' ? '\\u25BD' : '\\u25C7'; }

  const lines = ['<sub-tasks-context>'];

  if (inProgress.length > 0) {
    lines.push('\\u25C6 SubFrame \\u2500 \\uD83D\\uDD04 In Progress (' + inProgress.length + '):');
    for (const t of inProgress) {
      lines.push('  ' + pi(t.priority) + ' [' + t.id + '] ' + t.title);
      if (t.notes) {
        const lastNote = t.notes.split('\\n').pop().trim();
        if (lastNote) lines.push('    \\u2514 ' + lastNote);
      }
    }
  }

  if (pending.length > 0) {
    lines.push('\\u25C6 SubFrame \\u2500 \\uD83D\\uDCCB Pending (' + pending.length + '):');
    const sorted = [...pending].sort((a, b) => {
      const p = { high: 0, medium: 1, low: 2 };
      return (p[a.priority] || 1) - (p[b.priority] || 1);
    });
    const shown = sorted.slice(0, 5);
    for (const t of shown) {
      lines.push('  ' + pi(t.priority) + ' [' + t.id + '] ' + t.title);
    }
    if (pending.length > 5) {
      lines.push('  \\u2026 +' + (pending.length - 5) + ' more \\u2192 node scripts/task.js list');
    }
  }

  lines.push('Use: start <id> | complete <id> | add --title "..."');
  lines.push('</sub-tasks-context>');

  console.log(lines.join('\\n'));
}

main();
`;
}

/**
 * Prompt-submit hook template (deployed to .subframe/hooks/prompt-submit.js)
 * Fuzzy-matches user prompts against pending sub-task titles.
 */
export function getPromptSubmitHookTemplate(): string {
  return `#!/usr/bin/env node
/**
 * SubFrame UserPromptSubmit Hook
 *
 * When a user submits a prompt, fuzzy-matches it against pending sub-task titles.
 * If a match is found, suggests marking it in_progress.
 *
 * Reads hook input from stdin (JSON with { prompt } field).
 * Output on stdout is added to Claude's conversation context.
 */

const fs = require('fs');
const path = require('path');

function findTasksFile(startDir) {
  let dir = startDir || process.cwd();
  while (dir !== path.dirname(dir)) {
    const tasksPath = path.join(dir, '.subframe', 'tasks.json');
    if (fs.existsSync(tasksPath)) return tasksPath;
    dir = path.dirname(dir);
  }
  return null;
}

function matchScore(prompt, title) {
  const promptWords = new Set(prompt.toLowerCase().replace(/[^a-z0-9\\s]/g, ' ').split(/\\s+/).filter(w => w.length > 2));
  const titleWords = title.toLowerCase().replace(/[^a-z0-9\\s]/g, ' ').split(/\\s+/).filter(w => w.length > 2);
  if (titleWords.length === 0) return 0;
  let matches = 0;
  for (const word of titleWords) {
    if (promptWords.has(word)) matches++;
  }
  return matches / titleWords.length;
}

function main() {
  let input = '';
  try { input = fs.readFileSync(0, 'utf8'); } catch { process.exit(0); }
  let hookData;
  try { hookData = JSON.parse(input); } catch { process.exit(0); }

  const prompt = hookData.prompt;
  if (!prompt || typeof prompt !== 'string' || prompt.length < 10) process.exit(0);
  if (prompt.startsWith('/')) process.exit(0);

  const tasksPath = findTasksFile(hookData.cwd) || findTasksFile(process.cwd());
  if (!tasksPath) process.exit(0);

  let data;
  try {
    const raw = fs.readFileSync(tasksPath, 'utf8').replace(/,\\s*([\\]}])/g, '$1');
    data = JSON.parse(raw);
  } catch { process.exit(0); }

  const pending = data.tasks?.pending || [];
  if (pending.length === 0) process.exit(0);

  let bestTask = null;
  let bestScore = 0;

  for (const task of pending) {
    const titleScore = matchScore(prompt, task.title);
    const descScore = task.description ? matchScore(prompt, task.description) * 0.5 : 0;
    const score = Math.max(titleScore, descScore);
    if (score > bestScore) {
      bestScore = score;
      bestTask = task;
    }
  }

  if (bestScore >= 0.4 && bestTask) {
    console.log('<sub-task-match>');
    console.log('\\u25C6 SubFrame \\u2500 \\uD83C\\uDFAF Matches sub-task [' + bestTask.id + ']: "' + bestTask.title + '" (' + bestTask.priority + ')');
    console.log('\\u2192 Start: node scripts/task.js start ' + bestTask.id);
    console.log('</sub-task-match>');
  }
}

main();
`;
}

/**
 * Stop hook template (deployed to .subframe/hooks/stop.js)
 * Reminds about in-progress sub-tasks and detects untracked work.
 */
export function getStopHookTemplate(): string {
  return `#!/usr/bin/env node
/**
 * SubFrame Stop Hook
 *
 * When Claude finishes responding, performs two checks:
 * 1. Reminds about in-progress sub-tasks
 * 2. Detects untracked work (modified src/ files with no in-progress sub-task)
 *
 * Output on stdout is added to Claude's conversation context.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function findProjectRoot(startDir) {
  let dir = startDir || process.cwd();
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.subframe'))) return dir;
    dir = path.dirname(dir);
  }
  return null;
}

function findTasksFile(startDir) {
  const root = findProjectRoot(startDir);
  if (!root) return null;
  const tasksPath = path.join(root, '.subframe', 'tasks.json');
  return fs.existsSync(tasksPath) ? tasksPath : null;
}

function getModifiedSourceFiles(projectRoot) {
  try {
    const output = execSync('git diff --name-only HEAD -- src/', {
      cwd: projectRoot,
      encoding: 'utf8',
      timeout: 3000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    if (!output) return [];
    return output.split('\\n').filter(f => /\\.(ts|tsx|js|jsx)$/.test(f));
  } catch {
    return [];
  }
}

function main() {
  let input = '';
  try { input = fs.readFileSync(0, 'utf8'); } catch { process.exit(0); }
  let hookData;
  try { hookData = JSON.parse(input); } catch { process.exit(0); }

  const projectRoot = findProjectRoot(hookData.cwd) || findProjectRoot(process.cwd());
  if (!projectRoot) process.exit(0);

  const tasksPath = findTasksFile(hookData.cwd) || findTasksFile(process.cwd());
  if (!tasksPath) process.exit(0);

  let data;
  try {
    const raw = fs.readFileSync(tasksPath, 'utf8').replace(/,\\s*([\\]}])/g, '$1');
    data = JSON.parse(raw);
  } catch { process.exit(0); }

  const inProgress = data.tasks?.inProgress || [];
  const lines = [];

  if (inProgress.length > 0) {
    lines.push('<sub-task-reminder>');
    lines.push('\\u25C6 SubFrame \\u2500 \\uD83D\\uDD04 ' + inProgress.length + ' sub-task(s) in progress:');
    for (const t of inProgress) {
      lines.push('  \\u2022 [' + t.id + '] ' + t.title);
    }
    lines.push('\\u2192 Done? complete <id> | Notes? update <id> --add-note "..."');
    lines.push('</sub-task-reminder>');
  }

  if (inProgress.length === 0) {
    const modifiedFiles = getModifiedSourceFiles(projectRoot);
    if (modifiedFiles.length >= 2) {
      lines.push('<sync-check>');
      lines.push('\\u25C6 SubFrame \\u2500 \\u26A0 ' + modifiedFiles.length + ' source file(s) changed but no sub-task is tracking this work.');
      lines.push('  Before wrapping up, consider:');
      lines.push('  \\u2022 Track: node scripts/task.js add --title "..." && node scripts/task.js complete <id>');
      lines.push('  \\u2022 Decisions \\u2192 .subframe/PROJECT_NOTES.md');
      lines.push('  \\u2022 Changes \\u2192 .subframe/docs-internal/changelog.md');
      lines.push('</sync-check>');
    }
  }

  if (lines.length > 0) {
    console.log(lines.join('\\n'));
  }
}

main();
`;
}

/**
 * Pre-tool-use hook template (deployed to .subframe/hooks/pre-tool-use.js)
 * Writes a "running" step to agent-state.json for real-time agent visualization.
 */
export function getPreToolUseHookTemplate(): string {
  return `#!/usr/bin/env node
/**
 * SubFrame PreToolUse Hook
 *
 * Fires before every tool invocation. Writes a "running" step to
 * .subframe/agent-state.json so the renderer can show real-time activity.
 *
 * - Reads JSON from stdin (Claude Code hook data)
 * - Creates/updates the session entry in agent-state.json
 * - Outputs NOTHING to stdout (side-effect-only hook)
 */

const fs = require('fs');
const path = require('path');

// ── Human-readable verb mapping ─────────────────────────────────────────────

const TOOL_VERBS = {
  Read: 'Reading',
  Write: 'Writing',
  Edit: 'Editing',
  Bash: 'Running command',
  Glob: 'Searching files',
  Grep: 'Searching content',
  Agent: 'Spawning agent',
  WebFetch: 'Fetching URL',
  WebSearch: 'Searching web',
  NotebookEdit: 'Editing notebook',
  Skill: 'Running skill',
  EnterPlanMode: 'Entering plan mode',
  ExitPlanMode: 'Exiting plan mode',
};

const MAX_STEPS = 50;
const STALE_MS = 5 * 60 * 1000; // 5 minutes

// ── Helpers ─────────────────────────────────────────────────────────────────

function findProjectRoot(startDir) {
  let dir = startDir || process.cwd();
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.subframe'))) return dir;
    dir = path.dirname(dir);
  }
  return null;
}

function buildLabel(toolName, toolInput) {
  const verb = TOOL_VERBS[toolName] || toolName;

  if (!toolInput || typeof toolInput !== 'object') return verb;

  // Bash — prefer description, fall back to truncated command
  if (toolName === 'Bash') {
    if (toolInput.description) return toolInput.description.slice(0, 60);
    if (toolInput.command) return verb + ': ' + toolInput.command.slice(0, 50);
    return verb;
  }

  // File-based tools
  if (toolInput.file_path) {
    return verb + ' ' + path.basename(toolInput.file_path);
  }

  // Glob
  if (toolInput.pattern && toolName === 'Glob') {
    return verb + ': ' + toolInput.pattern;
  }

  // Grep
  if (toolInput.pattern && toolName === 'Grep') {
    return verb + ': ' + toolInput.pattern.slice(0, 40);
  }

  // WebFetch
  if (toolInput.url) {
    try {
      return verb + ': ' + new URL(toolInput.url).hostname;
    } catch {
      return verb;
    }
  }

  // WebSearch
  if (toolInput.query) {
    return verb + ': ' + toolInput.query.slice(0, 40);
  }

  // Skill
  if (toolInput.skill) {
    return verb + ': ' + toolInput.skill;
  }

  // Notebook
  if (toolInput.notebook_path) {
    return verb + ' ' + path.basename(toolInput.notebook_path);
  }

  return verb;
}

function loadState(statePath) {
  try {
    const raw = fs.readFileSync(statePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeState(statePath, state) {
  const dir = path.dirname(statePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const content = JSON.stringify(state, null, 2);
  const tmp = statePath + '.tmp.' + process.pid;
  fs.writeFileSync(tmp, content, 'utf8');
  try {
    fs.renameSync(tmp, statePath);
  } catch {
    // Windows fallback: rename can fail with EPERM/EBUSY if file is locked
    try { fs.writeFileSync(statePath, content, 'utf8'); } catch { /* ignore */ }
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
  }
}

function cleanStaleSessions(state, now) {
  for (const session of state.sessions) {
    const lastActivity = new Date(session.lastActivityAt).getTime();
    if (now - lastActivity > STALE_MS && session.status === 'active') {
      session.status = 'idle';
      session.currentTool = undefined;
      for (const step of session.steps || []) {
        if (step.status === 'running') {
          step.status = 'completed';
          step.completedAt = new Date(now).toISOString();
        }
      }
    }
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

function main() {
  let input = '';
  try {
    input = fs.readFileSync(0, 'utf8');
  } catch {
    process.exit(0);
  }

  let hookData;
  try {
    hookData = JSON.parse(input);
  } catch {
    process.exit(0);
  }

  const sessionId = hookData.session_id;
  const toolName = hookData.tool_name;
  const toolInput = hookData.tool_input;

  if (!sessionId || !toolName) process.exit(0);

  const projectRoot = findProjectRoot(hookData.cwd) || findProjectRoot(process.cwd());
  if (!projectRoot) process.exit(0);

  const statePath = path.join(projectRoot, '.subframe', 'agent-state.json');
  const now = Date.now();
  const nowISO = new Date(now).toISOString();

  let state = loadState(statePath) || {
    projectPath: projectRoot,
    sessions: [],
    lastUpdated: nowISO,
  };

  // Ensure sessions array
  if (!Array.isArray(state.sessions)) state.sessions = [];

  // Clean stale sessions
  cleanStaleSessions(state, now);

  // Find or create session
  let session = state.sessions.find(s => s.sessionId === sessionId);
  if (!session) {
    session = {
      sessionId: sessionId,
      status: 'active',
      steps: [],
      startedAt: nowISO,
      lastActivityAt: nowISO,
    };
    state.sessions.push(session);
  }

  // Update session
  session.status = 'active';
  session.currentTool = toolName;
  session.lastActivityAt = nowISO;

  // Build and add step
  const label = buildLabel(toolName, toolInput);
  const step = {
    id: 'step-' + now + '-' + session.steps.length,
    label: label,
    toolName: toolName,
    status: 'running',
    startedAt: nowISO,
  };

  if (!Array.isArray(session.steps)) session.steps = [];
  session.steps.push(step);

  // Cap steps at MAX_STEPS (trim oldest)
  if (session.steps.length > MAX_STEPS) {
    session.steps = session.steps.slice(session.steps.length - MAX_STEPS);
  }

  state.lastUpdated = nowISO;

  writeState(statePath, state);
}

try {
  main();
} catch {
  // Never fail loudly
  process.exit(0);
}
`;
}

/**
 * Post-tool-use hook template (deployed to .subframe/hooks/post-tool-use.js)
 * Marks matching running step as "completed" in agent-state.json.
 */
export function getPostToolUseHookTemplate(): string {
  return `#!/usr/bin/env node
/**
 * SubFrame PostToolUse Hook
 *
 * Fires after every tool invocation. Updates the matching "running" step
 * in .subframe/agent-state.json to "completed" status.
 *
 * - Reads JSON from stdin (Claude Code hook data)
 * - Finds the last running step matching the tool and marks it completed
 * - Outputs NOTHING to stdout (side-effect-only hook)
 */

const fs = require('fs');
const path = require('path');

const STALE_MS = 5 * 60 * 1000; // 5 minutes

// ── Helpers ─────────────────────────────────────────────────────────────────

function findProjectRoot(startDir) {
  let dir = startDir || process.cwd();
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.subframe'))) return dir;
    dir = path.dirname(dir);
  }
  return null;
}

function loadState(statePath) {
  try {
    const raw = fs.readFileSync(statePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeState(statePath, state) {
  const dir = path.dirname(statePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const content = JSON.stringify(state, null, 2);
  const tmp = statePath + '.tmp.' + process.pid;
  fs.writeFileSync(tmp, content, 'utf8');
  try {
    fs.renameSync(tmp, statePath);
  } catch {
    // Windows fallback: rename can fail with EPERM/EBUSY if file is locked
    try { fs.writeFileSync(statePath, content, 'utf8'); } catch { /* ignore */ }
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
  }
}

function cleanStaleSessions(state, now) {
  for (const session of state.sessions) {
    const lastActivity = new Date(session.lastActivityAt).getTime();
    if (now - lastActivity > STALE_MS && session.status === 'active') {
      session.status = 'idle';
      session.currentTool = undefined;
      for (const step of session.steps || []) {
        if (step.status === 'running') {
          step.status = 'completed';
          step.completedAt = new Date(now).toISOString();
        }
      }
    }
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

function main() {
  let input = '';
  try {
    input = fs.readFileSync(0, 'utf8');
  } catch {
    process.exit(0);
  }

  let hookData;
  try {
    hookData = JSON.parse(input);
  } catch {
    process.exit(0);
  }

  const sessionId = hookData.session_id;
  const toolName = hookData.tool_name;

  if (!sessionId || !toolName) process.exit(0);

  const projectRoot = findProjectRoot(hookData.cwd) || findProjectRoot(process.cwd());
  if (!projectRoot) process.exit(0);

  const statePath = path.join(projectRoot, '.subframe', 'agent-state.json');
  const now = Date.now();
  const nowISO = new Date(now).toISOString();

  let state = loadState(statePath);
  if (!state || !Array.isArray(state.sessions)) process.exit(0);

  // Clean stale sessions
  cleanStaleSessions(state, now);

  // Find session
  const session = state.sessions.find(s => s.sessionId === sessionId);
  if (!session) process.exit(0);

  session.lastActivityAt = nowISO;

  // Find the LAST step with status "running" that matches the tool_name
  let matchedStep = null;
  if (Array.isArray(session.steps)) {
    for (let i = session.steps.length - 1; i >= 0; i--) {
      if (session.steps[i].status === 'running' && session.steps[i].toolName === toolName) {
        matchedStep = session.steps[i];
        break;
      }
    }
  }

  if (matchedStep) {
    // Update the matched step
    matchedStep.status = 'completed';
    matchedStep.completedAt = nowISO;
  } else {
    // Edge case: no running step found — create a completed step
    if (!Array.isArray(session.steps)) session.steps = [];
    session.steps.push({
      id: 'step-' + now,
      label: toolName,
      toolName: toolName,
      status: 'completed',
      startedAt: nowISO,
      completedAt: nowISO,
    });
  }

  // Check if any steps are still running
  const hasRunning = session.steps.some(s => s.status === 'running');
  if (!hasRunning) {
    session.currentTool = undefined;
  }

  state.lastUpdated = nowISO;

  writeState(statePath, state);
}

try {
  main();
} catch {
  // Never fail loudly
  process.exit(0);
}
`;
}

/**
 * Claude Code settings.json hooks template
 * Returns the hooks portion of .claude/settings.json pointing to .subframe/hooks/
 */
export function getClaudeSettingsHooksTemplate(): { hooks: Record<string, Array<{ matcher: string; hooks: Array<{ type: string; command: string }> }>> } {
  return {
    hooks: {
      "SessionStart": [
        {
          matcher: "",
          hooks: [{ type: "command", command: "node .subframe/hooks/session-start.js" }]
        }
      ],
      "UserPromptSubmit": [
        {
          matcher: "",
          hooks: [{ type: "command", command: "node .subframe/hooks/prompt-submit.js" }]
        }
      ],
      "Stop": [
        {
          matcher: "",
          hooks: [{ type: "command", command: "node .subframe/hooks/stop.js" }]
        }
      ],
      "PreToolUse": [
        {
          matcher: "",
          hooks: [{ type: "command", command: "node .subframe/hooks/pre-tool-use.js" }]
        }
      ],
      "PostToolUse": [
        {
          matcher: "",
          hooks: [{ type: "command", command: "node .subframe/hooks/post-tool-use.js" }]
        }
      ]
    }
  };
}

/**
 * /sub-tasks skill template — deployed version uses direct file manipulation
 * instead of the SubFrame-app-specific scripts/task.js CLI
 */
export function getSubTasksSkillTemplate(): string {
  return `---
name: sub-tasks
description: View and manage SubFrame Sub-Tasks. Use when starting work, completing tasks, checking what's pending, or creating new tasks from conversation.
disable-model-invocation: false
argument-hint: [list|start|complete|add|get|archive]
allowed-tools: Bash, Read, Write, Edit, Glob
---

# SubFrame Sub-Tasks

Manage the project's Sub-Task system. Sub-Tasks are SubFrame's project task tracking stored as individual markdown files in \`.subframe/tasks/\`.

## Dynamic Context

Current task index:
!\`cat .subframe/tasks.json 2>/dev/null || echo "No tasks.json found"\`

## Instructions

**Argument:** \`$ARGUMENTS\`

### Task File Format

Each task is a markdown file in \`.subframe/tasks/\` with YAML frontmatter:

\`\`\`markdown
---
id: task-abc123
title: My task title
status: pending
priority: medium
category: feature
description: What needs to be done
userRequest: The user's original words
acceptanceCriteria: How to verify completion
blockedBy: []
blocks: []
createdAt: 2024-01-01T00:00:00.000Z
updatedAt: 2024-01-01T00:00:00.000Z
completedAt: null
---

## Notes

Session notes go here.

## Steps

- [ ] Step one
- [x] Step two (completed)
\`\`\`

### Operations

#### List tasks
Read \`.subframe/tasks.json\` for the index overview, or glob \`.subframe/tasks/*.md\` and read frontmatter.

#### Get task details
Read the specific \`.subframe/tasks/<id>.md\` file.

#### Start a task (pending → in_progress)
Edit the task's frontmatter: set \`status: in_progress\` and update \`updatedAt\`.

#### Complete a task
Edit the task's frontmatter: set \`status: completed\`, set \`completedAt\` to current ISO timestamp, update \`updatedAt\`.

#### Add a new task
Create a new \`.subframe/tasks/<id>.md\` file with:
- Generate id: \`task-\` + 8 random alphanumeric chars
- Set \`status: pending\`, \`createdAt\` and \`updatedAt\` to current ISO timestamp
- \`completedAt: null\`
- Include all required fields in frontmatter

#### Update a task
Edit the frontmatter fields as needed. Always update \`updatedAt\`.

#### Archive completed tasks
Move completed \`.md\` files to \`.subframe/tasks/archive/YYYY/\` (create directory if needed).

### After Any Write Operation

Regenerate the \`.subframe/tasks.json\` index by reading all \`.subframe/tasks/*.md\` files (excluding archive/) and building the JSON structure with tasks grouped by status (pending, inProgress, completed).

### If invoked without arguments

Show the current task list and ask the user what they'd like to do:
1. Start a pending task
2. Complete an in-progress task
3. Create a new task
4. Archive completed tasks

### If invoked with a task ID

Show full details for that task by reading its .md file.

### Creating tasks from conversation

When the user says things like "let's do this later", "add a task for...", or "we should...":
1. Capture the user's exact words as \`userRequest\`
2. Write a detailed \`description\` explaining what, how, and which files
3. Set appropriate \`priority\` and \`category\`
4. Create the .md file
5. Regenerate the index
6. Confirm the task was created
`;
}

/**
 * /sub-docs skill template — generalized for any SubFrame-managed project
 */
export function getSubDocsSkillTemplate(): string {
  return `---
name: sub-docs
description: Sync all SubFrame documentation after feature work. Updates CLAUDE.md lists, changelog, PROJECT_NOTES decisions, and STRUCTURE.json.
argument-hint: [summary of what changed]
disable-model-invocation: false
allowed-tools: Bash, Read, Edit, Write, Grep, Glob
---

# SubFrame Documentation Sync

After significant feature work, synchronize all SubFrame documentation references. This skill automates the "Before Ending Work" checklist.

## Dynamic Context

Current version:
!\`node -e "console.log(require('./package.json').version)" 2>/dev/null || echo "unknown"\`

Recent commits (last 10):
!\`git log --oneline --no-decorate -10 2>/dev/null || echo "No git history"\`

Files changed (unstaged + staged):
!\`git diff --name-only HEAD 2>/dev/null | head -30\`

## Instructions

**Argument:** \`$ARGUMENTS\`

The argument should describe what feature/changes were made. If empty, infer from recent git changes.

### Step 1: Identify What Changed

Read the recent changes (git diff, argument context) and categorize:
- **New source modules** → update CLAUDE.md module lists (if applicable)
- **New components** → update CLAUDE.md component lists (if applicable)
- **Architecture decisions** → add to \`.subframe/PROJECT_NOTES.md\` Session Notes
- **User-facing features** → add to \`.subframe/docs-internal/changelog.md\` under [Unreleased]

### Step 2: Update CLAUDE.md

Read \`CLAUDE.md\` and update only the sections that need changes. If CLAUDE.md has module/component lists, add new entries. Preserve existing formatting and ordering.

**Rules:**
- Only add genuinely new entries — don't duplicate
- Keep formatting consistent with existing entries
- Don't modify user-written content outside SubFrame-managed sections

### Step 3: Update Changelog

Read \`.subframe/docs-internal/changelog.md\` and add entries under \`## [Unreleased]\`.

**Format:** Follow the existing changelog style:
- Group under \`### Added\`, \`### Changed\`, \`### Fixed\`, \`### Removed\`
- Bold feature name, em-dash, brief description
- Sub-bullets for implementation details

### Step 4: Update PROJECT_NOTES (if architecture decision)

If the work involved an architecture decision worth preserving, add a session note to \`.subframe/PROJECT_NOTES.md\` under \`## Session Notes\`.

**Format:**
\`\`\`markdown
### [YYYY-MM-DD] Title

**Context:** Why this decision was needed.

**Decision:** What was chosen.

**Key architectural choices:**
- Point 1
- Point 2

**Files:** list of key files
\`\`\`

**Skip this step** for routine changes (bug fixes, minor UI tweaks, config changes).

### Step 5: Regenerate STRUCTURE.json

Run: \`npm run structure\`

This picks up any new/renamed/deleted source files.

### Step 6: Summary

Present a checklist of what was updated:
- [ ] CLAUDE.md — what was added/changed
- [ ] changelog.md — entries added
- [ ] PROJECT_NOTES.md — decision added (or skipped)
- [ ] STRUCTURE.json — regenerated
`;
}

/**
 * /sub-audit skill template — generalized for any SubFrame-managed project
 */
export function getSubAuditSkillTemplate(): string {
  return `---
name: sub-audit
description: Run a code review and documentation audit on recent changes. Finds bugs, edge cases, missing docs, and type safety issues.
argument-hint: [scope - e.g., "auth feature", "last 5 commits"]
disable-model-invocation: false
allowed-tools: Bash, Read, Grep, Glob, Agent
---

# SubFrame Audit

Run a thorough audit on recent changes, combining code review and documentation checks.

## Dynamic Context

Recent commits (last 15):
!\`git log --oneline --no-decorate -15 2>/dev/null || echo "No git history"\`

Files changed vs main:
!\`git diff --name-only main...HEAD 2>/dev/null | head -40\`

## Instructions

**Argument:** \`$ARGUMENTS\`

The argument should describe the scope to audit. If empty, audit all changes since the last merge to main.

### Phase 1: Identify Scope

Determine which files to audit:
- If argument specifies a feature/scope, identify the relevant files
- If empty, use \`git diff --name-only main...HEAD\` to find all changed files
- Group files by layer (e.g., backend, frontend, shared, config, tests)

### Phase 2: Code Review (spawn agent)

Spawn a code review agent (\`feature-dev:code-reviewer\` subagent type) to review the changed files. The agent should check for:

1. **Critical bugs** — null/undefined access, race conditions, unhandled errors, infinite loops
2. **Type safety** — \`as any\` casts, missing type imports, loose typing where strict types exist
3. **Platform issues** — Windows path handling, file system edge cases
4. **Security** — command injection, XSS in rendered content, path traversal
5. **Logic errors** — off-by-one, incorrect conditions, missing edge cases

### Phase 3: Documentation Audit (spawn agent)

Spawn an explore agent (\`Explore\` subagent type) to check documentation completeness:

1. **CLAUDE.md** — Are all modules/components listed?
2. **changelog.md** — Does [Unreleased] reflect all new features?
3. **PROJECT_NOTES.md** — Are architecture decisions documented?
4. **STRUCTURE.json** — Is it up to date? (compare module count with actual files)

### Phase 4: Report

Present findings in this format:

\`\`\`
## Audit Report

### Critical Issues (must fix)
1. [FILE:LINE] Description — severity, impact

### Important Issues (should fix)
1. [FILE:LINE] Description — severity, impact

### Documentation Gaps
1. [FILE] What's missing

### Suggestions (nice to have)
1. Description
\`\`\`

**Confidence filtering:** Only report issues you are confident about. Skip speculative concerns or style preferences. Each reported issue should include:
- Exact file and line number
- What the problem is
- Why it matters (impact)
- Suggested fix

### Phase 5: Offer Fixes

After presenting the report, ask the user if they want to fix any of the reported issues. If yes, apply fixes starting with Critical → Important → Documentation.
`;
}

/**
 * /onboard skill template — analyze project intelligence and bootstrap SubFrame files
 */
export function getOnboardSkillTemplate(): string {
  return `---
name: onboard
description: Analyze project intelligence files and bootstrap SubFrame's STRUCTURE.json, PROJECT_NOTES.md, and initial sub-tasks from existing codebase context.
disable-model-invocation: false
argument-hint: [--dry-run]
allowed-tools: Bash, Read, Write, Glob, Grep
---

# SubFrame Onboard

Analyze an existing project and bootstrap SubFrame-compatible output files: \`.subframe/STRUCTURE.json\`, \`.subframe/PROJECT_NOTES.md\`, and initial sub-tasks.

## Dynamic Context

Root directory listing:
!\`ls -la\`

Package manifest:
!\`cat package.json 2>/dev/null || cat pyproject.toml 2>/dev/null || cat Cargo.toml 2>/dev/null || echo "No package manifest found"\`

Project overview:
!\`head -100 README.md 2>/dev/null || echo "No README found"\`

AI configuration (Claude):
!\`head -50 CLAUDE.md 2>/dev/null || echo "No CLAUDE.md found"\`

AI configuration (Gemini):
!\`head -50 GEMINI.md 2>/dev/null || echo "No GEMINI.md found"\`

Source file survey:
!\`find . -maxdepth 2 -name "*.ts" -o -name "*.tsx" -o -name "*.py" -o -name "*.rs" -o -name "*.go" -o -name "*.java" -o -name "*.rb" 2>/dev/null | head -50\`

Existing SubFrame state:
!\`cat .subframe/STRUCTURE.json 2>/dev/null || echo "No STRUCTURE.json yet"\`

## Instructions

**Argument:** \\\`$ARGUMENTS\\\`

### Dry-Run Mode

If \\\`$ARGUMENTS\\\` contains \\\`--dry-run\\\`, **do not write any files**. Instead, show the full output that *would* be written for each file, clearly labeled with the target path. Then stop.

### Step 1: Analyze the Project

Using the gathered dynamic context, determine:

1. **Project type** — What kind of project is this? (web app, CLI tool, library, monorepo, etc.)
2. **Language and framework** — Primary language, framework, and build tooling
3. **Architecture** — Entry points, module structure, process model (single, client-server, microservices, etc.)
4. **Key modules** — Identify the most important source files and their purposes (scan up to 3 directory levels deep)
5. **Existing documentation** — What context already exists in README, CLAUDE.md, GEMINI.md, or other docs?
6. **Dependencies** — Key runtime and dev dependencies from the package manifest

### Step 2: Generate STRUCTURE.json

Build a SubFrame-compatible \\\`STRUCTURE.json\\\` following this schema:

\\\`\\\`\\\`json
{
  "version": "1.0",
  "description": "<project-name> - Module structure and communication map",
  "lastUpdated": "<YYYY-MM-DD>",
  "architecture": {
    "type": "<project-type>",
    "entryPoint": "<main-entry-file>",
    "notes": "<brief architecture description>"
  },
  "modules": {
    "<module-key>": {
      "file": "<relative-path>",
      "description": "<what this module does>",
      "exports": ["<exported-function-or-class>"],
      "depends": ["<dependency-module-key>"],
      "functions": {
        "<function-name>": {
          "line": 0,
          "params": ["<param>"],
          "purpose": "<what it does>"
        }
      },
      "loc": 0
    }
  },
  "conventions": {
    "naming": "<file/variable naming conventions observed>",
    "patterns": "<architectural patterns used (MVC, hooks, modules, etc.)>"
  }
}
\\\`\\\`\\\`

**Rules:**
- If a \\\`STRUCTURE.json\\\` already exists, **merge** new data into it. Do not overwrite user-supplied descriptions or manually curated content. Only fill in empty fields and add newly discovered modules.
- If no \\\`STRUCTURE.json\\\` exists, create a fresh one.
- Scan source files to populate the \\\`modules\\\` section. For each module, read the first ~50 lines to identify exports and purpose.
- Set \\\`lastUpdated\\\` to today's date.

### Step 3: Generate PROJECT_NOTES.md

Build a SubFrame-compatible \\\`PROJECT_NOTES.md\\\` following this structure:

\\\`\\\`\\\`markdown
# <Project Name> - Project Documentation

## Project Vision

**Problem:** <What problem does this project solve?>
**Solution:** <Brief description of the solution>
**Target User:** <Who is this for?>

---

## Project Summary

<1-2 paragraph summary of the project, its purpose, and current state.>

---

## Tech Stack

### Core
- **<Technology>** (<version>): <Why it's used>

### Why These Technologies?
- **<Technology>**: <Rationale>

---

## Architecture

<Description of the project's architecture, module layout, and data flow.>

---

## Key Decisions

<Any architecture or technology decisions discoverable from the codebase.>

---

## Session Notes

<Empty section — to be filled during future development sessions.>
\\\`\\\`\\\`

**Rules:**
- If a \\\`PROJECT_NOTES.md\\\` already exists, **do not overwrite it**. Instead, show a diff of suggested additions and ask the user before applying changes.
- If no \\\`PROJECT_NOTES.md\\\` exists, create a fresh one from the template above.
- Fill in as much detail as the codebase context allows. Leave sections with \\\`<placeholder>\\\` text if insufficient information is available.

### Step 4: Suggest Initial Sub-Tasks

Analyze the project's current state and suggest **3 to 5 initial sub-tasks**. Good candidates include:

- Missing documentation that should exist
- Test coverage gaps (if a test framework is configured but few tests exist)
- TODO/FIXME comments found in the source code
- Configuration improvements (linting, formatting, CI)
- Architecture improvements visible from the structure analysis

For each suggested sub-task, show:
- **Title** — concise imperative description
- **Description** — what needs to be done and why
- **Priority** — \\\`low\\\`, \\\`medium\\\`, or \\\`high\\\`
- **Category** — \\\`feature\\\`, \\\`fix\\\`, \\\`docs\\\`, \\\`refactor\\\`, \\\`test\\\`, \\\`chore\\\`

**Ask the user to confirm** which sub-tasks to create before writing any. Then create the approved ones using the task CLI:

\\\`\\\`\\\`bash
node scripts/task.js add --title "<title>" --description "<description>" --priority <priority> --category <category>
\\\`\\\`\\\`

If the task CLI script (\\\`scripts/task.js\\\`) does not exist in the target project, skip sub-task creation and inform the user that the SubFrame task CLI is not available.

### Step 5: Ensure Directory Structure

Before writing any files, ensure the \\\`.subframe/\\\` directory and its subdirectories exist:

\\\`\\\`\\\`bash
mkdir -p .subframe/tasks
\\\`\\\`\\\`

### Step 6: Write Files

Write the generated content:
1. \\\`.subframe/STRUCTURE.json\\\` — the module map
2. \\\`.subframe/PROJECT_NOTES.md\\\` — the project documentation

### Step 7: Summary

Show a summary of what was created or updated:

\\\`\\\`\\\`
## Onboard Summary

**Project:** <name> (<type>)
**Language:** <primary language> + <framework>

### Files Written
- \\\`.subframe/STRUCTURE.json\\\` — <N> modules mapped
- \\\`.subframe/PROJECT_NOTES.md\\\` — project documentation bootstrapped

### Sub-Tasks Created
- [ST-XXX] <title> (priority, category)
- ...

### Next Steps
- Review the generated files and refine descriptions
- Run \\\`npm run structure\\\` if available to enrich STRUCTURE.json with line numbers
- Start working on the created sub-tasks
\\\`\\\`\\\`
`;
}

// ─── Pipeline Workflow Templates ──────────────────────────────────────────────

export function getDefaultReviewWorkflow(): string {
  return `name: review
on:
  push:
    branches: ['*']
  manual: true

jobs:
  quality:
    name: Quality Checks
    steps:
      - name: Lint
        uses: lint
      - name: Test
        uses: test
        continue-on-error: true

  review:
    name: Code Review
    needs: [quality]
    steps:
      - name: Describe Changes
        uses: describe
      - name: Code Review
        uses: critique
        require-approval: if_patches
      - name: Freeze
        uses: freeze

  publish:
    name: Publish
    needs: [review]
    steps:
      - name: Push
        uses: push
      - name: Create PR
        uses: create-pr
`;
}

export function getTaskVerifyWorkflow(): string {
  return `name: task-verify
on:
  manual: true

jobs:
  verify:
    name: Task Verification
    steps:
      - name: Run Tests
        uses: test
      - name: Verify Implementation
        uses: critique
        require-approval: if_patches
      - name: Generate Summary
        uses: describe
`;
}

export function getHealthCheckWorkflow(): string {
  return `name: health-check
on:
  manual: true

jobs:
  audit:
    name: Project Audit
    steps:
      - name: Lint Check
        uses: lint
        continue-on-error: true
      - name: Test Suite
        uses: test
        continue-on-error: true
      - name: Architecture Review
        uses: describe
      - name: Code Quality Review
        uses: critique
`;
}
