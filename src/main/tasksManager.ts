/**
 * Tasks Manager Module
 * Handles task CRUD operations for SubFrame projects.
 *
 * Phase 2: Tasks are stored as individual .md files in .subframe/tasks/
 * with YAML frontmatter. The tasks.json file is a generated index.
 * Falls back to reading tasks.json directly for backward compatibility.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { BrowserWindow, IpcMain } from 'electron';
import { IPC, type Task } from '../shared/ipcChannels';
import { FRAME_FILES, FRAME_TASKS_DIR } from '../shared/frameConstants';
import { parseTaskMarkdown, serializeTaskMarkdown } from './taskMarkdownParser';

interface TasksData {
  _frame_metadata?: {
    purpose: string;
    forAI: string;
    lastUpdated: string;
    generatedBy: string;
  };
  project: string;
  version: string;
  lastUpdated: string;
  taskSchema: Record<string, string>;
  tasks: {
    pending: Task[];
    inProgress: Task[];
    completed: Task[];
  };
  metadata: {
    totalCreated: number;
    totalCompleted: number;
  };
  [key: string]: unknown;
}

let mainWindow: BrowserWindow | null = null;
let currentProjectPath: string | null = null;
let tasksWatcher: fs.FSWatcher | null = null;
let watchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastWatchedHash: string | null = null; // Dedup: skip sending unchanged data

/**
 * Initialize tasks manager
 */
function init(window: BrowserWindow): void {
  mainWindow = window;
}

/**
 * Set current project path
 */
function setProjectPath(projectPath: string): void {
  currentProjectPath = projectPath;
}

/**
 * Get the .subframe/tasks/ directory for a project
 */
function getTasksDir(projectPath?: string): string {
  return path.join(projectPath || currentProjectPath || '', FRAME_TASKS_DIR);
}

/**
 * Get the full path for a task's markdown file
 */
function getTaskFilePath(projectPath: string, taskId: string): string {
  return path.join(projectPath, FRAME_TASKS_DIR, `${taskId}.md`);
}

/**
 * Get tasks.json file path for a project (for index / backward compat)
 */
function getTasksJsonPath(projectPath?: string): string {
  return path.join(projectPath || currentProjectPath || '', FRAME_FILES.TASKS);
}

/**
 * Ensure the .subframe/tasks/ directory exists
 */
