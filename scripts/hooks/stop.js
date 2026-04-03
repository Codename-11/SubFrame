#!/usr/bin/env node
// @subframe-version 0.14.5-beta
// @subframe-managed
/**
 * SubFrame Stop Hook
 *
 * When Claude finishes responding, performs two checks:
 * 1. Reminds about in-progress sub-tasks
 * 2. Detects untracked work (modified src/ files with no in-progress sub-task)
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
    const output = execSync('git diff --name-only HEAD', {
      cwd: projectRoot,
      encoding: 'utf8',
      timeout: 3000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    if (!output) return [];
    // Exclude common non-source files to reduce noise
    return output.split('\n').filter(f => !f.startsWith('.subframe/') && !f.startsWith('.claude/') && !f.startsWith('.githooks/') && f !== 'package-lock.json');
  } catch {
    return [];
  }
}

function main() {
  let input = '';
  try { input = fs.readFileSync(0, 'utf8'); } catch { process.exit(0); }
  let hookData;
  try { hookData = JSON.parse(input); } catch { process.exit(0); }

  const projectRoot = findProjectRoot(hookData.cwd) || findProjectRoot(process.cwd());
  if (!projectRoot) process.exit(0);

  const tasksPath = findTasksFile(hookData.cwd) || findTasksFile(process.cwd());
  if (!tasksPath) process.exit(0);

  let data;
  try {
    const raw = fs.readFileSync(tasksPath, 'utf8').replace(/,\s*([\]}])/g, '$1');
    data = JSON.parse(raw);
  } catch { process.exit(0); }

  const inProgress = [...(data.tasks?.inProgress || [])];

  // Include private in-progress tasks (not in the git-tracked index)
  const privateDir = path.join(projectRoot, '.subframe', 'tasks', 'private');
  if (fs.existsSync(privateDir)) {
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
          if (fm.status === 'in_progress') {
            inProgress.push({ id: fm.id || path.basename(file, '.md'), title: fm.title || '(untitled)', private: true });
          }
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  }

  const lines = [];

  if (inProgress.length > 0) {
    lines.push('<sub-task-reminder>');
    lines.push('\u25C6 SubFrame \u2500 \uD83D\uDD04 ' + inProgress.length + ' sub-task(s) in progress:');
    for (const t of inProgress) {
      lines.push('  \u2022 [' + t.id + '] ' + t.title);
    }
    lines.push('\u2192 Done? complete <id> | Notes? update <id> --add-note "..."');
    lines.push('</sub-task-reminder>');
  }

  if (inProgress.length === 0) {
    const modifiedFiles = getModifiedSourceFiles(projectRoot);
    if (modifiedFiles.length >= 2) {
      lines.push('<sync-check>');
      lines.push('\u25C6 SubFrame \u2500 \u26A0 ' + modifiedFiles.length + ' source file(s) changed but no sub-task is tracking this work.');
      lines.push('  Before wrapping up, consider:');
      const taskCmd = fs.existsSync(path.join(projectRoot, 'scripts', 'task.js')) ? 'node scripts/task.js' : 'npx subframe task';
      lines.push('  \u2022 Track: ' + taskCmd + ' add --title "..." && ' + taskCmd + ' complete <id>');
      lines.push('  \u2022 Decisions \u2192 .subframe/PROJECT_NOTES.md');
      lines.push('  \u2022 Changes \u2192 .subframe/docs-internal/changelog.md');
      lines.push('</sync-check>');
    }
  }

  if (lines.length > 0) {
    console.log(lines.join('\n'));
  }
}

main();
