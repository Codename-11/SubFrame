# Claude Code IDE

A lightweight, IDE-style desktop application built specifically for working with [Claude Code](https://claude.com/claude-code). Think VS Code, but streamlined for Claude Code workflows.

## What is this?

This is an Electron-based desktop application that combines:
- **Project Explorer** (left panel) - Browse your project files with a collapsible tree view
- **Full Terminal** (center) - A real PTY terminal powered by xterm.js where Claude Code runs
- **Prompt History** (right panel) - See all your commands with timestamps

The key innovation: **Claude Code launches directly in your selected project directory**, so you don't need to `cd` around. Just select a project, click "Start Claude Code", and you're ready to go.

## Why build this?

When working with Claude Code, you often need to:
1. See your project structure
2. Run Claude Code in the right directory
3. Track what commands you've run
4. Switch between projects quickly

This app does all of that in one window, with a clean VS Code-inspired interface.

## Screenshots

```
┌──────────────┬─────────────────────────┬──────────────┐
│   Project    │      Terminal           │   Prompt     │
│   Explorer   │    (Claude Code)        │   History    │
│              │                         │              │
│ 📁 src/      │  $ claude               │ 2026-01-21   │
│   📄 app.js  │  > Help me refactor...  │ > claude     │
│ 📁 test/     │                         │              │
│ 📄 README.md │  [Claude response]      │ 2026-01-21   │
│              │                         │ > /init      │
│ [Start       │                         │              │
│  Claude]     │                         │              │
└──────────────┴─────────────────────────┴──────────────┘
```

## Features

### ✅ Core Features
- **IDE Layout**: 3-panel design (explorer, terminal, history)
- **Real Terminal**: Full PTY support via node-pty - not a fake terminal
- **File Tree**: Collapsible folders, 5 levels deep, filters node_modules
- **Project-Aware**: Terminal starts in your selected project directory
- **Prompt History**: All commands saved with timestamps, viewable in side panel
- **Cross-Platform**: Windows, macOS, Linux support

### ✅ Smart Defaults
- **PowerShell Selection**: Tries PowerShell Core first, falls back to Windows PowerShell
- **Keyboard Shortcuts**:
  - `Ctrl+K` - Start Claude Code
  - `Ctrl+Shift+H` - Toggle history panel
  - `Ctrl+I` - Run /init
  - `Ctrl+Shift+C` - Run /commit
- **Focus Management**: Enter key only works in terminal, never on buttons
- **Auto-resize**: Terminal adjusts when panels open/close

### ✅ Quality of Life
- File icons (folders, JS, JSON, MD)
- Alphabetical sorting (folders first)
- VS Code dark theme
- Scrollable history (10,000 lines)
- Menu bar commands for quick access

## Tech Stack

| Component | Technology | Why? |
|-----------|-----------|------|
| Desktop Framework | Electron 28 | Cross-platform, mature, well-documented |
| Terminal Emulator | xterm.js 5.3 | Industry standard (used by VS Code) |
| PTY | node-pty 1.0 | Real pseudo-terminal, not subprocess pipes |
| UI | HTML/CSS/JS | Native Electron renderer |

**Why these choices?**
- **Electron**: One codebase, works everywhere
- **xterm.js**: Full VT100/ANSI support, handles colors, progress bars, everything Claude Code outputs
- **node-pty**: Creates a real PTY so Claude Code thinks it's in a real terminal

## Installation

### Prerequisites
- Node.js 16+ (https://nodejs.org)
- npm (comes with Node.js)
- Git (optional, for cloning)

### Steps

```bash
# Clone the repo
git clone https://github.com/kaanozhan/ClaudeCodeIDE.git
cd ClaudeCodeIDE

# Install dependencies
npm install

# Run the app
npm start
```

That's it! The app will launch.

### Installing Claude Code
If you don't have Claude Code installed:
```bash
npm install -g @anthropic-ai/claude-code
```

## Usage

### Basic Workflow

1. **Launch the app**: `npm start`
2. **Select a project**:
   - Click "Select Project Folder"
   - Browse to your project directory
   - File tree loads automatically
3. **Start Claude Code**:
   - Click "Start Claude Code" button
   - Or press `Ctrl+K`
   - Claude Code launches in that directory
4. **View history**:
   - Press `Ctrl+Shift+H`
   - See all your commands with timestamps

### Tips

**Multiple Projects**
- Switch projects anytime with "Select Project Folder"
- Terminal restarts in the new directory
- File tree updates automatically

**Prompt History**
- Automatically logs all terminal input
- Stored at: `%APPDATA%/claude-terminal/prompts-history.txt` (Windows) or `~/Library/Application Support/claude-terminal/prompts-history.txt` (macOS)
- Open in text editor: `Ctrl+H`
- View in side panel: `Ctrl+Shift+H`

**Keyboard Shortcuts**
- See menu bar for all shortcuts
- Most have `Ctrl` (Windows/Linux) or `Cmd` (macOS) variants

## Development

### Project Structure

```
ClaudeCodeIDE/
├── main.js              # Electron main process (backend)
│                        # - PTY management
│                        # - File system operations
│                        # - IPC handlers
│
├── renderer.js          # Electron renderer (frontend)
│                        # - xterm.js setup
│                        # - UI interactions
│                        # - File tree rendering
│
├── index.html           # UI layout and styles
│
├── package.json         # Dependencies and scripts
│
├── PROJECT_NOTES.md     # Detailed technical docs
│                        # - Architecture diagrams
│                        # - Implementation details
│                        # - Lessons learned
│
└── README.md            # This file
```

### Key Files Explained

**main.js** - The Node.js backend
- Spawns the PTY (PowerShell or bash)
- Reads file system for the file tree
- Handles folder picker dialogs
- Manages prompt logging
- Routes IPC messages between renderer and PTY

**renderer.js** - The browser frontend
- Sets up xterm.js terminal
- Renders the collapsible file tree
- Handles button clicks and keyboard shortcuts
- Manages panel visibility (history panel)
- Sends user input to main process

**index.html** - The UI
- Three-panel flexbox layout
- Sidebar: project info + file tree
- Center: terminal container
- Right: prompt history panel (hidden by default)
- VS Code-inspired color scheme

### Architecture

```
┌─────────────────────────────────────────────────────┐
│           Electron Main Process (Node.js)           │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌─────────────────┐  │
│  │ node-pty │  │ File     │  │ Prompt Logger   │  │
│  │ (PTY)    │  │ System   │  │ (history.txt)   │  │
│  └──────────┘  └──────────┘  └─────────────────┘  │
│         │             │                 │          │
│         └─────────────┴─────────────────┘          │
│                       │                            │
│                    IPC Channel                     │
│                       │                            │
└───────────────────────┼────────────────────────────┘
                        │
┌───────────────────────┼────────────────────────────┐
│           Electron Renderer (Browser)              │
│                       │                            │
│  ┌────────────┬───────┴──────┬──────────────┐     │
│  │  Sidebar   │   xterm.js   │   History    │     │
│  │  (File     │   Terminal   │   Panel      │     │
│  │   Tree)    │              │              │     │
│  └────────────┴──────────────┴──────────────┘     │
└────────────────────────────────────────────────────┘
```

**IPC Messages:**
- `start-terminal` - Start the PTY
- `restart-terminal` - Restart PTY with new working directory
- `terminal-input` - User typed something
- `terminal-output` - PTY sent output
- `select-project-folder` - Show folder picker
- `project-selected` - User selected a folder
- `load-file-tree` - Get folder contents
- `file-tree-data` - Folder contents response
- `load-prompt-history` - Get history file
- `prompt-history-data` - History file response

### Adding Features

**Want to add a new panel?**
1. Add HTML container in `index.html`
2. Add CSS styles for the panel
3. Update flexbox layout (`#main-content`)
4. Add toggle function in `renderer.js`
5. Add IPC handlers if backend data needed

**Want to add a command shortcut?**
1. Add menu item in `main.js` (menuTemplate)
2. Add IPC message sender
3. Add IPC receiver in `renderer.js`
4. Implement the command logic

**Want to change the terminal behavior?**
- PTY spawning: `main.js` → `startPTY()` function
- Terminal rendering: `renderer.js` → xterm.js setup
- Terminal theme: `index.html` → terminal color definitions

## Building for Production

```bash
# Install electron-builder
npm install electron-builder --save-dev

# Add to package.json:
"scripts": {
  "build": "electron-builder"
},
"build": {
  "appId": "com.claudecode.ide",
  "productName": "Claude Code IDE",
  "files": ["main.js", "renderer.js", "index.html", "package.json"],
  "directories": {
    "output": "dist"
  },
  "win": {
    "target": "nsis"
  },
  "mac": {
    "target": "dmg"
  },
  "linux": {
    "target": "AppImage"
  }
}

# Build
npm run build
```

Output: `dist/` folder with installers for your platform

## Troubleshooting

### "claude: command not found"
Claude Code is not installed. Install it:
```bash
npm install -g @anthropic-ai/claude-code
```

### "Cannot find module 'node-pty'"
Dependencies not installed:
```bash
npm install
```

### Terminal shows "Windows PowerShell" header
This is normal if PowerShell Core (`pwsh`) is not installed. The app falls back to Windows PowerShell. To get PowerShell Core:
```bash
winget install Microsoft.PowerShell
```

### File tree not showing
- Check that you selected a valid folder
- Check console for errors: View → Toggle DevTools
- Try clicking "Select Project Folder" again

### History panel blank
- You haven't run any commands yet
- Or history file doesn't exist yet
- Run a few terminal commands, then press `Ctrl+Shift+H` again

## Roadmap

See [PROJECT_NOTES.md](./PROJECT_NOTES.md) for detailed roadmap.

### Short-term
- [ ] Click file in tree → run `cat` command
- [ ] Refresh button for file tree
- [ ] Search in files
- [ ] Resizable sidebar

### Medium-term
- [ ] Mini text editor
- [ ] Git status integration
- [ ] Multiple terminal tabs
- [ ] Settings panel

### Long-term
- [ ] Full Claude chat sidebar
- [ ] Extensions/plugins
- [ ] Remote development (SSH)
- [ ] Built-in debugger

## Contributing

This is a POC/personal project, but contributions welcome!

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](./LICENSE) file

## Acknowledgments

- Built with [Claude Code](https://claude.com/claude-code) (meta!)
- Terminal powered by [xterm.js](https://xtermjs.org/)
- PTY via [node-pty](https://github.com/microsoft/node-pty)
- Inspired by VS Code's terminal

## Questions?

See [PROJECT_NOTES.md](./PROJECT_NOTES.md) for:
- Detailed architecture
- Implementation decisions
- Code examples
- Lessons learned during development

---

**Status**: ✅ MVP Complete - Fully functional IDE layout with file explorer and prompt history

**Started**: January 21, 2026
**Author**: Built in collaboration with Claude Code
