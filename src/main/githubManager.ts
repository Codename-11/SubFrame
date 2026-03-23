/**
 * GitHub Manager Module
 * Handles GitHub integration using gh CLI
 */

import { exec } from 'child_process';
import { shell } from 'electron';
import type { BrowserWindow, IpcMain } from 'electron';
import { IPC, type GitHubWorkflowRun, type GitHubWorkflow, type GitHubWorkflowsResult, type GitHubIssueDetail, type GitHubPRDetail, type GitHubPRDiff, type GitHubNotification, type CreateGitHubIssuePayload, type CreateGitHubIssueResult } from '../shared/ipcChannels';
import * as outputChannelManager from './outputChannelManager';

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

// ─── Helper utilities ─────────────────────────────────────────────────────────

function ghExec<T>(cmd: string, cwd: string): Promise<{ data: T | null; error: string | null }> {
  return new Promise((resolve) => {
    exec(cmd, { cwd, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) resolve({ data: null, error: stderr || error.message });
      else {
        try { resolve({ data: JSON.parse(stdout) as T, error: null }); }
        catch { resolve({ data: null, error: 'Failed to parse output' }); }
      }
    });
  });
}

function ghExecRaw(cmd: string, cwd: string): Promise<{ stdout: string; error: string | null }> {
  return new Promise((resolve) => {
    exec(cmd, { cwd, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) resolve({ stdout: '', error: stderr || error.message });
      else resolve({ stdout, error: null });
    });
  });
}

// ─── Core functions ───────────────────────────────────────────────────────────

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
 * Load workflow runs for a specific workflow
 */
function loadWorkflowRuns(projectPath: string, workflowId: number): Promise<GitHubWorkflowRun[]> {
  return new Promise((resolve) => {
    exec(
      `gh run list --workflow=${workflowId} --json databaseId,displayTitle,status,conclusion,event,headBranch,createdAt,updatedAt,url --limit 5`,
      { cwd: projectPath },
      (error, stdout) => {
        if (error) {
          resolve([]);
          return;
        }
        try {
          resolve(JSON.parse(stdout) as GitHubWorkflowRun[]);
        } catch {
          resolve([]);
        }
      }
    );
  });
}

/**
 * Load GitHub Actions workflows and their recent runs
 */
async function loadWorkflows(projectPath: string): Promise<GitHubWorkflowsResult> {
  const ghAvailable = await checkGhCli();
  if (!ghAvailable) {
    return { error: 'gh CLI not installed. Install from https://cli.github.com', workflows: [] };
  }

  const repoInfo = await checkGitHubRepo(projectPath);
  if (!repoInfo.isGitHubRepo) {
    return { error: 'Not a GitHub repository', workflows: [], repoName: null };
  }

  return new Promise((resolve) => {
    exec('gh workflow list --json id,name,path,state', { cwd: projectPath }, async (error, stdout, stderr) => {
      if (error) {
        resolve({ error: stderr || error.message, workflows: [], repoName: repoInfo.repoName });
        return;
      }

      try {
        const workflows = JSON.parse(stdout) as Array<{ id: number; name: string; path: string; state: string }>;

        // For each workflow, fetch recent runs (limit 5 per workflow)
        const results: GitHubWorkflow[] = await Promise.all(
          workflows.map(async (wf) => {
            const runs = await loadWorkflowRuns(projectPath, wf.id);
            return { ...wf, runs };
          })
        );

        resolve({ error: null, workflows: results, repoName: repoInfo.repoName });
      } catch (_e) {
        resolve({ error: 'Failed to parse workflow data', workflows: [], repoName: repoInfo.repoName });
      }
    });
  });
}

/**
 * View full issue detail
 */
async function viewIssue(projectPath: string, issueNumber: number): Promise<{ error: string | null; issue: GitHubIssueDetail | null }> {
  outputChannelManager.log('github', `Viewing issue #${issueNumber}`);
  const result = await ghExec<GitHubIssueDetail>(
    `gh issue view ${issueNumber} --json number,title,state,body,url,assignees,comments,labels,author,createdAt,updatedAt,milestone`,
    projectPath
  );
  if (result.error) {
    outputChannelManager.log('github', `Error viewing issue #${issueNumber}: ${result.error}`);
    return { error: result.error, issue: null };
  }
  outputChannelManager.log('github', `Loaded issue #${issueNumber}: ${result.data?.title ?? 'unknown'}`);
  return { error: null, issue: result.data };
}

/**
 * View full PR detail
 */
