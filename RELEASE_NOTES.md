# v0.8.0-beta

Major feature release — workspace UX overhaul, terminal persistence, output channels, and GitHub panel enhancements.

## Workspace UX

- **Workspace Tab Bar** — Persistent horizontal tabs replace the dropdown. Each tab shows workspace name, project count, and live agent status dot (green pulse = agent active). Right-click for Rename, Deactivate, Move, Delete.
- **Quick Switcher** — `Ctrl+Alt+W` opens the Command Palette pre-filtered to workspaces with fuzzy search.
- **Cross-Project Terminal Pinning** — Pin terminals to keep them visible across workspace switches. Pinned terminals show a project name badge and accent left border. State persists in localStorage.

## Terminal Enhancements

- **Session Persistence** — Terminals restore on startup with correct shell, working directory, and names. Configurable via `terminal.restoreOnStartup`.
- **Scrollback Persistence** — Optionally save and restore terminal scrollback content. Enable via `terminal.restoreScrollback`.
- **Agent Session Resume** — When a terminal had an active Claude session, SubFrame offers to resume it. Modes: `auto`, `prompt` (default), `never`.
- **Freeze/Resume** — Pause terminal output with `Ctrl+Shift+F`. Output buffers in the background and flushes instantly on resume. Overlay indicator + tab bar button.
- **Agent Exit Detection** — Shell-prompt-return detection for instant recognition when Claude exits. Configurable timeout, agent-state staleness polling.
- **Default 1×1 Grid** — New terminals start in single full view instead of 1×2 split.

## Persistent Status Bar

Always-visible bar at the bottom showing git branch, agent count, sub-task progress, CI status, and output channel toggle. Click any section to open the corresponding panel.

## Output Channels

VS Code-style named log channels (System, Git, GitHub, Agent, API Server, Pipeline, Extensions). Toggle between Activity Streams and Output view in the bottom panel. GitHub operations now log to the GitHub channel.

## GitHub Panel

- **Send to Agent** — Right-click issues/PRs to send to terminal. Bulk select and send multiple.
- **Expandable Detail** — Click to see full body, comments, assignees, and PR diff summary.
- **Create Issue** — New issue dialog with title, body, labels, assignees.
- **PR Review** — Send PR metadata + diff to agent for code review.
- **Workflow Re-run/Dispatch** — Re-run completed runs, dispatch workflows with branch ref.
- **Notifications Panel** — Grouped notification feed with mark-read and auto-refresh.

## Claude GitHub Workflows

- Triage/Fix/Chat modes with collaborator-only access
- `claude` label triggers analysis, `claude-fix` triggers implementation + PR
- Auto-triage on new issues, PR review gated to collaborators

## Hooks Manager

- New "Hooks" section in Settings to view, add, and delete Claude Code hooks
- Quick templates for common patterns (block .env writes, log commands, auto-approve reads)
- AI Generate helper to describe what you want and have Claude write the hook

## Fixes

- Workspace deactivation auto-switch before deactivating
- Shell injection prevention in GitHub CLI calls (switched to execFile)
- `restoreScrollback` setting now properly gated
- Stale agent status after Claude exits (❯ pattern conflict resolved)
