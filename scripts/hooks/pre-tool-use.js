#!/usr/bin/env node
// @subframe-version 0.15.1-beta
// @subframe-managed
/**
 * SubFrame PreToolUse Hook
 *
 * Fires before every tool invocation. Writes a "running" step to
 * .subframe/agent-state.json so the renderer can show real-time activity.
 *
 * - Reads JSON from stdin (Claude Code hook data)
 * - Creates/updates the session entry in agent-state.json
 * - Outputs NOTHING to stdout (side-effect-only hook)
 */

const fs = require('fs');
const path = require('path');

// ── Human-readable verb mapping ─────────────────────────────────────────────

const TOOL_VERBS = {
  Read: 'Reading',
  Write: 'Writing',
  Edit: 'Editing',
  Bash: 'Running command',
  Glob: 'Searching files',
  Grep: 'Searching content',
  Agent: 'Spawning agent',
  WebFetch: 'Fetching URL',
  WebSearch: 'Searching web',
  NotebookEdit: 'Editing notebook',
  Skill: 'Running skill',
  EnterPlanMode: 'Entering plan mode',
  ExitPlanMode: 'Exiting plan mode',
};

const MAX_STEPS = 50;
const STALE_MS = 5 * 60 * 1000; // 5 minutes

// ── Helpers ─────────────────────────────────────────────────────────────────

function findProjectRoot(startDir) {
  let dir = startDir || process.cwd();
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.subframe'))) return dir;
    dir = path.dirname(dir);
  }
  return null;
}

function buildLabel(toolName, toolInput) {
  const verb = TOOL_VERBS[toolName] || toolName;

  if (!toolInput || typeof toolInput !== 'object') return verb;

  // Bash — prefer description, fall back to truncated command
  if (toolName === 'Bash') {
    if (toolInput.description) return toolInput.description.slice(0, 60);
    if (toolInput.command) return verb + ': ' + toolInput.command.slice(0, 50);
    return verb;
  }

  // File-based tools
  if (toolInput.file_path) {
    return verb + ' ' + path.basename(toolInput.file_path);
  }

  // Glob
  if (toolInput.pattern && toolName === 'Glob') {
    return verb + ': ' + toolInput.pattern;
  }

  // Grep
  if (toolInput.pattern && toolName === 'Grep') {
    return verb + ': ' + toolInput.pattern.slice(0, 40);
  }

  // WebFetch
  if (toolInput.url) {
    try {
      return verb + ': ' + new URL(toolInput.url).hostname;
    } catch {
      return verb;
    }
  }

  // WebSearch
  if (toolInput.query) {
    return verb + ': ' + toolInput.query.slice(0, 40);
  }

  // Skill
  if (toolInput.skill) {
    return verb + ': ' + toolInput.skill;
  }

  // Notebook
  if (toolInput.notebook_path) {
    return verb + ' ' + path.basename(toolInput.notebook_path);
  }

  return verb;
}

function loadState(statePath) {
  try {
    const raw = fs.readFileSync(statePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeState(statePath, state) {
  const dir = path.dirname(statePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const content = JSON.stringify(state, null, 2);
  const tmp = statePath + '.tmp.' + process.pid;
  fs.writeFileSync(tmp, content, 'utf8');
  try {
    fs.renameSync(tmp, statePath);
  } catch {
    // Windows fallback: rename can fail with EPERM/EBUSY if file is locked
    try { fs.writeFileSync(statePath, content, 'utf8'); } catch { /* ignore */ }
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
  }
}

function cleanStaleSessions(state, now) {
  for (const session of state.sessions) {
    const lastActivity = new Date(session.lastActivityAt).getTime();
    if (now - lastActivity > STALE_MS && (session.status === 'active' || session.status === 'busy')) {
      session.status = 'idle';
      session.currentTool = undefined;
      for (const step of session.steps || []) {
        if (step.status === 'running') {
          step.status = 'completed';
          step.completedAt = new Date(now).toISOString();
        }
      }
    }
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

function main() {
  let input = '';
  try {
    input = fs.readFileSync(0, 'utf8');
  } catch {
    process.exit(0);
  }

  let hookData;
  try {
    hookData = JSON.parse(input);
  } catch {
    process.exit(0);
  }

  const sessionId = hookData.session_id;
  const toolName = hookData.tool_name;
  const toolInput = hookData.tool_input;

  if (!sessionId || !toolName) process.exit(0);

  const projectRoot = findProjectRoot(hookData.cwd) || findProjectRoot(process.cwd());
  if (!projectRoot) process.exit(0);

  const statePath = path.join(projectRoot, '.subframe', 'agent-state.json');
  const now = Date.now();
  const nowISO = new Date(now).toISOString();

  let state = loadState(statePath) || {
    projectPath: projectRoot,
    sessions: [],
    lastUpdated: nowISO,
  };

  // Ensure sessions array
  if (!Array.isArray(state.sessions)) state.sessions = [];

  // Clean stale sessions
  cleanStaleSessions(state, now);

  // Find or create session
  let session = state.sessions.find(s => s.sessionId === sessionId);
  if (!session) {
    session = {
      sessionId: sessionId,
      status: 'active',
      steps: [],
      startedAt: nowISO,
      lastActivityAt: nowISO,
    };
    state.sessions.push(session);
  }

  // Bind terminal ID from SubFrame's PTY env var (enables direct correlation)
  const sfTerminalId = process.env.SUBFRAME_TERMINAL_ID;
  if (sfTerminalId) session.terminalId = sfTerminalId;

  // Update session
  session.status = 'active';
  session.currentTool = toolName;
  session.lastActivityAt = nowISO;

  // Build and add step
  const label = buildLabel(toolName, toolInput);
  const step = {
    id: 'step-' + now + '-' + session.steps.length,
    label: label,
    toolName: toolName,
    status: 'running',
    startedAt: nowISO,
  };

  if (!Array.isArray(session.steps)) session.steps = [];
  session.steps.push(step);

  // Cap steps at MAX_STEPS (trim oldest)
  if (session.steps.length > MAX_STEPS) {
    session.steps = session.steps.slice(session.steps.length - MAX_STEPS);
  }

  state.lastUpdated = nowISO;

  writeState(statePath, state);
}

try {
  main();
} catch {
  // Never fail loudly
  process.exit(0);
}
