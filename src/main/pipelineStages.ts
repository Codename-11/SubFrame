/**
 * Pipeline Stage Handlers
 * Built-in stage implementations for the pipeline system.
 */

import { exec, spawn } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { FRAME_PIPELINES_DIR } from '../shared/frameConstants';
import * as activityManager from './activityManager';
import type {
  PipelineArtifact,
  PipelineRun,
  PipelineStage,
  ContentArtifact,
  CommentArtifact,
  ArtifactSeverity,
  StageFailureReason,
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
  /** Per-step config from workflow `with:` — scope, mode, focus, prompt, etc. */
  stepConfig: Record<string, string>;
  /** Activity stream ID for centralized output routing (optional, from pipelineManager) */
  streamId?: string;
}

export interface StageResult {
  status: 'completed' | 'failed' | 'skipped';
  artifacts: PipelineArtifact[];
  logs: string[];
  failureReason?: StageFailureReason;
}

export type StageHandler = (ctx: StageContext) => Promise<StageResult>;

// ─── Utilities ───────────────────────────────────────────────────────────────

function uid(): string {
  return crypto.randomUUID();
}

/** Default max turns for agent-mode AI stages (0 = unlimited) */
const DEFAULT_AGENT_MAX_TURNS = 25;

/**
 * Kill a child process tree. On Windows, `child.kill()` only kills the shell
 * when spawned with `shell: true`, leaving the actual process running.
 * This uses `taskkill /F /T` on Windows to kill the entire tree.
 */
function killProcessTree(child: ReturnType<typeof spawn>): void {
  if (!child.pid) return;
  if (process.platform === 'win32') {
    // exec() is async — errors go to callback, not thrown synchronously
    exec(`taskkill /F /T /PID ${child.pid}`, { timeout: 5000 }, (err) => {
      if (err) child.kill('SIGTERM'); // Fallback if taskkill fails (PID gone, access denied)
    });
  } else {
    child.kill('SIGTERM');
  }
}

/** Format elapsed milliseconds to human-readable string */
function formatElapsed(ms: number): string {
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return rem > 0 ? `${min}m ${rem}s` : `${min}m`;
}

/** Check if an error message indicates max-turns exhaustion */
function isMaxTurnsError(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes('max_turns') ||
    lower.includes('max turns') ||
    lower.includes('turn limit') ||
    lower.includes('maximum number of turns');
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
        killProcessTree(child);
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
    // If the signal fires after exec started, kill the process tree
    if (opts.signal) {
      opts.signal.addEventListener('abort', () => {
        killProcessTree(child);
      }, { once: true });
    }
  });
}

/**
 * Get the diff between baseSha and headSha.
 * Returns empty string if no diff available (callers should handle this).
 */
async function getDiff(ctx: StageContext): Promise<string> {
  const cwd = ctx.worktreePath || ctx.projectPath;

  // Try the explicit base...head range (only if they differ)
  if (ctx.baseSha && ctx.headSha && ctx.baseSha !== ctx.headSha) {
    try {
      const { stdout } = await execAsync(
        `git diff ${ctx.baseSha}...${ctx.headSha}`,
        { cwd, signal: ctx.abortSignal }
      );
      if (stdout.trim()) return stdout;
    } catch {
      ctx.emit('Warning: git diff base...head failed');
    }
  }

  // Fallback: last commit
  try {
    const { stdout } = await execAsync('git diff HEAD~1', { cwd, signal: ctx.abortSignal });
    if (stdout.trim()) return stdout;
  } catch {
    // noop
  }

  return '';
}

/**
 * Assemble project-level context for scope: project stages.
 * Returns a structured markdown string with file tree, structure, package info, etc.
 */
