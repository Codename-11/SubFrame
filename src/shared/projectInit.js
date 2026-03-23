/* AUTO-GENERATED — do not edit. Source: src/shared/projectInit.ts */
/* Run: node scripts/build-templates.js to regenerate */

"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// package.json
var require_package = __commonJS({
  "package.json"(exports2, module2) {
    module2.exports = {
      name: "subframe",
      productName: "SubFrame",
      version: "0.7.2-beta",
      description: "SubFrame - Project Management IDE for Claude Code",
      main: "dist/main/index.js",
      scripts: {
        postinstall: "electron-builder install-app-deps",
        "build:main": "esbuild src/main/index.ts --bundle --platform=node --outdir=dist/main --external:electron --external:node-pty --external:electron-updater --format=cjs --sourcemap",
        build: "npm run build:main && npm run build:react",
        "build:react": "node scripts/build-react.js",
        watch: "node scripts/build-react.js --watch",
        start: "npm run build && electron .",
        dev: "node scripts/dev.js",
        typecheck: "tsc --noEmit -p tsconfig.main.json && tsc --noEmit -p tsconfig.renderer.json",
        "typecheck:main:watch": "tsc --noEmit -p tsconfig.main.json --watch --preserveWatchOutput",
        "typecheck:renderer:watch": "tsc --noEmit -p tsconfig.renderer.json --watch --preserveWatchOutput",
        test: "vitest run",
        "test:watch": "vitest",
        lint: "eslint src/",
        "lint:fix": "eslint src/ --fix",
        format: 'prettier --write "src/**/*.{ts,tsx}"',
        "format:check": 'prettier --check "src/**/*.{ts,tsx}"',
        check: "npm run verify:templates && npm run typecheck && npm run lint && npm test && npm run verify:hooks && npm run build",
        "build:templates": "node scripts/build-templates.js",
        "verify:templates": "node scripts/verify-templates.js",
        "generate:hooks": "node scripts/generate-hooks.js",
        "verify:hooks": "node scripts/verify-hooks.js",
        structure: "node scripts/update-structure.js",
        "structure:changed": "node scripts/update-structure.js --changed",
        "find-module": "node scripts/find-module.js",
        task: "node scripts/task.js",
        prepare: "git config core.hooksPath .githooks || true",
        dist: "npm run build && electron-builder --dir",
        "dist:win": "node scripts/dist-win.js",
        "dist:mac": "npm run build && electron-builder --mac",
        "dist:mac:unsigned": "npm run build && CSC_IDENTITY_AUTO_DISCOVERY=false electron-builder --mac",
        "generate-icons": "node scripts/generate-icons.js",
        init: "node scripts/init.js",
        "docs:dev": "vitepress dev docs",
        "docs:build": "vitepress build docs",
        "docs:preview": "vitepress preview docs",
        "site:dev": "cd site && npm run dev",
        "site:build": "cd site && npm run build",
        "site:preview": "cd site && npm run preview",
        web: 'npx concurrently -n site,docs -c magenta,cyan "cd site && npm run dev" "npx vitepress dev docs --port 5174"',
        "web:preview": `npm run site:build && npm run docs:build && node -e "const fs=require('fs');const p=require('path');fs.cpSync('site/dist','_site',{recursive:true});fs.mkdirSync('_site/docs',{recursive:true});fs.cpSync('docs/.vitepress/dist','_site/docs',{recursive:true});console.log('Merged to _site/')" && npx serve _site -p 4000`
      },
      keywords: [
        "electron",
        "terminal",
        "claude",
        "subframe",
        "ide",
        "project-management"
      ],
      author: "Axiom-Labs",
      homepage: "https://sub-frame.dev",
      repository: {
        type: "git",
        url: "https://github.com/Codename-11/SubFrame"
      },
      bugs: {
        url: "https://github.com/Codename-11/SubFrame/issues"
      },
      private: true,
      license: "MIT",
      devDependencies: {
        "@eslint/js": "^9.39.4",
        "@types/node": "^25.3.3",
        "@types/react": "^19.2.14",
        "@types/react-dom": "^19.2.3",
        electron: "^28.0.0",
        "electron-builder": "^26.8.1",
        esbuild: "^0.27.4",
        eslint: "^9.39.3",
        "eslint-config-prettier": "^10.1.8",
        "eslint-plugin-react-hooks": "^5.2.0",
        "eslint-plugin-react-refresh": "^0.4.26",
        prettier: "^3.8.1",
        typescript: "^5.9.3",
        "typescript-eslint": "^8.56.1",
        vitepress: "^1.6.4",
        vitest: "^3.2.4"
      },
      dependencies: {
        "@codemirror/lang-angular": "^0.1.4",
        "@codemirror/lang-cpp": "^6.0.3",
        "@codemirror/lang-css": "^6.3.1",
        "@codemirror/lang-html": "^6.4.11",
        "@codemirror/lang-java": "^6.0.2",
        "@codemirror/lang-javascript": "^6.2.5",
        "@codemirror/lang-json": "^6.0.2",
        "@codemirror/lang-less": "^6.0.2",
        "@codemirror/lang-markdown": "^6.5.0",
        "@codemirror/lang-php": "^6.0.2",
        "@codemirror/lang-python": "^6.2.1",
        "@codemirror/lang-rust": "^6.0.2",
        "@codemirror/lang-sass": "^6.0.2",
        "@codemirror/lang-sql": "^6.10.0",
        "@codemirror/lang-vue": "^0.1.3",
        "@codemirror/lang-wast": "^6.0.2",
        "@codemirror/lang-xml": "^6.1.0",
        "@codemirror/lang-yaml": "^6.1.2",
        "@codemirror/theme-one-dark": "^6.1.3",
        "@replit/codemirror-minimap": "^0.5.2",
        "@tailwindcss/postcss": "^4.2.1",
        "@tanstack/react-query": "^5.90.21",
        "@tanstack/react-table": "^8.21.3",
        "@types/dagre": "^0.7.54",
        "@uiw/react-codemirror": "^4.25.8",
        "@xyflow/react": "^12.10.1",
        "class-variance-authority": "^0.7.1",
        clsx: "^2.1.1",
        cmdk: "^1.1.1",
        codemirror: "^6.0.2",
        dagre: "^0.8.5",
        "electron-updater": "^6.8.3",
        "esbuild-postcss-plugin": "^0.0.7",
        "framer-motion": "^12.37.0",
        "gray-matter": "^4.0.3",
        "highlight.js": "^11.11.1",
        "lucide-react": "^0.577.0",
        "next-themes": "^0.4.6",
        "node-pty": "^1.0.0",
        postcss: "^8.5.8",
        "radix-ui": "^1.4.3",
        react: "^19.2.4",
        "react-dom": "^19.2.4",
        "react-markdown": "^10.1.0",
        "react-resizable-panels": "^4.7.3",
        "react-zoom-pan-pinch": "^3.7.0",
        recharts: "^2.15.4",
        "remark-gfm": "^4.0.1",
        sonner: "^2.0.7",
        "tailwind-merge": "^3.5.0",
        tailwindcss: "^4.2.1",
        "tw-animate-css": "^1.4.0",
        xterm: "^5.3.0",
        "xterm-addon-canvas": "^0.5.0",
        "xterm-addon-fit": "^0.8.0",
        "xterm-addon-search": "^0.13.0",
        "xterm-addon-unicode11": "^0.6.0",
        "xterm-addon-web-links": "^0.9.0",
        "xterm-addon-webgl": "^0.16.0",
        yaml: "^2.8.2",
        zustand: "^5.0.12"
      },
      build: {
        appId: "com.subframe.ide",
        productName: "SubFrame",
        copyright: "Copyright \xA9 2025-present Bailey (Codename-11)",
        npmRebuild: false,
        icon: "assets/icon.png",
        mac: {
          category: "public.app-category.developer-tools",
          target: [
            "dmg"
          ],
          hardenedRuntime: true,
          gatekeeperAssess: false,
          identity: null,
          icon: "assets/icon-1024.png"
        },
        win: {
          target: [
            "nsis"
          ],
          icon: "assets/icon.ico",
          legalTrademarks: "Copyright \xA9 2025-present Bailey (Codename-11)"
        },
        nsis: {
          oneClick: true,
          deleteAppDataOnUninstall: true,
          artifactName: "${productName}-Setup-${version}.${ext}"
        },
        dmg: {
          title: "${productName} ${version}",
          contents: [
            {
              x: 130,
              y: 220
            },
            {
              x: 410,
              y: 220,
              type: "link",
              path: "/Applications"
            }
          ]
        },
        publish: {
          provider: "github",
          owner: "Codename-11",
          repo: "SubFrame"
        },
        directories: {
          output: "release"
        },
        extraResources: [
          {
            from: "scripts/subframe-cli.js",
            to: "scripts/subframe-cli.js"
          },
          {
            from: "scripts/init.js",
            to: "scripts/init.js"
          },
          {
            from: "scripts/build-templates.js",
            to: "scripts/build-templates.js"
          }
        ],
        files: [
          "index.html",
          "RELEASE_NOTES.md",
          "src/**/*",
          "dist/**/*",
          "assets/icon.*",
          "assets/icon-*.png",
          "node_modules/**/*",
          "!node_modules/**/*.md",
          "!node_modules/**/test/**",
          "!node_modules/**/tests/**"
        ]
      }
    };
  }
});

