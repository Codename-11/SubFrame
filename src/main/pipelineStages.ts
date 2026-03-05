/**
 * Pipeline Stage Handlers
 * Built-in stage implementations for the pipeline system.
 */

import { exec, spawn } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { FRAME_PIPELINES_DIR } from '../shared/frameConstants';
import type {
  PipelineArtifact,
  PipelineRun,
  PipelineStage,
  ContentArtifact,
  CommentArtifact,
  PatchArtifact,
  ArtifactSeverity,
} from '../shared/ipcChannels';

// ─── Stage Context & Result ──────────────────────────────────────────────────

export interface StageContext {
  run: PipelineRun;
  stage: PipelineStage;
  projectPath: string;
  worktreePath: string | null;
  baseSha: string;
  headSha: string;
  artifacts: PipelineArtifact[];
  aiTool: string;
  abortSignal: AbortSignal;
  emit: (log: string) => void;
}

export interface StageResult {
  status: 'completed' | 'failed' | 'skipped';
  artifacts: PipelineArtifact[];
  logs: string[];
}

export type StageHandler = (ctx: StageContext) => Promise<StageResult>;

// ─── Utilities ───────────────────────────────────────────────────────────────

function uid(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

/**
 * Run a shell command with custom env and return stdout/stderr.
 */
function execAsyncWithEnv(
  cmd: string,
  opts: { cwd: string; signal?: AbortSignal; env?: Record<string, string | undefined> }
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = exec(cmd, { cwd: opts.cwd, maxBuffer: 10 * 1024 * 1024, signal: opts.signal, env: opts.env }, (err, stdout, stderr) => {
      if (err && !opts.signal?.aborted) {
        const e = err as Error & { stdout?: string; stderr?: string };
        e.stdout = stdout;
        e.stderr = stderr;
        reject(e);
      } else if (opts.signal?.aborted) {
        reject(new Error('Aborted'));
      } else {
        resolve({ stdout, stderr });
      }
    });
    if (opts.signal) {
      opts.signal.addEventListener('abort', () => {
        child.kill('SIGTERM');
      }, { once: true });
    }
  });
}

/**
 * Run a shell command and return stdout/stderr.
 */
function execAsync(
  cmd: string,
  opts: { cwd: string; signal?: AbortSignal }
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = exec(cmd, { cwd: opts.cwd, maxBuffer: 10 * 1024 * 1024, signal: opts.signal }, (err, stdout, stderr) => {
      if (err && !opts.signal?.aborted) {
        // Attach stdout/stderr so callers can still read partial output
        const e = err as Error & { stdout?: string; stderr?: string };
        e.stdout = stdout;
        e.stderr = stderr;
        reject(e);
      } else if (opts.signal?.aborted) {
        reject(new Error('Aborted'));
      } else {
        resolve({ stdout, stderr });
      }
    });
    // If the signal fires after exec started, kill the process
    if (opts.signal) {
      opts.signal.addEventListener('abort', () => {
        child.kill('SIGTERM');
      }, { once: true });
    }
  });
}

/**
 * Get the diff between baseSha and headSha.
 */
async function getDiff(ctx: StageContext): Promise<string> {
  const cwd = ctx.worktreePath || ctx.projectPath;
  try {
    const { stdout } = await execAsync(
      `git diff ${ctx.baseSha}...${ctx.headSha}`,
      { cwd, signal: ctx.abortSignal }
    );
    return stdout;
  } catch (err) {
    // Fallback: diff against HEAD~1 if shas are invalid
    ctx.emit(`Warning: git diff failed, falling back to HEAD diff`);
    try {
      const { stdout } = await execAsync('git diff HEAD~1', { cwd, signal: ctx.abortSignal });
      return stdout;
    } catch {
      return '';
    }
  }
}

/**
 * Spawn the AI tool CLI with a prompt and parse JSON from stdout.
 */
