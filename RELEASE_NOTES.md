# v0.7.3-beta

## GitHub Panel Enhancements

- **Send to Agent** — Right-click any issue or PR to send it to your active terminal as a formatted prompt. Bulk select multiple issues and send them all at once with a customizable wrapper prompt.
- **Expandable Detail View** — Click any issue or PR to expand inline and see the full body (rendered markdown), comments, assignees, and milestone. PRs also show branch info, diff file summary, and review decision.
- **Create Issue** — Create new GitHub issues directly from the panel with title, description, labels, and assignees.
- **PR Review Integration** — Send a PR's metadata and diff to your agent for a thorough code review.
- **Workflow Re-run & Dispatch** — Re-run completed workflow runs or dispatch workflows manually with a branch ref.
- **Notifications Panel** — New tab in the GitHub group showing your notification feed grouped by repository, with unread indicators and mark-as-read support.
- **Create Sub-Task from Issue** — Right-click an issue to create a SubFrame sub-task pre-filled with issue details.

## Persistent Status Bar

Always-visible status bar at the bottom of the app showing at-a-glance information:
- Git branch, ahead/behind, dirty indicator
- Active agent count
- In-progress and pending sub-task counts
- CI workflow status
- Output channel toggle

## Output Channels

VS Code-style named log channels for system and integration output:
- 7 default channels: System, Git, GitHub, Agent, API Server, Pipeline, Extensions
- Toggle between Activity Streams and Output view in the bottom panel
- GitHub operations now log to the GitHub output channel

## Claude GitHub Workflows

- Enhanced `claude.yml` with 4 distinct jobs: auth gate, triage, fix, and chat
- Collaborator-only access — non-collaborators are silently ignored
- `claude` label triggers triage, `claude-fix` label triggers implementation
- Auto-triage on new issues, PR review gated to collaborators

## Fixes

- **Workspace Deactivation** — Fixed broken deactivation that always showed "cannot deactivate". Now auto-switches to another workspace before deactivating.
- **Terminal Default** — Default grid layout changed from 1x2 split to 1x1 single full view.
