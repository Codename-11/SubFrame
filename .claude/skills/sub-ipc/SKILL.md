---
name: sub-ipc
description: Regenerate the IPC channel reference documentation from ipcChannels.ts type maps.
disable-model-invocation: false
allowed-tools: Bash, Read, Write, Grep
---

# SubFrame IPC Reference Regeneration

Regenerate `.subframe/docs-internal/refs/ipc-channels.md` from the source of truth: `src/shared/ipcChannels.ts`.

## Dynamic Context

Current channel count:
!`node -e "const src=require('fs').readFileSync('src/shared/ipcChannels.ts','utf8'); const m=src.match(/^\s+\w+:\s*'/gm); console.log(m ? m.length + ' channels in IPC constant' : 'Could not count')"`

## Instructions

### Step 1: Read Source

Read `src/shared/ipcChannels.ts` completely. Extract:

1. **IPC constant** — all channel name constants, grouped by their comment headers (e.g., `// Terminal`, `// Workspace`)
2. **IPCHandleMap** — channels using the `handle` pattern (request/response)
3. **IPCSendMap** — channels using the `send` pattern (fire-and-forget)
4. **IPCEventMap** — channels using the `event` pattern (main→renderer push)

### Step 2: Classify Each Channel

For every channel in the `IPC` constant, determine its pattern:
- If it appears in `IPCHandleMap` → `handle`
- If it appears in `IPCSendMap` → `send`
- If it appears in `IPCEventMap` → `event`
- If it appears in both `IPCSendMap` and `IPCEventMap` → `send + event` (bidirectional)
- If it appears in NONE of the maps → `⚠` (untyped/legacy)

### Step 3: Write Reference Doc

Write `.subframe/docs-internal/refs/ipc-channels.md` with this structure:

```markdown
# IPC Channel Reference

**Source of truth:** `src/shared/ipcChannels.ts`

All channels are typed. Three communication patterns are used:

| Pattern | Direction | Usage |
|---------|-----------|-------|
| `ipcMain.handle` / `ipcRenderer.invoke` | Renderer → Main (request/response) | Data fetching, mutations |
| `ipcRenderer.send` / `ipcMain.on` | Renderer → Main (fire-and-forget) | Commands, notifications |
| `webContents.send` / `ipcRenderer.on` | Main → Renderer (push events) | Data updates, state changes |

Channels marked ⚠ are defined in the `IPC` constant but not yet in `IPCHandleMap`, `IPCSendMap`, or `IPCEventMap` type maps.

---

## Channels by Domain

### {Domain} ({N} channels)
| Channel | Pattern | Purpose |
|---------|---------|---------|
| `CHANNEL_NAME` | pattern | Brief purpose |

...

---

**Total: {N} channels** ({H} handle, {S} send, {E} event, {U} untyped/legacy)

*Regenerated from `ipcChannels.ts` — keep this reference in sync when adding/removing channels.*
```

### Rules

- Group channels by the `//` comment headers in the IPC constant
- Purpose descriptions should be concise (3-8 words)
- Count channels that appear in multiple maps only once for the total
- Flag channels not in any type map with ⚠
- Include a note for legacy channels that have been superseded by handle patterns

### Step 4: Verify

Count the total channels and verify it matches the number of entries in the `IPC` constant.
