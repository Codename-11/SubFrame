/**
 * Git Branches Manager Module
 * Handles git branch and worktree operations
 */

import { exec } from 'child_process';
import type { BrowserWindow, IpcMain } from 'electron';
import { IPC } from '../shared/ipcChannels';

interface GitResult {
  stdout: string;
  stderr: string;
}

interface GitError {
  error: string;
  stderr?: string;
}

interface BranchInfo {
  name: string;
  commit: string;
  date: string;
  message: string;
  isRemote: boolean;
  isCurrent: boolean;
  /** Remote name (e.g. "origin", "upstream") or null for local branches */
  remote: string | null;
}

interface BranchesResult {
  error: string | null;
  currentBranch?: string;
  branches: BranchInfo[];
}

interface WorktreeInfo {
  path: string;
  head?: string;
  branch?: string;
  bare?: boolean;
  detached?: boolean;
  isMain?: boolean;
}

interface WorktreesResult {
  error: string | null;
  worktrees: WorktreeInfo[];
}

interface OperationResult {
  error: string | null;
  branch?: string;
  path?: string;
  message?: string;
  changes?: string[];
}

let mainWindow: BrowserWindow | null = null;

/**
 * Initialize manager
 */
function init(window: BrowserWindow): void {
  mainWindow = window;
}

/**
 * Execute git command with promise
 */
function execGit(command: string, projectPath: string): Promise<GitResult> {
  return new Promise((resolve, reject) => {
    exec(command, { cwd: projectPath, timeout: 10000 }, (error, stdout, stderr) => {
      if (error) {
        reject({ error: error.message, stderr } as GitError);
      } else {
        resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
      }
    });
  });
}

/**
 * Check if working tree is clean
 */
async function isWorkingTreeClean(projectPath: string): Promise<{ clean: boolean; changes?: string[]; error?: string }> {
  try {
    const { stdout } = await execGit('git status --porcelain', projectPath);
    return { clean: stdout === '', changes: stdout.split('\n').filter(Boolean) };
  } catch (err) {
    return { clean: false, error: (err as GitError).error };
  }
}

interface GitFileStatus {
  path: string;
  index: string;
  working: string;
}

interface GitStatusResult {
  error: string | null;
  branch: string;
  ahead: number;
  behind: number;
  files: GitFileStatus[];
  staged: number;
  modified: number;
  untracked: number;
}

/**
 * Get structured git status for a project
 */
async function getGitStatus(projectPath: string): Promise<GitStatusResult> {
  const empty: GitStatusResult = { error: null, branch: '', ahead: 0, behind: 0, files: [], staged: 0, modified: 0, untracked: 0 };
  if (!projectPath) return { ...empty, error: 'No project selected' };

  try {
    await execGit('git rev-parse --is-inside-work-tree', projectPath);

    let branch = '';
    let ahead = 0;
    let behind = 0;
    try {
      const { stdout: branchOut } = await execGit('git branch --show-current', projectPath);
      branch = branchOut;
    } catch { /* detached HEAD */ }

    try {
      const { stdout: trackingOut } = await execGit('git rev-list --left-right --count HEAD...@{upstream}', projectPath);
      const parts = trackingOut.split(/\s+/);
      if (parts.length >= 2) {
        ahead = parseInt(parts[0], 10) || 0;
        behind = parseInt(parts[1], 10) || 0;
      }
    } catch { /* no upstream */ }

    const { stdout: statusOut } = await execGit('git status --porcelain', projectPath);
    const files: GitFileStatus[] = [];
    let staged = 0;
    let modified = 0;
    let untracked = 0;

    for (const line of statusOut.split('\n').filter(Boolean)) {
      const indexChar = line[0];
      const workingChar = line[1];
      const filePath = line.substring(3).trim();
      const displayPath = filePath.includes(' -> ') ? filePath.split(' -> ')[1] : filePath;

      files.push({ path: displayPath, index: indexChar, working: workingChar });

      if (indexChar === '?' && workingChar === '?') {
        untracked++;
      } else {
        if (indexChar !== ' ' && indexChar !== '?') staged++;
        if (workingChar !== ' ' && workingChar !== '?') modified++;
      }
    }

    return { error: null, branch, ahead, behind, files, staged, modified, untracked };
  } catch (err) {
    return { ...empty, error: (err as GitError).error || 'Not a git repository' };
  }
}

/**
 * Load all branches
 */
