Major terminal UX upgrade with agent-aware features, pipeline workflow editor, and user message navigation.

## What's Changed

### Features
- **Reuse Idle Terminal for Agent** - Starting an agent reuses the active terminal instead of spawning a new one (configurable, enabled by default)
- **Agent Status in Tabs** - Pulsing green bot icon in terminal tab bar and grid cells when an agent session is active
- **Auto-Rename Terminal Tabs** - Tabs automatically rename to the agent session name (respects user-renamed tabs)
- **Agent Activity Full-View** - Popout button opens full-screen agent view with session list sidebar and detail timeline
- **Multi-Session Agent Panel** - Agent Activity panel shows all active/recent sessions (up to 5) with clickable cards
- **Jump to Terminal** - Session cards show a terminal icon button that focuses the terminal running that agent session
- **User Message Highlights** - Detects your messages during agent sessions and marks them with a subtle amber left-border decoration and scrollbar indicator (configurable, enabled by default)
- **Scroll to Last Message** - Navigation button appears when scrolled up during agent sessions to jump back through your messages
- **Grid Overflow Auto-Switch** - Selecting a terminal outside the grid auto-switches to single view; selecting one inside switches back (configurable, enabled by default)
- **Usage Polling Interval** - Configurable polling interval for Claude API usage data (default 5 min, range 30s-10min)
- **Pipeline `with:` Config** - Per-step configuration on workflow YAML steps: scope, mode, focus, and custom prompt overrides
- **Pipeline Agent Mode** - `mode: agent` spawns Claude in autonomous multi-turn mode with tool use for deep analysis
- **Pipeline Full-Screen View** - Popout button to open pipeline panel in full-screen mode
- **Pipeline Re-Run and Delete** - Re-run and delete buttons on pipeline runs
- **Workflow Editor UI** - Visual workflow builder with drag-to-reorder, stage type dropdown, AI config fields, and YAML view toggle via CodeMirror
- **Docs Audit Workflow** - Built-in workflow template for documentation review with `scope: project`
- **Security Scan Workflow** - Built-in workflow template for security review with `scope: project`
- **Nerd Font Auto-Detection** - Default font stack prefers Nerd Font variants; Settings shows detection status with install link if missing

### Improvements
- **Multi-Session Sidebar Status** - Sidebar agent widget shows count badge when multiple agents are active
- **Session Differentiation** - Session list items show relative timestamps, active tool badges, step counts, and start time
- **Health Check Workflow** - Now uses `scope: project` to audit whole codebase instead of just recent diffs
- **Pipeline Stage Handlers** - All AI stages use configurable scope, mode, focus, and prompt via `with:` config
- **Beta Versioning Scheme** - Switched from `beta.N` counter to cleaner `0.x.y-beta` format

### Bug Fixes
- **Grid Slot Swap Scrollbar** - Fixed terminal scrollbar and scroll overlay disappearing when swapping grid slots (React keyed by slot index instead of terminal ID)
- **Scroll Tracking After Swap** - Fixed scroll tracking effect not re-attaching after grid swap (stale ref object dependencies)
- **Reactive Marker Count** - Fixed user message count going stale when markers auto-dispose from scrollback trimming
- **Pipeline Tab Data** - Fixed critique/patches/log tabs showing no data (Radix Tabs breaking flex height chain)
- **Pipeline Sidebar Scroll** - Fixed scroll not working in pipeline sidebar panel
- **AI Tool JSON Envelope** - Fixed Claude CLI JSON output wrapper not being unwrapped
- **Shell Prompt Mangling** - Fixed backticks/quotes in AI prompts by piping via stdin
- **Empty Diff on Main** - Graceful skip when baseSha equals headSha on main branch
- **Redundant Usage Polling** - Removed duplicate renderer-side polling timer

---

> This is a beta release. Expect rough edges — please report issues on GitHub.
