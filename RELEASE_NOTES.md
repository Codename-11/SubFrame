Quick fix release — restores the missing GitHub button in the top bar and improves update check UX by removing unnecessary toasts.

## What's Changed

### Bug Fixes
- **Missing GitHub button in top bar** - GitHub panel shortcut now appears in the ViewTabBar alongside Sub-Tasks, Agents, Pipeline, and Overview (with Ctrl+Shift+G)
- **"Latest version" toast removed** - Manual update checks no longer show a success toast when already up to date — the checking indicator dismisses silently
- **Silent auto-check errors** - Background update check failures no longer surface error toasts to the user

### Improvements
- **Unified update notifications** - Settings "Check Now" and menu "Check for Updates" now share centralized toast feedback, distinguishing manual checks (brief "Checking..." indicator) from silent background checks