function ensureTasksDir(projectPath: string): void {
  const dir = getTasksDir(projectPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Map task status to the grouped key used in TasksData
 */
function statusToGroupKey(status: string): 'pending' | 'inProgress' | 'completed' {
  if (status === 'in_progress') return 'inProgress';
  if (status === 'completed') return 'completed';
  return 'pending';
}

/**
 * Generate unique task ID
 */
function generateTaskId(): string {
  return `task-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Compute a content fingerprint for watcher deduplication.
 * Based on task IDs, statuses, and individual updatedAt values
 * (which come from .md files and are stable unless the task actually changes).
 */
function computeTasksFingerprint(tasksData: TasksData): string {
  const { tasks } = tasksData;
  return [
    ...tasks.pending.map((t) => `${t.id}:${t.status}:${t.updatedAt}`),
    ...tasks.inProgress.map((t) => `${t.id}:${t.status}:${t.updatedAt}`),
    ...tasks.completed.map((t) => `${t.id}:${t.status}:${t.updatedAt}`),
  ]
    .sort()
    .join('|');
}

/**
 * Strip internal/renderer-only properties from tasks before writing the index.
 * `filePath` leaks absolute local paths; `_unknownSections` is parser-internal.
 */
function stripInternalFields(tasks: Task[]): Task[] {
  return tasks.map((t) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { filePath, ...rest } = t;
    // Remove parser-internal _unknownSections if present
    if ('_unknownSections' in rest) {
      delete (rest as any)._unknownSections;
    }
    return rest;
  });
}

/**
 * Derive the project name from the project path
 */
function getProjectName(projectPath: string): string {
  return path.basename(projectPath);
}

/**
 * Build the TasksData structure from an array of tasks
 */
function buildTasksData(projectPath: string, allTasks: Task[]): TasksData {
  const grouped: TasksData['tasks'] = { pending: [], inProgress: [], completed: [] };

  for (const task of allTasks) {
    const key = statusToGroupKey(task.status);
    grouped[key].push(task);
  }

  return {
    _frame_metadata: {
      purpose: "Sub-Task tracking index (SubFrame's task system)",
      forAI:
        'Auto-generated from .subframe/tasks/*.md \u2014 edit the .md files directly.',
      lastUpdated: new Date().toISOString().slice(0, 10),
      generatedBy: 'SubFrame',
    },
    project: getProjectName(projectPath),
    version: '1.2',
    lastUpdated: new Date().toISOString(),
    taskSchema: {
      _comment: 'This schema shows the expected structure for each task',
      id: 'unique-id (task-xxx format)',
      title: 'Short actionable title (max 60 chars)',
      description:
        "Claude's detailed explanation - what, how, which files affected",
      userRequest: 'Original user prompt/request - copy verbatim',
      acceptanceCriteria:
        'When is this task done? Concrete testable criteria',
      notes:
        'Discussion notes, alternatives considered, dependencies (optional)',
      status: 'pending | in_progress | completed',
      priority: 'high | medium | low',
      category: 'feature | fix | refactor | docs | test',
      context: 'Session date and context',
      blockedBy: 'Array of task IDs this task is blocked by',
      blocks: 'Array of task IDs this task blocks',
      steps: 'Array of { label, completed } step objects',
      createdAt: 'ISO timestamp',
      updatedAt: 'ISO timestamp',
      completedAt: 'ISO timestamp | null',
    },
    tasks: grouped,
    metadata: {
      totalCreated:
        grouped.pending.length +
        grouped.inProgress.length +
        grouped.completed.length,
      totalCompleted: grouped.completed.length,
    },
  };
}

/**
 * Load tasks from individual .md files in .subframe/tasks/.
 * Falls back to tasks.json if the directory doesn't exist (backward compat).
 */
function loadTasks(projectPath?: string): TasksData | null {
  const resolvedPath = projectPath || currentProjectPath || '';
  const tasksDir = getTasksDir(resolvedPath);

  // ── Primary path: read individual .md files ─────────────────────────────
  if (fs.existsSync(tasksDir)) {
    try {
      const files = fs.readdirSync(tasksDir).filter((f) => f.endsWith('.md'));
      const allTasks: Task[] = [];

      for (const file of files) {
        const filePath = path.join(tasksDir, file);
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const task = parseTaskMarkdown(content, filePath);
          allTasks.push(task);
        } catch (err) {
          console.error(
            `Error parsing task file ${filePath}:`,
            (err as Error).message
          );
        }
      }

      return buildTasksData(resolvedPath, allTasks);
    } catch (err) {
      console.error(
        'Error reading tasks directory:',
        (err as Error).message
      );
    }
  }

  // ── Fallback: read tasks.json (backward compat) ─────────────────────────
  const tasksJsonPath = getTasksJsonPath(resolvedPath);
  try {
    if (fs.existsSync(tasksJsonPath)) {
      const raw = fs.readFileSync(tasksJsonPath, 'utf8');
      // Strip trailing commas before closing brackets/braces (common hand-edit mistake)
      const cleaned = raw.replace(/,\s*([\]}])/g, '$1');
      const data = JSON.parse(cleaned) as TasksData;

      // Augment every task with default values for new fields
      for (const status of ['pending', 'inProgress', 'completed'] as const) {
        if (data.tasks?.[status]) {
          data.tasks[status] = data.tasks[status].map((task) => ({
            ...task,
            blockedBy: task.blockedBy ?? [],
            blocks: task.blocks ?? [],
            steps: task.steps ?? [],
          }));
        }
      }

      return data;
    }
  } catch (err) {
    console.error(
      'Error loading tasks from',
      tasksJsonPath,
      ':',
      (err as Error).message
    );
  }

  return null;
}

/**
 * Regenerate the tasks.json index file from the current in-memory data.
 */
function regenerateIndex(projectPath: string, tasksData: TasksData): boolean {
  const tasksJsonPath = getTasksJsonPath(projectPath);

  try {
    // Build a clean copy for the index — don't mutate the caller's object
    const indexData: TasksData = {
      ...tasksData,
      lastUpdated: new Date().toISOString(),
      _frame_metadata: {
        purpose: "Sub-Task tracking index (SubFrame's task system)",
        forAI:
          'Auto-generated from .subframe/tasks/*.md \u2014 edit the .md files directly.',
        lastUpdated: new Date().toISOString().slice(0, 10),
        generatedBy: 'SubFrame',
      },
      version: '1.2',
      project: getProjectName(projectPath),
      // Strip internal fields (filePath, _unknownSections) from index tasks
      tasks: {
        pending: stripInternalFields(tasksData.tasks.pending),
        inProgress: stripInternalFields(tasksData.tasks.inProgress),
        completed: stripInternalFields(tasksData.tasks.completed),
      },
      metadata: {
        totalCreated:
          tasksData.tasks.pending.length +
          tasksData.tasks.inProgress.length +
          tasksData.tasks.completed.length,
        totalCompleted: tasksData.tasks.completed.length,
      },
    };

    fs.writeFileSync(
      tasksJsonPath,
      JSON.stringify(indexData, null, 2),
      'utf8'
    );
    return true;
  } catch (err) {
    console.error('Error regenerating tasks index:', err);
    return false;
  }
}

/**
 * Add a new task — writes a .md file, then regenerates the index.
 */
function addTask(projectPath: string, task: Partial<Task>): Task | null {
  ensureTasksDir(projectPath);

  const newTask: Task = {
    id: generateTaskId(),
    title: task.title || 'Untitled Task',
    description: task.description || '',
    userRequest: task.userRequest,
    acceptanceCriteria: task.acceptanceCriteria,
    notes: task.notes,
    status: 'pending',
    priority: task.priority || 'medium',
    category: task.category || 'feature',
    context: task.context || '',
    blockedBy: task.blockedBy ?? [],
    blocks: task.blocks ?? [],
    steps: task.steps ?? [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
  };

  try {
    const filePath = getTaskFilePath(projectPath, newTask.id);
    const markdown = serializeTaskMarkdown(newTask);
    fs.writeFileSync(filePath, markdown, 'utf8');

    // Regenerate index
    const tasksData = loadTasks(projectPath);
    if (tasksData) {
      regenerateIndex(projectPath, tasksData);
    }

    return newTask;
  } catch (err) {
    console.error('Error adding task:', (err as Error).message);
    return null;
  }
}

/**
 * Update an existing task — reads the .md file, merges updates, writes back,
 * then regenerates the index.
 */
function updateTask(
  projectPath: string,
  taskId: string,
  updates: Partial<Task>
): Task | null {
  const filePath = getTaskFilePath(projectPath, taskId);

  try {
    // Read the specific .md file
    if (!fs.existsSync(filePath)) {
      console.error(`Task file not found: ${filePath}`);
      return null;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const task = parseTaskMarkdown(content, filePath);

    // Merge updates
    const updatedTask: Task = {
      ...task,
      ...updates,
      id: task.id, // Never overwrite id
      updatedAt: new Date().toISOString(),
    };

    // Handle status transitions
    if (updates.status === 'completed' && task.status !== 'completed') {
      updatedTask.completedAt = new Date().toISOString();
    } else if (updates.status && updates.status !== 'completed' && task.status === 'completed') {
      // Clear completedAt when reopening a completed task
      updatedTask.completedAt = null;
    }

    // Write updated .md file back
    const markdown = serializeTaskMarkdown(updatedTask);
    fs.writeFileSync(filePath, markdown, 'utf8');

    // Regenerate index
    const tasksData = loadTasks(projectPath);
    if (tasksData) {
      regenerateIndex(projectPath, tasksData);
    }

    return updatedTask;
  } catch (err) {
    console.error('Error updating task:', (err as Error).message);
    return null;
  }
}

/**
 * Delete a task — removes the .md file, then regenerates the index.
 */
function deleteTask(projectPath: string, taskId: string): boolean {
  const filePath = getTaskFilePath(projectPath, taskId);

  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Regenerate index
    const tasksData = loadTasks(projectPath);
    if (tasksData) {
      regenerateIndex(projectPath, tasksData);
    }

    return true;
  } catch (err) {
    console.error('Error deleting task:', (err as Error).message);
    return false;
  }
}

/**
 * Start watching the .subframe/tasks/ directory for external changes.
 * Keeps the exported name `watchTasksFile` for IPC compat.
 */
function watchTasksFile(projectPath: string): void {
  unwatchTasksFile();

  const tasksDir = getTasksDir(projectPath);

  // If the tasks directory doesn't exist yet, nothing to watch
  if (!fs.existsSync(tasksDir)) return;

  try {
    tasksWatcher = fs.watch(tasksDir, (_eventType, filename) => {
      // Only react to .md file changes
      if (filename && !filename.endsWith('.md')) return;

      // Debounce to avoid firing multiple times for a single save
      if (watchDebounceTimer) clearTimeout(watchDebounceTimer);
      watchDebounceTimer = setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          const tasks = loadTasks(projectPath);
          if (!tasks) return;

          // Deduplicate: only send if task content actually changed
          const fingerprint = computeTasksFingerprint(tasks);
          if (fingerprint === lastWatchedHash) return;
          lastWatchedHash = fingerprint;

          mainWindow.webContents.send(IPC.TASKS_DATA, {
            projectPath,
            tasks,
          });
        }
      }, 300);
    });
    tasksWatcher.on('error', (err) => {
      console.warn('[Tasks] Watcher error (path may have been deleted):', (err as NodeJS.ErrnoException).code);
      unwatchTasksFile();
    });
  } catch (err) {
    console.error('Error watching tasks directory:', err);
  }
}

/**
 * Stop watching tasks directory
 */
function unwatchTasksFile(): void {
  if (watchDebounceTimer) clearTimeout(watchDebounceTimer);
  if (tasksWatcher) {
    tasksWatcher.close();
    tasksWatcher = null;
  }
}

/**
 * Setup IPC handlers
 */
function setupIPC(ipcMain: IpcMain): void {
  ipcMain.on(IPC.LOAD_TASKS, (event, projectPath: string) => {
    const tasks = loadTasks(projectPath);
    event.sender.send(IPC.TASKS_DATA, { projectPath, tasks });
    // Start watching for external changes
    watchTasksFile(projectPath);
  });

  ipcMain.on(IPC.WATCH_TASKS, (_event, projectPath: string) => {
    watchTasksFile(projectPath);
  });

  ipcMain.on(IPC.UNWATCH_TASKS, () => {
    unwatchTasksFile();
  });

  ipcMain.on(
    IPC.ADD_TASK,
    (
      event,
      { projectPath, task }: { projectPath: string; task: Partial<Task> }
    ) => {
      const newTask = addTask(projectPath, task);
      event.sender.send(IPC.TASK_UPDATED, {
        projectPath,
        action: 'add',
        task: newTask,
        success: !!newTask,
      });

      // Also send updated tasks data
      const tasks = loadTasks(projectPath);
      event.sender.send(IPC.TASKS_DATA, { projectPath, tasks });
    }
  );

  ipcMain.on(
    IPC.UPDATE_TASK,
    (
      event,
      {
        projectPath,
        taskId,
        updates,
      }: { projectPath: string; taskId: string; updates: Partial<Task> }
    ) => {
      const updatedTask = updateTask(projectPath, taskId, updates);
      event.sender.send(IPC.TASK_UPDATED, {
        projectPath,
        action: 'update',
        task: updatedTask,
        success: !!updatedTask,
      });

      // Also send updated tasks data
      const tasks = loadTasks(projectPath);
      event.sender.send(IPC.TASKS_DATA, { projectPath, tasks });
    }
  );

  ipcMain.on(
    IPC.DELETE_TASK,
    (
      event,
      { projectPath, taskId }: { projectPath: string; taskId: string }
    ) => {
      const success = deleteTask(projectPath, taskId);
      event.sender.send(IPC.TASK_UPDATED, {
        projectPath,
        action: 'delete',
        taskId,
        success,
      });

      // Also send updated tasks data
      const tasks = loadTasks(projectPath);
      event.sender.send(IPC.TASKS_DATA, { projectPath, tasks });
    }
  );
}

export {
  init,
  setProjectPath,
  loadTasks,
  addTask,
  updateTask,
  deleteTask,
  watchTasksFile,
  unwatchTasksFile,
  setupIPC,
};
