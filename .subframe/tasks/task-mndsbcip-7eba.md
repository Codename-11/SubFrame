---
id: task-mndsbcip-7eba
title: 'Phase A: PTY broker daemon + renderer differential updates'
status: pending
priority: medium
category: feature
blockedBy: []
blocks: []
createdAt: '2026-03-30T22:53:42.816Z'
updatedAt: '2026-03-30T22:53:42.816Z'
completedAt: null
context: Session 2026-03-30
---
Long-term hot-update evolution. Two components: (1) PTY broker daemon — a persistent Node process that owns all PTYs via socket API. SubFrame connects as a client, enabling true detach/reattach across full app restarts, OS reboots, and multi-device access (tmux model). (2) Renderer differential updates — split renderer out of ASAR into a writable location (userData/renderer/), add a differential update mechanism to download just the renderer bundle, then use the existing reloadIgnoringCache() + TERMINAL_RESYNC plumbing to apply UI updates without any restart. Both build on the Phase B/C foundation (session snapshot, renderer reload, terminal resync IPC) already shipped in v0.13.0-beta.

## User Request
> Keep terminals alive across updates without restart. Phase A from hot-update roadmap.

## Acceptance Criteria
PTY broker: terminals survive full app restart without snapshot/restore. Differential updates: renderer-only releases apply via hot reload without quitAndInstall.