// src/shared/backlinkUtils.ts
function getBacklinkBlock(options) {
  const defaultMessage = "> **[SubFrame Project]** \u2014 Read [AGENTS.md](./AGENTS.md) for project instructions, task management rules, and context preservation guidelines.";
  const message = options && options.customMessage ? options.customMessage : defaultMessage;
  const lines = [BACKLINK_START, message];
  if (options && options.additionalRefs && options.additionalRefs.length > 0) {
    for (const ref of options.additionalRefs) {
      if (ref.trim()) lines.push(ref);
    }
  }
  lines.push(BACKLINK_END);
  return lines.join("\n");
}
function injectBacklink(filePath, options) {
  try {
    const block = getBacklinkBlock(options);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, block + "\n", "utf8");
      return true;
    }
    const content = fs.readFileSync(filePath, "utf8");
    if (content.includes(BACKLINK_START)) {
      return true;
    }
    fs.writeFileSync(filePath, block + "\n\n" + content, "utf8");
    return true;
  } catch (err) {
    console.error("Error injecting backlink:", err);
    return false;
  }
}
function isSymlinkFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return false;
    const stats = fs.lstatSync(filePath);
    return stats.isSymbolicLink();
  } catch (_err) {
    return false;
  }
}
var fs, path2, BACKLINK_START, BACKLINK_END;
var init_backlinkUtils = __esm({
  "src/shared/backlinkUtils.ts"() {
    "use strict";
    fs = __toESM(require("fs"));
    path2 = __toESM(require("path"));
    BACKLINK_START = "<!-- SUBFRAME:BEGIN -->";
    BACKLINK_END = "<!-- SUBFRAME:END -->";
  }
});

// src/shared/projectInit.ts
var projectInit_exports = {};
__export(projectInit_exports, {
  checkExistingFiles: () => checkExistingFiles,
  createFileIfNotExists: () => createFileIfNotExists,
  createOrMigrateNativeFile: () => createOrMigrateNativeFile,
  initializeProject: () => initializeProject,
  migrateRootFiles: () => migrateRootFiles
});
module.exports = __toCommonJS(projectInit_exports);
var fs3 = __toESM(require("fs"));
var path4 = __toESM(require("path"));
var import_child_process = require("child_process");

// src/shared/frameConstants.ts
var path = __toESM(require("path"));
var FRAME_DIR = ".subframe";
var FRAME_CONFIG_FILE = "config.json";
var SUBFRAME_HOOKS_DIR = path.join(".subframe", "hooks");
var FRAME_FILES = {
  AGENTS: "AGENTS.md",
  CLAUDE: "CLAUDE.md",
  GEMINI: "GEMINI.md",
  STRUCTURE: path.join(".subframe", "STRUCTURE.json"),
  NOTES: path.join(".subframe", "PROJECT_NOTES.md"),
  TASKS: path.join(".subframe", "tasks.json"),
  QUICKSTART: path.join(".subframe", "QUICKSTART.md"),
  DOCS_INTERNAL: path.join(".subframe", "docs-internal"),
  HOOKS_SESSION_START: path.join(".subframe", "hooks", "session-start.js"),
  HOOKS_PROMPT_SUBMIT: path.join(".subframe", "hooks", "prompt-submit.js"),
  HOOKS_STOP: path.join(".subframe", "hooks", "stop.js"),
  HOOKS_PRE_TOOL_USE: path.join(".subframe", "hooks", "pre-tool-use.js"),
  HOOKS_POST_TOOL_USE: path.join(".subframe", "hooks", "post-tool-use.js"),
  CLAUDE_SETTINGS: path.join(".claude", "settings.json"),
  SKILLS_SUB_TASKS: path.join(".claude", "skills", "sub-tasks", "SKILL.md"),
  SKILLS_SUB_DOCS: path.join(".claude", "skills", "sub-docs", "SKILL.md"),
  SKILLS_SUB_AUDIT: path.join(".claude", "skills", "sub-audit", "SKILL.md"),
  SKILLS_ONBOARD: path.join(".claude", "skills", "onboard", "SKILL.md"),
  HOOKS_PRE_PUSH: path.join(".githooks", "pre-push")
};
var FRAME_BIN_DIR = "bin";
var GITHOOKS_DIR = ".githooks";
var FRAME_TASKS_DIR = path.join(".subframe", "tasks");
var FRAME_TASKS_PRIVATE_DIR = path.join(".subframe", "tasks", "private");
var FRAME_WORKFLOWS_DIR = path.join(".subframe", "workflows");
var FRAME_PIPELINES_DIR = path.join(".subframe", "pipelines");
var FRAME_VERSION = require_package().version;

