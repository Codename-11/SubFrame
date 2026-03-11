#!/usr/bin/env node
/**
 * SubFrame Sub-Task CLI
 *
 * Reliable task management for AI tools — reads/writes individual .md files
 * in .subframe/tasks/ with YAML frontmatter. Falls back to .subframe/tasks.json
 * for legacy projects.
 *
 * Usage:
 *   node scripts/task.js list [--all]          Show active tasks (--all includes completed)
 *   node scripts/task.js get <id>              Show full task details
 *   node scripts/task.js start <id>            Mark pending -> in_progress
 *   node scripts/task.js complete <id>         Mark -> completed
 *   node scripts/task.js add --title "..." [--description "..." --priority medium --category feature --private]
 *   node scripts/task.js update <id> [--status pending --notes "..." --title "..." --add-step "..." --complete-step <index> --private|--public]
 *   node scripts/task.js open <id>             Print absolute path to the .md file
 *   node scripts/task.js archive               Move completed tasks to .subframe/tasks/archive/YYYY/
 */

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

// ── CJS Markdown Parser ─────────────────────────────────────────────────────
// Duplicated from src/main/taskMarkdownParser.ts (CJS, no TS imports).

const SECTION_STEPS = '## Steps';
const SECTION_USER_REQUEST = '## User Request';
const SECTION_ACCEPTANCE = '## Acceptance Criteria';
const SECTION_NOTES = '## Notes';
const KNOWN_SECTIONS = [SECTION_STEPS, SECTION_USER_REQUEST, SECTION_ACCEPTANCE, SECTION_NOTES];

// ── ANSI color helpers (zero-dependency) ──────────────────────────────────────
const useColor = !process.argv.includes('--no-color') && !process.env.NO_COLOR;
const c = {
  bold: s => useColor ? `\x1b[1m${s}\x1b[22m` : s,
  dim: s => useColor ? `\x1b[2m${s}\x1b[22m` : s,
  green: s => useColor ? `\x1b[32m${s}\x1b[39m` : s,
  yellow: s => useColor ? `\x1b[33m${s}\x1b[39m` : s,
  cyan: s => useColor ? `\x1b[36m${s}\x1b[39m` : s,
  red: s => useColor ? `\x1b[31m${s}\x1b[39m` : s,
  reset: useColor ? '\x1b[0m' : '',
};

/**
 * Split markdown body into description (text before first ##) and named sections.
 */
function parseSections(body) {
  const sections = new Map();
  const lines = body.split('\n');
  let currentSection = null;
  let currentLines = [];
  const descriptionLines = [];

  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (currentSection) {
        sections.set(currentSection, currentLines.join('\n').trim());
      }
      currentSection = line;
      currentLines = [];
    } else if (currentSection) {
      currentLines.push(line);
    } else {
      descriptionLines.push(line);
    }
  }

  if (currentSection) {
    sections.set(currentSection, currentLines.join('\n').trim());
  }

  return {
    description: descriptionLines.join('\n').trim(),
    sections,
  };
}

/**
 * Parse step checkboxes from a section body.
 * Matches: `- [x] Label` or `- [ ] Label`
 */
function parseSteps(text) {
  const steps = [];
  const re = /^- \[(x| )\] (.+)$/gm;
  let m;
  while ((m = re.exec(text)) !== null) {
    steps.push({ completed: m[1] === 'x', label: m[2].trim() });
  }
  return steps;
}

/**
 * Strip blockquote prefixes from user request text.
 */
function stripBlockquotes(text) {
  return text
    .split('\n')
    .map((line) => line.replace(/^>\s?/, ''))
    .join('\n')
    .trim();
}

/**
 * Parse a task markdown file into a task object.
 */
