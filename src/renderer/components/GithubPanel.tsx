/**
 * GithubPanel — GitHub issues, PRs, branches, and worktrees.
 */

import { useState } from 'react';
import { RefreshCw, GitBranch, ExternalLink, Plus, Trash2, ArrowRight, FolderGit2, AlertCircle, Check, ChevronDown, ChevronRight, List, FolderTree, Folder, FolderOpen, FileSearch, Copy } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from './ui/context-menu';
import { cn } from '../lib/utils';
import { useGithubIssues, useGitBranches, useGitWorktrees, useGitStatus } from '../hooks/useGithub';
import { useProjectStore } from '../stores/useProjectStore';
import { useUIStore } from '../stores/useUIStore';
import type { GitHubIssue, GitHubLabel, GitBranch as GitBranchType, GitFileStatus } from '../../shared/ipcChannels';
import { toast } from 'sonner';

/** Get contrasting text color for a hex background color */
function getContrastColor(hex: string): string {
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

const { ipcRenderer, shell } = require('electron');

type ViewMode = 'flat' | 'tree';

interface TreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children: TreeNode[];
  file?: GitFileStatus;
}

/** Build a nested tree structure from flat file paths */
function buildFileTree(files: GitFileStatus[], statusField: 'index' | 'working'): TreeNode[] {
  const root: TreeNode = { name: '', path: '', isDir: true, children: [] };

  for (const file of files) {
    const parts = file.path.split(/[/\\]/).filter(Boolean);
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;
      const partPath = parts.slice(0, i + 1).join('/');

      if (isFile) {
        current.children.push({
          name: part,
          path: partPath,
          isDir: false,
          children: [],
          file,
        });
      } else {
        let dir = current.children.find((c) => c.isDir && c.name === part);
        if (!dir) {
          dir = { name: part, path: partPath, isDir: true, children: [] };
          current.children.push(dir);
        }
        current = dir;
      }
    }
  }

  // Sort: directories first, then files, alphabetical within each group
  function sortTree(nodes: TreeNode[]): TreeNode[] {
    return nodes
      .map((n) => (n.isDir ? { ...n, children: sortTree(n.children) } : n))
      .sort((a, b) => {
        if (a.isDir && !b.isDir) return -1;
        if (!a.isDir && b.isDir) return 1;
        return a.name.localeCompare(b.name);
      });
  }

  return sortTree(root.children);
}

/** Count total files (leaves) in a tree node */
function countFiles(nodes: TreeNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.isDir) {
      count += countFiles(node.children);
    } else {
      count += 1;
    }
  }
  return count;
}

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

export function GithubChangesPanel() {
  const projectPath = useProjectStore((s) => s.currentProjectPath);
  if (!projectPath) return <NoProject />;
  return <ChangesTab />;
}

function FileTreeNodeView({ node, depth, color, statusField, expanded, onToggleDir, projectPath }: {
  node: TreeNode;
  depth: number;
  color: string;
  statusField: 'index' | 'working';
  expanded: Set<string>;
  onToggleDir: (path: string) => void;
  projectPath: string;
}) {
  if (node.isDir) {
    const isOpen = expanded.has(node.path);
    const fileCount = countFiles(node.children);
    return (
      <div>
        <button
          onClick={() => onToggleDir(node.path)}
          className="flex items-center gap-1.5 w-full py-1 hover:bg-bg-hover/30 transition-colors cursor-pointer"
          style={{ paddingLeft: `${(depth * 16) + 12}px`, paddingRight: '12px' }}
        >
          {isOpen ? <ChevronDown size={10} className="text-text-tertiary shrink-0" /> : <ChevronRight size={10} className="text-text-tertiary shrink-0" />}
          {isOpen ? <FolderOpen size={12} className="text-text-tertiary shrink-0" /> : <Folder size={12} className="text-text-tertiary shrink-0" />}
          <span className="text-xs text-text-secondary truncate">{node.name}</span>
          <span className="text-[10px] text-text-tertiary ml-auto shrink-0">{fileCount}</span>
        </button>
        {isOpen && node.children.map((child) => (
          <FileTreeNodeView
            key={child.path}
            node={child}
            depth={depth + 1}
            color={color}
            statusField={statusField}
            expanded={expanded}
            onToggleDir={onToggleDir}
            projectPath={projectPath}
          />
        ))}
      </div>
    );
  }

  // File node
  const status = node.file?.[statusField] ?? '';
  const sep = projectPath.includes('\\') ? '\\' : '/';
  const base = projectPath.endsWith(sep) ? projectPath : projectPath + sep;
  const absolutePath = base + node.path.replace(/[/\\]/g, sep);
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className="flex items-center gap-1.5 py-1 border-b border-border-subtle/30 hover:bg-bg-hover/30 transition-colors group cursor-default"
          style={{ paddingLeft: `${(depth * 16) + 12}px`, paddingRight: '12px' }}
          title={node.path}
        >
          <span className="w-[10px] shrink-0" />
          <span className={cn('text-[10px] font-mono w-3 shrink-0 text-center font-bold', color)}>
            {status}
          </span>
          <span className="text-xs text-text-primary truncate">{node.name}</span>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="bg-bg-elevated border-border-subtle">
        <ContextMenuItem onClick={() => useUIStore.getState().setEditorFilePath(absolutePath)} className="text-xs gap-2">
          <FileSearch className="w-3.5 h-3.5" />Open in Editor
        </ContextMenuItem>
        <ContextMenuItem onClick={() => navigator.clipboard.writeText(node.path).then(() => toast.success('Path copied'), () => toast.error('Failed to copy path'))} className="text-xs gap-2">
          <Copy className="w-3.5 h-3.5" />Copy Path
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => shell.showItemInFolder(absolutePath)} className="text-xs gap-2">
          <ExternalLink className="w-3.5 h-3.5" />Reveal in Explorer
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

