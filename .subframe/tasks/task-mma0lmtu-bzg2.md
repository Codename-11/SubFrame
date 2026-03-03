---
id: task-mma0lmtu-bzg2
title: Enhanced agent activity view with session differentiation
status: pending
priority: medium
category: feature
blockedBy: []
blocks: []
createdAt: '2026-03-03T02:54:52.625Z'
updatedAt: '2026-03-03T02:54:52.625Z'
completedAt: null
context: Session 2026-03-03
---
Overhaul AgentStateView to better differentiate separate Claude Code sessions and add visual hierarchy for sub-agents.

## Current State
- AgentStateView shows a flat session list in full-view, single active session in panel mode
- SessionCard shows agent name, status badge, current tool, step count
- SidebarAgentStatus shows a pulsing dot + tool name
- Data model already has parentSessionId for sub-agent hierarchy (unused in UI)
- Sessions are listed but not visually distinguished (same card style for main vs sub-agent)

## Requirements
1. **Session sidebar** — Collapsible session list in panel mode (not just full-view), grouped by main session with nested sub-agents indented underneath
2. **Status indicators** — Per-session status dots in sidebar with distinct colors (active=green pulse, busy=amber pulse, idle=gray, completed=dim)
3. **Session differentiation** — Visual distinction between main agent and sub-agents (indentation, smaller cards, parent→child connectors)
4. **Multi-session awareness** — When multiple Claude sessions are running (e.g., team mode), show all with clear separation
5. **Sidebar agent status enhancement** — Show count of active sessions, expand on click to show mini session list
6. **Timeline grouping** — Group steps by session in the timeline when viewing all activity

## Acceptance Criteria
- Panel mode shows session sidebar + timeline (not just a single card)
- Sub-agents visually nested under parent sessions
- Multiple concurrent sessions clearly differentiated
- SidebarAgentStatus shows session count badge when >1 active
