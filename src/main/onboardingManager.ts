/**
 * Onboarding Manager
 * Detects existing project intelligence files, runs AI analysis through a terminal tab,
 * parses the JSON response, and imports results into SubFrame's spec files.
 *
 * The `runAnalysisInTerminal` function is exported as a reusable pipeline core
 * for any feature that needs to run an AI tool and capture its output.
 */

import type { BrowserWindow, IpcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { IPC } from '../shared/ipcChannels';
import type {
  OnboardingDetectionResult,
  DetectedIntelligence,
  OnboardingAnalysisResult,
  OnboardingProgressEvent,
  OnboardingImportResult,
  OnboardingImportSelections,
  OnboardingAnalysisOptions,
  OnboardingSessionState,
} from '../shared/ipcChannels';
import { INTELLIGENCE_FILES, FRAME_FILES, FRAME_TASKS_DIR, IS_DEV_MODE } from '../shared/frameConstants';
import * as ptyManager from './ptyManager';
import * as aiSessionManager from './aiSessionManager';
import * as aiToolManager from './aiToolManager';
import * as activityManager from './activityManager';
import { getInteractiveToolConfig } from './aiExecutionManager';
import { renderTerminalTranscript } from '../shared/terminalTranscript';
import { broadcast } from './eventBridge';

// ─── Module State ────────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null;

/** Active analysis runs keyed by projectPath */
const activeAnalyses = new Map<string, { terminalId: string; sessionId: string; cleanup: () => void; cancel?: () => void; streamId?: string }>();

/** Parsed results cache keyed by projectPath (for IMPORT to consume after RUN completes) */
const analysisResultsCache = new Map<string, OnboardingAnalysisResult>();
const onboardingSessions = new Map<string, OnboardingSessionState>();

function nowIso(): string {
  return new Date().toISOString();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createEmptySession(projectPath: string): OnboardingSessionState {
  return {
    projectPath,
    detection: null,
    analysisResult: null,
    progress: null,
    terminalId: null,
    activityStreamId: null,
    error: null,
    cancelled: null,
    importResult: null,
    status: 'idle',
    updatedAt: nowIso(),
  };
}

function getOrCreateSession(projectPath: string): OnboardingSessionState {
  const existing = onboardingSessions.get(projectPath);
  if (existing) return existing;
  const created = createEmptySession(projectPath);
  onboardingSessions.set(projectPath, created);
  return created;
}

function patchSession(projectPath: string, patch: Partial<OnboardingSessionState>): OnboardingSessionState {
  const current = getOrCreateSession(projectPath);
  const next: OnboardingSessionState = {
    ...current,
    ...patch,
    updatedAt: nowIso(),
  };
  onboardingSessions.set(projectPath, next);
  return next;
}

// ─── Source File Counting ────────────────────────────────────────────────────

/** Extensions considered "source code" for project size estimation */
const SOURCE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.py', '.rs', '.go', '.java', '.rb',
]);

/** Directories to skip during recursive file walk */
const SKIP_DIRS = new Set(['node_modules', '.git', '.subframe', 'dist', 'build', '__pycache__']);

/**
 * Count source files with a simple recursive walk, limited to `maxDepth` levels.
 * Returns { count, extensionCounts } for primary language detection.
 */
function countSourceFiles(
  dir: string,
  maxDepth: number = 3,
  currentDepth: number = 0,
): { count: number; extensionCounts: Record<string, number> } {
  const result = { count: 0, extensionCounts: {} as Record<string, number> };

  if (currentDepth >= maxDepth) return result;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return result;
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const sub = countSourceFiles(path.join(dir, entry.name), maxDepth, currentDepth + 1);
      result.count += sub.count;
      for (const [ext, count] of Object.entries(sub.extensionCounts)) {
        result.extensionCounts[ext] = (result.extensionCounts[ext] || 0) + count;
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (SOURCE_EXTENSIONS.has(ext)) {
        result.count++;
        result.extensionCounts[ext] = (result.extensionCounts[ext] || 0) + 1;
      }
    }
  }

  return result;
}

/**
 * Map file extension to a human-readable language name.
 */
function extensionToLanguage(ext: string): string {
  const map: Record<string, string> = {
    '.ts': 'TypeScript',
    '.tsx': 'TypeScript',
    '.js': 'JavaScript',
    '.jsx': 'JavaScript',
    '.py': 'Python',
    '.rs': 'Rust',
    '.go': 'Go',
    '.java': 'Java',
    '.rb': 'Ruby',
  };
  return map[ext] || ext;
}

// ─── Progress Events ─────────────────────────────────────────────────────────

/**
 * Send a progress event to the renderer.
 */
function sendProgress(
  projectPath: string,
  phase: OnboardingProgressEvent['phase'],
  message: string,
  progress: number,
  extra?: {
    terminalId?: string;
    activityStreamId?: string;
    timeoutMs?: number;
    elapsedMs?: number;
    stalled?: boolean;
    stallDurationMs?: number;
  },
): void {
  const progressEvent = {
    projectPath,
    phase,
    message,
    progress,
    ...extra,
  } satisfies OnboardingProgressEvent;

  const current = getOrCreateSession(projectPath);
  patchSession(projectPath, {
    progress: progressEvent,
    status: phase,
    terminalId: extra?.terminalId ?? current.terminalId,
    activityStreamId: extra?.activityStreamId ?? current.activityStreamId,
    error: phase === 'error' ? message : (phase === 'cancelled' ? null : current.error),
    cancelled: phase === 'cancelled' ? message : (phase === 'error' ? null : current.cancelled),
  });

  if (mainWindow && !mainWindow.isDestroyed()) {
    broadcast(IPC.ONBOARDING_PROGRESS, progressEvent);
  }
}

// ─── Detection ───────────────────────────────────────────────────────────────

/**
 * Scan the project for known intelligence files and count source files.
 */
function detectProjectIntelligence(projectPath: string): OnboardingDetectionResult {
  const projectName = path.basename(projectPath);
  const detected: DetectedIntelligence[] = [];

  // Check each intelligence file definition
  for (const entry of Object.values(INTELLIGENCE_FILES)) {
    for (const relPath of entry.paths) {
      const fullPath = path.join(projectPath, relPath);
      try {
        const stat = fs.statSync(fullPath);
        // For .git, it is a directory
        const isDir = stat.isDirectory();
        detected.push({
          category: entry.category,
          path: relPath,
          label: entry.label,
          hasContent: isDir ? true : stat.size > 0,
          size: isDir ? 0 : stat.size,
        });
        // Only record the first found path per entry
        break;
      } catch {
        // File not found — try next path
      }
    }
  }

  // Count source files & detect primary language
  const { count: sourceFileCount, extensionCounts } = countSourceFiles(projectPath);
  let primaryLanguage = 'Unknown';
  if (Object.keys(extensionCounts).length > 0) {
    const topExt = Object.entries(extensionCounts).sort((a, b) => b[1] - a[1])[0][0];
    primaryLanguage = extensionToLanguage(topExt);
  }

  // Check for git
  const hasGit = detected.some((d) => d.label === 'Git repository');

  // Worth analyzing: at least 2 detected files and at least 1 from ai-config or documentation
  const hasIntelligent = detected.some(
    (d) => d.category === 'ai-config' || d.category === 'documentation',
  );
  const worthAnalyzing = detected.length >= 2 && hasIntelligent;

  return {
    projectPath,
    projectName,
    detected,
    hasGit,
    sourceFileCount,
    primaryLanguage,
    worthAnalyzing,
  };
}

// ─── Context Gathering ───────────────────────────────────────────────────────

/** Maximum total context size in characters */
const CONTEXT_BUDGET = 50_000;
/** Maximum individual file size in characters */
const MAX_FILE_SIZE = 10_000;

/**
 * Read detected files into a concatenated context string, respecting budgets.
 */
