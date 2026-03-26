# Release Notes - v0.10.0-beta (2026-03-25)

SubFrame v0.10.0-beta turns the new web/mobile server into a much more complete live companion to the desktop host. This release focuses on remote parity, safer local-network access, stronger browser-side IPC routing, and a broader workspace/settings polish pass.

## Key Features

### SubFrame Server: practical remote access
- **Trusted-LAN hosting mode** lets you serve SubFrame directly on your local network for phones and tablets, with explicit warnings when you leave localhost-only mode.
- **Base-URL pairing** means remote devices can open the raw host URL and then pair with a short code or pasted token instead of relying on a long tokenized link.
- **Preferred port support** keeps integrations and bookmarks more stable by reusing the last successful port in auto mode or honoring a fixed preferred port.
- **Better connection UX** now shows both base URL and connection URL in settings, plus mirror-target context so it is clear what the remote client will attach to.

### Remote session parity
- **Live hydration from the host session** now carries the active workspace, project, terminal session data, and more UI state into the web client.
- **Mirrored dialogs and panels** keep side panels, full-view tabs, and settings state aligned across the desktop host and browser client.
- **Remote cursor tracking** is available as an opt-in UI feature so the host can see where the remote device is pointing or tapping.
- **Mobile panel parity** now includes Sub-Tasks and the broader panel surface instead of exposing a reduced remote shell.

### Workspace and terminal polish
- **Workspace pills** are more expressive: index, short labels, icons, mixed display combinations, terminal badges, AI badges, and drag-to-reorder support.
- **Terminal mix mode** allows temporarily showing terminals from multiple projects in the same workspace view.
- **Hover actions** make pinning and freezing easier to discover, and grid headers now expose freeze/resume alongside pop-out controls.
- **Settings layout refresh** gives the larger feature set more space and separates workspace-pill controls from unrelated theme actions.

## Fixes and Hardening

- **Web asset serving on Windows** now resolves the correct browser bundle paths instead of falling back to HTML and triggering MIME-type errors.
- **Older Android browsers** no longer fail live-session hydration when `crypto.randomUUID()` is missing.
- **Browser IPC routing** now supports more of the Electron-style invoke/send/reply patterns that remote features depend on, including tasks, workspace state, updater actions, CLI/context-menu handlers, and terminal creation flows.
- **Remote panel rendering** fixes prevent Sub-Tasks and other mobile panels from silently collapsing because of bad flex containers.
- **Settings sync flicker** is addressed by suppressing self-echo loops in mirrored UI snapshot updates.

## Installation and Update

Grab the latest installer from [GitHub Releases](https://github.com/Codename-11/SubFrame/releases/tag/v0.10.0-beta).

- **Windows**: `SubFrame-Setup-0.10.0-beta.exe`
- **macOS**: `SubFrame-0.10.0-beta.dmg`
- **Linux**: `SubFrame-0.10.0-beta.AppImage`

If you already have SubFrame installed, update through the in-app updater or the System Panel.
