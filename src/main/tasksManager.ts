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
import { spawn } from 'child_process';
import type { BrowserWindow, IpcMain } from 'electron';
import { IPC, type Task } from '../shared/ipcChannels';
import { FRAME_FILES, FRAME_TASKS_DIR, FRAME_TASKS_PRIVATE_DIR } from '../shared/frameConstants';
import { parseTaskMarkdown, serializeTaskMarkdown } from './taskMarkdownParser';
import { getActiveTool, checkToolInstalled } from './aiToolManager';
import * as activityManager from './activityManager';
import { broadcast } from './eventBridge';

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
let privateTasksWatcher: fs.FSWatcher | null = null;
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
 * Get the .subframe/tasks/private/ directory for a project
 */
function getPrivateTasksDir(projectPath?: string): string {
  return path.join(projectPath || currentProjectPath || '', FRAME_TASKS_PRIVATE_DIR);
}

/**
 * Get the full path for a task's markdown file.
 * Private tasks are stored in .subframe/tasks/private/.
 */
function getTaskFilePath(projectPath: string, taskId: string, isPrivate?: boolean): string {
  if (isPrivate) {
    return path.join(projectPath, FRAME_TASKS_PRIVATE_DIR, `${taskId}.md`);
  }
  return path.join(projectPath, FRAME_TASKS_DIR, `${taskId}.md`);
}

/**
 * Find a task's .md file across both public and private directories.
 * Returns the file path if found, null otherwise.
 */
function findTaskFile(projectPath: string, taskId: string): string | null {
  const publicPath = path.join(projectPath, FRAME_TASKS_DIR, `${taskId}.md`);
  if (fs.existsSync(publicPath)) return publicPath;
  const privatePath = path.join(projectPath, FRAME_TASKS_PRIVATE_DIR, `${taskId}.md`);
  if (fs.existsSync(privatePath)) return privatePath;
  return null;
}

/**
 * Get tasks.json file path for a project (for index / backward compat)
 */
function getTasksJsonPath(projectPath?: string): string {
  return path.join(projectPath || currentProjectPath || '', FRAME_FILES.TASKS);
}

/**
 * Ensure the .subframe/tasks/ directory exists.
 * If isPrivate, also ensures the private subdirectory exists.
 */