async function spawnAITool(
  ctx: StageContext,
  prompt: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const cwd = ctx.worktreePath || ctx.projectPath;
    const child = spawn(ctx.aiTool, ['--print', '--output-format', 'json', prompt], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data: Buffer) => {
      const chunk = data.toString();
      stdout += chunk;
    });

    child.stderr.on('data', (data: Buffer) => {
      const chunk = data.toString();
      stderr += chunk;
      // Stream stderr lines as logs
      for (const line of chunk.split('\n').filter(Boolean)) {
        ctx.emit(line);
      }
    });

    child.on('close', (code) => {
      if (ctx.abortSignal.aborted) {
        reject(new Error('Aborted'));
      } else if (code !== 0) {
        reject(new Error(`AI tool exited with code ${code}: ${stderr}`));
      } else {
        resolve(stdout);
      }
    });

    child.on('error', reject);

    ctx.abortSignal.addEventListener('abort', () => {
      child.kill('SIGTERM');
    }, { once: true });
  });
}

/**
 * Try to parse JSON from AI tool output.
 * The output may contain markdown fences or other wrapping.
 */
function parseJSONFromOutput(output: string): unknown {
  // Try direct parse first
  try {
    return JSON.parse(output);
  } catch {
    // noop
  }

  // Try extracting from markdown code fences
  const fenceMatch = output.match(/```(?:json)?\s*\n([\s\S]*?)\n\s*```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1]);
    } catch {
      // noop
    }
  }

  // Try finding first { or [ to last } or ]
  const start = output.search(/[{[]/);
  const endBrace = output.lastIndexOf('}');
  const endBracket = output.lastIndexOf(']');
  const end = Math.max(endBrace, endBracket);
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(output.slice(start, end + 1));
    } catch {
      // noop
    }
  }

  return null;
}

// ─── Stage Handlers ──────────────────────────────────────────────────────────

/**
 * Lint Stage
 * Checks for a cached lint script at .subframe/pipelines/lint.sh.
 * If not found, spawns AI tool to discover project linters.
 * Runs the lint command and parses output.
 */
export async function runLintStage(ctx: StageContext): Promise<StageResult> {
  const logs: string[] = [];
  const artifacts: PipelineArtifact[] = [];
  const cwd = ctx.worktreePath || ctx.projectPath;
  const lintScriptPath = path.join(ctx.projectPath, FRAME_PIPELINES_DIR, 'lint.sh');

  ctx.emit('Starting lint stage...');
  logs.push('Starting lint stage');

  let lintCommand: string;

  if (fs.existsSync(lintScriptPath)) {
    lintCommand = fs.readFileSync(lintScriptPath, 'utf8').trim();
    ctx.emit(`Using cached lint command: ${lintCommand}`);
    logs.push(`Using cached lint command: ${lintCommand}`);
  } else {
    // Ask AI tool to discover linters
    ctx.emit('Discovering project linters via AI tool...');
    logs.push('Discovering project linters');
    try {
      const output = await spawnAITool(
        ctx,
        'Look at this project and determine the lint command. Respond with ONLY a JSON object: {"command": "npm run lint"} or similar. No explanation.'
      );
      const parsed = parseJSONFromOutput(output) as { command?: string } | null;
      lintCommand = parsed?.command || 'npm run lint';

      // Cache the discovered command
      const pipelinesDir = path.join(ctx.projectPath, FRAME_PIPELINES_DIR);
      if (!fs.existsSync(pipelinesDir)) {
        fs.mkdirSync(pipelinesDir, { recursive: true });
      }
      fs.writeFileSync(lintScriptPath, lintCommand, 'utf8');
      ctx.emit(`Discovered and cached lint command: ${lintCommand}`);
      logs.push(`Discovered lint command: ${lintCommand}`);
    } catch (err) {
      lintCommand = 'npm run lint';
      ctx.emit(`AI discovery failed, using default: ${lintCommand}`);
      logs.push(`AI discovery failed, defaulting to: ${lintCommand}`);
    }
  }

  // Run the lint command
  try {
    const { stdout, stderr } = await execAsync(lintCommand, { cwd, signal: ctx.abortSignal });
    const output = (stdout + '\n' + stderr).trim();
    ctx.emit('Lint passed');
    logs.push('Lint passed');

    if (output) {
      artifacts.push({
        id: uid(),
        type: 'content',
        stageId: ctx.stage.id,
        title: 'Lint Output',
        body: output,
        createdAt: now(),
      });
    }

    return { status: 'completed', artifacts, logs };
  } catch (err) {
    const e = err as Error & { stdout?: string; stderr?: string };
    const output = ((e.stdout || '') + '\n' + (e.stderr || '')).trim();
    ctx.emit(`Lint failed: ${e.message}`);
    logs.push(`Lint failed: ${e.message}`);

    if (output) {
      // Try to parse lint output for file/line comments
      const commentArtifacts = parseLintOutput(output, ctx.stage.id);
      artifacts.push(...commentArtifacts);

      artifacts.push({
        id: uid(),
        type: 'content',
        stageId: ctx.stage.id,
        title: 'Lint Errors',
        body: output,
        createdAt: now(),
      });
    }

    return { status: 'failed', artifacts, logs };
  }
}

