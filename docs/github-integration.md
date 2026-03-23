---
title: GitHub Integration
description: SubFrame's GitHub integration — panel features, Claude workflows, issue triage, and CI automation.
---

# GitHub Integration

SubFrame provides deep GitHub integration through its **GitHub Panel** (right sidebar) and **Claude GitHub Workflows** (CI automation). The panel gives you inline access to issues, PRs, branches, workflows, and notifications. The workflows enable AI-assisted triage, code review, and automated fixes.

## GitHub Panel

The GitHub panel group in the right sidebar includes seven tabs:

### Issues & Pull Requests

Browse your repository's issues and PRs with state filtering (Open, Closed, All).

**Send to Agent** — Right-click any issue or PR and select "Send to Agent" to send it to your active terminal as a formatted prompt. Claude will receive the issue title, state, labels, author, and full body text.

**Bulk Send** — Toggle selection mode (checkbox icon) to select multiple issues, then "Send to Agent" all at once with a customizable wrapper prompt.

**Expandable Detail** — Click any issue row to expand and see the full body (rendered markdown), comments, assignees, and milestone. For PRs, you also see branch info, additions/deletions, changed files, and review decision.

**Create Issue** — Click the `+` button to create a new GitHub issue directly from SubFrame with title, description (markdown), labels, and assignees.

**Create Sub-Task** — Right-click an issue and select "Create Sub-Task" to create a SubFrame sub-task pre-filled with the issue details.

**PR Review** — Expand a PR and click "Send for Review" to send the PR metadata, description, and diff to your agent for a thorough code review.

### Branches & Worktrees

Manage local and remote branches — switch, create, and delete. Git worktrees are also supported for working on multiple branches simultaneously.

### Changes

Real-time git status showing staged, modified, and untracked files in flat or tree view. Right-click files to open in the editor or reveal in Explorer.

### Workflows

View GitHub Actions workflows and their recent runs. Each run shows status, branch, and timestamp.

**Re-run** — Hover over a completed run and click the re-run button (↺) to re-trigger it.

**Dispatch** — Click the play button (▶) on any workflow header to dispatch it manually. Enter a branch ref (defaults to your current branch) and click Run.

### Notifications

Your GitHub notification feed, grouped by repository. Shows unread count with a badge, auto-refreshes every 60 seconds.

- Click a notification to open it in the browser
- Right-click to mark as read
- "Mark All Read" button in the header

## Claude GitHub Workflows

SubFrame ships with two GitHub Actions workflows that integrate Claude directly into your GitHub workflow.

### Setup

1. **Install the Claude GitHub App** — run `/install-github-app` in SubFrame, or visit [github.com/apps/claude](https://github.com/apps/claude)
2. **Add the OAuth token** — go to your repo's Settings → Secrets and variables → Actions, add `CLAUDE_CODE_OAUTH_TOKEN` (get one via `claude /oauth`)

### Workflow: `claude.yml`

This is the main workflow with four jobs:

#### Triage (automatic)

**Triggers:** New issue opened, or `claude` label added to an issue.

Claude analyzes the issue in **read-only mode** — no code changes. It classifies the issue type, estimates priority, identifies affected modules, checks for reproduction steps, and suggests an approach and labels.

::: tip
Every new issue is automatically triaged. To re-triage an existing issue, add the `claude` label.
:::

#### Fix (on demand)

**Trigger:** `claude-fix` label added to an issue.

Claude implements the fix, runs quality gates (`npm run check`), and creates a PR. This is the only mode where Claude writes code and modifies the repository.

::: warning
Only add the `claude-fix` label after reviewing the triage analysis. Claude will create a branch and open a PR.
:::

#### Chat (flexible)

**Trigger:** `@claude` mentioned in any issue or PR comment.

Claude defaults to **analysis mode** — it investigates, explains, and suggests without writing code. If you explicitly ask it to fix or implement something (e.g., "fix this", "write the code", "create a PR"), it will do so.

#### Security

All jobs are gated by a collaborator check. Only users with **admin**, **write**, or **maintain** permissions on the repository can trigger Claude. Comments from non-collaborators are silently ignored.

### Workflow: `claude-review.yml`

**Trigger:** PR opened or updated (new commits pushed).

Claude automatically reviews every PR from collaborators, focusing on:
- Pattern adherence to SubFrame's architecture
- Code quality (bugs, edge cases, type safety)
- Project fit (does it belong?)
- Security (no secrets, safe IPC, input validation)

The review is practical, not pedantic — it skips nitpicks and approves clean PRs quickly.

### Labels

| Label | Color | Purpose |
|---|---|---|
| `claude` | Purple | Triggers triage analysis on an issue |
| `claude-fix` | Green | Triggers Claude to implement a fix and create a PR |

### Typical Workflow

```
1. User opens issue
      ↓
2. Claude auto-triages (analysis only, adds comment)
      ↓
3. Maintainer reviews triage, decides it's worth fixing
      ↓
4. Maintainer adds `claude-fix` label
      ↓
5. Claude implements fix, runs checks, opens PR
      ↓
6. Claude auto-reviews the PR
      ↓
7. Maintainer reviews and merges
```

You can also interact at any point with `@claude` in comments for questions, clarification, or ad-hoc requests.
