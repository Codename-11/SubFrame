#!/usr/bin/env node
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

function findTasksFile(startDir) {
  let dir = startDir || process.cwd();
  while (dir !== path.dirname(dir)) {
    const tasksPath = path.join(dir, '.subframe', 'tasks.json');
    if (fs.existsSync(tasksPath)) return tasksPath;
    dir = path.dirname(dir);
  }
  return null;
}

function main() {
  const tasksPath = findTasksFile();
  if (!tasksPath) process.exit(0);

  let data;
  try {
    const raw = fs.readFileSync(tasksPath, 'utf8').replace(/,\s*([\]}])/g, '$1');
    data = JSON.parse(raw);
  } catch {
    process.exit(0);
  }

  const inProgress = data.tasks?.inProgress || [];
  const pending = data.tasks?.pending || [];

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
      lines.push('  \u2026 +' + (pending.length - 5) + ' more \u2192 node scripts/task.js list');
    }
  }

  lines.push('Use: start <id> | complete <id> | add --title "..."');
  lines.push('</sub-tasks-context>');

  console.log(lines.join('\n'));
}

main();
