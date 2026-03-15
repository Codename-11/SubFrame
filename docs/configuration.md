# Configuration

SubFrame stores configuration at two levels: **application settings** that apply globally, and **project configuration** that lives inside each initialized project. This guide covers both.

## Settings Panel

Open the Settings panel with <kbd>Ctrl</kbd>+<kbd>,</kbd> (or from the menu). It contains six tabs:

- **General** -- startup behavior, file tree visibility, default project directory
- **AI Tool** -- active AI tool selection, start command overrides, custom tools
- **Terminal** -- font size, scrollback buffer, tab auto-rename
- **Editor** -- minimap, word wrap, font size, theme selection
- **Appearance** -- theme presets, custom themes, color pickers, feature toggles
- **Updater** -- auto-update checks, update channels, check intervals
- **About** -- version info, license, links, changelog

Changes take effect immediately and are persisted to disk.

## General Settings

| Setting | Description | Default |
|---|---|---|
| **Open terminal on startup** | Automatically create a terminal tab when SubFrame launches | `false` |
| **Show hidden files (.dotfiles)** | Display files and directories starting with `.` in the file tree | `false` |
| **Default Project Directory** | A directory whose subdirectories appear automatically in the project list. Use the folder icon to browse, or the **X** button to clear. The **Scan Now** button re-reads the directory on demand. | _(empty)_ |

## Terminal Settings

| Setting | Description | Default | Range |
|---|---|---|---|
| **Font Size** | Terminal text size in pixels | `14` | 10 -- 24 |
| **Scrollback Lines** | Number of lines the terminal keeps in its buffer | `10000` | 1,000 -- 100,000 |
| **Auto-rename to session name** | Rename terminal tabs to the detected AI session name | `true` | -- |

## Editor Settings

The **Editor** tab controls the built-in CodeMirror 6 editor:

| Setting | Description | Default |
|---|---|---|
| **Minimap** | Show a code minimap for quick navigation | `false` |
| **Fullscreen** | Open editor in fullscreen mode by default | `false` |
| **Theme** | CodeMirror editor theme | `subframe-dark` |
| **Word Wrap** | Wrap long lines in the editor | `false` |
| **Font Size** | Editor text size in pixels | `12` |

## Appearance Settings

The **Appearance** tab controls SubFrame's visual theme:

### Theme Presets

SubFrame ships with 4 built-in theme presets:

| Preset | Description |
|---|---|
| **Classic Amber** | Warm neutral tones with amber accent (default) |
| **Synthwave Traces** | Purple, pink, and cyan neon aesthetic with optional scanlines |
| **Midnight Purple** | Deep purple tones with violet accents |
| **Terminal Green** | Classic green-on-black terminal look |

Click any preset card in the gallery to apply it immediately.

### Custom Themes

You can create custom themes by adjusting individual color tokens:

- **Accent** -- Primary accent color used for highlights, badges, and active elements
- **Background** -- Main background color
- **Text** -- Primary text color

Click **Save as Custom** to persist your custom theme. Saved custom themes appear alongside the built-in presets.

### Feature Toggles

| Toggle | Description |
|---|---|
| **Neon Traces** | Adds glowing border accents to panels and interactive elements |
| **Scanlines** | Overlays subtle CRT-style scanlines on the interface |
| **Logo Glow** | Adds a soft glow effect to the SubFrame logo |

## Updater Settings

The **Updater** tab controls automatic update behavior:

| Setting | Description | Default |
|---|---|---|
| **Auto-check for updates** | Periodically check GitHub Releases for new versions | `true` |
| **Check interval** | How often to check, in hours | `4` |
| **Allow pre-release updates** | Whether to offer beta/alpha/RC versions | `auto` (matches current version type) |

When an update is available, SubFrame shows a notification. You choose when to download and install — updates are never forced.

## AI Tool Configuration

SubFrame supports Claude Code, Codex CLI, and Gemini CLI with custom start commands and tool additions.

→ [Full AI Tool Setup guide](/ai-tool-setup)

## Workspace Configuration

SubFrame organizes projects into **workspaces**. Workspace data is stored globally at `~/.subframe/workspaces.json`.

Each workspace contains:
- A **name** (e.g., "Default Workspace")
- A list of **projects** with their paths, names, SubFrame status, and timestamps

You can:
- **Create** new workspaces to group projects by team, client, or purpose
- **Switch** between workspaces from the workspace selector in the sidebar
- **Rename** or **delete** workspaces as needed

Projects are added to the active workspace either manually (via the Add Project button) or automatically by scanning the **Default Project Directory** set in General settings.

## Project Configuration