/**
 * Parse common lint output formats into CommentArtifact[].
 * Handles patterns like: file.ts:10:5: error message
 */
function parseLintOutput(output: string, stageId: string): CommentArtifact[] {
  const artifacts: CommentArtifact[] = [];
  // Match patterns like: src/file.ts:10:5: error Some message
  const linePattern = /^(.+?):(\d+)(?::\d+)?:\s*(error|warning|info)?\s*(.+)$/gm;
  let match: RegExpExecArray | null;

  while ((match = linePattern.exec(output)) !== null) {
    const [, file, lineStr, severity, message] = match;
    artifacts.push({
      id: uid(),
      type: 'comment',
      stageId,
      file: file.trim(),
      line: parseInt(lineStr, 10),
      message: message.trim(),
      severity: (severity as ArtifactSeverity) || 'error',
      createdAt: now(),
    });
  }

  return artifacts;
}

/**
 * Test Stage
 * Spawns AI tool with diff context to run/evaluate tests.
 */
export async function runTestStage(ctx: StageContext): Promise<StageResult> {
  const logs: string[] = [];
  const artifacts: PipelineArtifact[] = [];

  ctx.emit('Starting test stage...');
  logs.push('Starting test stage');

  const diff = await getDiff(ctx);

  const prompt = `You are reviewing code changes for a project. Here is the diff:

\`\`\`diff
${diff.slice(0, 8000)}
\`\`\`

Run the project's test suite and evaluate the results. Respond with ONLY a JSON object:
{
  "verdict": "pass" | "fail" | "skip",
  "summary": "Brief summary of test results",
  "details": "Detailed test output or analysis"
}`;

  try {
    const output = await spawnAITool(ctx, prompt);
    const parsed = parseJSONFromOutput(output) as {
      verdict?: string;
      summary?: string;
      details?: string;
    } | null;

    const verdict = parsed?.verdict || 'skip';
    const summary = parsed?.summary || 'Test evaluation completed';
    const details = parsed?.details || output;

    ctx.emit(`Test verdict: ${verdict}`);
    logs.push(`Verdict: ${verdict} - ${summary}`);

    artifacts.push({
      id: uid(),
      type: 'content',
      stageId: ctx.stage.id,
      title: 'Test Results',
      body: `## ${verdict.toUpperCase()}\n\n${summary}\n\n${details}`,
      createdAt: now(),
    });

    return {
      status: verdict === 'fail' ? 'failed' : 'completed',
      artifacts,
      logs,
    };
  } catch (err) {
    ctx.emit(`Test stage error: ${(err as Error).message}`);
    logs.push(`Error: ${(err as Error).message}`);
    return { status: 'failed', artifacts, logs };
  }
}

/**
 * Describe Stage
 * Computes diff and spawns AI tool for PR description.
 */
export async function runDescribeStage(ctx: StageContext): Promise<StageResult> {
  const logs: string[] = [];
  const artifacts: PipelineArtifact[] = [];

  ctx.emit('Starting describe stage...');
  logs.push('Starting describe stage');

  const diff = await getDiff(ctx);

  const prompt = `You are generating a pull request description for the following changes. Analyze the diff and write a clear, concise PR description in markdown format.

\`\`\`diff
${diff.slice(0, 12000)}
\`\`\`

Write a PR description with:
- A brief summary (1-2 sentences)
- What changed (bullet points)
- Why it changed
- Any breaking changes or migration notes

Respond with ONLY a JSON object:
{
  "title": "PR title (max 70 chars)",
  "body": "Full markdown PR description"
}`;

  try {
    const output = await spawnAITool(ctx, prompt);
    const parsed = parseJSONFromOutput(output) as {
      title?: string;
      body?: string;
    } | null;

    const title = parsed?.title || 'Changes';
    const body = parsed?.body || output;

    ctx.emit(`Generated PR description: ${title}`);
    logs.push(`Generated description: ${title}`);

    artifacts.push({
      id: uid(),
      type: 'content',
      stageId: ctx.stage.id,
      title: `PR: ${title}`,
      body,
      createdAt: now(),
    });

    return { status: 'completed', artifacts, logs };
  } catch (err) {
    ctx.emit(`Describe stage error: ${(err as Error).message}`);
    logs.push(`Error: ${(err as Error).message}`);
    return { status: 'failed', artifacts, logs };
  }
}

