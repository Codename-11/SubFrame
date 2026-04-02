Fixes workspace pill scrollbar glitches, terminal bell on first input, and adds UI/UX polish across the workspace and terminal systems.

## What's Changed

### Bug Fixes
- **Workspace pill scrollbar** — Vertical and horizontal scrollbars no longer appear on the workspace pill container. Root cause was a CSS spec quirk where `overflow-y: visible` computes as `auto` when the other axis is `auto`.
- **Terminal bell on first input** — Bell sound now suppressed by default (opt-in via Settings). Previously, async settings load could leave the bell handler unregistered, causing beeps from shell OSC sequences.
- **Multi-project workspace mixing** — Workspaces with multiple directories now default to combined terminal view. No more clicking "Mix" every time you switch workspaces.

### UI/UX Improvements
- **Workspace pill overflow indicator** — Ellipsis icon appears when hidden pills exist, fades out as they animate in on hover.
- **Workspace pill keyboard navigation** — ArrowLeft/Right cycles focus between pills (WAI-ARIA toolbar pattern).
- **Terminal tab rename buttons** — Confirm and cancel buttons alongside rename input for pointer/touch users.
- **Terminal creation loading state** — Spinner replaces empty state during creation; New Terminal button shows loading indicator and prevents double-clicks.
- **Grid overflow badge** — Readable "overflow" text badge replaces the barely-visible dot on terminals exceeding grid capacity.
- **Project badges in combine mode** — All terminal tabs show project name badge when workspace mixing is active, with 3-tier styling (native/foreign/pinned).
- **Sidebar workspace selector** moved above Projects/Files tab bar for clearer scope hierarchy.
- **StatusBar agent tooltip** shows dynamic agent count and click action hint.

### Added
- **AI tool capability model** — Structured `AIToolFeatures` interface tracks hooks, streaming, event names, config paths, and docs URLs for Claude Code, Codex CLI, and Gemini CLI.
- **Pipeline agent status feedback** — Running pipeline stages show active AI agent tool usage in timeline and log view.
