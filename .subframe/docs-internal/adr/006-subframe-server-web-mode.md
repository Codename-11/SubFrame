# ADR-006: SubFrame Server — Browser Mode (Planned)

**Date:** 2026-02-16
**Status:** Accepted (not started)
**Category:** Architecture

## Context

Users want to run SubFrame on headless Linux servers and access it from a browser on any device — similar to how code-server exposes VS Code in the browser.

SubFrame is already built on web technologies (Electron = Chromium + Node.js), making this feasible with a transport layer change.

## Decision

Create a **"SubFrame Server"** mode that replaces Electron's IPC with WebSocket, serving the same React UI as a static web app.

### Architecture

```
Electron App                    SubFrame Server (Web Mode)
─────────────                   ──────────────────────────
ipcMain/ipcRenderer    →        Express + WebSocket
Electron window        →        Static HTML server
node-pty (same)                 node-pty (same)
xterm.js (same)                 xterm.js (same)
React UI (same)                 React UI (same)
```

## Alternatives Considered

### Separate web codebase
**Pros:** Clean separation.
**Cons:** Doubles maintenance. Features diverge over time.

### SSH + tmux (no SubFrame)
**Pros:** Zero development effort.
**Cons:** No SubFrame features (project management, sessions, plugins, file tree).

## Rationale

- React + Tailwind components work identically in Electron and browser
- Only the transport layer changes (IPC → WebSocket)
- node-pty, file system, and task management stay server-side
- SSH tunnel provides security without SubFrame needing auth
- Pattern proven by code-server (VS Code in browser)

## Consequences

- IPC layer needs a transport abstraction (bridge pattern)
- `src/renderer/lib/ipc.ts` becomes the switchpoint (Electron IPC vs WebSocket)
- Express/Fastify server needed for HTTP + WebSocket
- The React refactor (ADR-002) makes this significantly easier
- Future: optional auth, HTTPS, multi-user support