// src/shared/frameTemplates.ts
var AGENTS_TEMPLATE_VERSION = 1;
function getDateString() {
  return (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
}
function getISOTimestamp() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function getAgentsTemplate(projectName) {
  const date = getDateString();
  return `<!-- @subframe-version ${FRAME_VERSION} -->
<!-- @subframe-managed -->
# ${projectName} - SubFrame Project

This project is managed with **SubFrame**. AI assistants should follow the rules below to keep documentation up to date.

> **Note:** This file is named \`AGENTS.md\` to be AI-tool agnostic. CLAUDE.md and GEMINI.md contain a reference to this file.

---

## Core Working Principle

**Only do what the user asks.** Do not go beyond the scope of the request.

- Implement exactly what the user requested \u2014 nothing more, nothing less.
- Do not change business logic, flow, or architecture unless the user explicitly asks for it.
- If a user asks for a design change, only change the design. Do not refactor, restructure, or modify functionality alongside it.
- If you have additional suggestions or improvements, **present them as suggestions** to the user. Never implement them without approval.
- The user's request must be completed first. Additional ideas come after, as proposals.

---

## Relationship to Native AI Tools

SubFrame **enhances** native AI coding tools \u2014 it does not replace them.

**Claude Code** works exactly as normal. Built-in features (\`/init\`, \`/commit\`, \`/review-pr\`, \`/compact\`, \`/memory\`, CLAUDE.md) are fully supported. CLAUDE.md is Claude Code's native instruction file \u2014 users can add their own tool-specific instructions freely. SubFrame adds a small backlink reference pointing to this AGENTS.md file using HTML comment markers (\`<!-- SUBFRAME:BEGIN -->\` / \`<!-- SUBFRAME:END -->\`). SubFrame will never overwrite user content in CLAUDE.md.

**Gemini CLI** works exactly as normal. Built-in features (\`/init\`, \`/model\`, \`/memory\`, \`/compress\`, \`/settings\`, GEMINI.md) are fully supported. GEMINI.md is Gemini CLI's native instruction file \u2014 same backlink approach as CLAUDE.md. Users can add their own instructions freely and SubFrame won't overwrite them.

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

1. **\`.subframe/STRUCTURE.json\`** \u2014 Module map, file locations, architecture notes
2. **\`.subframe/PROJECT_NOTES.md\`** \u2014 Project vision, past decisions, session notes
3. **\`.subframe/tasks.json\`** \u2014 Sub-task index (pending, in-progress, completed)

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

SubFrame can configure project-level hooks that automate sub-task awareness. These hooks fire automatically \u2014 no manual intervention needed.

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
| \`/sub-tasks\` | Interactive sub-task management \u2014 list, start, complete, add, archive |
| \`/sub-docs\` | Sync all SubFrame documentation after feature work (changelog, CLAUDE.md, PROJECT_NOTES, STRUCTURE) |
| \`/sub-audit\` | Code review + documentation audit on recent changes |
| \`/onboard\` | Bootstrap SubFrame files from existing codebase context |

Skills are deployed to \`.claude/skills/\` and enhance the workflow \u2014 but direct file editing always works as a fallback. If your AI tool doesn't support skills, follow the manual instructions in each section below.

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
description: AI's detailed explanation \u2014 what, how, which files affected
userRequest: User's original prompt/request \u2014 copy exactly
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
2. **Check existing sub-tasks first** \u2014 read \`.subframe/tasks.json\` to avoid duplicates
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

**userRequest:** User's original words \u2014 copy verbatim for context preservation

**acceptanceCriteria:** Concrete, testable completion criteria

### Sub-Task Status Updates

**Before starting any work**, check \`.subframe/tasks.json\` for an existing sub-task that matches. If found, set it to \`in_progress\` \u2014 do not create a duplicate.

- \`pending\` \u2192 \`in_progress\` \u2014 immediately when you begin working (update \`updatedAt\`)
- \`in_progress\` \u2192 \`completed\` \u2014 when done and verified (set \`completedAt\`, update \`updatedAt\`)
- \`completed\` \u2192 \`pending\` \u2014 when reopening, add a note explaining why
- After commit: check and update the status of all related sub-tasks
- **Incomplete work:** If partially done at session end, leave as \`in_progress\` and add a notes entry

### Sub-Task Lifecycle

- If a sub-task grows beyond its original scope, split it \u2014 create new sub-tasks and reference the parent ID in notes
- Cross-reference relevant commit hashes or PR numbers in notes
- Update the description if the approach changes significantly

### Priority Guidelines

- **high** \u2014 Blocking other work or explicitly flagged as urgent by the user
- **medium** \u2014 Normal feature work and standard bug fixes
- **low** \u2014 Nice-to-have improvements, deferred items, minor polish

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

**Note failed approaches too** \u2014 a brief "We tried X, it didn't work because Y" prevents future re-exploration of dead ends.

### Completion Detection

Pay attention to these signals:
- User approval: "okay", "done", "it worked", "nice", "fixed", "yes"
- Moving from one topic to another
- User continuing after build/run succeeds

### How to Add?

1. **DON'T write a summary** \u2014 Add the conversation as is, with its context
2. **Add date** \u2014 In \`### [YYYY-MM-DD] Title\` format
3. **Add to Session Notes section** \u2014 At the end of PROJECT_NOTES.md

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
      "direction": "renderer \u2192 main",
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

1. **Sub-Tasks** \u2014 Was this work tracked? Check \`.subframe/tasks.json\` \u2192 create/complete as needed
2. **PROJECT_NOTES.md** \u2014 Any decisions worth preserving? Ask the user
3. **Changelog** \u2014 Does \`.subframe/docs-internal/changelog.md\` reflect the changes?
4. **STRUCTURE.json** \u2014 Source files changed? The pre-commit hook handles this automatically if configured; otherwise update manually

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
function getTasksTemplate(projectName) {
  return {
    _frame_metadata: {
      purpose: "Sub-Task tracking index \u2014 auto-generated from .subframe/tasks/*.md files",
      forAI: "Auto-generated from .subframe/tasks/*.md \u2014 edit the .md files directly. This index is regenerated on every change. Each task lives in its own markdown file with YAML frontmatter. Use the CLI: node scripts/task.js <command>",
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
      steps: "Array of { label, completed } \u2014 parsed from ## Steps checkboxes",
      private: "boolean \u2014 if true, task is stored locally and excluded from git",
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
| \`.subframe/STRUCTURE.json\` | Module map and architecture |
| \`.subframe/PROJECT_NOTES.md\` | Decisions and context |
| \`.subframe/tasks/*.md\` | Sub-Task files (markdown + YAML frontmatter) |
| \`.subframe/tasks.json\` | Sub-Task index (auto-generated) |
| \`.subframe/QUICKSTART.md\` | This file |
| \`.subframe/docs-internal/\` | Internal documentation |

## Project Structure

\`\`\`
${projectName}/
\u251C\u2500\u2500 .subframe/              # SubFrame project files
\u2502   \u251C\u2500\u2500 config.json         # Project configuration
\u2502   \u251C\u2500\u2500 STRUCTURE.json      # Module map
\u2502   \u251C\u2500\u2500 PROJECT_NOTES.md    # Session notes
\u2502   \u251C\u2500\u2500 tasks/              # Sub-Task markdown files
\u2502   \u2502   \u2514\u2500\u2500 <id>.md         # Individual task (YAML frontmatter)
\u2502   \u251C\u2500\u2500 tasks.json          # Sub-Task index (auto-generated)
\u2502   \u251C\u2500\u2500 QUICKSTART.md       # This file
\u2502   \u2514\u2500\u2500 docs-internal/      # Internal documentation
\u251C\u2500\u2500 AGENTS.md               # AI instructions (tool-agnostic)
\u251C\u2500\u2500 CLAUDE.md               # Claude Code instructions
\u251C\u2500\u2500 src/                    # Source code
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
function getDocsInternalReadme(projectName) {
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
\u251C\u2500\u2500 README.md          # This file
\u251C\u2500\u2500 architecture.md    # System architecture overview
\u251C\u2500\u2500 adr/               # Architecture Decision Records
\u2502   \u2514\u2500\u2500 001-example.md
\u251C\u2500\u2500 api/               # API documentation
\u251C\u2500\u2500 setup/             # Setup and deployment guides
\u2514\u2500\u2500 refs/              # Third-party references and integration notes
\`\`\`

---

*Created by SubFrame project initialization.*
`;
}
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
      structure: ".subframe/STRUCTURE.json",
      notes: ".subframe/PROJECT_NOTES.md",
      tasks: ".subframe/tasks.json",
      quickstart: ".subframe/QUICKSTART.md",
      docsInternal: ".subframe/docs-internal"
    }
  };
}
function getCodexWrapperTemplate() {
  return `#!/usr/bin/env bash
# @subframe-version ${FRAME_VERSION}
# @subframe-managed
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
function getPreCommitHookTemplate() {
  return `#!/bin/bash
# @subframe-version ${FRAME_VERSION}
# @subframe-managed
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
function getPrePushHookTemplate() {
  return `#!/bin/bash
# @subframe-version ${FRAME_VERSION}
# @subframe-managed
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

# Don't block the push \u2014 pipeline runs async via SubFrame UI
exit 0
`;
}
function getHookUpdaterScript() {
  return `#!/usr/bin/env node
// @subframe-version ${FRAME_VERSION}
// @subframe-managed
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

  // Extract exports \u2014 CJS (module.exports) and ESM (export { ... }, export function)
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

  // Extract dependencies \u2014 CJS require() and ESM import
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
function getSessionStartHookTemplate() {
  return `#!/usr/bin/env node
// @subframe-version ${FRAME_VERSION}
// @subframe-managed
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

function findProjectRoot(startDir) {
  let dir = startDir || process.cwd();
  while (dir !== path.dirname(dir)) {
    const tasksPath = path.join(dir, '.subframe', 'tasks.json');
    if (fs.existsSync(tasksPath)) return dir;
    dir = path.dirname(dir);
  }
  return null;
}

/**
 * Read private tasks from .subframe/tasks/private/ (if it exists).
 * Minimal parser \u2014 extracts id, title, status, priority, private flag from frontmatter.
 */
function readPrivateTasks(root) {
  const privateDir = path.join(root, '.subframe', 'tasks', 'private');
  if (!fs.existsSync(privateDir)) return [];
  const tasks = [];
  try {
    const files = fs.readdirSync(privateDir).filter(f => f.endsWith('.md'));
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(privateDir, file), 'utf8');
        // Quick YAML frontmatter extraction (no dependency on gray-matter)
        const fmMatch = content.match(/^---\\n([\\s\\S]*?)\\n---/);
        if (!fmMatch) continue;
        const fm = {};
        for (const line of fmMatch[1].split('\\n')) {
          const m = line.match(/^(\\w+):\\s*(.+)$/);
          if (m) fm[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
        }
        tasks.push({
          id: fm.id || path.basename(file, '.md'),
          title: fm.title || '(untitled)',
          status: fm.status || 'pending',
          priority: fm.priority || 'medium',
          private: true,
        });
      } catch { /* skip unreadable files */ }
    }
  } catch { /* directory read error */ }
  return tasks;
}

