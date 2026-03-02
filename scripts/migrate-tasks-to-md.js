#!/usr/bin/env node
/**
 * SubFrame Task Migration: tasks.json -> individual .md files
 *
 * Reads the existing .subframe/tasks.json, creates .subframe/tasks/ directory,
 * and writes each task as an individual markdown file with YAML frontmatter.
 * Then regenerates tasks.json as a v1.2 index.
 *
 * Safe to run multiple times (idempotent):
 * - Skips tasks whose .md files already exist
 * - Only backs up tasks.json if no backup exists yet
 *
 * Usage:
 *   node scripts/migrate-tasks-to-md.js
 */

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

// ── CJS Markdown Serializer ─────────────────────────────────────────────────
// Duplicated from src/main/taskMarkdownParser.ts (CJS, no TS imports).

const SECTION_STEPS = '## Steps';
const SECTION_USER_REQUEST = '## User Request';
const SECTION_ACCEPTANCE = '## Acceptance Criteria';
const SECTION_NOTES = '## Notes';

/**
 * Serialize a task object to markdown with YAML frontmatter.
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

  const body = bodyParts.join('\n').trimEnd() + '\n';
  return matter.stringify(body, fm);
}

// ── Find project root ────────────────────────────────────────────────────────

function findProjectRoot(startDir) {
  let dir = startDir || process.cwd();
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.subframe', 'tasks.json'))) return dir;
    dir = path.dirname(dir);
  }
  return null;
}

// ── Status key to status value mapping ───────────────────────────────────────

function keyToStatus(key) {
  if (key === 'inProgress') return 'in_progress';
  return key; // 'pending' and 'completed' are the same
}

// ── Regenerate index ─────────────────────────────────────────────────────────

function regenerateIndex(root, allTasks) {
  function stripInternalFields(task) {
    const copy = { ...task };
    delete copy.filePath;
    delete copy._unknownSections;
    return copy;
  }

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
      pending: (allTasks.pending || []).map(stripInternalFields),
      inProgress: (allTasks.inProgress || []).map(stripInternalFields),
      completed: (allTasks.completed || []).map(stripInternalFields),
    },
  };

  const indexPath = path.join(root, '.subframe', 'tasks.json');
  fs.writeFileSync(indexPath, JSON.stringify(indexData, null, 2) + '\n');
}

// ── Main migration ───────────────────────────────────────────────────────────

function migrate() {
  const root = findProjectRoot();
  if (!root) {
    console.error('\u25C6 SubFrame \u2500 No .subframe/tasks.json found. Nothing to migrate.');
    process.exit(1);
  }

  const tasksJsonPath = path.join(root, '.subframe', 'tasks.json');
  const tasksDir = path.join(root, '.subframe', 'tasks');
  const backupPath = path.join(root, '.subframe', 'tasks.json.pre-migration-backup');

  // Step 1: Read existing tasks.json
  console.log(`\u25C6 SubFrame \u2500 Reading ${tasksJsonPath}`);
  const raw = fs.readFileSync(tasksJsonPath, 'utf8');
  const cleaned = raw.replace(/,\s*([\]}])/g, '$1');
  const data = JSON.parse(cleaned);

  // Step 2: Backup (only if no backup exists yet — idempotent)
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(tasksJsonPath, backupPath);
    console.log(`\u25C6 SubFrame \u2500 Backed up to ${path.relative(root, backupPath)}`);
  } else {
    console.log(`\u25C6 SubFrame \u2500 Backup already exists, skipping backup step.`);
  }

  // Step 3: Create tasks directory
  fs.mkdirSync(tasksDir, { recursive: true });

  // Step 4: Collect all tasks across status groups, adding new fields
  const statusGroups = ['pending', 'inProgress', 'completed'];
  const allTasks = { pending: [], inProgress: [], completed: [] };
  let totalWritten = 0;
  let totalSkipped = 0;

  for (const groupKey of statusGroups) {
    const arr = data.tasks[groupKey] || [];
    for (const rawTask of arr) {
      // Normalize status: JSON uses the groupKey to imply status
      // but the task object may have a different or missing status field
      const normalizedStatus = keyToStatus(groupKey);

      // Build the task with all required fields, adding defaults for new ones
      const task = {
        id: rawTask.id,
        title: rawTask.title || '',
        description: rawTask.description || '',
        userRequest: rawTask.userRequest || undefined,
        acceptanceCriteria: rawTask.acceptanceCriteria || undefined,
        notes: rawTask.notes || undefined,
        status: normalizedStatus,
        priority: rawTask.priority || 'medium',
        category: rawTask.category || 'feature',
        context: rawTask.context || undefined,
        blockedBy: Array.isArray(rawTask.blockedBy) ? rawTask.blockedBy : [],
        blocks: Array.isArray(rawTask.blocks) ? rawTask.blocks : [],
        steps: Array.isArray(rawTask.steps) ? rawTask.steps : [],
        createdAt: rawTask.createdAt || new Date().toISOString(),
        updatedAt: rawTask.updatedAt || new Date().toISOString(),
        completedAt: rawTask.completedAt || null,
      };

      // Write .md file (skip if it already exists — idempotent)
      const mdPath = path.join(tasksDir, `${task.id}.md`);
      if (fs.existsSync(mdPath)) {
        console.log(`  \u2022 Skipped (exists): ${task.id}.md`);
        totalSkipped++;
      } else {
        const content = serializeTaskMd(task);
        fs.writeFileSync(mdPath, content);
        console.log(`  \u2795 Created: ${task.id}.md [${normalizedStatus}]`);
        totalWritten++;
      }

      // Add to grouped collection for index regeneration
      allTasks[groupKey].push(task);
    }
  }

  // Step 5: Regenerate tasks.json as v1.2 index
  regenerateIndex(root, allTasks);
  console.log(`\u25C6 SubFrame \u2500 Regenerated tasks.json as v1.2 index`);

  // Summary
  console.log(`\n\u25C6 SubFrame \u2500 Migration complete.`);
  console.log(`  ${totalWritten} .md file(s) created, ${totalSkipped} skipped (already existed).`);
  console.log(`  ${allTasks.pending.length} pending, ${allTasks.inProgress.length} in progress, ${allTasks.completed.length} completed.`);
  console.log(`  Backup: ${path.relative(root, backupPath)}`);
  console.log(`  Index:  .subframe/tasks.json (v1.2 — auto-generated)`);
}

migrate();
