Patch release fixing terminal user message markers, link handling, and release workflow.

## What's Changed

### Bug Fixes
- **Multiline user message markers** — the left-border decoration now spans the full height of multiline messages instead of a single row. Tracks the input start line and computes height at submission.
- **Bracketed paste support** — pasted text was silently dropped from the input buffer because bracketed paste escape sequences (`ESC[200~`/`ESC[201~`) were being filtered. Now strips the wrappers and accumulates the clean text.
- **Terminal web links require Ctrl+Click** — clicking a URL in the terminal no longer opens it directly. Requires Ctrl+Click (Cmd+Click on Mac) to match standard terminal behavior. Tooltip already showed the correct hint.
- **Release workflow** — GitHub releases are no longer marked as pre-release while the project is beta-only. All existing releases updated.

## Installation and Update

Grab the latest installer from [GitHub Releases](https://github.com/Codename-11/SubFrame/releases/tag/v0.11.2-beta).

- **Windows**: SubFrame-Setup-0.11.2-beta.exe
- **macOS**: SubFrame-0.11.2-beta.dmg
- **Linux**: SubFrame-0.11.2-beta.AppImage

If you already have SubFrame installed, update through the in-app updater or the System Panel.
