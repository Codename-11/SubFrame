---
id: task-mm9tf4l0-3s7o
title: Electron auto-updater
status: completed
priority: low
category: feature
blockedBy: []
blocks: []
createdAt: '2026-03-02T23:33:51.731Z'
updatedAt: '2026-03-03T00:00:13.308Z'
completedAt: '2026-03-03T00:00:13.308Z'
context: Session 2026-03-02
---
Implement self-updating via electron-updater. Check GitHub Releases for new versions, show in-app notification, one-click install. Use delta updates to minimize download size. This is the immediate solution — the transport abstraction sub-task covers the future CDN-loaded renderer approach for browser mode.

## Notes
[2026-03-02] Implementing standard electron-updater first. Transport abstraction (for future browser mode) tracked separately.
[2026-03-03] Implemented electron-updater auto-update system: updaterManager (main), useUpdater hook (renderer), UpdateNotification toast component, SettingsPanel 'Check for Updates' button, 5 IPC channels. Dev mode guard prevents crashes in development. Build and typecheck pass.
