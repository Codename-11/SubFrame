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
} from '../shared/ipcChannels';
import { INTELLIGENCE_FILES, FRAME_FILES, FRAME_TASKS_DIR } from '../shared/frameConstants';
import { execSync } from 'child_process';
import * as ptyManager from './ptyManager';
import * as aiToolManager from './aiToolManager';

// ─── Module State ────────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null;

/** Active analysis runs keyed by projectPath */
const activeAnalyses = new Map<string, { terminalId: string; cleanup: () => void }>();

/** Parsed results cache keyed by projectPath (for IMPORT to consume after RUN completes) */
const analysisResultsCache = new Map<string, OnboardingAnalysisResult>();

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
): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(IPC.ONBOARDING_PROGRESS, {
      projectPath,
      phase,
      message,
      progress,
    } satisfies OnboardingProgressEvent);
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
function gatherContext(projectPath: string, detected: DetectedIntelligence[]): string {
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

  return parts.join('\n');
}

// ─── Prompt Building ─────────────────────────────────────────────────────────

/**
 * Build the analysis prompt that instructs the AI to output structured JSON.
 */
function buildAnalysisPrompt(context: string, projectName: string): string {
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

Output ONLY a single JSON code block wrapped in \`\`\`json ... \`\`\` fences. No other text before or after the JSON block.

\`\`\`json
{
  "structure": {
    "description": "...",
    "architecture": "...",
    "conventions": ["..."],
    "dataFlow": "...",
    "modules": {
      "module-name": { "purpose": "...", "exports": ["..."] }
    }
  },
  "projectNotes": {
    "vision": "...",
    "decisions": [{ "date": "YYYY-MM-DD", "title": "...", "detail": "..." }],
    "techStack": ["..."]
  },
  "suggestedTasks": [
    { "title": "...", "description": "...", "priority": "medium", "category": "feature" }
  ]
}
\`\`\``;
}

// ─── Shell Detection ──────────────────────────────────────────────────────────

/**
 * Find a bash-compatible shell for the analysis pipeline.
 * The pipeline uses Unix commands (cat, tee, pipe) so we need bash on Windows.
 * On Unix, the default shell works fine.
 * Throws if on Windows and no bash-compatible shell is found.
 */
function findBashShell(): string | null {
  if (process.platform !== 'win32') {
    return null; // Use default shell on Unix
  }

  // Try Git Bash paths on Windows
  const gitBashPaths = [
    'C:\\Program Files\\Git\\bin\\bash.exe',
    'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
  ];
  for (const bashPath of gitBashPaths) {
    if (fs.existsSync(bashPath)) {
      return bashPath;
    }
  }

  // Try WSL bash or any bash on PATH
  try {
    execSync('where bash', { stdio: 'ignore' });
    return 'bash.exe';
  } catch { /* not available */ }

  throw new Error(
    'No bash-compatible shell found on Windows. ' +
    'The analysis pipeline requires Git Bash (or WSL bash). ' +
    'Install Git for Windows from https://git-scm.com and try again.',
  );
}

// ─── AI Tool Pre-flight Check ────────────────────────────────────────────────

/**
 * Verify that the active AI tool command is available on the system.
 * Uses `where` on Windows, `which` on Unix.
 */
function checkAIToolAvailable(): { available: boolean; command: string; error?: string } {
  const command = aiToolManager.getStartCommand();
  // Extract the base command (first token, ignoring path prefixes for wrapper scripts)
  const baseCommand = command.split(/[\s/\\]/).pop() || command;

  try {
    const whichCmd = process.platform === 'win32' ? 'where' : 'which';
    execSync(`${whichCmd} ${baseCommand}`, { stdio: 'ignore' });
    return { available: true, command };
  } catch {
    return {
      available: false,
      command,
      error: `"${baseCommand}" not found on your system. Make sure it is installed and on your PATH.`,
    };
  }
}

// ─── Terminal Analysis Pipeline ──────────────────────────────────────────────

/** Marker written to terminal output when AI command completes */
const DONE_MARKER = '__SF_ANALYSIS_DONE__';

/** Default analysis timeout in milliseconds */
const DEFAULT_ANALYSIS_TIMEOUT_MS = 120_000;

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
 * Run an AI analysis in a terminal tab.
 * This is the reusable pipeline core — it writes a prompt to a temp file,
 * pipes it through the active AI tool, captures output, and returns the raw result.
 */
