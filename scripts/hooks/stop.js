#!/usr/bin/env node
/**
 * SubFrame Stop Hook
 *
 * When Claude finishes responding, performs two checks:
 * 1. Reminds about in-progress sub-tasks (existing behavior)
 * 2. Detects untracked work — if src/ files are modified but no sub-task
 *    is in-progress, nudges to create one and update docs
 *
 * Output on stdout is added to Claude's conversation context.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function findProjectRoot(startDir) {
  let dir = startDir || process.cwd();
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.subframe'))) return dir;
    dir = path.dirname(dir);
  }
  return null;
}

function findTasksFile(startDir) {
  const root = findProjectRoot(startDir);
  if (!root) return null;
  const tasksPath = path.join(root, '.subframe', 'tasks.json');
  return fs.existsSync(tasksPath) ? tasksPath : null;
}

function getModifiedSourceFiles(projectRoot) {
  try {
    // Check for modified (staged + unstaged) files in src/
    const output = execSync('git diff --name-only HEAD -- src/', {
      cwd: projectRoot,
      encoding: 'utf8',
      timeout: 3000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    if (!output) return [];
    return output.split('\n').filter(f => /\.(ts|tsx|js|jsx)$/.test(f));
  } catch {
    return [];
  }
}

function main() {
  // Read hook input from stdin
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

  const projectRoot = findProjectRoot(hookData.cwd) || findProjectRoot(process.cwd());
  if (!projectRoot) process.exit(0);

  const tasksPath = findTasksFile(hookData.cwd) || findTasksFile(process.cwd());
  if (!tasksPath) process.exit(0);

  let data;
  try {
    const raw = fs.readFileSync(tasksPath, 'utf8').replace(/,\s*([\]}])/g, '$1');
    data = JSON.parse(raw);
  } catch {
    process.exit(0);
  }

  const inProgress = data.tasks?.inProgress || [];
  const lines = [];

  // ── Check 1: In-progress sub-task reminder (existing behavior) ──
  if (inProgress.length > 0) {
    lines.push('<sub-task-reminder>');
    lines.push(`\u25C6 SubFrame \u2500 \uD83D\uDD04 ${inProgress.length} sub-task(s) in progress:`);
    for (const t of inProgress) {
      lines.push(`  \u2022 [${t.id}] ${t.title}`);
    }
    lines.push(`\u2192 Done? complete <id> | Notes? update <id> --add-note "..."`);
    lines.push('</sub-task-reminder>');
  }

  // ── Check 2: Untracked work detection ──
  // Only flag if there are modified src/ files AND no sub-task is in-progress
  if (inProgress.length === 0) {
    const modifiedFiles = getModifiedSourceFiles(projectRoot);
    if (modifiedFiles.length >= 2) {
      lines.push('<sync-check>');
      lines.push(`\u25C6 SubFrame \u2500 \u26A0 ${modifiedFiles.length} source file(s) changed but no sub-task is tracking this work.`);
      lines.push(`  Before wrapping up, consider:`);
      lines.push(`  \u2022 Track: node scripts/task.js add --title "..." && node scripts/task.js complete <id>`);
      lines.push(`  \u2022 Decisions \u2192 .subframe/PROJECT_NOTES.md`);
      lines.push(`  \u2022 Changes \u2192 .subframe/docs-internal/changelog.md`);
      lines.push('</sync-check>');
    }
  }

  if (lines.length > 0) {
    console.log(lines.join('\n'));
  }
}

main();
