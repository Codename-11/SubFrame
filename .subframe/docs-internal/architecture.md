# SubFrame Architecture

## Overview

SubFrame is an Electron application with two processes communicating over typed IPC channels.

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron Shell                            │
│                                                             │
│  ┌─────────────────────┐     ┌────────────────────────────┐│
│  │   Main Process       │     │   Renderer Process         ││
│  │   (Node.js + TS)     │◄───►│   (React + TS)             ││
│  │                      │ IPC │                            ││
│  │  ┌────────────────┐  │     │  ┌──────────────────────┐  ││
│  │  │ Manager Modules│  │     │  │ React Components     │  ││
│  │  │  ptyManager    │  │     │  │  App                 │  ││
│  │  │  tasksManager  │  │     │  │  Sidebar             │  ││
│  │  │  workspace     │  │     │  │  TerminalArea        │  ││
│  │  │  fileTree      │  │     │  │  RightPanel          │  ││
│  │  │  settingsMan.  │  │     │  │  SettingsPanel       │  ││
│  │  │  ...11 more    │  │     │  │  ...15 more          │  ││
│  │  └────────────────┘  │     │  └──────────────────────┘  ││
│  │                      │     │                            ││
│  │  ┌────────────────┐  │     │  ┌──────────────────────┐  ││
│  │  │ node-pty       │  │     │  │ Zustand Stores       │  ││
│  │  │ (PTY mgmt)     │  │     │  │  useUIStore          │  ││
│  │  └────────────────┘  │     │  │  useProjectStore     │  ││
│  │                      │     │  │  useTerminalStore    │  ││
│  └─────────────────────┘     │  └──────────────────────┘  ││
│                               │                            ││
│                               │  ┌──────────────────────┐  ││
│                               │  │ TanStack Query       │  ││
│                               │  │ (IPC data caching)   │  ││
│                               │  └──────────────────────┘  ││
│                               │                            ││
│                               │  ┌──────────────────────┐  ││
│                               │  │ xterm.js             │  ││
│                               │  │ (terminal emulator)  │  ││
│                               │  └──────────────────────┘  ││
│                               └────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## Process Communication

All IPC channels are defined in `src/shared/ipcChannels.ts` as typed constants. The pattern:

1. **Define** channel in `ipcChannels.ts` (e.g., `LOAD_TASKS: 'load-tasks'`)
2. **Handle** in main-process manager (`ipcMain.handle(IPC.LOAD_TASKS, ...)`)
3. **Consume** in renderer via TanStack Query hook (`useIpcQuery([IPC.LOAD_TASKS], ...)`)

Three IPC patterns are used:
- **`invoke`** — Request/response (most operations)
- **`send`** — Fire-and-forget (terminal input, file tree requests)
- **`on`** — Push events from main to renderer (file changes, terminal output)

### Transport Abstraction

The renderer accesses IPC through a pluggable `Transport` interface (`src/shared/transport.ts`), not directly via Electron's `ipcRenderer`. This enables future browser/mobile access via WebSocket.

- **`ElectronTransport`** (`src/renderer/lib/electronTransport.ts`) — wraps `ipcRenderer`, `shell`, `clipboard`. The ONLY renderer file that imports `electron`.
- **`transportProvider.ts`** — global singleton initialized in `index.tsx` before React renders.
- **`ipc.ts`** — `typedInvoke`/`typedSend`/`typedOn` delegate to `getTransport()`.
- **`TransportPlatform`** — platform APIs (openExternal, clipboard, osPlatform) behind a polyfillable interface.

## Module Pattern

Each main-process manager follows the same contract:

```typescript
export function init(window: BrowserWindow): void { ... }
export function setupIPC(ipcMain: IpcMain): void { ... }
```

Managers are registered in `src/main/index.ts`:
- `setupAllIPC()` — calls `setupIPC()` on each manager
- `initModulesWithWindow()` — calls `init()` on each manager after window creation

## Data Flow

```
User Action (click, keypress)
  → React Component
    → Zustand Store (local state) OR useIpcMutation (IPC call)
      → typedInvoke(channel, args)
        → getTransport().invoke(channel, args)
          → [ElectronTransport: ipcRenderer.invoke] OR [WebSocketTransport: ws message]
            → ipcMain.handle(channel, handler)
              → Manager module (business logic, file I/O, PTY)
                → Return result
                  → TanStack Query cache (automatic)
                    → React re-render (subscribers only)
```

## File Layout

```
src/
├── main/                    # Main process (Node.js)
│   ├── index.ts             # Entry point, window creation, module registration
│   ├── pty.ts               # Low-level PTY operations
│   ├── ptyManager.ts        # PTY lifecycle management
│   ├── *Manager.ts          # Feature managers (11 total)
│   └── ...
├── renderer/                # Renderer process (React)
│   ├── index.tsx            # React root mount
│   ├── components/          # React components (22 total)
│   │   ├── App.tsx          # Root layout (sidebar + terminal + right panel)
│   │   ├── ui/              # shadcn/ui primitives (auto-generated)
│   │   └── ...
│   ├── hooks/               # TanStack Query hooks (12 total)
│   ├── stores/              # Zustand stores (3 total)
│   ├── lib/                 # Utilities (IPC bridge, cn helper)
│   └── styles/
│       └── globals.css      # Tailwind CSS v4 theme + design tokens
└── shared/                  # Shared between processes
    ├── ipcChannels.ts       # Typed IPC channel constants
    ├── frameConstants.ts    # App constants, paths, version
    ├── frameTemplates.ts    # Templates for project init files
    ├── backlinkUtils.ts     # CLAUDE.md/GEMINI.md backlink injection
    ├── logoSVG.ts           # SVG logo data
    └── projectInit.ts       # Project initialization logic
```

## Startup Flow

1. `app.whenReady()` → `init()`
2. Load saved window state (bounds, maximized)
3. Create splash window (inline HTML, no file I/O)
4. `createWindow()` → BrowserWindow with `index.html`
5. `setupAllIPC()` → register all IPC handlers
6. `initModulesWithWindow(mainWindow)` → init all managers
7. Load `index.html` → React mounts → components subscribe to stores + query IPC data
8. Close splash when main window ready