async function runAnalysisInTerminal(projectPath: string, prompt: string): Promise<string> {
  // Write prompt to temp file
  const timestamp = Date.now();
  const promptFile = path.join(os.tmpdir(), `sf-onboard-prompt-${timestamp}.txt`);
  const resultFile = path.join(os.tmpdir(), `sf-onboard-result-${timestamp}.txt`);

  fs.writeFileSync(promptFile, prompt, 'utf8');
  // Create empty result placeholder
  fs.writeFileSync(resultFile, '', 'utf8');

  // Convert Windows backslash paths to forward slashes for bash compatibility
  const toUnixPath = (p: string) => p.replace(/\\/g, '/');

  // Build the AI command
  const tool = aiToolManager.getActiveTool();
  const command = aiToolManager.getStartCommand();
  let shellCommand: string;

  // Use Unix-style paths in shell commands (Git Bash on Windows needs forward slashes)
  const shellPromptFile = toUnixPath(promptFile);
  const shellResultFile = toUnixPath(resultFile);

  // Use provider-specific flags for non-interactive / piped input
  switch (tool.id) {
    case 'claude':
      shellCommand = `cat "${shellPromptFile}" | ${command} --print 2>&1 | tee "${shellResultFile}"; echo "${DONE_MARKER}"`;
      break;
    case 'codex':
      shellCommand = `cat "${shellPromptFile}" | ${command} --quiet 2>&1 | tee "${shellResultFile}"; echo "${DONE_MARKER}"`;
      break;
    case 'gemini':
      shellCommand = `cat "${shellPromptFile}" | ${command} 2>&1 | tee "${shellResultFile}"; echo "${DONE_MARKER}"`;
      break;
    default:
      shellCommand = `cat "${shellPromptFile}" | ${command} 2>&1 | tee "${shellResultFile}"; echo "${DONE_MARKER}"`;
      break;
  }

  // Create a terminal for the analysis — force bash on Windows for Unix command compat
  const bashShell = findBashShell();
  const terminalId = ptyManager.createTerminal(projectPath, projectPath, bashShell);
  console.log(`[Onboarding] Created analysis terminal ${terminalId} for ${projectPath} (shell: ${bashShell || 'default'})`);

  // Immediately notify renderer of the terminalId so "View Terminal" works during analysis
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(IPC.ONBOARDING_PROGRESS, {
      projectPath,
      phase: 'analyzing',
      message: 'AI analysis terminal ready',
      progress: 55,
      terminalId,
    } satisfies OnboardingProgressEvent);
  }

  return new Promise<string>((resolve, reject) => {
    let resolved = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    // Cleanup function — removes temp files, stops polling, and removes active analysis entry
    const cleanup = () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      activeAnalyses.delete(projectPath);
      try { fs.unlinkSync(promptFile); } catch { /* ignore */ }
    };

    // Store active analysis so CANCEL can reference it
    activeAnalyses.set(projectPath, { terminalId, cleanup });

    // Timeout guard
    const timeoutMs = getAnalysisTimeout();
    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        reject(new Error(`Analysis timed out after ${timeoutMs / 1000} seconds`));
      }
    }, timeoutMs);

    // Poll the result file for the done marker.
    // The shell command writes AI output to resultFile via `tee`, then echoes the marker.
    // We watch the result file for the marker which gets captured by `tee` as well,
    // OR we write a separate sentinel file. Since the `echo` after `tee` won't be
    // captured in resultFile, we also write a sentinel.
    const sentinelFile = resultFile + '.done';
    const shellSentinelFile = toUnixPath(sentinelFile);

    // Update the shell command to also write a sentinel file on completion
    const sentinelCommand =
      shellCommand.replace(
        `echo "${DONE_MARKER}"`,
        `echo "${DONE_MARKER}" && echo done > "${shellSentinelFile}"`,
      );

    // Poll for the sentinel file every 500ms
    pollTimer = setInterval(() => {
      if (resolved) return;

      try {
        if (fs.existsSync(sentinelFile)) {
          resolved = true;
          clearTimeout(timeoutId);

          // Read the result file (contains AI output from `tee`)
          let result = '';
          try {
            result = fs.readFileSync(resultFile, 'utf8');
          } catch {
            result = '';
          }

          // Clean up
          cleanup();
          try { fs.unlinkSync(resultFile); } catch { /* ignore */ }
          try { fs.unlinkSync(sentinelFile); } catch { /* ignore */ }

          console.log(`[Onboarding] Analysis complete for ${projectPath} (${result.length} chars)`);
          resolve(result);
        }
      } catch {
        // Ignore polling errors
      }
    }, 500);

    // Send the command to the terminal
    console.log(`[Onboarding] Sending analysis command to terminal ${terminalId}`);
    ptyManager.writeToTerminal(terminalId, sentinelCommand + '\r');
  });
}

// ─── Response Parsing ────────────────────────────────────────────────────────

/**
 * Extract and parse the JSON analysis result from raw AI output.
 * Looks for the first ```json ... ``` block.
 */
