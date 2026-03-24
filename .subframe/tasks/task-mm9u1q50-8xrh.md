---
id: task-mm9u1q50-8xrh
title: Transport abstraction layer (IPC → pluggable)
status: completed
priority: medium
category: refactor
blockedBy: []
blocks: []
createdAt: '2026-03-02T23:51:26.099Z'
updatedAt: '2026-03-23T23:48:52.774Z'
completedAt: '2026-03-23T23:48:52.774Z'
context: Session 2026-03-02
---
Refactor src/renderer/lib/ipc.ts to use a pluggable Transport interface. Extract ElectronTransport (current window.electron.invoke) and prepare WebSocketTransport stub for future browser mode. useIpcQuery/useIpcMutation stay unchanged — only the underlying transport swaps. This unlocks: CDN-loaded renderer for instant UI updates in Electron, browser mode via subframe-server, and mobile/tablet access. Depends on subframe-server being ready for the WebSocket side.
