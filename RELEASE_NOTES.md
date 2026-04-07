Fixes the Windows ConPTY first-byte-drop bug at its root with quiescence-based shell detection, replacing fragile fixed delays with adaptive output polling.

## What's Changed

### Bug Fixes
- **ConPTY first-byte-drop (root cause fix)** — replaced the 80ms fixed delay with `waitForOutputQuiet`, which polls PTY output timestamps and resolves once output has been silent for 100ms. Handles slow shell profiles (oh-my-posh 800ms+) without wasting time on fast ones
- **Shell-ready detection for non-standard prompts** — added quiescence fallback for prompts that don't match regex patterns (oh-my-posh with custom glyphs, etc.). Terminal goes quiet for 250ms → considered ready
- **AI session launch reliability** — interactive AI sessions now adapt to actual shell startup time instead of using a fixed delay

### Improvements
- **`TERMINAL_WRITE_SAFE` IPC channel** — new quiescence-aware terminal write used by agent launch and AI session manager
- **Workspace pill sorting** — auto-sort now respects most-recently-selected order within activity tiers
- **Workspace pill component refactor** — extracted `WorkspacePillReorderItem` for cleaner drag/reorder separation
