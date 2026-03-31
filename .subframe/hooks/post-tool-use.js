#!/usr/bin/env node
// @subframe-version 0.14.0-beta
// @subframe-managed
/**
 * SubFrame PostToolUse Hook
 *
 * Fires after every tool invocation. Updates the matching "running" step
 * in .subframe/agent-state.json to "completed" status.
 *
 * - Reads JSON from stdin (Claude Code hook data)
 * - Finds the last running step matching the tool and marks it completed
 * - Outputs NOTHING to stdout (side-effect-only hook)
 */

const fs = require('fs');
const path = require('path');

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

  if (!sessionId || !toolName) process.exit(0);

  const projectRoot = findProjectRoot(hookData.cwd) || findProjectRoot(process.cwd());
  if (!projectRoot) process.exit(0);

  const statePath = path.join(projectRoot, '.subframe', 'agent-state.json');
  const now = Date.now();
  const nowISO = new Date(now).toISOString();

  let state = loadState(statePath);
  if (!state || !Array.isArray(state.sessions)) process.exit(0);

  // Clean stale sessions
  cleanStaleSessions(state, now);

  // Find session
  const session = state.sessions.find(s => s.sessionId === sessionId);
  if (!session) process.exit(0);

  // Ensure terminal ID binding (mirrors pre-tool-use; covers edge cases)
  const sfTerminalId = process.env.SUBFRAME_TERMINAL_ID;
  if (sfTerminalId && !session.terminalId) session.terminalId = sfTerminalId;

  session.lastActivityAt = nowISO;

  // Find the LAST step with status "running" that matches the tool_name
  let matchedStep = null;
  if (Array.isArray(session.steps)) {
    for (let i = session.steps.length - 1; i >= 0; i--) {
      if (session.steps[i].status === 'running' && session.steps[i].toolName === toolName) {
        matchedStep = session.steps[i];
        break;
      }
    }
  }

  if (matchedStep) {
    // Update the matched step
    matchedStep.status = 'completed';
    matchedStep.completedAt = nowISO;
  } else {
    // Edge case: no running step found — create a completed step
    if (!Array.isArray(session.steps)) session.steps = [];
    session.steps.push({
      id: 'step-' + now,
      label: toolName,
      toolName: toolName,
      status: 'completed',
      startedAt: nowISO,
      completedAt: nowISO,
    });
  }

  // Check if any steps are still running
  const hasRunning = session.steps.some(s => s.status === 'running');
  if (!hasRunning) {
    session.currentTool = undefined;
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
