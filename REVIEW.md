# Code Review Guidelines

This file guides Claude's automated PR reviews. It supplements the project conventions in CLAUDE.md.

## Always check

- New IPC channels are defined in `src/shared/ipcChannels.ts` with proper types
- Main process modules follow the `init()` + `setupIPC()` pattern
- React components use shadcn/ui primitives, not raw HTML elements for interactive UI
- Theme tokens used for colors (`bg-primary`, `text-secondary`, `border-subtle`) — no hardcoded hex/zinc/slate
- Zustand stores for global state, TanStack Query hooks for IPC data fetching
- Framer Motion for animations, not raw CSS transitions (unless trivial)
- TypeScript strict mode compliance — no `any` types without justification
- Keyboard shortcuts registered in `src/renderer/lib/shortcuts.ts` (single source of truth)
- `npm run check` quality gates (typecheck + lint + test) should pass

## Patterns to enforce

- IPC flow: `ipcChannels.ts` type → main manager handler → `useIpcQuery`/`useIpcMutation` hook
- Manager modules: `init()` called from `main/index.ts`, `setupIPC()` for channel handlers
- Components in `src/renderer/components/`, hooks in `src/renderer/hooks/`
- Tailwind CSS v4 with theme variables from `src/renderer/styles/globals.css`
- Conventional Commits in PR title (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`)

## Be lenient about

- Minor naming style differences (camelCase vs descriptive — both are fine)
- Comment density — don't require comments on self-evident code
- Test coverage — we don't have coverage thresholds yet
- Formatting — handled by tooling

## Skip review for

- Generated files: `.subframe/STRUCTURE.json`, `.subframe/tasks.json`
- Lock files: `package-lock.json`
- Build output: `release/`, `dist/`, `out/`
- Documentation-only changes to `*.md` files (still check for accuracy, but don't block)

## Project fit

When reviewing feature additions, consider:
- Does this enhance the terminal-centric IDE experience?
- Does it work with Claude Code's native features (not replace them)?
- Is it scoped appropriately (not over-engineered)?
- Would it make sense to SubFrame's target users (developers using AI coding tools)?
