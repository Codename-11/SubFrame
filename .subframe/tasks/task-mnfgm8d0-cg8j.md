---
id: task-mnfgm8d0-cg8j
title: Deploy ACP hooks for Codex CLI projects
status: pending
priority: medium
category: feature
blockedBy:
  - task-mmifstga-beor
blocks: []
createdAt: '2026-04-01T03:01:47.602Z'
updatedAt: '2026-04-01T03:01:47.602Z'
completedAt: null
context: Session 2026-04-01
---
Generate and deploy pre-tool-use/post-tool-use hooks for Codex CLI in frameTemplates.ts. Codex uses .codex/hooks.json with PreToolUse/PostToolUse events (same stdin JSON schema as Claude). Write to .subframe/agent-state.json using the same format. Must be deployed during subframe init when Codex is detected as the active tool.

## Steps
- [ ] Add Codex hook template to frameTemplates.ts
- [ ] Update projectInit.ts to deploy .codex/hooks.json when Codex detected
- [ ] Test with Codex CLI in a SubFrame project
- [ ] Rebuild templates: node scripts/build-templates.js

## Acceptance Criteria
Codex CLI projects get hooks deployed during init that write to agent-state.json on tool use
