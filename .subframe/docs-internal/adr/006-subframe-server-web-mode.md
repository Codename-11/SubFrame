# ADR-006: SubFrame Server — Browser Mode (Planned)

**Date:** 2026-02-16
**Status:** Accepted (Phase 1-4 complete — transport, server, UI, mobile)
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

## Progress

### Phase 1: Transport Abstraction (2026-03-23) ✅

Implemented pluggable `Transport` interface (`src/shared/transport.ts`) with `ElectronTransport` implementation. All 26 renderer files that previously imported `require('electron')` now route through `getTransport()`. Only `electronTransport.ts` imports Electron directly.

### Phase 2: WebSocket Server + Web Build (2026-03-23) ✅

`webServerManager.ts` (HTTP + WS via `ws` lib), `ipcRouter.ts` (dual-registration handler router), `eventBridge.ts` (broadcast fan-out), `wsProtocol.ts` (typed message format). `WebSocketTransport` for browser. `web-entry.tsx` + `build-web.js` for browser bundle. Terminal output batching, single-session with takeover, token auth, pairing codes.

### Phase 3: Settings UI + Setup Wizard (2026-03-23) ✅

SettingsPanel integration with enable toggle, server status, connected client indicator. `WebServerSetup.tsx` 4-step wizard: Enable → SSH Tunnel → Connect (URL + pairing code) → Done.

### Phase 4: Mobile UI + PWA (2026-03-23) ✅

`useViewport` hook, `MobileApp`/`MobileBottomNav`/`MobileTerminalWrapper` components, App.tsx responsive routing. PWA manifest, service worker (shell caching), `web-index.html` with meta tags.
