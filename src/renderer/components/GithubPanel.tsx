/**
 * GithubPanel — GitHub issues, PRs, branches, and worktrees.
 */

import { useState } from 'react';
import { RefreshCw, GitBranch, ExternalLink, Plus, Trash2, ArrowRight, FolderGit2 } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { cn } from '../lib/utils';
import { useGithubIssues, useGitBranches, useGitWorktrees } from '../hooks/useGithub';
import { useProjectStore } from '../stores/useProjectStore';
import type { GitHubIssue, GitHubLabel, GitBranch as GitBranchType } from '../../shared/ipcChannels';
import { toast } from 'sonner';

/** Get contrasting text color for a hex background color */
function getContrastColor(hex: string): string {
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

const { ipcRenderer } = require('electron');

function formatRelativeTime(dateString: string | undefined): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) return 'just now';
    return `${diffHours}h ago`;
  }
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString();
}

/** @deprecated Use GithubIssuesPanel, GithubPRsPanel, GithubBranchesPanel, GithubWorktreesPanel */
export function GithubPanel() {
  return <GithubIssuesPanel />;
}

function NoProject() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-text-tertiary text-sm gap-1">
      <span>No project selected</span>
    </div>
  );
}

export function GithubIssuesPanel() {
  const projectPath = useProjectStore((s) => s.currentProjectPath);
  if (!projectPath) return <NoProject />;
  return <IssuesTab state="open" />;
}

export function GithubPRsPanel() {
  const projectPath = useProjectStore((s) => s.currentProjectPath);
  if (!projectPath) return <NoProject />;
  return <IssuesTab state="open" isPR />;
}

export function GithubBranchesPanel() {
  const projectPath = useProjectStore((s) => s.currentProjectPath);
  if (!projectPath) return <NoProject />;
  return <BranchesTab />;
}

export function GithubWorktreesPanel() {
  const projectPath = useProjectStore((s) => s.currentProjectPath);
  if (!projectPath) return <NoProject />;
  return <WorktreesTab />;
}

