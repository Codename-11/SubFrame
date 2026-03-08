---
id: task-mmbc33h2-v7or
title: 'Pipeline engine foundation — data model, IPC, and executor'
status: completed
priority: high
category: feature
blockedBy: []
blocks: []
createdAt: '2026-03-04T01:04:09.301Z'
updatedAt: '2026-03-07T13:02:18.386Z'
completedAt: '2026-03-07T13:02:18.386Z'
context: Session 2026-03-04
---
Implement the core pipeline infrastructure: data types in ipcChannels.ts (PipelineRun, PipelineJob, PipelineStage, PipelineArtifact types), IPC channels (PIPELINE_START, PIPELINE_CANCEL, PIPELINE_PROGRESS, etc.), pipelineManager.ts with init()+setupIPC(), workflow YAML parser, sequential stage executor with DAG support, and artifact collection system. Register in main/index.ts. See ADR-007 Section 3.1-3.3.
