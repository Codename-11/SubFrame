---
id: task-mmbi1nmn-v0jy
title: Automated changelog generation from sub-task system
status: pending
priority: medium
category: feature
blockedBy: []
blocks: []
createdAt: '2026-03-04T03:50:59.806Z'
updatedAt: '2026-03-04T03:50:59.806Z'
completedAt: null
context: Session 2026-03-04
---
Integrate CHANGELOG.md (keepachangelog spec) with the SubFrame sub-task and release workflow. Goals: (1) Auto-generate changelog entries from completed sub-tasks on release — map task categories to keepachangelog sections (feature→Added, fix→Fixed, etc.). (2) Add a /changelog skill that previews unreleased changes from completed tasks since last tag. (3) Update /release skill to append to CHANGELOG.md during version bump. (4) Consider rendering CHANGELOG.md inline in the Settings About tab (currently opens GitHub). (5) Keep .subframe/docs-internal/changelog.md as the detailed internal log — CHANGELOG.md is the user-facing keepachangelog spec file.