function IssuesTab({ state: initialState = 'open', isPR = false }: { state?: string; isPR?: boolean }) {
  const [filter, setFilter] = useState(initialState);
  const { issues: items, isLoading, refetch } = useGithubIssues(filter);

  const FILTERS = [
    { label: 'Open', value: 'open' },
    { label: 'Closed', value: 'closed' },
    { label: 'All', value: 'all' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Filter bar */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border-subtle shrink-0">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              'px-2 py-0.5 rounded text-xs transition-colors cursor-pointer',
              filter === f.value ? 'bg-accent/20 text-accent' : 'text-text-secondary hover:text-text-primary'
            )}
          >
            {f.label}
          </button>
        ))}
        <div className="flex-1" />
        <Button size="sm" variant="ghost" onClick={() => refetch()} className="h-6 px-1.5 cursor-pointer">
          <RefreshCw size={12} className={cn(isLoading && 'animate-spin')} />
        </Button>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        {isLoading && items.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-text-tertiary text-sm">Loading...</div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-text-tertiary text-sm gap-1">
            <span>No {filter} {isPR ? 'pull requests' : 'issues'}</span>
          </div>
        ) : (
          <div className="flex flex-col">
            {items.map((issue: GitHubIssue) => (
              <button
                key={issue.number}
                onClick={() => ipcRenderer.send('open-github-issue', issue.url)}
                className="flex items-start gap-2.5 px-3 py-2.5 border-b border-border-subtle/50 hover:bg-bg-hover/30 transition-colors text-left cursor-pointer"
              >
                <div className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0',
                  issue.state === 'OPEN' ? 'bg-emerald-400' : 'bg-red-400'
                )} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-text-tertiary">#{issue.number}</span>
                    <span className="text-xs text-text-primary font-medium truncate">{issue.title}</span>
                  </div>
                  {issue.labels?.length > 0 && (
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      {issue.labels.map((label: string | GitHubLabel) => {
                        const name = typeof label === 'string' ? label : label.name;
                        const color = typeof label === 'object' ? label.color : undefined;
                        const bgColor = color ? `#${color}` : undefined;
                        const textColor = color ? getContrastColor(color) : undefined;
                        return (
                          <Badge
                            key={name}
                            variant="secondary"
                            className={cn(
                              'text-[9px] px-1 py-0',
                              !color && 'bg-bg-hover text-text-secondary'
                            )}
                            style={color ? { backgroundColor: bgColor, color: textColor } : undefined}
                          >
                            {name}
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                  <div className="text-[10px] text-text-tertiary mt-1">
                    opened {formatRelativeTime(issue.createdAt)}
                    {issue.author?.login && ` by ${issue.author.login}`}
                  </div>
                </div>
                <ExternalLink size={12} className="text-text-tertiary shrink-0 mt-1" />
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function BranchesTab() {
  const { branches: branchList, isLoading, refetch, switchBranch, createBranch, deleteBranch } = useGitBranches();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [checkout, setCheckout] = useState(true);

  const localBranches = branchList.filter((b) => !b.isRemote);
  const remoteBranches = branchList.filter((b) => b.isRemote);

  async function handleSwitch(branchName: string) {
    const projectPath = useProjectStore.getState().currentProjectPath;
    if (!projectPath) return;
    try {
      const result = await switchBranch.mutateAsync([{ projectPath, branchName }]);
      if (result.error) {
        toast.error(`Failed: ${result.error}`);
      } else {
        toast.success(`Switched to ${branchName}`);
      }
    } catch {
      toast.error('Failed to switch branch');
    }
  }

  async function handleDelete(branchName: string) {
    if (!window.confirm(`Delete branch "${branchName}"?`)) return;
    const projectPath = useProjectStore.getState().currentProjectPath;
    if (!projectPath) return;
    try {
      const result = await deleteBranch.mutateAsync([{ projectPath, branchName, force: false }]);
      if (result.error) {
        if (window.confirm(`Branch is not fully merged. Force delete?`)) {
          await deleteBranch.mutateAsync([{ projectPath, branchName, force: true }]);
          toast.success(`Deleted ${branchName}`);
        }
      } else {
        toast.success(`Deleted ${branchName}`);
      }
    } catch {
      toast.error('Failed to delete branch');
    }
  }

  async function handleCreate() {
    if (!newBranchName.trim()) return;
    const projectPath = useProjectStore.getState().currentProjectPath;
    if (!projectPath) return;
    try {
      const result = await createBranch.mutateAsync([{
        projectPath,
        branchName: newBranchName.trim(),
        checkout,
      }]);
      if (result.error) {
        toast.error(`Failed: ${result.error}`);
      } else {
        toast.success(`Created ${newBranchName.trim()}`);
        setCreateDialogOpen(false);
        setNewBranchName('');
      }
    } catch {
      toast.error('Failed to create branch');
    }
  }

  function renderBranch(branch: GitBranchType) {
    const isCurrent = branch.isCurrent;
    return (
      <div
        key={branch.name}
        className={cn(
          'flex items-center gap-2 px-3 py-2 border-b border-border-subtle/50 hover:bg-bg-hover/30 transition-colors group',
          isCurrent && 'bg-accent/5'
        )}
      >
        <div className="w-3 shrink-0">
          {isCurrent && <div className="w-2 h-2 rounded-full bg-accent" />}
        </div>
        <div className="flex-1 min-w-0">
          <span className={cn('text-xs', isCurrent ? 'text-accent font-medium' : 'text-text-primary')}>
            {branch.name}
          </span>
        </div>
        {!isCurrent && (
          <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => handleSwitch(branch.name)}
              className="p-1 text-text-tertiary hover:text-accent cursor-pointer"
              title="Switch to branch"
            >
              <ArrowRight size={12} />
            </button>
            {!branch.isRemote && (
              <button
                onClick={() => handleDelete(branch.name)}
                className="p-1 text-text-tertiary hover:text-red-400 cursor-pointer"
                title="Delete branch"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border-subtle shrink-0">
        <span className="text-xs text-text-secondary">{branchList.length} branches</span>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => setCreateDialogOpen(true)} className="h-6 px-1.5 cursor-pointer">
            <Plus size={12} />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => refetch()} className="h-6 px-1.5 cursor-pointer">
            <RefreshCw size={12} className={cn(isLoading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        {isLoading && branchList.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-text-tertiary text-sm">Loading...</div>
        ) : branchList.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-text-tertiary text-sm gap-1">
            <GitBranch size={24} className="opacity-40" />
            <span>No branches found</span>
          </div>
        ) : (
          <div>
            {localBranches.length > 0 && (
              <div>
                <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-text-tertiary font-medium bg-bg-deep/50">
                  Local
                </div>
                {localBranches.map(renderBranch)}
              </div>
            )}
            {remoteBranches.length > 0 && (
              <div>
                <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-text-tertiary font-medium bg-bg-deep/50">
                  Remote
                </div>
                {remoteBranches.map(renderBranch)}
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Create branch dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="bg-bg-primary border-border-subtle text-text-primary sm:max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Create Branch</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div>
              <label className="text-xs text-text-secondary mb-1 block">Branch Name</label>
              <Input
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                placeholder="feature/my-branch"
                className="bg-bg-deep border-border-subtle text-sm"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="checkout-new"
                checked={checkout}
                onChange={(e) => setCheckout(e.target.checked)}
                className="accent-accent"
              />
              <label htmlFor="checkout-new" className="text-xs text-text-secondary">
                Switch to new branch
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateDialogOpen(false)} className="cursor-pointer">Cancel</Button>
            <Button onClick={handleCreate} disabled={!newBranchName.trim()} className="bg-accent text-bg-deep hover:bg-accent/80 cursor-pointer">
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WorktreesTab() {
  const { worktrees: worktreeList, isLoading, refetch, removeWorktree } = useGitWorktrees();

  async function handleRemove(wtPath: string) {
    if (!window.confirm(`Remove worktree at "${wtPath}"?`)) return;
    const projectPath = useProjectStore.getState().currentProjectPath;
    if (!projectPath) return;
    try {
      const result = await removeWorktree.mutateAsync([{ projectPath, worktreePath: wtPath, force: false }]);
      if (result.error) {
        if (window.confirm('Worktree has local changes. Force remove?')) {
          await removeWorktree.mutateAsync([{ projectPath, worktreePath: wtPath, force: true }]);
        }
      }
      toast.success('Worktree removed');
    } catch {
      toast.error('Failed to remove worktree');
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-end px-3 py-1.5 border-b border-border-subtle shrink-0">
        <Button size="sm" variant="ghost" onClick={() => refetch()} className="h-6 px-1.5 cursor-pointer">
          <RefreshCw size={12} className={cn(isLoading && 'animate-spin')} />
        </Button>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        {isLoading && worktreeList.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-text-tertiary text-sm">Loading...</div>
        ) : worktreeList.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-text-tertiary text-sm gap-1">
            <FolderGit2 size={24} className="opacity-40" />
            <span>No worktrees</span>
            <span className="text-xs opacity-60">Add a worktree to work on multiple branches</span>
          </div>
        ) : (
          <div className="flex flex-col">
            {worktreeList.map((wt) => {
              const pathName = wt.path.split(/[/\\]/).pop() || wt.path;
              const isMain = wt.isMain;
              return (
                <div
                  key={wt.path}
                  className="flex items-center gap-2.5 px-3 py-2.5 border-b border-border-subtle/50 hover:bg-bg-hover/30 transition-colors group"
                >
                  <FolderGit2 size={14} className="text-text-tertiary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-text-primary">{pathName}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-text-tertiary">{wt.branch || 'detached'}</span>
                      {isMain && (
                        <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-accent/20 text-accent">main</Badge>
                      )}
                    </div>
                    <div className="text-[10px] text-text-tertiary truncate mt-0.5">{wt.path}</div>
                  </div>
                  {!isMain && (
                    <button
                      onClick={() => handleRemove(wt.path)}
                      className="p-1 text-text-tertiary hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                      title="Remove worktree"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
