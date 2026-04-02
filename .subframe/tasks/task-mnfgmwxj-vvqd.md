---
id: task-mnfgmwxj-vvqd
title: AI tool capability badges in Settings/AI Tool Palette UI
status: pending
priority: low
category: enhancement
blockedBy: []
blocks: []
createdAt: '2026-04-01T03:02:19.438Z'
updatedAt: '2026-04-01T03:02:19.438Z'
completedAt: null
context: Session 2026-04-01
---
Show feature badges in the AI Tool settings panel and AI Tool Palette using the AIToolFeatures data. Display icons/badges for: hooks support, streaming output, hook maturity level, plugins. Link to each tool's docs via docsUrl/hooksDocsUrl. Gracefully degrade — dim/disable features not supported by the active tool.

## Steps
- [ ] Read features from useAIToolConfig hook
- [ ] Add badge components for key capabilities
- [ ] Show in SettingsPanel AI tool section and AIToolPalette
- [ ] Add tooltip with doc link for each badge

## Acceptance Criteria
Settings panel shows capability badges per tool. Users can see at a glance what each tool supports.
