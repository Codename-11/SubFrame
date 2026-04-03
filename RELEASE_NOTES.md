Critical fix for the updater download that never starts — the root cause of the "Starting download..." stuck toast across all previous 0.14.x releases.

## What's Changed

### Bug Fixes
- **Updater download never starts** — `setupIPC()` runs before `init()` sets `isPackaged`, so the `if (!isPackaged)` early return in `setupIPC` always triggered in packaged builds. This registered dev-mode no-op stubs (`() => {}`) for `UPDATER_DOWNLOAD`, `UPDATER_CHECK`, and `UPDATER_INSTALL` instead of the real `autoUpdater` handlers. The download mutation resolved instantly with `undefined`, no download ever started, and no error was reported. Fixed by moving the `isPackaged` check inside each handler (evaluated at invocation time when `init()` has already run)
