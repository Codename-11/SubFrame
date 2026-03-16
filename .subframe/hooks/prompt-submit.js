#!/usr/bin/env node
// @subframe-version 0.5.5-beta
// @subframe-managed
/**
 * SubFrame UserPromptSubmit Hook
 *
 * When a user submits a prompt, fuzzy-matches it against pending sub-task titles.
 * If a match is found, suggests marking it in_progress.
 *
 * Reads hook input from stdin (JSON with { prompt } field).
 * Output on stdout is added to Claude's conversation context.
 */

const fs = require('fs');
const path = require('path');

function findProjectRoot(startDir) {
  let dir = startDir || process.cwd();
  while (dir !== path.dirname(dir)) {
    const tasksPath = path.join(dir, '.subframe', 'tasks.json');
    if (fs.existsSync(tasksPath)) return dir;
    dir = path.dirname(dir);
  }
  return null;
}

function findTasksFile(startDir) {
  const root = findProjectRoot(startDir);
  return root ? path.join(root, '.subframe', 'tasks.json') : null;
}

/** Read pending private tasks from .subframe/tasks/private/ */
function readPrivatePending(root) {
  const privateDir = path.join(root, '.subframe', 'tasks', 'private');
  if (!fs.existsSync(privateDir)) return [];
  const tasks = [];
  try {
    for (const file of fs.readdirSync(privateDir).filter(f => f.endsWith('.md'))) {
      try {
        const content = fs.readFileSync(path.join(privateDir, file), 'utf8');
        const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (!fmMatch) continue;
        const fm = {};
        for (const line of fmMatch[1].split('\n')) {
          const m = line.match(/^(\w+):\s*(.+)$/);
          if (m) fm[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
        }
        if (fm.status === 'pending') {
          // Extract description from body (text after frontmatter, before first ##)
          const body = content.split('---').slice(2).join('---').trim();
          const desc = body.split(/^## /m)[0].trim();
          tasks.push({
            id: fm.id || path.basename(file, '.md'),
            title: fm.title || '(untitled)',
            description: desc,
            priority: fm.priority || 'medium',
            private: true,
          });
        }
      } catch { /* skip */ }
    }
  } catch { /* skip */ }
  return tasks;
}

function matchScore(prompt, title) {
  const promptWords = new Set(prompt.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2));
  const titleWords = title.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2);
  if (titleWords.length === 0) return 0;
  let matches = 0;
  for (const word of titleWords) {
    if (promptWords.has(word)) matches++;
  }
  return matches / titleWords.length;
}

/** Write user message signal to agent-state.json for terminal marker detection */
function writeUserMessageSignal(root, terminalId, prompt) {
  try {
    const statePath = path.join(root, '.subframe', 'agent-state.json');
    const stateDir = path.dirname(statePath);
    if (!fs.existsSync(stateDir)) fs.mkdirSync(stateDir, { recursive: true });

    let state;
    try {
      state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    } catch {
      state = { projectPath: root, sessions: [], lastUpdated: new Date().toISOString() };
    }

    state.lastUserMessage = {
      terminalId: terminalId,
      timestamp: new Date().toISOString(),
      promptPreview: typeof prompt === 'string' ? prompt.substring(0, 100) : '',
    };
    state.lastUpdated = new Date().toISOString();

    // Atomic write (temp + rename)
    const tmp = statePath + '.tmp.' + process.pid;
    const content = JSON.stringify(state, null, 2);
    try { fs.writeFileSync(tmp, content, 'utf8'); fs.renameSync(tmp, statePath); } catch {
      try { fs.writeFileSync(statePath, content, 'utf8'); } catch { /* ignore */ }
      try { fs.unlinkSync(tmp); } catch { /* ignore */ }
    }
  } catch { /* ignore — signal is best-effort */ }
}

function main() {
  let input = '';
  try { input = fs.readFileSync(0, 'utf8'); } catch { process.exit(0); }
  let hookData;
  try { hookData = JSON.parse(input); } catch { process.exit(0); }

  const prompt = hookData.prompt;
  if (!prompt || typeof prompt !== 'string') process.exit(0);

  const root = findProjectRoot(hookData.cwd) || findProjectRoot(process.cwd());

  // Write user message signal FIRST — fires for ALL prompts regardless of length/type
  const sfTerminalId = process.env.SUBFRAME_TERMINAL_ID;
  if (sfTerminalId && root) {
    writeUserMessageSignal(root, sfTerminalId, prompt);
  }

  // Task matching requires longer prompts and tasks.json
  if (prompt.length < 10 || prompt.startsWith('/')) process.exit(0);
  if (!root) process.exit(0);

  const tasksPath = path.join(root, '.subframe', 'tasks.json');
  if (!fs.existsSync(tasksPath)) process.exit(0);

  let data;
  try {
    const raw = fs.readFileSync(tasksPath, 'utf8').replace(/,\s*([\]}])/g, '$1');
    data = JSON.parse(raw);
  } catch { process.exit(0); }

  const pending = [...(data.tasks?.pending || []), ...readPrivatePending(root)];
  if (pending.length === 0) process.exit(0);

  let bestTask = null;
  let bestScore = 0;

  for (const task of pending) {
    const titleScore = matchScore(prompt, task.title);
    const descScore = task.description ? matchScore(prompt, task.description) * 0.5 : 0;
    const score = Math.max(titleScore, descScore);
    if (score > bestScore) {
      bestScore = score;
      bestTask = task;
    }
  }

  if (bestScore >= 0.4 && bestTask) {
    console.log('<sub-task-match>');
    console.log('\u25C6 SubFrame \u2500 \uD83C\uDFAF Matches sub-task [' + bestTask.id + ']: "' + bestTask.title + '" (' + bestTask.priority + ')');
    const taskCmd = fs.existsSync(path.join(root, 'scripts', 'task.js')) ? 'node scripts/task.js' : 'npx subframe task';
    console.log('\u2192 Start: ' + taskCmd + ' start ' + bestTask.id);
    console.log('</sub-task-match>');
  }
}

main();
