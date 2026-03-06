<!-- SUBFRAME:BEGIN -->
> **[SubFrame Project]** — Read [AGENTS.md](./AGENTS.md) for project instructions, task management rules, and context preservation guidelines.
<!-- SUBFRAME:END -->

# SubFrame

Terminal-centric IDE for Claude Code. Enhances native AI tools — does not replace them.

## Core Rule

**Only do what the user asks.** Do not refactor, restructure, or add features beyond the request. Present suggestions separately — never implement without approval.

## Architecture

Electron app with two processes communicating over typed IPC (`src/shared/ipcChannels.ts`).

| Layer | Entry Point | Purpose |
|-------|------------|---------|
| **Main** (Node.js/TS) | `src/main/index.ts` | PTY management, file I/O, IPC handlers, manager modules |
| **Renderer** (React/TS) | `src/renderer/index.tsx` | React 19 + Zustand + TanStack Query, shadcn/ui, Tailwind CSS v4 |
| **Shared** | `src/shared/*.ts` | Typed IPC channels, constants, templates, backlink utilities |

### Tech Stack

React 19, TypeScript (strict), Zustand (state), TanStack Query (IPC caching), TanStack Table (sorting/filtering), shadcn/ui (components), Tailwind CSS v4, Framer Motion (animations), CodeMirror 6 (editor), esbuild (bundler).

### Key Modules

**Main process** — each manager has `init()` + `setupIPC()`:
`ptyManager` `tasksManager` `pluginsManager` `claudeSessionsManager` `aiToolManager` `aiFilesManager` `settingsManager` `gitBranchesManager` `overviewManager` `agentStateManager` `skillsManager` `promptsManager` `updaterManager` `pipelineManager` `workspace` `frameProject`
**Utilities**: `taskMarkdownParser` (parse/serialize task .md files with YAML frontmatter) `pipelineWorkflowParser` (YAML workflow parsing) `pipelineStages` (built-in stage handlers)
**Theme**: `themeTypes` (shared theme tokens, presets, CSS mapping)

**Renderer** — React components in `src/renderer/components/`:
`App` `Sidebar` `ProjectList` `WorkspaceSelector` `Terminal` `TerminalArea` `TerminalGrid` `TerminalTabBar` `FileTree` `Editor` `RightPanel` `TasksPanel` `TaskTimeline` `TaskGraph` `TaskKanban` `SessionsPanel` `PluginsPanel` `SettingsPanel` `OverviewPanel` `StatsDetailView` `DecisionsDetailView` `GithubPanel` `AIFilesPanel` `AIToolSelector` `StructureMap` `SubFrameHealthPanel` `AgentStateView` `AgentTimeline` `SidebarAgentStatus` `SkillsPanel` `KeyboardShortcuts` `HistoryPanel` `CommandPalette` `PromptLibrary` `WhatsNew` `UpdateNotification` `OnboardingDialog` `ErrorBoundary` `PipelinePanel` `PipelineTimeline`
**Previews** (in `src/renderer/components/previews/`): `MarkdownPreview` `HtmlPreview` `ImagePreview`
**Theme**: `ThemeProvider` (runtime CSS variable injection from settings, feature toggle data-attributes)

**Lib** (renderer utilities): `src/renderer/lib/ipc.ts` (IPC bridge) `src/renderer/lib/utils.ts` (cn helper, misc) `src/renderer/lib/codemirror-theme.ts` (CM6 SubFrame theme) `src/renderer/lib/codemirror-extensions.ts` (CM6 extensions/languages) `src/renderer/lib/promptUtils.ts` (shared prompt utilities — template variables, insert, copy, sort)

**Stores** (Zustand): `useUIStore` `useProjectStore` `useTerminalStore`
**Hooks** (TanStack Query): `useIpc` (`useIpcQuery` `useIpcMutation`) `useIPCListener` `useTasks` `useSessions` `usePlugins` `useSettings` `useOverview` `useAIFiles` `useGithub` `useFileTree` `useTerminal` `useAgentState` `useSkills` `usePrompts` `useOnboarding` `useSubFrameHealth` `useUpdater` `usePipeline` `usePipelineWorkflows` `usePipelineProgress`

### Build & Dev

```bash
npm run dev          # Watch mode (main TS + React) + Electron
npm run build        # Build main TS + React renderer
npm run watch        # Watch React renderer only (no Electron)
npm run typecheck    # TypeScript strict-mode check (main + renderer)
npm test             # Run Vitest test suite
npm run lint         # ESLint check (TS/TSX only)
npm run check        # typecheck + lint + test (all quality gates)
npm start            # Build then launch
npm run structure    # Update .subframe/STRUCTURE.json (supports TS/TSX)
npm run task -- <command>             # Sub-Task CLI (list, start, complete, add, etc.)
node scripts/find-module.js <keyword>  # Fast file lookup via .subframe/STRUCTURE.json
npm run docs:dev     # VitePress docs dev server (localhost)
npm run docs:build   # Build docs to docs/.vitepress/dist/
npm run docs:preview # Preview built docs locally
```