/**
 * Critique Stage
 * Computes diff, spawns AI tool for code review.
 * Produces CommentArtifact[] for inline comments and ContentArtifact for summary.
 */
export async function runCritiqueStage(ctx: StageContext): Promise<StageResult> {
  const logs: string[] = [];
  const artifacts: PipelineArtifact[] = [];

  ctx.emit('Starting critique stage...');
  logs.push('Starting critique stage');

  const diff = await getDiff(ctx);

  const prompt = `You are performing a thorough code review on the following diff. Identify bugs, security issues, style problems, and suggest improvements.

\`\`\`diff
${diff.slice(0, 12000)}
\`\`\`

Respond with ONLY a JSON object:
{
  "summary": "Overall review summary",
  "comments": [
    {
      "file": "path/to/file.ts",
      "line": 42,
      "endLine": 45,
      "message": "Description of issue or suggestion",
      "severity": "error" | "warning" | "info" | "suggestion",
      "category": "bug" | "security" | "style" | "performance" | "suggestion"
    }
  ],
  "patches": [
    {
      "title": "Fix description",
      "explanation": "Why this fix is needed",
      "diff": "unified diff content",
      "files": ["path/to/file.ts"]
    }
  ]
}`;

  try {
    const output = await spawnAITool(ctx, prompt);
    const parsed = parseJSONFromOutput(output) as {
      summary?: string;
      comments?: Array<{
        file: string;
        line: number;
        endLine?: number;
        message: string;
        severity?: ArtifactSeverity;
        category?: string;
      }>;
      patches?: Array<{
        title: string;
        explanation: string;
        diff: string;
        files: string[];
      }>;
    } | null;

    const summary = parsed?.summary || 'Code review completed';
    const comments = parsed?.comments || [];
    const patches = parsed?.patches || [];

    ctx.emit(`Review complete: ${comments.length} comments, ${patches.length} patches`);
    logs.push(`${comments.length} comments, ${patches.length} patches`);

    // Create comment artifacts
    for (const comment of comments) {
      artifacts.push({
        id: uid(),
        type: 'comment',
        stageId: ctx.stage.id,
        file: comment.file,
        line: comment.line,
        endLine: comment.endLine,
        message: comment.message,
        severity: comment.severity || 'info',
        category: comment.category,
        createdAt: now(),
      });
    }

    // Create patch artifacts
    for (const patch of patches) {
      artifacts.push({
        id: uid(),
        type: 'patch',
        stageId: ctx.stage.id,
        title: patch.title,
        explanation: patch.explanation,
        diff: patch.diff,
        files: patch.files,
        applied: false,
        createdAt: now(),
      });
    }

    // Summary artifact
    artifacts.push({
      id: uid(),
      type: 'content',
      stageId: ctx.stage.id,
      title: 'Code Review Summary',
      body: summary,
      createdAt: now(),
    });

    return { status: 'completed', artifacts, logs };
  } catch (err) {
    ctx.emit(`Critique stage error: ${(err as Error).message}`);
    logs.push(`Error: ${(err as Error).message}`);
    return { status: 'failed', artifacts, logs };
  }
}

/**
 * Freeze Stage
 * Marks frozen=true on subsequent stages and produces a summary artifact.
 */
