Fixes update notification reliability and connects all output channels to their subsystems for real-time logging in the Output panel.

## What's Changed

### Bug Fixes
- **Updater 404 error spam** — Background update checks no longer show raw stack traces when CI artifacts aren't uploaded yet. 404s are silently swallowed for automatic checks; manual checks show a friendly "try again in a few minutes" message.
- **Download button disappears** — Clicking Download in the update toast no longer silently fails. The download handler now immediately reports status and properly surfaces errors if the download can't start.
- **Settings Download no feedback** — The Download button in Settings > Updates now shows a disabled/loading state while the download initializes, with a "Connecting..." indicator before progress percentage appears.

### Improvements
- **Output channels wired to subsystems** — The Output panel (ActivityBar bottom bar) now shows real-time logs from five previously-dormant channels:
  - **System** — updater events (available, downloaded, errors), session snapshot save/restore
  - **Agent** — terminal create/exit lifecycle events
  - **Pipeline** — run start and completion with status
  - **API** — server startup confirmation
  - **Git** — branch checkout and create operations

## Installation and Update

Grab the latest installer from [GitHub Releases](https://github.com/Codename-11/SubFrame/releases/tag/v0.14.0-beta).

- **Windows**: SubFrame-Setup-0.14.0-beta.exe
- **macOS**: SubFrame-0.14.0-beta.dmg

If you already have SubFrame installed, update through the in-app updater or the System Panel.
