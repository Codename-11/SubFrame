# SubFrame Changelog

Notable changes grouped by date and domain.

---

## [Unreleased]

### AI Tool Capabilities Model & Pipeline Status Feedback (2026-03-31)

- **`AIToolFeatures` type added to shared IPC types** — replaces the single `supportsPlugins` boolean with a structured 18-field capability map covering hooks, streaming output, hook maturity, event names, config paths, and doc URLs. Defined in `ipcChannels.ts`, consumed everywhere via the existing `AITool` interface.
- **Per-tool feature defaults** — `CLAUDE_FEATURES`, `CODEX_FEATURES`, `GEMINI_FEATURES` constants in `aiToolManager.ts` with verified data (last checked 2026-03-31). Includes `docsUrl`, `hooksDocsUrl`, `cliDocsUrl` on each tool for live verification.
- **Agent state wired into Pipeline UI** — `PipelineTimeline` running stages now show the active agent's current tool name (e.g. "Read", "Edit") below the elapsed timer. `PipelinePanel` log view shows a live status bar with pulsing indicator + tool name + step count when hook data is available.
- **Agent status during task enhance** — the AI Enhance button in `TasksPanel` now shows a compact agent activity indicator with current tool name while enhancement is running.
- **Internal docs reference** — `.subframe/docs-internal/refs/ai-tool-capabilities.md` with full hook event matrix, feature support matrix, streaming output flags, and ACP integration notes for all three tools.
- **CLAUDE.md guidance** — new "AI Tool Capabilities" section with live doc links and instruction to always verify against current docs before assuming capabilities. Added to "Keeping Docs in Sync" table.
- **menu.ts cleanup** — removed duplicate `AITool` interface, now imports from shared `ipcChannels.ts`.

### AI Session Runtime Parity (2026-03-26)

- **Shared AI sessions now complete on explicit structured-result markers** — task enhancement and pipeline AI stages no longer wait for a shell prompt that interactive tools may never return to. Their prompts are wrapped with per-run start/end markers, and the live session runner completes as soon as that marked result arrives.
- **Prompt-echo JSON parsing is hardened** — task/pipeline parsing no longer scans the full noisy transcript and accidentally succeeds on example schemas echoed from the prompt. Structured results are now extracted only from the marked assistant result block after a prompt-boundary marker.
- **Background AI terminals now clean up consistently** — task and pipeline runs destroy their backing PTY/terminal when the live session finishes, fails, or is cancelled instead of leaving orphaned terminal tabs and lingering tool processes behind.
- **Passive session mirrors stop resizing the live PTY** — the onboarding dialog, Activity `Session` view, and AI Sessions panel still mirror the raw session stream, but they no longer fight the main terminal view by sending resize events from narrow read-only mirrors.
- **Onboarding session viewer now auto-opens and nudges PTY geometry once** — the Analyze step no longer starts with the live session hidden. The onboarding dialog opens its session pane automatically during analysis and sends a one-time size sync so interactive AI tools start painting without needing the real terminal tab opened first.
- **Successful onboarding now tears down the live PTY cleanly** — the analysis session no longer leaves an orphaned terminal behind after completion. The onboarding session record clears its terminal reference on success, and the finished PTY is destroyed instead of being left around after the AI session record drops out of the registry.
- **Onboarding transcript emission keeps advancing past the visible window cap** — progress/activity output now tracks raw transcript growth instead of relying on the rendered line count, so the shared activity stream does not stall once the rendered transcript window reaches its cap.
- **Generic AI-session readiness now waits for actual tool markers** — task enhancement and pipeline runs no longer treat any quiet output as “ready” when a tool-specific ready marker exists. Prompt injection now waits for Codex/Claude/Gemini readiness signals instead of falling through early.
- **Onboarding mirror gets a settle-time geometry sync** — the modal session viewer still stays passive after mount, but it now performs one delayed follow-up size sync so animated dialog layout does not leave the live PTY at the wrong initial geometry until the full terminal tab opens.

### AI Background Work UX (2026-03-26)

- **Onboarding analysis now fully participates in Activity streams** — the onboarding pipeline already created a `Project Analysis` stream, but most live PTY output still only existed inside the dialog/terminal. The analysis terminal output is now mirrored into the shared Activity bar, onboarding streams start heartbeat + timeout timers, and canceling from the global activity surface now aborts the live analysis instead of only changing the badge state.
- **Dialogs now expose the shared background-work surface** — onboarding and task enhancement flows both gained explicit `View Activity` affordances so closing or backgrounding a modal no longer strands the user in a modal-local spinner with no obvious path to the live job output.
- **Top-bar running indicator** — the main top bar now shows a compact running-work pill that reflects active Activity streams and jumps straight into the bottom Activity bar, so long AI/pipeline work is visible from both the top surface and the bottom output surface.
- **Task enhancement stream visibility** — AI task enhancement already used `activityManager`, but it mostly left users with a local button spinner. That flow now advertises the shared Activity bar, exposes a direct action from the dialog/toast, and mirrors stdout lines into the stream so background progress is legible in real time.
- **Follow-up audit fixes** — onboarding progress events now carry the live `activityStreamId` immediately, task enhancement switched from a long blocking invoke to a start + result-event flow, user cancellation is no longer rendered as a failure banner, Activity-bar stream focus avoids the early-stream race, and activity timeouts now abort underlying work instead of only flipping stream status.
- **Durable task-enhancement handoff** — task enhancement completion no longer depends on the Tasks panel staying mounted. The app shell now receives the global enhance-result event, dismisses the loading toast, preserves the enhanced payload in shared UI state, and lets the Tasks dialog re-apply or reopen that result after panel/view changes.

### Remote Web Session Parity (2026-03-25)

- **Remote cursor tracking** — SubFrame Server now has an optional `Remote Cursor Tracking` setting that shows web-client mouse/touch activity on the host desktop while a remote session is active.
- **Requester-scoped browser send/on replies** — the IPC router now provides a browser-mode `event.sender.send(...)` path instead of only `reply()`, which fixes web features that still use Electron-style send/on request flows such as tasks, workspace loads, file-tree loads, and AI-files status checks.
- **Remaining routed invoke gaps closed** — updater actions and the top-level release-notes / CLI / context-menu handlers now register through the routable IPC layer too, so browser mode no longer hits the same `No invoke handler` class of bug outside the initial AI-tool fix.
- **Live UI hydration** now carries right-panel and full-view state in addition to terminal/session data, so remote clients can open closer to the host renderer’s current project context instead of restoring only terminal tabs.
- **Dialog + panel mirroring** — live UI sync now includes sidebar state, right-panel collapse/width, settings dialog state, and open full-view tabs, and the main process re-broadcasts those updates back into Electron so browser-originated panel/dialog changes also show up on the desktop host.
- **Live session follow-up sync** — once connected, the browser now continues receiving host session updates for terminal naming/layout and UI state instead of only hydrating once at connect time.
- **Phone web shell parity** — mobile web now exposes a dedicated `Panels` tab for the same project, GitHub, agent, and automation panels available in the desktop right sidebar.
- **Phone terminal parity** — the mobile `Terminal` tab now renders the real `TerminalArea` instead of a stripped single-terminal wrapper, so workspace/view tabs and terminal tab/grid behavior stay aligned with desktop.
- **Mobile panel routing** — when shared UI state opens a panel on phone web, the shell now switches to `Tasks` or `Panels` instead of dropping that intent because the desktop `RightPanel` component is not mounted there.
- **Sub-Tasks in panel matrix** — mobile `Panels` now includes the Sub-Tasks surface as well, matching the desktop right-panel feature list instead of making tasks the only missing panel family.
- **Activity bar server badge** — the bottom activity bar now shows `Web Off`, `Web Ready`, `Web Live`, or `Web Error` states with a small action menu for start/stop and URL copy actions.
- **Session-scoped server start** — manual start/stop no longer persists across app restarts by default. A new `Start Server on Launch` setting controls persistent auto-start separately from the current-session run state.
- **Browser send/reply bridge** — router-backed `ipcMain.on(...)` handlers can now reply back through the WebSocket/event bridge, which fixes host-controlled actions like `New Terminal` that depend on follow-up events such as `terminal-created`.
- **Remote-cursor idle toggle behavior** — when `Remote Cursor Tracking` is off, the browser no longer keeps publishing pointer events in the background; the transport listeners only attach while the feature is enabled.

### Workspace Pill Identity Settings (2026-03-25)

- **Top bar workspace pills** now support four display modes: `Index`, `Short Label`, `Icon`, and `Icon + Short Label`. Default remains the current numeric `#1` style.
- **Settings > Appearance** now separates `Theme Actions` from `Workspace Pills`, so workspace controls are not visually mixed with theme saving.
- **Settings > Appearance > Workspace Pills** now uses combinable content toggles instead of a single style dropdown, so `Index`, `Short Label`, and `Icon` can be mixed freely.
- **Matrix-style pill composition** supports combinations like index + short label, index + icon, or all three together without adding extra preset modes.
- **Index + short label fallback** — when a workspace has an explicit short label, enabling `Index` now renders `# + short label` automatically instead of forcing a second toggle just to reach that combination.
- **Top bar reordering** — hold a workspace pill briefly, then drag to reorder. The dragged topbar order persists through the existing workspace reorder IPC path.
- **Workspace metadata** now persists `shortLabel` and `icon` alongside workspace names/projects, so pill identity survives restarts and applies consistently anywhere the workspace list is loaded.
- Short labels are capped at 4 characters and label-based modes fall back to an auto-generated monogram when no custom label is set.
- **Grid freeze parity** — grid headers now expose freeze/resume controls next to pop-out, matching the tab-strip freeze affordance.
- **Paused output overlay setting** — the in-terminal `Output paused` banner is now separately configurable and defaults to on.
- **CLI actions mirrored** — SubFrame CLI install/remove actions are now available in both General > CLI and Integrations > Shell Integration.

### SubFrame Server — Full Web/Mobile Access (2026-03-23)

