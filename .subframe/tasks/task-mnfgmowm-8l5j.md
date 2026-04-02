---
id: task-mnfgmowm-8l5j
title: Migrate pipeline print-mode to stream-json output
status: pending
priority: low
category: enhancement
blockedBy:
  - task-mnfgm8d0-cg8j
  - task-mnfgmev3-3rii
blocks: []
createdAt: '2026-04-01T03:02:09.045Z'
updatedAt: '2026-04-01T03:02:09.045Z'
completedAt: null
context: Session 2026-04-01
---
For pipeline print-mode (single-turn) invocations, switch from --output-format json to --output-format stream-json (Claude/Gemini) or --json (Codex). Parse JSONL events in real-time for structured status (tool_use, assistant, result events). Consult features.streamingFlag for the correct CLI flag per tool. Bigger refactor — changes spawnAIToolRaw output parsing.

## Steps
- [ ] Update prepareAIInvocation to use features.streamingFlag
- [ ] Add JSONL event parser for stream-json output in pipelineStages.ts
- [ ] Emit structured status events from parsed JSONL to activity stream
- [ ] Test with all 3 tools in pipeline print mode

## Acceptance Criteria
Pipeline print-mode stages use streaming output for structured real-time progress. Fallback to json envelope for tools without streaming support.
