# Release Notes - v0.9.0-beta (2026-03-24)

SubFrame v0.9.0-beta is a major feature release introducing the **SubFrame Server**, **Mobile & PWA support**, and a significant **AI Tool Settings overhaul**. This release decouples the renderer from Electron, enabling remote access via web browsers and mobile devices.

## 🚀 Key Features

### 🌐 SubFrame Server & Remote Access
Serve SubFrame's UI as a web app with real-time WebSocket transport.
- **WebSocket Transport**: Decoupled renderer logic for seamless remote interaction.
- **Mobile Responsive Layout**: Optimized bottom-nav UI for phone browsers.
- **PWA Support**: Installable Progressive Web App for standalone mobile experience.
- **Setup Wizard**: Guided SSH tunnel and service discovery configuration.

### 🛠️ AI Tool & Settings Overhaul
- **Card-based AI Tool UI**: All tools displayed as interactive cards with availability indicators.
- **Per-tool Flag Toggles**: Toggle YOLO, verbose, sandbox, and auto-edit modes directly.
- **Dangerous Flag Protection**: Red-coded flags with confirmation dialogs for destructive actions.
- **Composed Command Preview**: Real-time preview of the full command being sent to the terminal.

### ⌨️ Terminal Enhancements
- **Shell Restart (Ctrl+Shift+R)**: Restart the PTY process with fresh environment variables to pick up PATH changes.
- **Terminal Freeze (Ctrl+Shift+F)**: Stop rendering output to save resources during long builds while keeping the process alive.
- **Persistence UI**: Configure `restoreOnStartup`, `restoreScrollback`, and `autoResumeAgent` in Settings.

### 🎛️ System Panel & Integrations
- **System Activity Panel (Ctrl+Shift+U)**: New dashboard for version status, AI tool management, and integration health.
- **Local API Server**: Expose terminal state to external tools via token-authenticated endpoints.
- **DTSP Discovery**: Automatic registration for Desktop Text Source Protocol consumers.

---

## 📝 Changelog

### Added
- **SubFrame Server** — web app UI with WebSocket transport, takeover support, and pairing codes.
- **Mobile & PWA** — Responsive layout and manifest for mobile installation.
- **Transport Abstraction** — decooupled renderer from Electron IPC for multi-platform support.
- **System Panel** — dashboard for version, AI tools, and integration management.
- **Terminal Persistence UI** — configuration for session recovery and agent auto-resume.
- **Terminal shortcuts** — Ctrl+Shift+R (Restart) and Ctrl+Shift+F (Freeze).
- **Experimental TUI Recovery** — detection and reset for stalled terminal interfaces.
- **Workspace Pills** — horizontal tab bar for workspace switching with agent status indicators.

### Fixed
- **CodeMirror selection highlight** — fixed word-matching highlights across all themes.
- **Terminal viewport sync** — fixed scroll-to-bottom issues after workspace switches.
- **API Server stability** — fixed crash recovery and stale config cleanup.
- **Usage stats indicators** — fixed data source mismatch and cache age display.

---

## 📦 Installation & Update

Grab the latest installer from [GitHub Releases](https://github.com/Codename-11/SubFrame/releases/tag/v0.9.0-beta).

- **Windows**: `SubFrame-Setup-0.9.0-beta.exe`
- **macOS**: `SubFrame-0.9.0-beta.dmg`
- **Linux**: `SubFrame-0.9.0-beta.AppImage`

**Note:** If you have SubFrame already installed, you can update via the in-app notification or the **Check for Updates** button in the System Panel.
