Hotfix for the Ctrl+Shift+Enter AI tool launch dropping the first character on Windows.

## What's Changed

### Bug Fixes
- **Ctrl+Shift+Enter drops first character** — launching an AI tool via keyboard shortcut no longer types "laude" instead of "claude". Root cause: on the reuse-terminal path, the command was written to the PTY only ~5-20ms after the keypress (just IPC round-trip time). ConPTY on Windows interpreted the first byte `'c'` as Ctrl+C (0x03) because the physical Ctrl key was still held, and the shell silently swallowed it. Added an 80ms delay before the PTY write to allow modifier key release
