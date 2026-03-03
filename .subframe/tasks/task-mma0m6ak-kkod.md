---
id: task-mma0m6ak-kkod
title: 'Agent persona visualization — avatar cards, sub-agent tree, and task/tool map'
status: pending
priority: medium
category: feature
blockedBy: []
blocks: []
createdAt: '2026-03-03T02:55:17.851Z'
updatedAt: '2026-03-03T02:55:17.851Z'
completedAt: null
context: Session 2026-03-03
---
Add a visual personification view for agents that makes multi-session and sub-agent workflows tangible and intuitive.

## Vision
A visual panel that shows agents as 'characters' — each with an avatar/icon, name, status aura, and a live tree of their sub-agents and current tasks/tools. Think of it as a team roster view that brings the abstract agent concept to life.

## Requirements
1. **Agent avatar cards** — Each session gets a card with:
   - Generated avatar/icon (robot face, color-coded by session, or user-configurable)
   - Agent name (e.g., 'Claude', 'Researcher', 'Code Reviewer')
   - Status aura/ring (pulsing green=active, amber=busy, gray=idle)
   - Current tool badge and task label
   - Step counter / mini progress bar
2. **Sub-agent tree** — When a session spawns sub-agents (via Agent tool), show them as child nodes connected to the parent card with animated connector lines
   - Tree layout: parent at top/left, children branching below/right
   - Framer Motion enter/exit animations for spawning/completing sub-agents
   - Collapsed view for completed sub-agents
3. **Task/tool distribution view** — Visual breakdown of what each agent is doing:
   - Tool usage donut/bar (Read, Edit, Bash, Agent, etc.)
   - Current task label with progress
   - Time elapsed per session
4. **Multi-session layout** — When multiple sessions are active:
   - Side-by-side agent cards (2-up in sidebar, full grid in full-view)
   - Session isolation clear (separate card boundaries)
5. **Integration** — Available as a tab/view in the Agent group (alongside Activity, Sessions, etc.)

## Data Sources
- `AgentSession` already has `parentSessionId`, `agentName`, `currentTool`, `currentTask`, `steps[]`
- Tool usage stats can be derived from `steps[].toolName` aggregation
- Session timing from `startedAt` / `lastActivityAt`

## Acceptance Criteria
- Agent cards render with status-colored aura and tool badge
- Sub-agent hierarchy visually represented as a tree
- Multiple sessions render side-by-side with clear boundaries
- Smooth animations for agent spawn/complete lifecycle
- Works in both sidebar (compact) and full-view modes
