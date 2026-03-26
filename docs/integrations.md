---
title: Integrations
description: SubFrame's Local API Server and DTSP protocol for automation, external tools, and agent-initiated TTS.
---

# Integrations

SubFrame exposes terminal state to external tools through a **Local API Server** and the **DTSP** (Desktop Text Source Protocol) discovery standard. This enables tools like Conjure (TTS), Stream Deck, custom scripts, and any DTSP-aware application to interact with SubFrame's terminals.

> Looking for browser-based desktop or mobile control of the full SubFrame UI? That lives under [Remote Access](/remote-access) via SubFrame Server. This page is about automation and tool integration, not the remote web client.

## Architecture

```
SubFrame (Electron)
  └── Local API Server (localhost HTTP)
        ├── Terminal endpoints (selection, buffer, context)
        ├── TTS endpoint (agent-initiated speech)
        └── SSE event stream (real-time updates)
              │
              ▼
        Discovery: ~/.dtsp/sources/subframe.json
              │
              ▼
        External consumers (Conjure, scripts, etc.)
```

## Local API Server

### Overview

The API server starts automatically with SubFrame on a random available port, bound to `127.0.0.1` (localhost only). A random 48-character hex auth token is generated on each launch.

Toggle on/off via **System Panel** or **Settings > Integrations**.

### Service Discovery

On startup, SubFrame writes:

**`~/.subframe/api.json`** (SubFrame-specific):
```json
{
  "port": 64381,
  "token": "a1b2c3...",
  "pid": 12345,
  "version": "0.7.2-beta"
}
```

External tools read this file to discover the server.

### Authentication

All endpoints (except `/api/health`) require authentication via:

- **Header**: `Authorization: Bearer <token>`
- **Query parameter**: `?token=<token>`

### Endpoints

#### GET /api/health
Server status check. **No auth required** — used for discovery verification.

```json
{ "status": "ok", "name": "SubFrame", "version": "0.7.2-beta" }
```

#### GET /api/selection
Returns the active terminal's current text selection.

```json
{ "terminalId": "term-1", "text": "selected text here", "hasSelection": true }
```

#### GET /api/context
Returns the active terminal's context.

```json
{
  "terminalId": "term-1",
  "name": "Terminal 1",
  "projectPath": "C:/Users/user/project",
  "claudeActive": true
}
```

#### GET /api/terminals
Lists all terminal instances.

```json
{
  "terminals": [
    { "id": "term-1", "name": "Terminal 1", "projectPath": "...", "claudeActive": true },
    { "id": "term-2", "name": "Terminal 2", "projectPath": "...", "claudeActive": false }
  ]
}
```

#### GET /api/terminals/:id/selection
Returns selection text for a specific terminal.

#### GET /api/terminals/:id/buffer
Returns the visible buffer content for a specific terminal.

```json
{
  "terminalId": "term-1",
  "lines": ["line 1", "line 2", "..."],
  "rows": 40,
  "cols": 120
}
```

#### POST /api/tts
Submit TTS-formatted text for broadcasting to consumers. Used by Claude Code hooks for agent-initiated speech.

**Request:**
```json
{
  "text": "Build succeeded with 0 warnings. All 42 tests passed.",
  "voice": "summary",
  "priority": "normal",
  "source": "hook"
}
```

**Response:**
```json
{ "ok": true, "id": "uuid" }
```

**Voice profiles:**

| Voice | Use Case |
|-------|----------|
| `summary` | Session summaries, task completions |
| `error` | Build failures, test failures |
| `status` | Progress updates |
| `insight` | Educational explanations |
| `general` | Default (anything not categorized) |

**Priority levels:**

| Priority | Behavior |
|----------|----------|
| `high` | Consumer should interrupt current speech |
| `normal` | Queue after current speech |
| `low` | Skip if queue is full |

#### GET /api/tts/latest
Returns the most recent TTS message.

```json
{ "message": { "id": "...", "text": "...", "voice": "summary", "priority": "normal", "source": "hook", "timestamp": "..." } }
```

#### GET /api/tts/history
Returns recent TTS messages. Optional `?limit=N` (default 10, max 50).