async function getProjectContext(ctx: StageContext): Promise<string> {
  const cwd = ctx.worktreePath || ctx.projectPath;
  const parts: string[] = [];

  // 1. File tree (git-tracked files)
  try {
    const { stdout } = await execAsync('git ls-files', { cwd, signal: ctx.abortSignal });
    const files = stdout.trim();
    // Truncate very large file trees
    parts.push(`## File Tree\n\`\`\`\n${files.slice(0, 5000)}\n\`\`\``);
    ctx.emit(`Project context: ${files.split('\n').length} tracked files`);
  } catch {
    ctx.emit('Warning: could not read file tree');
  }

  // 2. STRUCTURE.json (compact module/IPC map)
  const structurePath = path.join(ctx.projectPath, '.subframe', 'STRUCTURE.json');
  if (fs.existsSync(structurePath)) {
    try {
      const structure = fs.readFileSync(structurePath, 'utf8');
      parts.push(`## Project Structure (STRUCTURE.json)\n\`\`\`json\n${structure.slice(0, 8000)}\n\`\`\``);
    } catch { /* skip */ }
  }

  // 3. package.json summary
  const pkgPath = path.join(ctx.projectPath, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const summary = {
        name: pkg.name,
        version: pkg.version,
        scripts: pkg.scripts,
        dependencies: Object.keys(pkg.dependencies || {}),
        devDependencies: Object.keys(pkg.devDependencies || {}),
      };
      parts.push(`## Package Info\n\`\`\`json\n${JSON.stringify(summary, null, 2)}\n\`\`\``);
    } catch { /* skip */ }
  }

  // 4. Recent git log
  try {
    const { stdout } = await execAsync('git log --oneline -20', { cwd, signal: ctx.abortSignal });
    if (stdout.trim()) {
      parts.push(`## Recent Commits (last 20)\n\`\`\`\n${stdout.trim()}\n\`\`\``);
    }
  } catch { /* skip */ }

  // 5. Key config files (truncated)
  const keyFiles = ['CLAUDE.md', 'tsconfig.json', 'eslint.config.mjs', '.eslintrc.js', 'CHANGELOG.md'];
  for (const file of keyFiles) {
    const filePath = path.join(ctx.projectPath, file);
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        parts.push(`## ${file}\n\`\`\`\n${content.slice(0, 3000)}\n\`\`\``);
      } catch { /* skip */ }
    }
  }

  return parts.join('\n\n');
}

/**
 * Spawn the AI tool CLI with a prompt and parse JSON from stdout.
 * Unwraps the Claude CLI JSON envelope ({"type":"result","result":"..."})
 * so callers receive the actual AI response text.
 */
async function spawnAITool(
  ctx: StageContext,
  prompt: string,
  streamId?: string
): Promise<string> {
  const raw = await spawnAIToolRaw(ctx, prompt, streamId);

  // Claude CLI with --output-format json wraps the response in an envelope:
  // {"type":"result","subtype":"success","result":"<actual content>", ...}
  // Unwrap the envelope so downstream parsers see the real content.
  try {
    const envelope = JSON.parse(raw);
    if (envelope && typeof envelope === 'object' && 'result' in envelope && typeof envelope.result === 'string') {
      return envelope.result;
    }
  } catch {
    // Not valid JSON envelope — return raw output as-is
  }

  return raw;
}

/**
 * Raw AI tool spawner — returns stdout verbatim.
 * Pipes the prompt via stdin to avoid shell escaping issues with
 * backticks, quotes, and other special characters in prompts.
 *
 * When streamId is provided, output is also routed through activityManager
 * in addition to ctx.emit (pipeline log view still uses ctx.emit).
 * The local heartbeat timer is removed when streamId is provided since
 * activityManager handles heartbeat.
 */
function spawnAIToolRaw(
  ctx: StageContext,
  prompt: string,
  streamId?: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const cwd = ctx.worktreePath || ctx.projectPath;
    // Deliver prompt via stdin (no positional arg) to avoid shell mangling
    // of backticks, quotes, and special characters in the prompt text.
    // Split command string to handle custom flags (e.g. "claude --dangerously-skip-permissions")
    const [aiExe, ...aiBaseFlags] = ctx.aiTool.split(/\s+/);
    const child = spawn(aiExe, [...aiBaseFlags, '--print', '--output-format', 'json'], {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
    });

    // Write prompt to stdin and close — CLI reads from stdin when no positional prompt given
    child.stdin.write(prompt);
    child.stdin.end();

    let stdout = '';
    let stderr = '';
    const startTime = Date.now();
    let stdoutChunks = 0;

    // Heartbeat timer — only used when no streamId (activityManager handles heartbeat otherwise)
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    if (!streamId) {
      heartbeatTimer = setInterval(() => {
        if (ctx.abortSignal.aborted) return;
        const elapsed = Date.now() - startTime;
        const parts = [`Waiting for AI response... ${formatElapsed(elapsed)}`];
        if (stdoutChunks > 0) parts.push(`${stdoutChunks} chunks received`);
        ctx.emit(parts.join(' | '));
      }, 10_000);
    }

    child.stdout.on('data', (data: Buffer) => {
      const chunk = data.toString();
      stdout += chunk;
      stdoutChunks++;
    });

    child.stderr.on('data', (data: Buffer) => {
      const chunk = data.toString();
      stderr += chunk;
      // Stream stderr lines as logs
      for (const line of chunk.split('\n').filter(Boolean)) {
        ctx.emit(line);
        if (streamId) {
          activityManager.emit(streamId, line);
        }
      }
    });

    child.on('close', (code) => {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (ctx.abortSignal.aborted) {
        reject(new Error('Aborted'));
      } else if (code !== 0) {
        reject(new Error(`AI tool exited with code ${code}: ${stderr}`));
      } else {
        resolve(stdout);
      }
    });

    child.on('error', (err) => {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      reject(err);
    });

    ctx.abortSignal.addEventListener('abort', () => {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      killProcessTree(child);
    }, { once: true });
  });
}

