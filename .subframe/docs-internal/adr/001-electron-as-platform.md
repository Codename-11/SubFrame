# ADR-001: Electron as Application Platform

**Date:** 2025-12-01
**Status:** Accepted
**Category:** Architecture

## Context

SubFrame needs a desktop application framework that can host multiple terminal instances (via node-pty), a file explorer, and a code editor — all in a single window with a rich UI.

## Decision

Use **Electron** (v28+) as the application platform.

## Alternatives Considered

### Tauri
**Pros:** Smaller binaries, Rust backend, lower memory footprint.
**Cons:** No native Node.js runtime — can't use node-pty directly. Would require a separate server process for PTY management. Ecosystem less mature for terminal-heavy apps.

### Native (C++/Qt, Swift/AppKit)
**Pros:** Best performance, native look and feel.
**Cons:** No cross-platform code sharing. Massive development effort for one developer. xterm.js (web-based terminal emulator) wouldn't work natively.

### Terminal UI (TUI — blessed, ink)
**Pros:** Terminal-native, lightweight.
**Cons:** Can't embed rich UI (file trees, panels, editors) with the same fidelity. Mouse interaction is limited.

## Rationale

- xterm.js is the de facto terminal emulator for web — runs natively in Electron's Chromium
- node-pty runs in Electron's Node.js process — no IPC bridge needed for PTY
- HTML/CSS for UI means rapid iteration and rich layout (grid, panels, animations)
- Cross-platform (Windows, macOS, Linux) from a single codebase
- Pattern proven by VS Code, Hyper, and other terminal/IDE apps

## Consequences

- Larger binary size (~150MB+ with Electron)
- Higher baseline memory usage vs native apps
- Must manage Electron version upgrades (security patches)
- UI is web-based — enables future "SubFrame Server" (browser mode) with minimal changes