export async function runFreezeStage(ctx: StageContext): Promise<StageResult> {
  const logs: string[] = [];
  const artifacts: PipelineArtifact[] = [];

  ctx.emit('Freeze stage: marking subsequent stages as frozen');
  logs.push('Freezing subsequent stages');

  // Count artifacts collected so far
  const commentCount = ctx.artifacts.filter((a) => a.type === 'comment').length;
  const patchCount = ctx.artifacts.filter((a) => a.type === 'patch').length;
  const contentCount = ctx.artifacts.filter((a) => a.type === 'content').length;

  artifacts.push({
    id: uid(),
    type: 'content',
    stageId: ctx.stage.id,
    title: 'Pipeline Frozen',
    body: `Pipeline frozen after review.\n\n**Artifacts collected:**\n- ${commentCount} comments\n- ${patchCount} patches\n- ${contentCount} content items\n\nSubsequent stages will have frozen=true.`,
    createdAt: now(),
  });

  return { status: 'completed', artifacts, logs };
}

/**
 * Push Stage
 * Executes `git push` with safety checks.
 */
export async function runPushStage(ctx: StageContext): Promise<StageResult> {
  const logs: string[] = [];
  const artifacts: PipelineArtifact[] = [];
  const cwd = ctx.worktreePath || ctx.projectPath;

  ctx.emit('Starting push stage...');
  logs.push('Starting push stage');

  try {
    // Safety check: verify we're on a branch (not detached HEAD)
    const { stdout: branchOutput } = await execAsync(
      'git symbolic-ref --short HEAD',
      { cwd, signal: ctx.abortSignal }
    );
    const branch = branchOutput.trim();

    if (!branch) {
      ctx.emit('Push aborted: detached HEAD state');
      logs.push('Aborted: detached HEAD');
      return { status: 'failed', artifacts, logs };
    }

    // Safety check: don't push to main/master without explicit config
    if (branch === 'main' || branch === 'master') {
      ctx.emit(`Push aborted: refusing to push directly to ${branch}`);
      logs.push(`Aborted: refusing to push to ${branch}`);
      return { status: 'failed', artifacts, logs };
    }

    ctx.emit(`Pushing branch: ${branch}`);
    logs.push(`Pushing branch: ${branch}`);

    const { stdout, stderr } = await execAsync(
      `git push -u origin ${branch}`,
      { cwd, signal: ctx.abortSignal }
    );

    const output = (stdout + '\n' + stderr).trim();
    ctx.emit('Push successful');
    logs.push('Push successful');

    if (output) {
      artifacts.push({
        id: uid(),
        type: 'content',
        stageId: ctx.stage.id,
        title: 'Push Output',
        body: output,
        createdAt: now(),
      });
    }

    return { status: 'completed', artifacts, logs };
  } catch (err) {
    ctx.emit(`Push failed: ${(err as Error).message}`);
    logs.push(`Push failed: ${(err as Error).message}`);
    return { status: 'failed', artifacts, logs };
  }
}

/**
 * Create PR Stage
 * Uses `gh pr create` with accumulated describe artifacts for the PR body.
 */