/**
 * Spawn the AI tool in agent mode (no --print) — allows the AI to use tools,
 * read files, and explore the codebase autonomously. Slower and more expensive
 * but dramatically better for deep audits. Returns the final output text.
 *
 * Supports --max-turns via stepConfig['max-turns'] (0 or '' = unlimited).
 * Emits periodic heartbeat logs with elapsed time and detected turn count.
 *
 * When streamId is provided, output is also routed through activityManager
 * in addition to ctx.emit (pipeline log view still uses ctx.emit).
 * The local heartbeat timer is removed when streamId is provided since
 * activityManager handles heartbeat.
 */
async function spawnAIToolAgent(
  ctx: StageContext,
  prompt: string,
  streamId?: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const cwd = ctx.worktreePath || ctx.projectPath;

    // Resolve max-turns: stepConfig value > default (25). '0' or '' = unlimited.
    const configMaxTurns = ctx.stepConfig['max-turns'];
    const maxTurns = configMaxTurns === '0' || configMaxTurns === 'unlimited'
      ? 0
      : configMaxTurns
        ? parseInt(configMaxTurns, 10) || DEFAULT_AGENT_MAX_TURNS
        : DEFAULT_AGENT_MAX_TURNS;

    const turnsLabel = maxTurns > 0 ? `max ${maxTurns} turns` : 'unlimited turns';
    ctx.emit(`Spawning AI agent (autonomous mode, ${turnsLabel})...`);
    if (streamId) {
      activityManager.emit(streamId, `Spawning AI agent (autonomous mode, ${turnsLabel})...`);
    }

    // Agent mode: no --print, uses --output-format json for structured output.
    // The AI can use all its built-in tools (Read, Grep, Glob, Bash, etc.)
    // Split command string to handle custom flags (e.g. "claude --dangerously-skip-permissions")
    const [aiExe, ...aiBaseFlags] = ctx.aiTool.split(/\s+/);
    const args = [...aiBaseFlags, '--output-format', 'json', '--verbose'];
    if (maxTurns > 0) {
      args.push('--max-turns', String(maxTurns));
    }
    const child = spawn(aiExe, args, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
    });

    // Deliver prompt via stdin
    child.stdin.write(prompt);
    child.stdin.end();

    let stdout = '';
    let stderr = '';
    const startTime = Date.now();
    let turnCount = 0;
    let lastActivityTime = Date.now();

    // Heartbeat timer — only used when no streamId (activityManager handles heartbeat otherwise)
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    if (!streamId) {
      heartbeatTimer = setInterval(() => {
        if (ctx.abortSignal.aborted) return;
        const elapsed = Date.now() - startTime;
        const idle = Date.now() - lastActivityTime;
        const parts = [`[Agent] ${formatElapsed(elapsed)} elapsed`];
        if (turnCount > 0) parts.push(`~${turnCount} turns`);
        if (idle > 30_000) parts.push('waiting...');
        ctx.emit(parts.join(' | '));
      }, 15_000);
    }

    // Guard: if signal was already aborted before we got here, clean up immediately
    if (ctx.abortSignal.aborted) {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      killProcessTree(child);
      reject(new Error('Aborted'));
      return;
    }

    child.stdout.on('data', (data: Buffer) => {
      const chunk = data.toString();
      stdout += chunk;
      lastActivityTime = Date.now();
    });

    child.stderr.on('data', (data: Buffer) => {
      const chunk = data.toString();
      stderr += chunk;
      lastActivityTime = Date.now();
      for (const line of chunk.split('\n').filter(Boolean)) {
        // Detect turn boundaries from verbose output
        if (line.includes('tool_use') || line.includes('Tool:') || /\bturn\b/i.test(line)) {
          turnCount++;
        }
        ctx.emit(line);
        if (streamId) {
          activityManager.emit(streamId, line);
        }
      }
    });

    child.on('close', (code) => {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      const elapsed = Date.now() - startTime;
      const finishMsg = `[Agent] Finished in ${formatElapsed(elapsed)} (~${turnCount} turns)`;
      ctx.emit(finishMsg);
      if (streamId) {
        activityManager.emit(streamId, finishMsg);
      }

      if (ctx.abortSignal.aborted) {
        reject(new Error('Aborted'));
      } else if (code !== 0) {
        const errMsg = `AI agent exited with code ${code}: ${stderr}`;
        // Check if this was a max-turns exhaustion
        if (isMaxTurnsError(stderr) || isMaxTurnsError(stdout)) {
          const err = new Error(errMsg);
          (err as Error & { failureReason: string }).failureReason = 'max-turns';
          reject(err);
        } else {
          reject(new Error(errMsg));
        }
      } else {
        // Unwrap envelope if present
        try {
          const envelope = JSON.parse(stdout);
          if (envelope && typeof envelope === 'object' && 'result' in envelope && typeof envelope.result === 'string') {
            // Check for max-turns in the envelope metadata
            if (envelope.subtype === 'max_turns_reached' || isMaxTurnsError(JSON.stringify(envelope))) {
              const err = new Error('AI agent reached max turns limit');
              (err as Error & { failureReason: string }).failureReason = 'max-turns';
              reject(err);
              return;
            }
            resolve(envelope.result);
            return;
          }
        } catch {
          // Not JSON envelope
        }
        resolve(stdout);
      }
    });

    child.on('error', (err) => {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      reject(err);
    });

    ctx.abortSignal.addEventListener('abort', () => {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      killProcessTree(child);
    }, { once: true });
  });
}

