---
id: task-mms2ez0w-2hod
title: Enhance auto-update check interval and strategy
status: completed
priority: high
category: enhancement
blockedBy: []
blocks: []
createdAt: '2026-03-15T18:05:32.240Z'
updatedAt: '2026-03-15T18:49:05.651Z'
completedAt: '2026-03-15T18:49:05.651Z'
context: Session 2026-03-15
---
Current default check interval is 4 hours which is too long for a fast-moving beta. Consider: shorter default interval (30min-1hr) during beta, configurable interval in settings (already exists but default too high), check-on-focus (check when app regains focus after being backgrounded, like VS Code), check-on-push (if we detect a git push in the project, trigger a check), exponential backoff on repeated 'up to date' responses. Also evaluate whether electron-updater's differential downloads are working — full re-download on every patch is wasteful.

## Steps
- [ ] Research electron-updater best practices for beta update frequency
- [ ] Lower default check interval to 1hr for beta builds
- [ ] Add check-on-focus trigger (app.on focus event)
- [ ] Evaluate differential/delta updates