function gatherContext(projectPath: string, detected: DetectedIntelligence[], extraFiles?: string[]): string {
  const parts: string[] = [];
  let totalSize = 0;

  for (const item of detected) {
    if (totalSize >= CONTEXT_BUDGET) break;

    // Skip directories (.git) and empty files
    if (!item.hasContent || item.size === 0) continue;

    const fullPath = path.join(projectPath, item.path);
    try {
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) continue;

      let content = fs.readFileSync(fullPath, 'utf8');
      if (content.length > MAX_FILE_SIZE) {
        content = content.substring(0, MAX_FILE_SIZE) + '\n... [truncated]';
      }

      const remaining = CONTEXT_BUDGET - totalSize;
      if (content.length > remaining) {
        content = content.substring(0, remaining) + '\n... [truncated to fit budget]';
      }

      parts.push(`--- FILE: ${item.path} (${item.size} chars) ---`);
      parts.push(content);
      parts.push('');

      totalSize += content.length;
    } catch {
      // Skip unreadable files
    }
  }

  // Include user-specified extra files (validated against project root)
  if (extraFiles && extraFiles.length > 0) {
    const resolvedRoot = path.resolve(projectPath);
    let skippedCount = 0;
    for (const filePath of extraFiles) {
      if (totalSize >= CONTEXT_BUDGET) {
        skippedCount++;
        continue;
      }
      // Security: ensure the path is within the project directory
      const resolved = path.resolve(filePath);
      if (!resolved.startsWith(resolvedRoot + path.sep) && resolved !== resolvedRoot) {
        console.warn(`[Onboarding] Skipping extra file outside project root: ${filePath}`);
        continue;
      }
      try {
        const stat = fs.statSync(resolved);
        if (stat.isDirectory()) {
          // For directories, list top-level contents
          const entries = fs.readdirSync(resolved).slice(0, 50);
          const listing = entries.join('\n');
          parts.push(`--- DIR: ${path.relative(projectPath, filePath) || filePath} ---`);
          parts.push(listing);
          parts.push('');
          totalSize += listing.length;
        } else if (stat.isFile()) {
          let content = fs.readFileSync(resolved, 'utf8');
          if (content.length > MAX_FILE_SIZE) {
            content = content.substring(0, MAX_FILE_SIZE) + '\n... [truncated]';
          }
          const remaining = CONTEXT_BUDGET - totalSize;
          if (content.length > remaining) {
            content = content.substring(0, remaining) + '\n... [truncated to fit budget]';
          }
          const relPath = path.relative(projectPath, filePath) || filePath;
          parts.push(`--- FILE: ${relPath} (${content.length} chars) [user-added] ---`);
          parts.push(content);
          parts.push('');
          totalSize += content.length;
        }
      } catch {
        // Skip unreadable extra files
      }
    }
    if (skippedCount > 0) {
      console.warn(`[Onboarding] ${skippedCount} extra file(s) skipped — context budget (${CONTEXT_BUDGET} chars) exhausted`);
    }
  }

  return parts.join('\n');
}

// ─── Prompt Building ─────────────────────────────────────────────────────────

/**
 * Build the analysis prompt that instructs the AI to output structured JSON.
 */
function buildAnalysisPrompt(context: string, projectName: string, customContext?: string): string {
  return `You are analyzing a software project called "${projectName}" for SubFrame, a terminal-centric IDE for AI coding tools.

Your job is to read the provided project files and produce a structured analysis that SubFrame will import into its project intelligence files.

## Project Files

${context}

## Output Format

Analyze the project and produce a single JSON object with these sections:

1. **structure** — Technical overview of the project
   - \`description\`: One-paragraph project description
   - \`architecture\`: Architecture style (e.g., "Monolith", "Microservices", "Monorepo", "Client-Server", "CLI tool")
   - \`conventions\`: Array of coding conventions observed (e.g., "TypeScript strict mode", "Conventional Commits", "ESLint + Prettier")
   - \`dataFlow\`: Brief description of how data flows through the system
   - \`modules\`: Map of module/file names to { purpose, exports[] } — include the most important 10-20 modules

2. **projectNotes** — High-level project understanding
   - \`vision\`: One sentence describing the project's purpose/goal
   - \`decisions\`: Array of { date, title, detail } for notable architectural decisions visible in the code
   - \`techStack\`: Array of key technologies/frameworks used

3. **suggestedTasks** — Actionable improvement tasks
   - Array of { title, description, priority ("high"|"medium"|"low"), category ("feature"|"fix"|"refactor"|"docs"|"test") }
   - Suggest 3-5 concrete, specific tasks based on what you see in the project
   - Focus on missing tests, documentation gaps, potential improvements, or cleanup opportunities

IMPORTANT: Do NOT create, modify, or delete any files. Do NOT run any commands. Your ONLY task is to analyze and output the JSON below.

Output ONLY a single JSON code block wrapped in \`\`\`json ... \`\`\` fences. No other text before or after the JSON block.

The JSON must contain exactly these top-level keys: "structure", "projectNotes", and "suggestedTasks".
Inside "structure", include "description", "architecture", "conventions", "dataFlow", and "modules".
Inside "projectNotes", include "vision", "decisions", and "techStack".
Each item in "suggestedTasks" must include "title", "description", "priority", and "category".${customContext ? `\n\n## Additional Instructions\n\n${customContext}` : ''}`;
}

// ─── AI Tool Pre-flight Check ────────────────────────────────────────────────

/**
 * Verify that the active AI tool command is available on the system.
 * Delegates to aiToolManager which caches install checks for 1 minute.
 */
async function checkAIToolAvailable(toolId?: string): Promise<{ available: boolean; command: string; error?: string }> {
  const tool = await aiToolManager.getActiveTool(toolId);
  const command = await aiToolManager.getStartCommand(toolId);
  const available = tool.installed ?? false;

  if (available) {
    return { available: true, command };
  }
  return {
    available: false,
    command,
    error: `"${tool.command}" not found on your system. Make sure it is installed and on your PATH.`,
  };
}

// ─── MCP Config Helpers ──────────────────────────────────────────────────────

/**
 * Resolve the absolute path to the SubFrame MCP analysis server.
 * In dev mode: relative to the project source tree.
 * In production: inside the packaged app's extraResources.
 */
function getMcpServerPath(): string {
  if (IS_DEV_MODE) {
    // Dev mode: resolve relative to the compiled main process output
    return path.join(__dirname, '..', '..', 'mcp', 'subframe-analysis-server.mjs');
  }
  // Production: extraResources are placed at process.resourcesPath
  return path.join(process.resourcesPath!, 'mcp', 'subframe-analysis-server.mjs');
}

/**
 * Write an MCP config JSON file for the analysis session.
 * Creates a temp JSON file that tells Claude how to connect to our MCP server.
 * Mirrors agent-forge's writeMcpConfig() pattern.
 */
function writeMcpConfig(options: {
  promptFile: string;
  resultFile: string;
  sessionId: string;
}): string {
  const mcpConfig = {
    mcpServers: {
      'subframe-analysis': {
        command: 'node',
        args: [getMcpServerPath()],
        env: {
          SUBFRAME_PROMPT_FILE: options.promptFile,
          SUBFRAME_RESULT_FILE: options.resultFile,
          SUBFRAME_SESSION_ID: options.sessionId,
        },
      },
    },
  };

  const configDir = path.join(os.tmpdir(), 'subframe-mcp');
  fs.mkdirSync(configDir, { recursive: true });
  const configPath = path.join(configDir, `analysis-${options.sessionId}-mcp.json`);
  fs.writeFileSync(configPath, JSON.stringify(mcpConfig, null, 2));
  console.log(`[Onboarding] MCP config written to ${configPath}`);
  return configPath;
}

/**
 * Build the correct CLI command for onboarding analysis per AI tool.
 * Each tool has different flags for permission bypass, MCP config, and verbosity.
 * Mirrors agent-forge's per-tool command construction.
 */
