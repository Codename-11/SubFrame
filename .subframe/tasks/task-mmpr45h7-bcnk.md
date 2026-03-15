---
id: task-mmpr45h7-bcnk
title: Terminal Ctrl+click file path opening
status: completed
priority: medium
category: feature
blockedBy: []
blocks: []
createdAt: '2026-03-14T03:13:39.259Z'
updatedAt: '2026-03-14T03:27:31.944Z'
completedAt: '2026-03-14T03:27:31.944Z'
context: Session 2026-03-14
---
Detect file paths in terminal output and allow Ctrl+click to open them in the editor. Match common path patterns (relative and absolute).

## Steps
- [ ] Implement file path regex detection
- [ ] Register custom link provider with xterm
- [ ] Ctrl+click handler opens file in editor via IPC
