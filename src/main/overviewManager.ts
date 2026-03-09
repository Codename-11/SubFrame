/**
 * Overview Manager Module
 * Gathers project data for overview dashboard
 */

import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import type { BrowserWindow, IpcMain } from 'electron';
import { IPC } from '../shared/ipcChannels';
import { FRAME_FILES } from '../shared/frameConstants';

interface StructureModule {
  purpose?: string;
  exports?: string[];
}

interface StructureGroup {
  name: string;
  count: number;
  modules: Array<{ name: string; purpose: string; exports: string[] }>;
}

interface StructureResult {
  modules?: Record<string, StructureModule>;
  groups?: StructureGroup[];
  totalModules: number;
  ipcChannels?: number;
  error?: string;
}

interface TasksResult {
  tasks: unknown[];
  total: number;
  completed: number;
  pending: number;
  inProgress: number;
  progress?: number;
  error?: string;
}

interface Decision {
  date: string;
  title: string;
}

interface DecisionsResult {
  decisions: Decision[];
  total: number;
  lastDecision?: Decision | null;
  error?: string;
}

interface LinesOfCode {
  total: number;
  byExtension: Record<string, number>;
}

interface StatsResult {
  linesOfCode: LinesOfCode | number;
  fileCount: { total: number } | number;
  git: GitInfo | null;
  error?: string;
}

interface DayActivity {
  total: number;
  authors: Record<string, number>;
}

interface GitInfo {
  lastCommit: string;
  commitCount: number;
  branch: string;
  activity?: Record<string, DayActivity>;
}

interface RecentFile {
  file: string;
  modified: string;
}

interface FileCommit {
  hash: string;
  author: string;
  date: string;
  message: string;
}

interface FileContributor {
  commits: number;
  name: string;
  email: string;
}

interface OverviewResult {
  error: string | null;
  projectPath?: string;
  projectName?: string;
  generatedAt?: string;
  structure?: StructureResult;
  tasks?: TasksResult;
  decisions?: DecisionsResult;
  stats?: StatsResult;
  recentFiles?: RecentFile[];
}

/**
 * Initialize overview manager
 */
function init(_window: BrowserWindow): void {
  // Window ref reserved for future use
}

/**
 * Load overview data for a project
 */
async function loadOverview(projectPath: string): Promise<OverviewResult> {
  if (!projectPath) {
    return { error: 'No project selected' };
  }

  try {
    const [structure, tasks, decisions, stats, recentFiles] = await Promise.all([
      loadStructure(projectPath),
      loadTasks(projectPath),
      loadDecisions(projectPath),
      loadStats(projectPath),
      getRecentFiles(projectPath)
    ]);

    return {
      error: null,
      projectPath,
      projectName: path.basename(projectPath),
      generatedAt: new Date().toISOString(),
      structure,
      tasks,
      decisions,
      stats,
      recentFiles
    };
  } catch (err) {
    console.error('Error loading overview:', err);
    return { error: (err as Error).message };
  }
}

/**
 * Load structure from STRUCTURE.json
 */
async function loadStructure(projectPath: string): Promise<StructureResult> {
  const structurePath = path.join(projectPath, FRAME_FILES.STRUCTURE);

  try {
    if (!fs.existsSync(structurePath)) {
      return { modules: {}, totalModules: 0 };
    }

    const data = JSON.parse(fs.readFileSync(structurePath, 'utf8'));
    const modules: Record<string, StructureModule> = data.modules || {};

    // Group by directory
    const groups: Record<string, StructureGroup> = {};
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
      modules,
      groups: Object.values(groups),
      totalModules: Object.keys(modules).length,
      ipcChannels: data.ipcChannels ? Object.keys(data.ipcChannels).length : 0
    };
  } catch (err) {
    console.error('Error loading structure:', err);
    return { modules: {}, totalModules: 0, error: (err as Error).message };
  }
}

/**
 * Load tasks from tasks.json
 */
async function loadTasks(projectPath: string): Promise<TasksResult> {
  const tasksPath = path.join(projectPath, FRAME_FILES.TASKS);

  try {
    if (!fs.existsSync(tasksPath)) {
      return { tasks: [], total: 0, completed: 0, pending: 0, inProgress: 0 };
    }

    const data = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));

    let allTasks: unknown[] = [];
    let pendingCount = 0;
    let inProgressCount = 0;
    let completedCount = 0;

    if (Array.isArray(data.tasks)) {
      allTasks = data.tasks;
      completedCount = allTasks.filter((t: any) => t.status === 'completed').length;
      pendingCount = allTasks.filter((t: any) => t.status === 'pending').length;
      inProgressCount = allTasks.filter((t: any) => t.status === 'in_progress').length;
    } else if (data.tasks && typeof data.tasks === 'object') {
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
      tasks: allTasks.slice(0, 10),
      total,
      completed: completedCount,
      pending: pendingCount,
      inProgress: inProgressCount,
      progress: total > 0 ? Math.round((completedCount / total) * 100) : 0
    };
  } catch (err) {
    console.error('Error loading tasks:', err);
    return { tasks: [], total: 0, completed: 0, pending: 0, inProgress: 0, error: (err as Error).message };
  }
}