## Project Files (SubFrame System)

| File | Purpose | Auto-loaded? |
|------|---------|-------------|
| `.subframe/STRUCTURE.json` | Module map, IPC channels, function locations | Read at session start |
| `.subframe/tasks/*.md` | Sub-Task files (markdown + YAML frontmatter) | Source of truth |
| `.subframe/tasks.json` | Sub-Task index (auto-generated from .md files) | Read at session start |
| `.subframe/PROJECT_NOTES.md` | Decisions, session notes, architecture context | Read at session start |
| `.subframe/docs-internal/` | ADRs, architecture overview, internal changelog, IPC reference | Reference (not auto-loaded) |
| `CHANGELOG.md` | User-facing changelog ([keepachangelog](https://keepachangelog.com/) spec) | Reference |
| `.subframe/workflows/*.yml` | Pipeline workflow definitions (YAML, GitHub Actions-inspired) | Read on demand |
| `.subframe/pipelines/runs.json` | Pipeline run history (auto-managed) | Read on demand |
| `AGENTS.md` | Full rules for Sub-Task system, notes, documentation | Reference manual |

**Start each session** by reading `.subframe/STRUCTURE.json`, `.subframe/tasks.json`, and `.subframe/PROJECT_NOTES.md`.

## Sub-Task System (Quick Reference)

**"Sub-Tasks"** are SubFrame's project task tracking system stored as individual markdown files in `.subframe/tasks/*.md` with YAML frontmatter. A generated index at `.subframe/tasks.json` provides backward-compatible access. Not to be confused with Claude's internal todo tools. The name plays on "Sub" from SubFrame.

See [AGENTS.md](./AGENTS.md) for full schema and rules.

### CLI Script (Preferred)

**Always use the CLI script instead of hand-editing task files:**

```bash
node scripts/task.js list [--all]          # Show active sub-tasks
node scripts/task.js get <id>              # Full sub-task details (with step progress)
node scripts/task.js start <id>            # pending → in_progress
node scripts/task.js complete <id>         # → completed
node scripts/task.js add --title "..." [--description "..." --priority medium --category feature --blocked-by id1,id2 --blocks id3 --user-request "..." --acceptance-criteria "..." --add-step "Step 1" --add-step "Step 2"]
node scripts/task.js update <id> [--status pending --notes "..." --add-note "..." --add-step "..." --complete-step <index>]
node scripts/task.js open <id>             # Print absolute path to .md file
node scripts/task.js archive               # Move completed .md files to .subframe/tasks/archive/YYYY/
```

Or use the `/sub-tasks` skill for interactive management.

### Status Lifecycle

**Before starting work:** Run `node scripts/task.js list` to check for a matching sub-task. If one exists, run `node scripts/task.js start <id>` — don't create a duplicate.

**Normal flow:** `pending` → `in_progress` → `completed` (use CLI `start` and `complete` commands)

**Reopen (rare):** `node scripts/task.js update <id> --status pending --add-note "Reopening because..."`

**If work is incomplete** at end of session: leave as `in_progress`, add notes: `node scripts/task.js update <id> --add-note "Did X, Y remains"`

### Recognition & Creation

- **Recognize sub-tasks** from user requests, deferred work ("let's do this later"), and discovered gaps
- **Ask before adding** — "Should I add this as a sub-task?"
- **Don't duplicate** — search existing sub-tasks first
- **Required fields**: `title`, `description`, `userRequest`, `acceptanceCriteria`, `status`, `priority`, `category`

### Hooks (Automatic)

Project-level hooks in `.claude/settings.json` automate sub-task awareness:
- **SessionStart** — injects pending/in-progress sub-tasks into context (survives compaction)
- **UserPromptSubmit** — fuzzy-matches prompts against pending sub-tasks, suggests `start`
- **Stop** — reminds about in-progress sub-tasks when Claude finishes responding

## Before Ending Work

After significant work (code changes, architecture decisions, new tooling), verify the SubFrame system is in sync:

1. **Sub-Task** — Was this work tracked? `node scripts/task.js list` → create/complete as needed
2. **PROJECT_NOTES.md** — Any decisions worth preserving? Ask the user
3. **Changelog** — Does `CHANGELOG.md` (keepachangelog) have entries under `[Unreleased]`? Also update `.subframe/docs-internal/changelog.md` for detailed internal notes
4. **STRUCTURE.json** — Source files changed? `npm run structure` (also handled by pre-commit hook)
5. **CLAUDE.md** — Did the architecture table, modules list, or build commands change?

The Stop hook will flag untracked work automatically (modified `src/` files with no in-progress sub-task).

## Context Preservation

When an important decision or completion occurs, ask: *"Should I add this to .subframe/PROJECT_NOTES.md?"*

Capture: architecture decisions, technology choices, approach changes, failed attempts.
Skip: typo fixes, routine debugging, simple config changes.

## Keeping Docs in Sync

When changing any of these, update **all** locations that reference them:

| What changed | Update these |
|---|---|
| **Sub-Task schema** (new field, renamed field) | `.subframe/tasks/*.md` frontmatter, `.subframe/tasks.json` taskSchema, AGENTS.md Sub-Task Structure, CLAUDE.md quick reference, `frameTemplates.ts` getTasksTemplate(), `taskMarkdownParser.ts` |
| **IPC channel** (added/removed/renamed) | `ipcChannels.ts`, .subframe/STRUCTURE.json ipcChannels section, relevant manager + renderer modules |
| **New module/file** | .subframe/STRUCTURE.json modules section, `main/index.ts` imports (if main process), run `npm run structure` |
| **UI terminology** (label/branding change) | index.html, renderer TSX (user-facing strings), CLAUDE.md, AGENTS.md, frameTemplates.ts |
| **Quality tooling** (test/lint/CI config) | `vitest.config.ts`, `eslint.config.mjs`, `.prettierrc`, `tsconfig.test.json`, `.github/workflows/ci.yml` |
| **Significant session work** | `CHANGELOG.md` (user-facing, keepachangelog), `.subframe/docs-internal/changelog.md` (internal detail), `.subframe/PROJECT_NOTES.md` (decisions), `.subframe/tasks.json` (sub-task tracking) |
| **Version bump** | `npm version <newversion>` (updates `package.json` + git tag), then `docs/index.md` JSON-LD `softwareVersion`. `FRAME_VERSION` auto-reads from `package.json`. |

## Conventions

- **Commits**: [Conventional Commits](https://www.conventionalcommits.org/) — `feat`, `fix`, `docs`, `refactor`, `chore`
- **Branches**: `feature/<name>`, `fix/<name>`, `docs/<name>`
- **IPC pattern**: Define channel in `ipcChannels.ts` (typed) → handle in main manager → use `useIpcQuery`/`useIpcMutation` hooks in renderer
- **New modules**: Follow existing `init()` + `setupIPC()` pattern, register in `main/index.ts`
- **React components**: TSX in `src/renderer/components/`, use shadcn/ui primitives, Tailwind classes, Framer Motion for animations

## Versioning

**Single source of truth:** `package.json` `"version"` field. All other version references derive from it:
- `src/shared/frameConstants.ts` (and `.js` fallback) — `FRAME_VERSION` reads `require('../../package.json').version` at runtime
- `docs/index.md` — `softwareVersion` in JSON-LD frontmatter (VitePress source)

**Note:** Template schema versions in `frameTemplates.ts` (STRUCTURE.json `"1.0"`, tasks.json `"1.2"`, config.json `"1.0"`) are **file format versions**, not the app version — they evolve independently.

**Format:** [SemVer](https://semver.org/) with pre-release tags — `MAJOR.MINOR.PATCH[-prerelease]`
- Pre-release: `0.1.0-beta.1`, `0.1.0-beta.2`, etc.
- Stable: `1.0.0`, `1.1.0`, etc.

**Bumping version — use the `/release` skill:**
```bash
/release patch              # 0.1.0-beta.1 → 0.1.1
/release minor              # 0.1.0 → 0.2.0
/release major              # 0.9.0 → 1.0.0
/release 0.2.0-beta.1       # Explicit version with pre-release tag
```

The `/release` skill handles the full workflow: version bump, `docs/index.md` sync, `RELEASE_NOTES.md` generation, commit, and git tag. See `.claude/skills/release/SKILL.md` for details.

**Manual workflow (if not using `/release`):**
```bash
# 1. Update package.json version
# 2. Update docs/index.md softwareVersion in JSON-LD frontmatter
# 3. Write RELEASE_NOTES.md
# 4. Commit: chore(release): bump version to X.Y.Z
# 5. Tag: git tag vX.Y.Z
# 6. Push: git push origin main --tags
```

**Creating a GitHub release after push:**
```bash
gh release create v<version> --prerelease --title "v<version>" --notes-file RELEASE_NOTES.md  # Pre-release
gh release create v<version> --title "v<version>" --notes-file RELEASE_NOTES.md               # Stable
```

## CSS Design System

**Tailwind CSS v4** with SubFrame theme in `src/renderer/styles/globals.css`:
- Warm neutrals with amber accent (`--color-accent: #d4a574`)
- Semantic colors: `--color-success`, `--color-warning`, `--color-error`, `--color-info`
- Surface hierarchy: `bg-deep` → `bg-primary` → `bg-secondary` → `bg-tertiary` → `bg-elevated` → `bg-hover`
- Text hierarchy: `text-primary` → `text-secondary` → `text-tertiary` → `text-muted`
- Borders: `border-subtle` → `border-default` → `border-strong`
- **shadcn/ui components** in `src/renderer/components/ui/` — use these for buttons, dialogs, tabs, etc.
- Use Tailwind classes with theme tokens — don't hardcode colors
- **Theme system**: 4 built-in presets in `src/shared/themeTypes.ts`, runtime CSS injection via `ThemeProvider`, feature toggles via `[data-neon-traces]`/`[data-scanlines]`/`[data-logo-glow]` HTML attributes
- Neon trace tokens: `--color-neon-purple`, `--color-neon-pink`, `--color-neon-cyan` (+ glow variants)
