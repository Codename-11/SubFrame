---
name: sub-audit
description: Run a code review and documentation audit on recent changes. Finds bugs, edge cases, missing docs, and type safety issues.
argument-hint: [scope - e.g., "agent state feature", "last 5 commits"]
disable-model-invocation: false
allowed-tools: Bash, Read, Grep, Glob, Agent
---

# SubFrame Audit

Run a thorough audit on recent changes, combining code review and documentation checks.

## Dynamic Context

Recent commits (last 15):
!`git log --oneline --no-decorate -15`

Files changed vs main:
!`git diff --name-only main...HEAD 2>/dev/null | head -40`

## Instructions

**Argument:** `$ARGUMENTS`

The argument should describe the scope to audit. If empty, audit all changes since the last merge to main.

### Phase 1: Identify Scope

Determine which files to audit:
- If argument specifies a feature/scope, identify the relevant files
- If empty, use `git diff --name-only main...HEAD` to find all changed files
- Group files by layer: main process, renderer, shared, hooks, scripts

### Phase 2: Code Review (spawn agent)

Spawn a code review agent (`feature-dev:code-reviewer` subagent type) to review the changed files. The agent should check for:

1. **Critical bugs** — null/undefined access, race conditions, unhandled errors, infinite loops
2. **Type safety** — `as any` casts, `Record<string, ...>` where union keys exist, missing type imports
3. **Platform issues** — Windows path handling, `fs.watch` reliability, atomic file writes
4. **React issues** — stale closures in effects, missing deps, memory leaks from uncleared listeners
5. **IPC issues** — mismatched channel names, missing handlers, untyped payloads
6. **Security** — command injection in Bash inputs, XSS in rendered content, path traversal

### Phase 3: Documentation Audit (spawn agent)

Spawn an explore agent (`Explore` subagent type) to check documentation completeness:

1. **CLAUDE.md** — Are all modules/components/hooks/stores listed?
2. **KeyboardShortcuts.tsx** — Are all keyboard shortcuts registered?
3. **changelog.md** — Does [Unreleased] reflect all new features?
4. **PROJECT_NOTES.md** — Are architecture decisions documented?
5. **ipc-channels.md** — Are all IPC channels listed? (compare count with `ipcChannels.ts`)
6. **STRUCTURE.json** — Is it up to date? (compare module count with actual files)

### Phase 4: Report

Present findings in this format:

```
## Audit Report

### Critical Issues (must fix)
1. [FILE:LINE] Description — severity, impact

### Important Issues (should fix)
1. [FILE:LINE] Description — severity, impact

### Documentation Gaps
1. [FILE] What's missing

### Suggestions (nice to have)
1. Description
```

**Confidence filtering:** Only report issues you are confident about. Skip speculative concerns or style preferences. Each reported issue should include:
- Exact file and line number
- What the problem is
- Why it matters (impact)
- Suggested fix

### Phase 5: Offer Fixes

After presenting the report, ask the user if they want to fix any of the reported issues. If yes, apply fixes starting with Critical → Important → Documentation.
