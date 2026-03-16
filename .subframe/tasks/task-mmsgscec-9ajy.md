---
id: task-mmsgscec-9ajy
title: Audit and fix long-running AI task UX (dialog/activity bar coupling)
status: completed
priority: high
category: feature
blockedBy: []
blocks: []
createdAt: '2026-03-16T00:47:50.723Z'
updatedAt: '2026-03-16T01:10:44.036Z'
completedAt: '2026-03-16T01:10:44.036Z'
context: Session 2026-03-16
---
Modal dialogs that initiate background AI operations (Enhance Sub-Task, Onboarding Analysis) break UX when closed — the operation continues in the background (visible in ActivityBar) but the user can't reopen the dialog to see current state/results. Need to either: (1) make dialogs resumable by linking to in-progress operations, (2) move long-running operations out of modals into persistent panels, or (3) add a global 'running operations' view that shows results. Pipelines are fine (persistent panel). The ActivityBar infrastructure is solid — the flaw is purely at the UI coupling layer.

## Steps
- [ ] Audit all long-running operation entry points (Enhance, Onboarding, Pipeline, AI Tool)
- [ ] Map each operation's lifecycle: initiation → progress → completion → result delivery
- [ ] Design UX pattern for resumable/persistent background operations
- [ ] Implement operation-to-UI linking (e.g. store active operation IDs, reattach on dialog open)
- [x] Test: close dialog during Enhance, reopen, verify state restoration
- [x] Test: navigate away during pipeline, return, verify state persists

## User Request
> Ensure all long-running AI tasks properly use global activity system AND that UI supports reopening/reattaching to in-progress operations

## Notes
[2026-03-16] Implemented Option C (hybrid): pendingEnhance in Zustand store survives dialog close, toast with View Results action reopens dialog pre-populated. Also fixed: SettingsPanel CLI install/uninstall loading states. Audit found: CLI install (high), SCAN_PROJECT_DIR (medium), RECHECK_AI_TOOLS (medium) — first two fixed, third already had spinner.
[2026-03-16] Audit pass 2: Fixed 5 additional issues — View Results navigates to Tasks panel, pendingEnhance cleared on form submit, Create/Update disabled during enhance, SCAN_PROJECT_DIR loading state added. OnboardingDialog confirmed clean (has cancel-on-close logic). ActivityBar cancel does not interact with pendingEnhance (acceptable).