export async function runCreatePrStage(ctx: StageContext): Promise<StageResult> {
  const logs: string[] = [];
  const artifacts: PipelineArtifact[] = [];
  const cwd = ctx.worktreePath || ctx.projectPath;

  ctx.emit('Starting create-pr stage...');
  logs.push('Starting create-pr stage');

  // Find describe artifacts to use as PR body
  const describeArtifacts = ctx.artifacts.filter(
    (a) => a.type === 'content' && a.title.startsWith('PR:')
  ) as ContentArtifact[];

  const prTitle = describeArtifacts.length > 0
    ? describeArtifacts[0].title.replace(/^PR:\s*/, '')
    : `Pipeline run ${ctx.run.id.slice(0, 8)}`;

  const prBody = describeArtifacts.length > 0
    ? describeArtifacts[0].body
    : 'Automated PR created by SubFrame pipeline.';

  try {
    // Check if a PR already exists for this branch
    const { stdout: existingPr } = await execAsync(
      'gh pr view --json url --jq .url 2>/dev/null || echo ""',
      { cwd, signal: ctx.abortSignal }
    );

    if (existingPr.trim()) {
      ctx.emit(`PR already exists: ${existingPr.trim()}`);
      logs.push(`PR exists: ${existingPr.trim()}`);

      artifacts.push({
        id: uid(),
        type: 'content',
        stageId: ctx.stage.id,
        title: 'Existing PR',
        body: `PR already exists: ${existingPr.trim()}`,
        createdAt: now(),
      });

      return { status: 'completed', artifacts, logs };
    }

    // Escape the title and body for shell
    const escapedTitle = prTitle.replace(/"/g, '\\"');
    const escapedBody = prBody.replace(/"/g, '\\"');

    const { stdout: prUrl } = await execAsync(
      `gh pr create --title "${escapedTitle}" --body "${escapedBody}"`,
      { cwd, signal: ctx.abortSignal }
    );

    ctx.emit(`PR created: ${prUrl.trim()}`);
    logs.push(`PR created: ${prUrl.trim()}`);

    artifacts.push({
      id: uid(),
      type: 'content',
      stageId: ctx.stage.id,
      title: 'PR Created',
      body: `Pull request created: ${prUrl.trim()}`,
      createdAt: now(),
    });

    return { status: 'completed', artifacts, logs };
  } catch (err) {
    ctx.emit(`Create PR failed: ${(err as Error).message}`);
    logs.push(`Create PR failed: ${(err as Error).message}`);
    return { status: 'failed', artifacts, logs };
  }
}

/**
 * Custom Stage
 * Executes the `run:` shell command or `uses:` script from a workflow step.
 */
export async function runCustomStage(
  ctx: StageContext,
  step: { run?: string; uses?: string; env?: Record<string, string> }
): Promise<StageResult> {
  const logs: string[] = [];
  const artifacts: PipelineArtifact[] = [];
  const cwd = ctx.worktreePath || ctx.projectPath;

  const command = step.run || (step.uses ? `bash ${step.uses}` : null);

  if (!command) {
    ctx.emit('Custom stage: no run or uses command specified');
    logs.push('No command specified');
    return { status: 'skipped', artifacts, logs };
  }

  ctx.emit(`Running custom command: ${command}`);
  logs.push(`Command: ${command}`);

  // Set up artifact output directory
  const artifactsDir = path.join(ctx.projectPath, FRAME_PIPELINES_DIR, 'artifacts', ctx.stage.id);
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  try {
    // Build environment with pipeline context
    const env: Record<string, string | undefined> = {
      ...process.env,
      PIPELINE_RUN_ID: ctx.run.id,
      PIPELINE_STAGE_ID: ctx.stage.id,
      PIPELINE_ARTIFACTS_DIR: artifactsDir,
      PIPELINE_PROJECT_PATH: ctx.projectPath,
      PIPELINE_BASE_SHA: ctx.baseSha,
      PIPELINE_HEAD_SHA: ctx.headSha,
      ...(step.env || {}),
    };

    const { stdout, stderr } = await execAsyncWithEnv(command, { cwd, signal: ctx.abortSignal, env });
    const output = (stdout + '\n' + stderr).trim();

    ctx.emit('Custom stage completed');
    logs.push('Completed successfully');

    // Collect artifacts from the output directory
    if (fs.existsSync(artifactsDir)) {
      const files = fs.readdirSync(artifactsDir);
      for (const file of files) {
        const filePath = path.join(artifactsDir, file);
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          artifacts.push({
            id: uid(),
            type: 'content',
            stageId: ctx.stage.id,
            title: file,
            body: content,
            createdAt: now(),
          });
        } catch {
          // Skip unreadable files
        }
      }
    }

    if (output) {
      artifacts.push({
        id: uid(),
        type: 'content',
        stageId: ctx.stage.id,
        title: 'Command Output',
        body: output,
        createdAt: now(),
      });
    }

    return { status: 'completed', artifacts, logs };
  } catch (err) {
    const e = err as Error & { stdout?: string; stderr?: string };
    const output = ((e.stdout || '') + '\n' + (e.stderr || '')).trim();
    ctx.emit(`Custom stage failed: ${e.message}`);
    logs.push(`Failed: ${e.message}`);

    if (output) {
      artifacts.push({
        id: uid(),
        type: 'content',
        stageId: ctx.stage.id,
        title: 'Command Error Output',
        body: output,
        createdAt: now(),
      });
    }

    return { status: 'failed', artifacts, logs };
  }
}

/**
 * Resolve a stage type string to its handler function.
 */
export function getStageHandler(stageType: string): StageHandler | null {
  switch (stageType) {
    case 'lint': return runLintStage;
    case 'test': return runTestStage;
    case 'describe': return runDescribeStage;
    case 'critique': return runCritiqueStage;
    case 'freeze': return runFreezeStage;
    case 'push': return runPushStage;
    case 'create-pr': return runCreatePrStage;
    default: return null;
  }
}