async function viewPR(projectPath: string, prNumber: number): Promise<{ error: string | null; pr: GitHubPRDetail | null }> {
  outputChannelManager.log('github', `Viewing PR #${prNumber}`);
  const result = await ghExec<GitHubPRDetail>(
    `gh pr view ${prNumber} --json number,title,state,body,url,assignees,comments,labels,author,createdAt,updatedAt,headRefName,baseRefName,mergeable,additions,deletions,changedFiles,reviewDecision`,
    projectPath
  );
  if (result.error) {
    outputChannelManager.log('github', `Error viewing PR #${prNumber}: ${result.error}`);
    return { error: result.error, pr: null };
  }
  outputChannelManager.log('github', `Loaded PR #${prNumber}: ${result.data?.title ?? 'unknown'}`);
  return { error: null, pr: result.data };
}

/**
 * Create a new GitHub issue
 */
async function createIssue(payload: CreateGitHubIssuePayload): Promise<CreateGitHubIssueResult> {
  outputChannelManager.log('github', `Creating issue: ${payload.title}`);
  const args = [`gh issue create --title "${payload.title.replace(/"/g, '\\"')}"`];
  if (payload.body) {
    args[0] += ` --body "${payload.body.replace(/"/g, '\\"')}"`;
  }
  if (payload.labels && payload.labels.length > 0) {
    for (const label of payload.labels) {
      args[0] += ` --label "${label.replace(/"/g, '\\"')}"`;
    }
  }
  if (payload.assignees && payload.assignees.length > 0) {
    for (const assignee of payload.assignees) {
      args[0] += ` --assignee "${assignee.replace(/"/g, '\\"')}"`;
    }
  }

  const result = await ghExecRaw(args[0], payload.projectPath);
  if (result.error) {
    outputChannelManager.log('github', `Error creating issue: ${result.error}`);
    return { error: result.error };
  }

  // gh issue create prints the URL to stdout
  const url = result.stdout.trim();
  outputChannelManager.log('github', `Created issue: ${url}`);
  return { error: null, url };
}

/**
 * Load PR diff
 */
async function loadPRDiff(projectPath: string, prNumber: number): Promise<{ error: string | null; diff: GitHubPRDiff | null }> {
  outputChannelManager.log('github', `Loading diff for PR #${prNumber}`);

  // Run diff and file list in parallel
  const [diffResult, filesResult] = await Promise.all([
    ghExecRaw(`gh pr diff ${prNumber}`, projectPath),
    ghExec<{ files: { path: string; additions: number; deletions: number; status: string }[] }>(
      `gh pr view ${prNumber} --json files`,
      projectPath
    ),
  ]);

  if (diffResult.error) {
    outputChannelManager.log('github', `Error loading PR diff #${prNumber}: ${diffResult.error}`);
    return { error: diffResult.error, diff: null };
  }

  const files = filesResult.data?.files ?? [];
  outputChannelManager.log('github', `Loaded diff for PR #${prNumber}: ${files.length} files changed`);
  return { error: null, diff: { diff: diffResult.stdout, files } };
}

/**
 * Rerun a GitHub Actions workflow run
 */
async function rerunWorkflow(projectPath: string, runId: number): Promise<{ error: string | null; success: boolean }> {
  outputChannelManager.log('github', `Rerunning workflow run ${runId}`);
  const result = await ghExecRaw(`gh run rerun ${runId}`, projectPath);
  if (result.error) {
    outputChannelManager.log('github', `Error rerunning workflow ${runId}: ${result.error}`);
    return { error: result.error, success: false };
  }
  outputChannelManager.log('github', `Rerun triggered for workflow run ${runId}`);
  return { error: null, success: true };
}

/**
 * Dispatch (manually trigger) a GitHub Actions workflow
 */
async function dispatchWorkflow(projectPath: string, workflowId: string, ref?: string): Promise<{ error: string | null; success: boolean }> {
  outputChannelManager.log('github', `Dispatching workflow ${workflowId}${ref ? ` on ref ${ref}` : ''}`);
  let cmd = `gh workflow run ${workflowId}`;
  if (ref) {
    cmd += ` --ref "${ref.replace(/"/g, '\\"')}"`;
  }
  const result = await ghExecRaw(cmd, projectPath);
  if (result.error) {
    outputChannelManager.log('github', `Error dispatching workflow ${workflowId}: ${result.error}`);
    return { error: result.error, success: false };
  }
  outputChannelManager.log('github', `Dispatched workflow ${workflowId}`);
  return { error: null, success: true };
}

