---
id: task-mmbc3ly5-o4ih
title: 'Pipeline review panel — UI for runs, artifacts, and approvals'
status: pending
priority: high
category: feature
blockedBy:
  - task-mmbc33h2-v7or
blocks: []
createdAt: '2026-03-04T01:04:33.244Z'
updatedAt: '2026-03-04T01:04:33.244Z'
completedAt: null
context: Session 2026-03-04
---
Build the renderer components: PipelinePanel.tsx (panel+full-view modes with run list and detail), PipelineTimeline.tsx (horizontal stage flow with animated status), usePipeline.ts hook (follows useTasks pattern — push listener, staleTime:Infinity, stable mutation refs), CritiqueView.tsx (file-grouped CommentArtifacts with severity badges), PatchReview.tsx (diff display with checkbox select and Apply button), PipelineLogView.tsx (scrollable per-stage logs). Add 'pipeline' to PanelId in useUIStore, wire into Sidebar+RightPanel+TerminalArea. Four tabs: Overview, Critique, Patches, Log. See ADR-007 Section 3.5.