function main() {
  // Read stdin for hookData.cwd if available (consistent with other hooks)
  let cwd = process.cwd();
  try {
    const input = fs.readFileSync(0, 'utf8');
    const hookData = JSON.parse(input);
    if (hookData && hookData.cwd) cwd = hookData.cwd;
  } catch { /* no stdin or bad JSON \u2014 fall back to process.cwd() */ }

  const root = findProjectRoot(cwd) || findProjectRoot(process.cwd());
  if (!root) process.exit(0);

  const tasksPath = path.join(root, '.subframe', 'tasks.json');
  let data;
  try {
    const raw = fs.readFileSync(tasksPath, 'utf8').replace(/,\\s*([\\]}])/g, '$1');
    data = JSON.parse(raw);
  } catch {
    process.exit(0);
  }

  const inProgress = [...(data.tasks?.inProgress || [])];
  const pending = [...(data.tasks?.pending || [])];

  // Merge private tasks (not in index)
  const privateTasks = readPrivateTasks(root);
  for (const t of privateTasks) {
    if (t.status === 'in_progress') inProgress.push(t);
    else if (t.status === 'pending') pending.push(t);
  }

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
      const taskCmd = fs.existsSync(path.join(root, 'scripts', 'task.js')) ? 'node scripts/task.js' : 'npx subframe task';
      lines.push('  \\u2026 +' + (pending.length - 5) + ' more \\u2192 ' + taskCmd + ' list');
    }
  }

  lines.push('Use: start <id> | complete <id> | add --title "..."');
  lines.push('</sub-tasks-context>');

  console.log(lines.join('\\n'));
}

main();
`;
}
function getPromptSubmitHookTemplate() {
  return `#!/usr/bin/env node
// @subframe-version ${FRAME_VERSION}
// @subframe-managed
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

function findProjectRoot(startDir) {
  let dir = startDir || process.cwd();
  while (dir !== path.dirname(dir)) {
    const tasksPath = path.join(dir, '.subframe', 'tasks.json');
    if (fs.existsSync(tasksPath)) return dir;
    dir = path.dirname(dir);
  }
  return null;
}

function findTasksFile(startDir) {
  const root = findProjectRoot(startDir);
  return root ? path.join(root, '.subframe', 'tasks.json') : null;
}

