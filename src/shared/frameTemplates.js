/**
 * SubFrame Templates
 * Templates for auto-generated SubFrame project files
 * Each template includes instructions header for Claude Code
 */

/**
 * Current template version for AGENTS.md.
 * Bump this when the template content changes significantly.
 * Files without a version marker are treated as version 0 (pre-versioning).
 */
const AGENTS_TEMPLATE_VERSION = 1;

/**
 * Get current date in YYYY-MM-DD format
 */
function getDateString() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get current ISO timestamp
 */
function getISOTimestamp() {
  return new Date().toISOString();
}

/**
 * AGENTS.md template - Main instructions file for AI assistants
 * This file is read by AI coding tools (Claude Code, Codex CLI, etc.)
 */
function getAgentsTemplate(projectName) {
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
function getStructureTemplate(projectName) {
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
function getNotesTemplate(projectName) {
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
function getTasksTemplate(projectName) {
  return {
    _frame_metadata: {
      purpose: "Task tracking for the project",
      forAI: "Check this file to understand what tasks are pending, in progress, or completed. Update task status as you work. Add new tasks when discovered during development. Follow the task recognition rules in AGENTS.md. IMPORTANT: Include userRequest (original user prompt), detailed description, and acceptanceCriteria for each task.",
      lastUpdated: getDateString(),
      generatedBy: "SubFrame"
    },
    project: projectName,
    version: "1.1",
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
      category: "feature | fix | refactor | docs | test",
      context: "Session date and context",
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
      research: "Research and exploration"
    }
  };
}

/**
 * QUICKSTART.md template
 */
function getQuickstartTemplate(projectName) {
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
| \`STRUCTURE.json\` | Module map and architecture |
| \`PROJECT_NOTES.md\` | Decisions and context |
| \`todos.json\` | Task tracking |
| \`QUICKSTART.md\` | This file |

## Project Structure

\`\`\`
${projectName}/
├── .subframe/        # SubFrame configuration
├── src/              # Source code
└── ...
\`\`\`

## For AI Assistants (Claude)

1. **First**: Read \`STRUCTURE.json\` for architecture overview
2. **Then**: Check \`PROJECT_NOTES.md\` for current context and decisions
3. **Check**: \`todos.json\` for pending tasks
4. **Follow**: Existing code patterns and conventions
5. **Update**: These files as you make changes

## Quick Context

*Add a brief summary of what this project does and its current state here*
`;
}

/**
 * .subframe/config.json template
 */
function getFrameConfigTemplate(projectName) {
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
      structure: "STRUCTURE.json",
      notes: "PROJECT_NOTES.md",
      tasks: "tasks.json",
      quickstart: "QUICKSTART.md"
    }
  };
}

/**
 * AI Tool Wrapper Script Templates
 * These wrappers inject AGENTS.md as system prompt for non-Claude tools
 */

/**
 * Codex CLI wrapper script
 * Instructs Codex to read AGENTS.md as initial prompt
 */
