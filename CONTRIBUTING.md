# Contributing to SubFrame

Thanks for your interest in SubFrame! This guide covers the essentials for getting started.

## Quick Start

```bash
git clone https://github.com/Codename-11/SubFrame.git
cd SubFrame
npm install
npm run dev
```

This starts Electron in dev mode with hot reload for the renderer and watch mode for the main process.

## Project Structure

SubFrame is an Electron app with two processes:

- **Main** (`src/main/`) — Node.js backend: PTY management, file I/O, IPC handlers
- **Renderer** (`src/renderer/`) — React 19 frontend: UI components, state management
- **Shared** (`src/shared/`) — Typed IPC channels, constants, templates

See `CLAUDE.md` for the full architecture table and module list.

## Development Workflow

### Before you code

1. Check [existing issues](https://github.com/Codename-11/SubFrame/issues) and PRs to avoid duplicate work
2. For larger changes, open an issue first to discuss the approach

### Making changes

1. Fork the repo and create a branch: `git checkout -b feature/my-change` or `fix/my-bug`
2. Make your changes
3. Run the quality gates:

```bash
npm run check    # typecheck + lint + test (all three must pass)
```

4. Commit using [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`
5. Open a PR against `main`

### Quality Gates

Every PR must pass:

- **`npm run typecheck`** — TypeScript strict mode, zero errors
- **`npm run lint`** — ESLint, zero errors (warnings ok)
- **`npm test`** — Vitest test suite

These run automatically in CI on every push and PR.

## Code Conventions

### General

- TypeScript strict mode everywhere
- Use theme tokens (`bg-primary`, `text-secondary`, `border-subtle`) — never hardcode colors
- Follow the existing IPC pattern: define channel in `ipcChannels.ts` → handle in main manager → use `useIpcQuery`/`useIpcMutation` hooks in renderer
- New main process modules follow the `init()` + `setupIPC()` pattern

### React Components

- TSX files in `src/renderer/components/`
- Use [shadcn/ui](https://ui.shadcn.com/) primitives for buttons, dialogs, tabs, etc.
- Tailwind CSS v4 for styling
- Framer Motion for animations
- Zustand for global state, TanStack Query for IPC data fetching

### Commits

```
feat: add workspace export dialog
fix: terminal grid losing scrollbar on swap
docs: update CHANGELOG for v0.2.3
refactor: extract pipeline stage handlers
chore: bump electron to 34.x
```

## What Makes a Good PR

- **Focused** — one thing per PR. Bug fix? Just the fix. Feature? Just the feature.
- **Tested** — run `npm run check` before pushing
- **Documented** — update CHANGELOG.md for user-facing changes
- **Follows patterns** — look at how similar things are done in the codebase and match that

## AI-Assisted Development

SubFrame is built with Claude Code. The repo includes:

- `CLAUDE.md` — project instructions that Claude reads automatically
- `AGENTS.md` — cross-tool AI instructions
- `.claude/` — skills, hooks, and settings for Claude Code

If you use Claude Code, these files give it full project context. The PR review bot also uses them to check your changes against project conventions.

## Getting Help

- [Open a Discussion](https://github.com/Codename-11/SubFrame/discussions) for questions
- Check `CLAUDE.md` and `AGENTS.md` for architecture details
- Look at recent PRs for examples of the workflow
