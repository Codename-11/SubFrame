# Release Notes Format

Release notes are written to `RELEASE_NOTES.md` in the project root and committed as part of the release. GitHub Actions or manual release creation can use this file.

## Template

```markdown
Brief 1-2 sentence summary of this release's focus.

## What's Changed

### Features
- **Feature Name** - Brief description of the new functionality

### Improvements
- **Improvement Name** - Brief description of what was enhanced

### Bug Fixes
- **Fix Name** - Brief description of what was fixed

### Documentation
- Brief description of doc updates

### Other Changes
- Maintenance, refactoring, dependency updates
```

## Guidelines

- Keep descriptions user-focused and concise (1 line each)
- Use **bold** for feature/fix names
- Omit sections with no items
- **Be inclusive** — prioritize documenting all user-facing changes:
  - New buttons, controls, or UI elements
  - Changed or removed interactions
  - New keyboard shortcuts or gestures
  - Visual changes (styling, layout, icons)
  - New settings or configuration options
  - Workflow changes that affect how users complete tasks
- Internal refactoring only mentioned if it affects user experience
- Note failed approaches too — a brief "We tried X, it didn't work because Y" prevents future re-exploration of dead ends

## Example

```markdown
This release introduces multi-workspace support and improves Claude session management with conversation grouping and named session resume.

## What's Changed

### Features
- **Multi-Workspace Selector** - Dropdown above the project list to create, switch, rename, and delete named workspaces
- **Session Grouping** - Claude Code sessions sharing a conversation chain are merged into a single entry with combined message counts
- **Named Session Resume** - Resume uses the session's custom title (e.g., "Main") instead of raw UUIDs for more reliable conversation continuity

### Improvements
- **Sidebar Restructure** - Cleaner project list layout with bottom-pinned action buttons
- **Session Display** - Shows custom title with first-prompt subtitle and segment count for multi-part sessions

### Bug Fixes
- **Session Resume** - Fixed resume pointing to wrong conversation point when sessions had multiple continuation segments

### Documentation
- **Versioning System** - Centralized version management with package.json as single source of truth
```
