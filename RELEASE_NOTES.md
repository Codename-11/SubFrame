Stability release fixing the updater download toast (again), the terminal bell/character-drop on AI tool launch, and a workspace deactivation freeze.

## What's Changed

### Bug Fixes
- **Updater download toast** — Clicking "Download" on the update-available toast now correctly transitions to a loading state instead of silently dismissing. Root cause: the previous `requestAnimationFrame` workaround was insufficient — sonner's `deleteToast()` sets a component-local `removed` flag that ignores all data updates during exit animation. Fixed by using sonner's own `event.preventDefault()` escape hatch to skip auto-dismiss entirely, then updating the toast in-place
- **Terminal bell on AI tool launch** — Pressing Ctrl+Shift+Enter to start an AI tool no longer triggers a terminal bell or drops the first character of the command (typing "laude" instead of "claude"). Root cause: xterm's `attachCustomKeyEventHandler` returning `false` skips xterm's key processing but does not call `preventDefault()`, so the browser's default textarea input still leaked through to the PTY
- **Workspace deactivation UI freeze** — Deactivating a workspace no longer leaves the entire UI unresponsive to clicks. Radix modal context menus set `pointer-events:none` on `<body>` while open; if the workspace pill (menu trigger) unmounted before the close animation completed, this style was permanently orphaned. Added post-operation safety cleanup

### Other Changes
- **Release skill** — `/release` can now be invoked by Claude when directed by the user (removed `disable-model-invocation` restriction)