async function loadBranches(projectPath: string): Promise<BranchesResult> {
  if (!projectPath) {
    return { error: 'No project selected', branches: [] };
  }

  try {
    // Check if it's a git repo
    await execGit('git rev-parse --is-inside-work-tree', projectPath);

    // Get current branch
    const { stdout: currentBranch } = await execGit('git branch --show-current', projectPath);

    // Get known remote names so we can classify branches correctly
    let remoteNames: string[] = [];
    try {
      const { stdout: remotesOutput } = await execGit('git remote', projectPath);
      remoteNames = remotesOutput.split('\n').filter(Boolean);
    } catch { /* no remotes */ }

    // Get all branches with details
    const { stdout: branchOutput } = await execGit(
      'git branch -a --format="%(refname:short)|%(objectname:short)|%(committerdate:relative)|%(subject)"',
      projectPath
    );

    const branches: BranchInfo[] = branchOutput.split('\n')
      .filter(line => line)
      .map(line => {
        const [name, commit, date, ...messageParts] = line.split('|');
        const message = messageParts.join('|');
        // Detect remote by matching against known remote names (origin, upstream, etc.)
        const remote = remoteNames.find(r => name.startsWith(r + '/')) ?? null;
        return {
          name,
          commit: commit || '',
          date: date || '',
          message: message || '',
          isRemote: remote !== null,
          isCurrent: name === currentBranch,
          remote,
        };
      })
      // Filter out HEAD pointer
      .filter(b => !b.name.includes('HEAD'));

    return { error: null, currentBranch, branches };
  } catch (err) {
    return { error: (err as GitError).error || 'Not a git repository', branches: [] };
  }
}

/**
 * Switch to a branch
 */
async function switchBranch(projectPath: string, branchName: string): Promise<OperationResult> {
  if (!projectPath || !branchName) {
    return { error: 'Missing parameters' };
  }

  // Check for uncommitted changes
  const status = await isWorkingTreeClean(projectPath);
  if (!status.clean && !status.error) {
    return {
      error: 'uncommitted_changes',
      message: 'You have uncommitted changes',
      changes: status.changes
    };
  }

  try {
    // Handle remote branches — strip any remote prefix (origin/, upstream/, etc.)
    let targetBranch = branchName;
    const slashIdx = branchName.indexOf('/');
    if (slashIdx > 0) {
      // Check if prefix matches a known remote
      try {
        const { stdout: remotesOut } = await execGit('git remote', projectPath);
        const remotes = remotesOut.split('\n').filter(Boolean);
        const prefix = branchName.substring(0, slashIdx);
        if (remotes.includes(prefix)) {
          targetBranch = branchName.substring(slashIdx + 1);
        }
      } catch { /* no remotes — treat as local branch name */ }
    }

    await execGit(`git checkout "${targetBranch}"`, projectPath);
    return { error: null, branch: targetBranch };
  } catch (err) {
    return { error: (err as GitError).error || (err as Error).message };
  }
}

/**
 * Create a new branch
 */
async function createBranch(projectPath: string, branchName: string, checkout: boolean = true, baseBranch: string | null = null): Promise<OperationResult> {
  if (!projectPath || !branchName) {
    return { error: 'Missing parameters' };
  }

  try {
    let cmd: string;
    if (checkout) {
      cmd = baseBranch
        ? `git checkout -b "${branchName}" "${baseBranch}"`
        : `git checkout -b "${branchName}"`;
    } else {
      cmd = baseBranch
        ? `git branch "${branchName}" "${baseBranch}"`
        : `git branch "${branchName}"`;
    }
    await execGit(cmd, projectPath);
    return { error: null, branch: branchName };
  } catch (err) {
    return { error: (err as GitError).error || (err as Error).message };
  }
}

/**
 * Delete a branch
 */
async function deleteBranch(projectPath: string, branchName: string, force: boolean = false): Promise<OperationResult> {
  if (!projectPath || !branchName) {
    return { error: 'Missing parameters' };
  }

  try {
    const flag = force ? '-D' : '-d';
    await execGit(`git branch ${flag} "${branchName}"`, projectPath);
    return { error: null, branch: branchName };
  } catch (err) {
    return { error: (err as GitError).error || (err as Error).message };
  }
}

/**
 * Load worktrees
 */
