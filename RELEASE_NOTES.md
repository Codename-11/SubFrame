Patch release adding AI tool configuration management and UI polish.

## What's Changed

### Features
- **AI Tool Configuration** — new section in System panel showing config file status for Claude Code, Gemini CLI, and Codex CLI at both global (`~/`) and project levels. Collapsible per-tool sections with inline summary (files found + warning count). Detects and validates: `CLAUDE.md`, `GEMINI.md`, `AGENTS.md`, `settings.json`, `instructions.md` — with warnings for invalid JSON, empty files, and large files. Open existing files in editor or create from templates.

### Bug Fixes
- **Panel dropdown indicator** — the right panel group selector now shows a ChevronDown chevron so it's clear the active panel name is a clickable dropdown
- **AI Analysis shortcut conflict** — changed from Ctrl+Shift+I (conflicts with Electron DevTools) to Ctrl+Shift+J

## Installation and Update

Grab the latest installer from [GitHub Releases](https://github.com/Codename-11/SubFrame/releases/tag/v0.12.1-beta).

- **Windows**: SubFrame-Setup-0.12.1-beta.exe
- **macOS**: SubFrame-0.12.1-beta.dmg

If you already have SubFrame installed, update through the in-app updater or the System Panel.