#### GET /api/events
Server-Sent Events (SSE) stream. Opens a persistent connection that receives real-time events:

```
event: connected
data: {}

event: selection-changed
data: {"terminalId":"term-1","text":"selected text"}

event: tts-speak
data: {"id":"uuid","text":"Build complete.","voice":"summary","priority":"normal","source":"hook","timestamp":"..."}
```

## DTSP (Desktop Text Source Protocol)

### Overview

DTSP is a generic discovery protocol for desktop applications that expose text content. SubFrame registers as a DTSP source so consumer apps can find it without hardcoded ports or manual configuration.

### Registration

When the API server starts and DTSP is enabled, SubFrame writes:

**`~/.dtsp/sources/subframe.json`:**
```json
{
  "name": "SubFrame",
  "port": 64381,
  "token": "a1b2c3...",
  "pid": 12345,
  "protocolVersion": "1.0",
  "appVersion": "0.7.2-beta",
  "capabilities": ["selection", "context", "buffer", "events", "tts"]
}
```

On shutdown, SubFrame deletes this file. On startup, stale files from crashed instances are cleaned up by checking if the PID is still alive.

### Consumer Discovery Flow

```
1. Scan ~/.dtsp/sources/*.json
2. For each file: check PID is alive (process.kill(pid, 0))
3. Verify GET /api/health responds
4. Check capabilities array for needed features
5. Connect with Bearer token from the file
```

### Capabilities

| Capability | Endpoint | Description |
|------------|----------|-------------|
| `selection` | `GET /api/selection` | Terminal text selection |
| `context` | `GET /api/context` | Terminal name, project, agent status |
| `buffer` | `GET /api/buffer` | Visible terminal content |
| `events` | `GET /api/events` | SSE event stream |
| `tts` | `POST /api/tts` | Agent-initiated text-to-speech |

### Toggle

DTSP registration can be toggled independently from the API server in **System Panel** or **Settings > Integrations**. The API server can run without DTSP (no discovery file written), and DTSP can be enabled but will wait for the API server to start before registering.

## TTS Integration Pattern

The TTS system enables **agent-initiated speech** — Claude generates text formatted for speaking (not raw code output), SubFrame broadcasts it, and a TTS consumer like Conjure speaks it.

### Flow

```
1. Claude Code finishes a task
2. Stop hook fires → generates TTS-friendly summary
3. Hook script POSTs to SubFrame's /api/tts endpoint
4. SubFrame stores the message and broadcasts SSE event: tts-speak
5. Consumer (Conjure) receives event → speaks text with voice profile
```

### Hook Example

A Claude Code Stop hook that sends a summary to SubFrame for TTS:

```bash
#!/bin/bash
# Read SubFrame API config
CONFIG=$(cat ~/.subframe/api.json 2>/dev/null)
PORT=$(echo "$CONFIG" | node -pe "JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).port" 2>/dev/null)
TOKEN=$(echo "$CONFIG" | node -pe "JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).token" 2>/dev/null)

if [ -n "$PORT" ] && [ -n "$TOKEN" ]; then
  curl -s -X POST "http://127.0.0.1:$PORT/api/tts" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"text":"Task complete.","voice":"summary","source":"hook"}'
fi
```

### Consumer Integration

TTS consumers should:

1. Discover SubFrame via DTSP (`~/.dtsp/sources/subframe.json`)
2. Check `capabilities` includes `"tts"`
3. Open SSE connection to `GET /api/events` with Bearer token
4. Listen for `event: tts-speak` events
5. Map `voice` profiles to TTS settings (speed, tone, model)
6. Respect `priority` levels (high = interrupt, normal = queue, low = skip if busy)

## Settings

Both integrations are configured in **Settings > Integrations**:

| Setting | Default | Description |
|---------|---------|-------------|
| Enable API Server | On | Start localhost HTTP server on launch |
| DTSP Registration | On | Write discovery file for external tools |

The System Panel (`Ctrl+Shift+U`) provides visual controls for the same settings plus real-time status: port, token (masked with copy/regenerate), connected clients, request count, and TTS activity.
