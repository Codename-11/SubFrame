Bug fix release addressing workspace management, sidebar UX, and spellcheck support.

## What's Changed

### Features
- **Spellcheck App-Wide** - Enabled Chromium spellcheck across all text inputs and textareas
- **Collapsed Sidebar Agent Badge** - Agent status shows Bot icon + pulse dot + count badge with tooltip when sidebar is collapsed

### Bug Fixes
- **Add Folder Not Working** - "Select Folder..." dialog opened the native picker but never added the project to the workspace — now correctly persists and refreshes the project list
- **Auto-Select New Project** - Projects added via folder picker are now automatically selected in the sidebar
- **Sidebar Git Icon Target** - Collapsed git status icon now opens the Changes tab instead of Issues
- **WorkspaceSelector Re-Render** - Fixed `require()` inside component body causing useEffect to re-fire every render
- **IPC Type Mismatch** - Fixed `WORKSPACE_UPDATED` channel type declaration to match actual payload shape

### Documentation
- **README Promo Video** - Replaced `<video>` tag (not rendered by GitHub) with user-attachments URL for inline playback

---

> This is a beta release. Expect rough edges — please report issues on GitHub.
