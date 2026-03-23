Active/inactive workspaces, TTS endpoint for agent-initiated speech, and integration activity monitoring.

## What's Changed

### Features
- **Active/Inactive workspaces** — mark workspaces as inactive to hide from keyboard shortcuts and sort below active ones in the dropdown; "Deactivate" in the workspace options menu; Ctrl+Alt shortcuts only cycle active workspaces
- **TTS endpoint** — POST /api/tts accepts speech-formatted text from Claude Code hooks with voice profiles (summary/error/status/insight/general) and priority levels; broadcasts tts-speak SSE events for consumers like Conjure
- **TTS activity indicator** — System Panel API Server card shows TTS message count and last message preview with timestamp

### Improvements
- **DTSP capabilities** updated to include `tts` for consumer discovery
- **CORS** updated to accept POST method and Content-Type header