function FileGroup({ label, count, color, dotColor, files, statusField, open, onToggle, viewMode, projectPath }: {
  label: string;
  count: number;
  color: string;
  dotColor: string;
  files: GitFileStatus[];
  statusField: 'index' | 'working';
  open: boolean;
  onToggle: () => void;
  viewMode: ViewMode;
  projectPath: string;
}) {
  const [treeExpanded, setTreeExpanded] = useState<Set<string>>(() => new Set());

  function handleToggleDir(path: string) {
    setTreeExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  const tree = viewMode === 'tree' ? buildFileTree(files, statusField) : [];

  return (
    <div>
      <button
        onClick={onToggle}
        className="flex items-center gap-2 w-full px-3 py-1.5 text-[10px] uppercase tracking-wider font-medium bg-bg-deep/50 hover:bg-bg-hover/30 transition-colors cursor-pointer"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <div className={cn('w-1.5 h-1.5 rounded-full', dotColor)} />
        <span className={color}>{label}</span>
        <span className="text-text-tertiary ml-auto">{count}</span>
      </button>
      {open && viewMode === 'flat' && files.map((file) => {
        const status = file[statusField];
        const fileName = file.path.split(/[/\\]/).pop() || file.path;
        const dirName = file.path.includes('/') || file.path.includes('\\')
          ? file.path.split(/[/\\]/).slice(0, -1).join('/') + '/'
          : '';
        const sep = projectPath.includes('\\') ? '\\' : '/';
        const base = projectPath.endsWith(sep) ? projectPath : projectPath + sep;
        const absolutePath = base + file.path.replace(/[/\\]/g, sep);
        return (
          <ContextMenu key={file.path + statusField}>
            <ContextMenuTrigger asChild>
              <div
                className="flex items-center gap-2 px-3 py-1.5 pl-7 border-b border-border-subtle/30 hover:bg-bg-hover/30 transition-colors group"
                title={file.path}
              >
                <span className={cn('text-[10px] font-mono w-3 shrink-0 text-center font-bold', color)}>
                  {status}
                </span>
                <span className="text-xs text-text-secondary truncate">
                  {dirName && <span className="text-text-tertiary">{dirName}</span>}
                  <span className="text-text-primary">{fileName}</span>
                </span>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent className="bg-bg-elevated border-border-subtle">
              <ContextMenuItem onClick={() => useUIStore.getState().setEditorFilePath(absolutePath)} className="text-xs gap-2">
                <FileSearch className="w-3.5 h-3.5" />Open in Editor
              </ContextMenuItem>
              <ContextMenuItem onClick={() => navigator.clipboard.writeText(file.path).then(() => toast.success('Path copied'), () => toast.error('Failed to copy path'))} className="text-xs gap-2">
                <Copy className="w-3.5 h-3.5" />Copy Path
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => shell.showItemInFolder(absolutePath)} className="text-xs gap-2">
                <ExternalLink className="w-3.5 h-3.5" />Reveal in Explorer
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        );
      })}
      {open && viewMode === 'tree' && tree.map((node) => (
        <FileTreeNodeView
          key={node.path}
          node={node}
          depth={1}
          color={color}
          statusField={statusField}
          expanded={treeExpanded}
          onToggleDir={handleToggleDir}
          projectPath={projectPath}
        />
      ))}
    </div>
  );
}

