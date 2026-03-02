/**
 * SubFrame Templates
 * Templates for auto-generated SubFrame project files
 * Each template includes instructions header for Claude Code
 */

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

## Relationship to Native AI Tools

SubFrame **enhances** native AI coding tools — it does not replace them.

**Claude Code** works exactly as normal. Built-in features (\`/init\`, \`/commit\`, \`/review-pr\`, \`/compact\`, \`/memory\`, CLAUDE.md) are fully supported. CLAUDE.md is Claude Code's native instruction file — users can add their own tool-specific instructions freely. SubFrame adds a small backlink reference pointing to this AGENTS.md file using HTML comment markers (\`<!-- SUBFRAME:BEGIN -->\` / \`<!-- SUBFRAME:END -->\`). SubFrame will never overwrite user content in CLAUDE.md.

**Gemini CLI** works exactly as normal. Built-in features (\`/init\`, \`/model\`, \`/memory\`, \`/compress\`, \`/settings\`, GEMINI.md) are fully supported. GEMINI.md is Gemini CLI's native instruction file — same backlink approach as CLAUDE.md. Users can add their own instructions freely and SubFrame won't overwrite them.

**Codex CLI** gets SubFrame context via a wrapper script at \`.subframe/bin/codex\` that injects AGENTS.md as an initial prompt.

**This file (AGENTS.md)** contains SubFrame-specific rules that apply across all tools:
- Task management (\`tasks.json\`)
- Codebase mapping (\`STRUCTURE.json\`)
- Context preservation (\`PROJECT_NOTES.md\`)
- Session notes and decision tracking

---

## Task Management (tasks.json)

### Task Recognition Rules

**These ARE TASKS - add to tasks.json:**
- When the user requests a feature or change
- Decisions like "Let's do this", "Let's add this", "Improve this"
- Deferred work when we say "We'll do this later", "Let's leave it for now"
- Gaps or improvement opportunities discovered while coding
- Situations requiring bug fixes

**These are NOT TASKS:**
- Error messages and debugging sessions
- Questions, explanations, information exchange
- Temporary experiments and tests
- Work already completed and closed
- Instant fixes (like typo fixes)

### Task Creation Flow

1. Detect task patterns during conversation
2. Ask the user at an appropriate moment: "I identified these tasks from our conversation, should I add them to tasks.json?"
3. If the user approves, add to tasks.json

### Task Structure

\`\`\`json
{
  "id": "unique-id",
  "title": "Short and clear title",
  "description": "Detailed explanation",
  "status": "pending | in_progress | completed",
  "priority": "high | medium | low",
  "context": "Where/how this task originated",
  "createdAt": "ISO date",
  "updatedAt": "ISO date",
  "completedAt": "ISO date | null"
}
\`\`\`

### Task Status Updates

- When starting work on a task: \`status: "in_progress"\`
- When task is completed: \`status: "completed"\`, update \`completedAt\`
- After commit: Check and update the status of related tasks

---

## PROJECT_NOTES.md Rules

### When to Update?
- When an important architectural decision is made
- When a technology choice is made
- When an important problem is solved and the solution method is noteworthy
- When an approach is determined together with the user

### Format
Free format. Date + title is sufficient:
\`\`\`markdown
### [2026-01-26] Topic title
Conversation/decision as is, with its context...
\`\`\`

### Update Flow
- Update immediately after a decision is made
- You can add without asking the user (for important decisions)
- You can accumulate small decisions and add them in bulk

---

## 📝 Context Preservation (Automatic Note Taking)

SubFrame's core purpose is to prevent context loss. Therefore, capture important moments and ask the user.

### When to Ask?

Ask the user when one of the following situations occurs: **"Should I add this conversation to PROJECT_NOTES.md?"**

- When a task is successfully completed
- When an important architectural/technical decision is made
- When a bug is fixed and the solution method is noteworthy
- When "let's do this later" is said (in this case, also add to tasks.json)
- When a new pattern or best practice is discovered

### Completion Detection

Pay attention to these signals:
- User approval: "okay", "done", "it worked", "nice", "fixed", "yes"
- Moving from one topic to another
- User continuing after build/run succeeds

### How to Add?

1. **DON'T write a summary** - Add the conversation as is, with its context
2. **Add date** - In \`### [YYYY-MM-DD] Title\` format
3. **Add to Session Notes section** - At the end of PROJECT_NOTES.md

### When NOT to Ask

- For every small change (it becomes spam)
- Typo fixes, simple corrections
- If the user already said "no" or "not needed", don't ask again for the same topic in that session

### If User Says "No"

No problem, continue. The user can also say what they consider important themselves: "add this to notes"

---

## STRUCTURE.json Rules

**This file is the map of the codebase.**

### When to Update?
- When a new file/folder is created
- When a file/folder is deleted or moved
- When module dependencies change
- When an important architectural pattern is discovered (architectureNotes)

### Format
\`\`\`json
{
  "modules": {
    "moduleName": {
      "path": "src/module",
      "purpose": "What this module does",
      "depends": ["otherModule"]
    }
  },
  "architectureNotes": {}
}
\`\`\`

---

## QUICKSTART.md Rules

### When to Update?
- When installation steps change
- When new requirements are added
- When important commands change

---

## General Rules

1. **Language:** Write documentation in English (except code examples)
2. **Date Format:** ISO 8601 (YYYY-MM-DDTHH:mm:ssZ)
3. **After Commit:** Check tasks.json and STRUCTURE.json
4. **Session Start:** Review pending tasks in tasks.json

---

*This file was automatically created by SubFrame.*
*Creation date: ${date}*

---

**Note:** This file is named \`AGENTS.md\` to be AI-tool agnostic. CLAUDE.md and GEMINI.md contain a reference to this file.
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