/**
 * Load GitHub notifications (not project-specific)
 */
async function loadNotifications(): Promise<{ error: string | null; notifications: GitHubNotification[] }> {
  outputChannelManager.log('github', 'Loading GitHub notifications');
  const result = await ghExec<GitHubNotification[]>('gh api notifications --paginate', currentProjectPath || '.');
  if (result.error) {
    outputChannelManager.log('github', `Error loading notifications: ${result.error}`);
    return { error: result.error, notifications: [] };
  }
  const notifications = result.data ?? [];
  outputChannelManager.log('github', `Loaded ${notifications.length} notifications`);
  return { error: null, notifications };
}

/**
 * Mark a GitHub notification thread as read
 */
async function markNotificationRead(threadId: string): Promise<{ error: string | null; success: boolean }> {
  outputChannelManager.log('github', `Marking notification ${threadId} as read`);
  const result = await ghExecRaw(`gh api -X PATCH notifications/threads/${threadId}`, currentProjectPath || '.');
  if (result.error) {
    outputChannelManager.log('github', `Error marking notification read: ${result.error}`);
    return { error: result.error, success: false };
  }
  outputChannelManager.log('github', `Notification ${threadId} marked as read`);
  return { error: null, success: true };
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

  // Load workflows
  ipcMain.handle(IPC.LOAD_GITHUB_WORKFLOWS, async (_event, projectPath: string) => {
    const targetPath = projectPath || currentProjectPath;
    if (!targetPath) {
      return { error: 'No project selected', workflows: [] };
    }
    return await loadWorkflows(targetPath);
  });

  // View full issue detail
  ipcMain.handle(IPC.VIEW_GITHUB_ISSUE, async (_event, { projectPath, issueNumber }: { projectPath?: string; issueNumber: number }) => {
    const targetPath = projectPath || currentProjectPath;
    if (!targetPath) {
      return { error: 'No project selected', issue: null };
    }
    return await viewIssue(targetPath, issueNumber);
  });

  // View full PR detail
  ipcMain.handle(IPC.VIEW_GITHUB_PR, async (_event, { projectPath, prNumber }: { projectPath?: string; prNumber: number }) => {
    const targetPath = projectPath || currentProjectPath;
    if (!targetPath) {
      return { error: 'No project selected', pr: null };
    }
    return await viewPR(targetPath, prNumber);
  });

  // Create issue
  ipcMain.handle(IPC.CREATE_GITHUB_ISSUE, async (_event, payload: CreateGitHubIssuePayload) => {
    const targetPath = payload.projectPath || currentProjectPath;
    if (!targetPath) {
      return { error: 'No project selected' };
    }
    return await createIssue({ ...payload, projectPath: targetPath });
  });

  // Load PR diff
  ipcMain.handle(IPC.LOAD_GITHUB_PR_DIFF, async (_event, { projectPath, prNumber }: { projectPath?: string; prNumber: number }) => {
    const targetPath = projectPath || currentProjectPath;
    if (!targetPath) {
      return { error: 'No project selected', diff: null };
    }
    return await loadPRDiff(targetPath, prNumber);
  });

  // Rerun workflow
  ipcMain.handle(IPC.RERUN_GITHUB_WORKFLOW, async (_event, { projectPath, runId }: { projectPath?: string; runId: number }) => {
    const targetPath = projectPath || currentProjectPath;
    if (!targetPath) {
      return { error: 'No project selected', success: false };
    }
    return await rerunWorkflow(targetPath, runId);
  });

  // Dispatch workflow
  ipcMain.handle(IPC.DISPATCH_GITHUB_WORKFLOW, async (_event, { projectPath, workflowId, ref }: { projectPath?: string; workflowId: string; ref?: string }) => {
    const targetPath = projectPath || currentProjectPath;
    if (!targetPath) {
      return { error: 'No project selected', success: false };
    }
    return await dispatchWorkflow(targetPath, workflowId, ref);
  });

  // Load notifications
  ipcMain.handle(IPC.LOAD_GITHUB_NOTIFICATIONS, async () => {
    return await loadNotifications();
  });

  // Mark notification read
  ipcMain.handle(IPC.MARK_GITHUB_NOTIFICATION_READ, async (_event, { threadId }: { threadId: string }) => {
    return await markNotificationRead(threadId);
  });
}

export { init, setProjectPath, setupIPC, loadIssues, loadWorkflows, openIssue, viewIssue, viewPR, createIssue, loadPRDiff, rerunWorkflow, dispatchWorkflow, loadNotifications, markNotificationRead };