function parseTaskMd(content, filePath) {
  const { data: fm, content: body } = matter(content);
  const { description, sections } = parseSections(body);

  const stepsText = sections.get(SECTION_STEPS) || '';
  const steps = parseSteps(stepsText);

  const userRequestRaw = sections.get(SECTION_USER_REQUEST) || '';
  const userRequest = stripBlockquotes(userRequestRaw);

  const acceptanceCriteria = sections.get(SECTION_ACCEPTANCE) || '';
  const notes = sections.get(SECTION_NOTES) || '';

  // Collect unknown sections for round-trip preservation
  const unknownSections = [];
  for (const [heading, sectionContent] of sections) {
    if (!KNOWN_SECTIONS.includes(heading)) {
      unknownSections.push({ heading, content: sectionContent });
    }
  }

  return {
    id: fm.id || '',
    title: fm.title || '',
    status: fm.status || 'pending',
    priority: fm.priority || 'medium',
    category: fm.category || undefined,
    context: fm.context || undefined,
    private: fm.private === true ? true : undefined,
    blockedBy: Array.isArray(fm.blockedBy) ? fm.blockedBy : [],
    blocks: Array.isArray(fm.blocks) ? fm.blocks : [],
    createdAt: fm.createdAt ? new Date(fm.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: fm.updatedAt ? new Date(fm.updatedAt).toISOString() : new Date().toISOString(),
    completedAt: fm.completedAt ? new Date(fm.completedAt).toISOString() : null,
    description: description || '',
    userRequest: userRequest || undefined,
    acceptanceCriteria: acceptanceCriteria || undefined,
    notes: notes || undefined,
    steps,
    filePath,
    ...(unknownSections.length > 0 ? { _unknownSections: unknownSections } : {}),
  };
}

/**
 * Serialize a task object back to markdown with YAML frontmatter.
 */
function serializeTaskMd(task) {
  const fm = {
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    category: task.category || 'feature',
    blockedBy: task.blockedBy || [],
    blocks: task.blocks || [],
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    completedAt: task.completedAt,
  };

  if (task.context) fm.context = task.context;
  if (task.private) fm.private = true;

  const bodyParts = [];

  // Description (before any ## heading)
  if (task.description) {
    bodyParts.push(task.description);
    bodyParts.push('');
  }

  // Steps
  if (task.steps && task.steps.length > 0) {
    bodyParts.push(SECTION_STEPS);
    for (const step of task.steps) {
      bodyParts.push(`- [${step.completed ? 'x' : ' '}] ${step.label}`);
    }
    bodyParts.push('');
  }

  // User Request
  if (task.userRequest) {
    bodyParts.push(SECTION_USER_REQUEST);
    const lines = task.userRequest.split('\n');
    for (const line of lines) {
      bodyParts.push(`> ${line}`);
    }
    bodyParts.push('');
  }

  // Acceptance Criteria
  if (task.acceptanceCriteria) {
    bodyParts.push(SECTION_ACCEPTANCE);
    bodyParts.push(task.acceptanceCriteria);
    bodyParts.push('');
  }

  // Notes
  if (task.notes) {
    bodyParts.push(SECTION_NOTES);
    bodyParts.push(task.notes);
    bodyParts.push('');
  }

  // Unknown sections (round-trip preservation)
  if (task._unknownSections) {
    for (const { heading, content } of task._unknownSections) {
      bodyParts.push(heading);
      bodyParts.push(content);
      bodyParts.push('');
    }
  }

  const body = bodyParts.join('\n').trimEnd() + '\n';
  return matter.stringify(body, fm);
}

// ── Find project root ────────────────────────────────────────────────────────

function findProjectRoot(startDir) {
  let dir = startDir || process.cwd();
  while (dir !== path.dirname(dir)) {
    // Prefer .subframe/tasks/ directory (new format)
    if (fs.existsSync(path.join(dir, '.subframe', 'tasks')) &&
        fs.statSync(path.join(dir, '.subframe', 'tasks')).isDirectory()) {
      return dir;
    }
    // Fall back to .subframe/tasks.json (legacy format)
    if (fs.existsSync(path.join(dir, '.subframe', 'tasks.json'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return null;
}

// ── Detect format ────────────────────────────────────────────────────────────

function usesMarkdownFormat(root) {
  const tasksDir = path.join(root, '.subframe', 'tasks');
  return fs.existsSync(tasksDir) && fs.statSync(tasksDir).isDirectory();
}

// ── Read tasks from .md files ────────────────────────────────────────────────

function getTasksDir(root) {
  return path.join(root, '.subframe', 'tasks');
}

function getPrivateTasksDir(root) {
  return path.join(root, '.subframe', 'tasks', 'private');
}

function readTasksFromMd(root) {
  const tasksDir = getTasksDir(root);
  const privateDir = getPrivateTasksDir(root);
  const pending = [];
  const inProgress = [];
  const completed = [];

  if (!fs.existsSync(tasksDir)) return { pending, inProgress, completed };

  const files = fs.readdirSync(tasksDir).filter(f => f.endsWith('.md'));

  for (const file of files) {
    const filePath = path.join(tasksDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const task = parseTaskMd(content, filePath);

    if (task.status === 'in_progress') {
      inProgress.push(task);
    } else if (task.status === 'completed') {
      completed.push(task);
    } else {
      pending.push(task);
    }
  }

  // Also read private tasks
  if (fs.existsSync(privateDir)) {
    const privateFiles = fs.readdirSync(privateDir).filter(f => f.endsWith('.md'));
    for (const file of privateFiles) {
      const filePath = path.join(privateDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const task = parseTaskMd(content, filePath);
      task.private = true;

      if (task.status === 'in_progress') {
        inProgress.push(task);
      } else if (task.status === 'completed') {
        completed.push(task);
      } else {
        pending.push(task);
      }
    }
  }

  return { pending, inProgress, completed };
}

// ── Read tasks from legacy JSON ──────────────────────────────────────────────

function readTasksFromJson(root) {
  const filePath = path.join(root, '.subframe', 'tasks.json');
  const raw = fs.readFileSync(filePath, 'utf8');
  const cleaned = raw.replace(/,\s*([\]}])/g, '$1');
  const data = JSON.parse(cleaned);
  return {
    pending: data.tasks.pending || [],
    inProgress: data.tasks.inProgress || [],
    completed: data.tasks.completed || [],
    _metadata: data.metadata || data._frame_metadata || {},
  };
}

// ── Unified read ─────────────────────────────────────────────────────────────

function readTasks(root) {
  if (usesMarkdownFormat(root)) {
    return readTasksFromMd(root);
  }
  return readTasksFromJson(root);
}

// ── Write a single task .md file ─────────────────────────────────────────────

function writeTaskMd(root, task) {
  const dir = task.private ? getPrivateTasksDir(root) : getTasksDir(root);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${task.id}.md`);
  const content = serializeTaskMd(task);
  fs.writeFileSync(filePath, content);
  return filePath;
}

/**
 * Find a task's .md file across both public and private directories.
 */
function findTaskFile(root, taskId) {
  const publicPath = path.join(getTasksDir(root), `${taskId}.md`);
  if (fs.existsSync(publicPath)) return publicPath;
  const privatePath = path.join(getPrivateTasksDir(root), `${taskId}.md`);
  if (fs.existsSync(privatePath)) return privatePath;
  return null;
}

// ── Regenerate index (tasks.json) ────────────────────────────────────────────

function regenerateIndex(root, allTasks) {
  // allTasks is { pending, inProgress, completed }
  // Strip filePath, _unknownSections, and private field from index entries
  function stripInternalFields(task) {
    const copy = { ...task };
    delete copy.filePath;
    delete copy._unknownSections;
    delete copy.private;
    return copy;
  }

  // Exclude private tasks from the git-tracked index
  const publicOnly = (arr) => (arr || []).filter(t => !t.private);

  const indexData = {
    _frame_metadata: {
      purpose: 'Sub-Task tracking for the project (SubFrame\'s task system)',
      forAI: 'Auto-generated from .subframe/tasks/*.md \u2014 edit the .md files directly.',
      lastUpdated: new Date().toISOString().split('T')[0],
      generatedBy: 'SubFrame',
    },
    project: 'SubFrame',
    version: '1.2',
    lastUpdated: new Date().toISOString(),
    tasks: {
      pending: publicOnly(allTasks.pending).map(stripInternalFields),
      inProgress: publicOnly(allTasks.inProgress).map(stripInternalFields),
      completed: publicOnly(allTasks.completed).map(stripInternalFields),
    },
  };

  const indexPath = path.join(root, '.subframe', 'tasks.json');
  fs.writeFileSync(indexPath, JSON.stringify(indexData, null, 2) + '\n');
}

// ── Find task across all status groups ───────────────────────────────────────

function findTask(tasks, taskId) {
  for (const [statusKey, arr] of [['pending', tasks.pending], ['inProgress', tasks.inProgress], ['completed', tasks.completed]]) {
    const idx = arr.findIndex(t => t.id === taskId);
    if (idx !== -1) return { task: arr[idx], statusKey, index: idx };
  }
  return null;
}

// ── Status mapping ───────────────────────────────────────────────────────────

const STATUS_MAP = {
  'pending': 'pending',
  'in_progress': 'inProgress',
  'in-progress': 'inProgress',
  'inprogress': 'inProgress',
  'completed': 'completed',
  'done': 'completed',
};

function statusToKey(status) {
  return STATUS_MAP[status.toLowerCase()] || null;
}

function keyToStatus(key) {
  if (key === 'inProgress') return 'in_progress';
  return key;
}

// ── Generate task ID ─────────────────────────────────────────────────────────

function generateId() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 6);
  return `task-${ts}-${rand}`;
}

// ── Display helpers ──────────────────────────────────────────────────────────

function priorityIcon(priority) {
  if (priority === 'high') return '\u25B2';    // triangle up
  if (priority === 'low') return '\u25BD';      // triangle down
  return '\u25C7';                               // diamond (medium)
}

function statusIcon(status) {
  if (status === 'in_progress') return '\uD83D\uDD04';  // cycle
  if (status === 'completed') return '\u2705';            // check
  return '\uD83D\uDCCB';                                  // clipboard (pending)
}

function sortByPriority(tasks) {
  const p = { high: 0, medium: 1, low: 2 };
  return [...tasks].sort((a, b) => (p[a.priority] || 1) - (p[b.priority] || 1));
}

function wrapText(text, width = 70, indent = '  ') {
  if (!text) return '';
  return text.split('\n').map(paragraph => {
    if (paragraph.trim() === '') return '';
    const words = paragraph.split(/\s+/);
    const lines = [];
    let current = '';
    for (const word of words) {
      if (current && (current.length + 1 + word.length) > width) {
        lines.push(indent + current);
        current = word;
      } else {
        current = current ? current + ' ' + word : word;
      }
    }
    if (current) lines.push(indent + current);
    return lines.join('\n');
  }).join('\n');
}

function relativeTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  if (diff < 0) return 'just now';
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function progressBar(done, total, width = 20) {
  if (total === 0) return '';
  const pct = Math.round((done / total) * 100);
  const filled = Math.round((done / total) * width);
  const empty = width - filled;
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${done}/${total} (${pct}%)`;
}

// ── Commands ─────────────────────────────────────────────────────────────────

function cmdList(root, args) {
  const tasks = readTasks(root);
  const showAll = args.includes('--all');
  const showJson = args.includes('--json');

  const { pending, inProgress, completed } = tasks;

  if (showJson) {
    const result = [...inProgress, ...pending];
    if (showAll) result.push(...completed);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const total = inProgress.length + pending.length;

  if (total === 0 && (!showAll || completed.length === 0)) {
    console.log('\n\u25C6 SubFrame \u2500 No active sub-tasks.');
    return;
  }

  // Helper: append lock icon if task is private
  const pvt = (t) => t.private ? ' \uD83D\uDD12' : '';

  if (inProgress.length > 0) {
    console.log(`\n\u25C6 SubFrame \u2500 \uD83D\uDD04 In Progress (${inProgress.length})`);
    for (const t of inProgress) {
      console.log(`  ${priorityIcon(t.priority)} [${t.id}] ${t.title}${pvt(t)}`);
    }
  }

  if (pending.length > 0) {
    console.log(`\n\u25C6 SubFrame \u2500 \uD83D\uDCCB Pending (${pending.length})`);
    for (const t of sortByPriority(pending)) {
      console.log(`  ${priorityIcon(t.priority)} [${t.id}] ${t.title}${pvt(t)}`);
    }
  }

  if (showAll && completed.length > 0) {
    console.log(`\n\u25C6 SubFrame \u2500 \u2705 Completed (${completed.length})`);
    for (const t of completed) {
      console.log(`  \u2022 [${t.id}] ${t.title}${pvt(t)}`);
    }
  }

  console.log(`\n\u2500\u2500 ${inProgress.length} in progress, ${pending.length} pending` +
    (showAll ? `, ${completed.length} completed` : '') +
    ` \u2500 \u25B2 high  \u25C7 medium  \u25BD low`);
}

function cmdGet(root, taskId, args) {
  args = args || [];
  const tasks = readTasks(root);
  const found = findTask(tasks, taskId);

  if (!found) {
    console.error(`\u25C6 SubFrame \u2500 Sub-task not found: ${taskId}`);
    process.exit(1);
  }

  const t = found.task;

  // --json flag: output raw JSON and exit
  if (args.includes('--json')) {
    const output = { ...t };
    delete output.filePath;
    delete output._unknownSections;
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  // --changes flag: show chronological timeline
  if (args.includes('--changes')) {
    cmdGetChanges(t);
    return;
  }

  // ── Header ──
  const statusColor = t.status === 'completed' ? c.green
    : t.status === 'in_progress' ? c.yellow : c.dim;
  const priorityColor = t.priority === 'high' ? c.red
    : t.priority === 'low' ? c.dim : s => s;

  console.log('');
  console.log(`\u25C6 SubFrame \u2500 ${statusIcon(t.status)} ${c.bold(t.title)}`);
  console.log(c.dim(`  ${t.id}`));
  console.log(c.dim('\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500'));

  // ── Status bar ──
  const statusLabel = t.status.replace('_', ' ');
  const parts = [
    `Status: ${statusColor('\u25CF ' + statusLabel)}`,
    `Priority: ${priorityColor(priorityIcon(t.priority) + ' ' + t.priority)}`,
  ];
  if (t.category) parts.push(`Category: ${t.category}`);
  if (t.private) parts.push(`${c.yellow('\uD83D\uDD12 Private')}`);
  console.log(`  ${parts.join('  \u2502  ')}`);

  // ── Context ──
  if (t.context) {
    console.log(`  ${c.dim(t.context)}`);
  }

  // ── Dependencies ──
  if ((t.blockedBy && t.blockedBy.length > 0) || (t.blocks && t.blocks.length > 0)) {
    console.log('');
    if (t.blockedBy && t.blockedBy.length > 0) {
      const resolved = t.blockedBy.map(id => {
        const dep = findTask(tasks, id);
        return dep ? `${c.red(id)} ${c.dim(dep.task.title)}` : c.red(id);
      });
      console.log(`  ${c.red('\u2298')} Blocked by: ${resolved.join(', ')}`);
    }
    if (t.blocks && t.blocks.length > 0) {
      const resolved = t.blocks.map(id => {
        const dep = findTask(tasks, id);
        return dep ? `${c.cyan(id)} ${c.dim(dep.task.title)}` : c.cyan(id);
      });
      console.log(`  ${c.cyan('\u2192')} Blocks: ${resolved.join(', ')}`);
    }
  }

  // ── Description ──
  if (t.description) {
    console.log('');
    console.log(c.dim('  \u2500\u2500 Description \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500'));
    console.log(wrapText(t.description));
  }

  // ── User Request ──
  if (t.userRequest) {
    console.log('');
    console.log(c.dim('  \u2500\u2500 User Request \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500'));
    console.log(wrapText(t.userRequest));
  }

  // ── Acceptance Criteria ──
  if (t.acceptanceCriteria) {
    console.log('');
    console.log(c.dim('  \u2500\u2500 Acceptance Criteria \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500'));
    console.log(wrapText(t.acceptanceCriteria));
  }

  // ── Notes ──
  if (t.notes) {
    console.log('');
    console.log(c.dim('  \u2500\u2500 Notes \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500'));
    // Split notes by date entries for readability
    const noteBlocks = t.notes.split(/(?=\[\d{4}-\d{2}-\d{2}\])/);
    for (const block of noteBlocks) {
      const trimmed = block.trim();
      if (!trimmed) continue;
      const dateMatch = trimmed.match(/^\[(\d{4}-\d{2}-\d{2})\]\s*(.*)/s);
      if (dateMatch) {
        console.log(`  ${c.dim(dateMatch[1])}  ${wrapText(dateMatch[2]).trimStart()}`);
      } else {
        console.log(wrapText(trimmed));
      }
    }
  }

  // ── Steps ──
  if (t.steps && t.steps.length > 0) {
    const done = t.steps.filter(s => s.completed).length;
    console.log('');
    console.log(c.dim('  \u2500\u2500 Steps \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500'));
    console.log(`  ${progressBar(done, t.steps.length)}`);
    for (let i = 0; i < t.steps.length; i++) {
      const s = t.steps[i];
      if (s.completed) {
        console.log(`  ${c.green('\u2713')} ${c.dim(s.label)}`);
      } else if (i === done) {
        // Current step (first uncompleted)
        console.log(`  ${c.yellow('\u25CF')} ${s.label}`);
      } else {
        console.log(`  ${c.dim('\u25CB')} ${c.dim(s.label)}`);
      }
    }
  }

  // ── Timestamps ──
  console.log('');
  console.log(c.dim('\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500'));
  const timeParts = [`Created ${relativeTime(t.createdAt)} ${c.dim('(' + t.createdAt + ')')}`];
  if (t.updatedAt !== t.createdAt) {
    timeParts.push(`Updated ${relativeTime(t.updatedAt)} ${c.dim('(' + t.updatedAt + ')')}`);
  }
  if (t.completedAt) {
    timeParts.push(`${c.green('Done')} ${relativeTime(t.completedAt)} ${c.dim('(' + t.completedAt + ')')}`);
  }
  console.log(`  ${timeParts.join('  \u00B7  ')}`);

  // ── File path ──
  if (t.filePath) {
    console.log(`  ${c.dim(t.filePath)}`);
  }

  // ── Action hints ──
  console.log('');
  if (t.status === 'pending') {
    console.log(c.dim(`  \u2192 start ${t.id}`));
  } else if (t.status === 'in_progress') {
    console.log(c.dim(`  \u2192 complete ${t.id}  \u2502  update ${t.id} --add-note "..."`));
  } else if (t.status === 'completed') {
    console.log(c.dim(`  \u2192 update ${t.id} --status pending  (reopen)`));
  }
}

function cmdGetChanges(t) {
  console.log('');
  console.log(`\u25C6 SubFrame \u2500 ${c.bold(t.title)}`);
  console.log(c.dim(`  ${t.id} \u2014 Change Timeline`));
  console.log(c.dim('\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500'));

  const events = [];

  // Created event
  if (t.createdAt) {
    events.push({ date: t.createdAt, icon: '\uD83D\uDCCB', label: 'Created', color: c.dim });
  }

  // Parse notes for dated entries
  if (t.notes) {
    const noteBlocks = t.notes.split(/(?=\[\d{4}-\d{2}-\d{2}\])/);
    for (const block of noteBlocks) {
      const match = block.trim().match(/^\[(\d{4}-\d{2}-\d{2})\]\s*(.*)/s);
      if (match) {
        const noteDate = new Date(match[1]).toISOString();
        const preview = match[2].length > 80 ? match[2].substring(0, 77) + '...' : match[2];
        events.push({ date: noteDate, icon: '\uD83D\uDCDD', label: `Note: "${preview}"`, color: s => s });
      } else if (block.trim()) {
        // Undated note — attach to updatedAt as best guess
        const preview = block.trim().length > 80 ? block.trim().substring(0, 77) + '...' : block.trim();
        events.push({ date: t.updatedAt || t.createdAt, icon: '\uD83D\uDCDD', label: `Note: "${preview}"`, color: c.dim });
      }
    }
  }

  // Completed event
  if (t.completedAt) {
    events.push({ date: t.completedAt, icon: '\u2705', label: 'Completed', color: c.green });
  }

  // If currently in progress and not completed, show started
  if (t.status === 'in_progress' && !t.completedAt && t.updatedAt !== t.createdAt) {
    events.push({ date: t.updatedAt, icon: '\uD83D\uDD04', label: 'Started', color: c.yellow });
  }

  // Sort by date
  events.sort((a, b) => new Date(a.date) - new Date(b.date));

  for (const evt of events) {
    const dateStr = evt.date.split('T')[0];
    const rel = relativeTime(evt.date);
    console.log(`  ${c.dim(dateStr)}  ${evt.icon} ${evt.color(evt.label)}  ${c.dim(rel)}`);
  }

  if (events.length === 0) {
    console.log(c.dim('  No timeline events found.'));
  }

  console.log('');
}

function cmdStart(root, taskId) {
  const tasks = readTasks(root);
  const found = findTask(tasks, taskId);

  if (!found) {
    console.error(`\u25C6 SubFrame \u2500 Sub-task not found: ${taskId}`);
    process.exit(1);
  }

  if (found.statusKey === 'inProgress') {
    console.log(`\u25C6 SubFrame \u2500 Already in progress: [${taskId}]`);
    return;
  }

  if (found.statusKey === 'completed') {
    console.error(`\u25C6 SubFrame \u2500 Already completed. Reopen first: update ${taskId} --status pending`);
    process.exit(1);
  }

  const task = found.task;
  task.status = 'in_progress';
  task.updatedAt = new Date().toISOString();

  if (usesMarkdownFormat(root)) {
    writeTaskMd(root, task);
    // Move task between arrays for index regeneration
    tasks.pending.splice(found.index, 1);
    tasks.inProgress.push(task);
    regenerateIndex(root, tasks);
  } else {
    // Legacy JSON mode
    const data = readLegacyJsonRaw(root);
    const legacyFound = findTaskInLegacy(data, taskId);
    if (legacyFound) {
      data.tasks[legacyFound.status].splice(legacyFound.index, 1);
      legacyFound.task.status = 'in_progress';
      legacyFound.task.updatedAt = new Date().toISOString();
      if (!data.tasks.inProgress) data.tasks.inProgress = [];
      data.tasks.inProgress.push(legacyFound.task);
      data.lastUpdated = new Date().toISOString();
      const filePath = path.join(root, '.subframe', 'tasks.json');
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
    }
  }

  console.log(`\u25C6 SubFrame \u2500 \uD83D\uDD04 Started: [${taskId}] ${task.title}`);
}

function cmdComplete(root, taskId) {
  const tasks = readTasks(root);
  const found = findTask(tasks, taskId);

  if (!found) {
    console.error(`\u25C6 SubFrame \u2500 Sub-task not found: ${taskId}`);
    process.exit(1);
  }

  if (found.statusKey === 'completed') {
    console.log(`\u25C6 SubFrame \u2500 Already completed: [${taskId}]`);
    return;
  }

  const task = found.task;
  const now = new Date().toISOString();
  task.status = 'completed';
  task.updatedAt = now;
  task.completedAt = now;

  if (usesMarkdownFormat(root)) {
    writeTaskMd(root, task);
    // Move task between arrays for index regeneration
    tasks[found.statusKey].splice(found.index, 1);
    tasks.completed.push(task);
    regenerateIndex(root, tasks);
  } else {
    // Legacy JSON mode
    const data = readLegacyJsonRaw(root);
    const legacyFound = findTaskInLegacy(data, taskId);
    if (legacyFound) {
      data.tasks[legacyFound.status].splice(legacyFound.index, 1);
      legacyFound.task.status = 'completed';
      legacyFound.task.updatedAt = now;
      legacyFound.task.completedAt = now;
      if (!data.tasks.completed) data.tasks.completed = [];
      data.tasks.completed.push(legacyFound.task);
      if (data.metadata) {
        data.metadata.totalCompleted = (data.metadata.totalCompleted || 0) + 1;
      }
      data.lastUpdated = now;
      const filePath = path.join(root, '.subframe', 'tasks.json');
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
    }
  }

  console.log(`\u25C6 SubFrame \u2500 \u2705 Completed: [${taskId}] ${task.title}`);
}

function cmdAdd(root, args) {
  // Parse named arguments (--add-step can appear multiple times, --private is a flag)
  const opts = {};
  const stepLabels = [];
  let isPrivate = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--private') {
      isPrivate = true;
    } else if (args[i].startsWith('--') && i + 1 < args.length) {
      const key = args[i].substring(2);
      if (key === 'add-step') {
        stepLabels.push(args[++i]);
      } else {
        opts[key] = args[++i];
      }
    }
  }

  if (!opts.title) {
    console.error('\u25C6 SubFrame \u2500 Required: --title "Task title"');
    process.exit(1);
  }

  const now = new Date().toISOString();
  const taskId = opts.id || generateId();

  // Parse comma-separated IDs for blockedBy and blocks
  const blockedBy = opts['blocked-by'] ? opts['blocked-by'].split(',').map(s => s.trim()).filter(Boolean) : [];
  const blocks = opts['blocks'] ? opts['blocks'].split(',').map(s => s.trim()).filter(Boolean) : [];

  const task = {
    id: taskId,
    title: opts.title,
    description: opts.description || '',
    userRequest: opts.userRequest || opts['user-request'] || undefined,
    acceptanceCriteria: opts.acceptanceCriteria || opts['acceptance-criteria'] || undefined,
    notes: opts.notes || undefined,
    status: 'pending',
    priority: opts.priority || 'medium',
    category: opts.category || 'feature',
    context: opts.context || `Session ${now.split('T')[0]}`,
    private: isPrivate || undefined,
    blockedBy,
    blocks,
    steps: stepLabels.map(label => ({ label, completed: false })),
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  };

  if (usesMarkdownFormat(root)) {
    writeTaskMd(root, task);
    // Regenerate index
    const tasks = readTasksFromMd(root);
    regenerateIndex(root, tasks);
  } else {
    // Legacy JSON mode
    const data = readLegacyJsonRaw(root);
    if (!data.tasks.pending) data.tasks.pending = [];
    data.tasks.pending.push(task);
    if (data.metadata) {
      data.metadata.totalCreated = (data.metadata.totalCreated || 0) + 1;
    }
    data.lastUpdated = now;
    const filePath = path.join(root, '.subframe', 'tasks.json');
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
  }

  console.log(`\u25C6 SubFrame \u2500 \u2795 Added: [${task.id}] ${task.title}`);
}

function cmdUpdate(root, taskId, args) {
  const tasks = readTasks(root);
  const found = findTask(tasks, taskId);

  if (!found) {
    console.error(`\u25C6 SubFrame \u2500 Sub-task not found: ${taskId}`);
    process.exit(1);
  }

  // Parse named arguments (--private and --public are boolean flags)
  const opts = {};
  let privateFlag = undefined; // undefined = no change
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--private') {
      privateFlag = true;
    } else if (args[i] === '--public') {
      privateFlag = false;
    } else if (args[i].startsWith('--') && i + 1 < args.length) {
      opts[args[i].substring(2)] = args[++i];
    }
  }

  const task = found.task;
  const now = new Date().toISOString();

  // Handle status change
  if (opts.status) {
    const newKey = statusToKey(opts.status);
    if (!newKey) {
      console.error(`\u25C6 SubFrame \u2500 Invalid status: ${opts.status}. Use: pending, in_progress, completed`);
      process.exit(1);
    }

    const newStatus = keyToStatus(newKey);

    if (newKey !== found.statusKey) {
      // Move task between arrays
      tasks[found.statusKey].splice(found.index, 1);
      task.status = newStatus;
      if (newKey === 'completed') {
        task.completedAt = now;
      }
      tasks[newKey].push(task);
    } else {
      task.status = newStatus;
    }
  }

  // Apply other field updates
  const allowedFields = ['title', 'description', 'userRequest', 'user-request',
    'acceptanceCriteria', 'acceptance-criteria', 'notes', 'priority', 'category', 'context'];
  for (const field of allowedFields) {
    if (opts[field] !== undefined) {
      const key = field.includes('-') ? field.replace(/-([a-z])/g, (_, c) => c.toUpperCase()) : field;
      task[key] = opts[field];
    }
  }

  // Handle --blocked-by and --blocks
  if (opts['blocked-by'] !== undefined) {
    task.blockedBy = opts['blocked-by'].split(',').map(s => s.trim()).filter(Boolean);
  }
  if (opts['blocks'] !== undefined) {
    task.blocks = opts['blocks'].split(',').map(s => s.trim()).filter(Boolean);
  }

  // Append to notes if --add-note is used
  if (opts['add-note']) {
    task.notes = task.notes
      ? `${task.notes}\n[${now.split('T')[0]}] ${opts['add-note']}`
      : `[${now.split('T')[0]}] ${opts['add-note']}`;
  }

  // Add a new step
  if (opts['add-step']) {
    if (!task.steps) task.steps = [];
    task.steps.push({ completed: false, label: opts['add-step'] });
  }

  // Complete a step by index (0-based)
  if (opts['complete-step'] !== undefined) {
    const stepIdx = parseInt(opts['complete-step'], 10);
    if (!task.steps || stepIdx < 0 || stepIdx >= task.steps.length) {
      console.error(`\u25C6 SubFrame \u2500 Invalid step index: ${opts['complete-step']}. Task has ${(task.steps || []).length} steps.`);
      process.exit(1);
    }
    task.steps[stepIdx].completed = true;
  }

  // Handle --private / --public toggle
  if (privateFlag !== undefined) {
    const wasPrivate = !!task.private;
    const isNowPrivate = privateFlag;

    if (wasPrivate !== isNowPrivate) {
      // Remove old file before writing to new location
      const oldPath = task.filePath || findTaskFile(root, taskId);
      if (oldPath && fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
      task.private = isNowPrivate || undefined;
    }
  }

  task.updatedAt = now;

  if (usesMarkdownFormat(root)) {
    writeTaskMd(root, task);
    // Re-read to ensure index reflects moved files
    const freshTasks = readTasksFromMd(root);
    regenerateIndex(root, freshTasks);
  } else {
    // Legacy JSON mode
    const data = readLegacyJsonRaw(root);
    // Re-find in raw data to update in place
    const legacyFound = findTaskInLegacy(data, taskId);
    if (legacyFound) {
      // Replace task data
      Object.assign(legacyFound.task, task);
      // Handle status move if needed
      const newKey = statusToKey(task.status) || found.statusKey;
      if (newKey !== legacyFound.status) {
        data.tasks[legacyFound.status].splice(legacyFound.index, 1);
        if (!data.tasks[newKey]) data.tasks[newKey] = [];
        data.tasks[newKey].push(legacyFound.task);
      }
      data.lastUpdated = now;
      const filePath = path.join(root, '.subframe', 'tasks.json');
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
    }
  }

  console.log(`\u25C6 SubFrame \u2500 \u270F\uFE0F Updated: [${taskId}] ${task.title}`);
}

function cmdOpen(root, taskId) {
  if (!usesMarkdownFormat(root)) {
    console.error(`\u25C6 SubFrame \u2500 Project uses legacy tasks.json format. Run migration first.`);
    process.exit(1);
  }

  const filePath = findTaskFile(root, taskId);
  if (!filePath) {
    console.error(`\u25C6 SubFrame \u2500 File not found for: ${taskId}`);
    process.exit(1);
  }

  console.log(path.resolve(filePath));
}

function cmdArchive(root) {
  const tasks = readTasks(root);
  const completed = tasks.completed || [];

  if (completed.length === 0) {
    console.log('\u25C6 SubFrame \u2500 No completed sub-tasks to archive.');
    return;
  }

  const year = new Date().getFullYear().toString();

  if (usesMarkdownFormat(root)) {
    // Move .md files to .subframe/tasks/archive/YYYY/
    const archiveDir = path.join(getTasksDir(root), 'archive', year);
    fs.mkdirSync(archiveDir, { recursive: true });

    let count = 0;
    for (const task of completed) {
      const srcPath = findTaskFile(root, task.id);
      const destPath = path.join(archiveDir, `${task.id}.md`);
      if (srcPath && fs.existsSync(srcPath)) {
        fs.renameSync(srcPath, destPath);
        count++;
      }
    }

    // Regenerate index without archived tasks
    const remaining = readTasksFromMd(root);
    regenerateIndex(root, remaining);

    console.log(`\u25C6 SubFrame \u2500 \uD83D\uDCC1 Archived ${count} sub-task(s) \u2192 .subframe/tasks/archive/${year}/`);
  } else {
    // Legacy JSON mode — archive to JSON files
    const archiveDir = path.join(root, '.subframe', 'tasks', 'archive');
    fs.mkdirSync(archiveDir, { recursive: true });

    const archivePath = path.join(archiveDir, `${year}.json`);
    let archive = [];
    if (fs.existsSync(archivePath)) {
      try {
        archive = JSON.parse(fs.readFileSync(archivePath, 'utf8'));
      } catch {
        archive = [];
      }
    }

    archive.push(...completed);
    fs.writeFileSync(archivePath, JSON.stringify(archive, null, 2) + '\n');

    // Clear completed from JSON
    const data = readLegacyJsonRaw(root);
    const count = (data.tasks.completed || []).length;
    data.tasks.completed = [];
    data.lastUpdated = new Date().toISOString();
    const filePath = path.join(root, '.subframe', 'tasks.json');
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');

    console.log(`\u25C6 SubFrame \u2500 \uD83D\uDCC1 Archived ${count} sub-task(s) \u2192 .subframe/tasks/archive/${year}.json`);
  }
}

// ── Legacy JSON helpers ──────────────────────────────────────────────────────

function readLegacyJsonRaw(root) {
  const filePath = path.join(root, '.subframe', 'tasks.json');
  const raw = fs.readFileSync(filePath, 'utf8');
  const cleaned = raw.replace(/,\s*([\]}])/g, '$1');
  return JSON.parse(cleaned);
}

function findTaskInLegacy(data, taskId) {
  for (const status of ['pending', 'inProgress', 'completed']) {
    const arr = data.tasks[status] || [];
    const idx = arr.findIndex(t => t.id === taskId);
    if (idx !== -1) return { task: arr[idx], status, index: idx };
  }
  return null;
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '--help' || command === '-h') {
    console.log(`\u25C6 SubFrame Sub-Task CLI

  list [--all] [--json]   Show active sub-tasks
  get <id> [--json|--changes]   Full sub-task details (or JSON/timeline view)
  start <id>              \uD83D\uDCCB \u2192 \uD83D\uDD04 pending \u2192 in_progress
  complete <id>           \uD83D\uDD04 \u2192 \u2705 \u2192 completed
  add --title "..."       Create a new sub-task
  update <id> [options]   Update sub-task fields
  open <id>               Print absolute path to the .md file
  archive                 Move completed to archive

Options (add/update):
  --title, --description, --user-request, --acceptance-criteria
  --notes, --add-note, --priority, --category, --status, --context
  --id (add only), --blocked-by <ids>, --blocks <ids> (comma-separated)
  --add-step "label", --complete-step <index> (0-based)
  --private (add: create as private, update: make private)
  --public  (update: make public — removes private flag)`);
    return;
  }

  const root = findProjectRoot();
  if (!root) {
    console.error('\u25C6 SubFrame \u2500 No .subframe/tasks/ or .subframe/tasks.json found. Is this a SubFrame project?');
    process.exit(1);
  }

  switch (command) {
    case 'list':
    case 'ls':
      cmdList(root, args.slice(1));
      break;
    case 'get':
    case 'show':
      if (!args[1]) { console.error('\u25C6 SubFrame \u2500 Usage: task.js get <id> [--json] [--changes]'); process.exit(1); }
      cmdGet(root, args[1], args.slice(2));
      break;
    case 'start':
      if (!args[1]) { console.error('\u25C6 SubFrame \u2500 Usage: task.js start <id>'); process.exit(1); }
      cmdStart(root, args[1]);
      break;
    case 'complete':
    case 'done':
      if (!args[1]) { console.error('\u25C6 SubFrame \u2500 Usage: task.js complete <id>'); process.exit(1); }
      cmdComplete(root, args[1]);
      break;
    case 'add':
    case 'new':
      cmdAdd(root, args.slice(1));
      break;
    case 'update':
      if (!args[1]) { console.error('\u25C6 SubFrame \u2500 Usage: task.js update <id> [options]'); process.exit(1); }
      cmdUpdate(root, args[1], args.slice(2));
      break;
    case 'open':
      if (!args[1]) { console.error('\u25C6 SubFrame \u2500 Usage: task.js open <id>'); process.exit(1); }
      cmdOpen(root, args[1]);
      break;
    case 'archive':
      cmdArchive(root);
      break;
    default:
      console.error(`\u25C6 SubFrame \u2500 Unknown command: ${command}. Run with --help for usage.`);
      process.exit(1);
  }
}

main();