function buildOnboardingCommand(toolId: string, baseCommand: string, mcpConfigPath: string): string {
  // Normalize path for config args (forward slashes for cross-platform compatibility)
  const configPathNorm = mcpConfigPath.replace(/\\/g, '/');

  switch (toolId) {
    case 'claude': {
      const flags: string[] = [];
      if (!baseCommand.includes('--dangerously-skip-permissions')) flags.push('--dangerously-skip-permissions');
      if (!baseCommand.includes('--verbose')) flags.push('--verbose');
      flags.push('--mcp-config', `"${mcpConfigPath}"`);
      return `${baseCommand} ${flags.join(' ')}`;
    }
    case 'codex': {
      // Codex: --yolo for permissions, -c for MCP config (TOML-style overrides)
      // Uses single quotes inside TOML values to avoid cmd.exe double-quote conflicts
      const mcpServerPath = getMcpServerPath().replace(/\\/g, '/');
      const flags: string[] = [];
      if (!baseCommand.includes('--yolo')) flags.push('--yolo');
      // Codex MCP config uses -c flag with dotted key=value pairs
      flags.push(`-c "mcp_servers.subframe-analysis.command=node"`);
      flags.push(`-c "mcp_servers.subframe-analysis.args=['${mcpServerPath}']"`);
      // Read env vars from the MCP config we already wrote
      try {
        const mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf8'));
        const env = mcpConfig.mcpServers?.['subframe-analysis']?.env || {};
        for (const [key, value] of Object.entries(env)) {
          // Use forward slashes in paths for TOML compatibility
          const val = String(value).replace(/\\/g, '/');
          flags.push(`-c "mcp_servers.subframe-analysis.env.${key}=${val}"`);
        }
      } catch {
        console.warn('[Onboarding] Could not read MCP config for Codex env injection');
      }
      return `${baseCommand} ${flags.join(' ')}`;
    }
    case 'gemini': {
      // Gemini: --yolo for permissions, MCP via pre-command `gemini mcp add`
      // The MCP server must be registered before launching Gemini
      const mcpServerPath = getMcpServerPath().replace(/\\/g, '/');
      const flags: string[] = [];
      if (!baseCommand.includes('--yolo')) flags.push('--yolo');

      // Build the pre-command that registers the MCP server, then launch Gemini
      try {
        const mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf8'));
        const env = mcpConfig.mcpServers?.['subframe-analysis']?.env || {};
        const envFlags = Object.entries(env).map(([k, v]) => `-e ${k}="${v}"`).join(' ');
        const preCmd = `gemini mcp add --scope project subframe-analysis ${envFlags} -- node "${mcpServerPath}"`;
        return `${preCmd} && ${baseCommand} ${flags.join(' ')}`;
      } catch {
        // Fallback: just run Gemini without MCP
        return `${baseCommand} ${flags.join(' ')}`;
      }
    }
    default: {
      // Unknown tool: try Claude-style flags as best effort
      const flags: string[] = [];
      flags.push('--mcp-config', `"${mcpConfigPath}"`);
      return `${baseCommand} ${flags.join(' ')}`;
    }
  }
}

// ─── Terminal Analysis Pipeline ──────────────────────────────────────────────

/** Default analysis timeout in milliseconds (5 minutes) */
const DEFAULT_ANALYSIS_TIMEOUT_MS = 300_000;

/**
 * Get the configured analysis timeout, falling back to the default.
 */
function getAnalysisTimeout(): number {
  try {
    const settingsManager = require('./settingsManager');
    const custom = settingsManager.getSetting('onboarding.analysisTimeout');
    if (typeof custom === 'number' && custom > 0) {
      return custom;
    }
  } catch { /* settingsManager not available yet */ }
  return DEFAULT_ANALYSIS_TIMEOUT_MS;
}

/**
 * MCP instruction prompt — tells Claude to use the MCP tools for input/output.
 * Kept short so it doesn't need pasting — piped via echo.
 */
const MCP_INSTRUCTION = [
  'Call the get_analysis_prompt tool to receive the full analysis instructions and project context.',
  'Follow the instructions in the prompt exactly.',
  'When done, call the submit_analysis tool with the structured JSON result.',
  'Do NOT create, modify, or delete any files. Only analyze and report.',
].join(' ');

/**
 * Run an AI analysis in a terminal tab using MCP for structured I/O.
 *
 * Uses the proven interactive launch path (aiSessionManager) but with MCP:
 * instead of pasting the 50KB prompt into the TUI, Claude receives it via
 * the get_analysis_prompt MCP tool. Results come back via submit_analysis.
 *
 * Flow (agent-forge MCP pattern adapted for interactive mode):
 * 1. Write prompt to temp file + write MCP config
 * 2. Launch Claude interactively with --mcp-config (TUI visible in terminal)
 * 3. Wait for ready marker (trust prompt handling, etc.)
 * 4. Send SHORT instruction: "call get_analysis_prompt, analyze, call submit_analysis"
 * 5. Claude calls MCP tools for input/output — no 50KB paste needed
 * 6. Watch for MCP result file (primary) or terminal JSON (fallback)
 */
