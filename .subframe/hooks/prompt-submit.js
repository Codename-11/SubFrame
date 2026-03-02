#!/usr/bin/env node
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

function findTasksFile(startDir) {
  let dir = startDir || process.cwd();
  while (dir !== path.dirname(dir)) {
    const tasksPath = path.join(dir, '.subframe', 'tasks.json');
    if (fs.existsSync(tasksPath)) return tasksPath;
    dir = path.dirname(dir);
  }
  return null;
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

function main() {
  let input = '';
  try { input = fs.readFileSync(0, 'utf8'); } catch { process.exit(0); }
  let hookData;
  try { hookData = JSON.parse(input); } catch { process.exit(0); }

  const prompt = hookData.prompt;
  if (!prompt || typeof prompt !== 'string' || prompt.length < 10) process.exit(0);
  if (prompt.startsWith('/')) process.exit(0);

  const tasksPath = findTasksFile(hookData.cwd) || findTasksFile(process.cwd());
  if (!tasksPath) process.exit(0);

  let data;
  try {
    const raw = fs.readFileSync(tasksPath, 'utf8').replace(/,\s*([\]}])/g, '$1');
    data = JSON.parse(raw);
  } catch { process.exit(0); }

  const pending = data.tasks?.pending || [];
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
    console.log('\u2192 Start: node scripts/task.js start ' + bestTask.id);
    console.log('</sub-task-match>');
  }
}

main();
