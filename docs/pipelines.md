---
title: Pipeline Workflows
description: YAML-driven automation workflows with AI-powered stages.
---

# Pipeline Workflows

SubFrame includes a built-in pipeline system for running automated workflows — code review, testing, health checks, and custom stages defined in YAML.

## Quick Start

Pipelines are defined as YAML files in `.subframe/workflows/`. Several templates ship by default:

| Workflow | File | What it does |
|----------|------|-------------|
| **Review** | `review.yml` | AI-powered code review of recent changes |
| **Task Verify** | `task-verify.yml` | Validates task completion against acceptance criteria |
| **Health Check** | `health-check.yml` | Audits SubFrame component status and documentation |
| **Docs Audit** | `docs-audit.yml` | Checks documentation completeness and accuracy |
| **Security Scan** | `security-scan.yml` | Scans for security issues in the codebase |

## Running a Pipeline

Open the Pipeline panel (`Ctrl+Shift+Y`) and select a workflow to run. Each stage executes sequentially, showing live progress and output in the Activity Bar at the bottom of the window.

## YAML Syntax

Workflows use a GitHub Actions-inspired YAML format:

```yaml
name: review
description: AI-powered code review

on:
  manual: true        # Can be triggered manually from the UI

stages:
  - name: typecheck
    run: npm run typecheck

  - name: lint
    run: npm run lint

  - name: ai-review
    ai: true           # This stage spawns an AI tool
    prompt: |
      Review the recent changes for bugs, security issues,
      and code quality. Report findings with file:line references.

  - name: build
    run: npm run build
```

### Stage types

There are two types of stages:

- **Shell stages** (`run:`) — Execute a shell command. The stage passes or fails based on the command's exit code.
- **AI stages** (`ai: true`) — Spawn an AI tool with the given `prompt:` and capture its output. Useful for automated code review, analysis, and verification tasks.

### Triggers

- `manual: true` — Run on demand from the Pipeline panel UI
- `push: true` — Auto-run on git push (via the pre-push hook)

## Pipeline History

Run history is stored in `.subframe/pipelines/runs.json`. The Pipeline panel displays past runs with their status (passed, failed, running), timestamps, and stage-by-stage output. This lets you review what happened in previous runs without re-executing the workflow.

## Creating Custom Workflows

Create a new `.yml` file in `.subframe/workflows/`:

```yaml
name: my-workflow
description: Custom pipeline

stages:
  - name: test
    run: npm test

  - name: review
    ai: true
    prompt: Review test coverage and suggest improvements.

  - name: deploy-check
    run: node scripts/verify-deploy.js
```

The workflow appears automatically in the Pipeline panel — no additional registration is needed.

### Tips for writing workflows

- **Keep stages focused.** Each stage should do one thing. Break complex pipelines into multiple small stages rather than one large script.
- **Use AI stages for judgment calls.** Shell stages are best for deterministic checks (typecheck, lint, build). AI stages are best for subjective analysis (code review, documentation quality).
- **Order matters.** Stages run sequentially. Put fast, deterministic checks (lint, typecheck) before slower AI stages so failures surface early.

## Activity Bar Integration

Pipeline progress streams to the Activity Bar in real time. Each stage shows its status (running, passed, failed) with elapsed time and output. Long-running stages display heartbeat updates so you can tell the pipeline is still working. Completed or failed activities can be dismissed individually from the bar.