function parseAnalysisResponse(raw: string): OnboardingAnalysisResult | null {
  try {
    // Strip ANSI escape codes that terminals inject
    const cleaned = raw.replace(
      // eslint-disable-next-line no-control-regex
      /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
      '',
    );

    const match = cleaned.match(/```json\s*([\s\S]*?)```/);
    if (!match) {
      console.error('[Onboarding] No ```json block found in response');
      return null;
    }

    const parsed = JSON.parse(match[1].trim());

    // Validate minimum structure
    if (!parsed.structure && !parsed.projectNotes && !parsed.suggestedTasks) {
      console.error('[Onboarding] Parsed JSON lacks expected top-level keys');
      return null;
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

    return result;
  } catch (err) {
    console.error('[Onboarding] Failed to parse analysis response:', (err as Error).message);
    return null;
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
      return detectProjectIntelligence(projectPath);
    } catch (err) {
      console.error('[Onboarding] Detection error:', err);
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
  ipcMain.handle(IPC.RUN_ONBOARDING_ANALYSIS, async (_event, projectPath: string) => {
    try {
      // Re-entrancy guard — prevent duplicate analyses for the same project
      if (activeAnalyses.has(projectPath)) {
        const existing = activeAnalyses.get(projectPath)!;
        return { terminalId: existing.terminalId };
      }

      // Phase: detecting
      sendProgress(projectPath, 'detecting', 'Scanning for project intelligence files...', 10);
      const detection = detectProjectIntelligence(projectPath);

      if (!detection.worthAnalyzing) {
        sendProgress(
          projectPath,
          'error',
          'Not enough project files found for meaningful analysis.',
          10,
        );
        return { terminalId: '' };
      }

      // Pre-flight: check AI tool is installed
      const toolCheck = checkAIToolAvailable();
      if (!toolCheck.available) {
        sendProgress(projectPath, 'error', toolCheck.error || `AI tool "${toolCheck.command}" not found.`, 15);
        return { terminalId: '' };
      }

      // Pre-flight: check for bash shell on Windows
      if (process.platform === 'win32') {
        try {
          findBashShell();
        } catch (shellErr) {
          sendProgress(projectPath, 'error', (shellErr as Error).message, 15);
          return { terminalId: '' };
        }
      }

      // Phase: gathering
      sendProgress(projectPath, 'gathering', `Reading ${detection.detected.length} detected files...`, 30);
      const context = gatherContext(projectPath, detection.detected);

      if (context.trim().length === 0) {
        sendProgress(projectPath, 'error', 'No readable content found in detected files.', 30);
        return { terminalId: '' };
      }

      // Build the prompt
      const prompt = buildAnalysisPrompt(context, detection.projectName);

      // Phase: analyzing
      sendProgress(projectPath, 'analyzing', 'Running AI analysis (this may take a minute)...', 50);

      let raw: string;
      try {
        raw = await runAnalysisInTerminal(projectPath, prompt);
      } catch (err) {
        const msg = (err as Error).message || 'Unknown error during analysis';
        sendProgress(projectPath, 'error', msg, 50);
        console.error('[Onboarding] Analysis pipeline error:', err);
        return { terminalId: '' };
      }

      // Phase: parsing
      sendProgress(projectPath, 'parsing', 'Parsing AI response...', 80);
      const parsed = parseAnalysisResponse(raw);

      if (!parsed) {
        sendProgress(projectPath, 'error', 'Failed to parse AI response. Check the terminal output.', 80);
        return { terminalId: activeAnalyses.get(projectPath)?.terminalId || '' };
      }

      // Cache parsed results for IMPORT_ONBOARDING_RESULTS
      analysisResultsCache.set(projectPath, parsed);

      // Phase: done — include serialized results so the renderer hook can parse them
      sendProgress(projectPath, 'done', JSON.stringify(parsed), 100);

      // Return the terminal ID so the renderer can show the terminal tab
      const analysis = activeAnalyses.get(projectPath);
      return { terminalId: analysis?.terminalId || '' };
    } catch (err) {
      console.error('[Onboarding] Unexpected error in analysis pipeline:', err);
      sendProgress(projectPath, 'error', `Unexpected error: ${(err as Error).message}`, 0);
      return { terminalId: '' };
    }
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
            'done',
            `Imported ${result.imported.length} item(s) successfully.`,
            100,
          );
        }

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

      // Kill the terminal
      try {
        ptyManager.destroyTerminal(analysis.terminalId);
      } catch (err) {
        console.error('[Onboarding] Error destroying analysis terminal:', err);
      }

      // Run cleanup (removes temp files, deletes from map)
      analysis.cleanup();

      sendProgress(projectPath, 'error', 'Analysis cancelled by user.', 0);
    }
  });
}

// ─── Exports ─────────────────────────────────────────────────────────────────

export { init, setupIPC, detectProjectIntelligence, runAnalysisInTerminal, checkAIToolAvailable };