async function runAnalysisInTerminal(
  projectPath: string,
  prompt: string,
  opts?: { timeoutMs?: number; analysisStartMs?: number; streamId?: string; toolId?: string },
): Promise<{ raw: string; terminalId: string }> {
  const timestamp = Date.now();
  const promptFile = path.join(os.tmpdir(), `sf-onboard-prompt-${timestamp}.txt`);
  const resultFile = path.join(os.tmpdir(), `sf-onboard-result-${timestamp}.json`);
  fs.writeFileSync(promptFile, prompt, 'utf8');

  const tool = await aiToolManager.getActiveTool(opts?.toolId);
  const command = await aiToolManager.getStartCommand(opts?.toolId);

  // Write MCP config (agent-forge pattern)
  const mcpConfigPath = writeMcpConfig({
    promptFile,
    resultFile,
    sessionId: `analysis-${timestamp}`,
  });

  // Build tool-specific shell command with MCP config (matches agent-forge patterns)
  const interactiveConfig = getInteractiveToolConfig(tool.id);
  const shellCommand = buildOnboardingCommand(tool.id, command, mcpConfigPath);
  console.log(`[Onboarding] MCP interactive command: ${shellCommand}`);

  // Create AI session with interactive shell.
  // conptyInheritCursor: false — matches agent-forge's approach and prevents
  // ConPTY from deferring output until a renderer attaches.
  const aiSession = aiSessionManager.createSession({
    name: 'AI Analysis',
    toolId: tool.id,
    source: 'onboarding',
    projectPath,
    activityStreamId: opts?.streamId ?? null,
    workingDirectory: projectPath,
    conptyInheritCursor: false,
  });
  const { id: sessionId, terminalId } = aiSession;
  console.log(`[Onboarding] Created analysis terminal ${terminalId} for ${projectPath}`);

  if (opts?.streamId) {
    activityManager.attachTerminal(opts.streamId, terminalId);
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    broadcast(IPC.TERMINAL_CREATED, {
      terminalId, success: true, projectPath, name: 'AI Analysis', background: true,
    });
  }

  const analysisStartMs = opts?.analysisStartMs ?? Date.now();
  const effectiveTimeoutMs = opts?.timeoutMs ?? getAnalysisTimeout();
  const pushProgress = (
    message: string,
    progress: number,
    phase: OnboardingProgressEvent['phase'] = 'analyzing',
    extra?: { stalled?: boolean; stallDurationMs?: number },
  ) => {
    sendProgress(projectPath, phase, message, progress, {
      terminalId,
      activityStreamId: opts?.streamId,
      timeoutMs: effectiveTimeoutMs,
      elapsedMs: Date.now() - analysisStartMs,
      ...extra,
    });
  };
  pushProgress('AI analysis started (MCP mode)', 50);

  return new Promise<{ raw: string; terminalId: string }>((resolve, reject) => {
    let resolved = false;
    let claudeRetryTimer: ReturnType<typeof setInterval> | null = null;
    let stallCheckTimer: ReturnType<typeof setInterval> | null = null;
    let resultWatchTimer: ReturnType<typeof setInterval> | null = null;
    const trustHandlerId = 'onboarding-trust';
    const streamHandlerId = 'onboarding-stream';
    const activityAbortSignal = opts?.streamId ? activityManager.getAbortSignal(opts.streamId) : undefined;
    let abortListener: (() => void) | null = null;
    let emittedTranscriptLength = 0;
    let lastOutputTime = Date.now();
    const isClaudeTool = tool.id === 'claude';
    const STALL_WARN_THRESHOLD_MS = 30_000;
    const INACTIVITY_TIMEOUT_MS = Math.max(effectiveTimeoutMs, 3 * 60_000);
    const HARD_TIMEOUT_MS = Math.max(INACTIVITY_TIMEOUT_MS * 4, 10 * 60_000);

    const cleanupFiles = () => {
      for (const file of [promptFile, resultFile, mcpConfigPath]) {
        try { fs.unlinkSync(file); } catch { /* ignore */ }
      }
    };

    const cleanup = (destroyTerminal = false) => {
      if (streamFlushTimer) { clearTimeout(streamFlushTimer); streamFlushTimer = null; }
      if (claudeRetryTimer) { clearInterval(claudeRetryTimer); claudeRetryTimer = null; }
      if (stallCheckTimer) { clearInterval(stallCheckTimer); stallCheckTimer = null; }
      if (resultWatchTimer) { clearInterval(resultWatchTimer); resultWatchTimer = null; }
      activeAnalyses.delete(projectPath);
      ptyManager.removeOutputHandler(terminalId, trustHandlerId);
      ptyManager.removeOutputHandler(terminalId, mcpPermHandlerId);
      ptyManager.removeOutputHandler(terminalId, streamHandlerId);
      if (abortListener && activityAbortSignal) {
        activityAbortSignal.removeEventListener('abort', abortListener);
        abortListener = null;
      }
      aiSessionManager.destroySession(sessionId, { destroyTerminal });
      cleanupFiles();
    };

    const finish = (result: string) => {
      if (resolved) return;
      resolved = true;
      aiSessionManager.markSessionStatus(sessionId, 'completed');
      patchSession(projectPath, {
        terminalId: null,
        status: 'done',
      });
      cleanup(true);
      console.log(`[Onboarding] Analysis complete for ${projectPath} (${result.length} chars)`);
      resolve({ raw: result, terminalId: '' });
    };

    const fail = (err: Error, status: 'failed' | 'cancelled' = 'failed', destroyTerminal = false) => {
      if (resolved) return;
      resolved = true;
      aiSessionManager.markSessionStatus(sessionId, status, err.message);
      cleanup(destroyTerminal);
      (err as any).terminalId = terminalId;
      reject(err);
    };

    activeAnalyses.set(projectPath, {
      terminalId,
      sessionId,
      cleanup: () => cleanup(true),
      streamId: opts?.streamId,
      cancel: () => fail(new Error('Analysis cancelled by user.'), 'cancelled', true),
    });

    if (activityAbortSignal) {
      abortListener = () => {
        const reason = typeof activityAbortSignal.reason === 'string' ? activityAbortSignal.reason : '';
        const isCancelled = reason === 'Cancelled' || /cancelled/i.test(reason);
        fail(
          new Error(isCancelled ? 'Analysis cancelled by user.' : reason || 'Analysis aborted.'),
          isCancelled ? 'cancelled' : 'failed',
          true,
        );
      };
      activityAbortSignal.addEventListener('abort', abortListener, { once: true });
    }

    // Trust prompt handling for Claude (same as before)
    if (isClaudeTool) {
      let trustConfirmed = false;
      let menuReady = false;

      ptyManager.addOutputHandler(terminalId, (data) => {
        if (resolved || trustConfirmed) return;
        // eslint-disable-next-line no-control-regex
        const stripped = data.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');

        if (!menuReady && /enter to confirm/i.test(stripped)) {
          menuReady = true;
          lastOutputTime = Date.now();
          console.log('[Onboarding] Trust prompt menu detected, sending Enter');
          pushProgress('Accepting directory trust prompt...', 52);
          let attempts = 0;
          claudeRetryTimer = setInterval(() => {
            if (trustConfirmed || attempts >= 10) {
              if (claudeRetryTimer) { clearInterval(claudeRetryTimer); claudeRetryTimer = null; }
              return;
            }
            attempts++;
            ptyManager.writeToTerminal(terminalId, '\r');
          }, 500);
        }
        if (menuReady && !/trust|folder|directory|security|confirm|cancel|exit/i.test(stripped) && stripped.trim().length > 5) {
          trustConfirmed = true;
          lastOutputTime = Date.now();
          if (claudeRetryTimer) { clearInterval(claudeRetryTimer); claudeRetryTimer = null; }
          console.log('[Onboarding] Trust prompt accepted');
        }
      }, trustHandlerId);
    }

    // MCP tool permission prompt handling (Codex shows "Allow the ... MCP server to run tool")
    // Auto-approve by selecting option 2 ("Allow for this session") then Enter.
    const mcpPermHandlerId = 'onboarding-mcp-perm';
    let mcpPermBuffer = '';
    ptyManager.addOutputHandler(terminalId, (data) => {
      if (resolved) return;
      mcpPermBuffer += data;
      // Keep buffer manageable
      if (mcpPermBuffer.length > 4000) mcpPermBuffer = mcpPermBuffer.slice(-2000);
      // eslint-disable-next-line no-control-regex
      const stripped = mcpPermBuffer.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');
      if (/Allow the .* MCP server to run tool/i.test(stripped) && /enter to submit/i.test(stripped)) {
        console.log('[Onboarding] MCP permission prompt detected, auto-approving (option 2)');
        mcpPermBuffer = '';
        // Select option 2 (Allow for this session) then submit
        ptyManager.writeToTerminal(terminalId, '2');
        setTimeout(() => {
          if (!resolved) ptyManager.writeToTerminal(terminalId, '\r');
        }, 200);
      }
    }, mcpPermHandlerId);

    // Stream output to activity feed + update progress.
    // Debounced: TUI tools redraw character-by-character (e.g., "W", "Wo", "Wor", "Working")
    // which floods the activity stream with noise. Batch into 1.5s windows.
    let outputLineCount = 0;
    let lastProgressUpdate = 0;
    const PROGRESS_INTERVAL_MS = 3000;
    let streamFlushTimer: ReturnType<typeof setTimeout> | null = null;
    const STREAM_DEBOUNCE_MS = 1500;

    const flushStreamOutput = () => {
      streamFlushTimer = null;
      if (resolved) return;
      const transcriptRaw = aiSessionManager.getTranscript(sessionId);
      if (transcriptRaw.length < emittedTranscriptLength) {
        emittedTranscriptLength = 0;
      }
      const deltaRaw = transcriptRaw.slice(emittedTranscriptLength);
      if (deltaRaw.length === 0) return;
      const freshLines = renderTerminalTranscript(deltaRaw, { maxLines: 0 })
        .lines
        .filter((line) => line.trim().length > 0);
      if (opts?.streamId && freshLines.length > 0) {
        for (const line of freshLines) {
          activityManager.emit(opts.streamId, line);
        }
      }
      emittedTranscriptLength = transcriptRaw.length;
      outputLineCount += freshLines.length;
    };

    ptyManager.addOutputHandler(terminalId, (data) => {
      if (resolved) return;
      if (data.trim().length > 0) {
        lastOutputTime = Date.now();
      }
      // Debounce: reset timer on each chunk, flush after quiet period
      if (streamFlushTimer) clearTimeout(streamFlushTimer);
      streamFlushTimer = setTimeout(flushStreamOutput, STREAM_DEBOUNCE_MS);

      // Progress updates based on cumulative output
      const now = Date.now();
      if (now - lastProgressUpdate >= PROGRESS_INTERVAL_MS && outputLineCount > 0) {
        lastProgressUpdate = now;
        const creep = Math.min(29, Math.floor(15 * Math.log2(1 + outputLineCount / 10)));
        pushProgress(`Analyzing... (${outputLineCount} lines received)`, 50 + creep);
        if (opts?.streamId) {
          activityManager.updateProgress(opts.streamId, 50 + creep);
        }
      }
    }, streamHandlerId);

    // Stall/timeout detection
    stallCheckTimer = setInterval(() => {
      if (resolved) return;
      const elapsed = Date.now() - analysisStartMs;
      const stallDuration = Date.now() - lastOutputTime;
      if (stallDuration >= INACTIVITY_TIMEOUT_MS) {
        fail(new Error(`Analysis timed out after ${Math.floor(INACTIVITY_TIMEOUT_MS / 1000)} seconds without agent output.`));
        return;
      }
      if (elapsed >= HARD_TIMEOUT_MS) {
        fail(new Error(`Analysis timed out after ${Math.floor(HARD_TIMEOUT_MS / 1000)} seconds total runtime.`));
        return;
      }
      if (stallDuration >= STALL_WARN_THRESHOLD_MS) {
        const creep = Math.min(29, Math.floor(15 * Math.log2(1 + outputLineCount / 10)));
        pushProgress(
          `No output received for ${Math.floor(stallDuration / 1000)}s \u2014 AI tool may be processing a large response...`,
          50 + creep,
          'analyzing',
          { stalled: true, stallDurationMs: stallDuration },
        );
      }
    }, 5_000);

    // Watch for MCP result file (primary completion signal)
    // Also falls back to parsing terminal output for JSON
    resultWatchTimer = setInterval(() => {
      if (resolved) return;

      // Primary: check MCP result file
      try {
        if (fs.existsSync(resultFile)) {
          const content = fs.readFileSync(resultFile, 'utf8').trim();
          if (content.length > 0) {
            const wrapped = '```json\n' + content + '\n```';
            pushProgress('AI response received via MCP, reading output...', 80);
            finish(wrapped);
            return;
          }
        }
      } catch { /* ignore partial writes */ }

      // Fallback: check terminal transcript for JSON
      const transcriptRaw = aiSessionManager.getTranscript(sessionId);
      const renderedTranscript = renderTerminalTranscript(transcriptRaw);
      if (renderedTranscript.text.trim().length > 0) {
        const parsed = parseAnalysisResponse(renderedTranscript.text);
        if (parsed.result) {
          pushProgress('AI response received, reading output...', 80);
          finish(renderedTranscript.text);
          return;
        }
      }

      // Check if terminal exited
      if (!ptyManager.hasTerminal(terminalId)) {
        if (renderedTranscript.text.trim().length > 0) {
          pushProgress('AI session ended, reading captured output...', 80);
          finish(renderedTranscript.text);
        } else {
          fail(new Error('Analysis terminal exited before producing output.'));
        }
      }
    }, 2_000);

    // Interactive shell: start command, wait for ready, then send MCP instruction
    console.log(`[Onboarding] Starting interactive MCP session in terminal ${terminalId}`);
    void (async () => {
      // Let the shell initialize
      await delay(interactiveConfig.startupDelayMs);

      // Type the claude command into the interactive shell
      console.log(`[Onboarding] Sending command to terminal ${terminalId}: ${shellCommand.substring(0, 80)}...`);
      aiSessionManager.startSessionCommand(sessionId, shellCommand);

      // Wait for Claude's TUI to become ready
      const readyStart = Date.now();
      let ready = false;
      let readyPollCount = 0;
      while (Date.now() - readyStart < interactiveConfig.readyTimeoutMs) {
        if (resolved) return;
        if (!ptyManager.hasTerminal(terminalId)) {
          throw new Error('Terminal exited before Claude became ready.');
        }
        const output = aiSessionManager.capturePane(sessionId);
        readyPollCount++;
        if (readyPollCount <= 5 || readyPollCount % 10 === 0) {
          console.log(`[Onboarding] Ready poll #${readyPollCount} for ${terminalId}: transcript=${output.length} chars`);
        }
        if (interactiveConfig.readyMarkers.some((marker) => output.includes(marker))) {
          console.log(`[Onboarding] Ready marker detected in terminal ${terminalId}`);
          ready = true;
          break;
        }
        await delay(1000);
      }

      if (!ready) {
        throw new Error(`Claude did not become ready within ${Math.floor(interactiveConfig.readyTimeoutMs / 1000)}s. The MCP server may have failed to start.`);
      }

      // Inject MCP instruction using per-tool input method (matches agent-forge exactly).
      // Claude: sendKeys (literal text + enter)
      // Codex/Gemini: pasteFromFile pattern (write text → 1s delay → enter → 300ms → enter)
      await delay(2000);
      console.log(`[Onboarding] Sending MCP instruction to terminal ${terminalId} (inputMethod=${interactiveConfig.inputMethod})`);

      if (interactiveConfig.inputMethod === 'pasteFromFile') {
        // Agent-forge pasteFromFile: write content, delay, then TWO enters
        ptyManager.writeToTerminal(terminalId, MCP_INSTRUCTION);
        await delay(1000);
        ptyManager.writeToTerminal(terminalId, '\r');
        await delay(300);
        ptyManager.writeToTerminal(terminalId, '\r');
      } else {
        // Claude-style: sendKeys with literal + enter
        aiSessionManager.sendKeys(sessionId, MCP_INSTRUCTION, { literal: true, enter: true });
      }
    })().catch((err) => {
      fail(new Error(`Failed to send onboarding prompt to AI session: ${(err as Error).message}`), 'failed', true);
    });
  });
}

