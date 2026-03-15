---
title: Troubleshooting
description: Solutions for common SubFrame issues including installation problems, terminal errors, AI tool connectivity, and performance.
---

# Troubleshooting

This guide covers common issues you may encounter when using SubFrame and how to resolve them.

## Installation Issues

### macOS

**"SubFrame is damaged and can't be opened"**

macOS Gatekeeper blocks unsigned applications. To resolve:

1. Open **System Settings > Privacy & Security**
2. Scroll down to the security section — you should see a message about SubFrame being blocked
3. Click **Open Anyway**

Alternatively, right-click SubFrame in Applications, select **Open**, then click **Open** in the confirmation dialog.

::: tip
If neither approach works, remove the quarantine attribute from the terminal:

```bash
xattr -cr /Applications/SubFrame.app
```
:::

**DMG won't mount or is corrupted**

Re-download the `.dmg` file from the [GitHub Releases page](https://github.com/Codename-11/SubFrame/releases). If the issue persists, verify the download completed fully — partial downloads will fail to mount.

### Windows

**Installer fails or Windows Defender blocks it**

Windows SmartScreen may block the installer because SubFrame is not yet signed with an EV code-signing certificate:

1. Click **More info** on the SmartScreen dialog
2. Click **Run anyway**

If Windows Defender flags the installer, add an exclusion:

1. Open **Windows Security > Virus & threat protection**
2. Go to **Manage settings > Exclusions**
3. Add the SubFrame installation directory

**"MSVCP140.dll not found" or similar Visual C++ errors**

SubFrame depends on the Visual C++ Redistributable. Install it from [Microsoft's download page](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist).

### Linux

**AppImage won't launch**

Make sure the AppImage is executable:

```bash
chmod +x SubFrame-*.AppImage
```

If it still fails, install FUSE (required by AppImage):

```bash
# Ubuntu/Debian
sudo apt install fuse libfuse2

# Fedora
sudo dnf install fuse
```

**Missing shared libraries**

If you see errors about missing libraries (e.g., `libgtk-3.so`), install the required dependencies:

```bash
# Ubuntu/Debian
sudo apt install libgtk-3-0 libnotify4 libnss3 libxss1 libxtst6 libatspi2.0-0 libsecret-1-0

# Fedora
sudo dnf install gtk3 libnotify nss libXScrnSaver libXtst at-spi2-atk libsecret
```

### Building from Source

**`node-pty` build fails during `npm install`**

`node-pty` is a native module that requires a C++ compiler:

- **macOS**: Install Xcode Command Line Tools: `xcode-select --install`
- **Windows**: Install the [Build Tools for Visual Studio](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (select "Desktop development with C++")
- **Linux**: Install build essentials: `sudo apt install build-essential python3`

After installing the compiler, run:

```bash
npm install
```

If `node-pty` still fails, try rebuilding it for your Electron version:

```bash
npx electron-rebuild -f -w node-pty
```

**`npm run build` fails**

Ensure you are running Node.js 20 or later:

```bash
node --version
```

If your version is too old, update Node.js from [nodejs.org](https://nodejs.org/) or use a version manager like `nvm` or `fnm`.

## Terminal Issues

### Terminal Not Starting

**Blank terminal after launching SubFrame**

The terminal relies on `node-pty` to spawn a shell process. If the terminal area is blank:

1. Check the developer console for errors: **View > Toggle Developer Tools** (or <kbd>Ctrl+Shift+I</kbd>)
2. Look for PTY-related error messages in the Console tab
3. Try creating a new terminal with <kbd>Ctrl+Shift+T</kbd>

::: warning
If you see `Error: spawn ... ENOENT` in the console, your default shell could not be found. See the Shell Detection section below.
:::

**Terminal exits immediately**

If a terminal opens but closes right away, the shell process is crashing on startup. Common causes:

- A broken shell configuration file (`.bashrc`, `.zshrc`, etc.) — try launching with a different shell
- Insufficient permissions to run the shell executable
- Antivirus software blocking the process

Check the terminal exit code in SubFrame's developer console. A non-zero exit code indicates the shell encountered an error.

### Shell Detection

SubFrame auto-detects your shell based on your platform:

| Platform | Detection Order |
|----------|----------------|
| **Windows** | PowerShell Core (`pwsh.exe`) > Windows PowerShell (`powershell.exe`) |
| **macOS/Linux** | `$SHELL` environment variable > `/bin/zsh` fallback |

SubFrame also detects these additional shells if installed: Git Bash, WSL (Windows), Fish, and Nushell (macOS/Linux).

**Shell not detected**

If SubFrame defaults to the wrong shell or cannot find your preferred shell:

1. Open SubFrame Settings (<kbd>Ctrl+,</kbd>)
2. When creating a new terminal, use the shell selector dropdown to pick a different shell
3. Ensure your shell is installed and available in your system PATH

**WSL terminal issues on Windows**

WSL requires Windows Subsystem for Linux to be enabled:

```powershell
wsl --install
```

After installation, restart your computer. WSL should then appear in the shell selector.

### PTY Errors

**"Maximum terminal limit (9) reached"**

SubFrame limits you to 9 simultaneous terminals. Close unused terminals to free up slots — click the X on a terminal tab or use <kbd>Ctrl+W</kbd>.

**Terminal output garbled or missing colors**

SubFrame sets `TERM=xterm-256color` and `COLORTERM=truecolor` for all terminals. If colors appear wrong:

- Ensure your shell configuration does not override `TERM`
- Check that your `.bashrc` / `.zshrc` is not disabling color output
- Try resizing the terminal window — this forces a redraw

## AI Tool Issues

### Tool Not Found

SubFrame launches AI tools by running their CLI command in the terminal. If a tool fails to start:

**Claude Code**

```bash
# Verify it's installed
claude --version

# If not found, install it
npm install -g @anthropic-ai/claude-code
```

**Codex CLI**

```bash
# Verify it's installed
codex --version

# If not found, install it
npm install -g @openai/codex
```

**Gemini CLI**

```bash
# Verify it's installed
gemini --version

# If not found, install it
npm install -g @google/gemini-cli  # or follow Google's official install instructions
```

::: tip
If the tool works in your regular terminal but not inside SubFrame, the issue is likely a PATH difference. SubFrame inherits environment variables from the process that launched it. Try launching SubFrame from the terminal (not from a desktop shortcut) to inherit your full shell environment.
:::

### Gemini CLI Errors

**`SyntaxError: Invalid regular expression flags`** — Gemini CLI requires Node.js 20 or later. Check your version with `node --version` and upgrade if needed. If you use `nvm`, make sure to set the default alias: `nvm alias default 20` — otherwise terminals spawned by Electron may still use the old default version.

### Custom Command Path

If your AI tool is installed in a non-standard location, configure a custom command:

1. Open **Settings** (<kbd>Ctrl+,</kbd>)
2. Under **AI Tools**, find the tool you want to configure
3. Set a custom command path (e.g., `/usr/local/bin/claude` or `C:\Users\you\.npm\claude.cmd`)

SubFrame reads custom command overrides from the setting `aiTools.<toolId>.customCommand`.

### API Key Issues

SubFrame does not manage API keys directly — each AI tool handles its own authentication. If you see authentication errors:

- **Claude Code**: Run `claude` in a regular terminal and follow the authentication prompts. Credentials are stored in your system's credential store.
- **Codex CLI**: Set the `OPENAI_API_KEY` environment variable in your shell profile (`.bashrc`, `.zshrc`, or system environment variables).
- **Gemini CLI**: Run `gemini` in a regular terminal and follow the login flow. Or set `GOOGLE_API_KEY` in your environment.

::: warning
Never store API keys in SubFrame's configuration files. Use your shell's environment variables or the tool's built-in authentication mechanism.
:::

## Performance

### Slow Startup

SubFrame shows a splash screen while loading. If startup takes more than a few seconds:

- **Large workspace file**: If you have hundreds of projects in your workspace, loading takes longer. Remove projects you no longer use.
- **Shell profile scripts**: Heavy `.bashrc`/`.zshrc` files slow down terminal creation. Profile your shell startup with `time zsh -i -c exit` and optimize slow plugins.
- **Antivirus scanning**: Some antivirus software scans Electron apps on launch. Add SubFrame to your antivirus exclusion list.

### High Memory Usage

Each terminal tab runs a separate PTY process. Memory usage scales with the number of open terminals and their scrollback buffer.

To reduce memory usage:

- Close terminals you are not actively using
- Reduce the terminal scrollback buffer in **Settings > Terminal > Scrollback** (default: 10,000 lines)
- Avoid running memory-intensive commands in multiple terminals simultaneously

### Renderer Slowdowns

If the UI becomes sluggish (slow tab switching, laggy scrolling):

- Close any panels you are not using (right panel, file tree, etc.)
- Clear long terminal output by running `clear` or `cls`
- Restart SubFrame — this resets all terminal buffers and renderer state

## File and Permission Issues

### "Error reading directory" in File Tree

This occurs when SubFrame cannot read the project directory. Check:

1. The project path still exists on disk
2. Your user account has read permissions for the directory
3. The directory is not on an unmounted network drive

### Settings or Workspace Not Saving

SubFrame stores settings and workspace data in the Electron `userData` directory:

| Platform | Path |
|----------|------|
| **Windows** | `%APPDATA%\SubFrame\` |
| **macOS** | `~/Library/Application Support/SubFrame/` |
| **Linux** | `~/.config/SubFrame/` |

Key files in this directory:

| File | Purpose |
|------|---------|
| `frame-settings.json` | Application settings |
| `window-state.json` | Window position and size |
| `ai-tool-config.json` | Active AI tool configuration |

If settings are not persisting, verify that this directory exists and is writable. You can also try deleting the corrupted file — SubFrame will recreate it with defaults on next launch.

### SubFrame Project Files

SubFrame project files are stored in the `.subframe/` directory within each project:

| File | Purpose |
|------|---------|
| `config.json` | Project configuration |
| `STRUCTURE.json` | Codebase map |
| `PROJECT_NOTES.md` | Architecture decisions and session notes |
| `tasks.json` | Sub-Task index |
| `tasks/*.md` | Individual Sub-Task files |

If project initialization fails or these files become corrupted, re-initialize the project:

1. Open the project in SubFrame
2. Use the **Initialize Workspace** option in the sidebar

Existing files are never overwritten during initialization — only missing files are created.

## Common Error Messages

### `[Main:uncaughtException]`

An unhandled error occurred in the main process. This is logged to the terminal that launched SubFrame. Common causes:

- A corrupted settings file (delete it from the userData directory to reset)
- A native module (`node-pty`) incompatible with the Electron version
- System resource exhaustion (out of file descriptors, memory, etc.)

### `[Main:unhandledRejection]`

An async operation failed without proper error handling. Check the full error message in the terminal output for context. If it occurs repeatedly, [report it as a bug](#getting-help).

### `[Renderer:error]`

A JavaScript error occurred in the renderer (UI) process. Open the developer tools (<kbd>Ctrl+Shift+I</kbd>) and check the Console tab for the full stack trace.

### `Error loading AI tool config` / `Error loading settings`

The configuration file is corrupted or contains invalid JSON. To fix:

1. Navigate to the [userData directory](#settings-or-workspace-not-saving)
2. Delete the corrupted file (`ai-tool-config.json` or `frame-settings.json`)
3. Restart SubFrame — defaults will be restored

### `Error scanning project directory`

SubFrame could not read the default project directory configured in Settings. Verify the path exists and is accessible.

### `Error initializing SubFrame project`

Project initialization failed. This usually means SubFrame could not write files to the `.subframe/` directory. Check that the project directory is writable and not on a read-only file system.

## Reset and Clean Install

If SubFrame is in a broken state, you can reset it to factory defaults.

### Reset Settings (Keep Projects)

Delete only the settings files from the userData directory:

```bash
# macOS
rm ~/Library/Application\ Support/SubFrame/frame-settings.json
rm ~/Library/Application\ Support/SubFrame/ai-tool-config.json
rm ~/Library/Application\ Support/SubFrame/window-state.json

# Linux
rm ~/.config/SubFrame/frame-settings.json
rm ~/.config/SubFrame/ai-tool-config.json
rm ~/.config/SubFrame/window-state.json
```

```powershell
# Windows (PowerShell)
Remove-Item "$env:APPDATA\SubFrame\frame-settings.json" -ErrorAction SilentlyContinue
Remove-Item "$env:APPDATA\SubFrame\ai-tool-config.json" -ErrorAction SilentlyContinue
Remove-Item "$env:APPDATA\SubFrame\window-state.json" -ErrorAction SilentlyContinue
```

### Full Reset (Remove All Data)

::: warning
This removes all settings, workspace data, and project associations. Your actual project files are never affected.
:::

```bash
# macOS
rm -rf ~/Library/Application\ Support/SubFrame/

# Linux
rm -rf ~/.config/SubFrame/
```

```powershell
# Windows (PowerShell)
Remove-Item -Recurse -Force "$env:APPDATA\SubFrame\"
```

The global workspace configuration is stored separately:

```bash
# macOS/Linux
rm -rf ~/.subframe/

# Windows (PowerShell)
Remove-Item -Recurse -Force "$env:USERPROFILE\.subframe\"
```

### Reinstall SubFrame

1. Uninstall SubFrame using your platform's standard method
2. Perform a [Full Reset](#full-reset-remove-all-data) to remove residual data
3. Download the latest release from [GitHub Releases](https://github.com/Codename-11/SubFrame/releases)
4. Install and launch

## Getting Help

If you cannot resolve your issue with this guide, open a bug report:

**[GitHub Issues](https://github.com/Codename-11/SubFrame/issues)**

When filing a bug report, include:

- **SubFrame version** (visible in the title bar or `package.json`)
- **Operating system and version** (e.g., Windows 11 23H2, macOS 14.5, Ubuntu 24.04)
- **AI tool and version** (e.g., Claude Code 1.0.3)
- **Steps to reproduce** the issue
- **Error messages** from the developer console (<kbd>Ctrl+Shift+I</kbd> > Console tab)
- **Terminal output** from the terminal that launched SubFrame (if applicable)

::: tip
To collect diagnostic information quickly, open the developer tools (<kbd>Ctrl+Shift+I</kbd>), switch to the Console tab, and copy any error messages. Red-highlighted entries are the most relevant.
:::
