/**
 * TanStack Query hooks for GitHub integration (issues, branches, worktrees).
 */

import { useIpcQuery, useIpcMutation } from './useIpc';
import { useProjectStore } from '../stores/useProjectStore';
import { IPC } from '../../shared/ipcChannels';

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