/** Read pending private tasks from .subframe/tasks/private/ */
function readPrivatePending(root) {
  const privateDir = path.join(root, '.subframe', 'tasks', 'private');
  if (!fs.existsSync(privateDir)) return [];
  const tasks = [];
  try {
    for (const file of fs.readdirSync(privateDir).filter(f => f.endsWith('.md'))) {
      try {
        const content = fs.readFileSync(path.join(privateDir, file), 'utf8');
        const fmMatch = content.match(/^---\\n([\\s\\S]*?)\\n---/);
        if (!fmMatch) continue;
        const fm = {};
        for (const line of fmMatch[1].split('\\n')) {
          const m = line.match(/^(\\w+):\\s*(.+)$/);
          if (m) fm[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
        }
        if (fm.status === 'pending') {
          // Extract description from body (text after frontmatter, before first ##)
          const body = content.split('---').slice(2).join('---').trim();
          const desc = body.split(/^## /m)[0].trim();
          tasks.push({
            id: fm.id || path.basename(file, '.md'),
            title: fm.title || '(untitled)',
            description: desc,
            priority: fm.priority || 'medium',
            private: true,
          });
        }
      } catch { /* skip */ }
    }
  } catch { /* skip */ }
  return tasks;
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

/** Write user message signal to agent-state.json for terminal marker detection */
function writeUserMessageSignal(root, terminalId, prompt) {
  try {
    const statePath = path.join(root, '.subframe', 'agent-state.json');
    const stateDir = path.dirname(statePath);
    if (!fs.existsSync(stateDir)) fs.mkdirSync(stateDir, { recursive: true });

    let state;
    try {
      state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    } catch {
      state = { projectPath: root, sessions: [], lastUpdated: new Date().toISOString() };
    }

    state.lastUserMessage = {
      terminalId: terminalId,
      timestamp: new Date().toISOString(),
      promptPreview: typeof prompt === 'string' ? prompt.substring(0, 100) : '',
    };
    state.lastUpdated = new Date().toISOString();

    // Atomic write (temp + rename)
    const tmp = statePath + '.tmp.' + process.pid;
    const content = JSON.stringify(state, null, 2);
    try { fs.writeFileSync(tmp, content, 'utf8'); fs.renameSync(tmp, statePath); } catch {
      try { fs.writeFileSync(statePath, content, 'utf8'); } catch { /* ignore */ }
      try { fs.unlinkSync(tmp); } catch { /* ignore */ }
    }
  } catch { /* ignore \u2014 signal is best-effort */ }
}

function main() {
  let input = '';
  try { input = fs.readFileSync(0, 'utf8'); } catch { process.exit(0); }
  let hookData;
  try { hookData = JSON.parse(input); } catch { process.exit(0); }

  const prompt = hookData.prompt;
  if (!prompt || typeof prompt !== 'string') process.exit(0);

  const root = findProjectRoot(hookData.cwd) || findProjectRoot(process.cwd());

  // Write user message signal FIRST \u2014 fires for ALL prompts regardless of length/type
  const sfTerminalId = process.env.SUBFRAME_TERMINAL_ID;
  if (sfTerminalId && root) {
    writeUserMessageSignal(root, sfTerminalId, prompt);
  }

  // Task matching requires longer prompts and tasks.json
  if (prompt.length < 10 || prompt.startsWith('/')) process.exit(0);
  if (!root) process.exit(0);

  const tasksPath = path.join(root, '.subframe', 'tasks.json');
  if (!fs.existsSync(tasksPath)) process.exit(0);

  let data;
  try {
    const raw = fs.readFileSync(tasksPath, 'utf8').replace(/,\\s*([\\]}])/g, '$1');
    data = JSON.parse(raw);
  } catch { process.exit(0); }

  const pending = [...(data.tasks?.pending || []), ...readPrivatePending(root)];
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
    const taskCmd = fs.existsSync(path.join(root, 'scripts', 'task.js')) ? 'node scripts/task.js' : 'npx subframe task';
    console.log('\\u2192 Start: ' + taskCmd + ' start ' + bestTask.id);
    console.log('</sub-task-match>');
  }
}

main();
`;
}
function getStopHookTemplate() {
  return `#!/usr/bin/env node
