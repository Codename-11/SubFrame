---
title: Hooks & Skills
description: Automated context injection hooks and slash command skills for AI coding tools.
---

# Hooks & Skills

SubFrame uses two mechanisms to enhance your AI tools: **hooks** (automated scripts that run at key moments) and **skills** (slash commands you invoke on demand).

## Hooks

Hooks are small Node.js scripts in `.subframe/hooks/` that fire automatically during an AI session. They are wired up in `.claude/settings.json` and run without user intervention — injecting context, tracking activity, and keeping the AI informed about your project state.

### Available hooks

| Hook | Trigger | What it does |
|------|---------|-------------|
| **SessionStart** | Session begins, resumes, or compacts | Injects pending/in-progress tasks, project context, and output style preferences into the AI's context |
| **UserPromptSubmit** | Each user message | Fuzzy-matches the prompt against pending task titles; suggests `start <id>` if a match is found |
| **Stop** | AI finishes responding | Reminds about in-progress tasks; flags modified source files not tracked by any task |
| **PreToolUse** | Before an agent tool call | Tracks which tools are called and on which files for the Agent Activity Timeline |
| **PostToolUse** | After an agent tool call | Records tool results for the Agent Activity Timeline |

### How hooks work

Each hook runs as a standalone Node.js process. Output on `stdout` is injected into the AI's conversation context as a system message. Hooks that fail exit silently — they never block the AI session or interrupt the conversation.

The hooks system is designed to be invisible during normal use. The AI receives additional context without the user needing to do anything.

### Hook files

| File | Hook type |
|------|-----------|
| `.subframe/hooks/session-start.js` | SessionStart |
| `.subframe/hooks/prompt-submit.js` | UserPromptSubmit |
| `.subframe/hooks/stop.js` | Stop |
| `.subframe/hooks/pre-tool-use.js` | PreToolUse |
| `.subframe/hooks/post-tool-use.js` | PostToolUse |

### Version tracking

Each hook file has a `@subframe-version` stamp in its header comment. The SubFrame Health Panel compares this stamp against the current app version to detect drift. When hooks fall behind, the Health Panel shows them as "Outdated" with an amber badge. Use **Update All** in the Health Panel to bring all outdated hooks to the latest version, or update them individually.

### Git pre-commit hook

In addition to the AI hooks, SubFrame installs a git pre-commit hook at `.githooks/pre-commit` that runs `npm run structure` before each commit. This keeps `.subframe/STRUCTURE.json` in sync with source code changes automatically.

## Skills

Skills are slash commands installed to `.claude/skills/`. Each skill is a `SKILL.md` file containing instructions that the AI reads and follows when invoked. They extend what your AI can do with project-specific capabilities.

### Available skills

| Skill | Command | What it does |
|-------|---------|-------------|
| **Sub-Tasks** | `/sub-tasks` | Interactive task management — list, start, complete, create, and update tasks. Uses `node scripts/task.js` under the hood. |
| **Sub-Docs** | `/sub-docs` | Syncs all SubFrame documentation after feature work — CLAUDE.md module lists, changelog entries, PROJECT_NOTES decisions, STRUCTURE.json. |
| **Sub-Audit** | `/sub-audit` | Two-phase audit: code review (bugs, type safety, security) plus documentation completeness check. Reports findings with `file:line` references. |
| **Onboard** | `/onboard` | Bootstrap SubFrame files from an existing codebase. Analyzes the project and populates STRUCTURE.json, PROJECT_NOTES.md, and initial tasks. |

### Using skills

In your AI session, type the slash command:

```
/sub-tasks
/sub-audit
/sub-docs
/onboard
```

The AI reads the skill's `SKILL.md` file and follows its instructions to perform the task. Skills have access to the full project context and can run CLI commands, read files, and make changes.

### Skill files

Skills are stored as directories under `.claude/skills/`, each containing a `SKILL.md`:

```
.claude/skills/
  sub-tasks/SKILL.md
  sub-docs/SKILL.md
  sub-audit/SKILL.md
  onboard/SKILL.md
```

## Customization

Both hooks and skills are plain files you can edit:

- **Hooks:** `.subframe/hooks/*.js` — Modify behavior, add custom logic, or adjust what context gets injected.
- **Skills:** `.claude/skills/*/SKILL.md` — Adjust instructions, add constraints, or change how the AI performs the task.
- **Settings:** `.claude/settings.json` — Enable or disable specific hooks by editing the hook configuration.

::: warning
After editing hooks or skills manually, the Health Panel may flag them as "modified." This is expected — SubFrame tracks the shipped version but respects your customizations.
:::

## Health monitoring

The SubFrame Health Panel groups all hooks and skills by category and shows their status:

- **Healthy** (green) — File exists and matches the expected version
- **Outdated** (amber) — File exists but has an older `@subframe-version` stamp
- **Missing** (red) — File does not exist

The **Update All** button fixes every outdated or missing component at once. Individual update buttons are available per component for more granular control.
