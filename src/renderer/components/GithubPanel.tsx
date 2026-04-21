/**
 * GithubPanel — GitHub issues, PRs, branches, worktrees, workflows, and notifications.
 */

import { useState, useCallback, useMemo } from 'react';
import {
  RefreshCw, GitBranch, ExternalLink, Plus, Trash2, ArrowRight, FolderGit2,
  AlertCircle, Check, ChevronDown, ChevronRight, ChevronUp, List, FolderTree,
  Folder, FolderOpen, FileSearch, Copy, CheckCircle, XCircle, MinusCircle,
  Circle, Loader2, Send, Bot, SquareCheckBig, Play, Bell, Eye, RotateCcw,
} from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from './ui/context-menu';
import { cn } from '../lib/utils';
import {
  useGithubIssues, useGithubPRs, useGitBranches, useGitWorktrees, useGitStatus, useGithubWorkflows,
  useGithubIssueDetail, useGithubPRDetail, useGithubPRDiff, useCreateGithubIssue,
  useRerunWorkflow, useDispatchWorkflow, useGithubNotifications, useMarkNotificationRead,
} from '../hooks/useGithub';
import { useProjectStore } from '../stores/useProjectStore';
import { useUIStore } from '../stores/useUIStore';
import { useTerminalStore } from '../stores/useTerminalStore';
import type {
  GitHubIssue, GitHubLabel, GitBranch as GitBranchType, GitFileStatus,
  GitHubWorkflow, GitHubWorkflowRun, GitHubNotification,
} from '../../shared/ipcChannels';
import { IPC } from '../../shared/ipcChannels';
import { toast } from 'sonner';
import { MarkdownPreview } from './previews/MarkdownPreview';
import { CommitGraph } from './CommitGraph';

function getContrastColor(hex: string): string {
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

import { getTransport } from '../lib/transportProvider';

type ViewMode = 'flat' | 'tree';

interface TreeNode { name: string; path: string; isDir: boolean; children: TreeNode[]; file?: GitFileStatus; }

function buildFileTree(files: GitFileStatus[], statusField: 'index' | 'working'): TreeNode[] {
  const root: TreeNode = { name: '', path: '', isDir: true, children: [] };
  for (const file of files) {
    const parts = file.path.split(/[/\\]/).filter(Boolean);
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;
      const partPath = parts.slice(0, i + 1).join('/');
      if (isFile) { current.children.push({ name: part, path: partPath, isDir: false, children: [], file }); }
      else {
        let dir = current.children.find((c) => c.isDir && c.name === part);
        if (!dir) { dir = { name: part, path: partPath, isDir: true, children: [] }; current.children.push(dir); }
        current = dir;
      }
    }
  }
  function sortTree(nodes: TreeNode[]): TreeNode[] {
    return nodes.map((n) => (n.isDir ? { ...n, children: sortTree(n.children) } : n))
      .sort((a, b) => { if (a.isDir && !b.isDir) return -1; if (!a.isDir && b.isDir) return 1; return a.name.localeCompare(b.name); });
  }
  return sortTree(root.children);
}

function countFiles(nodes: TreeNode[]): number {
  let count = 0;
  for (const node of nodes) { if (node.isDir) count += countFiles(node.children); else count += 1; }
  return count;
}

function formatRelativeTime(dateString: string | undefined): string {
  if (!dateString) return '';
  const date = new Date(dateString); const now = new Date();
  const diffMs = now.getTime() - date.getTime(); const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) { const diffHours = Math.floor(diffMs / (1000 * 60 * 60)); if (diffHours === 0) return 'just now'; return `${diffHours}h ago`; }
  if (diffDays === 1) return 'yesterday'; if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`; return date.toLocaleDateString();
}

function formatIssuePrompt(issue: GitHubIssue, body?: string): string {
  const labels = issue.labels?.map((l) => typeof l === 'string' ? l : l.name).join(', ');
  const lines = [`GitHub Issue #${issue.number}: ${issue.title}`, `State: ${issue.state}${labels ? ` | Labels: ${labels}` : ''}${issue.author?.login ? ` | Author: ${issue.author.login}` : ''}`];
  if (body) lines.push('', body);
  return lines.join('\n');
}

/** @deprecated Use GithubIssuesPanel, GithubPRsPanel, etc. */
export function GithubPanel() { return <GithubIssuesPanel />; }

function NoProject() { return <div className="flex flex-col items-center justify-center h-full text-text-tertiary text-sm gap-1"><span>No project selected</span></div>; }

function GitSyncStatus() {
  const { branch, ahead, behind, staged, modified, untracked, error } = useGitStatus();
  if (error || !branch) return null;
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border-subtle text-[10px]">
      <GitBranch size={12} className="text-text-tertiary" />
      <span className="text-text-secondary font-medium">{branch}</span>
      {ahead > 0 && <span className="text-success">↑{ahead}</span>}
      {behind > 0 && <span className="text-warning">↓{behind}</span>}
      {ahead === 0 && behind === 0 && <span className="text-text-muted">Up to date</span>}
      <span className="ml-auto text-text-muted">{staged + modified + untracked > 0 ? `${staged + modified + untracked} changed` : 'Clean'}</span>
    </div>
  );
}

export function GithubIssuesPanel() { const p = useProjectStore((s) => s.currentProjectPath); if (!p) return <NoProject />; return <div className="flex flex-col h-full"><GitSyncStatus /><div className="flex-1 min-h-0"><IssuesTab state="open" /></div></div>; }
export function GithubPRsPanel() { const p = useProjectStore((s) => s.currentProjectPath); if (!p) return <NoProject />; return <div className="flex flex-col h-full"><GitSyncStatus /><div className="flex-1 min-h-0"><IssuesTab state="open" isPR /></div></div>; }
export function GithubBranchesPanel() { const p = useProjectStore((s) => s.currentProjectPath); if (!p) return <NoProject />; return <div className="flex flex-col h-full"><GitSyncStatus /><div className="flex-1 min-h-0"><BranchesTab /></div></div>; }
export function GithubWorktreesPanel() { const p = useProjectStore((s) => s.currentProjectPath); if (!p) return <NoProject />; return <div className="flex flex-col h-full"><GitSyncStatus /><div className="flex-1 min-h-0"><WorktreesTab /></div></div>; }
export function GithubChangesPanel() { const p = useProjectStore((s) => s.currentProjectPath); if (!p) return <NoProject />; return <div className="flex flex-col h-full"><GitSyncStatus /><div className="flex-1 min-h-0"><ChangesTab /></div></div>; }
export function GithubGraphPanel() { const p = useProjectStore((s) => s.currentProjectPath); if (!p) return <NoProject />; return <div className="flex flex-col h-full"><GitSyncStatus /><div className="flex-1 min-h-0"><CommitGraph repoPath={p} /></div></div>; }

// ─── Issue Detail View ───────────────────────────────────────────────────────

