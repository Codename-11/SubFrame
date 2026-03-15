---
title: AI Tool Setup
description: Configure and switch between AI coding tools in SubFrame, including Claude Code, Codex CLI, and Gemini CLI.
---

# AI Tool Setup

SubFrame supports multiple AI coding tools out of the box. You can switch between them at any time, customize start commands, and even add your own custom tools.

## Supported Tools

SubFrame ships with three built-in AI tool presets:

| Tool | Command | Description |
|------|---------|-------------|
| **Claude Code** | `claude` | Anthropic's CLI for AI-assisted coding |
| **Codex CLI** | `./.subframe/bin/codex` | OpenAI's CLI, launched via a SubFrame wrapper that injects AGENTS.md context |
| **Gemini CLI** | `gemini` | Google's CLI, reads GEMINI.md natively |

Claude Code is the default active tool.

## Claude Code

[Claude Code](https://docs.anthropic.com/en/docs/claude-code) is Anthropic's terminal-based AI coding assistant. SubFrame is designed as a companion IDE for Claude Code and provides the deepest integration with it.

### Prerequisites

1. **Install Claude Code** globally via npm:

   ```bash
   npm install -g @anthropic-ai/claude-code
   ```

2. **Authenticate** by running `claude` once in a terminal and following the login prompts. This sets up your Anthropic API key or account.

### Features in SubFrame

- **Plugin support** -- Claude Code is the only built-in tool with plugin integration enabled
- **Session tracking** -- SubFrame detects and displays Claude sessions, including segment history and conversation chains
- **Slash commands** -- `/init`, `/commit`, `/review-pr`, `/help` are available through the application menu
- **CLAUDE.md backlinks** -- SubFrame manages your project's `CLAUDE.md` file with backlinks to shared `AGENTS.md` rules
- **Claude settings integration** -- SubFrame merges its hooks and skills into `.claude/settings.json`
- **Usage monitoring** -- Track your 5-hour and 7-day API utilization from the sidebar

### Tips

- Claude Code reads `CLAUDE.md` at the project root automatically. SubFrame's backlink system keeps it in sync with your shared `AGENTS.md` rules.
- Use the Sessions panel to browse past conversations and resume previous work.

## Codex CLI

[Codex CLI](https://github.com/openai/codex) is OpenAI's command-line coding assistant.

### Prerequisites

1. **Install Codex CLI** globally:

   ```bash
   npm install -g @openai/codex
   ```

2. **Set your OpenAI API key** as an environment variable:

   ```bash
   export OPENAI_API_KEY="your-key-here"
   ```

### How SubFrame Integrates Codex

SubFrame includes a **wrapper script** at `.subframe/bin/codex` that launches Codex CLI with an initial prompt to read your project's `AGENTS.md` file. This gives Codex the same project context that Claude Code gets natively through `CLAUDE.md`.

The wrapper:
- Searches for `AGENTS.md` in the current directory and parent directories
- Injects a prompt telling Codex to read and follow `AGENTS.md`
- Falls back to a plain `codex` launch if no `AGENTS.md` is found

This wrapper is created automatically when you initialize a SubFrame project.

### Slash Commands

When Codex is the active tool, the application menu provides:

- `/review` -- Review code
- `/model` -- Switch models
- `/permissions` -- Manage permissions
- `/help` -- Show help

### Tips

- Codex CLI does not support SubFrame's plugin system.
- The wrapper script requires a Unix-like shell (bash). On Windows, use Git Bash or WSL.

## Gemini CLI

[Gemini CLI](https://github.com/google-gemini/gemini-cli) is Google's command-line AI coding tool.

### Prerequisites

1. **Install Gemini CLI** globally:

   ```bash
   npm install -g @google/gemini-cli
   ```

   Or follow the [official installation instructions](https://github.com/google-gemini/gemini-cli#installation).

2. **Authenticate** with your Google account by running `gemini` and following the prompts, or set a Gemini API key as an environment variable.

::: warning Node.js Version
Gemini CLI requires **Node.js 20 or later**. If you see `SyntaxError: Invalid regular expression flags`, upgrade your Node.js version.
:::

### How SubFrame Integrates Gemini

Gemini CLI reads `GEMINI.md` at the project root natively -- no wrapper script is needed. SubFrame manages your `GEMINI.md` file with the same backlink system used for `CLAUDE.md`, keeping it in sync with shared `AGENTS.md` rules.

### Slash Commands

When Gemini is the active tool, the application menu provides:

- `/init` -- Initialize
- `/model` -- Switch models
- `/memory` -- Manage memory
- `/compress` -- Compress context
- `/settings` -- Open settings
- `/help` -- Show help

### Tips

- Gemini CLI does not support SubFrame's plugin system.
- Gemini reads `GEMINI.md` natively, so backlinks work the same way as `CLAUDE.md` -- your shared rules from `AGENTS.md` are automatically included.

## Switching Tools

There are three ways to change the active AI tool:

### 1. AI Tool Selector (Sidebar)

Click the tool selector button in the sidebar (shows the current tool name with a terminal icon). A dropdown lists all available tools -- click one to switch.

### 2. Settings Panel

1. Open **Settings** (gear icon or `Ctrl+,`)
2. Go to the **AI Tool** tab
3. Select a tool from the **Active Tool** dropdown

### 3. Application Menu

Go to **View > Switch AI Tool...** and select from the radio menu of available tools.

When you switch tools, SubFrame updates the start command used when launching new AI terminals. Existing terminals are not affected.

## Custom Start Commands

Each tool has a default start command (e.g., `claude` for Claude Code). You can override this per tool:

1. Open **Settings > AI Tool**
2. Edit the **Start Command** field
3. Click **Save**

For example, you might set Claude Code's start command to `claude --model opus` to always use a specific model, or provide a full path like `/usr/local/bin/claude`.

Click **Reset to Default** to restore the original command.

Custom commands are stored per tool, so switching between tools restores each tool's own custom command.

## Adding Custom Tools

You can register additional AI tools beyond the three built-in presets:

1. Open **Settings > AI Tool**
2. Scroll to the **Custom Tools** section
3. Fill in:
   - **Name** -- Display name (e.g., "Aider")
   - **Command** -- The shell command to launch the tool (e.g., `aider`)
   - **Description** -- Optional short description
4. Click **Add Tool**

Custom tools appear in the tool selector alongside the built-in tools. You can remove a custom tool from the same settings section.

You can also add a custom tool on the fly from the sidebar tool selector by clicking **Custom command...** at the bottom of the dropdown.

## Managing AI Files

SubFrame manages instruction files for each tool through the **AI Files** panel (accessible from the right panel tabs):

| File | Tool | Purpose |
|------|------|---------|
| `AGENTS.md` | All tools | Shared rules and project instructions |
| `CLAUDE.md` | Claude Code | Claude-specific instructions with backlink to AGENTS.md |
| `GEMINI.md` | Gemini CLI | Gemini-specific instructions with backlink to AGENTS.md |
| `.subframe/bin/codex` | Codex CLI | Wrapper script that injects AGENTS.md context |

The AI Files panel shows the status of each file (exists, has backlink, etc.) and provides actions to create, inject backlinks, or verify them. See the [Configuration guide](./configuration.md) for more on backlink customization.

## Official Documentation

- [Claude Code Documentation](https://docs.anthropic.com/en/docs/claude-code)
- [Codex CLI on GitHub](https://github.com/openai/codex)
- [Gemini CLI on GitHub](https://github.com/google-gemini/gemini-cli)