async function loadWorktrees(projectPath: string): Promise<WorktreesResult> {
  if (!projectPath) {
    return { error: 'No project selected', worktrees: [] };
  }

  try {
    const { stdout } = await execGit('git worktree list --porcelain', projectPath);

    const worktrees: WorktreeInfo[] = [];
    let current: Partial<WorktreeInfo> = {};

    stdout.split('\n').forEach(line => {
      if (line.startsWith('worktree ')) {
        if (current.path) worktrees.push(current as WorktreeInfo);
        current = { path: line.substring(9) };
      } else if (line.startsWith('HEAD ')) {
        current.head = line.substring(5);
      } else if (line.startsWith('branch ')) {
        current.branch = line.substring(7).replace('refs/heads/', '');
      } else if (line === 'bare') {
        current.bare = true;
      } else if (line === 'detached') {
        current.detached = true;
      }
    });

    if (current.path) worktrees.push(current as WorktreeInfo);

    // Mark main worktree
    if (worktrees.length > 0) {
      worktrees[0].isMain = true;
    }

    return { error: null, worktrees };
  } catch (err) {
    return { error: (err as GitError).error || (err as Error).message, worktrees: [] };
  }
}

/**
 * Add a worktree
 */
async function addWorktree(projectPath: string, worktreePath: string, branchName: string, createBranchFlag: boolean = false): Promise<OperationResult> {
  if (!projectPath || !worktreePath || !branchName) {
    return { error: 'Missing parameters' };
  }

  try {
    const cmd = createBranchFlag
      ? `git worktree add -b "${branchName}" "${worktreePath}"`
      : `git worktree add "${worktreePath}" "${branchName}"`;
    await execGit(cmd, projectPath);
    return { error: null, path: worktreePath, branch: branchName };
  } catch (err) {
    return { error: (err as GitError).error || (err as Error).message };
  }
}

/**
 * Remove a worktree
 */
async function removeWorktree(projectPath: string, worktreePath: string, force: boolean = false): Promise<OperationResult> {
  if (!projectPath || !worktreePath) {
    return { error: 'Missing parameters' };
  }

  try {
    const cmd = force
      ? `git worktree remove --force "${worktreePath}"`
      : `git worktree remove "${worktreePath}"`;
    await execGit(cmd, projectPath);
    return { error: null, path: worktreePath };
  } catch (err) {
    return { error: (err as GitError).error || (err as Error).message };
  }
}

/**
 * Setup IPC handlers
 */
function setupIPC(ipcMain: IpcMain): void {
  ipcMain.handle(IPC.LOAD_GIT_BRANCHES, async (_event, projectPath: string) => {
    return await loadBranches(projectPath);
  });

  ipcMain.handle(IPC.SWITCH_GIT_BRANCH, async (_event, { projectPath, branchName }: { projectPath: string; branchName: string }) => {
    return await switchBranch(projectPath, branchName);
  });

  ipcMain.handle(IPC.CREATE_GIT_BRANCH, async (_event, { projectPath, branchName, checkout, baseBranch }: { projectPath: string; branchName: string; checkout?: boolean; baseBranch?: string }) => {
    return await createBranch(projectPath, branchName, checkout, baseBranch || null);
  });

  ipcMain.handle(IPC.DELETE_GIT_BRANCH, async (_event, { projectPath, branchName, force }: { projectPath: string; branchName: string; force?: boolean }) => {
    return await deleteBranch(projectPath, branchName, force);
  });

  ipcMain.handle(IPC.LOAD_GIT_WORKTREES, async (_event, projectPath: string) => {
    return await loadWorktrees(projectPath);
  });

  ipcMain.handle(IPC.ADD_GIT_WORKTREE, async (_event, { projectPath, worktreePath, branchName, createBranch: createBranchFlag }: { projectPath: string; worktreePath: string; branchName: string; createBranch?: boolean }) => {
    return await addWorktree(projectPath, worktreePath, branchName, createBranchFlag);
  });

  ipcMain.handle(IPC.REMOVE_GIT_WORKTREE, async (_event, { projectPath, worktreePath, force }: { projectPath: string; worktreePath: string; force?: boolean }) => {
    return await removeWorktree(projectPath, worktreePath, force);
  });

  ipcMain.handle(IPC.LOAD_GIT_STATUS, async (_event, projectPath: string) => {
    return await getGitStatus(projectPath);
  });

  // Toggle panel from menu
  ipcMain.on(IPC.TOGGLE_GIT_BRANCHES_PANEL, () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC.TOGGLE_GIT_BRANCHES_PANEL);
    }
  });
}

export {
  init, loadBranches, switchBranch, createBranch, deleteBranch,
  loadWorktrees, addWorktree, removeWorktree, isWorkingTreeClean, getGitStatus, setupIPC
};