function IssueDetailView({ issueNumber, isPR }: { issueNumber: number; isPR: boolean }) {
  const { issue, isLoading, error } = useGithubIssueDetail(isPR ? null : issueNumber);
  const { pr, isLoading: prLoading, error: prError } = useGithubPRDetail(isPR ? issueNumber : null);
  const { diff, isLoading: diffLoading } = useGithubPRDiff(isPR ? issueNumber : null);
  const detail = isPR ? pr : issue; const loading = isPR ? prLoading : isLoading; const err = isPR ? prError : error;
  if (loading) return <div className="px-4 py-3 text-xs text-text-tertiary flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> Loading...</div>;
  if (err || !detail) return <div className="px-4 py-3 text-xs text-error/70">{err || 'Failed to load details'}</div>;

  const activeTerminalId = useTerminalStore.getState().activeTerminalId;
  const handleSendToAgent = () => {
    if (!activeTerminalId) { toast.warning('No active terminal'); return; }
    const prompt = formatIssuePrompt({ number: detail.number, title: detail.title, state: detail.state, url: detail.url, labels: detail.labels, createdAt: detail.createdAt, author: detail.author }, detail.body || undefined) + '\n\nPlease investigate this and implement the requested changes.';
    getTransport().send(IPC.TERMINAL_INPUT_ID, { terminalId: activeTerminalId, data: prompt + '\r' });
    toast.info(`Issue #${detail.number} sent to agent`);
  };
  const handleSendPRForReview = () => {
    if (!activeTerminalId || !pr) { toast.warning('No active terminal'); return; }
    let prompt = `Please review this Pull Request:\n\nPR #${pr.number}: ${pr.title}\nBranch: ${pr.headRefName} → ${pr.baseRefName}\nChanges: +${pr.additions} -${pr.deletions} across ${pr.changedFiles} files\nReview Status: ${pr.reviewDecision || 'PENDING'}`;
    if (pr.body) prompt += `\n\n## Description\n${pr.body}`;
    if (diff?.diff) { const td = diff.diff.length > 8000 ? diff.diff.slice(0, 8000) + '\n... (diff truncated)' : diff.diff; prompt += `\n\n## Diff\n\`\`\`diff\n${td}\n\`\`\``; }
    prompt += '\n\nPlease provide a thorough code review with specific feedback.';
    getTransport().send(IPC.TERMINAL_INPUT_ID, { terminalId: activeTerminalId, data: prompt + '\r' });
    toast.info(`PR #${pr.number} sent for review`);
  };

  return (
    <div className="px-4 py-3 bg-bg-deep/50 border-b border-border-subtle space-y-3">
      {detail.assignees?.length > 0 && <div className="flex items-center gap-1.5 text-[10px]"><span className="text-text-tertiary">Assignees:</span>{detail.assignees.map((a) => <Badge key={a.login} variant="secondary" className="text-[9px] px-1 py-0 bg-bg-hover text-text-secondary">{a.login}</Badge>)}</div>}
      {isPR && pr && <div className="flex items-center gap-3 text-[10px] text-text-tertiary"><span>{pr.headRefName} → {pr.baseRefName}</span><span className="text-emerald-400">+{pr.additions}</span><span className="text-red-400">-{pr.deletions}</span><span>{pr.changedFiles} files</span>{pr.reviewDecision && <Badge variant="secondary" className={cn('text-[9px] px-1 py-0', pr.reviewDecision === 'APPROVED' ? 'bg-emerald-400/20 text-emerald-400' : 'bg-amber-400/20 text-amber-400')}>{pr.reviewDecision}</Badge>}</div>}
      {isPR && diff && diff.files.length > 0 && <div className="space-y-0.5"><span className="text-[10px] text-text-tertiary font-medium">Files Changed:</span><div className="max-h-24 overflow-y-auto space-y-0.5">{diff.files.map((f) => <div key={f.path} className="flex items-center gap-2 text-[10px]"><span className="text-emerald-400">+{f.additions}</span><span className="text-red-400">-{f.deletions}</span><span className="text-text-secondary truncate">{f.path}</span></div>)}</div></div>}
      {detail.body ? <div className="text-xs max-h-48 overflow-y-auto rounded border border-border-subtle/50 bg-bg-primary/50 p-2"><MarkdownPreview content={detail.body} /></div> : <div className="text-[10px] text-text-muted italic">No description provided.</div>}
      {detail.comments?.length > 0 && <div className="space-y-2"><span className="text-[10px] text-text-tertiary font-medium">{detail.comments.length} comment{detail.comments.length !== 1 ? 's' : ''}</span><div className="max-h-40 overflow-y-auto space-y-2">{detail.comments.map((c) => <div key={c.id} className="rounded border border-border-subtle/50 bg-bg-primary/50 p-2"><div className="flex items-center gap-1.5 mb-1 text-[10px]"><span className="font-medium text-text-secondary">{c.author?.login ?? 'unknown'}</span><span className="text-text-muted">{formatRelativeTime(c.createdAt)}</span></div><div className="text-xs"><MarkdownPreview content={c.body} /></div></div>)}</div></div>}
      <div className="flex items-center gap-2 pt-1">
        <Button size="sm" variant="ghost" onClick={handleSendToAgent} className="h-6 px-2 text-[10px] gap-1 cursor-pointer text-accent hover:text-accent"><Bot size={12} /> Send to Agent</Button>
        {isPR && pr && <Button size="sm" variant="ghost" onClick={handleSendPRForReview} disabled={diffLoading} className="h-6 px-2 text-[10px] gap-1 cursor-pointer text-accent hover:text-accent">{diffLoading ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Send for Review</Button>}
        <Button size="sm" variant="ghost" onClick={() => getTransport().platform.openExternal(detail.url)} className="h-6 px-2 text-[10px] gap-1 cursor-pointer"><ExternalLink size={12} /> Open in Browser</Button>
      </div>
    </div>
  );
}

// ─── Create Issue Dialog ─────────────────────────────────────────────────────

function CreateIssueDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; onCreated: () => void }) {
  const projectPath = useProjectStore((s) => s.currentProjectPath) ?? '';
  const createIssue = useCreateGithubIssue();
  const [title, setTitle] = useState(''); const [body, setBody] = useState(''); const [labels, setLabels] = useState(''); const [assignees, setAssignees] = useState('');
  const handleCreate = async () => {
    if (!title.trim()) return;
    try {
      const result = await createIssue.mutateAsync([{ projectPath, title: title.trim(), body: body.trim() || undefined, labels: labels.trim() ? labels.split(',').map((l) => l.trim()).filter(Boolean) : undefined, assignees: assignees.trim() ? assignees.split(',').map((a) => a.trim()).filter(Boolean) : undefined }]);
      if (result.error) toast.error(`Failed: ${result.error}`);
      else { toast.success(`Created issue${result.url ? `: ${result.url}` : ''}`); setTitle(''); setBody(''); setLabels(''); setAssignees(''); onOpenChange(false); onCreated(); }
    } catch { toast.error('Failed to create issue'); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-bg-primary border-border-subtle text-text-primary sm:max-w-md" showCloseButton={false}>
        <DialogHeader><DialogTitle>Create Issue</DialogTitle><DialogDescription className="text-text-secondary text-xs">Create a new GitHub issue for this repository.</DialogDescription></DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          <div><label className="text-xs text-text-secondary mb-1 block">Title *</label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Issue title" className="bg-bg-deep border-border-subtle text-sm" autoFocus /></div>
          <div><label className="text-xs text-text-secondary mb-1 block">Description</label><textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Describe the issue (markdown supported)" className="w-full bg-bg-deep border border-border-subtle rounded-md text-sm p-2 min-h-[80px] resize-y text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent/50" rows={4} /></div>
          <div><label className="text-xs text-text-secondary mb-1 block">Labels</label><Input value={labels} onChange={(e) => setLabels(e.target.value)} placeholder="bug, enhancement (comma-separated)" className="bg-bg-deep border-border-subtle text-sm" /></div>
          <div><label className="text-xs text-text-secondary mb-1 block">Assignees</label><Input value={assignees} onChange={(e) => setAssignees(e.target.value)} placeholder="username1, username2" className="bg-bg-deep border-border-subtle text-sm" /></div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="ghost" className="cursor-pointer">Cancel</Button></DialogClose>
          <Button onClick={handleCreate} disabled={!title.trim() || createIssue.isPending} className="bg-accent text-bg-deep hover:bg-accent/80 cursor-pointer">{createIssue.isPending ? <Loader2 size={14} className="animate-spin mr-1" /> : null}Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Bulk Send Dialog ────────────────────────────────────────────────────────

function BulkSendDialog({ open, onOpenChange, issues }: { open: boolean; onOpenChange: (open: boolean) => void; issues: GitHubIssue[] }) {
  const [wrapper, setWrapper] = useState(`Here are ${issues.length} GitHub issues to review and implement:`);
  const activeTerminalId = useTerminalStore((s) => s.activeTerminalId);
  const handleSend = () => {
    if (!activeTerminalId) { toast.warning('No active terminal'); return; }
    const parts = issues.map((issue) => formatIssuePrompt(issue));
    getTransport().send(IPC.TERMINAL_INPUT_ID, { terminalId: activeTerminalId, data: `${wrapper}\n\n${parts.join('\n\n---\n\n')}\r` });
    toast.info(`${issues.length} issues sent to agent`); onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-bg-primary border-border-subtle text-text-primary sm:max-w-md" showCloseButton={false}>
        <DialogHeader><DialogTitle>Send {issues.length} Issues to Agent</DialogTitle><DialogDescription className="text-text-secondary text-xs">Customize the wrapper prompt, then send all selected issues.</DialogDescription></DialogHeader>
        <div className="py-2">
          <label className="text-xs text-text-secondary mb-1 block">Wrapper prompt</label>
          <textarea value={wrapper} onChange={(e) => setWrapper(e.target.value)} className="w-full bg-bg-deep border border-border-subtle rounded-md text-sm p-2 min-h-[60px] resize-y text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent/50" rows={2} />
          <div className="mt-2 text-[10px] text-text-muted">{issues.map((i) => `#${i.number}`).join(', ')}</div>
        </div>
        <DialogFooter><DialogClose asChild><Button variant="ghost" className="cursor-pointer">Cancel</Button></DialogClose><Button onClick={handleSend} className="bg-accent text-bg-deep hover:bg-accent/80 cursor-pointer gap-1"><Send size={12} /> Send</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Issues Tab ──────────────────────────────────────────────────────────────

function IssuesTab({ state: initialState = 'open', isPR = false }: { state?: string; isPR?: boolean }) {
  const [filter, setFilter] = useState(initialState);
  const issuesQuery = useGithubIssues(filter);
  const prsQuery = useGithubPRs(filter);
  const { issues: items, error, isLoading, refetch } = isPR
    ? { issues: prsQuery.prs, error: prsQuery.error, isLoading: prsQuery.isLoading, refetch: prsQuery.refetch }
    : issuesQuery;
  const activeTerminalId = useTerminalStore((s) => s.activeTerminalId);
  const [selectMode, setSelectMode] = useState(false); const [selected, setSelected] = useState<Set<number>>(new Set());
  const [expandedIssue, setExpandedIssue] = useState<number | null>(null); const [createDialogOpen, setCreateDialogOpen] = useState(false); const [bulkSendOpen, setBulkSendOpen] = useState(false);
  const FILTERS = isPR
    ? [{ label: 'Open', value: 'open' }, { label: 'Closed', value: 'closed' }, { label: 'Merged', value: 'merged' }, { label: 'All', value: 'all' }]
    : [{ label: 'Open', value: 'open' }, { label: 'Closed', value: 'closed' }, { label: 'All', value: 'all' }];
  const toggleSelect = useCallback((num: number) => { setSelected((prev) => { const next = new Set(prev); if (next.has(num)) next.delete(num); else next.add(num); return next; }); }, []);
  const handleSelectAll = useCallback(() => { if (selected.size === items.length) setSelected(new Set()); else setSelected(new Set(items.map((i: GitHubIssue) => i.number))); }, [items, selected.size]);
  const selectedIssues = useMemo(() => items.filter((i: GitHubIssue) => selected.has(i.number)), [items, selected]);
  const handleSendSingle = useCallback((issue: GitHubIssue) => {
    if (!activeTerminalId) { toast.warning('No active terminal'); return; }
    getTransport().send(IPC.TERMINAL_INPUT_ID, { terminalId: activeTerminalId, data: formatIssuePrompt(issue) + '\n\nPlease investigate this and implement the requested changes.\r' });
    toast.info(`Issue #${issue.number} sent to agent`);
  }, [activeTerminalId]);
  const handleCreateSubTask = useCallback((issue: GitHubIssue) => {
    const title = `[GH-#${issue.number}] ${issue.title}`; const labels = issue.labels?.map((l) => typeof l === 'string' ? l : l.name).join(', ');
    const cmd = `node scripts/task.js add --title "${title}" --description "From GitHub Issue #${issue.number}: ${issue.url}" --category feature --user-request "GitHub Issue #${issue.number}${labels ? ` (${labels})` : ''}"`;
    if (!activeTerminalId) { navigator.clipboard.writeText(cmd).then(() => toast.success('Sub-task command copied'), () => toast.error('Failed to copy')); }
    else { getTransport().send(IPC.TERMINAL_INPUT_ID, { terminalId: activeTerminalId, data: cmd + '\r' }); toast.info(`Creating sub-task from issue #${issue.number}`); }
  }, [activeTerminalId]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border-subtle shrink-0">
        {FILTERS.map((f) => <button key={f.value} onClick={() => setFilter(f.value)} className={cn('px-2 py-0.5 rounded text-xs transition-colors cursor-pointer', filter === f.value ? 'bg-accent/20 text-accent' : 'text-text-secondary hover:text-text-primary')}>{f.label}</button>)}
        <div className="flex-1" />
        <Button size="sm" variant="ghost" onClick={() => { setSelectMode(!selectMode); setSelected(new Set()); }} className={cn('h-6 px-1.5 cursor-pointer', selectMode && 'text-accent')} title="Toggle selection"><SquareCheckBig size={12} /></Button>
        {!isPR && <Button size="sm" variant="ghost" onClick={() => setCreateDialogOpen(true)} className="h-6 px-1.5 cursor-pointer" title="Create issue"><Plus size={12} /></Button>}
        <Button size="sm" variant="ghost" onClick={() => refetch()} className="h-6 px-1.5 cursor-pointer"><RefreshCw size={12} className={cn(isLoading && 'animate-spin')} /></Button>
      </div>
      {selectMode && selected.size > 0 && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-accent/20 bg-accent/5 shrink-0">
          <button onClick={handleSelectAll} className="text-[10px] text-accent hover:underline cursor-pointer">{selected.size === items.length ? 'Deselect all' : 'Select all'}</button>
          <span className="text-[10px] text-text-tertiary">{selected.size} selected</span><div className="flex-1" />
          <Button size="sm" variant="ghost" onClick={() => setBulkSendOpen(true)} disabled={!activeTerminalId} className="h-6 px-2 text-[10px] gap-1 cursor-pointer text-accent hover:text-accent"><Send size={10} /> Send to Agent</Button>
        </div>
      )}
      <ScrollArea className="flex-1 min-h-0">
        {error ? <div className="flex flex-col items-center justify-center gap-2 text-text-tertiary p-6"><AlertCircle className="w-5 h-5 text-error/60" /><p className="text-xs text-center">{error.includes('not a git repository') || error.includes('No remote') ? 'Not a git repository or no remote configured' : `Failed to load ${isPR ? 'pull requests' : 'issues'}`}</p><button onClick={() => refetch()} className="text-xs text-accent hover:underline cursor-pointer">Retry</button></div>
        : isLoading && items.length === 0 ? <div className="flex items-center justify-center h-32 text-text-tertiary text-sm">Loading...</div>
        : items.length === 0 ? <div className="flex flex-col items-center justify-center h-32 text-text-tertiary text-sm gap-1"><span>No {filter} {isPR ? 'pull requests' : 'issues'}</span></div>
        : <div className="flex flex-col">{items.map((issue: GitHubIssue) => {
          const isExpanded = expandedIssue === issue.number;
          return <div key={issue.number}>
            <ContextMenu><ContextMenuTrigger asChild>
              <div className={cn('flex items-start gap-2.5 px-3 py-2.5 border-b border-border-subtle/50 hover:bg-bg-hover/30 transition-colors text-left cursor-pointer', isExpanded && 'bg-bg-hover/20')} onClick={() => setExpandedIssue(isExpanded ? null : issue.number)}>
                {selectMode && <input type="checkbox" checked={selected.has(issue.number)} onChange={() => toggleSelect(issue.number)} onClick={(e) => e.stopPropagation()} className="accent-accent mt-1.5 shrink-0 cursor-pointer" />}
                <div className="mt-1 shrink-0">{isExpanded ? <ChevronDown size={12} className="text-text-tertiary" /> : <ChevronRight size={12} className="text-text-tertiary" />}</div>
                <div className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', issue.state === 'OPEN' ? 'bg-emerald-400' : 'bg-red-400')} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5"><span className="text-[10px] text-text-tertiary">#{issue.number}</span><span className="text-xs text-text-primary font-medium truncate">{issue.title}</span></div>
                  {issue.labels?.length > 0 && <div className="flex items-center gap-1 mt-1 flex-wrap">{issue.labels.map((label: string | GitHubLabel) => { const name = typeof label === 'string' ? label : label.name; const color = typeof label === 'object' ? label.color : undefined; return <Badge key={name} variant="secondary" className={cn('text-[9px] px-1 py-0', !color && 'bg-bg-hover text-text-secondary')} style={color ? { backgroundColor: `#${color}`, color: getContrastColor(color) } : undefined}>{name}</Badge>; })}</div>}
                  <div className="text-[10px] text-text-tertiary mt-1">opened {formatRelativeTime(issue.createdAt)}{issue.author?.login && ` by ${issue.author.login}`}</div>
                </div>
                <ExternalLink size={12} className="text-text-tertiary shrink-0 mt-1 hover:text-accent transition-colors" onClick={(e) => { e.stopPropagation(); getTransport().platform.openExternal(issue.url); }} />
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent className="bg-bg-elevated border-border-subtle">
              <ContextMenuItem onClick={() => handleSendSingle(issue)} disabled={!activeTerminalId} className="text-xs gap-2"><Bot className="w-3.5 h-3.5" />Send to Agent</ContextMenuItem>
              <ContextMenuItem onClick={() => handleCreateSubTask(issue)} className="text-xs gap-2"><Plus className="w-3.5 h-3.5" />Create Sub-Task</ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => getTransport().platform.openExternal(issue.url)} className="text-xs gap-2"><ExternalLink className="w-3.5 h-3.5" />Open in Browser</ContextMenuItem>
              <ContextMenuItem onClick={() => navigator.clipboard.writeText(issue.url).then(() => toast.success('URL copied'), () => toast.error('Failed to copy'))} className="text-xs gap-2"><Copy className="w-3.5 h-3.5" />Copy URL</ContextMenuItem>
            </ContextMenuContent></ContextMenu>
            {isExpanded && <IssueDetailView issueNumber={issue.number} isPR={isPR} />}
          </div>;
        })}</div>}
      </ScrollArea>
      <CreateIssueDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} onCreated={() => refetch()} />
      {bulkSendOpen && <BulkSendDialog open={bulkSendOpen} onOpenChange={setBulkSendOpen} issues={selectedIssues} />}
    </div>
  );
}

// ─── File Tree Components ────────────────────────────────────────────────────

function FileTreeNodeView({ node, depth, color, statusField, expanded, onToggleDir, projectPath }: { node: TreeNode; depth: number; color: string; statusField: 'index' | 'working'; expanded: Set<string>; onToggleDir: (path: string) => void; projectPath: string; }) {
  if (node.isDir) {
    const isOpen = expanded.has(node.path); const fileCount = countFiles(node.children);
    return <div>
      <button onClick={() => onToggleDir(node.path)} className="flex items-center gap-1.5 w-full py-1 hover:bg-bg-hover/30 transition-colors cursor-pointer" style={{ paddingLeft: `${(depth * 16) + 12}px`, paddingRight: '12px' }}>
        {isOpen ? <ChevronDown size={10} className="text-text-tertiary shrink-0" /> : <ChevronRight size={10} className="text-text-tertiary shrink-0" />}
        {isOpen ? <FolderOpen size={12} className="text-text-tertiary shrink-0" /> : <Folder size={12} className="text-text-tertiary shrink-0" />}
        <span className="text-xs text-text-secondary truncate">{node.name}</span><span className="text-[10px] text-text-tertiary ml-auto shrink-0">{fileCount}</span>
      </button>
      {isOpen && node.children.map((child) => <FileTreeNodeView key={child.path} node={child} depth={depth + 1} color={color} statusField={statusField} expanded={expanded} onToggleDir={onToggleDir} projectPath={projectPath} />)}
    </div>;
  }
  const status = node.file?.[statusField] ?? ''; const sep = projectPath.includes('\\') ? '\\' : '/'; const base = projectPath.endsWith(sep) ? projectPath : projectPath + sep; const absolutePath = base + node.path.replace(/[/\\]/g, sep);
  return <ContextMenu><ContextMenuTrigger asChild><div className="flex items-center gap-1.5 py-1 border-b border-border-subtle/30 hover:bg-bg-hover/30 transition-colors group cursor-default" style={{ paddingLeft: `${(depth * 16) + 12}px`, paddingRight: '12px' }} title={node.path}><span className="w-[10px] shrink-0" /><span className={cn('text-[10px] font-mono w-3 shrink-0 text-center font-bold', color)}>{status}</span><span className="text-xs text-text-primary truncate">{node.name}</span></div></ContextMenuTrigger><ContextMenuContent className="bg-bg-elevated border-border-subtle"><ContextMenuItem onClick={() => useUIStore.getState().setEditorFilePath(absolutePath)} className="text-xs gap-2"><FileSearch className="w-3.5 h-3.5" />Open in Editor</ContextMenuItem><ContextMenuItem onClick={() => navigator.clipboard.writeText(node.path).then(() => toast.success('Path copied'), () => toast.error('Failed'))} className="text-xs gap-2"><Copy className="w-3.5 h-3.5" />Copy Path</ContextMenuItem><ContextMenuSeparator /><ContextMenuItem onClick={() => getTransport().platform.showItemInFolder(absolutePath)} className="text-xs gap-2"><ExternalLink className="w-3.5 h-3.5" />Reveal in Explorer</ContextMenuItem></ContextMenuContent></ContextMenu>;
}

function FileGroup({ label, count, color, dotColor, files, statusField, open, onToggle, viewMode, projectPath }: { label: string; count: number; color: string; dotColor: string; files: GitFileStatus[]; statusField: 'index' | 'working'; open: boolean; onToggle: () => void; viewMode: ViewMode; projectPath: string; }) {
  const [treeExpanded, setTreeExpanded] = useState<Set<string>>(() => new Set());
  function handleToggleDir(path: string) { setTreeExpanded((prev) => { const next = new Set(prev); if (next.has(path)) next.delete(path); else next.add(path); return next; }); }
  const tree = viewMode === 'tree' ? buildFileTree(files, statusField) : [];
  return <div>
    <button onClick={onToggle} className="flex items-center gap-2 w-full px-3 py-1.5 text-[10px] uppercase tracking-wider font-medium bg-bg-deep/50 hover:bg-bg-hover/30 transition-colors cursor-pointer">{open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}<div className={cn('w-1.5 h-1.5 rounded-full', dotColor)} /><span className={color}>{label}</span><span className="text-text-tertiary ml-auto">{count}</span></button>
    {open && viewMode === 'flat' && files.map((file) => { const status = file[statusField]; const fileName = file.path.split(/[/\\]/).pop() || file.path; const dirName = file.path.includes('/') || file.path.includes('\\') ? file.path.split(/[/\\]/).slice(0, -1).join('/') + '/' : ''; const sep = projectPath.includes('\\') ? '\\' : '/'; const base = projectPath.endsWith(sep) ? projectPath : projectPath + sep; const absolutePath = base + file.path.replace(/[/\\]/g, sep); return <ContextMenu key={file.path + statusField}><ContextMenuTrigger asChild><div className="flex items-center gap-2 px-3 py-1.5 pl-7 border-b border-border-subtle/30 hover:bg-bg-hover/30 transition-colors group" title={file.path}><span className={cn('text-[10px] font-mono w-3 shrink-0 text-center font-bold', color)}>{status}</span><span className="text-xs text-text-secondary truncate">{dirName && <span className="text-text-tertiary">{dirName}</span>}<span className="text-text-primary">{fileName}</span></span></div></ContextMenuTrigger><ContextMenuContent className="bg-bg-elevated border-border-subtle"><ContextMenuItem onClick={() => useUIStore.getState().setEditorFilePath(absolutePath)} className="text-xs gap-2"><FileSearch className="w-3.5 h-3.5" />Open in Editor</ContextMenuItem><ContextMenuItem onClick={() => navigator.clipboard.writeText(file.path).then(() => toast.success('Path copied'), () => toast.error('Failed'))} className="text-xs gap-2"><Copy className="w-3.5 h-3.5" />Copy Path</ContextMenuItem><ContextMenuSeparator /><ContextMenuItem onClick={() => getTransport().platform.showItemInFolder(absolutePath)} className="text-xs gap-2"><ExternalLink className="w-3.5 h-3.5" />Reveal in Explorer</ContextMenuItem></ContextMenuContent></ContextMenu>; })}
    {open && viewMode === 'tree' && tree.map((node) => <FileTreeNodeView key={node.path} node={node} depth={1} color={color} statusField={statusField} expanded={treeExpanded} onToggleDir={handleToggleDir} projectPath={projectPath} />)}
  </div>;
}

// ─── Changes Tab ─────────────────────────────────────────────────────────────

function ChangesTab() {
  const projectPath = useProjectStore((s) => s.currentProjectPath) || ''; const { files, staged, modified, untracked, error, isLoading, refetch } = useGitStatus();
  const [stagedOpen, setStagedOpen] = useState(true); const [modifiedOpen, setModifiedOpen] = useState(true); const [untrackedOpen, setUntrackedOpen] = useState(true); const [viewMode, setViewMode] = useState<ViewMode>('flat');
  const stagedFiles = files.filter((f: GitFileStatus) => f.index !== ' ' && f.index !== '?'); const modifiedFiles = files.filter((f: GitFileStatus) => f.working === 'M' || f.working === 'D'); const untrackedFiles = files.filter((f: GitFileStatus) => f.index === '?' && f.working === '?');
  const hasChanges = stagedFiles.length > 0 || modifiedFiles.length > 0 || untrackedFiles.length > 0;
  return <div className="flex flex-col h-full">
    <div className="flex items-center justify-between px-3 py-1.5 border-b border-border-subtle shrink-0"><div className="flex items-center gap-2 text-xs">{staged > 0 && <span className="text-emerald-400">+{staged} staged</span>}{modified > 0 && <span className="text-amber-400">~{modified} modified</span>}{untracked > 0 && <span className="text-text-tertiary">?{untracked} untracked</span>}{!hasChanges && !isLoading && <span className="text-text-tertiary">Clean</span>}</div><div className="flex items-center gap-0.5"><Button size="sm" variant="ghost" onClick={() => setViewMode(viewMode === 'flat' ? 'tree' : 'flat')} className={cn('h-6 px-1.5 cursor-pointer', viewMode === 'tree' && 'text-accent')} title={viewMode === 'flat' ? 'Tree view' : 'Flat view'}>{viewMode === 'flat' ? <FolderTree size={12} /> : <List size={12} />}</Button><Button size="sm" variant="ghost" onClick={() => refetch()} className="h-6 px-1.5 cursor-pointer"><RefreshCw size={12} className={cn(isLoading && 'animate-spin')} /></Button></div></div>
    <ScrollArea className="flex-1 min-h-0">{error ? <div className="flex flex-col items-center justify-center gap-2 text-text-tertiary p-6"><AlertCircle className="w-5 h-5 text-error/60" /><p className="text-xs text-center">Failed to load git status</p><button onClick={() => refetch()} className="text-xs text-accent hover:underline cursor-pointer">Retry</button></div> : !hasChanges && !isLoading ? <div className="flex flex-col items-center justify-center h-32 text-text-tertiary text-sm gap-2"><Check size={24} className="text-emerald-400/60" /><span>Working tree clean</span></div> : <div>{stagedFiles.length > 0 && <FileGroup label="Staged" count={stagedFiles.length} color="text-emerald-400" dotColor="bg-emerald-400" files={stagedFiles} statusField="index" open={stagedOpen} onToggle={() => setStagedOpen(!stagedOpen)} viewMode={viewMode} projectPath={projectPath} />}{modifiedFiles.length > 0 && <FileGroup label="Modified" count={modifiedFiles.length} color="text-amber-400" dotColor="bg-amber-400" files={modifiedFiles} statusField="working" open={modifiedOpen} onToggle={() => setModifiedOpen(!modifiedOpen)} viewMode={viewMode} projectPath={projectPath} />}{untrackedFiles.length > 0 && <FileGroup label="Untracked" count={untrackedFiles.length} color="text-text-tertiary" dotColor="bg-text-tertiary" files={untrackedFiles} statusField="working" open={untrackedOpen} onToggle={() => setUntrackedOpen(!untrackedOpen)} viewMode={viewMode} projectPath={projectPath} />}</div>}</ScrollArea>
  </div>;
}

// ─── Branches Tab ────────────────────────────────────────────────────────────

function BranchesTab() {
  const { branches: branchList, isLoading, refetch, switchBranch, createBranch, deleteBranch } = useGitBranches();
  const [createDialogOpen, setCreateDialogOpen] = useState(false); const [newBranchName, setNewBranchName] = useState(''); const [checkout, setCheckout] = useState(true);
  const localBranches = branchList.filter((b) => !b.isRemote); const remoteBranches = branchList.filter((b) => b.isRemote);
  async function handleSwitch(branchName: string) { const projectPath = useProjectStore.getState().currentProjectPath; if (!projectPath) return; try { const result = await switchBranch.mutateAsync([{ projectPath, branchName }]); if (result.error) toast.error(`Failed: ${result.error}`); else toast.success(`Switched to ${branchName}`); } catch { toast.error('Failed to switch branch'); } }
  async function handleDelete(branchName: string) { if (!window.confirm(`Delete branch "${branchName}"?`)) return; const projectPath = useProjectStore.getState().currentProjectPath; if (!projectPath) return; try { const result = await deleteBranch.mutateAsync([{ projectPath, branchName, force: false }]); if (result.error) { if (window.confirm('Not fully merged. Force delete?')) { try { await deleteBranch.mutateAsync([{ projectPath, branchName, force: true }]); toast.success(`Deleted ${branchName}`); } catch { toast.error('Failed to force-delete'); } } } else toast.success(`Deleted ${branchName}`); } catch { toast.error('Failed to delete branch'); } }
  async function handleCreate() { if (!newBranchName.trim()) return; const projectPath = useProjectStore.getState().currentProjectPath; if (!projectPath) return; try { const result = await createBranch.mutateAsync([{ projectPath, branchName: newBranchName.trim(), checkout }]); if (result.error) toast.error(`Failed: ${result.error}`); else { toast.success(`Created ${newBranchName.trim()}`); setCreateDialogOpen(false); setNewBranchName(''); } } catch { toast.error('Failed to create branch'); } }
  function renderBranch(branch: GitBranchType) { const isCurrent = branch.isCurrent; return <div key={branch.name} className={cn('flex items-center gap-2 px-3 py-2 border-b border-border-subtle/50 hover:bg-bg-hover/30 transition-colors group', isCurrent && 'bg-accent/5')}><div className="w-3 shrink-0">{isCurrent && <div className="w-2 h-2 rounded-full bg-accent" />}</div><div className="flex-1 min-w-0"><span className={cn('text-xs', isCurrent ? 'text-accent font-medium' : 'text-text-primary')}>{branch.name}</span></div>{!isCurrent && <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => handleSwitch(branch.name)} className="p-1 text-text-tertiary hover:text-accent cursor-pointer" title="Switch"><ArrowRight size={12} /></button>{!branch.isRemote && <button onClick={() => handleDelete(branch.name)} className="p-1 text-text-tertiary hover:text-red-400 cursor-pointer" title="Delete"><Trash2 size={12} /></button>}</div>}</div>; }
  return <div className="flex flex-col h-full">
    <div className="flex items-center justify-between px-3 py-1.5 border-b border-border-subtle shrink-0"><span className="text-xs text-text-secondary">{branchList.length} branches</span><div className="flex items-center gap-1"><Button size="sm" variant="ghost" onClick={() => setCreateDialogOpen(true)} className="h-6 px-1.5 cursor-pointer"><Plus size={12} /></Button><Button size="sm" variant="ghost" onClick={() => refetch()} className="h-6 px-1.5 cursor-pointer"><RefreshCw size={12} className={cn(isLoading && 'animate-spin')} /></Button></div></div>
    <ScrollArea className="flex-1 min-h-0">{isLoading && branchList.length === 0 ? <div className="flex items-center justify-center h-32 text-text-tertiary text-sm">Loading...</div> : branchList.length === 0 ? <div className="flex flex-col items-center justify-center h-32 text-text-tertiary text-sm gap-1"><GitBranch size={24} className="opacity-40" /><span>No branches found</span></div> : <div>{localBranches.length > 0 && <div><div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-text-tertiary font-medium bg-bg-deep/50">Local</div>{localBranches.map(renderBranch)}</div>}{remoteBranches.length > 0 && <div><div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-text-tertiary font-medium bg-bg-deep/50">Remote</div>{remoteBranches.map(renderBranch)}</div>}</div>}</ScrollArea>
    <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}><DialogContent className="bg-bg-primary border-border-subtle text-text-primary sm:max-w-sm" aria-describedby={undefined}><DialogHeader><DialogTitle>Create Branch</DialogTitle></DialogHeader><div className="flex flex-col gap-3 py-2"><div><label className="text-xs text-text-secondary mb-1 block">Branch Name</label><Input value={newBranchName} onChange={(e) => setNewBranchName(e.target.value)} placeholder="feature/my-branch" className="bg-bg-deep border-border-subtle text-sm" autoFocus onKeyDown={(e) => e.key === 'Enter' && handleCreate()} /></div><div className="flex items-center gap-2"><input type="checkbox" id="checkout-new" checked={checkout} onChange={(e) => setCheckout(e.target.checked)} className="accent-accent" /><label htmlFor="checkout-new" className="text-xs text-text-secondary">Switch to new branch</label></div></div><DialogFooter><DialogClose asChild><Button variant="ghost" className="cursor-pointer">Cancel</Button></DialogClose><Button onClick={handleCreate} disabled={!newBranchName.trim()} className="bg-accent text-bg-deep hover:bg-accent/80 cursor-pointer">Create</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

// ─── Workflows Tab ───────────────────────────────────────────────────────────

export function GithubWorkflowsPanel() { const p = useProjectStore((s) => s.currentProjectPath); if (!p) return <NoProject />; return <div className="flex flex-col h-full"><GitSyncStatus /><div className="flex-1 min-h-0"><WorkflowsTab /></div></div>; }

function WorkflowCard({ workflow }: { workflow: GitHubWorkflow }) {
  const [expanded, setExpanded] = useState(true); const [dispatchRef, setDispatchRef] = useState(''); const [showDispatch, setShowDispatch] = useState(false);
  const latestRun = workflow.runs[0]; const projectPath = useProjectStore((s) => s.currentProjectPath) ?? '';
  const rerunWf = useRerunWorkflow(); const dispatchWf = useDispatchWorkflow(); const { branch } = useGitStatus();
  const statusColor = (run: GitHubWorkflowRun) => { if (run.status === 'in_progress' || run.status === 'queued') return 'text-amber-400'; if (run.conclusion === 'success') return 'text-emerald-400'; if (run.conclusion === 'failure') return 'text-red-400'; if (run.conclusion === 'cancelled') return 'text-text-muted'; return 'text-text-tertiary'; };
  const statusIcon = (run: GitHubWorkflowRun) => { if (run.status === 'in_progress' || run.status === 'queued') return Loader2; if (run.conclusion === 'success') return CheckCircle; if (run.conclusion === 'failure') return XCircle; if (run.conclusion === 'cancelled') return MinusCircle; return Circle; };
  const timeAgo = (dateStr: string) => { const diff = Date.now() - new Date(dateStr).getTime(); const mins = Math.floor(diff / 60000); if (mins < 60) return `${mins}m ago`; const hours = Math.floor(mins / 60); if (hours < 24) return `${hours}h ago`; return `${Math.floor(hours / 24)}d ago`; };
  const handleRerun = async (runId: number, e: React.MouseEvent) => { e.stopPropagation(); try { const r = await rerunWf.mutateAsync([{ projectPath, runId }]); if (r.error) toast.error(`Failed: ${r.error}`); else toast.success('Re-run triggered'); } catch { toast.error('Failed to re-run'); } };
  const handleDispatch = async () => { try { const r = await dispatchWf.mutateAsync([{ projectPath, workflowId: workflow.id.toString(), ref: dispatchRef.trim() || branch || undefined }]); if (r.error) toast.error(`Failed: ${r.error}`); else toast.success('Workflow dispatched'); setShowDispatch(false); } catch { toast.error('Failed to dispatch'); } };

  return <div className="rounded-md border border-border-subtle bg-bg-secondary/30">
    <div className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-bg-hover/50 transition-colors rounded-t-md">
      <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-2 flex-1 min-w-0 text-left cursor-pointer">
        {latestRun && (() => { const Icon = statusIcon(latestRun); return <Icon size={14} className={cn(statusColor(latestRun), latestRun.status === 'in_progress' && 'animate-spin')} />; })()}
        {!latestRun && <Circle size={14} className="text-text-muted" />}
        <span className="text-xs font-medium text-text-primary flex-1 truncate">{workflow.name}</span>
        <span className="text-[10px] text-text-tertiary">{workflow.state === 'active' ? '' : workflow.state}</span>
        {expanded ? <ChevronUp size={12} className="text-text-muted" /> : <ChevronDown size={12} className="text-text-muted" />}
      </button>
      <button onClick={() => { setShowDispatch(!showDispatch); setDispatchRef(branch || ''); }} className="p-1 text-text-tertiary hover:text-accent transition-colors cursor-pointer shrink-0" title="Run workflow"><Play size={12} /></button>
    </div>
    {showDispatch && <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-t border-border-subtle bg-bg-deep/50"><Input value={dispatchRef} onChange={(e) => setDispatchRef(e.target.value)} placeholder={branch || 'branch ref'} className="bg-bg-deep border-border-subtle text-[11px] h-6 flex-1" onKeyDown={(e) => e.key === 'Enter' && handleDispatch()} /><Button size="sm" onClick={handleDispatch} disabled={dispatchWf.isPending} className="h-6 px-2 text-[10px] bg-accent text-bg-deep hover:bg-accent/80 cursor-pointer">{dispatchWf.isPending ? <Loader2 size={10} className="animate-spin" /> : 'Run'}</Button></div>}
    {expanded && workflow.runs.length > 0 && <div className="border-t border-border-subtle">{workflow.runs.map((run) => { const Icon = statusIcon(run); return <div key={run.databaseId} className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-bg-hover/50 transition-colors group"><Icon size={12} className={cn(statusColor(run), run.status === 'in_progress' && 'animate-spin')} /><button onClick={() => getTransport().platform.openExternal(run.url)} className="text-[11px] text-text-secondary flex-1 truncate text-left cursor-pointer hover:text-text-primary">{run.displayTitle}</button><span className="text-[10px] text-text-tertiary truncate max-w-[60px]">{run.headBranch}</span><span className="text-[10px] text-text-muted">{timeAgo(run.createdAt)}</span>{run.status === 'completed' && <button onClick={(e) => handleRerun(run.databaseId, e)} className="p-0.5 text-text-tertiary hover:text-accent opacity-0 group-hover:opacity-100 transition-all cursor-pointer" title="Re-run"><RotateCcw size={10} /></button>}</div>; })}</div>}
    {expanded && workflow.runs.length === 0 && <div className="border-t border-border-subtle px-2.5 py-2 text-[10px] text-text-muted">No recent runs</div>}
  </div>;
}

function WorkflowsTab() {
  const { workflows, error, isLoading, refetch } = useGithubWorkflows();
  return <div className="flex flex-col h-full">
    <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border-subtle shrink-0"><span className="text-xs text-text-secondary">Workflows</span><div className="flex-1" /><Button size="sm" variant="ghost" onClick={() => refetch()} className="h-6 px-1.5 cursor-pointer"><RefreshCw size={12} className={cn(isLoading && 'animate-spin')} /></Button></div>
    <ScrollArea className="flex-1 min-h-0">{error ? <div className="flex flex-col items-center justify-center gap-2 text-text-tertiary p-6"><AlertCircle className="w-5 h-5 text-error/60" /><p className="text-xs text-center">{error}</p><button onClick={() => refetch()} className="text-xs text-accent hover:underline cursor-pointer">Retry</button></div> : isLoading && workflows.length === 0 ? <div className="flex items-center justify-center h-32 text-text-tertiary text-sm">Loading...</div> : workflows.length === 0 ? <div className="flex flex-col items-center justify-center h-32 text-text-tertiary text-sm gap-1"><span>No workflows found</span></div> : <div className="flex flex-col gap-2 p-2">{workflows.map((wf) => <WorkflowCard key={wf.id} workflow={wf} />)}</div>}</ScrollArea>
  </div>;
}

// ─── Worktrees Tab ───────────────────────────────────────────────────────────

function WorktreesTab() {
  const { worktrees: worktreeList, isLoading, refetch, removeWorktree } = useGitWorktrees();
  const [removeTarget, setRemoveTarget] = useState<{ path: string; force: boolean } | null>(null);

  function handleRemove(wtPath: string) {
    setRemoveTarget({ path: wtPath, force: false });
  }

  async function confirmRemove() {
    if (!removeTarget) return;
    const projectPath = useProjectStore.getState().currentProjectPath;
    if (!projectPath) return;
    try {
      const result = await removeWorktree.mutateAsync([{ projectPath, worktreePath: removeTarget.path, force: removeTarget.force }]);
      if (result.error && !removeTarget.force) {
        // Has local changes — offer force remove
        setRemoveTarget({ ...removeTarget, force: true });
        return;
      } else if (result.error) {
        toast.error('Failed to remove worktree');
      } else {
        toast.success(removeTarget.force ? 'Worktree force-removed' : 'Worktree removed');
      }
    } catch {
      toast.error('Failed to remove worktree');
    }
    setRemoveTarget(null);
  }

  return <div className="flex flex-col h-full">
    <div className="flex items-center justify-end px-3 py-1.5 border-b border-border-subtle shrink-0"><Button size="sm" variant="ghost" onClick={() => refetch()} className="h-6 px-1.5 cursor-pointer"><RefreshCw size={12} className={cn(isLoading && 'animate-spin')} /></Button></div>
    <ScrollArea className="flex-1 min-h-0">{isLoading && worktreeList.length === 0 ? <div className="flex items-center justify-center h-32 text-text-tertiary text-sm">Loading...</div> : worktreeList.length === 0 ? <div className="flex flex-col items-center justify-center h-32 text-text-tertiary text-sm gap-1"><FolderGit2 size={24} className="opacity-40" /><span>No worktrees</span></div> : <div className="flex flex-col">{worktreeList.map((wt) => { const pathName = wt.path.split(/[/\\]/).pop() || wt.path; return <div key={wt.path} className="flex items-center gap-2.5 px-3 py-2.5 border-b border-border-subtle/50 hover:bg-bg-hover/30 transition-colors group"><FolderGit2 size={14} className="text-text-tertiary shrink-0" /><div className="flex-1 min-w-0"><div className="text-xs font-medium text-text-primary">{pathName}</div><div className="flex items-center gap-2 mt-0.5"><span className="text-[10px] text-text-tertiary">{wt.branch || 'detached'}</span>{wt.isMain && <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-accent/20 text-accent">main</Badge>}</div><div className="text-[10px] text-text-tertiary truncate mt-0.5">{wt.path}</div></div>{!wt.isMain && <button onClick={() => handleRemove(wt.path)} className="p-1 text-text-tertiary hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all cursor-pointer" title="Remove"><Trash2 size={12} /></button>}</div>; })}</div>}</ScrollArea>
    <AlertDialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
      <AlertDialogContent className="bg-bg-primary border-border-subtle text-text-primary">
        <AlertDialogHeader>
          <AlertDialogTitle>{removeTarget?.force ? 'Force Remove Worktree?' : 'Remove Worktree?'}</AlertDialogTitle>
          <AlertDialogDescription className="text-text-secondary text-xs">
            {removeTarget?.force
              ? 'This worktree has local changes. Force removing will discard them.'
              : `Remove worktree at "${removeTarget?.path?.split(/[/\\]/).pop()}"?`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
          <AlertDialogAction className={removeTarget?.force ? 'bg-error text-white hover:bg-error/80 cursor-pointer' : 'bg-accent text-bg-deep hover:bg-accent/80 cursor-pointer'} onClick={confirmRemove}>
            {removeTarget?.force ? 'Force Remove' : 'Remove'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}

// ─── Notifications Panel ─────────────────────────────────────────────────────

function notificationWebUrl(n: GitHubNotification): string {
  const htmlUrl = n.repository.html_url; const apiUrl = n.subject.url;
  if (!apiUrl) return htmlUrl;
  const pullMatch = apiUrl.match(/\/pulls\/(\d+)/); if (pullMatch) return `${htmlUrl}/pull/${pullMatch[1]}`;
  const issueMatch = apiUrl.match(/\/issues\/(\d+)/); if (issueMatch) return `${htmlUrl}/issues/${issueMatch[1]}`;
  const commitMatch = apiUrl.match(/\/commits\/([a-f0-9]+)/); if (commitMatch) return `${htmlUrl}/commit/${commitMatch[1]}`;
  return htmlUrl;
}

function notificationTypeIcon(type: string) { switch (type) { case 'PullRequest': return GitBranch; case 'Issue': return AlertCircle; case 'Release': return CheckCircle; default: return Bell; } }

export function GithubNotificationsPanel() {
  const { notifications, error, isLoading, refetch } = useGithubNotifications();
  const markRead = useMarkNotificationRead();
  const unreadCount = notifications.filter((n) => n.unread).length;
  const grouped = useMemo(() => { const map = new Map<string, GitHubNotification[]>(); for (const n of notifications) { const key = n.repository.full_name; if (!map.has(key)) map.set(key, []); map.get(key)!.push(n); } return Array.from(map.entries()); }, [notifications]);
  const handleMarkRead = async (threadId: string) => { try { const r = await markRead.mutateAsync([{ threadId }]); if (r.error) toast.error(`Failed: ${r.error}`); else refetch(); } catch { toast.error('Failed'); } };
  const handleMarkAllRead = async () => { for (const n of notifications.filter((n) => n.unread)) await markRead.mutateAsync([{ threadId: n.id }]).catch(() => {}); refetch(); toast.success('All marked as read'); };

  return <div className="flex flex-col h-full">
    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border-subtle shrink-0">
      <Bell size={12} className="text-text-tertiary" /><span className="text-xs text-text-secondary">Notifications{unreadCount > 0 && <span className="ml-1 text-accent">({unreadCount})</span>}</span><div className="flex-1" />
      {unreadCount > 0 && <Button size="sm" variant="ghost" onClick={handleMarkAllRead} className="h-6 px-1.5 text-[10px] cursor-pointer" title="Mark all read"><Eye size={12} /></Button>}
      <Button size="sm" variant="ghost" onClick={() => refetch()} className="h-6 px-1.5 cursor-pointer"><RefreshCw size={12} className={cn(isLoading && 'animate-spin')} /></Button>
    </div>
    <ScrollArea className="flex-1 min-h-0">{error ? <div className="flex flex-col items-center justify-center gap-2 text-text-tertiary p-6"><AlertCircle className="w-5 h-5 text-error/60" /><p className="text-xs text-center">{error}</p><button onClick={() => refetch()} className="text-xs text-accent hover:underline cursor-pointer">Retry</button></div> : isLoading && notifications.length === 0 ? <div className="flex items-center justify-center h-32 text-text-tertiary text-sm">Loading...</div> : notifications.length === 0 ? <div className="flex flex-col items-center justify-center h-32 text-text-tertiary text-sm gap-1"><Bell size={24} className="opacity-40" /><span>No notifications</span></div> : <div>{grouped.map(([repoName, notifs]) => <div key={repoName}><div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-text-tertiary font-medium bg-bg-deep/50 sticky top-0 z-10">{repoName}</div>{notifs.map((n) => { const Icon = notificationTypeIcon(n.subject.type); return <ContextMenu key={n.id}><ContextMenuTrigger asChild><button onClick={() => getTransport().platform.openExternal(notificationWebUrl(n))} className="w-full flex items-start gap-2.5 px-3 py-2 border-b border-border-subtle/50 hover:bg-bg-hover/30 transition-colors text-left cursor-pointer">{n.unread ? <div className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" /> : <div className="w-1.5 h-1.5 shrink-0" />}<Icon size={12} className="text-text-tertiary mt-0.5 shrink-0" /><div className="flex-1 min-w-0"><span className={cn('text-xs truncate block', n.unread ? 'text-text-primary font-medium' : 'text-text-secondary')}>{n.subject.title}</span><div className="flex items-center gap-2 mt-0.5 text-[10px] text-text-muted"><span>{n.reason}</span><span>{formatRelativeTime(n.updated_at)}</span></div></div></button></ContextMenuTrigger><ContextMenuContent className="bg-bg-elevated border-border-subtle">{n.unread && <ContextMenuItem onClick={() => handleMarkRead(n.id)} className="text-xs gap-2"><Eye className="w-3.5 h-3.5" />Mark as Read</ContextMenuItem>}<ContextMenuItem onClick={() => getTransport().platform.openExternal(notificationWebUrl(n))} className="text-xs gap-2"><ExternalLink className="w-3.5 h-3.5" />Open in Browser</ContextMenuItem></ContextMenuContent></ContextMenu>; })}</div>)}</div>}</ScrollArea>
  </div>;
}