/**
 * Dispatch to the appropriate AI tool mode based on stepConfig.mode.
 * - mode: 'agent' → spawnAIToolAgent (autonomous, multi-turn, uses tools)
 * - mode: 'print' (default) → spawnAITool (single-turn, fast, cheap)
 *
 * Errors from agent mode may carry a `.failureReason` property (e.g. 'max-turns').
 * When streamId is provided, output is also routed through activityManager.
 */
async function dispatchAITool(ctx: StageContext, prompt: string, streamId?: string): Promise<string> {
  const mode = ctx.stepConfig.mode || 'print';
  if (mode === 'agent') {
    return spawnAIToolAgent(ctx, prompt, streamId);
  }
  return spawnAITool(ctx, prompt, streamId);
}

/**
 * Get the appropriate context string based on stepConfig.scope.
 * - scope: 'project' → full project context
 * - scope: 'changes' (default) → git diff
 * Returns empty string if no context available.
 */
async function getContextForScope(ctx: StageContext): Promise<{ context: string; label: string }> {
  const scope = ctx.stepConfig.scope || 'changes';
  if (scope === 'project') {
    const context = await getProjectContext(ctx);
    return { context, label: 'project' };
  }
  const diff = await getDiff(ctx);
  return { context: diff, label: 'changes' };
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
    } catch {
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
 * Build a focus instruction from stepConfig.focus if present.
 * Supported values: security, documentation, architecture, performance, testing, or custom text.
 */
function buildFocusInstruction(ctx: StageContext): string {
  const focus = ctx.stepConfig.focus;
  if (!focus) return '';

  const focusMap: Record<string, string> = {
    security: 'Focus primarily on security concerns: injection vulnerabilities, auth issues, data exposure, unsafe operations, dependency risks.',
    documentation: 'Focus primarily on documentation quality: missing/outdated docs, unclear comments, API documentation gaps, README accuracy.',
    architecture: 'Focus primarily on architecture: design patterns, separation of concerns, module coupling, scalability, maintainability.',
    performance: 'Focus primarily on performance: bottlenecks, unnecessary allocations, N+1 queries, caching opportunities, algorithm efficiency.',
    testing: 'Focus primarily on testing: missing test coverage, edge cases, test quality, flaky test patterns, assertion completeness.',
  };

  return focusMap[focus] || `Focus primarily on: ${focus}`;
}

/**
 * Test Stage
 * Spawns AI tool with context to run/evaluate tests.
 * Respects stepConfig: scope, mode, focus, prompt.
 */
export async function runTestStage(ctx: StageContext): Promise<StageResult> {
  const logs: string[] = [];
  const artifacts: PipelineArtifact[] = [];

  ctx.emit('Starting test stage...');
  logs.push('Starting test stage');

  const { context, label } = await getContextForScope(ctx);

  if (!context.trim()) {
    ctx.emit(`No ${label} context available — skipping test stage`);
    logs.push(`Skipped: no ${label} context`);
    return { status: 'skipped', artifacts, logs };
  }

  ctx.emit(`Test stage using ${label} context (${Math.round(context.length / 1024)}KB)`);
  logs.push(`Context scope: ${label}`);

  const focusInstruction = buildFocusInstruction(ctx);
  const customPrompt = ctx.stepConfig.prompt;

  const prompt = customPrompt || `You are reviewing a ${label === 'project' ? 'project codebase' : 'set of code changes'}. Here is the context:

${label === 'changes' ? `\`\`\`diff\n${context.slice(0, 8000)}\n\`\`\`` : context.slice(0, 12000)}

${focusInstruction}

Run the project's test suite and evaluate the results. Respond with ONLY a JSON object:
{
  "verdict": "pass" | "fail" | "skip",
  "summary": "Brief summary of test results",
  "details": "Detailed test output or analysis"
}`;

  try {
    const output = await dispatchAITool(ctx, prompt, ctx.streamId);
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
    const e = err as Error & { failureReason?: string };
    ctx.emit(`Test stage error: ${e.message}`);
    logs.push(`Error: ${e.message}`);
    const failureReason = e.failureReason === 'max-turns' ? 'max-turns' as const
      : isMaxTurnsError(e.message) ? 'max-turns' as const : 'error' as const;
    return { status: 'failed', artifacts, logs, failureReason };
  }
}

/**
 * Describe Stage
 * Spawns AI tool for PR description or project overview.
 * Respects stepConfig: scope, mode, focus, prompt.
 */
export async function runDescribeStage(ctx: StageContext): Promise<StageResult> {
  const logs: string[] = [];
  const artifacts: PipelineArtifact[] = [];

  ctx.emit('Starting describe stage...');
  logs.push('Starting describe stage');

  const { context, label } = await getContextForScope(ctx);

  if (!context.trim()) {
    ctx.emit(`No ${label} context available — skipping describe stage`);
    logs.push(`Skipped: no ${label} context`);
    return { status: 'skipped', artifacts, logs };
  }

  ctx.emit(`Describe stage using ${label} context (${Math.round(context.length / 1024)}KB)`);
  logs.push(`Context scope: ${label}`);

  const focusInstruction = buildFocusInstruction(ctx);
  const customPrompt = ctx.stepConfig.prompt;

  const isProject = label === 'project';

  const prompt = customPrompt || (isProject
    ? `You are generating a project overview/health description. Analyze the project context and write a clear summary.

${context.slice(0, 15000)}

${focusInstruction}

Write a project description with:
- Project purpose and architecture summary
- Key technologies and patterns used
- Current state assessment (health, tech debt, test coverage)
- Notable strengths and areas for improvement

Respond with ONLY a JSON object:
{
  "title": "Project overview title (max 70 chars)",
  "body": "Full markdown project description"
}`
    : `You are generating a pull request description for the following changes. Analyze the diff and write a clear, concise PR description in markdown format.

\`\`\`diff
${context.slice(0, 12000)}
\`\`\`

${focusInstruction}

Write a PR description with:
- A brief summary (1-2 sentences)
- What changed (bullet points)
- Why it changed
- Any breaking changes or migration notes

Respond with ONLY a JSON object:
{
  "title": "PR title (max 70 chars)",
  "body": "Full markdown PR description"
}`);

  try {
    const output = await dispatchAITool(ctx, prompt, ctx.streamId);
    const parsed = parseJSONFromOutput(output) as {
      title?: string;
      body?: string;
    } | null;

    const title = parsed?.title || (isProject ? 'Project Overview' : 'Changes');
    const body = parsed?.body || output;

    ctx.emit(`Generated description: ${title}`);
    logs.push(`Generated description: ${title}`);

    artifacts.push({
      id: uid(),
      type: 'content',
      stageId: ctx.stage.id,
      title: isProject ? title : `PR: ${title}`,
      body,
      createdAt: now(),
    });

    return { status: 'completed', artifacts, logs };
  } catch (err) {
    const e = err as Error & { failureReason?: string };
    ctx.emit(`Describe stage error: ${e.message}`);
    logs.push(`Error: ${e.message}`);
    const failureReason = e.failureReason === 'max-turns' ? 'max-turns' as const
      : isMaxTurnsError(e.message) ? 'max-turns' as const : 'error' as const;
    return { status: 'failed', artifacts, logs, failureReason };
  }
}

