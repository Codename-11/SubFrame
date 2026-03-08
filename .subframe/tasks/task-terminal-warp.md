---
id: task-terminal-warp
title: Warp-style terminal UX improvements
status: in_progress
priority: high
category: feature
blockedBy: []
blocks: []
createdAt: '2026-02-28T23:00:00.000Z'
updatedAt: '2026-03-07T13:43:32.751Z'
completedAt: '2026-03-02T23:38:15.743Z'
context: Session 2026-02-28 - Terminal UX modernization
---
Modernize terminal UX inspired by Warp terminal. (1) Smart Ctrl+C — copy to clipboard when text is selected (via terminal.hasSelection()), send SIGINT when no selection. (2) Ctrl+V — intercept before xterm.js and paste from clipboard API (currently requires Ctrl+Shift+V). (3) Right-click context menu — replace current paste-only behavior with a proper context menu: Copy, Paste, Select All, Clear Terminal. (4) Shift+Enter — insert literal newline in multi-line input mode. (5) Scroll-to-bottom overlay — verify existing floating button is polished and visible per-terminal in both tab and grid views. Files: terminalManager.js (key handler rewrite), terminal.css (context menu styles), multiTerminalUI.js (scroll button per-terminal verification).

## Notes
[2026-03-03] Reimplemented all terminal UX changes: WebGL/Canvas/Search addons, Framer Motion animated tabs with drag-to-reorder, live output overlay, search bar (Ctrl+F), Shift+Enter newline, animated scroll button, workspace terminal scoping (activeByProject + switchToProject + projectTerminals prop)
[2026-03-07] Implemented: reuse idle terminal (with setting), agent status broadcasting, bot icon in tabs/grid, auto-rename tabs, agent activity full-view popout, multi-session panel/sidebar, session differentiation with timestamps
[2026-03-07] Added session↔terminal correlation via timestamp matching in ptyManager. Jump to terminal button in AgentStateView session cards and full-view detail pane.

## Notes
Current stack: xterm.js 5.3.0 + node-pty 1.0.0 + xterm-addon-fit 0.8.0. Key handler is in terminalManager.js attachCustomKeyEventHandler. Warp uses its own Rust-based renderer — we stay on xterm.js but match the UX patterns.

## User Request
> I want to compare to Warp terminal and their clean smooth terminal features. I want the ability to have right click context and ctrl+c and ctrl+v and shift+enter features in terminal properly and overlay to scroll to bottom like they have per terminal.

## Acceptance Criteria
1. Ctrl+C copies when selection exists, sends SIGINT otherwise. 2. Ctrl+V pastes from clipboard directly. 3. Right-click opens context menu with Copy/Paste/Select All/Clear. 4. Shift+Enter inserts newline. 5. Scroll-to-bottom button visible and functional per terminal in tab and grid views.
