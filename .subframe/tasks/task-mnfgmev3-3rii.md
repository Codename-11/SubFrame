---
id: task-mnfgmev3-3rii
title: Deploy ACP hooks for Gemini CLI projects
status: pending
priority: medium
category: feature
blockedBy:
  - task-mmifstga-beor
blocks: []
createdAt: '2026-04-01T03:01:56.029Z'
updatedAt: '2026-04-01T03:01:56.029Z'
completedAt: null
context: Session 2026-04-01
---
Generate and deploy BeforeTool/AfterTool hooks for Gemini CLI in frameTemplates.ts. Gemini uses settings.json with BeforeTool/AfterTool events. Write to .subframe/agent-state.json using the same format. Must be deployed during subframe init when Gemini is detected as the active tool.

## Steps
- [ ] Add Gemini hook template to frameTemplates.ts
- [ ] Update projectInit.ts to deploy Gemini settings hooks when Gemini detected
- [ ] Test with Gemini CLI in a SubFrame project
- [ ] Rebuild templates: node scripts/build-templates.js

## Acceptance Criteria
Gemini CLI projects get hooks deployed during init that write to agent-state.json on tool use