/**
 * Critique Stage
 * Spawns AI tool for code review (diff or project-level).
 * Produces CommentArtifact[] for inline comments and ContentArtifact for summary.
 * Respects stepConfig: scope, mode, focus, prompt.
 */
export async function runCritiqueStage(ctx: StageContext): Promise<StageResult> {
  const logs: string[] = [];
  const artifacts: PipelineArtifact[] = [];

  ctx.emit('Starting critique stage...');
  logs.push('Starting critique stage');

  const { context, label } = await getContextForScope(ctx);

  if (!context.trim()) {
    ctx.emit(`No ${label} context available — skipping critique stage`);
    logs.push(`Skipped: no ${label} context`);
    return { status: 'skipped', artifacts, logs };
  }

  ctx.emit(`Critique stage using ${label} context (${Math.round(context.length / 1024)}KB)`);
  logs.push(`Context scope: ${label}`);

  const focusInstruction = buildFocusInstruction(ctx);
  const customPrompt = ctx.stepConfig.prompt;
  const isProject = label === 'project';

  const prompt = customPrompt || (isProject
    ? `You are performing a thorough audit of this project. Review the project context below and identify issues, risks, and improvements.

${context.slice(0, 15000)}

${focusInstruction || 'Identify bugs, security issues, architectural problems, missing documentation, and suggest improvements.'}

Respond with ONLY a JSON object:
{
  "summary": "Overall audit summary with key findings",
  "comments": [
    {
      "file": "path/to/file.ts",
      "line": 1,
      "message": "Description of issue or suggestion",
      "severity": "error" | "warning" | "info" | "suggestion",
      "category": "bug" | "security" | "style" | "performance" | "documentation" | "architecture" | "suggestion"
    }
  ],
  "patches": [
    {
      "title": "Fix description",
      "explanation": "Why this fix is needed",
      "diff": "unified diff content or suggested code",
      "files": ["path/to/file.ts"]
    }
  ]
}`
    : `You are performing a thorough code review on the following diff. Identify bugs, security issues, style problems, and suggest improvements.

\`\`\`diff
${context.slice(0, 12000)}
\`\`\`

${focusInstruction}

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
}`);

  try {
    const output = await dispatchAITool(ctx, prompt, ctx.streamId);
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
      title: isProject ? 'Project Audit Summary' : 'Code Review Summary',
      body: summary,
      createdAt: now(),
    });

    return { status: 'completed', artifacts, logs };
  } catch (err) {
    const e = err as Error & { failureReason?: string };
    ctx.emit(`Critique stage error: ${e.message}`);
    logs.push(`Error: ${e.message}`);
    const failureReason = e.failureReason === 'max-turns' ? 'max-turns' as const
      : isMaxTurnsError(e.message) ? 'max-turns' as const : 'error' as const;
    return { status: 'failed', artifacts, logs, failureReason };
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

    // Validate branch name to prevent shell injection
    if (!/^[a-zA-Z0-9._/-]+$/.test(branch)) {
      ctx.emit(`Push aborted: invalid branch name "${branch}"`);
      logs.push(`Aborted: invalid branch name`);
      return { status: 'failed', artifacts, logs };
    }

    const { stdout, stderr } = await execAsync(
      `git push -u origin -- ${branch}`,
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

    // Write PR body to temp file to avoid shell injection via body content
    const tmpBodyFile = path.join(cwd, '.subframe-pr-body.tmp');
    try {
      fs.writeFileSync(tmpBodyFile, prBody, 'utf8');
    } catch {
      ctx.emit('Failed to write temp PR body file');
      logs.push('Failed to write temp PR body file');
      return { status: 'failed', artifacts, logs };
    }

    // Validate title (no shell metacharacters)
    const safeTitle = prTitle.replace(/[`$"\\]/g, '');

    let prUrl: string;
    try {
      const { stdout } = await execAsync(
        `gh pr create --title "${safeTitle}" --body-file "${tmpBodyFile}"`,
        { cwd, signal: ctx.abortSignal }
      );
      prUrl = stdout;
    } finally {
      // Clean up temp file
      try { fs.unlinkSync(tmpBodyFile); } catch { /* ignore */ }
    }

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
