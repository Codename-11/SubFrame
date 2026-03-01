/**
 * Overview Manager Module
 * Gathers project data for overview dashboard
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { IPC } = require('../shared/ipcChannels');

let mainWindow = null;

/**
 * Initialize overview manager
 */
function init(window) {
  mainWindow = window;
}

/**
 * Load overview data for a project
 */
async function loadOverview(projectPath) {
  if (!projectPath) {
    return { error: 'No project selected' };
  }

  try {
    const [structure, tasks, decisions, stats] = await Promise.all([
      loadStructure(projectPath),
      loadTasks(projectPath),
      loadDecisions(projectPath),
      loadStats(projectPath)
    ]);

    return {
      error: null,
      projectPath,
      projectName: path.basename(projectPath),
      generatedAt: new Date().toISOString(),
      structure,
      tasks,
      decisions,
      stats
    };
  } catch (err) {
    console.error('Error loading overview:', err);
    return { error: err.message };
  }
}

/**
 * Load structure from STRUCTURE.json
 */
async function loadStructure(projectPath) {
  const structurePath = path.join(projectPath, 'STRUCTURE.json');

  try {
    if (!fs.existsSync(structurePath)) {
      return { modules: [], totalModules: 0 };
    }

    const data = JSON.parse(fs.readFileSync(structurePath, 'utf8'));
    const modules = data.modules || {};

    // Group by directory
    const groups = {};
    for (const [key, value] of Object.entries(modules)) {
      const dir = key.split('/')[0] || 'root';
      if (!groups[dir]) {
        groups[dir] = { name: dir, count: 0, modules: [] };
      }
      groups[dir].count++;
      groups[dir].modules.push({
        name: key,
        purpose: value.purpose || '',
        exports: value.exports || []
      });
    }

    return {
      groups: Object.values(groups),
      totalModules: Object.keys(modules).length,
      ipcChannels: data.ipcChannels ? Object.keys(data.ipcChannels).length : 0
    };
  } catch (err) {
    console.error('Error loading structure:', err);
    return { modules: [], totalModules: 0, error: err.message };
  }
}

/**
 * Load tasks from tasks.json
 */
async function loadTasks(projectPath) {
  const tasksPath = path.join(projectPath, 'tasks.json');

  try {
    if (!fs.existsSync(tasksPath)) {
      return { tasks: [], total: 0, completed: 0, pending: 0, inProgress: 0 };
    }

    const data = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));

    // Handle both flat array and nested object structure
    let allTasks = [];
    let pendingCount = 0;
    let inProgressCount = 0;
    let completedCount = 0;

    if (Array.isArray(data.tasks)) {
      // Flat array structure
      allTasks = data.tasks;
      completedCount = allTasks.filter(t => t.status === 'completed').length;
      pendingCount = allTasks.filter(t => t.status === 'pending').length;
      inProgressCount = allTasks.filter(t => t.status === 'in_progress').length;
    } else if (data.tasks && typeof data.tasks === 'object') {
      // Nested object structure: { pending: [], inProgress: [], completed: [] }
      const pending = data.tasks.pending || [];
      const inProgress = data.tasks.inProgress || [];
      const completed = data.tasks.completed || [];

      allTasks = [...pending, ...inProgress, ...completed];
      pendingCount = pending.length;
      inProgressCount = inProgress.length;
      completedCount = completed.length;
    }

    const total = allTasks.length;

    return {
      tasks: allTasks.slice(0, 10), // Last 10 tasks for display
      total,
      completed: completedCount,
      pending: pendingCount,
      inProgress: inProgressCount,
      progress: total > 0 ? Math.round((completedCount / total) * 100) : 0
    };
  } catch (err) {
    console.error('Error loading tasks:', err);
    return { tasks: [], total: 0, completed: 0, pending: 0, inProgress: 0, error: err.message };
  }
}

/**
 * Load decisions from PROJECT_NOTES.md
 */
async function loadDecisions(projectPath) {
  const notesPath = path.join(projectPath, 'PROJECT_NOTES.md');

  try {
    if (!fs.existsSync(notesPath)) {
      return { decisions: [], total: 0 };
    }

    const content = fs.readFileSync(notesPath, 'utf8');

    // Parse ### [YYYY-MM-DD] Title format
    const decisionRegex = /###\s*\[(\d{4}-\d{2}-\d{2})\]\s*(.+)/g;
    const decisions = [];
    let match;

    while ((match = decisionRegex.exec(content)) !== null) {
      decisions.push({
        date: match[1],
        title: match[2].trim()
      });
    }

    // Sort by date descending
    decisions.sort((a, b) => new Date(b.date) - new Date(a.date));

    return {
      decisions: decisions.slice(0, 10), // Last 10 decisions
      total: decisions.length,
      lastDecision: decisions[0] || null
    };
  } catch (err) {
    console.error('Error loading decisions:', err);
    return { decisions: [], total: 0, error: err.message };
  }
}

/**
 * Load project stats (lines of code, files, git info)
 */
async function loadStats(projectPath) {
  try {
    const [linesOfCode, fileCount, gitInfo] = await Promise.all([
      countLinesOfCode(projectPath),
      countFiles(projectPath),
      getGitInfo(projectPath)
    ]);

    return {
      linesOfCode,
      fileCount,
      git: gitInfo
    };
  } catch (err) {
    console.error('Error loading stats:', err);
    return { linesOfCode: 0, fileCount: 0, git: null, error: err.message };
  }
}

/**
 * Recursively find files matching an extension (cross-platform)
 */
function findFilesRecursive(dir, ext) {
  let results = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
        results = results.concat(findFilesRecursive(fullPath, ext));
      } else if (entry.isFile() && entry.name.endsWith(ext)) {
        results.push(fullPath);
      }
    }
  } catch (err) {
    // Skip directories we can't read
  }
  return results;
}

