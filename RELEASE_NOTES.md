Adds git sync awareness, editor enhancements with tab mode, CLI integration for opening files/projects from the terminal, and documentation updates across the board.

## What's Changed

### Features
- **Git Auto-Fetch** - Opt-in background fetch interval (3-15 minutes) in Settings > Git, with sync status header in the GitHub panel showing branch, ahead/behind, and change counts
- **Editor Find & Replace** - Ctrl+H opens CodeMirror's built-in search panel with regex support
- **Editor Go to Line** - Ctrl+L opens go-to-line dialog; also available via toolbar button
- **Editor Tab Mode** - Toggle between overlay dialog (default) and persistent tabs alongside terminal tabs, with recent files tracking (last 10)
- **CLI Integration** - `subframe edit <file>`, `subframe open <dir>`, and `subframe .` from the command line. Single-instance enforcement forwards args to the running window
- **macOS File Associations** - Open files via Finder or `open -a SubFrame file.ts` with pre-ready path queuing

### Improvements
- **Code Folding** - Fold gutters with clickable arrows for collapsible code blocks
- **Rectangular Selection** - Alt+drag for column selection in the editor
- **Active Line Highlighting** - Current line subtly highlighted in the editor
- **Editor Shortcuts Category** - Find/Replace and Go to Line appear in the keyboard shortcuts panel

### Bug Fixes
- **Ctrl+G Conflict** - Go to Line changed from Ctrl+G (conflicted with grid toggle) to Ctrl+L
- **macOS open-file Race** - File path no longer dropped when the window isn't ready yet
- **Auto-fetch Timer Leak** - Timer properly stopped on app close
- **Push Button Stub** - Removed fake "push" button that only showed a toast

### Documentation
- CLAUDE.md: added 8 missing managers, 6 missing components, utility sections, CLI command
- README.md: added CLI Integration section and updated feature descriptions
- docs/guide/features.md: added Activity Streams, CLI, editor tab mode, git sync sections
