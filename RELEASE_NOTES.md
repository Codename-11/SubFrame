Hotfix for auto-updater detection and toast UX.

## What's Changed

### Bug Fixes
- **Auto-updater not finding beta releases** — release workflow was hardcoding `prerelease: false`, preventing electron-updater from detecting beta updates
- **"Check Now" no feedback** — manual update checks now show "You're on the latest version" instead of silently dismissing
- **"Restart Now" toast auto-dismissing** — periodic background checks no longer kill the downloaded-update toast; checks stop once an update is staged
- **GitHub releases mislabeled** — all 11 existing beta releases retroactively marked as prerelease
