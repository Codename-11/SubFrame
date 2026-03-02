/**
 * GitHub Manager Module
 * Handles GitHub integration using gh CLI
 */

import { exec } from 'child_process';
import { shell } from 'electron';
import type { BrowserWindow, IpcMain } from 'electron';
import { IPC } from '../shared/ipcChannels';

interface GitHubIssue {
  number: number;
  title: string;
  state: string;
  author: unknown;
  labels: unknown[];
  createdAt: string;
  updatedAt: string;
  url: string;
}

interface IssuesResult {
  error: string | null;
  issues: GitHubIssue[];
  repoName?: string | null;
}

let currentProjectPath: string | null = null;

/**
 * Initialize GitHub manager
 */
function init(_window: BrowserWindow): void {
  // Window ref reserved for future use
}

/**
 * Set current project path
 */
function setProjectPath(projectPath: string): void {
  currentProjectPath = projectPath;
}

/**
 * Check if gh CLI is available
 */
function checkGhCli(): Promise<boolean> {
  return new Promise((resolve) => {
    exec('gh --version', (error) => {
      resolve(!error);
    });
  });
}

/**
 * Check if current directory is a git repo with GitHub remote
 */
function checkGitHubRepo(projectPath: string): Promise<{ isGitHubRepo: boolean; repoName: string | null }> {
  return new Promise((resolve) => {
    exec('gh repo view --json nameWithOwner', { cwd: projectPath }, (error, stdout) => {
      if (error) {
        resolve({ isGitHubRepo: false, repoName: null });
      } else {
        try {
          const data = JSON.parse(stdout) as { nameWithOwner?: string };
          resolve({ isGitHubRepo: true, repoName: data.nameWithOwner || null });
        } catch {
          resolve({ isGitHubRepo: false, repoName: null });
        }
      }
    });
  });
}

/**
 * Load GitHub issues for current project
 */
async function loadIssues(projectPath: string, state: string = 'open'): Promise<IssuesResult> {
  const ghAvailable = await checkGhCli();
  if (!ghAvailable) {
    return { error: 'gh CLI not installed', issues: [] };
  }

  const repoInfo = await checkGitHubRepo(projectPath);
  if (!repoInfo.isGitHubRepo) {
    return { error: 'Not a GitHub repository', issues: [] };
  }

  return new Promise((resolve) => {
    const cmd = `gh issue list --state ${state} --json number,title,state,author,labels,createdAt,updatedAt,url --limit 50`;

    exec(cmd, { cwd: projectPath }, (error, stdout, stderr) => {
      if (error) {
        resolve({ error: stderr || error.message, issues: [], repoName: repoInfo.repoName });
      } else {
        try {
          const issues = JSON.parse(stdout) as GitHubIssue[];
          resolve({ error: null, issues, repoName: repoInfo.repoName });
        } catch (_e) {
          resolve({ error: 'Failed to parse issues', issues: [], repoName: repoInfo.repoName });
        }
      }
    });
  });
}

/**
 * Open issue in browser
 */
function openIssue(url: string): void {
  if (url) {
    shell.openExternal(url);
  }
}

/**
 * Setup IPC handlers
 */
function setupIPC(ipcMain: IpcMain): void {
  // Load issues
  ipcMain.handle(IPC.LOAD_GITHUB_ISSUES, async (_event, { projectPath, state }: { projectPath?: string; state?: string }) => {
    const targetPath = projectPath || currentProjectPath;
    if (!targetPath) {
      return { error: 'No project selected', issues: [] };
    }
    return await loadIssues(targetPath, state);
  });

  // Open issue in browser
  ipcMain.on(IPC.OPEN_GITHUB_ISSUE, (_event, url: string) => {
    openIssue(url);
  });
}

export { init, setProjectPath, setupIPC, loadIssues, openIssue };