function ensureTasksDir(projectPath: string, isPrivate?: boolean): void {
  const dir = isPrivate ? getPrivateTasksDir(projectPath) : getTasksDir(projectPath);
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
      private: 'boolean — if true, task is stored locally and excluded from git',
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

      // Also read private tasks from .subframe/tasks/private/
      const privateDir = getPrivateTasksDir(resolvedPath);
      if (fs.existsSync(privateDir)) {
        const privateFiles = fs.readdirSync(privateDir).filter((f) => f.endsWith('.md'));
        for (const file of privateFiles) {
          const filePath = path.join(privateDir, file);
          try {
            const content = fs.readFileSync(filePath, 'utf8');
            const task = parseTaskMarkdown(content, filePath);
            // Ensure private flag is set (even if missing from frontmatter)
            task.private = true;
            allTasks.push(task);
          } catch (err) {
            console.error(
              `Error parsing private task file ${filePath}:`,
              (err as Error).message
            );
          }
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
    // Exclude private tasks from the git-tracked index
    const publicOnly = (tasks: Task[]) => tasks.filter((t) => !t.private);

    const publicPending = publicOnly(tasksData.tasks.pending);
    const publicInProgress = publicOnly(tasksData.tasks.inProgress);
    const publicCompleted = publicOnly(tasksData.tasks.completed);

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
      // Strip internal fields and exclude private tasks from index
      tasks: {
        pending: stripInternalFields(publicPending),
        inProgress: stripInternalFields(publicInProgress),
        completed: stripInternalFields(publicCompleted),
      },
      metadata: {
        totalCreated:
          publicPending.length +
          publicInProgress.length +
          publicCompleted.length,
        totalCompleted: publicCompleted.length,
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
  const isPrivate = task.private === true;
  ensureTasksDir(projectPath, isPrivate);

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
    private: isPrivate || undefined,
    blockedBy: task.blockedBy ?? [],
    blocks: task.blocks ?? [],
    steps: task.steps ?? [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
  };

  try {
    const filePath = getTaskFilePath(projectPath, newTask.id, isPrivate);
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
  const filePath = findTaskFile(projectPath, taskId);

  try {
    // Read the specific .md file
    if (!filePath || !fs.existsSync(filePath)) {
      console.error(`Task file not found: ${taskId}`);
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

    // Handle privacy change — move file between public/private directories
    const wasPrivate = !!task.private;
    const isNowPrivate = updatedTask.private === true;
    let writePath = filePath;

    if (wasPrivate !== isNowPrivate) {
      ensureTasksDir(projectPath, isNowPrivate);
      writePath = getTaskFilePath(projectPath, taskId, isNowPrivate);
    }

    // Write updated .md file back
    const markdown = serializeTaskMarkdown(updatedTask);
    fs.writeFileSync(writePath, markdown, 'utf8');

    // Only delete old file after successful write (privacy change moves file)
    if (filePath !== writePath) {
      try { fs.unlinkSync(filePath); } catch { /* old file may already be gone */ }
    }

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
  const filePath = findTaskFile(projectPath, taskId);

  try {
    if (filePath && fs.existsSync(filePath)) {
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
  const privateDir = getPrivateTasksDir(projectPath);

  // Shared handler for changes in either directory
  function onTaskFileChange(_eventType: string, filename: string | null) {
    // Only react to .md file changes (ignore subdirectories like 'private/', 'archive/')
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

        broadcast(IPC.TASKS_DATA, {
          projectPath,
          tasks,
        });
      }
    }, 300);
  }

  // Watch public tasks directory
  if (fs.existsSync(tasksDir)) {
    try {
      tasksWatcher = fs.watch(tasksDir, onTaskFileChange);
      tasksWatcher.on('error', (err) => {
        console.warn('[Tasks] Watcher error (path may have been deleted):', (err as NodeJS.ErrnoException).code);
        unwatchTasksFile();
      });
    } catch (err) {
      console.error('Error watching tasks directory:', err);
    }
  }

  // Watch private tasks directory
  if (fs.existsSync(privateDir)) {
    try {
      privateTasksWatcher = fs.watch(privateDir, onTaskFileChange);
      privateTasksWatcher.on('error', (err) => {
        console.warn('[Tasks] Private watcher error:', (err as NodeJS.ErrnoException).code);
        if (privateTasksWatcher) { privateTasksWatcher.close(); privateTasksWatcher = null; }
      });
    } catch (err) {
      console.error('Error watching private tasks directory:', err);
    }
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
  if (privateTasksWatcher) {
    privateTasksWatcher.close();
    privateTasksWatcher = null;
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

  ipcMain.handle(
    IPC.ENHANCE_TASK,
    async (_event, { projectPath, task }: { projectPath: string; task: Partial<Task> }) => {
      // Create activity stream for enhance task operation
      const streamId = activityManager.createStream({
        name: `Enhance: ${task.title || 'Task'}`,
        type: 'spawn',
        source: 'tasks',
        timeout: 120_000,
        heartbeatInterval: 10_000,
      });
      activityManager.updateStatus(streamId, 'running');
      activityManager.startHeartbeat(streamId);
      activityManager.startTimeout(streamId);

      try {
        const tool = await getActiveTool();
        if (!await checkToolInstalled(tool)) {
          const errorMsg = `${tool.name} is not installed. Visit ${tool.installUrl ?? 'the tool website'} to install it.`;
          activityManager.updateStatus(streamId, 'failed', errorMsg);
          return {
            success: false,
            enhanced: {},
            error: errorMsg,
          };
        }
        const [aiExe, ...aiBaseFlags] = tool.command.split(/\s+/);

        const prompt = `You are a project task scoping assistant. Given a rough task description, improve and structure it into a well-scoped sub-task.

Input task:
- Title: ${task.title || '(untitled)'}
- Description: ${task.description || '(none)'}
- Priority: ${task.priority || 'medium'}
- Category: ${task.category || 'feature'}

Return ONLY a valid JSON object (no markdown fences, no explanation) with these fields:
{
  "title": "concise, actionable title (imperative mood)",
  "description": "clear 1-3 sentence description of what this task accomplishes",
  "acceptanceCriteria": "bullet list of what 'done' looks like, each on its own line",
  "steps": ["step 1 label", "step 2 label", "step 3 label"],
  "priority": "high|medium|low",
  "category": "feature|enhancement|bug|refactor|research|docs|test|chore"
}

Keep the original intent. Improve clarity, add missing acceptance criteria, suggest 3-5 concrete steps, and correct the priority/category if clearly wrong.`;

        activityManager.emit(streamId, 'Spawning AI tool for task enhancement...');

        const result = await new Promise<string>((resolve, reject) => {
          const child = spawn(aiExe, [...aiBaseFlags, '--print', '--output-format', 'json'], {
            cwd: projectPath,
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: true,
          });

          child.stdin.write(prompt);
          child.stdin.end();

          let stdout = '';
          let stderr = '';
          let settled = false;

          // Kill child process if activity stream is cancelled/timed out
          const abortSignal = activityManager.getAbortSignal(streamId);
          if (abortSignal) {
            abortSignal.addEventListener('abort', () => {
              if (!settled) {
                settled = true;
                try { child.kill(); } catch { /* ignore */ }
                reject(new Error('Operation cancelled or timed out'));
              }
            }, { once: true });
          }

          child.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
          child.stderr.on('data', (data: Buffer) => {
            const chunk = data.toString();
            stderr += chunk;
            // Route stderr lines through activity stream
            for (const line of chunk.split('\n').filter(Boolean)) {
              activityManager.emit(streamId, line);
            }
          });
          child.on('close', (code) => {
            if (settled) return;
            settled = true;
            if (code === 0) resolve(stdout.trim());
            else reject(new Error(stderr || `AI tool exited with code ${code}`));
          });
          child.on('error', (err) => {
            if (settled) return;
            settled = true;
            reject(err);
          });
        });

        // Unwrap Claude CLI JSON envelope if present
        let content = result;
        try {
          const envelope = JSON.parse(result);
          if (envelope && typeof envelope === 'object' && 'result' in envelope) {
            content = envelope.result;
          }
        } catch { /* not an envelope */ }

        // Parse the AI response — try direct JSON, then extract from markdown fences
        let enhanced: Record<string, unknown>;
        try {
          enhanced = JSON.parse(content);
        } catch {
          // Try extracting JSON from markdown code fences
          const fenceMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
          if (fenceMatch) {
            enhanced = JSON.parse(fenceMatch[1].trim());
          } else {
            // Try finding first { to last }
            const start = content.indexOf('{');
            const end = content.lastIndexOf('}');
            if (start >= 0 && end > start) {
              enhanced = JSON.parse(content.slice(start, end + 1));
            } else {
              throw new Error('AI response was not valid JSON. Try again.');
            }
          }
        }
        const steps = Array.isArray(enhanced.steps)
          ? enhanced.steps.map((s: string) => ({ label: s, completed: false }))
          : undefined;

        activityManager.updateStatus(streamId, 'completed');

        return {
          success: true,
          enhanced: {
            title: enhanced.title || task.title,
            description: enhanced.description || task.description,
            acceptanceCriteria: enhanced.acceptanceCriteria,
            steps,
            priority: enhanced.priority || task.priority,
            category: enhanced.category || task.category,
          },
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        activityManager.updateStatus(streamId, 'failed', msg);
        return { success: false, enhanced: {}, error: msg };
      }
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
