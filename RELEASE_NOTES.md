Feature release adding file management, enhanced markdown preview, workspace creation flow, editor popout, and GitHub PR support.

## What's Changed

### Features
- **File > Open (Ctrl+O)** — open any file in the editor via native file dialog with drag-drop support on the window
- **Markdown Preview Overhaul** — HTML passthrough via rehype-raw, GitHub-style alert boxes ([!NOTE]/[!WARNING]/[!TIP]/[!IMPORTANT]/[!CAUTION]), shields.io badge rendering, and GFM task list checkboxes
- **Two-Step Workspace Creation** — new workspace dialog now offers project setup: browse existing folder, create new folder (with optional SubFrame init), or skip
- **Editor Popout Windows** — pop out the file editor to a separate window with dock-back, mirroring the terminal popout pattern
- **GitHub PR Tab** — Pull Requests panel now fetches actual PRs via `gh pr list` with Open/Closed/Merged/All filters (was incorrectly showing issues)
- **Workspace Reorder Sync** — drag-reordering workspace pills now immediately updates the sidebar

## Installation and Update

Grab the latest installer from [GitHub Releases](https://github.com/Codename-11/SubFrame/releases/tag/v0.12.0-beta).

- **Windows**: SubFrame-Setup-0.12.0-beta.exe
- **macOS**: SubFrame-0.12.0-beta.dmg

If you already have SubFrame installed, update through the in-app updater or the System Panel.
