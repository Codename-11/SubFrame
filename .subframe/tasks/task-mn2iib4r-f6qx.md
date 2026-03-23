---
id: task-mn2iib4r-f6qx
title: TTS endpoint for agent-initiated speech via DTSP
status: completed
priority: medium
category: feature
blockedBy: []
blocks: []
createdAt: '2026-03-23T01:33:43.514Z'
updatedAt: '2026-03-23T01:37:27.098Z'
completedAt: '2026-03-23T01:37:27.098Z'
context: Session 2026-03-23
---
Add POST /api/tts endpoint to the Local API Server that accepts TTS-optimized text from Claude Code hooks. Broadcasts tts-speak SSE events for Conjure to auto-speak. Voice profiles (summary, error, status, insight) let consumers adjust tone. Includes hook template for Claude to generate TTS text.

## Steps
- [ ] Add POST /api/tts and GET /api/tts/latest endpoints
- [ ] Broadcast tts-speak SSE events
- [ ] Update DTSP capabilities to include tts
- [ ] Add hook template for TTS text generation
- [x] Update docs and generate Conjure handoff spec

## User Request
> Add a TTS endpoint to DTSP so Claude can generate speech-formatted text via hooks, and Conjure can consume it for auto-speak

## Acceptance Criteria
POST /api/tts accepts text+voice+priority, broadcasts tts-speak SSE event, GET /api/tts/latest returns most recent, hook template included, DTSP capabilities updated