// @subframe-version ${FRAME_VERSION}
// @subframe-managed
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
    const output = execSync('git diff --name-only HEAD', {
      cwd: projectRoot,
      encoding: 'utf8',
      timeout: 3000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    if (!output) return [];
    // Exclude common non-source files to reduce noise
    return output.split('\\n').filter(f => !f.startsWith('.subframe/') && !f.startsWith('.claude/') && !f.startsWith('.githooks/') && f !== 'package-lock.json');
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

  const inProgress = [...(data.tasks?.inProgress || [])];

  // Include private in-progress tasks (not in the git-tracked index)
  const privateDir = path.join(projectRoot, '.subframe', 'tasks', 'private');
  if (fs.existsSync(privateDir)) {
    try {
      for (const file of fs.readdirSync(privateDir).filter(f => f.endsWith('.md'))) {
        try {
          const content = fs.readFileSync(path.join(privateDir, file), 'utf8');
          const fmMatch = content.match(/^---\\n([\\s\\S]*?)\\n---/);
          if (!fmMatch) continue;
          const fm = {};
          for (const line of fmMatch[1].split('\\n')) {
            const m = line.match(/^(\\w+):\\s*(.+)$/);
            if (m) fm[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
          }
          if (fm.status === 'in_progress') {
            inProgress.push({ id: fm.id || path.basename(file, '.md'), title: fm.title || '(untitled)', private: true });
          }
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  }

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
      const taskCmd = fs.existsSync(path.join(projectRoot, 'scripts', 'task.js')) ? 'node scripts/task.js' : 'npx subframe task';
      lines.push('  \\u2022 Track: ' + taskCmd + ' add --title "..." && ' + taskCmd + ' complete <id>');
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
function getPreToolUseHookTemplate() {
  return `#!/usr/bin/env node
// @subframe-version ${FRAME_VERSION}
// @subframe-managed
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

// \u2500\u2500 Human-readable verb mapping \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

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

// \u2500\u2500 Helpers \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

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

  // Bash \u2014 prefer description, fall back to truncated command
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
    if (now - lastActivity > STALE_MS && (session.status === 'active' || session.status === 'busy')) {
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

// \u2500\u2500 Main \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

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

  // Bind terminal ID from SubFrame's PTY env var (enables direct correlation)
  const sfTerminalId = process.env.SUBFRAME_TERMINAL_ID;
  if (sfTerminalId) session.terminalId = sfTerminalId;

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
function getPostToolUseHookTemplate() {
  return `#!/usr/bin/env node
// @subframe-version ${FRAME_VERSION}
// @subframe-managed
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

// \u2500\u2500 Helpers \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

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
    if (now - lastActivity > STALE_MS && (session.status === 'active' || session.status === 'busy')) {
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

// \u2500\u2500 Main \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

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

  // Ensure terminal ID binding (mirrors pre-tool-use; covers edge cases)
  const sfTerminalId = process.env.SUBFRAME_TERMINAL_ID;
  if (sfTerminalId && !session.terminalId) session.terminalId = sfTerminalId;

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
    // Edge case: no running step found \u2014 create a completed step
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
function getClaudeSettingsHooksTemplate() {
  const guard = (script) => `node -e "try{require('./${script}')}catch(e){if(e.code!=='MODULE_NOT_FOUND')throw e}"`;
  return {
    hooks: {
      "SessionStart": [
        {
          matcher: "",
          hooks: [{ type: "command", command: guard(".subframe/hooks/session-start.js") }]
        }
      ],
      "UserPromptSubmit": [
        {
          matcher: "",
          hooks: [{ type: "command", command: guard(".subframe/hooks/prompt-submit.js") }]
        }
      ],
      "Stop": [
        {
          matcher: "",
          hooks: [{ type: "command", command: guard(".subframe/hooks/stop.js") }]
        }
      ],
      "PreToolUse": [
        {
          matcher: "",
          hooks: [{ type: "command", command: guard(".subframe/hooks/pre-tool-use.js") }]
        }
      ],
      "PostToolUse": [
        {
          matcher: "",
          hooks: [{ type: "command", command: guard(".subframe/hooks/post-tool-use.js") }]
        }
      ]
    }
  };
}
function getSubTasksSkillTemplate() {
  return `<!-- @subframe-version ${FRAME_VERSION} -->
<!-- @subframe-managed -->
---
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

#### Start a task (pending \u2192 in_progress)
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
function getSubDocsSkillTemplate() {
  return `<!-- @subframe-version ${FRAME_VERSION} -->
<!-- @subframe-managed -->
---
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
- **New source modules** \u2192 update CLAUDE.md module lists (if applicable)
- **New components** \u2192 update CLAUDE.md component lists (if applicable)
- **Architecture decisions** \u2192 add to \`.subframe/PROJECT_NOTES.md\` Session Notes
- **User-facing features** \u2192 add to \`.subframe/docs-internal/changelog.md\` under [Unreleased]

### Step 2: Update CLAUDE.md

Read \`CLAUDE.md\` and update only the sections that need changes. If CLAUDE.md has module/component lists, add new entries. Preserve existing formatting and ordering.

**Rules:**
- Only add genuinely new entries \u2014 don't duplicate
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
- [ ] CLAUDE.md \u2014 what was added/changed
- [ ] changelog.md \u2014 entries added
- [ ] PROJECT_NOTES.md \u2014 decision added (or skipped)
- [ ] STRUCTURE.json \u2014 regenerated
`;
}
function getSubAuditSkillTemplate() {
  return `<!-- @subframe-version ${FRAME_VERSION} -->
<!-- @subframe-managed -->
---
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

1. **Critical bugs** \u2014 null/undefined access, race conditions, unhandled errors, infinite loops
2. **Type safety** \u2014 \`as any\` casts, missing type imports, loose typing where strict types exist
3. **Platform issues** \u2014 Windows path handling, file system edge cases
4. **Security** \u2014 command injection, XSS in rendered content, path traversal
5. **Logic errors** \u2014 off-by-one, incorrect conditions, missing edge cases

### Phase 3: Documentation Audit (spawn agent)

Spawn an explore agent (\`Explore\` subagent type) to check documentation completeness:

1. **CLAUDE.md** \u2014 Are all modules/components listed?
2. **changelog.md** \u2014 Does [Unreleased] reflect all new features?
3. **PROJECT_NOTES.md** \u2014 Are architecture decisions documented?
4. **STRUCTURE.json** \u2014 Is it up to date? (compare module count with actual files)

### Phase 4: Report

Present findings in this format:

\`\`\`
## Audit Report

### Critical Issues (must fix)
1. [FILE:LINE] Description \u2014 severity, impact

### Important Issues (should fix)
1. [FILE:LINE] Description \u2014 severity, impact

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

After presenting the report, ask the user if they want to fix any of the reported issues. If yes, apply fixes starting with Critical \u2192 Important \u2192 Documentation.
`;
}
function getOnboardSkillTemplate() {
  return `<!-- @subframe-version ${FRAME_VERSION} -->
<!-- @subframe-managed -->
---
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

1. **Project type** \u2014 What kind of project is this? (web app, CLI tool, library, monorepo, etc.)
2. **Language and framework** \u2014 Primary language, framework, and build tooling
3. **Architecture** \u2014 Entry points, module structure, process model (single, client-server, microservices, etc.)
4. **Key modules** \u2014 Identify the most important source files and their purposes (scan up to 3 directory levels deep)
5. **Existing documentation** \u2014 What context already exists in README, CLAUDE.md, GEMINI.md, or other docs?
6. **Dependencies** \u2014 Key runtime and dev dependencies from the package manifest

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

<Empty section \u2014 to be filled during future development sessions.>
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
- **Title** \u2014 concise imperative description
- **Description** \u2014 what needs to be done and why
- **Priority** \u2014 \\\`low\\\`, \\\`medium\\\`, or \\\`high\\\`
- **Category** \u2014 \\\`feature\\\`, \\\`fix\\\`, \\\`docs\\\`, \\\`refactor\\\`, \\\`test\\\`, \\\`chore\\\`

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
1. \\\`.subframe/STRUCTURE.json\\\` \u2014 the module map
2. \\\`.subframe/PROJECT_NOTES.md\\\` \u2014 the project documentation

### Step 7: Summary

Show a summary of what was created or updated:

\\\`\\\`\\\`
## Onboard Summary

**Project:** <name> (<type>)
**Language:** <primary language> + <framework>

### Files Written
- \\\`.subframe/STRUCTURE.json\\\` \u2014 <N> modules mapped
- \\\`.subframe/PROJECT_NOTES.md\\\` \u2014 project documentation bootstrapped

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
function getDefaultReviewWorkflow() {
  return `# @subframe-version ${FRAME_VERSION}
# @subframe-managed
name: review
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
        with:
          max-turns: 25
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
function getTaskVerifyWorkflow() {
  return `# @subframe-version ${FRAME_VERSION}
# @subframe-managed
name: task-verify
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
        with:
          max-turns: 25
      - name: Generate Summary
        uses: describe
`;
}
function getHealthCheckWorkflow() {
  return `# @subframe-version ${FRAME_VERSION}
# @subframe-managed
name: health-check
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
        with:
          scope: project
          mode: agent
          max-turns: 25
      - name: Code Quality Review
        uses: critique
        with:
          scope: project
          mode: agent
          focus: architecture
          max-turns: 30
`;
}

// src/shared/projectInit.ts
init_backlinkUtils();

// src/shared/claudeSettingsUtils.ts
var fs2 = __toESM(require("fs"));
var path3 = __toESM(require("path"));
var SUBFRAME_HOOK_PREFIX = ".subframe/hooks/";
function readClaudeSettings(projectPath) {
  const settingsPath = path3.join(projectPath, ".claude", "settings.json");
  try {
    if (!fs2.existsSync(settingsPath)) return {};
    const raw = fs2.readFileSync(settingsPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
function writeClaudeSettings(projectPath, settings) {
  const claudeDir = path3.join(projectPath, ".claude");
  if (!fs2.existsSync(claudeDir)) {
    fs2.mkdirSync(claudeDir, { recursive: true });
  }
  const settingsPath = path3.join(claudeDir, "settings.json");
  fs2.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf8");
}
function isSubFrameHook(hook) {
  return hook.command?.includes(SUBFRAME_HOOK_PREFIX) ?? false;
}
function mergeSubFrameHooks(existing, subframeHooks) {
  const result = { ...existing };
  if (!result.hooks) {
    result.hooks = {};
  }
  for (const eventType of Object.keys(subframeHooks.hooks)) {
    const newMatchers = subframeHooks.hooks[eventType];
    if (!Array.isArray(result.hooks[eventType])) {
      result.hooks[eventType] = [];
    }
    result.hooks[eventType] = result.hooks[eventType].filter((matcher) => {
      if (!Array.isArray(matcher.hooks)) return true;
      return !matcher.hooks.some(isSubFrameHook);
    });
    result.hooks[eventType].push(...newMatchers);
  }
  return result;
}

// src/shared/projectInit.ts
function createFileIfNotExists(filePath, content) {
  if (!fs3.existsSync(filePath)) {
    const contentStr = typeof content === "string" ? content : JSON.stringify(content, null, 2);
    fs3.writeFileSync(filePath, contentStr, "utf8");
    return true;
  }
  return false;
}
function createOrMigrateNativeFile(filePath) {
  try {
    if (fs3.existsSync(filePath) && isSymlinkFile(filePath)) {
      fs3.unlinkSync(filePath);
    }
    return injectBacklink(filePath);
  } catch (err) {
    console.error(`Error creating/migrating native file ${filePath}:`, err);
    return false;
  }
}
function checkExistingFiles(projectPath) {
  const existingFiles = [];
  const filesToCheck = [
    { name: "AGENTS.md", path: path4.join(projectPath, FRAME_FILES.AGENTS) },
    { name: "CLAUDE.md", path: path4.join(projectPath, FRAME_FILES.CLAUDE) },
    { name: "GEMINI.md", path: path4.join(projectPath, FRAME_FILES.GEMINI) },
    { name: ".subframe/STRUCTURE.json", path: path4.join(projectPath, FRAME_FILES.STRUCTURE) },
    { name: ".subframe/PROJECT_NOTES.md", path: path4.join(projectPath, FRAME_FILES.NOTES) },
    { name: ".subframe/tasks/", path: path4.join(projectPath, FRAME_TASKS_DIR) },
    { name: ".subframe/tasks.json", path: path4.join(projectPath, FRAME_FILES.TASKS) },
    { name: ".subframe/QUICKSTART.md", path: path4.join(projectPath, FRAME_FILES.QUICKSTART) },
    { name: ".subframe/docs-internal/", path: path4.join(projectPath, FRAME_FILES.DOCS_INTERNAL) },
    { name: ".claude/skills/sub-tasks/", path: path4.join(projectPath, ".claude", "skills", "sub-tasks") },
    { name: ".claude/skills/sub-docs/", path: path4.join(projectPath, ".claude", "skills", "sub-docs") },
    { name: ".claude/skills/sub-audit/", path: path4.join(projectPath, ".claude", "skills", "sub-audit") },
    { name: ".claude/skills/onboard/", path: path4.join(projectPath, ".claude", "skills", "onboard") },
    { name: ".subframe/", path: path4.join(projectPath, FRAME_DIR) }
  ];
  for (const file of filesToCheck) {
    if (fs3.existsSync(file.path)) {
      existingFiles.push(file.name);
    }
  }
  return existingFiles;
}
function migrateRootFiles(projectPath) {
  const frameDirPath = path4.join(projectPath, FRAME_DIR);
  const migrated = [];
  const filesToMigrate = [
    { rootName: "STRUCTURE.json", subframeName: "STRUCTURE.json" },
    { rootName: "PROJECT_NOTES.md", subframeName: "PROJECT_NOTES.md" },
    { rootName: "tasks.json", subframeName: "tasks.json" },
    { rootName: "QUICKSTART.md", subframeName: "QUICKSTART.md" },
    { rootName: "docs-internal", subframeName: "docs-internal" }
  ];
  for (const file of filesToMigrate) {
    const rootPath = path4.join(projectPath, file.rootName);
    const subframePath = path4.join(frameDirPath, file.subframeName);
    if (fs3.existsSync(rootPath) && !fs3.existsSync(subframePath)) {
      fs3.renameSync(rootPath, subframePath);
      migrated.push(file.rootName);
    }
  }
  return migrated;
}
function initializeProject(projectPath, options = {}) {
  const name = options.name || path4.basename(projectPath);
  const hooks = options.hooks !== false;
  const frameDirPath = path4.join(projectPath, FRAME_DIR);
  const created = [];
  const skipped = [];
  function track(label, wasCreated) {
    if (wasCreated) {
      created.push(label);
    } else {
      skipped.push(label);
    }
  }
  if (!fs3.existsSync(frameDirPath)) {
    fs3.mkdirSync(frameDirPath, { recursive: true });
    created.push(".subframe/");
  } else {
    skipped.push(".subframe/");
  }
  const migrated = migrateRootFiles(projectPath);
  if (migrated.length > 0) {
    created.push(`migrated: ${migrated.join(", ")}`);
  }
  const config = getFrameConfigTemplate(name);
  fs3.writeFileSync(
    path4.join(frameDirPath, FRAME_CONFIG_FILE),
    JSON.stringify(config, null, 2),
    "utf8"
  );
  created.push(".subframe/config.json");
  track("AGENTS.md", createFileIfNotExists(
    path4.join(projectPath, FRAME_FILES.AGENTS),
    getAgentsTemplate(name)
  ));
  track("CLAUDE.md (backlink)", createOrMigrateNativeFile(
    path4.join(projectPath, FRAME_FILES.CLAUDE)
  ));
  track("GEMINI.md (backlink)", createOrMigrateNativeFile(
    path4.join(projectPath, FRAME_FILES.GEMINI)
  ));
  track(".subframe/STRUCTURE.json", createFileIfNotExists(
    path4.join(projectPath, FRAME_FILES.STRUCTURE),
    getStructureTemplate(name)
  ));
  track(".subframe/PROJECT_NOTES.md", createFileIfNotExists(
    path4.join(projectPath, FRAME_FILES.NOTES),
    getNotesTemplate(name)
  ));
  const tasksDir = path4.join(projectPath, FRAME_TASKS_DIR);
  if (!fs3.existsSync(tasksDir)) {
    fs3.mkdirSync(tasksDir, { recursive: true });
    track(".subframe/tasks/", true);
  }
  track(".subframe/tasks.json", createFileIfNotExists(
    path4.join(projectPath, FRAME_FILES.TASKS),
    getTasksTemplate(name)
  ));
  track(".subframe/QUICKSTART.md", createFileIfNotExists(
    path4.join(projectPath, FRAME_FILES.QUICKSTART),
    getQuickstartTemplate(name)
  ));
  const docsInternalPath = path4.join(projectPath, FRAME_FILES.DOCS_INTERNAL);
  if (!fs3.existsSync(docsInternalPath)) {
    fs3.mkdirSync(docsInternalPath, { recursive: true });
    fs3.writeFileSync(
      path4.join(docsInternalPath, "README.md"),
      getDocsInternalReadme(name),
      "utf8"
    );
    created.push(".subframe/docs-internal/");
  } else {
    skipped.push(".subframe/docs-internal/");
  }
  const binDirPath = path4.join(frameDirPath, FRAME_BIN_DIR);
  if (!fs3.existsSync(binDirPath)) {
    fs3.mkdirSync(binDirPath, { recursive: true });
  }
  const codexWrapperPath = path4.join(binDirPath, "codex");
  if (!fs3.existsSync(codexWrapperPath)) {
    fs3.writeFileSync(codexWrapperPath, getCodexWrapperTemplate(), { mode: 493 });
    created.push(".subframe/bin/codex");
  } else {
    skipped.push(".subframe/bin/codex");
  }
  const gitDirPath = path4.join(projectPath, ".git");
  if (hooks && !fs3.existsSync(gitDirPath)) {
    skipped.push(".githooks/ (no .git directory)");
  }
  if (hooks && fs3.existsSync(gitDirPath)) {
    const hooksDirPath = path4.join(projectPath, GITHOOKS_DIR);
    const hookPath = path4.join(hooksDirPath, "pre-commit");
    const updaterPath = path4.join(hooksDirPath, "update-structure.js");
    if (!fs3.existsSync(hookPath)) {
      if (!fs3.existsSync(hooksDirPath)) {
        fs3.mkdirSync(hooksDirPath, { recursive: true });
      }
      fs3.writeFileSync(hookPath, getPreCommitHookTemplate(), { mode: 493 });
      fs3.writeFileSync(updaterPath, getHookUpdaterScript(), { mode: 420 });
      try {
        (0, import_child_process.execSync)("git config core.hooksPath .githooks", {
          cwd: projectPath,
          stdio: "ignore"
        });
      } catch (_err) {
      }
      created.push(".githooks/pre-commit");
      created.push(".githooks/update-structure.js");
    } else {
      skipped.push(".githooks/pre-commit");
    }
  }
  if (hooks && fs3.existsSync(gitDirPath)) {
    const hooksDirPath = path4.join(projectPath, GITHOOKS_DIR);
    const prePushPath = path4.join(hooksDirPath, "pre-push");
    if (!fs3.existsSync(prePushPath)) {
      if (!fs3.existsSync(hooksDirPath)) {
        fs3.mkdirSync(hooksDirPath, { recursive: true });
      }
      fs3.writeFileSync(prePushPath, getPrePushHookTemplate(), { mode: 493 });
      created.push(".githooks/pre-push");
    } else {
      skipped.push(".githooks/pre-push");
    }
  }
  const workflowsDir = path4.join(projectPath, FRAME_WORKFLOWS_DIR);
  if (!fs3.existsSync(workflowsDir)) {
    fs3.mkdirSync(workflowsDir, { recursive: true });
    fs3.writeFileSync(path4.join(workflowsDir, "review.yml"), getDefaultReviewWorkflow(), "utf8");
    fs3.writeFileSync(path4.join(workflowsDir, "task-verify.yml"), getTaskVerifyWorkflow(), "utf8");
    fs3.writeFileSync(path4.join(workflowsDir, "health-check.yml"), getHealthCheckWorkflow(), "utf8");
    created.push(".subframe/workflows/ (3 templates)");
  } else {
    skipped.push(".subframe/workflows/");
  }
  const skillDirs = ["sub-tasks", "sub-docs", "sub-audit", "onboard"];
  const skillTemplates = {
    "sub-tasks": getSubTasksSkillTemplate,
    "sub-docs": getSubDocsSkillTemplate,
    "sub-audit": getSubAuditSkillTemplate,
    "onboard": getOnboardSkillTemplate
  };
  for (const skillName of skillDirs) {
    const skillDir = path4.join(projectPath, ".claude", "skills", skillName);
    if (!fs3.existsSync(skillDir)) {
      fs3.mkdirSync(skillDir, { recursive: true });
    }
    track(`.claude/skills/${skillName}/SKILL.md`, createFileIfNotExists(
      path4.join(skillDir, "SKILL.md"),
      skillTemplates[skillName]()
    ));
  }
  const claudeHooks = options.claudeHooks !== false;
  if (claudeHooks) {
    const subframeHooksDir = path4.join(projectPath, SUBFRAME_HOOKS_DIR);
    if (!fs3.existsSync(subframeHooksDir)) {
      fs3.mkdirSync(subframeHooksDir, { recursive: true });
    }
    track(".subframe/hooks/session-start.js", createFileIfNotExists(
      path4.join(projectPath, FRAME_FILES.HOOKS_SESSION_START),
      getSessionStartHookTemplate()
    ));
    track(".subframe/hooks/prompt-submit.js", createFileIfNotExists(
      path4.join(projectPath, FRAME_FILES.HOOKS_PROMPT_SUBMIT),
      getPromptSubmitHookTemplate()
    ));
    track(".subframe/hooks/stop.js", createFileIfNotExists(
      path4.join(projectPath, FRAME_FILES.HOOKS_STOP),
      getStopHookTemplate()
    ));
    track(".subframe/hooks/pre-tool-use.js", createFileIfNotExists(
      path4.join(projectPath, FRAME_FILES.HOOKS_PRE_TOOL_USE),
      getPreToolUseHookTemplate()
    ));
    track(".subframe/hooks/post-tool-use.js", createFileIfNotExists(
      path4.join(projectPath, FRAME_FILES.HOOKS_POST_TOOL_USE),
      getPostToolUseHookTemplate()
    ));
    try {
      const existing = readClaudeSettings(projectPath);
      const subframeHooksConfig = getClaudeSettingsHooksTemplate();
      const merged = mergeSubFrameHooks(existing, subframeHooksConfig);
      writeClaudeSettings(projectPath, merged);
      created.push(".claude/settings.json (hooks merged)");
    } catch (err) {
      console.error("Error merging Claude settings:", err);
      skipped.push(".claude/settings.json (merge failed)");
    }
  }
  return { config, created, skipped };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  checkExistingFiles,
  createFileIfNotExists,
  createOrMigrateNativeFile,
  initializeProject,
  migrateRootFiles
});
