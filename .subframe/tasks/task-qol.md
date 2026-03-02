---
id: task-qol
title: UI & QoL enhancements
status: completed
priority: high
category: feature
blockedBy: []
blocks: []
createdAt: '2026-02-28T21:00:00Z'
updatedAt: '2026-03-01T22:58:25.849Z'
completedAt: '2026-03-01T22:58:25.849Z'
context: >-
  Session 2026-02-28 - Spinoff from original repo, comprehensive QoL
  enhancements
---
Comprehensive UI, QoL, and cross-platform improvements. (1) Project Renaming - double-click/right-click/F2 rename. (2) Customizable AI Start Command - editable per-tool via settings. (3) Windows Usage Bars - cross-platform OAuth from credentials file + Keychain fallback. (4) Settings Panel - 3 sections: General (auto-terminal toggle), AI Tool Config, Terminal. (5) Terminal UX - scroll-to-bottom button, lineHeight/letterSpacing fixes. (6) Windows Sessions Fix - encodeProjectPath handles backslashes/colons. (7) Tasks Panel - always loads on project change, fs.watch() real-time updates, refresh button, trailing-comma-tolerant JSON. (8) Windows Audit - replaced Unix shell commands in overviewManager with Node.js equivalents. (9) Sidebar Collapse - bottom collapse icon, expand tab when hidden, localStorage persistence. (10) Cross-platform Dev Tooling - scripts/dev.js, DEV_SETUP.bat + dev_setup.ps1. (11) Docs - README.md and QUICKSTART.md updated with Windows setup, commands, roadmap. (12) Startup Performance - splash window, in-app loading screen, two-phase renderer init (initCritical/initDeferred), window state persistence, debounced resize, D3 defer. (13) Sessions Panel Rewrite - scans .jsonl files instead of non-existent sessions-index.json, state dots (active/recent/inactive with pulse), split resume button with dropdown (default tool, claude, claude --continue, custom), HTML tag stripping, sessions tab first with icons. (14) Claude Panel Collapse - collapse arrow shrinks to 44px icon strip, click icons to expand, X to fully hide.

## User Request
> Projects can't be named, can't modify claude start command, Windows usage bars show --, no settings panel, terminal logo crunched, no scroll-to-bottom. Follow-ups: fix tasks not loading, sessions broken on Windows, audit Windows issues, update docs, sidebar collapse, auto-terminal as setting, startup UI freeze on maximize.

## Acceptance Criteria
1. Project rename via double-click/context menu. 2. AI start command customizable per-tool. 3. Usage bars work on Windows. 4. Settings panel with General/AI/Terminal sections. 5. Scroll-to-bottom button. 6. ASCII logo renders cleanly. 7. Sessions load on Windows. 8. Tasks load on project change with real-time watching. 9. Overview metrics cross-platform. 10. Sidebar collapsible. 11. DEV_SETUP.bat automates Windows prereqs. 12. Docs updated. 13. Splash screen on startup, no UI freeze on maximize, window state persisted. 14. Sessions show with state dots and resume from panel. 15. Claude panel collapses to icon strip.

## Notes
Scope grew from 5 to 15 items. Pivoted from upstream PR to spinoff due to scope of planned changes. All changes are cross-platform safe.
