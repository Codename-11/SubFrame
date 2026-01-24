/**
 * Tasks Manager Module
 * Handles task CRUD operations for Frame projects
 */

const fs = require('fs');
const path = require('path');
const { IPC } = require('../shared/ipcChannels');
const { FRAME_FILES } = require('../shared/frameConstants');

let mainWindow = null;
let currentProjectPath = null;

/**
 * Initialize tasks manager
 */
function init(window) {
  mainWindow = window;
}

/**
 * Set current project path
 */
function setProjectPath(projectPath) {
  currentProjectPath = projectPath;
}

/**
 * Get tasks file path for a project
 */
function getTasksFilePath(projectPath) {
  return path.join(projectPath || currentProjectPath, FRAME_FILES.TASKS);
}

/**
 * Load tasks from project
 */
function loadTasks(projectPath) {
  const tasksPath = getTasksFilePath(projectPath);

  try {
    if (fs.existsSync(tasksPath)) {
      const data = fs.readFileSync(tasksPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error loading tasks:', err);
  }

  return null;
}

/**
 * Save tasks to project
 */
function saveTasks(projectPath, tasksData) {
  const tasksPath = getTasksFilePath(projectPath);

  try {
    tasksData.lastUpdated = new Date().toISOString();
    fs.writeFileSync(tasksPath, JSON.stringify(tasksData, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error saving tasks:', err);
    return false;
  }
}

/**
 * Generate unique task ID
 */
function generateTaskId() {
  return `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Add a new task
 */
function addTask(projectPath, task) {
  const tasksData = loadTasks(projectPath);
  if (!tasksData) return null;

  const newTask = {
    id: generateTaskId(),
    title: task.title || 'Untitled Task',
    description: task.description || '',
    status: 'pending',
    priority: task.priority || 'medium',
    category: task.category || 'feature',
    context: task.context || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null
  };

  tasksData.tasks.pending.push(newTask);
  tasksData.metadata.totalCreated = (tasksData.metadata.totalCreated || 0) + 1;

  if (saveTasks(projectPath, tasksData)) {
    return newTask;
  }
  return null;
}

/**
 * Update an existing task
 */
function updateTask(projectPath, taskId, updates) {
  const tasksData = loadTasks(projectPath);
  if (!tasksData) return null;

  let task = null;
  let oldStatus = null;

  // Find task in all status arrays
  for (const status of ['pending', 'inProgress', 'completed']) {
    const index = tasksData.tasks[status].findIndex(t => t.id === taskId);
    if (index !== -1) {
      task = tasksData.tasks[status][index];
      oldStatus = status;

      // Remove from current array
      tasksData.tasks[status].splice(index, 1);
      break;
    }
  }

  if (!task) return null;

  // Update task properties
  Object.assign(task, updates, { updatedAt: new Date().toISOString() });

  // Handle status change
  let newStatus = oldStatus;
  if (updates.status) {
    if (updates.status === 'pending') newStatus = 'pending';
    else if (updates.status === 'in_progress') newStatus = 'inProgress';
    else if (updates.status === 'completed') {
      newStatus = 'completed';
      task.completedAt = new Date().toISOString();
      tasksData.metadata.totalCompleted = (tasksData.metadata.totalCompleted || 0) + 1;
    }
  }

  // Add to appropriate array
  tasksData.tasks[newStatus].push(task);

  if (saveTasks(projectPath, tasksData)) {
    return task;
  }
  return null;
}

/**
 * Delete a task
 */
function deleteTask(projectPath, taskId) {
  const tasksData = loadTasks(projectPath);
  if (!tasksData) return false;

  // Find and remove task from all status arrays
  for (const status of ['pending', 'inProgress', 'completed']) {
    const index = tasksData.tasks[status].findIndex(t => t.id === taskId);
    if (index !== -1) {
      tasksData.tasks[status].splice(index, 1);
      return saveTasks(projectPath, tasksData);
    }
  }

  return false;
}

/**
 * Setup IPC handlers
 */
function setupIPC(ipcMain) {
  ipcMain.on(IPC.LOAD_TASKS, (event, projectPath) => {
    const tasks = loadTasks(projectPath);
    event.sender.send(IPC.TASKS_DATA, { projectPath, tasks });
  });

  ipcMain.on(IPC.ADD_TASK, (event, { projectPath, task }) => {
    const newTask = addTask(projectPath, task);
    event.sender.send(IPC.TASK_UPDATED, {
      projectPath,
      action: 'add',
      task: newTask,
      success: !!newTask
    });

    // Also send updated tasks data
    const tasks = loadTasks(projectPath);
    event.sender.send(IPC.TASKS_DATA, { projectPath, tasks });
  });

  ipcMain.on(IPC.UPDATE_TASK, (event, { projectPath, taskId, updates }) => {
    const updatedTask = updateTask(projectPath, taskId, updates);
    event.sender.send(IPC.TASK_UPDATED, {
      projectPath,
      action: 'update',
      task: updatedTask,
      success: !!updatedTask
    });

    // Also send updated tasks data
    const tasks = loadTasks(projectPath);
    event.sender.send(IPC.TASKS_DATA, { projectPath, tasks });
  });

  ipcMain.on(IPC.DELETE_TASK, (event, { projectPath, taskId }) => {
    const success = deleteTask(projectPath, taskId);
    event.sender.send(IPC.TASK_UPDATED, {
      projectPath,
      action: 'delete',
      taskId,
      success
    });

    // Also send updated tasks data
    const tasks = loadTasks(projectPath);
    event.sender.send(IPC.TASKS_DATA, { projectPath, tasks });
  });
}

module.exports = {
  init,
  setProjectPath,
  loadTasks,
  saveTasks,
  addTask,
  updateTask,
  deleteTask,
  setupIPC
};
