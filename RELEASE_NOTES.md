Patch release fixing session control, update notifications, and developer workflow.

## What's Changed

### Bug Fixes
- **Session control — both sides reported "you have control"** — the web client's Zustand store detected its side via `getTransport()` which throws before transport is initialized, defaulting to `isElectronSide=true`. Now uses the build-time `__SUBFRAME_WEB__` constant
- **Session control — WS origin detection** — IPC router's routed events were indistinguishable from real Electron events (`_event !== null` was always true). Added `__wsRouted` marker and `isWSEvent()` helper
- **Update toast disappearing on Download click** — sonner's action button auto-dismisses the toast; the async `downloading` status arrived too late. Now shows an immediate loading toast and always shows error toasts for download/install failures
- **Workspace pill badge clipping** — terminal count badges were cut off by `overflow-y-hidden` on the pill container. Changed to `overflow-visible`
- **Web server static files returning HTML** — added debug logging to `serveStatic` for diagnosing MIME type issues

### Improvements
- **Update Status in Settings** — new section in Settings > Updates showing current status with inline Download and Restart & Install buttons
- **StatusBar web badge** — clicking the web server badge now opens Settings directly to the Web Server tab
- **npm run dev watches web renderer** — `build-web.js --watch` now runs alongside the main and Electron renderer watchers
- **Session control broadcast debounce** — 50ms debounce prevents rapid-fire state broadcasts
- **YOLO badge on all tool cards** — Codex and Gemini show a YOLO badge in the AI Tools header when a dangerous flag is enabled

## Installation and Update

Grab the latest installer from [GitHub Releases](https://github.com/Codename-11/SubFrame/releases/tag/v0.11.1-beta).

- **Windows**: SubFrame-Setup-0.11.1-beta.exe
- **macOS**: SubFrame-0.11.1-beta.dmg
- **Linux**: SubFrame-0.11.1-beta.AppImage

If you already have SubFrame installed, update through the in-app updater or the System Panel.
