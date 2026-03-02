# ADR-002: React + TypeScript Refactor

**Date:** 2026-03-01
**Status:** Accepted (in progress)
**Category:** Stack

## Context

The original SubFrame renderer was built with vanilla JavaScript and imperative DOM manipulation — ~9,100 lines across 20 files. As the app grew (panels, settings, sessions, plugins, multi-terminal), the imperative approach became harder to maintain:

- State scattered across global variables and DOM attributes
- Manual DOM updates for every state change
- No type safety across IPC boundaries
- CSS in 7 separate hand-written files (7,158 lines, 913 selectors)

A 4-agent research team analyzed the full codebase in parallel before producing this plan.

## Decision

Refactor the renderer to **React 19 + TypeScript (strict)** with the following stack:

| Library | Role |
|---------|------|
| React 19 | Component architecture |
| TypeScript 5.x (strict) | Type safety across all layers |
| Zustand 5.x | UI state (panels, terminals, sidebar) |
| TanStack Query 5.x | IPC data caching + invalidation |
| TanStack Table 8.x | Headless tables (tasks, sessions) |
| shadcn/ui | Component library (Radix + Tailwind) |
| Tailwind CSS 4.x | Styling (replaces 6 hand-written CSS files) |
| Framer Motion 12.x | Animations (panel transitions, list stagger) |
| esbuild | Bundler (kept — sub-second builds) |

## Alternatives Considered

### Incremental Migration (keep vanilla JS, add TypeScript gradually)
**Pros:** No big-bang rewrite risk. **Cons:** DOM manipulation patterns don't benefit from TypeScript as much. State management remains fragmented. No component reuse.

### Vue.js
**Pros:** Gentle learning curve, good Electron ecosystem. **Cons:** Smaller component library ecosystem. shadcn/ui is React-only.

### Svelte
**Pros:** Less boilerplate, compiled output. **Cons:** Ecosystem still maturing. Fewer headless UI libraries. Less hiring pool.

## Rationale

- React's component model maps 1:1 to SubFrame's panel architecture
- Zustand replaces scattered global state with typed stores
- TanStack Query eliminates manual IPC data fetching/caching boilerplate
- shadcn/ui provides accessible, themeable components (dialogs, tabs, dropdowns)
- Tailwind v4 consolidates 7,158 lines of CSS into utility classes + 41 design tokens
- TypeScript strict mode catches IPC type mismatches at compile time
- esbuild already supported — no bundler migration needed

## Consequences

- Full renderer rewrite (~20 files) — done as parallel implementation alongside old code
- Main process also converted to TypeScript (same interfaces, different syntax)
- `update-structure.js` needed updating to parse TypeScript `import`/`export` syntax
- Sub-tasks that depend on UI (terminal-warp, UX enhancements) are easier to implement post-refactor
- SubFrame Server (browser mode) benefits — React + Tailwind components work identically in Electron and browser
