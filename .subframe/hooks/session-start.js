#!/usr/bin/env node
// @subframe-version 0.7.0-beta
// @subframe-managed
/**
 * SubFrame SessionStart Hook
 *
 * Injects pending/in-progress sub-tasks into Claude's context at session start.
 * Also injects a compact session checklist that survives context compaction.
 *
 * Fires on: startup, resume, compact (re-injects after context compaction).
 *
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

/**
 * Read private tasks from .subframe/tasks/private/ (if it exists).
 * Minimal parser — extracts id, title, status, priority, private flag from frontmatter.
 */
function readPrivateTasks(root) {
  const privateDir = path.join(root, '.subframe', 'tasks', 'private');
  if (!fs.existsSync(privateDir)) return [];
  const tasks = [];
  try {
    const files = fs.readdirSync(privateDir).filter(f => f.endsWith('.md'));
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(privateDir, file), 'utf8');
        // Quick YAML frontmatter extraction (no dependency on gray-matter)
        const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (!fmMatch) continue;
        const fm = {};
        for (const line of fmMatch[1].split('\n')) {
          const m = line.match(/^(\w+):\s*(.+)$/);
          if (m) fm[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
        }
        tasks.push({
          id: fm.id || path.basename(file, '.md'),
          title: fm.title || '(untitled)',
          status: fm.status || 'pending',
          priority: fm.priority || 'medium',
          private: true,
        });
      } catch { /* skip unreadable files */ }
    }
  } catch { /* directory read error */ }
  return tasks;
}

function main() {
  // Read stdin for hookData.cwd if available (consistent with other hooks)
  let cwd = process.cwd();
  try {
    const input = fs.readFileSync(0, 'utf8');
    const hookData = JSON.parse(input);
    if (hookData && hookData.cwd) cwd = hookData.cwd;
  } catch { /* no stdin or bad JSON — fall back to process.cwd() */ }

  const root = findProjectRoot(cwd) || findProjectRoot(process.cwd());
  if (!root) process.exit(0);

  const tasksPath = path.join(root, '.subframe', 'tasks.json');
  let data;
  try {
    const raw = fs.readFileSync(tasksPath, 'utf8').replace(/,\s*([\]}])/g, '$1');
    data = JSON.parse(raw);
  } catch {
    process.exit(0);
  }

  const inProgress = [...(data.tasks?.inProgress || [])];
  const pending = [...(data.tasks?.pending || [])];

  // Merge private tasks (not in index)
  const privateTasks = readPrivateTasks(root);
  for (const t of privateTasks) {
    if (t.status === 'in_progress') inProgress.push(t);
    else if (t.status === 'pending') pending.push(t);
  }

  // Priority icons
  function pi(p) { return p === 'high' ? '\u25B2' : p === 'low' ? '\u25BD' : '\u25C7'; }

  const lines = ['<sub-tasks-context>'];

  if (inProgress.length > 0) {
    lines.push('\u25C6 SubFrame \u2500 \uD83D\uDD04 In Progress (' + inProgress.length + '):');
    for (const t of inProgress) {
      lines.push('  ' + pi(t.priority) + ' [' + t.id + '] ' + t.title);
      if (t.notes) {
        const lastNote = t.notes.split('\n').pop().trim();
        if (lastNote) lines.push('    \u2514 ' + lastNote);
      }
    }
  }

  if (pending.length > 0) {
    lines.push('\u25C6 SubFrame \u2500 \uD83D\uDCCB Pending (' + pending.length + '):');
    const sorted = [...pending].sort((a, b) => {
      const p = { high: 0, medium: 1, low: 2 };
      return (p[a.priority] || 1) - (p[b.priority] || 1);
    });
    const shown = sorted.slice(0, 5);
    for (const t of shown) {
      lines.push('  ' + pi(t.priority) + ' [' + t.id + '] ' + t.title);
    }
    if (pending.length > 5) {
      const taskCmd = fs.existsSync(path.join(root, 'scripts', 'task.js')) ? 'node scripts/task.js' : 'npx subframe task';
      lines.push('  \u2026 +' + (pending.length - 5) + ' more \u2192 ' + taskCmd + ' list');
    }
  }

  lines.push('Use: start <id> | complete <id> | add --title "..."');
  lines.push('</sub-tasks-context>');

  console.log(lines.join('\n'));
}

main();