// ─── Response Parsing ────────────────────────────────────────────────────────

/**
 * Extract and parse the JSON analysis result from raw AI output.
 * Looks for the first ```json ... ``` block.
 */
function parseAnalysisResponse(raw: string): { result: OnboardingAnalysisResult | null; error?: string } {
  try {
    // Handle empty output
    if (!raw || raw.trim().length === 0) {
      const error = 'AI tool produced no output. Check that the AI tool is configured correctly and try again.';
      console.error(`[Onboarding] ${error}`);
      return { result: null, error };
    }

    // Strip ANSI escape codes that terminals inject
    const cleaned = raw.replace(
      // eslint-disable-next-line no-control-regex
      /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
      '',
    );

    const extractBalancedObject = (text: string, startPattern: RegExp): string | null => {
      const match = text.match(startPattern);
      if (!match || match.index === undefined) return null;
      const candidate = text.slice(match.index);
      let depth = 0;
      let end = -1;
      let inString = false;
      let escaped = false;

      for (let i = 0; i < candidate.length; i++) {
        const ch = candidate[i];
        if (escaped) { escaped = false; continue; }
        if (ch === '\\' && inString) { escaped = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (ch === '{') depth++;
        else if (ch === '}') {
          depth--;
          if (depth === 0) {
            end = i + 1;
            break;
          }
        }
      }

      return end > 0 ? candidate.slice(0, end) : null;
    };

    let sourceText = cleaned;
    const envelopeText = extractBalancedObject(cleaned, /\{\s*"type"\s*:\s*"result"/);
    if (envelopeText) {
      try {
        const envelope = JSON.parse(envelopeText) as { result?: unknown };
        if (typeof envelope.result === 'string' && envelope.result.trim().length > 0) {
          sourceText = envelope.result;
        }
      } catch {
        // Fall back to raw cleaned output.
      }
    }

    // Try to extract JSON: first from ```json fences, then raw JSON object
    let jsonText: string | null = null;

    // Strategy 1: Markdown-fenced JSON block
    const fenceMatch = sourceText.match(/```json\s*([\s\S]*?)```/);
    if (fenceMatch) {
      jsonText = fenceMatch[1].trim();
    }

    // Strategy 2: Raw JSON object starting with { "structure": (no fences)
    if (!jsonText) {
      const rawMatch = sourceText.match(/(\{\s*"structure"\s*:\s*\{[\s\S]*)/);
      if (rawMatch) {
        // Find the balanced closing brace, skipping braces inside JSON strings
        const text = rawMatch[1];
        let depth = 0;
        let end = -1;
        let inString = false;
        let escaped = false;
        for (let i = 0; i < text.length; i++) {
          const ch = text[i];
          if (escaped) { escaped = false; continue; }
          if (ch === '\\' && inString) { escaped = true; continue; }
          if (ch === '"') { inString = !inString; continue; }
          if (inString) continue;
          if (ch === '{') depth++;
          else if (ch === '}') {
            depth--;
            if (depth === 0) { end = i + 1; break; }
          }
        }
        if (end > 0) {
          jsonText = text.substring(0, end);
        }
      }
    }

    if (!jsonText) {
      // Check for common error patterns only when no JSON was found
      const lowerCleaned = sourceText.toLowerCase();
      const errorPatterns: Array<{ pattern: RegExp; label: string }> = [
        { pattern: /rate limit(ed| exceeded| error)/i, label: 'Rate limit exceeded' },
        { pattern: /permission denied/i, label: 'Permission denied' },
        { pattern: /command not found/i, label: 'Command not found' },
        { pattern: /unauthorized/i, label: 'Authentication failed (unauthorized)' },
        { pattern: /invalid.*api.?key|api.?key.*invalid/i, label: 'API key issue detected' },
        { pattern: /econnrefused/i, label: 'Connection refused' },
        { pattern: /timed?\s*out/i, label: 'Request timed out' },
      ];
      const detectedError = errorPatterns.find((ep) => ep.pattern.test(lowerCleaned));

      const preview = sourceText.trim().substring(0, 300);
      let error = 'No JSON found in AI response.';
      if (detectedError) {
        error += ` ${detectedError.label} — check the terminal for details.`;
      } else {
        error += ' Use "View Terminal" to inspect the raw output.';
      }
      console.error(`[Onboarding] ${error} Raw output preview: "${preview}"`);
      return { result: null, error };
    }

    const parsed = JSON.parse(jsonText);

    // Validate minimum structure
    if (!parsed.structure && !parsed.projectNotes && !parsed.suggestedTasks) {
      const error = 'Parsed JSON lacks expected top-level keys (structure, projectNotes, suggestedTasks).';
      console.error(`[Onboarding] ${error}`);
      return { result: null, error };
    }

    // Ensure all top-level keys exist with defaults
    const result: OnboardingAnalysisResult = {
      structure: parsed.structure || {},
      projectNotes: parsed.projectNotes || {},
      suggestedTasks: Array.isArray(parsed.suggestedTasks) ? parsed.suggestedTasks : [],
    };

    console.log(
      `[Onboarding] Parsed analysis: ${Object.keys(result.structure.modules || {}).length} modules, ` +
      `${result.suggestedTasks.length} tasks suggested`,
    );

    return { result };
  } catch (err) {
    const preview = raw ? raw.trim().substring(0, 300) : '(empty)';
    const error = `Failed to parse AI response: ${(err as Error).message}. Use "View Terminal" to inspect the raw output.`;
    // Log preview locally for debugging but don't send to renderer (may contain credentials)
    console.error(`[Onboarding] ${error} Raw output preview: "${preview}"`);
    return { result: null, error };
  }
}

// ─── Import Results ──────────────────────────────────────────────────────────

/**
 * Generate a short unique-ish task ID.
 */
function generateTaskId(): string {
  const timePart = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 7);
  return `task-${timePart}${randomPart}`;
}

/**
 * Get existing task titles from .subframe/tasks/ to avoid duplicates.
 */
function getExistingTaskTitles(projectPath: string): Set<string> {
  const titles = new Set<string>();
  const tasksDir = path.join(projectPath, FRAME_TASKS_DIR);

  if (!fs.existsSync(tasksDir)) return titles;

  try {
    const files = fs.readdirSync(tasksDir).filter((f) => f.endsWith('.md'));
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(tasksDir, file), 'utf8');
        // Quick parse — just grab the title from frontmatter
        const titleMatch = content.match(/^title:\s*["']?(.+?)["']?\s*$/m);
        if (titleMatch) {
          titles.add(titleMatch[1].toLowerCase().trim());
        }
      } catch { /* skip unreadable files */ }
    }
  } catch { /* skip if directory unreadable */ }

  return titles;
}

/**
 * Import analysis results into SubFrame project files.
 * Non-destructive: only fills in missing/empty fields, never overwrites existing content.
 */
function importResults(
  projectPath: string,
  results: OnboardingAnalysisResult,
  selections: OnboardingImportSelections,
): OnboardingImportResult {
  const imported: string[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];

  // ── 1. Import structure into STRUCTURE.json ──────────────────────────────
  if (selections.structure && results.structure) {
    const structurePath = path.join(projectPath, FRAME_FILES.STRUCTURE);
    try {
      let existing: Record<string, unknown> = {};
      if (fs.existsSync(structurePath)) {
        existing = JSON.parse(fs.readFileSync(structurePath, 'utf8'));
      }

      let changed = false;

      // Only fill in empty/missing top-level string fields
      const stringFields = ['description', 'architecture', 'dataFlow'] as const;
      for (const field of stringFields) {
        if (results.structure[field] && !existing[field]) {
          existing[field] = results.structure[field];
          changed = true;
        }
      }

      // Conventions: only set if not already present
      if (
        results.structure.conventions &&
        results.structure.conventions.length > 0 &&
        !existing.conventions
      ) {
        existing.conventions = results.structure.conventions;
        changed = true;
      }

      // Modules: merge — add new, don't overwrite existing
      if (results.structure.modules) {
        const existingModules = (existing.modules || {}) as Record<string, unknown>;
        let modulesChanged = false;

        for (const [name, info] of Object.entries(results.structure.modules)) {
          if (!existingModules[name]) {
            existingModules[name] = info;
            modulesChanged = true;
          }
        }

        if (modulesChanged) {
          existing.modules = existingModules;
          changed = true;
        }
      }

      if (changed) {
        fs.writeFileSync(structurePath, JSON.stringify(existing, null, 2), 'utf8');
        imported.push('STRUCTURE.json');
      } else {
        skipped.push('STRUCTURE.json (no new fields to fill)');
      }
    } catch (err) {
      errors.push(`STRUCTURE.json: ${(err as Error).message}`);
    }
  }

  // ── 2. Import project notes into PROJECT_NOTES.md ────────────────────────
  if (selections.projectNotes && results.projectNotes) {
    const notesPath = path.join(projectPath, FRAME_FILES.NOTES);
    try {
      let existingContent = '';
      if (fs.existsSync(notesPath)) {
        existingContent = fs.readFileSync(notesPath, 'utf8');
      }

      const isDefaultTemplate =
        existingContent.includes('No decisions logged yet') ||
        existingContent.trim().length < 100;

      const parts: string[] = [];

      if (isDefaultTemplate) {
        // Replace the default template content
        parts.push('# Project Notes\n');

        if (results.projectNotes.vision) {
          parts.push(`## Vision\n\n${results.projectNotes.vision}\n`);
        }

        if (results.projectNotes.techStack && results.projectNotes.techStack.length > 0) {
          parts.push('## Tech Stack\n');
          for (const tech of results.projectNotes.techStack) {
            parts.push(`- ${tech}`);
          }
          parts.push('');
        }

        if (results.projectNotes.decisions && results.projectNotes.decisions.length > 0) {
          parts.push('## Decisions\n');
          for (const decision of results.projectNotes.decisions) {
            parts.push(`### ${decision.title} (${decision.date})\n`);
            parts.push(`${decision.detail}\n`);
          }
        }

        fs.writeFileSync(notesPath, parts.join('\n'), 'utf8');
      } else {
        // Append an AI Analysis section to existing content
        parts.push('\n\n## AI Analysis\n');
        parts.push(`_Generated by SubFrame onboarding on ${new Date().toISOString().slice(0, 10)}_\n`);

        if (results.projectNotes.vision) {
          parts.push(`**Vision:** ${results.projectNotes.vision}\n`);
        }

        if (results.projectNotes.techStack && results.projectNotes.techStack.length > 0) {
          parts.push('**Tech Stack:**');
          for (const tech of results.projectNotes.techStack) {
            parts.push(`- ${tech}`);
          }
          parts.push('');
        }

        if (results.projectNotes.decisions && results.projectNotes.decisions.length > 0) {
          parts.push('**Key Decisions:**');
          for (const decision of results.projectNotes.decisions) {
            parts.push(`- **${decision.title}** (${decision.date}): ${decision.detail}`);
          }
          parts.push('');
        }

        fs.appendFileSync(notesPath, parts.join('\n'), 'utf8');
      }

      imported.push('PROJECT_NOTES.md');
    } catch (err) {
      errors.push(`PROJECT_NOTES.md: ${(err as Error).message}`);
    }
  }

  // ── 3. Import suggested tasks as .md files ───────────────────────────────
  if (selections.taskIds.length > 0 && results.suggestedTasks.length > 0) {
    const tasksDir = path.join(projectPath, FRAME_TASKS_DIR);

    // Ensure tasks directory exists
    if (!fs.existsSync(tasksDir)) {
      fs.mkdirSync(tasksDir, { recursive: true });
    }

    const existingTitles = getExistingTaskTitles(projectPath);
    const now = new Date().toISOString();

    for (const idx of selections.taskIds) {
      if (idx < 0 || idx >= results.suggestedTasks.length) continue;

      const suggestion = results.suggestedTasks[idx];

      // Deduplicate by title
      if (existingTitles.has(suggestion.title.toLowerCase().trim())) {
        skipped.push(`Task "${suggestion.title}" (duplicate title)`);
        continue;
      }

      try {
        const taskId = generateTaskId();
        const taskContent = [
          '---',
          `id: ${taskId}`,
          `title: "${suggestion.title.replace(/"/g, '\\"')}"`,
          `description: "${suggestion.description.replace(/"/g, '\\"')}"`,
          `userRequest: "Suggested by AI onboarding analysis"`,
          `acceptanceCriteria: ""`,
          `status: pending`,
          `priority: ${suggestion.priority || 'medium'}`,
          `category: ${suggestion.category || 'feature'}`,
          `createdAt: ${now}`,
          `updatedAt: ${now}`,
          `completedAt: null`,
          `blockedBy: []`,
          `blocks: []`,
          '---',
          '',
          suggestion.description,
          '',
        ].join('\n');

        const filePath = path.join(tasksDir, `${taskId}.md`);
        fs.writeFileSync(filePath, taskContent, 'utf8');
        imported.push(`Task: ${suggestion.title}`);
        existingTitles.add(suggestion.title.toLowerCase().trim());
      } catch (err) {
        errors.push(`Task "${suggestion.title}": ${(err as Error).message}`);
      }
    }
  }

  return { imported, skipped, errors };
}

// ─── IPC Setup ───────────────────────────────────────────────────────────────

/**
 * Initialize the onboarding manager with a window reference.
 */
function init(window: BrowserWindow): void {
  mainWindow = window;
}

/**
 * Register IPC handlers for onboarding.
 */
function setupIPC(ipcMain: IpcMain): void {
  // ── DETECT_PROJECT_INTELLIGENCE (handle) ─────────────────────────────────
  ipcMain.handle(IPC.DETECT_PROJECT_INTELLIGENCE, (_event, projectPath: string) => {
    try {
      const detection = detectProjectIntelligence(projectPath);
      patchSession(projectPath, {
        detection,
        status: 'idle',
        error: null,
        cancelled: null,
        importResult: null,
      });
      return detection;
    } catch (err) {
      console.error('[Onboarding] Detection error:', err);
      patchSession(projectPath, {
        detection: null,
        status: 'error',
        error: (err as Error).message,
        cancelled: null,
      });
      return {
        projectPath,
        projectName: path.basename(projectPath),
        detected: [],
        hasGit: false,
        sourceFileCount: 0,
        primaryLanguage: 'Unknown',
        worthAnalyzing: false,
      } satisfies OnboardingDetectionResult;
    }
  });

  // ── RUN_ONBOARDING_ANALYSIS (handle) ─────────────────────────────────────
  ipcMain.handle(IPC.RUN_ONBOARDING_ANALYSIS, async (_event, projectPath: string, options?: OnboardingAnalysisOptions) => {
    let activityStreamId: string | undefined;
    try {
      patchSession(projectPath, {
        analysisResult: null,
        progress: null,
        terminalId: null,
        activityStreamId: null,
        error: null,
        cancelled: null,
        importResult: null,
        status: 'detecting',
      });

      // Re-entrancy guard — prevent duplicate analyses for the same project
      if (activeAnalyses.has(projectPath)) {
        const existing = activeAnalyses.get(projectPath)!;
        if (options) {
          console.warn('[Onboarding] Analysis already running for this project — new options will be ignored. Cancel the current analysis first.');
        }
        return { terminalId: existing.terminalId, activityStreamId: existing.streamId ?? '' };
      }

      // Compute effective timeout (user override or default)
      const analysisStartMs = Date.now();
      const effectiveTimeout = options?.timeoutOverride ?? getAnalysisTimeout();
      let streamId = '';
      const timeoutMeta = () => ({
        timeoutMs: effectiveTimeout,
        elapsedMs: Date.now() - analysisStartMs,
        activityStreamId: streamId,
      });

      // Create activity stream for onboarding analysis
      streamId = activityManager.createStream({
        name: 'Project Analysis',
        type: 'pty',
        source: 'onboarding',
        timeout: 0,
        heartbeatInterval: 3_000,
      });
      activityStreamId = streamId;
      activityManager.updateStatus(streamId, 'running');
      activityManager.startHeartbeat(streamId);
      patchSession(projectPath, { activityStreamId: streamId, status: 'detecting' });

      // Phase: detecting
      sendProgress(projectPath, 'detecting', 'Scanning for project intelligence files...', 10, timeoutMeta());
      activityManager.emit(streamId, 'Scanning for project intelligence files...');
      activityManager.updateProgress(streamId, 10);
      const detection = detectProjectIntelligence(projectPath);
      patchSession(projectPath, { detection });

      if (!detection.worthAnalyzing) {
        sendProgress(
          projectPath,
          'error',
          'Not enough project files found for meaningful analysis.',
          10,
          timeoutMeta(),
        );
        activityManager.updateStatus(streamId, 'failed', 'Not enough project files found for meaningful analysis.');
        return { terminalId: '', activityStreamId: streamId };
      }

      // Pre-flight: check AI tool is installed
      const toolCheck = await checkAIToolAvailable(options?.toolId);
      if (!toolCheck.available) {
        const toolError = toolCheck.error || `AI tool "${toolCheck.command}" not found.`;
        sendProgress(projectPath, 'error', toolError, 15, timeoutMeta());
        activityManager.updateStatus(streamId, 'failed', toolError);
        return { terminalId: '', activityStreamId: streamId };
      }

      // Phase: gathering
      sendProgress(projectPath, 'gathering', `Reading ${detection.detected.length} detected files...`, 30, timeoutMeta());
      activityManager.emit(streamId, `Reading ${detection.detected.length} detected files...`);
      activityManager.updateProgress(streamId, 30);
      const context = gatherContext(projectPath, detection.detected, options?.extraFiles);

      if (context.trim().length === 0) {
        sendProgress(projectPath, 'error', 'No readable content found in detected files.', 30, timeoutMeta());
        activityManager.updateStatus(streamId, 'failed', 'No readable content found in detected files.');
        return { terminalId: '', activityStreamId: streamId };
      }

      // Build the prompt
      const prompt = buildAnalysisPrompt(context, detection.projectName, options?.customContext);

      // Phase: analyzing
      sendProgress(projectPath, 'analyzing', 'Running AI analysis (this may take a minute)...', 50, timeoutMeta());
      activityManager.emit(streamId, 'Running AI analysis (this may take a minute)...');
      activityManager.updateProgress(streamId, 50);

      let raw: string;
      let analysisTerminalId = '';
      try {
        const result = await runAnalysisInTerminal(projectPath, prompt, {
          timeoutMs: options?.timeoutOverride,
          analysisStartMs,
          streamId,
          toolId: options?.toolId,
        });
        raw = result.raw;
        analysisTerminalId = result.terminalId;
      } catch (err) {
        const msg = (err as Error).message || 'Unknown error during analysis';
        const errTerminalId = (err as any).terminalId || activeAnalyses.get(projectPath)?.terminalId || '';
        const abortReason = activityManager.getAbortSignal(streamId)?.reason;
        const cancelled = abortReason === 'Cancelled' || /cancelled by user/i.test(msg);
        // Include terminalId so "View Terminal" button appears in error state
        sendProgress(projectPath, cancelled ? 'cancelled' : 'error', msg, 50, {
          terminalId: errTerminalId,
          ...timeoutMeta(),
        });
        if (!cancelled) {
          activityManager.updateStatus(streamId, 'failed', msg);
        }
        console.error('[Onboarding] Analysis pipeline error:', err);
        // Save error log
        try {
          const logDir = path.join(projectPath, '.subframe');
          fs.mkdirSync(logDir, { recursive: true });
          const logPath = path.join(projectPath, '.subframe', 'analysis.log');
          const aiToolCmd = await aiToolManager.getStartCommand(options?.toolId);
          const logContent = [
            `# SubFrame AI Analysis Log`,
            `# Date: ${new Date().toISOString()}`,
            `# Project: ${projectPath}`,
            `# AI Tool: ${aiToolCmd}`,
            `# Status: Error`,
            '',
            `Error: ${msg}`,
          ].join('\n');
          fs.writeFileSync(logPath, logContent, 'utf8');
        } catch { /* ignore */ }
        return { terminalId: errTerminalId, activityStreamId: streamId };
      }

      // Phase: parsing
      sendProgress(projectPath, 'parsing', 'Parsing AI response...', 80, timeoutMeta());
      activityManager.emit(streamId, 'Parsing AI response...');
      activityManager.updateProgress(streamId, 80);
      const { result: parsed, error: parseError } = parseAnalysisResponse(raw);

      // Save analysis log to .subframe/ for debugging
      try {
        const logDir = path.join(projectPath, '.subframe');
        fs.mkdirSync(logDir, { recursive: true });
        const logPath = path.join(projectPath, '.subframe', 'analysis.log');
        const aiToolCmd2 = await aiToolManager.getStartCommand(options?.toolId);
        const logContent = [
          `# SubFrame AI Analysis Log`,
          `# Date: ${new Date().toISOString()}`,
          `# Project: ${projectPath}`,
          `# AI Tool: ${aiToolCmd2}`,
          `# Status: ${parsed ? 'Success' : 'Parse failed'}`,
          '',
          raw,
        ].join('\n');
        fs.writeFileSync(logPath, logContent, 'utf8');
        console.log(`[Onboarding] Analysis log saved to ${logPath}`);
      } catch (logErr) {
        console.error('[Onboarding] Failed to save analysis log:', logErr);
      }

      if (!parsed) {
        const errorMsg = parseError || 'Failed to parse AI response. Check the terminal output.';
        // Include terminalId so "View Terminal" button appears in error state
        const errorTerminalId = activeAnalyses.get(projectPath)?.terminalId || analysisTerminalId;
        sendProgress(projectPath, 'error', errorMsg, 80, {
          terminalId: errorTerminalId,
          ...timeoutMeta(),
        });
        activityManager.updateStatus(streamId, 'failed', errorMsg);
        return { terminalId: errorTerminalId, activityStreamId: streamId };
      }

      // Cache parsed results for IMPORT_ONBOARDING_RESULTS
      analysisResultsCache.set(projectPath, parsed);
      patchSession(projectPath, {
        analysisResult: parsed,
        error: null,
        cancelled: null,
        status: 'done',
        terminalId: analysisTerminalId,
        activityStreamId: streamId,
      });

      // Phase: done — include serialized results so the renderer hook can parse them
      sendProgress(projectPath, 'done', JSON.stringify(parsed), 100, timeoutMeta());
      activityManager.emit(streamId, 'Analysis complete.');
      activityManager.updateProgress(streamId, 100);
      activityManager.updateStatus(streamId, 'completed');

      // Return the terminal ID so the renderer can show the terminal tab
      return { terminalId: analysisTerminalId, activityStreamId: streamId };
    } catch (err) {
      console.error('[Onboarding] Unexpected error in analysis pipeline:', err);
      sendProgress(projectPath, 'error', `Unexpected error: ${(err as Error).message}`, 0);
      patchSession(projectPath, {
        status: 'error',
        error: `Unexpected error: ${(err as Error).message}`,
      });
      if (activityStreamId) {
        activityManager.updateStatus(activityStreamId, 'failed', `Unexpected error: ${(err as Error).message}`);
      }
      return { terminalId: '', activityStreamId: activityStreamId ?? '' };
    }
  });

  // ── GET_ONBOARDING_PROMPT_PREVIEW (handle) ─────────────────────────────
  ipcMain.handle(IPC.GET_ONBOARDING_PROMPT_PREVIEW, (_event, projectPath: string, options?: OnboardingAnalysisOptions) => {
    try {
      const detection = detectProjectIntelligence(projectPath);
      if (!detection.worthAnalyzing) {
        return { prompt: '(Not enough project intelligence files for analysis)', contextSize: 0 };
      }
      const context = gatherContext(projectPath, detection.detected, options?.extraFiles);
      const prompt = buildAnalysisPrompt(context, detection.projectName, options?.customContext);
      return { prompt, contextSize: context.length };
    } catch (err) {
      console.error('[Onboarding] Prompt preview error:', err);
      return { prompt: 'Error generating prompt preview', contextSize: 0 };
    }
  });

  ipcMain.handle(IPC.GET_ONBOARDING_SESSION, (_event, projectPath: string) => {
    return onboardingSessions.get(projectPath) ?? null;
  });

  ipcMain.handle(IPC.CLEAR_ONBOARDING_SESSION, (_event, projectPath: string) => {
    onboardingSessions.delete(projectPath);
    analysisResultsCache.delete(projectPath);
    return { success: true };
  });

  // ── BROWSE_ONBOARDING_FILES (handle) ─────────────────────────────────────
  ipcMain.handle(IPC.BROWSE_ONBOARDING_FILES, async (_event, projectPath: string, type: 'file' | 'directory') => {
    if (!mainWindow || mainWindow.isDestroyed()) return [];
    const { dialog } = require('electron');
    const properties: ('openFile' | 'openDirectory' | 'multiSelections')[] = [
      type === 'file' ? 'openFile' : 'openDirectory',
      'multiSelections',
    ];
    const result = await dialog.showOpenDialog(mainWindow, {
      defaultPath: projectPath,
      properties,
      title: type === 'file' ? 'Add Files to Analysis' : 'Add Directories to Analysis',
    });
    if (result.canceled) return [];
    return result.filePaths;
  });

  // ── IMPORT_ONBOARDING_RESULTS (handle) ───────────────────────────────────
  ipcMain.handle(
    IPC.IMPORT_ONBOARDING_RESULTS,
    (
      _event,
      payload: {
        projectPath: string;
        results: OnboardingAnalysisResult;
        selections: OnboardingImportSelections;
      },
    ) => {
      try {
        sendProgress(payload.projectPath, 'importing', 'Importing selected results...', 90);
        patchSession(payload.projectPath, {
          analysisResult: payload.results,
          status: 'importing',
          error: null,
          cancelled: null,
        });
        const result = importResults(payload.projectPath, payload.results, payload.selections);

        if (result.errors.length > 0) {
          sendProgress(
            payload.projectPath,
            'error',
            `Import completed with ${result.errors.length} error(s).`,
            100,
          );
        } else {
          sendProgress(
            payload.projectPath,
            'imported',
            `Imported ${result.imported.length} item(s) successfully.`,
            100,
          );
        }

        patchSession(payload.projectPath, {
          analysisResult: payload.results,
          importResult: result,
          status: result.errors.length > 0 ? 'error' : 'imported',
          error: result.errors.length > 0 ? `Import completed with ${result.errors.length} error(s).` : null,
          cancelled: null,
        });

        // Clean up cached results and active analysis entry after successful import
        analysisResultsCache.delete(payload.projectPath);
        activeAnalyses.delete(payload.projectPath);

        return result;
      } catch (err) {
        console.error('[Onboarding] Import error:', err);
        return {
          imported: [],
          skipped: [],
          errors: [(err as Error).message],
        } satisfies OnboardingImportResult;
      }
    },
  );

  // ── CANCEL_ONBOARDING_ANALYSIS (on/send) ─────────────────────────────────
  ipcMain.on(IPC.CANCEL_ONBOARDING_ANALYSIS, (_event, projectPath: string) => {
    const analysis = activeAnalyses.get(projectPath);
    if (analysis) {
      console.log(`[Onboarding] Cancelling analysis for ${projectPath}`);

      if (analysis.streamId) {
        activityManager.cancelStream(analysis.streamId);
      } else if (analysis.cancel) {
        analysis.cancel();
      } else {
        analysis.cleanup();
      }
    }
  });
}

// ─── Exports ─────────────────────────────────────────────────────────────────

/** Check if any onboarding analyses are currently running */
function hasActiveAnalyses(): boolean {
  return activeAnalyses.size > 0;
}

export {
  init,
  setupIPC,
  detectProjectIntelligence,
  runAnalysisInTerminal,
  checkAIToolAvailable,
  hasActiveAnalyses,
  // Exported for testing — not part of the public API
  parseAnalysisResponse as _parseAnalysisResponse,
  gatherContext as _gatherContext,
  buildAnalysisPrompt as _buildAnalysisPrompt,
  importResults as _importResults,
};
