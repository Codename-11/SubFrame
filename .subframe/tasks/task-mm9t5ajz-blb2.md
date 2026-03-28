---
id: task-mm9t5ajz-blb2
title: Project onboarding & AI analysis pipeline
status: completed
priority: medium
category: feature
blockedBy: []
blocks: []
createdAt: '2026-03-02T23:26:12.910Z'
updatedAt: '2026-03-26T22:41:55.0545443Z'
completedAt: '2026-03-26T22:41:55.0545443Z'
context: Session 2026-03-02
---
Detect existing project intelligence files, run AI analysis through visible terminal tab, import structured results into SubFrame spec files. Reusable runAnalysisInTerminal() pipeline.

## Notes
[2026-03-26] Revisited this pipeline to close the shared-session parity gaps found in audit. Task enhancement and pipeline AI stages now use the same live PTY session layer, structured-result markers are extracted after the echoed prompt boundary instead of parsing prompt examples, finished runs tear down their background terminals cleanly, and passive mirrors no longer resize the live PTY session.
[2026-03-26] Reopened to fix onboarding completion cleanup. Successful analysis now clears the terminal reference and destroys the backing PTY instead of leaving an orphaned terminal behind, and the onboarding transcript emitter no longer stalls when the visible transcript window reaches its line cap.