/**
 * Load decisions from PROJECT_NOTES.md
 */
async function loadDecisions(projectPath: string): Promise<DecisionsResult> {
  const notesPath = path.join(projectPath, FRAME_FILES.NOTES);

  try {
    if (!fs.existsSync(notesPath)) {
      return { decisions: [], total: 0 };
    }

    const content = fs.readFileSync(notesPath, 'utf8');

    const decisionRegex = /###\s*\[(\d{4}-\d{2}-\d{2})\]\s*(.+)/g;
    const decisions: Decision[] = [];
    let match: RegExpExecArray | null;

    while ((match = decisionRegex.exec(content)) !== null) {
      decisions.push({
        date: match[1],
        title: match[2].trim()
      });
    }

    // Sort by date descending
    decisions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      decisions: decisions.slice(0, 50),
      total: decisions.length,
      lastDecision: decisions[0] || null
    };
  } catch (err) {
    console.error('Error loading decisions:', err);
    return { decisions: [], total: 0, error: (err as Error).message };
  }
}

/**
 * Load project stats (lines of code, files, git info)
 */
async function loadStats(projectPath: string): Promise<StatsResult> {
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
    return { linesOfCode: 0, fileCount: 0, git: null, error: (err as Error).message };
  }
}

/** Source extensions to count — covers major language ecosystems */
const SOURCE_EXTENSIONS = new Set([
  // Web / JS ecosystem
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.vue', '.svelte',
  // Styles
  '.css', '.scss', '.less', '.sass',
  // Systems
  '.rs', '.go', '.c', '.cpp', '.cc', '.h', '.hpp',
  // JVM
  '.java', '.kt', '.scala',
  // .NET
  '.cs', '.fs',
  // Scripting
  '.py', '.rb', '.php', '.lua', '.sh',
  // Mobile
  '.swift', '.dart',
  // Markup (source-adjacent)
  '.html',
]);

/** Directories to skip when scanning without git */
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '.nuxt', '.output',
  'target', 'vendor', '__pycache__', '.venv', 'venv', 'coverage', '.cache',
  '.turbo', '.parcel-cache', 'out', '.svelte-kit', 'bower_components',
]);

/**
 * Get source files using `git ls-files` (fast, respects .gitignore).
 * Falls back to recursive filesystem scan if not a git repo.
 */
async function getSourceFiles(projectPath: string): Promise<string[]> {
  // Try git ls-files first — fast and respects .gitignore
  try {
    const { stdout } = await new Promise<{ stdout: string }>((resolve, reject) => {
      exec(
        'git ls-files --cached',
        { cwd: projectPath, maxBuffer: 10 * 1024 * 1024 },
        (err, stdout) => err ? reject(err) : resolve({ stdout }),
      );
    });
    return stdout.split('\n')
      .filter(f => f && SOURCE_EXTENSIONS.has(path.extname(f).toLowerCase()))
      .map(f => path.join(projectPath, f));
  } catch {
    // Not a git repo — fall back to recursive scan
  }
  return findFilesRecursive(projectPath);
}

/**
 * Recursively find source files from project root (non-git fallback).
 */
function findFilesRecursive(dir: string): string[] {
  let results: string[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !SKIP_DIRS.has(entry.name)) {
        results = results.concat(findFilesRecursive(path.join(dir, entry.name)));
      } else if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        results.push(path.join(dir, entry.name));
      }
    }
  } catch {
    // Skip directories we can't read
  }
  return results;
}

/**
 * Count lines of code across all source files in the project.
 */
async function countLinesOfCode(projectPath: string): Promise<LinesOfCode> {
  try {
    const files = await getSourceFiles(projectPath);
    let total = 0;
    const byExtension: Record<string, number> = {};
    for (const file of files) {
      try {
        const ext = path.extname(file).slice(1); // 'ts', 'tsx', 'rs', etc.
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split('\n').length;
        total += lines;
        byExtension[ext] = (byExtension[ext] || 0) + lines;
      } catch {
        // Skip unreadable files
      }
    }
    return { total, byExtension };
  } catch {
    return { total: 0, byExtension: {} };
  }
}

/**
 * Count source files in the project.
 */
