/**
 * TanStack Query hooks for GitHub integration (issues, branches, worktrees).
 */

import { useCallback, useEffect, useState } from 'react';
import { useIpcQuery, useIpcMutation } from './useIpc';
import { useProjectStore } from '../stores/useProjectStore';
import { IPC, type GitCommitInfo } from '../../shared/ipcChannels';
import { typedSend, typedInvoke } from '../lib/ipc';

export function useGithubIssues(state: string = 'open') {
  const projectPath = useProjectStore((s) => s.currentProjectPath);

  const query = useIpcQuery(
    IPC.LOAD_GITHUB_ISSUES,
    [{ projectPath: projectPath ?? '', state }],
    { enabled: !!projectPath }
  );

  return {
    issues: query.data?.issues ?? [],
    error: query.data?.error ?? null,
    repoName: query.data?.repoName,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

export function useGithubPRs(state: string = 'open') {
  const projectPath = useProjectStore((s) => s.currentProjectPath);

  const query = useIpcQuery(
    IPC.LOAD_GITHUB_PRS,
    [{ projectPath: projectPath ?? '', state }],
    { enabled: !!projectPath }
  );

  return {
    prs: query.data?.issues ?? [],
    error: query.data?.error ?? null,
    repoName: query.data?.repoName,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

export function useGitBranches() {
  const projectPath = useProjectStore((s) => s.currentProjectPath);

  const query = useIpcQuery(
    IPC.LOAD_GIT_BRANCHES,
    [projectPath ?? ''],
    { enabled: !!projectPath }
  );

  const switchBranch = useIpcMutation(IPC.SWITCH_GIT_BRANCH, {
    onSuccess: () => query.refetch(),
  });

  const createBranch = useIpcMutation(IPC.CREATE_GIT_BRANCH, {
    onSuccess: () => query.refetch(),
  });

  const deleteBranch = useIpcMutation(IPC.DELETE_GIT_BRANCH, {
    onSuccess: () => query.refetch(),
  });

  return {
    branches: query.data?.branches ?? [],
    currentBranch: query.data?.currentBranch,
    isLoading: query.isLoading,
    refetch: query.refetch,
    switchBranch,
    createBranch,
    deleteBranch,
  };
}

export function useGitStatus() {
  const projectPath = useProjectStore((s) => s.currentProjectPath);

  const query = useIpcQuery(
    IPC.LOAD_GIT_STATUS,
    [projectPath ?? ''],
    { enabled: !!projectPath, refetchInterval: 5000 }
  );

  // Auto-fetch: start/stop based on setting
  useEffect(() => {
    if (!projectPath) return;
    const interval = parseInt(localStorage.getItem('git-auto-fetch-interval') || '0');
    if (interval > 0) {
      typedSend(IPC.GIT_START_AUTO_FETCH, { projectPath, intervalMs: interval * 1000 });
    }
    return () => {
      typedSend(IPC.GIT_STOP_AUTO_FETCH);
    };
  }, [projectPath]);

  return {
    status: query.data ?? null,
    branch: query.data?.branch ?? '',
    ahead: query.data?.ahead ?? 0,
    behind: query.data?.behind ?? 0,
    files: query.data?.files ?? [],
    staged: query.data?.staged ?? 0,
    modified: query.data?.modified ?? 0,
    untracked: query.data?.untracked ?? 0,
    error: query.data?.error ?? null,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

export function useGithubWorkflows() {
  const projectPath = useProjectStore((s) => s.currentProjectPath);
  const query = useIpcQuery(
    IPC.LOAD_GITHUB_WORKFLOWS,
    [projectPath ?? ''],
    { enabled: !!projectPath, staleTime: 30000 }
  );
  return {
    workflows: query.data?.workflows ?? [],
    error: query.data?.error ?? null,
    repoName: query.data?.repoName,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

export function useGitWorktrees() {
  const projectPath = useProjectStore((s) => s.currentProjectPath);

  const query = useIpcQuery(
    IPC.LOAD_GIT_WORKTREES,
    [projectPath ?? ''],
    { enabled: !!projectPath }
  );

  const addWorktree = useIpcMutation(IPC.ADD_GIT_WORKTREE, {
    onSuccess: () => query.refetch(),
  });

  const removeWorktree = useIpcMutation(IPC.REMOVE_GIT_WORKTREE, {
    onSuccess: () => query.refetch(),
  });

  return {
    worktrees: query.data?.worktrees ?? [],
    isLoading: query.isLoading,
    refetch: query.refetch,
    addWorktree,
    removeWorktree,
  };
}

export function useGithubIssueDetail(issueNumber: number | null) {
  const projectPath = useProjectStore((s) => s.currentProjectPath);
  const query = useIpcQuery(
    IPC.VIEW_GITHUB_ISSUE,
    [{ projectPath: projectPath ?? '', issueNumber: issueNumber ?? 0 }],
    { enabled: !!projectPath && issueNumber !== null }
  );
  return { issue: query.data?.issue ?? null, error: query.data?.error ?? null, isLoading: query.isLoading, refetch: query.refetch };
}

export function useGithubPRDetail(prNumber: number | null) {
  const projectPath = useProjectStore((s) => s.currentProjectPath);
  const query = useIpcQuery(
    IPC.VIEW_GITHUB_PR,
    [{ projectPath: projectPath ?? '', prNumber: prNumber ?? 0 }],
    { enabled: !!projectPath && prNumber !== null }
  );
  return { pr: query.data?.pr ?? null, error: query.data?.error ?? null, isLoading: query.isLoading, refetch: query.refetch };
}

export function useGithubPRDiff(prNumber: number | null) {
  const projectPath = useProjectStore((s) => s.currentProjectPath);
  const query = useIpcQuery(
    IPC.LOAD_GITHUB_PR_DIFF,
    [{ projectPath: projectPath ?? '', prNumber: prNumber ?? 0 }],
    { enabled: !!projectPath && prNumber !== null }
  );
  return { diff: query.data?.diff ?? null, error: query.data?.error ?? null, isLoading: query.isLoading, refetch: query.refetch };
}

export function useCreateGithubIssue() {
  return useIpcMutation(IPC.CREATE_GITHUB_ISSUE);
}

export function useRerunWorkflow() {
  return useIpcMutation(IPC.RERUN_GITHUB_WORKFLOW);
}

export function useDispatchWorkflow() {
  return useIpcMutation(IPC.DISPATCH_GITHUB_WORKFLOW);
}

export function useGithubNotifications() {
  const query = useIpcQuery(IPC.LOAD_GITHUB_NOTIFICATIONS, [], { refetchInterval: 60000 });
  return { notifications: query.data?.notifications ?? [], error: query.data?.error ?? null, isLoading: query.isLoading, refetch: query.refetch };
}

export function useMarkNotificationRead() {
  return useIpcMutation(IPC.MARK_GITHUB_NOTIFICATION_READ);
}

/**
 * Commit graph hook — loads an initial page of commits and exposes
 * `loadMore` for pagination plus checkout / branch mutations.
 */
export function useCommitGraph(repoPath: string, initialLimit: number = 200) {
  const query = useIpcQuery(
    IPC.LOAD_GIT_COMMIT_GRAPH,
    [{ projectPath: repoPath, limit: initialLimit, skip: 0 }],
    { enabled: !!repoPath }
  );

  const [extra, setExtra] = useState<GitCommitInfo[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Reset pagination state when the repo or the initial query reloads.
  useEffect(() => {
    setExtra([]);
    setHasMore(true);
    setIsLoadingMore(false);
  }, [repoPath, query.dataUpdatedAt]);

  const base = query.data?.commits ?? [];
  const commits = extra.length > 0 ? [...base, ...extra] : base;

  const loadMore = useCallback(async () => {
    if (!repoPath || isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const result = await typedInvoke(IPC.LOAD_GIT_COMMIT_GRAPH, {
        projectPath: repoPath,
        limit: initialLimit,
        skip: base.length + extra.length,
      });
      if (result.error) {
        setHasMore(false);
      } else if (!result.commits || result.commits.length === 0) {
        setHasMore(false);
      } else {
        setExtra((prev) => [...prev, ...result.commits]);
        if (result.commits.length < initialLimit) setHasMore(false);
      }
    } finally {
      setIsLoadingMore(false);
    }
  }, [repoPath, initialLimit, base.length, extra.length, isLoadingMore, hasMore]);

  const checkoutCommit = useIpcMutation(IPC.CHECKOUT_GIT_COMMIT);
  const createBranchAtCommit = useIpcMutation(IPC.CREATE_BRANCH_AT_COMMIT);

  return {
    commits,
    error: query.data?.error ?? null,
    isLoading: query.isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
    refetch: query.refetch,
    checkoutCommit,
    createBranchAtCommit,
  };
}
