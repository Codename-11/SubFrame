# ADR-004: esbuild as Bundler

**Date:** 2025-12-01
**Status:** Accepted
**Category:** Stack

## Context

SubFrame needs a bundler for both the main process (Node.js/TypeScript) and the renderer process (React/TypeScript). Build speed is critical for developer experience — SubFrame is a tool for developers who expect fast iteration.

## Decision

Use **esbuild** for both main and renderer bundling.

## Alternatives Considered

### Vite
**Pros:** Great DX with HMR, widely used in React projects.
**Cons:** Adds a dev server layer that conflicts with Electron's window loading. Vite's Rollup-based production builds are slower than esbuild. More configuration needed for Electron compatibility.

### Webpack
**Pros:** Most mature, handles every edge case.
**Cons:** Slow builds (seconds to minutes). Complex configuration. Unnecessary for SubFrame's straightforward dependency graph.

### tsup / unbuild
**Pros:** Zero-config TypeScript bundling.
**Cons:** Designed for library publishing, not application bundling. Limited control over output format for Electron.

## Rationale

- Sub-second builds (typically <500ms for full rebuild)
- Native TypeScript and JSX support — no separate transpilation step
- Simple API — build config is ~20 lines of JavaScript
- Same tool for both processes (main CJS, renderer IIFE/ESM)
- Already proven in the pre-TypeScript era — no migration risk

## Consequences

- No HMR — uses file watching + full rebuild (still fast enough at <500ms)
- Custom `scripts/build-react.js` handles renderer-specific config (Tailwind plugin, externals)
- esbuild doesn't type-check — separate `npm run typecheck` step needed