**Phase 2: WebSocket Server**
- **`webServerManager.ts`** — HTTP server for static assets + WebSocket server (ws lib) for real-time IPC transport. Follows standard manager pattern (init/setupIPC/shutdown).
- **`ipcRouter.ts`** — Dual-registration wrapper around IpcMain. Managers register handlers in both Electron IPC and a parallel map, so WebSocket server can call same handlers via `routeInvoke()`/`routeSend()`.
- **`eventBridge.ts`** — Fan-out for main→renderer broadcasts. `broadcast()` sends to both Electron window and WS subscribers. Replaces direct `webContents.send()`.
- **`wsProtocol.ts`** — Typed message format: invoke/response, send, subscribe/unsubscribe, auth, session-takeover, ping/pong.
- Terminal output batching: merges rapid PTY chunks into ~16ms frames (configurable via `server.terminalBatchIntervalMs`).
- Single-session model with takeover (Google Messages for Web pattern). Old client sees "Session moved" screen.
- Token-based auth + 6-char pairing code (5-minute expiry).
- Service discovery: writes `{ port, token, pid, version }` to `~/.subframe/web-server.json`.
- **`WebSocketTransport`** — browser-side Transport implementation. Auto-reconnect with exponential backoff (1s→30s max). Selective event subscription. Heartbeat ping every 30s.
- **`web-entry.tsx`** — Browser entry point with connecting/takeover/disconnect UI screens.
- **`build-web.js`** — esbuild config for browser bundle (no electron external).
- **`web-index.html`** — HTML shell with PWA meta tags.

**Phase 3: Settings UI & Setup Wizard**
- **SettingsPanel** — "SubFrame Server" section under Integrations tab. Enable toggle, server status, connected client indicator, Setup Guide / Regenerate Token / Pairing Code buttons.
- **`WebServerSetup.tsx`** — 4-step setup wizard: Enable → Access (SSH tunnel or trusted-LAN mode) → Connect (URL + pairing code, live status) → Done (device info, PWA hint). LAN mode binds to `0.0.0.0`, shows local IP/QR guidance, and warns against public/shared networks.

**Phase 4: Mobile UI & PWA**
- **`useViewport`** hook — responsive breakpoints (mobile <768, tablet 768-1024, desktop >=1024). No-op in Electron.
- **`MobileApp.tsx`** — Mobile layout shell with bottom tab navigation.
- **`MobileBottomNav.tsx`** — 4-tab bottom bar (Terminal/Tasks/Activity/Settings) with Framer Motion animated indicator.
- **`MobileTerminalWrapper.tsx`** — Full-width terminal renderer for mobile.
- **App.tsx routing** — `isMobile && isWeb` renders MobileApp; desktop layout unchanged.
- **PWA manifest** — standalone display, dark theme, icon references.
- **Service worker** — cache-first for shell assets, network-first for API/WS.
- webServerManager serves manifest.json and sw.js with no-cache headers.

**Web asset path fix (2026-03-25)**
- `web-index.html` and `sw.js` now reference `/dist/web-renderer.css` instead of `/dist/renderer.css`.
- `webServerManager.ts` now strips leading slashes before normalizing `/dist/...` URLs on Windows, preventing asset requests like `/dist/web-renderer.js` from resolving to `dist/dist/...` and falling through to the SPA HTML fallback.
- This fixes browser-mode loads where the CSS request fell through to the SPA HTML fallback, causing MIME-type errors and `expected expression, got '<'` console failures.

**Live web session hydration (2026-03-25)**
- The main `SubFrame Server` card in Settings now shows the full tokenized connection URL inline, not just inside the setup wizard, with a direct copy action.
- The same card now also separates the raw base URL from the tokenized connection URL, so host/port and shareable auth link are visible without mixing them.
- Desktop renderer terminal/session state is now synced into the main process for web mode, so remote browsers can hydrate from the live desktop session instead of relying purely on browser-local `localStorage`.
- `GET_TERMINAL_STATE` now includes `projectPath`, which lets the web client attach existing running terminals to the right project/workspace instead of restoring an empty or stale local session.
- `web-entry.tsx` now seeds the project store, terminal store, and browser session storage from `WEB_SESSION_STATE` before rendering the app, so phones/tablets open closer to the current desktop context on first connect.
- `WEB_SERVER_INFO` now exposes the mirrored workspace/project context, and the settings card shows `Mirroring <workspace> / <project>` so it is obvious what the remote device will attach to.
- `webSocketTransport.ts` now falls back from `crypto.randomUUID()` to `crypto.getRandomValues()` and finally a timestamp/random string, fixing live-session hydration on older Android/mobile browsers that do not implement `randomUUID`.
- `index.ts` now registers module IPC handlers through `createRoutableIPC(ipcMain)`, so WebSocket `invoke` calls like `web-session-state` are actually present in the router map instead of existing only on raw Electron IPC.
- `web-entry.tsx` no longer requires the long `?token=` link just to get started. Opening the base URL now shows a small access screen where the client can pair with a short code or paste a session token directly.
- Successful direct-link connections now strip the tokenized query from the browser address bar and keep the token only in `sessionStorage`, so reloads work without leaving the full auth token visible in the URL.
- `WebSocketTransport` now exposes takeover requests for the mobile/web access screen, and its reconnect callback now fires correctly after successful reconnects instead of leaving the disconnect overlay stuck.
- SubFrame Server now remembers the last successful auto-selected port and tries to reuse it on the next start. If that previous port is busy, auto mode falls back to any open port; if the user sets a fixed preferred port, bind failures are surfaced back through Settings instead of silently changing ports.
- Settings > Integrations > SubFrame Server now includes a `Preferred Port` control plus explicit startup-error messaging, so LAN/mobile bookmarks and third-party integrations can target a stable port when desired.
- `settingsManager` and `aiToolManager` now register their handlers through the routed IPC wrapper as well, fixing browser-mode invokes like `get-ai-tool-config` and preventing the web client from falling back into raw-`ipcMain` only channels.
- The web server now exposes a small public `/api/bootstrap` payload with appearance and mirror context, and `web-entry.tsx` uses it to apply the active SubFrame theme before authentication so the pairing/connecting/takeover screens match the desktop theme instead of hard-coded fallback colors.
- The pairing-code button in Settings now actually behaves like a copy action: it generates a code when needed, copies it to the clipboard, keeps the current code visible in the button label, and falls back gracefully if clipboard access is blocked.

### Transport Abstraction Layer (2026-03-23)

- **`Transport` interface** (`src/shared/transport.ts`) — three methods matching Electron's IPC model: `invoke` (request/response), `send` (fire-and-forget), `on` (event subscription returning unsub fn). Plus `TransportPlatform` for shell/clipboard/platform APIs.
- **`ElectronTransport`** (`src/renderer/lib/electronTransport.ts`) — wraps `ipcRenderer`, `shell`, `clipboard`, `process.platform`. The ONLY renderer file that imports `electron`.
- **`transportProvider`** (`src/renderer/lib/transportProvider.ts`) — global singleton `setTransport()`/`getTransport()`, initialized in `index.tsx` before render.
- **`ipc.ts` rewritten** — `typedInvoke`/`typedSend`/`typedOn` now delegate to `getTransport()` instead of direct `ipcRenderer` calls.
- **26 renderer files migrated** — all `require('electron')` imports replaced with transport calls. Hooks (7), components (14+), libs (2+).
- **`IPCSendMap` expanded** — `API_SELECTION_SYNC` and `API_RENDERER_RESPONSE` added (previously untyped raw `ipcRenderer.send` calls, now type-safe).
- **`process.platform` isolated** — `osPlatform` added to `TransportPlatform`; `terminalRegistry.ts` uses lazy `getCtrlLabel()` instead of module-level constant.
- **Leaked listener fixes** — safety timeouts added to one-shot `on()` patterns in `Sidebar.tsx` and `SettingsPanel.tsx` that could leak if responses never arrived.
- Unlocks Phase 2: WebSocketTransport for SubFrame Server browser mode.

### TTS Endpoint for Agent-Initiated Speech (2026-03-22)

- **POST /api/tts** — accepts `{ text, voice, priority, source }` from Claude Code hooks. Voice profiles: `summary`, `error`, `status`, `insight`, `general`. Stores in circular history buffer (50 max). Broadcasts `tts-speak` SSE event to all connected consumers.
- **GET /api/tts/latest** — returns most recent TTS message.
- **GET /api/tts/history** — returns recent messages (configurable `?limit=N`).
- **DTSP capabilities** updated to include `tts` — consumers like Conjure can detect TTS support via the `capabilities` array in `~/.dtsp/sources/subframe.json`.
- **CORS** updated: `POST` method and `Content-Type` header added to preflight.

### GitHub Workflows & Shortcut Fixes (2026-03-22)

- **GitHub Workflows tab** — new panel showing all repo workflows with recent run statuses (success/failure/in-progress), branch, title, click-to-open. Uses `gh workflow list` + `gh run list` via CLI.
- **Claude Code shortcuts unblocked** — Ctrl+T (task toggle), Ctrl+I, Ctrl+H, Ctrl+E no longer intercepted by SubFrame's terminal key handler.
- **Usage tooltip "(soon)"** — stale reset countdowns now hidden instead of showing "(soon)" indefinitely.
- **GitHub icon** — proper GitHub icon in ViewTabBar.

### Terminal Scroll Fix & Max Terminals (2026-03-22)

- **Scroll-to-bottom after workspace switch** — when terminals reparent from the off-screen 1px holder, xterm's viewport DOM retains stale scroll dimensions. Added deferred re-scroll (80ms setTimeout after double-rAF) that runs after browser layout pass, plus direct `viewport.scrollTop = viewport.scrollHeight` DOM fallback on the scroll button.
- **Configurable max terminals** — replaced hardcoded `MAX_TERMINALS = 9` in ptyManager with `getMaxTerminals()` that reads `terminal.maxTerminals` from settings (1–20). Added slider to Settings > Terminal > Behavior.

### System Panel & Integrations (2026-03-22)

- **System Panel** (`SystemPanel.tsx`) — full app dashboard at `Ctrl+Shift+U` with 4 sections:
  - SubFrame: version card with update controls
  - AI Tools: inline tool picker with installed status, start command display
  - Integrations: API Server (toggle, port, token, endpoints), DTSP (toggle, registration status), Feature Detection (hooks, MCP, skills with counts)
  - Quick Access: health, shortcuts, prompt library cards
- **Standardized integration format** — each integration card has: icon + title + subtitle + info button + toggle. Info dialogs document protocol, auth, endpoints, usage.
- **Full-view default** — System and Overview open as full-page tabs, not right sidebar.

### Local API Server (2026-03-22)

- **API Server** (`apiServerManager.ts`) — localhost HTTP server with 48-byte random token auth. 7 endpoints: `/api/health` (public), `/api/terminals`, `/api/terminals/:id/selection`, `/api/terminals/:id/buffer`, `/api/selection`, `/api/context`, `/api/events` (SSE).
- **DTSP registration** — writes `~/.dtsp/sources/subframe.json` for Desktop Text Source Protocol discovery. Independent toggle from API server (`integrations.dtsp` setting).
- **Service discovery** — `~/.subframe/api.json` (SubFrame-specific) + `~/.dtsp/sources/subframe.json` (DTSP protocol). Both cleaned up on shutdown, stale PID checked on startup.
- **Live controls** — toggle on/off, regenerate token, copy config. Settings toggle wired to live server via `onSettingChange`. 5s polling for client/request counters.
- **Renderer bridge** — selection synced via `onSelectionChange` (debounced 50ms), buffer/context/terminals via correlation-ID IPC pattern with 3s timeout.

