---
id: task-mm8ia8mw-1ofh
title: Real-time agent state visualization
status: completed
priority: high
category: feature
blockedBy: []
blocks: []
createdAt: '2026-03-02T01:34:21.751Z'
updatedAt: '2026-03-02T01:34:32.734Z'
completedAt: '2026-03-02T01:34:32.734Z'
context: Session 2026-03-02
---
Live monitoring of Claude Code agent sessions in SubFrame. Ports & Adapters architecture: Claude Code PreToolUse/PostToolUse hooks write to .subframe/agent-state.json, main process watches via fs.watch, renderer displays via AgentStateView/AgentTimeline/SidebarAgentStatus. 4 new IPC channels, Ctrl+Shift+A shortcut, terminal navbar Agents button.

## User Request
> Enhance Sub-Tasks with sidebar-timeline/stepper, full view, real-time agent/session visualization inspired by claude-code-by-agents project