function getCodexWrapperTemplate() {
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
 * Can be customized for other AI tools in the future
 * @param {string} toolCommand - The CLI command to run
 * @param {string} promptFlag - Flag to pass initial prompt (e.g., '--prompt' or empty for positional)
 */
function getGenericWrapperTemplate(toolCommand, promptFlag = '') {
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
function getNativeFileTemplate() {
  const { getBacklinkBlock } = require('./backlinkUtils');
  return getBacklinkBlock() + '\n';
}

/**
 * Pre-commit hook template for user projects
 * Bash script that detects staged source files in src/ and runs the updater script.
 */
function getPreCommitHookTemplate() {
  return `#!/bin/bash
#
# SubFrame pre-commit hook
# Auto-updates STRUCTURE.json when source files in src/ are committed.
#

# Check if any source files in src/ are staged
STAGED_JS=$(git diff --cached --name-only --diff-filter=ACMRD | grep -E '^src/.*\\.(js|ts|tsx|jsx)$' || true)

# Also check for deleted source files
DELETED_JS=$(git diff --cached --name-only --diff-filter=D | grep -E '^src/.*\\.(js|ts|tsx|jsx)$' || true)

if [ -z "$STAGED_JS" ] && [ -z "$DELETED_JS" ]; then
  exit 0
fi

# Only update if STRUCTURE.json exists (SubFrame project)
if [ ! -f "STRUCTURE.json" ]; then
  exit 0
fi

# Only update if the updater script exists
UPDATER=".githooks/update-structure.js"
if [ ! -f "$UPDATER" ]; then
  exit 0
fi

echo "[SubFrame] JS files changed, updating STRUCTURE.json..."

# Run the updater with staged/deleted file lists as env vars
STAGED_FILES="$STAGED_JS" DELETED_FILES="$DELETED_JS" node "$UPDATER"

# Stage the updated STRUCTURE.json
git add STRUCTURE.json

echo "[SubFrame] STRUCTURE.json updated and staged."

exit 0
`;
}

/**
 * Pre-commit hook updater script (Node.js)
 * Companion to the pre-commit bash hook. Parses staged JS files and
 * updates STRUCTURE.json with module info (exports, deps, functions).
 */
function getHookUpdaterScript() {
  return `#!/usr/bin/env node
/**
 * SubFrame STRUCTURE.json Updater
 * Called by .githooks/pre-commit when JS files in src/ are staged.
 * Reads STAGED_FILES and DELETED_FILES from environment variables.
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const STRUCTURE_FILE = path.join(ROOT, 'STRUCTURE.json');
const SRC_DIR = path.join(ROOT, 'src');

/** Strip file extension (.js, .ts, .tsx, .jsx) from a path */
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
  const expMatch = content.match(/module\\.exports\\s*=\\s*\\{([^}]+)\\}/);
  if (expMatch) {
    expMatch[1].split(',').forEach(function(s) {
      const name = s.trim().split(':')[0].trim();
      if (name && !name.startsWith('//')) xports.push(name);
    });
  }
  // ESM named exports: export function foo, export const bar, etc.
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
 */
function getSessionStartHookTemplate() {
  return `#!/usr/bin/env node
/**
 * SubFrame SessionStart Hook
 * Injects pending/in-progress sub-tasks into Claude's context at session start.
 * Fires on: startup, resume, compact (re-injects after context compaction).
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
    const raw = fs.readFileSync(tasksPath, 'utf8').replace(/,\\s*([\\\\]}])/g, '$1');
    data = JSON.parse(raw);
  } catch {
    process.exit(0);
  }

  const inProgress = data.tasks?.inProgress || [];
  const pending = data.tasks?.pending || [];

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
 */
function getPromptSubmitHookTemplate() {
  return `#!/usr/bin/env node
/**
 * SubFrame UserPromptSubmit Hook
 * Fuzzy-matches user prompts against pending sub-task titles.
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
    const raw = fs.readFileSync(tasksPath, 'utf8').replace(/,\\s*([\\\\]}])/g, '$1');
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
 */
function getStopHookTemplate() {
  return `#!/usr/bin/env node
/**
 * SubFrame Stop Hook
 * Reminds about in-progress sub-tasks and detects untracked work.
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
    const raw = fs.readFileSync(tasksPath, 'utf8').replace(/,\\s*([\\\\]}])/g, '$1');
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
 * Reads from scripts/hooks/ — the source of truth for hook content.
 */
function getPreToolUseHookTemplate() {
  const hookPath = path.join(__dirname, '..', '..', 'scripts', 'hooks', 'pre-tool-use.js');
  return require('fs').readFileSync(hookPath, 'utf8');
}

/**
 * Post-tool-use hook template (deployed to .subframe/hooks/post-tool-use.js)
 * Reads from scripts/hooks/ — the source of truth for hook content.
 */
function getPostToolUseHookTemplate() {
  const hookPath = path.join(__dirname, '..', '..', 'scripts', 'hooks', 'post-tool-use.js');
  return require('fs').readFileSync(hookPath, 'utf8');
}

/**
 * Claude Code settings.json hooks template
 */
function getClaudeSettingsHooksTemplate() {
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
 */
function getSubTasksSkillTemplate() {
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

\\\`\\\`\\\`markdown
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
\\\`\\\`\\\`

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
function getSubDocsSkillTemplate() {
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
\\\`\\\`\\\`markdown
### [YYYY-MM-DD] Title

**Context:** Why this decision was needed.

**Decision:** What was chosen.

**Key architectural choices:**
- Point 1
- Point 2

**Files:** list of key files
\\\`\\\`\\\`

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
function getSubAuditSkillTemplate() {
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

\\\`\\\`\\\`
## Audit Report

### Critical Issues (must fix)
1. [FILE:LINE] Description — severity, impact

### Important Issues (should fix)
1. [FILE:LINE] Description — severity, impact

### Documentation Gaps
1. [FILE] What's missing

### Suggestions (nice to have)
1. Description
\\\`\\\`\\\`

**Confidence filtering:** Only report issues you are confident about. Skip speculative concerns or style preferences. Each reported issue should include:
- Exact file and line number
- What the problem is
- Why it matters (impact)
- Suggested fix

### Phase 5: Offer Fixes

After presenting the report, ask the user if they want to fix any of the reported issues. If yes, apply fixes starting with Critical → Important → Documentation.
`;
}

module.exports = {
  AGENTS_TEMPLATE_VERSION,
  getAgentsTemplate,
  getStructureTemplate,
  getNotesTemplate,
  getTasksTemplate,
  getQuickstartTemplate,
  getFrameConfigTemplate,
  getCodexWrapperTemplate,
  getGenericWrapperTemplate,
  getNativeFileTemplate,
  getPreCommitHookTemplate,
  getHookUpdaterScript,
  getSessionStartHookTemplate,
  getPromptSubmitHookTemplate,
  getStopHookTemplate,
  getPreToolUseHookTemplate,
  getPostToolUseHookTemplate,
  getClaudeSettingsHooksTemplate,
  getSubTasksSkillTemplate,
  getSubDocsSkillTemplate,
  getSubAuditSkillTemplate
};