function ChangesTab() {
  const projectPath = useProjectStore((s) => s.currentProjectPath) || '';
  const { files, staged, modified, untracked, error, isLoading, refetch } = useGitStatus();
  const [stagedOpen, setStagedOpen] = useState(true);
  const [modifiedOpen, setModifiedOpen] = useState(true);
  const [untrackedOpen, setUntrackedOpen] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('flat');

  const stagedFiles = files.filter((f: GitFileStatus) => f.index !== ' ' && f.index !== '?');
  const modifiedFiles = files.filter((f: GitFileStatus) => f.working === 'M' || f.working === 'D');
  const untrackedFiles = files.filter((f: GitFileStatus) => f.index === '?' && f.working === '?');

  const hasChanges = stagedFiles.length > 0 || modifiedFiles.length > 0 || untrackedFiles.length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Summary bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border-subtle shrink-0">
        <div className="flex items-center gap-2 text-xs">
          {staged > 0 && <span className="text-emerald-400">+{staged} staged</span>}
          {modified > 0 && <span className="text-amber-400">~{modified} modified</span>}
          {untracked > 0 && <span className="text-text-tertiary">?{untracked} untracked</span>}
          {!hasChanges && !isLoading && <span className="text-text-tertiary">Clean</span>}
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setViewMode(viewMode === 'flat' ? 'tree' : 'flat')}
            className={cn('h-6 px-1.5 cursor-pointer', viewMode === 'tree' && 'text-accent')}
            title={viewMode === 'flat' ? 'Switch to tree view' : 'Switch to flat view'}
          >
            {viewMode === 'flat' ? <FolderTree size={12} /> : <List size={12} />}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => refetch()} className="h-6 px-1.5 cursor-pointer">
            <RefreshCw size={12} className={cn(isLoading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        {error ? (
          <div className="flex flex-col items-center justify-center gap-2 text-text-tertiary p-6">
            <AlertCircle className="w-5 h-5 text-error/60" />
            <p className="text-xs text-center">Failed to load git status</p>
            <button onClick={() => refetch()} className="text-xs text-accent hover:underline cursor-pointer">Retry</button>
          </div>
        ) : !hasChanges && !isLoading ? (
          <div className="flex flex-col items-center justify-center h-32 text-text-tertiary text-sm gap-2">
            <Check size={24} className="text-emerald-400/60" />
            <span>Working tree clean</span>
          </div>
        ) : (
          <div>
            {stagedFiles.length > 0 && (
              <FileGroup
                label="Staged"
                count={stagedFiles.length}
                color="text-emerald-400"
                dotColor="bg-emerald-400"
                files={stagedFiles}
                statusField="index"
                open={stagedOpen}
                onToggle={() => setStagedOpen(!stagedOpen)}
                viewMode={viewMode}
                projectPath={projectPath}
              />
            )}
            {modifiedFiles.length > 0 && (
              <FileGroup
                label="Modified"
                count={modifiedFiles.length}
                color="text-amber-400"
                dotColor="bg-amber-400"
                files={modifiedFiles}
                statusField="working"
                open={modifiedOpen}
                onToggle={() => setModifiedOpen(!modifiedOpen)}
                viewMode={viewMode}
                projectPath={projectPath}
              />
            )}
            {untrackedFiles.length > 0 && (
              <FileGroup
                label="Untracked"
                count={untrackedFiles.length}
                color="text-text-tertiary"
                dotColor="bg-text-tertiary"
                files={untrackedFiles}
                statusField="working"
                open={untrackedOpen}
                onToggle={() => setUntrackedOpen(!untrackedOpen)}
                viewMode={viewMode}
                projectPath={projectPath}
              />
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function IssuesTab({ state: initialState = 'open', isPR = false }: { state?: string; isPR?: boolean }) {
  const [filter, setFilter] = useState(initialState);
  const { issues: items, error, isLoading, refetch } = useGithubIssues(filter);

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
        {error ? (
          <div className="flex flex-col items-center justify-center gap-2 text-text-tertiary p-6">
            <AlertCircle className="w-5 h-5 text-error/60" />
            <p className="text-xs text-center">
              {error.includes('not a git repository') || error.includes('No remote')
                ? 'This project is not a git repository or has no remote configured'
                : `Failed to load ${isPR ? 'pull requests' : 'issues'}`}
            </p>
            <button
              onClick={() => refetch()}
              className="text-xs text-accent hover:underline cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : isLoading && items.length === 0 ? (
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
          try {
            await deleteBranch.mutateAsync([{ projectPath, branchName, force: true }]);
            toast.success(`Deleted ${branchName}`);
          } catch {
            toast.error('Failed to force-delete branch');
          }
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
            <DialogClose asChild><Button variant="ghost" className="cursor-pointer">Cancel</Button></DialogClose>
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
          try {
            await removeWorktree.mutateAsync([{ projectPath, worktreePath: wtPath, force: true }]);
            toast.success('Worktree force-removed');
          } catch {
            toast.error('Failed to force-remove worktree');
          }
        }
      } else {
        toast.success('Worktree removed');
      }
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