async function countFiles(projectPath: string): Promise<{ total: number }> {
  try {
    const files = await getSourceFiles(projectPath);
    return { total: files.length };
  } catch {
    return { total: 0 };
  }
}

/**
 * Get git information
 */
function getGitInfo(projectPath: string): Promise<GitInfo | null> {
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

          getGitActivity(projectPath).then(activity => {
            resolve({
              lastCommit,
              commitCount,
              branch,
              activity
            });
          });
        });
      });
    });
  });
}

/**
 * Get commit activity for last 90 days (GitHub-style heatmap data)
 */
function getGitActivity(projectPath: string): Promise<Record<string, DayActivity>> {
  return new Promise((resolve) => {
    exec('git log --format="%ai|%aN" --since="1 year ago"', { cwd: projectPath, timeout: 5000 }, (err, stdout) => {
      if (err) {
        resolve({});
        return;
      }

      const activity: Record<string, DayActivity> = {};
      stdout.trim().split('\n').filter(Boolean).forEach(line => {
        const date = line.substring(0, 10);
        const author = line.substring(line.indexOf('|') + 1).trim() || 'Unknown';
        if (!activity[date]) {
          activity[date] = { total: 0, authors: {} };
        }
        activity[date].total += 1;
        activity[date].authors[author] = (activity[date].authors[author] || 0) + 1;
      });

      resolve(activity);
    });
  });
}

/**
 * Get recently modified source files
 */
function getRecentFiles(projectPath: string): Promise<RecentFile[]> {
  return new Promise((resolve) => {
    const cmd = 'git log --diff-filter=M --name-only --format="COMMIT:%aI" -50';

    exec(cmd, { cwd: projectPath, timeout: 5000 }, (err, stdout) => {
      if (err) {
        resolve([]);
        return;
      }

      const seen = new Set<string>();
      const files: RecentFile[] = [];
      let currentDate = '';

      for (const line of stdout.trim().split('\n')) {
        if (line.startsWith('COMMIT:')) {
          currentDate = line.slice(7);
        } else if (line && line.startsWith('src/') && !seen.has(line)) {
          seen.add(line);
          files.push({ file: line, modified: currentDate });
          if (files.length >= 5) break;
        }
      }

      resolve(files);
    });
  });
}

/**
 * Get file git history (contributors, commits, blame)
 */
async function getFileGitHistory(projectPath: string, filePath: string): Promise<{ error: string | null; filePath?: string; commits?: FileCommit[]; contributors?: FileContributor[]; blame?: unknown[] }> {
  console.log('getFileGitHistory called:', projectPath, filePath);

  if (!projectPath || !filePath) {
    return { error: 'Missing parameters' };
  }

  try {
    console.log('Getting commits...');
    const commits = await getFileCommits(projectPath, filePath);
    console.log('Commits:', commits.length);

    console.log('Getting contributors...');
    const contributors = await getFileContributors(projectPath, filePath);
    console.log('Contributors:', contributors.length);

    // Skip blame for now - it's slow
    const blame: unknown[] = [];

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
    return { error: (err as Error).message };
  }
}

/**
 * Get recent commits for a file
 */
function getFileCommits(projectPath: string, filePath: string): Promise<FileCommit[]> {
  return new Promise((resolve) => {
    const cmd = `git log --oneline --format="%h|%an|%ar|%s" -10 -- "${filePath}"`;

    exec(cmd, { cwd: projectPath, timeout: 5000 }, (err, stdout) => {
      if (err) {
        console.log('getFileCommits error:', err.message);
        resolve([]);
        return;
      }

      const commits: FileCommit[] = stdout.trim().split('\n')
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
function getFileContributors(projectPath: string, filePath: string): Promise<FileContributor[]> {
  return new Promise((resolve) => {
    const cmd = `git shortlog -sne -- "${filePath}"`;

    exec(cmd, { cwd: projectPath, timeout: 5000 }, (err, stdout) => {
      if (err) {
        resolve([]);
        return;
      }

      const contributors: FileContributor[] = stdout.trim().split('\n')
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
        .filter((c): c is FileContributor => c !== null);

      resolve(contributors);
    });
  });
}

/**
 * Setup IPC handlers
 */
function setupIPC(ipcMain: IpcMain): void {
  ipcMain.handle(IPC.LOAD_OVERVIEW, async (_event, projectPath: string) => {
    return await loadOverview(projectPath);
  });

  ipcMain.handle(IPC.GET_FILE_GIT_HISTORY, async (_event, projectPath: string, filePath: string) => {
    return await getFileGitHistory(projectPath, filePath);
  });
}

export { init, loadOverview, getFileGitHistory, setupIPC };
