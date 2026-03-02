# ADR-003: Zustand for State Management

**Date:** 2026-03-01
**Status:** Accepted
**Category:** Stack

## Context

The React refactor (ADR-002) requires a state management solution for UI state — sidebar visibility, active panel, terminal focus, editor state, etc. The original vanilla JS app used global variables and DOM attributes for state.

## Decision

Use **Zustand 5.x** with 3 stores: `useUIStore`, `useProjectStore`, `useTerminalStore`.

## Alternatives Considered

### Redux Toolkit
**Pros:** Industry standard, excellent DevTools, middleware ecosystem.
**Cons:** Significant boilerplate (slices, reducers, selectors). Overkill for SubFrame's UI state — we don't have complex state transitions or need time-travel debugging.

### React Context + useReducer
**Pros:** No extra dependency.
**Cons:** Re-renders all consumers on any state change. Performance issues with frequent updates (terminal focus, resize events).

### Jotai
**Pros:** Atomic state model, minimal boilerplate.
**Cons:** Less intuitive for grouped state (sidebar + panels = one concern). Harder to reason about derived state across atoms.

## Rationale

- Zustand stores are plain functions — no providers, no wrappers, no boilerplate
- Selective subscriptions prevent unnecessary re-renders (`useUIStore(s => s.activePanel)`)
- Three stores map cleanly to SubFrame's concerns: UI chrome, project data, terminal state
- Works outside React (can read/write from main process bridge if needed)
- 1.1KB gzipped — negligible bundle impact

## Consequences

- State is accessed via hooks in components, not prop drilling
- Store actions are co-located with state (no separate action files)
- DevTools available via `zustand/middleware` if needed