/**
 * Count lines of code in src directory (cross-platform)
 */
function countLinesOfCode(projectPath) {
  return new Promise((resolve) => {
    const srcPath = path.join(projectPath, 'src');

    if (!fs.existsSync(srcPath)) {
      resolve({ total: 0, byExtension: {} });
      return;
    }

    try {
      const files = findFilesRecursive(srcPath, '.js');
      let total = 0;
      for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        total += content.split('\n').length;
      }
      resolve({ total, byExtension: { js: total } });
    } catch (err) {
      resolve({ total: 0, byExtension: {} });
    }
  });
}

/**
 * Count files in src directory (cross-platform)
 */
function countFiles(projectPath) {
  return new Promise((resolve) => {
    const srcPath = path.join(projectPath, 'src');

    if (!fs.existsSync(srcPath)) {
      resolve({ total: 0 });
      return;
    }

    try {
      const files = findFilesRecursive(srcPath, '.js');
      resolve({ total: files.length });
    } catch (err) {
      resolve({ total: 0 });
    }
  });
}

/**
 * Get git information
 */
function getGitInfo(projectPath) {
  return new Promise((resolve) => {
    exec('git log --oneline -1', { cwd: projectPath }, (err, stdout) => {
      if (err) {
        resolve(null);
        return;
      }

      const lastCommit = stdout.trim();

      exec('git rev-list --count HEAD', { cwd: projectPath }, (err2, stdout2) => {
        const commitCount = err2 ? 0 : parseInt(stdout2.trim()) || 0;

        exec('git branch --show-current', { cwd: projectPath }, (err3, stdout3) => {
          const branch = err3 ? 'unknown' : stdout3.trim();

          resolve({
            lastCommit,
            commitCount,
            branch
          });
        });
      });
    });
  });
}

/**
 * Get file git history (contributors, commits, blame)
 */
async function getFileGitHistory(projectPath, filePath) {
  console.log('getFileGitHistory called:', projectPath, filePath);

  if (!projectPath || !filePath) {
    return { error: 'Missing parameters' };
  }

  try {
    // Run sequentially to avoid issues, with timeout
    console.log('Getting commits...');
    const commits = await getFileCommits(projectPath, filePath);
    console.log('Commits:', commits.length);

    console.log('Getting contributors...');
    const contributors = await getFileContributors(projectPath, filePath);
    console.log('Contributors:', contributors.length);

    // Skip blame for now - it's slow
    const blame = [];

    console.log('Returning result');
    return {
      error: null,
      filePath,
      commits,
      contributors,
      blame
    };
  } catch (err) {
    console.error('Error loading file git history:', err);
    return { error: err.message };
  }
}

/**
 * Get recent commits for a file
 */
function getFileCommits(projectPath, filePath) {
  return new Promise((resolve) => {
    const cmd = `git log --oneline --format="%h|%an|%ar|%s" -10 -- "${filePath}"`;

    exec(cmd, { cwd: projectPath, timeout: 5000 }, (err, stdout) => {
      if (err) {
        console.log('getFileCommits error:', err.message);
        resolve([]);
        return;
      }

      const commits = stdout.trim().split('\n')
        .filter(line => line)
        .map(line => {
          const [hash, author, date, ...messageParts] = line.split('|');
          return {
            hash,
            author,
            date,
            message: messageParts.join('|')
          };
        });

      resolve(commits);
    });
  });
}

/**
 * Get contributors for a file
 */
function getFileContributors(projectPath, filePath) {
  return new Promise((resolve) => {
    const cmd = `git shortlog -sne -- "${filePath}"`;

    exec(cmd, { cwd: projectPath, timeout: 5000 }, (err, stdout) => {
      if (err) {
        resolve([]);
        return;
      }

      const contributors = stdout.trim().split('\n')
        .filter(line => line)
        .map(line => {
          const match = line.trim().match(/^\s*(\d+)\s+(.+?)\s+<(.+?)>$/);
          if (match) {
            return {
              commits: parseInt(match[1]),
              name: match[2],
              email: match[3]
            };
          }
          return null;
        })
        .filter(c => c);

      resolve(contributors);
    });
  });
}

/**
 * Get blame summary for a file (who wrote how many lines)
 * Cross-platform: parses git blame output in Node.js instead of piping through Unix commands
 */
function getFileBlame(projectPath, filePath) {
  return new Promise((resolve) => {
    const cmd = `git blame --line-porcelain -- "${filePath}"`;

    exec(cmd, { cwd: projectPath, timeout: 10000 }, (err, stdout) => {
      if (err) {
        resolve([]);
        return;
      }

      // Count authors from porcelain output
      const authorCounts = {};
      const lines = stdout.split('\n');
      for (const line of lines) {
        if (line.startsWith('author ')) {
          const author = line.substring(7);
          authorCounts[author] = (authorCounts[author] || 0) + 1;
        }
      }

      // Sort by count descending, take top 5
      const blameData = Object.entries(authorCounts)
        .map(([author, count]) => ({ lines: count, author }))
        .sort((a, b) => b.lines - a.lines)
        .slice(0, 5);

      resolve(blameData);
    });
  });
}

/**
 * Setup IPC handlers
 */
function setupIPC(ipcMain) {
  ipcMain.handle(IPC.LOAD_OVERVIEW, async (event, projectPath) => {
    return await loadOverview(projectPath);
  });

  ipcMain.handle(IPC.GET_FILE_GIT_HISTORY, async (event, projectPath, filePath) => {
    return await getFileGitHistory(projectPath, filePath);
  });
}

module.exports = {
  init,
  loadOverview,
  getFileGitHistory,
  setupIPC
};
