---
name: sub-docs
description: Sync all SubFrame documentation after feature work. Updates CLAUDE.md lists, changelog, PROJECT_NOTES decisions, IPC reference, and STRUCTURE.json.
argument-hint: [summary of what changed]
disable-model-invocation: false
allowed-tools: Bash, Read, Edit, Write, Grep, Glob
---

# SubFrame Documentation Sync

After significant feature work, synchronize all SubFrame documentation references. This skill automates the checklist from CLAUDE.md's "Before Ending Work" section.

## Dynamic Context

Current version:
!`node -e "console.log(require('./package.json').version)"`

Recent commits (last 10):
!`git log --oneline --no-decorate -10`

Files changed (unstaged + staged):
!`git diff --name-only HEAD 2>/dev/null | head -30`

## Instructions

**Argument:** `$ARGUMENTS`

The argument should describe what feature/changes were made. If empty, infer from recent git changes.

### Step 1: Identify What Changed

Read the recent changes (git diff, argument context) and categorize:
- **New main process modules** → update CLAUDE.md "Key Modules" main process list
- **New renderer components** → update CLAUDE.md renderer components list
- **New hooks** → update CLAUDE.md hooks list
- **New stores** → update CLAUDE.md stores list
- **New lib modules** → update CLAUDE.md lib list
- **New IPC channels** → flag for `/sub-ipc` regen
- **Architecture decisions** → add to `.subframe/PROJECT_NOTES.md` Session Notes
- **User-facing features** → add to `.subframe/docs-internal/changelog.md` under [Unreleased]

### Step 2: Update CLAUDE.md

Read `CLAUDE.md` and update only the sections that need changes:
- **Main process modules** line (line starting with backtick-delimited module names after "Main process")
- **Renderer components** line (line starting with backtick-delimited component names after "Renderer")
- **Hooks** line
- **Stores** line
- **Lib** line

**Rules:**
- Preserve alphabetical ordering within each group where it exists
- Only add genuinely new entries — don't duplicate
- Keep the inline backtick format consistent with existing entries

### Step 3: Update Changelog

Read `.subframe/docs-internal/changelog.md` and add entries under `## [Unreleased]`.

**Format:** Follow the existing changelog style:
- Group under `### Added`, `### Changed`, `### Fixed`, `### Removed`
- Bold feature name, em-dash, brief description
- Sub-bullets for implementation details (files, patterns, key decisions)

### Step 4: Update PROJECT_NOTES (if architecture decision)

If the work involved an architecture decision worth preserving, add a session note to `.subframe/PROJECT_NOTES.md` under `## Session Notes`.

**Format:**
```markdown
### [YYYY-MM-DD] Title

**Context:** Why this decision was needed.

**Decision:** What was chosen.

**Key architectural choices:**
- Point 1
- Point 2

**Files:** list of key files
```

**Skip this step** for routine changes (bug fixes, minor UI tweaks, config changes).

### Step 5: Regenerate STRUCTURE.json

Run: `npm run structure`

This picks up any new/renamed/deleted source files.

### Step 6: Summary

Present a checklist of what was updated:
- [ ] CLAUDE.md — what was added/changed
- [ ] changelog.md — entries added
- [ ] PROJECT_NOTES.md — decision added (or skipped)
- [ ] STRUCTURE.json — regenerated (N modules)
- [ ] IPC channels — flag if new channels need `/sub-ipc`

### When to suggest `/sub-ipc`

If new IPC channels were added, tell the user:
> New IPC channels detected. Run `/sub-ipc` to regenerate the IPC reference doc.
