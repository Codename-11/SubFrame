Fix release — shell selector, CLI install helper, shortcut conflicts, and path handling improvements.

## What's Changed

### Improvements
- **Shell Selector Dropdown** - Default shell setting now shows a dropdown of detected shells (PowerShell Core, Bash, Zsh, Fish, Nushell, WSL, Git Bash) instead of a raw text input
- **CLI Install Helper** - New "Install CLI to PATH" button in Settings > General > CLI. Creates `subframe.cmd` on Windows or `/usr/local/bin/subframe` symlink on macOS/Linux
- **CLI Packaging** - `subframe-cli.js` now bundled via `extraResources` so the install button works on packaged builds

### Bug Fixes
- **Ctrl+G Shortcut Conflict** - Editor Go-to-Line changed from Ctrl+G (conflicted with grid toggle) to Ctrl+L
- **macOS open-file Race** - File path no longer dropped when Finder opens a file before SubFrame's window is ready
- **Auto-fetch Timer Leak** - Background fetch timer properly stopped on app close
- **Auto-fetch Minimum Interval** - 30-second guard prevents corrupt settings from triggering rapid fetch loops
- **Push Button Stub** - Removed non-functional "push" button from sidebar that only showed a toast
