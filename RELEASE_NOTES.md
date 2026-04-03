Stability release fixing the terminal bell/character-drop when launching AI tools via Ctrl+Shift+Enter, and a workspace deactivation bug that could leave the entire UI unresponsive.

## What's Changed

### Bug Fixes
- **Terminal bell on AI tool launch** — Pressing Ctrl+Shift+Enter to start an AI tool no longer triggers a terminal bell or drops the first character of the command (typing "laude" instead of "claude"). Root cause: xterm's `attachCustomKeyEventHandler` returning `false` skips xterm's key processing but does not call `preventDefault()`, so the browser's default textarea input still leaked through to the PTY
- **Workspace deactivation UI freeze** — Deactivating a workspace no longer leaves the entire UI unresponsive to clicks. Radix modal context menus set `pointer-events:none` on `<body>` while open; if the workspace pill (menu trigger) unmounted before the close animation completed, this style was permanently orphaned. Added post-operation safety cleanup for workspace deactivation and deletion