### Feature Detection (2026-03-22)

- **DETECT_AI_FEATURES IPC** — reads Claude Code's `.claude/settings.json` (project + global) to detect hooks (with event type count), MCP servers (with count), and skills directory. Shown in System Panel with green checkmarks and counts.

### Prompt Execution & Panel State (2026-03-22)

- **Prompt execution** — Shift+Click/Enter inserts prompt text and appends `\r` to execute in terminal.
- **Per-project panel state** — right sidebar panel open/closed state persists per project path in localStorage.
- **Settings > Integrations** — new tab with API Server and DTSP enable/disable toggles.

### Usage Tooltip Cleanup (2026-03-22)

- Renamed local-cache source label from "Local" → "Live" (it's the primary fast path, not a degraded cache)
- Hidden cache age `(Xs ago)` for `local-cache` source — always fresh (<120s), just noise
- Added `lastUpdated` time display (HH:MM) when data is stale (error fallback)
- Made cache age and stale-time indicators mutually exclusive (was rendering both when source had cache age + error)

### API Server Hardening (2026-03-22)

- Removed pathname echo from 404 error responses (info disclosure)
- Added newline sanitization on SSE event names (spec compliance)

### Usage Stats — Hybrid 4-Layer Approach (2026-03-21)

#### Main Process (`claudeUsageManager.ts` — full rewrite)
- **Layer 1: Local cache** — reads `$TEMP/claude-statusline-usage-cache.json` (written by Claude's statusline script). If fresh (<120s), returns data with zero network calls.
- **Layer 2: OAuth API with token refresh** — when local cache is stale/missing, calls `api.anthropic.com/api/oauth/usage`. Pre-emptively refreshes token if near expiry using `refreshToken` from credentials. Retries with refreshed token on failure.
- **Layer 3: Credentials metadata** — always reads `subscriptionType` and `rateLimitTier` from `~/.claude/.credentials.json`. Available even when usage numbers aren't.
- **Layer 4: In-memory cache** — falls back to last successful fetch data when all else fails.
- **New fields parsed**: `seven_day_sonnet`, `seven_day_opus`, `extra_usage` (Max plan credits), `seven_day_oauth_apps`, `seven_day_cowork`
- **Source tracking**: every response carries `source` discriminator (`local-cache` | `api` | `credentials-only` | `none`) and `cacheAgeSeconds`
- **Token refresh**: reads `refreshToken` from credentials, POSTs to `/api/oauth/token`, persists new token back to disk
- Initial fetch delay reduced from 2s to 1s (local cache is near-instant)
- Manual refresh (click pill) bypasses local cache, goes straight to API

#### IPC Types (`ipcChannels.ts`)
- `ClaudeUsageData` expanded: `sevenDaySonnet`, `sevenDayOpus`, `extraUsage`, `source`, `cacheAgeSeconds`, `subscriptionType`, `rateLimitTier`
- Extracted shared types: `UsageWindow`, `ExtraUsageInfo`, `UsageSource`
- IPC channels unchanged (same 3: LOAD, DATA, REFRESH)

#### Renderer (`ViewTabBar.tsx`)
- Usage pill now shows source-colored dot: green (local-cache), blue (API), amber (credentials-only), red (unavailable)
- When no usage data available but credentials exist, shows tier name (e.g., "Max 20x") instead of "Usage unavailable"
- Rich tooltip via shadcn `TooltipContent`: shows all usage windows with full-width bars, tier info, source label with cache age, extra credits, error message, and source explanation
- Per-model breakdown (Sonnet 7d, Opus 7d) shown in tooltip when available
- Extra usage credits section shown for Max plan users
- Removed old `title` attribute tooltip in favor of structured `TooltipContent`

### Documentation Sync & Feature Discovery (2026-03-15)
- Audited all documentation files against actual source code
- Updated CLAUDE.md: added missing managers (`claudeUsageManager`, `githubManager`), utilities (`fileEditor`, `dialogs`, `menu`, `promptLogger`, `pty`), shared types (`agentStateTypes`, `subframeHealth`, `claudeSettingsUtils`, `projectInit`, `logoSVG`), renderer components (`CritiqueView`, `PatchReview`, `PromptsPanel`, `ShortcutsPanel`, `ViewTabBar`, `ThemeProvider`), and lib modules (`terminalRegistry`)
- Updated CHANGELOG.md `[Unreleased]` with undocumented features: git auto-fetch/sync status, editor find/replace/go-to-line/code folding, editor tab mode, CLI integration, single-instance, recent files tracking, terminal file-path links
- Updated docs/docs/features.md with editor tab mode, find/replace, go-to-line, code folding, git sync status, auto-fetch, activity streams, CLI integration sections
- Updated README.md with CLI integration section, pop-out terminals, activity streams, git sync status, editor improvements
- Regenerated STRUCTURE.json

### Activity Streams System (2026-03-14)

#### Main Process
- **activityManager.ts** — New manager module with centralized execution tracking, heartbeat timers, timeout management, and dismiss controls
- Onboarding, pipeline, and task enhancement systems all route output through activityManager
- `spawnAIToolRaw` gains 10-second heartbeat timer for print-mode stages
- `ENHANCE_TASK` gets 2-minute timeout guard and multi-strategy JSON extraction

#### Renderer
- **ActivityBar.tsx** — VS Code-style bottom bar showing active/recent activities with real-time log streaming
- **useActivity.ts** — TanStack Query hook for activity state management
- **activityTypes.ts** — Shared type definitions for activity stream events

#### Settings & UI
- Settings panel rewritten with sidebar navigation, search filter, and 5 reusable setting components
- Close-window protection: native OS dialog for app close, themed AlertDialog for terminal tab close
- Task panel bulk actions: select mode, bulk Complete/Delete/Send-to-Terminal with confirmation
- Workspace create dialog with name input
- Prompts moved to own top bar button

### Pop-Out Terminal Windows (2026-03-14)

#### Main Process
- **popoutManager.ts** — New manager module (`init()` + `setupIPC()` pattern) for detaching terminals into separate OS windows
  - Prewarmed hidden `BrowserWindow` eliminates cold-start latency — renderer bundle is pre-loaded in standby mode
  - Window bounds persistence to `userData/popout-state.json` for position/size recall
  - Race condition guards: stale destroyed-window cleanup, `closed`-event identity check
  - `getOpenCount()` export prevents `window-all-closed` from quitting app when only a pop-out closes
- **ptyManager.ts** — Added `registerPopoutWebContents()` / `unregisterPopoutWebContents()` broadcast helpers; `broadcastClaudeStatus()` and PTY `onExit` now forward events to pop-out windows
- **index.ts** — Wired `popoutManager` into init, IPC setup, and close cleanup; guarded `window-all-closed` with pop-out count check

#### Renderer
- **PopoutTerminal.tsx** — Minimal pop-out window UI with dock button, agent activity indicator, and standby/active mode for prewarming
- **index.tsx** — Entry point branching: detects `#popout?terminalId=X` (cold) and `#popout-standby` (prewarmed) URL hashes
- **TerminalTabBar.tsx** — "Pop Out" in context menu; inline `ExternalLink` icon button on hover (before close X); popped-out tabs show dimmed text + icon
- **TerminalArea.tsx** — Pop-out orchestration, `TERMINAL_POPOUT_STATUS` listener, placeholder with Focus/Dock buttons, Ctrl+Shift+D shortcut, clears maximized state on pop-out
- **TerminalGrid.tsx** — Grid cells and maximized view show Focus/Dock placeholder when terminal is popped out; pop-out button hidden when already popped out
- **useTerminalStore.ts** — Added `poppedOut` field to `TerminalInfo` and `setPoppedOut` action
- **shortcuts.ts** — Added `POPOUT_TERMINAL` (`Ctrl+Shift+D`) to shortcut registry

#### IPC Channels
- `TERMINAL_POPOUT` (handle) — renderer→main pop-out request
- `TERMINAL_DOCK` (handle) — renderer→main dock-back request
- `TERMINAL_POPOUT_STATUS` (event) — main→renderer state change broadcast
- `POPOUT_ACTIVATE` (event) — main→renderer prewarmed window activation

### Private Sub-Tasks (2026-03-11)

#### Data Model & Storage
- **ipcChannels.ts**: Added `private?: boolean` to `Task` interface
- **frameConstants.ts**: Added `FRAME_TASKS_PRIVATE_DIR` constant (`.subframe/tasks/private/`)
- **taskMarkdownParser.ts**: Parse/serialize `private` field in YAML frontmatter (only written when `true`)
- **tasksManager.ts**: `loadTasks()` reads both public + private dirs; `addTask()`/`updateTask()` route files to correct dir; privacy toggle moves files between dirs; `regenerateIndex()` excludes private tasks from git-tracked `tasks.json`; file watcher monitors both dirs

#### CLI (`scripts/task.js`)
- `add --private` creates task in `.subframe/tasks/private/`
- `update <id> --private` / `--public` toggles privacy (moves file between dirs)
- `list` / `get` shows lock icon for private tasks
- `archive` routes private tasks to `private/archive/` (stays gitignored)
- All commands use `findTaskFile()` to search both directories

#### UI
- **TasksPanel.tsx**: Private checkbox in create/edit dialog; lock icon in table title column
- **TaskKanban.tsx**: Lock icon on private task cards
- **TaskGraph.tsx**: Lock icon on private task nodes

#### Hooks & Templates
- **session-start.js**, **stop.js**, **prompt-submit.js**: All read private tasks via lightweight frontmatter parser (no gray-matter dep) so private tasks appear in context injection, reminders, and fuzzy matching
- **frameTemplates.ts**: All three hook templates updated to match deployed versions

#### Git
- `.gitignore`: Added `.subframe/tasks/private/` exclusion
- Purged sensitive task files from full git history via `git filter-repo`

### Version-Stamped Component Update System (2026-03-10)

#### Version Stamps in Templates
- **frameTemplates.ts**: All template functions (`getSessionStartHook`, `getPromptSubmitHook`, `getStopHook`, `getPreToolUseHook`, `getPostToolUseHook`, `getPreCommitHook`, `getPrePushHook`, `getCodexWrapper`, skill templates, workflow templates) now prepend `// @subframe-version X.Y.Z` and `// @subframe-managed` headers to deployed files
- **frameTemplates.js**: JS fallback updated to match TS version
- **Comment formats**: JS files use `// @subframe-version`, markdown skills use `<!-- @subframe-version -->`, YAML workflows use `# @subframe-version`
- **New exports**: `SUBFRAME_VERSION_REGEX`, `SUBFRAME_MANAGED_REGEX` from `frameTemplates.ts`

#### Version-Aware Health Check
- **subframeHealth.ts**: `checkComponent()` now extracts `@subframe-version` from deployed files and compares to current `FRAME_VERSION`
- **claude-settings check**: Now structural — validates all 5 event types (SessionStart, UserPromptSubmit, Stop, PreToolUse, PostToolUse) are configured, reports which are missing
- **claudeSettingsUtils.ts**: New export `getSubFrameHookCoverage()` returns configured event types and missing ones

#### User-Edit Resilience
- **frameProject.ts**: Checks for `@subframe-managed: false` in deployed files before updating; skips files with opt-out marker
- **Update response**: Reports `skipped` components back to the UI
- **ipcChannels.ts**: `SubFrameComponentStatus` extended with `deployedVersion?`, `managedOptOut?`, `missingHooks?`; update response has `skipped?`

#### Build Pipeline Safety
- **scripts/verify-hooks.js**: New script that compares `scripts/hooks/` content against template output to detect drift
- **package.json**: Added `verify:hooks` script; `check` script now includes `npm run verify:hooks`
- **.githooks/pre-commit**: Runs `verify-hooks.js` if present
- **.github/workflows/ci.yml**: Added `npm run verify:hooks` step

#### Health Panel UI
- **SubFrameHealthPanel.tsx**: Shows deployed version with transition indicators (e.g., `0.2.3 → 0.2.4`), missing hooks list, `@subframe-managed: false` badges, and skipped component count after updates

### Onboarding Flow Fixes (2026-03-07)

#### Init → Onboarding Connection
- **Sidebar.tsx**: Dispatches `start-onboarding` CustomEvent with `{ projectPath }` after successful SubFrame init
- **App.tsx**: Listens for `start-onboarding` event, calls `onboarding.detect(projectPath)` to open the OnboardingDialog
- **SubFrameHealthPanel.tsx**: Added "AI Analysis" button (Sparkles icon) to re-run onboarding analysis on already-initialized projects

#### Terminal ID Early Delivery
- **ipcChannels.ts**: Added optional `terminalId` field to `OnboardingProgressEvent` interface
- **onboardingManager.ts**: Sends `terminalId` via `ONBOARDING_PROGRESS` event immediately after terminal creation in `runAnalysisInTerminal()` — no longer blocked behind the full pipeline handle response
- **useOnboarding.ts**: Captures `terminalId` from progress events (not just mutation response), enabling "View Terminal" button during analysis
- **App.tsx**: `onViewTerminal` now calls `useTerminalStore.getState().setActiveTerminal(terminalId)` to focus the analysis terminal

#### Safety & Cleanup
- **Re-entrancy guard**: `RUN_ONBOARDING_ANALYSIS` returns existing `terminalId` if analysis is already running for the same project
- **Dialog close cancels**: Closing OnboardingDialog (X button) during analysis now calls `onCancel()` to kill the terminal — prevents orphaned processes
- **Analyze button disabled**: "Analyze with {aiToolName}" button disabled while `isAnalyzing` is true
- **Post-import cleanup**: `IMPORT_ONBOARDING_RESULTS` handler now deletes `analysisResultsCache` and `activeAnalyses` entries after import
- **Auto-close on import**: Dialog closes automatically after "Apply Selected"

### Terminal Agent UX Enhancements (2026-03-07)

#### Reuse Idle Terminal for Agent Start
- **Sidebar.startAITool()**: Now checks if the active terminal has no agent running before creating a new one; sends command to existing idle terminal instead
- **New IPC**: `IS_TERMINAL_CLAUDE_ACTIVE` invoke channel — renderer can query per-terminal agent status from ptyManager
- **New setting**: `general.reuseIdleTerminal` (default: `true`) — toggle in Settings > General > Startup
- **Files**: `ipcChannels.ts`, `ptyManager.ts`, `Sidebar.tsx`, `settingsManager.ts`, `SettingsPanel.tsx`

#### Agent Status Broadcasting & Tab UX
- **ptyManager.broadcastClaudeStatus()**: Emits `CLAUDE_ACTIVE_STATUS` on active↔inactive transitions (previously defined but never sent)
- **TerminalArea**: Listens for `CLAUDE_ACTIVE_STATUS`, updates `useTerminalStore.claudeActive` per terminal
- **Auto-rename**: On agent start, fetches session name via `GET_TERMINAL_SESSION_NAME` and renames tab (skips user-renamed tabs)
- **Bot icon**: Pulsing green `Bot` icon shown in tab bar and grid cell headers when agent is active
- **Store**: Added `claudeActive?: boolean` to `TerminalInfo` and `setClaudeActive()` action
- **Files**: `ptyManager.ts`, `TerminalArea.tsx`, `TerminalTabBar.tsx`, `TerminalGrid.tsx`, `useTerminalStore.ts`

#### Agent Activity Full-View & Multi-Session Enhancements
- **Full-view support**: Added `'agentState'` to `FullViewContent` type in `useUIStore`, rendering in `TerminalArea`, and popout `Maximize2` button in `AgentStateView` panel header
- **Multi-session panel mode**: Panel shows up to 5 sessions (active first, then recent idle/completed) as clickable `SessionCard` buttons with ring highlight; timeline shows for selected/first-active session
- **Multi-session sidebar**: `SidebarAgentStatus` now filters to all active/busy sessions, shows count badge when >1, shows tool/name for single session
- **Session list enhancements (full-view)**: `SessionListItem` shows relative time ("2m ago"), current tool badge, step count with label; header shows active count badge
- **Detail pane**: Shows session start time in header
- **Files**: `useUIStore.ts`, `TerminalArea.tsx`, `AgentStateView.tsx`, `SidebarAgentStatus.tsx`

#### Session↔Terminal Correlation ("Jump to Terminal")
- **ptyManager.correlateSession()**: When a terminal transitions to claude-active, reads `agent-state.json` for the terminal's project, finds the most recently active unclaimed session by `lastActivityAt` timestamp
- **terminalSessionMap**: `Map<terminalId, sessionId>` maintained in ptyManager, cleaned up on terminal exit
- **CLAUDE_ACTIVE_STATUS payload**: Extended with optional `sessionId` field
- **useTerminalStore**: Added `claudeSessionId?: string` to `TerminalInfo`, set/cleared by `setClaudeActive()`
- **AgentStateView**: `jumpToTerminal(sessionId)` finds terminal by `claudeSessionId`, focuses it, closes full-view if open
- **UI**: `TerminalSquare` icon button on `SessionCard` (panel mode) and detail pane header (full-view mode) — only appears when a terminal correlation exists
- **Files**: `ptyManager.ts`, `ipcChannels.ts`, `useTerminalStore.ts`, `TerminalArea.tsx`, `AgentStateView.tsx`

### Pipeline Feature Overhaul (2026-03-07)

#### Configurable `with:` System
- **WorkflowStep.with**: Added `with?: Record<string, string>` to `ipcChannels.ts` WorkflowStep interface
- **StageContext.stepConfig**: Plumbed through from workflow YAML → pipelineManager → stage handlers
- **Supported keys**: `scope` (project|changes), `mode` (agent|print), `focus` (security|documentation|architecture|performance|testing|custom), `prompt` (full override)
- **Files**: `ipcChannels.ts`, `pipelineManager.ts`, `pipelineStages.ts`

#### Project-Level Context (`scope: project`)
- **getProjectContext()**: Assembles ~25KB context from git-tracked file tree (5KB), STRUCTURE.json (8KB), package.json summary, last 20 commits, key config files (CLAUDE.md, tsconfig, eslint, CHANGELOG — 3KB each)
- **getContextForScope()**: Routes to `getProjectContext()` or `getDiff()` based on `stepConfig.scope`
- Graceful skip with log message when no context available (empty diff or empty project)

#### Agent Mode (`mode: agent`)
- **spawnAIToolAgent()**: Spawns Claude CLI without `--print`, allowing autonomous multi-turn tool use (Read, Grep, Bash, etc.)
- **dispatchAITool()**: Routes to agent or print mode based on `stepConfig.mode`
- Uses `--output-format json --verbose` for structured output with progress logging
- Dramatically better for deep audits but slower/more expensive than print mode

#### Focus-Aware Prompts
- **buildFocusInstruction()**: Maps `stepConfig.focus` to specific review instructions
- All three AI stages (test, describe, critique) now adapt prompts for project vs changes scope
- Custom `stepConfig.prompt` fully overrides default prompt when set

#### Stage Handler Rewrites
- **runTestStage**: Uses `getContextForScope()` + `dispatchAITool()`, adapts for project/changes
- **runDescribeStage**: Project scope → "project overview/health description"; changes scope → "PR description"
- **runCritiqueStage**: Project scope → "thorough audit"; changes scope → "diff code review". Both produce comments + patches + summary

#### Claude CLI Fixes
- **Envelope unwrapping**: `spawnAITool()` now strips `{"type":"result","result":"..."}` wrapper from `--output-format json` output
- **Stdin prompt delivery**: `spawnAIToolRaw()` pipes prompt via `child.stdin.write()` instead of shell arg to avoid backtick/quote mangling
- **Simplified getDiff()**: Removed aggressive HEAD~5 progressive fallback; simple baseSha...headSha with HEAD~1 fallback

#### UI Improvements (PipelinePanel.tsx)
- **Scroll fix**: Replaced Radix Tabs (TabsList/TabsTrigger/TabsContent) with plain button tab bar + direct ScrollArea child — Radix Tabs injected `gap-2` and conditional mounting that broke the flex height chain
- **Sidebar scroll fix**: Removed wrapper `<div>` around runDetail so it's a direct flex child (matching TasksPanel flat layout)
- **Full-screen popout**: Maximize2 icon button in sidebar toolbar, calls `closeRightPanel()` then `setFullViewContent('pipeline')`
- **Re-run button**: RotateCcw icon, re-triggers the same workflowId with `trigger: 'manual'`
- **Delete button**: Trash2 icon, calls new `PIPELINE_DELETE_RUN` IPC channel
- **Log fallback**: PipelineLogView merges real-time events with persisted `stage.logs`

#### New IPC Channel
- **PIPELINE_DELETE_RUN** (`pipeline-delete-run`): Handle channel, accepts `{ runId, projectPath }`, cancels active run if needed, removes from allRuns map, persists to runs.json

#### New Workflow Templates
- **health-check.yml**: Updated — describe + critique now use `scope: project`, critique has `focus: architecture`
- **docs-audit.yml**: New — `npm run structure` sync check + critique with `scope: project, focus: documentation`
- **security-scan.yml**: New — `npm audit` + critique with `scope: project, focus: security`
- **Seeding**: `ensureWorkflowsDir()` in pipelineManager writes all three templates on first run

#### Hook (usePipeline.ts)
- Added `deleteRun` mutation with stable ref pattern (matching existing mutations)
- Clears `selectedRunId` when deleting the selected run
- Added `saveWorkflow` and `deleteWorkflow` mutations to `usePipelineWorkflows()` with query invalidation on success

#### Workflow Editor UI (WorkflowEditor.tsx)
- **Visual builder mode**: Workflow name, triggers (manual/push), job management, step cards with Framer Motion `Reorder` drag-to-reorder
- **Step cards**: Expand/collapse, stage type dropdown autofill (lint/test/describe/critique/freeze/push/create-pr/custom), `run:` command input, continue-on-error/approval toggles, timeout
- **AI config section**: Contextual for AI stages — scope (changes/project), mode (print/agent), focus (with datalist autofill), custom prompt
- **YAML mode**: CodeMirror 6 with YAML syntax, lazy-loaded via dynamic imports
- **Template presets**: Health Check, Docs Audit, Security Scan, Code Review, Blank
- **Form ↔ YAML**: Form→YAML is automatic on mode switch. **YAML→Form is intentionally one-way** — editing raw YAML and switching to form mode won't parse changes back (would require full YAML→state parser; users who edit YAML are expected to stay in YAML mode)
- **Delete confirmation**: AlertDialog confirmation before workflow delete
- **Dirty indicator**: `*` in dialog title when modified
- **Files**: `WorkflowEditor.tsx` (new), `PipelinePanel.tsx` (integration)

#### IPC Channels (Workflow CRUD)
- **PIPELINE_SAVE_WORKFLOW**: Validates filename (`.yml`, no path separators, no `..`), parses content via `parseWorkflow()`, writes to workflows dir
- **PIPELINE_DELETE_WORKFLOW**: Validates filename, deletes workflow file
- **WorkflowDefinition.filename**: New optional field, set by `listWorkflows()` — ensures edit doesn't create duplicate files when `name` differs from filename

#### Security Fixes
- **Shell injection in runPushStage**: Branch name validated with `^[a-zA-Z0-9._/-]+$` regex + `--` arg separator before `git push`
- **Shell injection in runCreatePrStage**: PR body written to temp file and passed via `--body-file` instead of shell interpolation; title sanitized (backticks, `$`, `"`, `\` stripped)
- **YAML injection in stateToYaml**: Added `yamlQuote()` helper that single-quotes values with special YAML chars (`:`, `#`, `{`, `[`, etc.) and YAML keywords (`true`, `false`, `null`, `yes`, `no`, etc.)

#### Reliability Fixes
- **Stage timeout enforcement**: `pipelineManager.ts` now wraps stage execution in `Promise.race()` with configurable timeout (default 600s, reads `step.timeout` from YAML). Prevents `spawnAIToolAgent()` from hanging indefinitely
- **Double refetch prevention**: Removed explicit `refetchWorkflows()` calls from PipelinePanel save/delete handlers; relies solely on TanStack Query `onSuccess` invalidation in the hook
- **Workflow seeding fix**: `ensureWorkflowsDir()` changed from one-shot directory creation to per-file idempotent seeding — new built-in workflows appear automatically for existing projects

#### Tests
- **pipelineWorkflowParser.test.ts** (11 tests): YAML parsing, validation errors, `with:` config preservation (JS reserved word round-trip), push triggers, job dependencies, run commands
- **workflowEditorUtils.test.ts** (12 tests): `yamlQuote` special chars/keywords/escaping, YAML serialization round-trip via `parseWorkflow()`, prompt with colons/quotes, approval options

### Terminal Grid & Usage Element Improvements (2026-03-05)

#### Terminal Grid Drag-to-Swap
- **Slot-based grid model**: Replaced sequential ordered-list model with `(string | null)[]` grid slots
  - Each cell index directly maps to a terminal ID or null (empty)
  - Supports sparse placement: empty cells can appear anywhere, not just at the end
  - Swap logic: simple array index swap works for all combos (filled↔filled, filled↔empty)
- **Draggable header bar**: Left section (grip + name) is the drag handle; right section has action buttons
  - Buttons have `p-1` padding + hover background for larger click target
  - Prevents accidental drags when clicking maximize/close
- **Terminal sync effect**: Rebuilds slots when terminals added/removed, preserving existing positions
- **Files**: `TerminalGrid.tsx` (rewritten grid model)

#### Usage Element Resilience
- **Stale-while-revalidate**: Backend preserves `cachedUsage` on errors; renderer preserves existing values
- **Cold start 429 handling**: Shows "Usage unavailable" with amber pulse indicator when API fails on first load
- **Contextual tooltips**: Different messages for 429 rate limit, 401 expired token, no OAuth token
- **Retry with backoff**: Backend retries twice (5s, 10s) on cold start transient errors
- **Files**: `claudeUsageManager.ts`, `TerminalTabBar.tsx`

#### Electron IPC Fixes
- **IPC sanitizer**: `sanitizeForIPC()` in `ipc.ts` strips `undefined` values from all `typedSend`/`typedInvoke` payloads
- **Terminal creation routing**: Menu Ctrl+Shift+T now dispatches CustomEvent through TerminalArea's `createTerminal()` guard
- **Structured clone fix**: CommandPalette and TerminalArea build payloads imperatively (no `undefined` properties)
- **Clone error root cause**: `TerminalGrid.tsx` had `onClick={onCreateTerminal}` passing React `MouseEvent` as the `shell` parameter — a non-cloneable object. Fixed with `onClick={() => onCreateTerminal()}` wrapper + `typeof shell === 'string'` guard in `createTerminal()`
- **Nested button fix**: Settings theme preset card changed from `motion.button` to `motion.div` with `role="button"`
- **Files**: `ipc.ts`, `App.tsx`, `TerminalArea.tsx`, `TerminalGrid.tsx`, `CommandPalette.tsx`, `SettingsPanel.tsx`

#### Hook Path Fix
- **Root cause**: Hook commands in `.claude/settings.json` used relative paths (`node .subframe/hooks/stop.js`). When CWD was a subdirectory like `promo/`, the path resolved to `promo/.subframe/hooks/stop.js` which doesn't exist
- **Fix**: All hook commands now use `$(git rev-parse --show-toplevel)` to anchor paths to the repo root
- **Files**: `.claude/settings.json`

#### Grid Pane-Targeted Terminal Creation
- **Pending slot ref**: `TerminalGrid.tsx` tracks which empty pane was clicked via `pendingSlotRef`
- **Priority assignment**: Slot rebuild effect fills the pending slot first before falling back to first-available
- **One-shot**: Ref is cleared after use, so only the immediate next terminal goes to the targeted pane
- **Files**: `TerminalGrid.tsx`

---

### Added
- **Pipeline system** — Configurable CI/review pipelines with AI-powered stages
  - Pipeline execution engine with topological job sort (Kahn's algorithm), sequential stage execution, freeze semantics, approval gates, and AbortController cancellation
  - 8 built-in stage handlers: lint, test, describe, critique, freeze, push, create-pr, custom
  - YAML workflow configuration (GitHub Actions-inspired) in `.subframe/workflows/*.yml`
  - Typed artifact system: ContentArtifact (markdown), CommentArtifact (file:line anchored), PatchArtifact (unified diffs)
  - 13 typed IPC channels for pipeline management
  - TanStack Query hooks (`usePipeline`, `usePipelineWorkflows`, `usePipelineProgress`) with send/on pattern
  - Pipeline panel (side-panel + full-view) with toolbar, run list, and 4-tab detail view (Overview, Critique, Patches, Log)
  - Animated PipelineTimeline component with stage nodes, status colors, and progress bar
  - 3 seeded workflow templates: review (pre-push + manual), task-verify (manual), health-check (manual)
  - Pre-push git hook trigger — writes trigger file that pipeline engine watches and auto-starts push-enabled workflows
  - Pipeline category in SubFrame Health panel — tracks workflows dir and template files
  - Project initialization seeds `.subframe/workflows/` with 3 default templates and `.githooks/pre-push`
  - Keyboard shortcut: Ctrl+Shift+Y for pipeline panel/full-view toggle
  - Run persistence to `.subframe/pipelines/runs.json` with 50-run cap
- **Enhanced Settings Panel** — Expanded from 3 tabs to 5 (General, Terminal, Editor, AI Tool, Updates)
  - Terminal: font family, line height, cursor blink/style, default shell, bell sound, copy on select
  - Editor (new tab): font family, line numbers, bracket matching, tab size, theme selector
  - Updates (new tab): auto-check toggle, pre-release channel (auto/always/never), check interval, manual check
  - General: added confirm-before-close toggle
  - Backend consumers updated: updaterManager reads settings dynamically, ptyManager uses configured shell
  - Live settings application: terminal options passed to registry, editor uses compartment-based reconfiguration
- **Workspace-scoped terminal state** — Terminal layout now properly saves and restores per-project
  - Grid layout saved per-project (was global)
  - Tab reorder persisted across project switches
  - activeByProject restored on app restart
  - Maximized terminal state saved per-project session
  - Workspace switch auto-selects first project in new workspace (was keeping stale project)
  - Empty project sessions saved correctly (clears stale data)
- **Conversation-name terminal tabs** — Terminal tabs auto-detect Claude session names
  - New IPC channel `GET_TERMINAL_SESSION_NAME` bridges claudeSessionsManager to terminal tabs
  - Name priority: friendlyName > customTitle > firstPrompt > slug
  - `nameSource` field on TerminalInfo tracks origin ('default' | 'user' | 'session')
  - Right-click context menu enhanced: Rename, Refresh Name, Reset Name, Close
- **Electron menu bar** — Proper File and View menus following standard editor conventions
  - File menu: New Terminal, Close Terminal, Open Project, Settings, Exit
  - View menu: Toggle Sidebar, Toggle Right Panel, Reset Layout, zoom controls, fullscreen, dev tools
  - Menu actions dispatch through proper channels (IPC events handled in App.tsx/TerminalArea.tsx)
- **Sidebar collapse** — Removed floating icon on full sidebar hide; menu bar provides recovery path
- **Enhanced Prompts Panel** — Full management UI in the side panel
  - Inline editor (expand-in-place) replaces modal dialog for editing
  - Tag-click filtering with filter bar showing all unique tags
  - Sort dropdown (most used / recently updated / alphabetical)
  - Collapsible categories with rename support (batch-updates all prompts in category)
  - `{{variable}}` highlighting in content preview (accent-colored)
  - Variable insert buttons (`{{project}}`, `{{projectPath}}`, `{{file}}`) below content textarea
  - Keyboard navigation (Arrow keys, Enter to insert, `e` to edit)
  - Delete confirmation dialog (both PromptsPanel and PromptLibrary)
  - Shared utilities extracted to `src/renderer/lib/promptUtils.ts`

### Fixed
- **Ctrl+Shift+T terminal creation** — Fixed guard ref getting permanently stuck when IPC reply missed during React re-render; added 5s safety timeout and error toast
- **Ctrl+Tab terminal switching** — Focus now explicitly follows the active terminal after switching via keyboard shortcut or tab click (50ms post-render focus)
- **Toast notification audit** — Added proper user feedback across 14 components:
  - AIFilesPanel: moved false-positive toasts to onSuccess callbacks
  - GithubPanel: fixed worktree remove/branch delete false-positive success toasts
  - WorkspaceSelector: added error handling to all 4 workspace operations
  - Sidebar: added feedback for project initialization and AI tool start failure
  - Editor: added error toast for file save failure
  - FileTree, SessionsPanel, SkillsPanel, OnboardingDialog, ProjectList: added missing feedback
- **Pre-release audit fixes**
  - Fixed stale closure in `TERMINAL_DESTROYED` handler — now reads store directly via `getState()`
  - Fixed stale `normalizedPath` in `closeTerminal` callback — reads `currentProjectPath` from store
  - Fixed orphaned `TERMINAL_CREATED` listener leak in Sidebar `startAITool` — uses `ipcRenderer.once`
  - Removed debug `console.log` statements from `menu.ts`
  - Fixed 3 unused import warnings (menu.ts, SettingsPanel, Sidebar)
- **Terminal grid UX improvements** — Keyboard shortcuts, resize persistence, improved handles, maximize-in-place
  - `Ctrl+G` shortcut to toggle grid/tab view (also shown in command palette + keyboard shortcuts help)
  - Command palette: "Next Grid Layout" / "Previous Grid Layout" cycle through all 8 layouts
  - Grid resize persistence: custom column/row sizes saved per layout to localStorage, restored on layout switch
  - Wider resize handles (4px hit area) with visible hover indicator line (accent-colored)
  - Maximize-in-place: Focus button and double-click header expand a single cell to fill the grid area
  - `Esc` un-maximizes before navigating full-view overlays (priority chain)
  - `Minimize2` icon + "Restore grid" button in maximized cell header
  - Maximize state auto-clears on layout change
- **Template version detection for AGENTS.md** — Version-based upgrade detection without requiring exact content match
  - `AGENTS_TEMPLATE_VERSION` constant + `<!-- subframe-template-version: N -->` marker in template output
  - New `templateVersion` field in health registry (fourth check mode alongside existenceOnly, getTemplate, specialCheck)
  - Version extraction via regex; missing marker = version 0 (old file); `>=` comparison for forward compatibility
  - Update handler creates `.bak` backup, reads project name from config.json, regenerates from current template
  - 4 new tests: no marker → outdated, current → healthy, old → outdated, future → healthy
- **Terminal scroll-to-bottom button** — Floating animated button when scrolled up in terminal
  - DOM viewport scroll detection via `.xterm-viewport` element (reliable across WebGL/Canvas/DOM renderers)
  - Theme pulse animation on first appear (accent-colored ring radiates outward via Framer Motion boxShadow keyframes)
  - Live output overlay showing last 3 lines when scrolled up + new output arriving
  - Dynamic positioning: `bottom-20` when overlay visible, `bottom-4` otherwise
- **Grid view empty cell placeholders** — Unfilled grid slots show "New Terminal" action instead of blank space
  - Dashed circle + icon with hover accent highlight, shortcut hint (Ctrl+Shift+T)
- **Universal scrollbar theming** — Consistent thin scrollbars across entire app
  - Global CSS `*` selector rules for webkit and Firefox scrollbars (rgba white 8%/18% hover)
  - Radix ScrollArea thumb themed to match (`bg-white/[0.08]`)
  - Removed fragmented `.scrollbar-thin` utility class from 7 components
  - Converted raw `overflow-y-auto` divs to `<ScrollArea>` in SessionsPanel, MarkdownPreview
- **Command palette shortcut** in empty terminal state (`Ctrl+/`)
- **Start AI button** dims when no project selected (disabled + muted styling)
- **Contextual empty state message** — "Select a project to get started" vs "No terminals for this project"
- **Right panel scroll fixes** — Collapsed icon strip scrollable (`overflow-y-auto`), expanded tab groups scrollable (`overflow-x-auto`)
- **Ctrl+G** keyboard shortcut to toggle grid/tab view
- **Terminal maximize** in grid view — Escape to un-maximize

### Fixed
- **6 lint errors** — `no-control-regex` in ptyManager + Terminal ANSI regexes (eslint-disable), ternary side-effect → if/else
- **Scroll-to-bottom detection** — Replaced unreliable xterm buffer API (`buf.baseY`) with DOM viewport `scrollTop`/`scrollHeight`/`clientHeight`

- **Rich task editing** — Enhanced TasksPanel create/edit dialog with structured content
  - Steps/Checklist editor: add, reorder (up/down), delete, toggle completion directly in dialog
  - Form/Markdown toggle: switch between structured form and raw markdown editing modes
  - Bidirectional conversion between form fields and markdown body (mirrors `taskMarkdownParser.ts` format)
  - "From Template" quick-fill button pre-populates description, steps, acceptance criteria, notes
  - Collapsible "Advanced" section exposes Acceptance Criteria and Notes fields
  - Rich markdown rendering in TaskDetail expanded rows (description, criteria, notes rendered via `react-markdown` + `remark-gfm`)
  - Dialog auto-sizes: `sm:max-w-lg` in form mode, `sm:max-w-2xl` in markdown mode
- **Git status integration** — Real-time file tree indicators and sidebar status bar
  - `getGitStatus()` in `gitBranchesManager.ts`: parses `git status --porcelain`, branch, ahead/behind
  - `useGitStatus` hook with 5-second polling interval
  - `FileTree.tsx`: per-file status letters (M/A/D/U/R/!) with color-coding (green=staged, yellow=modified, red=deleted/conflict, gray=untracked), directory change dot indicators
  - `Sidebar.tsx`: `GitStatusBar` component showing branch name, ahead/behind arrows, staged/modified/untracked counts
  - Merge conflict detection (`UU`, `AA`, `DD`) shows red `!` indicator
  - New IPC channel: `LOAD_GIT_STATUS`
- **Command palette** (`Ctrl+/`) — Quick access to all actions, panels, views, and settings
  - `CommandPalette.tsx`: cmdk-based dialog with fuzzy search
  - Groups: Panels (9), Views (5), Terminal (2), Sidebar (3), Settings (3 incl. What's New)
  - All actions wired to existing store methods with keyboard shortcut display
- **Prompt library** (`Ctrl+Shift+L`) — Saved prompts with fuzzy search and terminal insert
  - `promptsManager.ts` (main process): CRUD for `.subframe/prompts.json`
  - `usePrompts` hook (TanStack Query): wraps LOAD_PROMPTS, SAVE_PROMPT, DELETE_PROMPT channels
  - `PromptLibrary.tsx`: command palette overlay with category grouping, inline edit/delete, copy to clipboard
  - Template variables: `{{project}}`, `{{projectPath}}` resolved on insert
  - Usage frequency tracking for smart sorting
  - 3 new IPC channels: `LOAD_PROMPTS`, `SAVE_PROMPT`, `DELETE_PROMPT`
- **What's New dialog** — Auto-shows after version updates, accessible via command palette
  - `WhatsNew.tsx`: reads bundled `RELEASE_NOTES.md`, renders via `MarkdownPreview`
  - Tracks `lastSeenWhatsNew` in settings to auto-show once per version
  - New IPC channel: `GET_RELEASE_NOTES`
- **Auto-updater** — Electron auto-update with status notifications
  - `updaterManager.ts` (main process): electron-updater integration
  - `UpdateNotification.tsx`: renders update status notifications
  - 5 new IPC channels: `UPDATER_CHECK`, `UPDATER_STATUS`, `UPDATER_DOWNLOAD`, `UPDATER_INSTALL`, `UPDATER_PROGRESS`
- **Claude Code detection** — Detects when Claude Code is active in a terminal
  - Rolling output buffer per terminal with 7 regex patterns (ANSI title, spinner, cost display, etc.)
  - 8-second inactivity timeout for active→inactive transitions
  - Green pulsing dot on terminal tabs when Claude is detected
  - New IPC channel: `CLAUDE_ACTIVE_STATUS`
- **Session-based prompt logging** — Only logs prompts when Claude Code is active
  - Per-terminal input buffers in `promptLogger.ts`
  - Logging gated by `isClaudeActive()` in PTY input handler
- **TasksPanel smart sorting** — Multi-sort, smart default filter, persisted sort state
  - Smart default filter: auto-selects "In Progress" or "Pending" based on current tasks
  - Custom sort functions for Priority (high-first) and Status (in-progress-first)
  - Shift+click for multi-column sort (TanStack Table v8)
  - Sort/filter state persisted in Zustand store across panel switches
- **AI Tool Start tooltip** — Hover "Start Claude Code" button shows effective command
  - Displays custom command override when configured in Settings
- **STRUCTURE.json improvements** — Better description extraction and call graph
  - `extractDescription()` handles JSDoc, CRLF, multi-line descriptions
  - `buildCallGraph()` finds 448 call edges across 98 modules

### Fixed
- **Merge conflict status** in FileTree — `UU`/`AA`/`DD` git statuses now correctly show red `!` conflict indicator (was falling through to green "Staged")

---

- **Code editor enhancements** — CM6 compartment-based runtime settings
  - Minimap toggle (default off), word wrap, font size +/- (8–24px), fullscreen mode (F11)
  - Theme switcher: SubFrame Dark (default), SubFrame Light, High Contrast — via dropdown
  - Status bar with cursor position (Ln/Col), total lines, UTF-8 indicator
  - Color-coded save status (Ready/Modified/Saving/Saved/Error) with descriptive tooltips
  - Relative file path in header (strips project root)
  - All preferences persisted via `editor` settings block in `settingsManager.ts`
- **Version display in sidebar** — SubFrame / BETA / v0.1.0-beta.1 stacked layout
  - Pre-release badge auto-detected from SemVer tag, hidden for stable versions
  - Version read from `package.json` at runtime
- **Claude Code skills deployment** — `/sub-tasks`, `/sub-docs`, `/sub-audit` skills deployed to `.claude/skills/` during project init
  - Skills tracked as new `'skills'` category in SubFrame Health panel (18 total components across 5 categories)
  - Deployed `/sub-tasks` uses direct `.subframe/tasks/*.md` file manipulation (no CLI dependency)
  - `/sub-docs` and `/sub-audit` generalized for any SubFrame-managed project
  - Content-comparison health checks — "Outdated" badge + update button when templates change
  - "Remove Claude skills" uninstall option in health panel
  - Overview panel `HealthCard` updated with Skills row
  - AI Files panel `.claude/` section updated to reflect skill deployment
- **Skills panel** — Browse and run Claude Code skills from the right panel
  - `skillsManager.ts` (main process): scans `.claude/skills/` for SKILL.md files, parses YAML frontmatter, compares managed skills against templates for health status
  - `useSkills` hook (TanStack Query): wraps `LOAD_SKILLS` IPC channel
  - `SkillsPanel` component: expandable cards with `/command`, description, health badges, allowed-tools chips, "Run" button (types command into terminal), full SKILL.md content on expand
  - New IPC channel: `LOAD_SKILLS` (handle pattern)
- **Right panel regrouping** — Agent hub consolidates Activity, Sessions, History, Plugins, Skills into one tabbed group
  - `Ctrl+Shift+A` moved from full-view overlay to right-panel toggle (Agent group, Activity tab)
  - Agent Activity full-view overlay removed from TerminalArea
  - Sessions navbar button removed (accessible via Agent group tabs)
  - "Agent Activity" label shortened to "Activity" for tab width
- **Agent timeline reversed** — Newest steps now appear at top, oldest at bottom (auto-scrolls to top on new steps)
- **Real-time agent state visualization** — Live monitoring of Claude Code agent sessions in SubFrame
  - `agentStateManager.ts` (main process): watches `.subframe/agent-state.json` via `fs.watch`, 200ms debounce, dedup by `lastUpdated` timestamp
  - `agentStateTypes.ts` (shared): typed data contract — `AgentStep`, `AgentSession`, `AgentStatePayload`
  - `useAgentState` hook (TanStack Query): send/on IPC pattern with race-condition-safe listener registration
  - `AgentStateView` component: panel mode (compact session card + timeline) and full-view mode (session list + detail)
  - `AgentTimeline` component: vertical stepper with Framer Motion animations, status icons, relative timestamps, auto-scroll
  - `SidebarAgentStatus` component: pulsing green dot + current tool name in sidebar footer
  - Claude Code hooks (`.subframe/hooks/pre-tool-use.js`, `post-tool-use.js`): write running/completed steps to agent-state.json
  - 4 new IPC channels: `LOAD_AGENT_STATE`, `AGENT_STATE_DATA`, `WATCH_AGENT_STATE`, `UNWATCH_AGENT_STATE`
  - Keyboard shortcut: `Ctrl+Shift+A` for Agent Activity panel
  - AI-agnostic port: hooks are Claude-specific adapters, renderer only depends on the generic `agent-state.json` format
- **Markdown-based task system** — Tasks migrated from single `tasks.json` to individual `.md` files with YAML frontmatter
  - Each task lives at `.subframe/tasks/<id>.md` — human-editable with syntax highlighting + markdown preview
  - `tasks.json` becomes an auto-generated index (backward-compatible with hooks)
  - New `taskMarkdownParser.ts` module with `parseTaskMarkdown()` / `serializeTaskMarkdown()` (gray-matter)
  - Full round-trip fidelity: unknown markdown sections preserved through parse → serialize cycles
  - New fields: `blockedBy[]`, `blocks[]`, `steps[]` (TaskStep: label + completed)
  - Schema version bumped from 1.1 → 1.2
- **Task dependency tracking** — `blockedBy` / `blocks` fields with visual dependency badges
  - Red "Blocked by" badges and amber "Blocking" badges in task detail view
  - "Blocked" status filter shows tasks with incomplete blockers
  - Derived `blockedTaskIds` set in `useTasks` hook
- **Task step/checklist tracking** — `## Steps` section with `- [x]` / `- [ ]` checkboxes
  - `TaskTimeline` component: horizontal stepper with Framer Motion animations
  - Compact progress bar mode for >7 steps, full stepper for ≤7
  - Interactive: click circles to toggle step completion (updates .md file)
  - Step progress count ("2/5") shown inline in task table rows
- **Task dependency graph** — React Flow v12 + dagre auto-layout (replaces D3 force-directed)
  - `TaskGraph` component: card-style nodes with title, status badge, priority dot, step progress bar
  - Hierarchical DAG layout via dagre (TB in full-view, LR in sidebar)
  - Smooth-step edges with arrow markers, animated for in-progress blockers
  - SubFrame dark theme via React Flow CSS variable overrides
  - Zoom, pan, draggable nodes, controls panel
  - Works in both sidebar and full-view modes (`compact` prop)
- **Kanban board view** — Status-grouped columns for task management
  - `TaskKanban` component: 4 columns (In Progress, Pending, Blocked, Completed)
  - Full-view: horizontal columns side by side with scroll
  - Sidebar/compact: vertical stacked sections with collapsible groups
  - Animated task cards with expandable detail (description, dependencies, actions)
  - Full action buttons on expanded cards (start, complete, pause, reopen, delete, open in editor, send to terminal)
- **3-way view toggle** — List / Kanban / Graph available in both sidebar and full-view (previously graph was full-view only)
- **"Open in Editor" button** — Opens task .md file in SubFrame's CodeMirror editor
- **Migration script** — `scripts/migrate-tasks-to-md.js` converts existing tasks.json to individual .md files
- **CLI enhancements** — New commands: `open <id>`, flags: `--blocked-by`, `--blocks`, `--add-step`, `--complete-step`, `--id`
- **CodeMirror 6 editor** — Replaced plain textarea with full-featured code editor
  - Syntax highlighting for 20+ languages (JS/TS, JSON, CSS, HTML, Markdown, Python, YAML, XML, Rust, C/C++, Java, PHP, SQL, Sass, Less, Vue, WAST)
  - Custom SubFrame dark theme matching the app's design system
  - Minimap (via @replit/codemirror-minimap)
  - Autocomplete, find/replace, multi-cursor editing
  - Code folding, bracket matching, active line highlighting
  - JSON syntax linting for .json files
  - Line numbers, indent guides, selection highlighting
  - New lib modules: `codemirror-theme.ts`, `codemirror-extensions.ts`
- **File preview system** — VS Code-style preview modes for supported file types
  - **Markdown preview** — Rendered markdown with GFM support (tables, task lists, strikethrough) via react-markdown + remark-gfm, syntax-highlighted code blocks via highlight.js with SubFrame theme
  - **HTML/CSS preview** — Live HTML rendering via sandboxed iframe (srcdoc), CSS files wrapped in sample HTML scaffold, deferred updates via useDeferredValue
  - **SVG preview** — Dual-mode: code editor (XML syntax) + visual preview with zoom/pan
  - **Image preview** — Binary images (PNG, JPG, GIF, WebP, AVIF, etc.) with zoom/pan via react-zoom-pan-pinch, checkered transparency background, file size display
  - **Code/Preview toggle** — Pill toggle in editor header for previewable files (md, html, css, svg)
  - **Two-phase image IPC** — READ_FILE_IMAGE channel loads binary images as base64 data URIs
  - New components: `MarkdownPreview.tsx`, `HtmlPreview.tsx`, `ImagePreview.tsx`
  - Binary file detection: blocks opening of archives, executables, fonts, etc.
  - Read-only mode: detects unwritable files, disables editing
- **Project onboarding & AI analysis pipeline** — Detects existing project intelligence files, runs AI analysis through a visible terminal tab, parses results, and imports into SubFrame spec files
  - `onboardingManager.ts` (main process): detection, context gathering, prompt building, terminal-based analysis pipeline, JSON parsing, non-destructive imports
  - `OnboardingDialog.tsx` (renderer): three-step dialog — detection summary → analysis in progress → results review with selective import
  - `useOnboarding` hook (TanStack Query): wraps detect/analyze/import IPC with progress event streaming
  - 5 new IPC channels: `DETECT_PROJECT_INTELLIGENCE`, `RUN_ONBOARDING_ANALYSIS`, `IMPORT_ONBOARDING_RESULTS`, `CANCEL_ONBOARDING_ANALYSIS`, `ONBOARDING_PROGRESS`
  - `/onboard` Claude Code skill deployed to `.claude/skills/onboard/` — standalone CLI onboarding
  - `INTELLIGENCE_FILES` constant: 20+ detection targets across 4 categories (ai-config, project-metadata, documentation, dev-config)
  - Reusable `runAnalysisInTerminal()` pipeline core — visible terminal, temp file prompting, sentinel-based completion, ANSI stripping
  - Windows compatibility: Git Bash detection (`findBashShell`), Unix path conversion, graceful error when no bash found
  - AI tool pre-flight check: verifies tool is installed before starting analysis
  - Configurable analysis timeout via `onboarding.analysisTimeout` setting (default 120s)
  - Health panel registration: `/onboard` skill tracked with content-comparison health checks
  - Sidebar integration: auto-detect after SubFrame init, "Re-analyze Project" button for existing projects

### Fixed
- **`filePath` leaked into `tasks.json` index** — `regenerateIndex()` now strips `filePath` and `_unknownSections` before writing, matching CLI behavior
- **Watcher dedup broken** — `lastWatchedHash` compared `lastUpdated` timestamp which was regenerated fresh every call; replaced with content-based fingerprint (`computeTasksFingerprint`)
- **Empty `id` from missing frontmatter** — `parseTaskMarkdown()` now derives ID from filename via `path.basename(filePath, '.md')` instead of defaulting to `''`
- **`completedAt` not cleared on reopen** — `updateTask()` now nulls out `completedAt` when a completed task is moved back to pending/in_progress
- **Health panel checked `tasks.json`** instead of `tasks/` directory — registry entry updated to use `FRAME_TASKS_DIR`
- **Health panel uninstall warning** referenced `tasks.json` as user data — updated to `.subframe/tasks/*.md`
- **`checkExistingFiles()` missed `tasks/` directory** — added to file check list in `projectInit.ts`
- **QUICKSTART template missing `tasks/`** in project structure tree — added `tasks/` directory and `<id>.md` entry
- **`regenerateIndex()` mutated caller's object** — now builds a clean copy (`indexData`)
- **`substr()` deprecated** in task ID generation — replaced with `substring(2, 11)`
- **`chore` missing from category enum** — added to AGENTS.md, frameTemplates.ts taskSchema, and getAgentsTemplate()
- **`research` orphaned category** — replaced with `chore` in frameTemplates.ts categories map (research was never in the enum)
- **Category shown as plain text** in TaskKanban and TaskGraph — now uses styled `Badge` with `CATEGORY_COLORS`/`CATEGORY_SHORT` matching TasksPanel list view
- **Health test missing `skills` category** — test assertions and `deployFullProject()` updated for 3 new skill registry entries

---

## 2026-03-01 — Overview Panel Enhancements & UI Polish

### Overview Panel
- **Stats Hero section** — Dedicated full-width hero above the card grid with 4-column layout (LOC, Source Files, Commits, Branch), refresh button, click-through to detail view
- **Stats Detail View** (`StatsDetailView.tsx`) — Full-view panel with LOC breakdown by extension (proportional bars), git info section, refresh
- **Decisions Detail View** (`DecisionsDetailView.tsx`) — Full-view panel with complete decisions list from PROJECT_NOTES.md (increased backend limit from 10 → 50)
- **DecisionsCard** now clickable → opens Decisions detail view
- **Sub-Tasks full view** — Maximize button in TasksPanel sidebar opens full-view tasks (closes sidebar first)

### Sidebar
- **Animated logo** — Replaced static SVG with `getLogoSVG()` animated version (56px expanded, 36px collapsed)
- **Settings in collapsed view** — Settings icon now opens settings directly without expanding sidebar first
- **Ctrl+B cycles 3 states** — `expanded → collapsed → hidden → expanded` (was toggle between 2)

### Keyboard Shortcuts
- **Ctrl+T → Ctrl+Shift+S** — Remapped Sub-Tasks shortcut to avoid conflicting with Claude Code's built-in Ctrl+T (todos). Updated across App, TerminalTabBar, RightPanel, KeyboardShortcuts, QUICKSTART.md

### Terminal Area
- **Enhanced empty state** — Animated logo, keyboard shortcuts grid (Ctrl+Shift+T, Ctrl+B, Ctrl+Shift+O, Ctrl+?), clickable "All Shortcuts" link

### SubFrame Health Panel
- **Uninstall moved to top** — Collapsible uninstall section now appears above component groups for easier access

### Build System
- **esbuild platform change** — Switched from `platform: 'node'` to `platform: 'browser'` + `format: 'iife'` for the renderer bundle
  - Fixes `style-mod.js` collision with read-only `window.top` (IIFE scoping)
  - Fixes `@lezer/highlight` initialization order bug (ESM live bindings vs CJS snapshots)
  - `external: ['electron']` preserves `require('electron')` for Electron's nodeIntegration

### Internal
- Extended `FullViewContent` type: added `'stats'` and `'decisions'` variants
- TerminalArea refactored title mapping from nested ternary to `Record<string, string>` lookup
- STRUCTURE.json regenerated (74 modules)

---

## 2026-03-01 — SubFrame Project Enhancement Lifecycle

### Install
- Project init now deploys Claude Code hooks: `.subframe/hooks/session-start.js`, `prompt-submit.js`, `stop.js`
- Init merges hook configuration into `.claude/settings.json` (preserves existing settings)
- New `claudeHooks` init option (default `true`) — hooks are deployed alongside git hooks
- Both `.ts` and `.js` (CJS fallback) init chains updated

### Status (Health Panel)
- New `subframeHealth.ts` module: component registry (15 entries, 4 categories) + health checking
- `claudeSettingsUtils.ts`: safe read/write/merge/remove of `.claude/settings.json`
- Overview panel shows HealthCard with healthy/total count and per-category breakdown
- New SubFrame Health right panel: per-component status (Healthy/Outdated/Missing), Update buttons

### Update
- Content comparison for hooks/git files detects outdated deployments
- Per-component and "Update All" regeneration from templates
- Claude settings re-merge for hook config updates

### Uninstall
- Safe removal with dry-run preview
- Granular options: Claude hooks, git hooks, backlinks, AGENTS.md, .subframe/ directory
- User data files (tasks.json, PROJECT_NOTES.md) preserved with warnings
- Workspace status updated after uninstall

### Testing
- 38 new tests: `claudeSettingsUtils.test.ts` (23 tests), `subframeHealth.test.ts` (16 tests)
- Vitest config: `resolve.extensions` prioritizes `.ts` over stale `.js` during tests
- All 75 tests pass, 0 errors

### CJS Sync
- `frameConstants.js` synced: added `SUBFRAME_HOOKS_DIR` and 4 new `FRAME_FILES` entries
- `frameTemplates.js` synced: 4 new template functions, pre-commit TS extension fix, ESM import parsing
- `projectInit.js` synced: Claude hooks deployment logic
- New `claudeSettingsUtils.js`: CJS fallback for CLI init chain

---

## 2026-03-01 — Quality Infrastructure & Documentation Overhaul

### Quality & Testing
- Vitest test suite: 36 tests across 2 suites (`tests/shared/backlinkUtils.test.ts`, `tests/shared/frameConstants.test.ts`)
- ESLint 9 + TypeScript-ESLint configured (`eslint.config.mjs`) — pinned to ESLint 9 (react-hooks plugin peer dep)
- Prettier configured for consistent formatting (`.prettierrc`)
- GitHub Actions CI workflow (typecheck + lint + test on push/PR) — uses `--ignore-scripts` to skip native modules
- Pre-commit hook updated: runs `npm run typecheck` before allowing commits, includes skip hint
- `tsconfig.test.json` added so test files are type-checked
- New scripts: `npm test`, `npm run lint`, `npm run check` (all quality gates)

### Code Review Fixes
- `vitest.config.ts`: fixed `__dirname` (CJS) → `fileURLToPath` (ESM)
- `update-structure.js`: function regex handles TypeScript generics `<T>`, `isExcluded` uses path segment matching, `getDeletedFiles` filters excluded paths
- `frameConstants.js` synced with `.ts` (CJS fallback had diverged — missing `path.join` prefixes and `DOCS_INTERNAL` key)
- `workspace.ts`: `let baseSlug` → `const baseSlug` (was only ESLint error)

### Documentation
- `docs-internal/refs/ipc-channels.md` regenerated: 93 → 112 channels (19 were missing), all patterns verified against type maps
- `docs-internal/` populated: 6 ADRs, architecture overview, changelog, IPC reference
- CLAUDE.md updated with quality tooling commands and `docs-internal/` reference
- PROJECT_NOTES.md updated with session decisions (Vitest, ESLint 9, CI strategy, ADR adoption)
- STRUCTURE.json regenerated: 65 → 66 modules (after review fixes)

---

## 2026-03-01 — React + TypeScript Refactor & Documentation Overhaul

### Architecture
- Full renderer refactor from vanilla JS to React 19 + TypeScript (strict)
- Zustand stores replace global state variables (`useUIStore`, `useProjectStore`, `useTerminalStore`)
- TanStack Query replaces manual IPC data fetching with cached hooks
- Tailwind CSS v4 replaces 7,158 lines of hand-written CSS
- shadcn/ui components replace custom HTML elements
- Framer Motion added for panel animations

### Main Process
- All 20 manager modules converted from JavaScript to TypeScript
- Same `init()` + `setupIPC()` pattern preserved
- Typed IPC channels via `ipcChannels.ts`

### Tooling
- `update-structure.js` updated to parse TypeScript `import`/`export` syntax
- STRUCTURE.json now includes renderer components, hooks, stores, and lib modules (65 total, up from 6)
- Architecture entry points auto-detected (`.ts`/`.tsx`)
- `npm run watch` added for React-only development

### Documentation
- `docs-internal/` populated with 6 ADRs, architecture overview, and this changelog
- CLAUDE.md updated with missing modules (`KeyboardShortcuts`, `HistoryPanel`, `useIPCListener`, `backlinkUtils`, `lib/`)
- STRUCTURE.json description updated from "Claude Code IDE" to "SubFrame"

---

## 2026-02-28 — CLAUDE.md Rearchitecture (Symlinks → Backlinks)

### Architecture
- Replaced symlink approach (`GEMINI.md → AGENTS.md`) with backlink injection
- `backlinkUtils.ts` created to programmatically inject/update backlink blocks
- `<!-- SUBFRAME:BEGIN --> ... <!-- SUBFRAME:END -->` markers in CLAUDE.md and GEMINI.md
- Each tool-specific file can now have custom content alongside shared SubFrame rules

---

## 2026-02-16 — Sessions Tab & SubFrame Server Planning

### Features
- Claude Sessions tab added to right panel (scans `~/.claude/projects/` for `.jsonl` files)
- Session state detection: active (< 2 min), recent (< 1 hour), inactive
- Split resume button with dropdown (default tool, claude, claude --continue, custom)
- Collapsible right panel (44px icon strip mode)

### Planning
- SubFrame Server (browser mode) technical architecture defined
- Transport layer abstraction designed (IPC ↔ WebSocket)

---

## 2026-02-08 — Gemini CLI Integration

### Features
- Gemini CLI added as supported AI tool
- GEMINI.md created with backlink to AGENTS.md
- Menu commands for Gemini (Memory, Compress Context, Settings)

### Infrastructure
- Node.js minimum version bumped to 20 (required by Gemini CLI's `string-width` dependency)

---

## 2026-02-05 — AI Tool Context Injection

### Architecture
- Wrapper script system created (`.subframe/bin/`)
- Codex CLI wrapper sends "Read AGENTS.md" as initial prompt
- Framework for adding new AI tool wrappers

---

## 2026-01-25 — Project Navigation System

### Features
- `STRUCTURE.json` auto-updater (`scripts/update-structure.js`)
- Intent index for fast module lookup by feature name
- `find-module.js` CLI for quick file discovery

---

## 2025-12-01 — Initial Release (v0.1.0-beta.1)

### Core
- Electron-based terminal IDE for Claude Code
- Multi-terminal support (tabs + grid layout)
- File explorer with tree view
- Code editor (Monaco-based)
- SubFrame project system (STRUCTURE.json, tasks.json, PROJECT_NOTES.md)
- Sub-task management CLI (`scripts/task.js`)
- Plugin system
- GitHub integration panel
- AI Files panel
- Prompt history logging
- Keyboard shortcuts system
- Settings panel with persistence
