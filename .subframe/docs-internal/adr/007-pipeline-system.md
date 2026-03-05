# ADR-007: Pipeline System (Airlock-Inspired)

**Status:** Proposed
**Date:** 2026-03-03
**Context:** [github.com/Codename-11/airlock](https://github.com/Codename-11/airlock) — local-first Git proxy with AI-powered validation pipelines

---

## 1. Problem

SubFrame manages terminals, tasks, sessions, and agent state — but has no structured workflow for validating, reviewing, or transforming code before it ships. The `/sub-audit` skill produces plain text with no structured output, no file:line anchoring, and no patch suggestions. There is no pre-push validation, automated test generation, PR description writing, or composable pipeline system.

Airlock solves this with a pipeline engine that intercepts `git push` and runs configurable AI-powered stages (lint, test, describe, critique) before forwarding to the remote. Its architecture provides three transferable patterns:

1. **Typed artifact system** — stages produce content (markdown), comments (file:line anchored), and patches (selectable diffs)
2. **Pipeline engine with freeze semantics** — auto-apply safe fixes pre-freeze, require human review post-freeze
3. **YAML workflow configuration** — GitHub Actions-inspired DAG of jobs and steps

---

## 2. Decision

Implement a pipeline system in SubFrame that adapts Airlock's core patterns to our Electron + IPC + React architecture. The system has five layers:

```
┌─────────────────────────────────────────────┐
│  5. Workflow Config (.subframe/workflows/)   │  YAML definitions
├─────────────────────────────────────────────┤
│  4. Review Panel (renderer)                  │  Artifact display + approval UX
├─────────────────────────────────────────────┤
│  3. Built-in Stages (main)                   │  lint, test, describe, critique
├─────────────────────────────────────────────┤
│  2. Artifact System (shared)                 │  Content, Comment, Patch types
├─────────────────────────────────────────────┤
│  1. Pipeline Engine (main)                   │  Stage execution, DAG, freeze
└─────────────────────────────────────────────┘
```

---

## 3. Architecture

### 3.1 Data Model (shared/ipcChannels.ts)

#### Pipeline Run

```ts
interface PipelineRun {
  id: string;                    // ulid or nanoid
  projectPath: string;
  workflowId: string;            // references workflow YAML
  trigger: PipelineTrigger;      // 'manual' | 'pre-push' | 'skill'
  status: PipelineRunStatus;     // 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'
  branch: string;
  baseSha: string;
  headSha: string;
  jobs: PipelineJob[];
  artifacts: PipelineArtifact[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

type PipelineTrigger = 'manual' | 'pre-push' | 'skill';
type PipelineRunStatus = 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
```

#### Jobs and Stages

```ts
interface PipelineJob {
  id: string;
  name: string;
  needs: string[];               // job IDs this depends on (DAG)
  stages: PipelineStage[];
  status: StageStatus;
  startedAt: string | null;
  completedAt: string | null;
}

interface PipelineStage {
  id: string;
  name: string;
  type: StageType;               // 'lint' | 'test' | 'describe' | 'critique' | 'freeze' | 'push' | 'custom'
  status: StageStatus;           // 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  requireApproval: boolean | 'if_patches';
  continueOnError: boolean;
  frozen: boolean;               // true = post-freeze (patches require review)
  artifacts: string[];           // artifact IDs produced by this stage
  logs: string[];                // stdout/stderr lines
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
}

type StageType = 'lint' | 'test' | 'describe' | 'critique' | 'freeze' | 'push' | 'create-pr' | 'custom';
type StageStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
```

#### Artifacts

```ts
type PipelineArtifact =
  | ContentArtifact
  | CommentArtifact
  | PatchArtifact;

interface ContentArtifact {
  id: string;
  type: 'content';
  stageId: string;
  title: string;
  body: string;                  // markdown
  createdAt: string;
}

interface CommentArtifact {
  id: string;
  type: 'comment';
  stageId: string;
  file: string;                  // relative path
  line: number;
  endLine?: number;
  message: string;
  severity: 'error' | 'warning' | 'info' | 'suggestion';
  category?: string;             // 'bug' | 'security' | 'performance' | 'style' | 'simplification'
  createdAt: string;
}

interface PatchArtifact {
  id: string;
  type: 'patch';
  stageId: string;
  title: string;
  explanation: string;
  diff: string;                  // unified diff format
  files: string[];               // affected file paths
  applied: boolean;
  createdAt: string;
}
```

#### Workflow Definition (YAML → parsed)

```ts
interface WorkflowDefinition {
  name: string;
  on: {
    push?: { branches?: string[]; branchesIgnore?: string[] };
    manual?: boolean;
  };
  jobs: Record<string, WorkflowJob>;
}

interface WorkflowJob {
  name?: string;
  needs?: string[];
  steps: WorkflowStep[];
}

interface WorkflowStep {
  name: string;
  uses?: string;                 // built-in stage type or path to custom script
  run?: string;                  // shell command
  requireApproval?: boolean | 'if_patches';
  continueOnError?: boolean;
  timeout?: number;              // seconds
  env?: Record<string, string>;
}
```

### 3.2 IPC Channels

```ts
// Pipeline — in IPC constant object
PIPELINE_LIST_WORKFLOWS: 'pipeline-list-workflows',
PIPELINE_LIST_RUNS: 'pipeline-list-runs',
PIPELINE_GET_RUN: 'pipeline-get-run',
PIPELINE_START: 'pipeline-start',
PIPELINE_CANCEL: 'pipeline-cancel',
PIPELINE_APPROVE_STAGE: 'pipeline-approve-stage',
PIPELINE_REJECT_STAGE: 'pipeline-reject-stage',
PIPELINE_APPLY_PATCH: 'pipeline-apply-patch',
PIPELINE_PROGRESS: 'pipeline-progress',         // main → renderer push (streaming)
PIPELINE_RUN_UPDATED: 'pipeline-run-updated',   // main → renderer push (state change)
PIPELINE_RUNS_DATA: 'pipeline-runs-data',        // main → renderer push (full list)
WATCH_PIPELINE: 'watch-pipeline',
UNWATCH_PIPELINE: 'unwatch-pipeline',
```

**Type maps:**

```ts
// IPCHandleMap (request-response)
[IPC.PIPELINE_LIST_WORKFLOWS]: { args: [projectPath: string]; return: WorkflowDefinition[] }
[IPC.PIPELINE_START]: { args: [payload: { projectPath: string; workflowId: string; trigger: PipelineTrigger }]; return: { runId: string } }
[IPC.PIPELINE_CANCEL]: { args: [runId: string]; return: { success: boolean } }
[IPC.PIPELINE_APPROVE_STAGE]: { args: [payload: { runId: string; stageId: string }]; return: { success: boolean } }
[IPC.PIPELINE_APPLY_PATCH]: { args: [payload: { runId: string; patchId: string }]; return: { success: boolean; error?: string } }

// IPCSendMap (fire-and-forget)
[IPC.PIPELINE_LIST_RUNS]: { projectPath: string }
[IPC.PIPELINE_GET_RUN]: { runId: string }
[IPC.WATCH_PIPELINE]: string    // projectPath
[IPC.UNWATCH_PIPELINE]: void

// IPCEventMap (main → renderer push)
[IPC.PIPELINE_PROGRESS]: { runId: string; stageId: string; log: string }
[IPC.PIPELINE_RUN_UPDATED]: PipelineRun
[IPC.PIPELINE_RUNS_DATA]: { projectPath: string; runs: PipelineRun[] }
```

### 3.3 Main Process Module: `pipelineManager.ts`

Follows the standard `init()` + `setupIPC()` pattern. Module-level state:

```ts
let mainWindow: BrowserWindow | null = null;
const activeRuns: Map<string, PipelineRunContext> = new Map();

interface PipelineRunContext {
  run: PipelineRun;
  controller: AbortController;
  worktreePath?: string;         // if pipeline uses a worktree for isolation
}
```

**Execution engine:**

1. Parse workflow YAML from `.subframe/workflows/<id>.yml`
2. Topological sort jobs by `needs:` dependencies (Kahn's algorithm)
3. Execute jobs sequentially (parallel jobs in future iteration)
4. Within each job, execute stages sequentially
5. At `freeze` stage: commit any auto-applied patches, mark subsequent stages as `frozen: true`
6. At `requireApproval` stages: set run status to `paused`, push `PIPELINE_RUN_UPDATED`, wait for approval IPC
7. Collect artifacts per-stage, push `PIPELINE_PROGRESS` for log lines
8. On completion/failure: push final `PIPELINE_RUN_UPDATED`

**Stage execution:** Each stage type maps to a handler function:

```ts
const STAGE_HANDLERS: Record<StageType, StageHandler> = {
  lint: runLintStage,
  test: runTestStage,
  describe: runDescribeStage,
  critique: runCritiqueStage,
  freeze: runFreezeStage,
  push: runPushStage,
  'create-pr': runCreatePrStage,
  custom: runCustomStage,
};

type StageHandler = (ctx: StageContext) => Promise<StageResult>;

interface StageContext {
  run: PipelineRun;
  stage: PipelineStage;
  projectPath: string;
  worktreePath: string;
  baseSha: string;
  headSha: string;
  artifacts: PipelineArtifact[];  // accumulated from prior stages
  aiTool: string;                 // from aiToolManager
  abortSignal: AbortSignal;
  emit: (event: string, data: unknown) => void;  // push to renderer
}

interface StageResult {
  status: 'completed' | 'failed' | 'skipped';
  artifacts: PipelineArtifact[];
  logs: string[];
}
```

**AI tool integration:** Stage handlers that need AI use `aiToolManager.getCommand('review')` or spawn the active tool's CLI process. The tool adapter is transparent — stages don't know which AI runs underneath.

### 3.4 Built-in Stage Handlers

#### `lint`
1. Check for `.subframe/pipelines/lint.sh` (cached lint script)
2. If missing: spawn AI tool with prompt "Discover this project's linters and create a lint script"
3. Execute lint script in worktree
4. Parse output → `CommentArtifact[]` (file:line anchored) + `PatchArtifact[]` (auto-fixes)
5. Pre-freeze: auto-apply patches. Post-freeze: queue for review.

#### `test`
1. Spawn AI tool with prompt including the diff
2. Agent runs existing tests, writes new ones if needed
3. Returns structured JSON: `{ verdict: 'pass'|'fail'|'skip', summary, details }`
4. Produce `ContentArtifact` with test results

#### `describe`
1. Compute diff between `baseSha` and `headSha`
2. Spawn AI tool with prompt: "Generate PR title, markdown description, and Mermaid architecture diagram"
3. Returns structured JSON: `{ title, body, diagram }`
4. Produce `ContentArtifact` with PR description

#### `critique`
1. Compute diff
2. Spawn AI tool with prompt: "Review for bugs, security risks, performance, simplification"
3. Returns structured JSON: `{ comments: [{file, line, message, severity, category}], summary }`
4. Produce `CommentArtifact[]` + `ContentArtifact` (summary)

#### `freeze`
1. If any unapplied `PatchArtifact`s from pre-freeze stages: apply them, commit
2. Mark all subsequent stages as `frozen: true`
3. Produce `ContentArtifact` with freeze summary (files changed, patches applied)

#### `push`
1. `git push` from worktree to remote
2. Uses `gitBranchesManager` primitives for safety checks

#### `create-pr`
1. Read accumulated `ContentArtifact`s (especially from `describe` stage)
2. Use `gh pr create` with title and body from artifacts
3. Produce `ContentArtifact` with PR URL

### 3.5 Renderer: Review Panel

New panel: `PipelinePanel.tsx` — registered in `useUIStore` as `'pipeline'` in `PanelId`.

**Layout (panel mode):**
```
┌─────────────────────────────────┐
│ Pipeline    [▶ Run] [⚙ Config]  │  toolbar
├─────────────────────────────────┤
│ ● main.yml  ✓3 ✗0 ⏳1          │  workflow status row
│ Run #abc — 2m ago    ▸ Running  │  recent run
│ Run #def — 1h ago    ✓ Passed   │  history
├─────────────────────────────────┤
│ [Overview] [Critique] [Patches] │  tabs (when run selected)
│                                 │
│ ┌── lint ──── ✓ 2.1s ─────┐    │
│ │ describe ── ✓ 4.3s      │    │  stage timeline
│ │ critique ── ⏳ running    │    │
│ └── push ──── ○ pending ──┘    │
│                                 │
│ ## PR Description               │  content artifact
│ Summary of changes...           │
│                                 │
│ ⚠ src/main/auth.ts:42          │  comment artifact
│   Potential null deref...       │
└─────────────────────────────────┘
```

**Layout (full view):**
```
┌──────────────┬──────────────────────────────────────┐
│ Runs List    │  Run Detail                           │
│              │                                       │
│ ● #abc ▸    │  [Overview] [Critique] [Patches] [Log]│
│   #def ✓    │                                       │
│   #ghi ✗    │  Stage pipeline visualization          │
│              │  + selected tab content                │
│              │                                       │
│              │  Artifact display area                 │
│              │  (markdown, comments, diffs)           │
└──────────────┴──────────────────────────────────────┘
```

**Tabs:**

| Tab | Content |
|-----|---------|
| **Overview** | Stage timeline + all artifacts in chronological feed |
| **Critique** | `CommentArtifact[]` grouped by file, with severity badges |
| **Patches** | `PatchArtifact[]` with diff preview, checkbox select, "Apply Selected" button |
| **Log** | Raw stage logs (stdout/stderr), filterable by stage |

**Components:**

| Component | Purpose |
|-----------|---------|
| `PipelinePanel` | Top-level panel, run list + detail |
| `PipelineTimeline` | Horizontal stage flow (reuses pattern from `TaskTimeline`) |
| `ArtifactFeed` | Chronological artifact list with type icons |
| `CritiqueView` | File-grouped comment display with severity colors |
| `PatchReview` | Diff display with select/apply controls |
| `PipelineLogView` | Scrollable log output per stage |
| `WorkflowEditor` | YAML editor (CodeMirror) for workflow config |

**Hook: `usePipeline.ts`**

Follows `useTasks.ts` pattern exactly:
- Push listener for `PIPELINE_RUNS_DATA` with timestamp dedup
- `useIPCEvent(IPC.PIPELINE_RUN_UPDATED, ...)` for invalidation
- `staleTime: Infinity`
- Mutations for `start`, `cancel`, `approveStage`, `applyPatch`
- Additional `useIPCListener(IPC.PIPELINE_PROGRESS, ...)` for streaming logs

### 3.6 Workflow Configuration

Stored per-project at `.subframe/workflows/<name>.yml`. Example default:

```yaml
# .subframe/workflows/review.yml
name: Code Review
on:
  push:
    branches: ['**']
  manual: true

jobs:
  review:
    steps:
      - name: lint
        uses: lint

      - name: freeze
        uses: freeze

      - name: describe
        uses: describe

      - name: test
        uses: test
        continue-on-error: true

      - name: critique
        uses: critique
        require-approval: if_patches
```

Extended pipeline example:

```yaml
# .subframe/workflows/ship.yml
name: Ship
on:
  manual: true

jobs:
  validate:
    steps:
      - name: lint
        uses: lint
      - name: test
        uses: test
      - name: freeze
        uses: freeze
      - name: critique
        uses: critique

  ship:
    needs: [validate]
    steps:
      - name: describe
        uses: describe
      - name: push
        uses: push
        require-approval: true
      - name: create-pr
        uses: create-pr
```

### 3.7 Git Integration (Phase 2)

**Pre-push hook (optional):** Install via `git config core.hooksPath` or `.git/hooks/pre-push`. When enabled:
1. Hook fires on `git push`
2. Sends IPC to `pipelineManager` with branch + SHA info
3. Pipeline runs the configured workflow
4. If approved: hook exits 0, push proceeds
5. If rejected/cancelled: hook exits 1, push blocked

This is opt-in. Manual trigger (`▶ Run` button) works without any git hook setup.

**Worktree isolation (optional):** For pipelines that modify files (lint auto-fix), the engine can create a temporary worktree via `gitBranchesManager.addWorktree()`, run stages there, then merge results back.

### 3.8 Extensibility: Custom Stages

Two mechanisms for custom stages:

**Shell command (`run:`):**
```yaml
- name: security-scan
  run: npm audit --json > $PIPELINE_ARTIFACTS/audit.json
```

**Script reference (`uses:` with path):**
```yaml
- name: custom-check
  uses: .subframe/pipelines/stages/my-check.sh
```

Environment variables available to custom stages:
```
PIPELINE_RUN_ID, PIPELINE_BRANCH, PIPELINE_BASE_SHA, PIPELINE_HEAD_SHA
PIPELINE_WORKTREE (cwd), PIPELINE_ARTIFACTS (output dir), PIPELINE_PROJECT_ROOT
PIPELINE_AI_TOOL (active AI tool command)
```

Custom stages produce artifacts by writing to `$PIPELINE_ARTIFACTS/`:
- `content/*.md` → `ContentArtifact`
- `comments/*.json` → `CommentArtifact[]`
- `patches/*.json` → `PatchArtifact[]`

---

## 4. Phased Implementation

### Phase 1: Foundation (Engine + Artifacts + IPC)
- Data model types in `ipcChannels.ts`
- `pipelineManager.ts` with init/setupIPC, workflow YAML parser, sequential stage executor
- Artifact collection system
- Basic IPC channels (list workflows, start run, get run, progress events)
- Default workflow template in `frameTemplates.ts`

### Phase 2: Built-in Stages
- `critique` stage (AI code review → CommentArtifacts)
- `lint` stage (discover + run linters → PatchArtifacts)
- `describe` stage (PR description → ContentArtifact)
- `test` stage (run/generate tests → ContentArtifact with verdict)
- `freeze` stage (auto-apply pre-freeze patches, lock)

### Phase 3: Review Panel
- `PipelinePanel.tsx` (panel + full-view modes)
- `PipelineTimeline.tsx` (stage flow visualization)
- `usePipeline.ts` hook
- Overview, Critique, Patches, Log tabs
- Approval/rejection UX for paused stages

### Phase 4: Git Integration + Workflows
- Pre-push hook installation
- Worktree isolation for mutable stages
- YAML workflow editor (CodeMirror)
- Branch filtering (`on.push.branches`)
- Parallel job execution (DAG)

### Phase 5: Extensibility
- Custom stage support (`run:` commands, script references)
- Stage environment variables
- Artifact file-based output for custom stages
- Community/shared workflow templates

---

## 5. What We're NOT Doing (vs Airlock)

| Airlock Feature | SubFrame Decision | Reason |
|---|---|---|
| Git bare repo proxy | Skip | Overly complex for Electron; pre-push hook achieves same goal |
| Background daemon | Skip | Electron main process IS our daemon |
| SQLite state storage | Skip | File-based state (consistent with tasks, agent-state) |
| Unix socket IPC | Skip | Electron IPC is our transport |
| Tauri desktop app | Skip | We already have Electron + React |
| Mermaid diagrams in describe | Include | Render via MarkdownPreview (already supports GFM) |
| `uses:` from remote Git repos | Defer | Start with local built-in + script stages, remote later |

---

## 6. File Inventory

### New Files

| File | Purpose |
|------|---------|
| `src/main/pipelineManager.ts` | Main process pipeline engine |
| `src/main/pipelineStages.ts` | Built-in stage handler implementations |
| `src/main/pipelineWorkflowParser.ts` | YAML workflow parser + validator |
| `src/renderer/hooks/usePipeline.ts` | TanStack Query hook for pipeline data |
| `src/renderer/components/PipelinePanel.tsx` | Review panel (panel + full-view) |
| `src/renderer/components/PipelineTimeline.tsx` | Stage flow visualization |
| `src/renderer/components/CritiqueView.tsx` | File-grouped comment display |
| `src/renderer/components/PatchReview.tsx` | Diff display with apply controls |
| `src/renderer/components/PipelineLogView.tsx` | Stage log viewer |

### Modified Files

| File | Changes |
|------|---------|
| `src/shared/ipcChannels.ts` | Pipeline IPC channels + type maps + data types |
| `src/shared/frameConstants.ts` | Pipeline directory constants |
| `src/shared/frameTemplates.ts` | Default workflow YAML template |
| `src/main/index.ts` | Register pipelineManager init + setupIPC |
| `src/renderer/stores/useUIStore.ts` | Add `'pipeline'` to PanelId |
| `src/renderer/components/Sidebar.tsx` | Pipeline panel button |
| `src/renderer/components/RightPanel.tsx` | Render PipelinePanel |
| `src/renderer/components/TerminalArea.tsx` | Render PipelinePanel in full-view mode |

### New Project Files (per-project)

| File | Purpose |
|------|---------|
| `.subframe/workflows/review.yml` | Default review workflow |
| `.subframe/pipelines/` | Pipeline state + cached scripts (lint.sh, etc.) |

---

## 7. Dependencies

### New npm packages needed

| Package | Purpose |
|---------|---------|
| `yaml` | Parse workflow YAML (already implicit via js-yaml? check) |
| `diff` or `diff2html` | Unified diff parsing + display in PatchReview |

### Existing packages leveraged

| Package | Used For |
|---------|----------|
| `react-markdown` + `remark-gfm` | Render ContentArtifacts |
| `@codemirror/*` | WorkflowEditor (YAML editing) |
| `framer-motion` | PipelineTimeline animations |
| `highlight.js` | Code blocks in artifact markdown |
| `lucide-react` | Stage status icons |
