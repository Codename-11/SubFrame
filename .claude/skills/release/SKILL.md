---
name: release
description: Create a new release with version bump, release notes, commit, and tag
argument-hint: <patch|minor|major|x.y.z[-prerelease]>
disable-model-invocation: true
allowed-tools: Bash, Read, Edit, Write, Grep, Glob
---

# Release Procedure

Create a release for SubFrame. The argument specifies the version bump type or an explicit version number.

## Dynamic Context

Current version (from package.json):
!`node -e "console.log(require('./package.json').version)"`

Last 5 tags:
!`git tag --sort=-v:refname | head -5`

Recent commits (last 30):
!`git log --oneline --no-decorate -30`

Current branch:
!`git branch --show-current`

Working tree clean?
!`git status --porcelain`

## Instructions

**Argument:** `$ARGUMENTS`

### Pre-flight Checks

1. **Verify clean working tree** — if there are uncommitted changes, STOP and warn the user. Releases must be made from a clean state.
2. **Verify on main branch** — warn if not on `main`.
3. **Verify build succeeds** — run `npm run build` and confirm it completes without errors.

### Step 1: Determine Version

Parse the argument:
- `patch` — bump PATCH, keep `-beta` suffix (e.g., `0.2.0-beta` → `0.2.1-beta`)
- `minor` — bump MINOR, reset PATCH, keep `-beta` suffix (e.g., `0.2.1-beta` → `0.3.0-beta`)
- `major` — bump MAJOR, reset MINOR+PATCH, **drop `-beta`** to produce first stable release (e.g., `0.3.0-beta` → `1.0.0`)
- `stable` — strip `-beta` suffix without changing version numbers (e.g., `0.3.0-beta` → `0.3.0`)
- `x.y.z` or `x.y.z-beta` (explicit) — use as-is, validate it's greater than current
- No argument — analyze the commits since last tag and recommend a bump:
  - Any `feat!`, `fix!`, or `BREAKING CHANGE` -> MAJOR (goes stable)
  - Any `feat` -> MINOR
  - Only `fix`/`docs`/`perf`/`chore`/`refactor` -> PATCH
  - Ask the user to confirm before proceeding

**Beta versioning scheme:** All `0.x.y` versions use the `-beta` suffix (no numeric counter). The `-beta` suffix is preserved on `patch`/`minor` bumps and only dropped when going stable via `major` or `stable`.

### Step 2: Update package.json

Update the `"version"` field in `package.json` to the new version string. This is the **single source of truth** — `FRAME_VERSION` in `src/shared/frameConstants.js` reads from it automatically via `require()`.

### Step 3: Update version references in docs

Update these version strings to match the new version:
1. **`docs/index.md`** — the `"softwareVersion"` field in the Schema.org JSON-LD structured data (in the frontmatter `head` array)
2. **`docs/.vitepress/theme/components/NavBar.vue`** — the `logo-version` span text (e.g., `Latest: v0.2.0`)
3. **`README.md`** — the version in the footer `<strong>` tag
4. **`promo/src/ui/SidebarMock.tsx`** — the version string in the sidebar mock UI

### Step 4: Update CHANGELOG.md

Move items from `## [Unreleased]` to a new `## [X.Y.Z] - YYYY-MM-DD` section in `CHANGELOG.md` (keepachangelog format). Add a compare link at the bottom of the file. If there are no [Unreleased] entries, generate them from commits since last tag using Added/Changed/Fixed sections.

### Step 5: Generate Release Notes

Write `RELEASE_NOTES.md` following the format in [release-notes.md](release-notes.md).

Analyze ALL commits since the last tag to build the notes. Group by category, be thorough about user-facing changes.

**Show the draft to the user and ask for approval before continuing.** They may want to adjust wording or add context.

### Step 6: Commit

Stage exactly these files:
- `package.json`
- `docs/index.md`
- `docs/.vitepress/theme/components/NavBar.vue`
- `README.md`
- `promo/src/ui/SidebarMock.tsx`
- `CHANGELOG.md`
- `RELEASE_NOTES.md`

Commit with message: `chore(release): bump version to X.Y.Z`

### Step 7: Tag

Create an annotated tag: `git tag vX.Y.Z`

**Do NOT push.** Tell the user:
> Release committed and tagged as `vX.Y.Z`. When ready, push with:
> ```
> git push origin main --tags
> ```