When you initialize a project as a SubFrame project, a `.subframe/` directory is created containing project-level configuration and metadata.

### .subframe/config.json

This is the per-project configuration file created during initialization:

```json
{
  "version": "1.0",
  "name": "my-project",
  "description": "",
  "createdAt": "2025-01-15T10:30:00.000Z",
  "initializedBy": "SubFrame",
  "settings": {
    "autoUpdateStructure": true,
    "autoUpdateNotes": false,
    "taskRecognition": true
  },
  "backlink": {
    "customMessage": "",
    "additionalRefs": []
  },
  "files": {
    "agents": "AGENTS.md",
    "claude": "CLAUDE.md",
    "gemini": "GEMINI.md",
    "structure": ".subframe/STRUCTURE.json",
    "notes": ".subframe/PROJECT_NOTES.md",
    "tasks": ".subframe/tasks.json",
    "quickstart": ".subframe/QUICKSTART.md",
    "docsInternal": ".subframe/docs-internal"
  }
}
```

#### Project Settings

| Setting | Description | Default |
|---|---|---|
| `autoUpdateStructure` | Automatically regenerate `STRUCTURE.json` (also handled by git pre-commit hook) | `true` |
| `autoUpdateNotes` | Automatically update `PROJECT_NOTES.md` with session context | `false` |
| `taskRecognition` | Enable AI recognition and suggestion of Sub-Tasks from user requests | `true` |

#### Backlink Configuration

| Field | Description |
|---|---|
| `customMessage` | Optional custom text for the AGENTS.md reference inserted into CLAUDE.md/GEMINI.md |
| `additionalRefs` | Array of additional file references to include in the backlink |

### .subframe/ Directory Structure

| File / Directory | Purpose |
|---|---|
| `config.json` | Project configuration (see above) |
| `STRUCTURE.json` | Auto-generated module map of your codebase |
| `PROJECT_NOTES.md` | Architecture decisions and session notes |
| `tasks.json` | Sub-Task index (auto-generated from `.md` files) |
| `tasks/` | Individual Sub-Task markdown files with YAML frontmatter |
| `tasks/archive/` | Completed Sub-Tasks moved here by the archive command |
| `QUICKSTART.md` | Getting-started guide generated at initialization |
| `docs-internal/` | ADRs, architecture overview, changelog, IPC reference |
| `hooks/` | Claude Code hook scripts (session-start, prompt-submit, stop, etc.) |
| `bin/` | AI tool wrapper scripts (e.g., Codex CLI wrapper) |

## Data Locations

SubFrame stores data in several locations on your system:

### Application Data (Global)

Electron's `userData` directory holds all global application state. The path depends on your OS:

| OS | Path |
|---|---|
| **Windows** | `%APPDATA%\SubFrame\` |
| **macOS** | `~/Library/Application Support/SubFrame/` |
| **Linux** | `~/.config/SubFrame/` |

Files in this directory:

| File | Purpose |
|---|---|
| `frame-settings.json` | Application settings (General, Terminal, Editor, AI tool overrides) |
| `ai-tool-config.json` | Active AI tool selection and custom tool definitions |
| `window-state.json` | Window size and position (restored on next launch) |
| `prompts-history.txt` | Prompt logging history |

### Workspace Data (Global)

| Path | Purpose |
|---|---|
| `~/.subframe/workspaces.json` | Workspace definitions and project lists |

### Project Data (Per-Project)

| Path | Purpose |
|---|---|
| `<project>/.subframe/` | SubFrame project files (config, structure map, tasks, notes) |
| `<project>/.claude/settings.json` | Claude Code hook configuration (merged, not overwritten) |
| `<project>/.claude/skills/` | Claude Code slash-command skills (sub-tasks, sub-docs, sub-audit) |
| `<project>/.githooks/` | Git hooks for auto-updating STRUCTURE.json on commit |
| `<project>/AGENTS.md` | AI-agnostic project instructions |
| `<project>/CLAUDE.md` | Claude Code instructions (contains backlink to AGENTS.md) |
| `<project>/GEMINI.md` | Gemini CLI instructions (contains backlink to AGENTS.md) |

## Resetting Configuration

To reset application settings to defaults, delete the `frame-settings.json` file from the [application data directory](#application-data-global). SubFrame will recreate it with default values on next launch.

To reset AI tool configuration, delete `ai-tool-config.json` from the same directory. The active tool will revert to Claude Code.

To remove SubFrame from a project entirely, use the **Uninstall** option in the SubFrame Health panel. It supports selective removal of hooks, backlinks, skills, and the `.subframe/` directory, with a dry-run preview before making changes.
