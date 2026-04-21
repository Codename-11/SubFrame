/**
 * CommitGraph — scrollable commit graph view.
 *
 * Fetches commits via `useCommitGraph`, runs `layoutGraph` over them, then
 * renders a SVG overlay of rails plus an absolutely-positioned row list.
 * Pagination: calls `loadMore` when the user scrolls within 200px of the
 * bottom. A simple inline detail panel opens for the selected commit with
 * "Checkout" and "Create branch" actions.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { GitBranchPlus, GitCommitHorizontal, Loader2, RefreshCw, X } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { toast } from 'sonner';
import { useCommitGraph } from '../hooks/useGithub';
import {
  type CommitInfo,
  type GraphNode,
  layoutGraph,
  RAIL_WIDTH,
  ROW_HEIGHT,
} from '../lib/gitGraphLayout';
import { CommitRow } from './CommitRow';
import { GraphCanvas } from './GraphCanvas';
import { cn } from '../lib/utils';

interface CommitGraphProps {
  repoPath: string;
}

const SCROLL_LOAD_MORE_THRESHOLD = 200;

function formatFullDate(unixSeconds: number): string {
  if (!unixSeconds) return '';
  return new Date(unixSeconds * 1000).toLocaleString();
}

export function CommitGraph({ repoPath }: CommitGraphProps) {
  const {
    commits,
    error,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
    refetch,
    checkoutCommit,
    createBranchAtCommit,
  } = useCommitGraph(repoPath);

  // Layout — purely derived from commit list.
  const nodes: GraphNode[] = useMemo(() => {
    return layoutGraph(commits as CommitInfo[]);
  }, [commits]);

  const maxColumn = useMemo(() => {
    let max = 0;
    for (const n of nodes) if (n.column > max) max = n.column;
    return max;
  }, [nodes]);
  const railsWidth = (maxColumn + 1) * RAIL_WIDTH + 20;

  // Scroll-driven pagination + windowing.
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [clientHeight, setClientHeight] = useState(600);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      setScrollTop(el.scrollTop);
      setClientHeight(el.clientHeight);
      // Pagination trigger.
      if (
        hasMore &&
        !isLoadingMore &&
        el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_LOAD_MORE_THRESHOLD
      ) {
        loadMore();
      }
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [hasMore, isLoadingMore, loadMore, nodes.length]);

  const visibleStartRow = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 10);
  const visibleEndRow = Math.min(
    nodes.length,
    Math.ceil((scrollTop + clientHeight) / ROW_HEIGHT) + 10,
  );

  // Selection + detail panel.
  const [selectedHash, setSelectedHash] = useState<string | null>(null);
  const selectedNode = useMemo(
    () => nodes.find((n) => n.commit.hash === selectedHash) ?? null,
    [nodes, selectedHash],
  );
  const [newBranchName, setNewBranchName] = useState('');

  // Clear selection when repo changes.
  useEffect(() => {
    setSelectedHash(null);
    setNewBranchName('');
  }, [repoPath]);

  const handleCheckout = async () => {
    if (!selectedNode) return;
    try {
      const res = await checkoutCommit.mutateAsync([
        { projectPath: repoPath, hash: selectedNode.commit.hash },
      ]);
      if (res.success) {
        toast.success(`Checked out ${selectedNode.commit.hash.slice(0, 7)}`);
        refetch();
      } else {
        toast.error(res.error || 'Checkout failed');
      }
    } catch (err) {
      toast.error((err as Error).message || 'Checkout failed');
    }
  };

  const handleCreateBranch = async () => {
    if (!selectedNode || !newBranchName.trim()) return;
    try {
      const res = await createBranchAtCommit.mutateAsync([
        {
          projectPath: repoPath,
          hash: selectedNode.commit.hash,
          branchName: newBranchName.trim(),
        },
      ]);
      if (res.success) {
        toast.success(`Created branch ${newBranchName.trim()}`);
        setNewBranchName('');
        refetch();
      } else {
        toast.error(res.error || 'Branch creation failed');
      }
    } catch (err) {
      toast.error((err as Error).message || 'Branch creation failed');
    }
  };

  if (!repoPath) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-text-tertiary text-sm">
        No project selected
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-text-tertiary text-xs gap-2">
        <Loader2 size={14} className="animate-spin" />
        Loading commit graph...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-text-tertiary text-xs gap-2 px-4 text-center">
        <span className="text-error/70">{error}</span>
        <Button size="sm" variant="ghost" onClick={() => refetch()}>
          <RefreshCw size={12} className="mr-1" />
          Retry
        </Button>
      </div>
    );
  }

  if (commits.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-text-tertiary text-xs">
        No commits
      </div>
    );
  }

  const totalHeight = nodes.length * ROW_HEIGHT;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border-subtle text-[10px] shrink-0">
        <GitCommitHorizontal size={12} className="text-text-tertiary" />
        <span className="text-text-secondary font-medium">Commit graph</span>
        <span className="text-text-muted">
          {commits.length} loaded{hasMore ? ' (more available)' : ''}
        </span>
        <button
          onClick={() => refetch()}
          className="ml-auto p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-hover"
          title="Refresh"
          aria-label="Refresh commit graph"
        >
          <RefreshCw size={11} />
        </button>
      </div>

      {/* Scroll region */}
      <div className="flex-1 min-h-0 flex">
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto relative">
          <div className="relative" style={{ height: totalHeight, minWidth: 'max-content' }}>
            <GraphCanvas
              nodes={nodes}
              visibleStartRow={visibleStartRow}
              visibleEndRow={visibleEndRow}
            />
            {nodes.map((node) => {
              if (node.row < visibleStartRow || node.row >= visibleEndRow) return null;
              return (
                <div
                  key={node.commit.hash}
                  className="absolute left-0 right-0"
                  style={{ top: node.row * ROW_HEIGHT }}
                >
                  <CommitRow
                    node={node}
                    isSelected={selectedHash === node.commit.hash}
                    onClick={() => setSelectedHash(node.commit.hash)}
                    railsWidth={railsWidth}
                  />
                </div>
              );
            })}
            {isLoadingMore && (
              <div
                className="absolute left-0 right-0 flex items-center justify-center py-2 text-[10px] text-text-tertiary"
                style={{ top: totalHeight }}
              >
                <Loader2 size={11} className="animate-spin mr-1" />
                Loading more...
              </div>
            )}
          </div>
        </div>

        {/* Detail panel */}
        {selectedNode && (
          <div className="w-[280px] shrink-0 border-l border-border-subtle bg-bg-secondary flex flex-col">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border-subtle">
              <span className="text-xs font-medium text-text-primary truncate">
                {selectedNode.commit.hash.slice(0, 7)}
              </span>
              <button
                onClick={() => setSelectedHash(null)}
                className="ml-auto p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-hover"
                aria-label="Close detail"
              >
                <X size={12} />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-auto px-3 py-2 text-xs space-y-3">
              <div>
                <div className="text-text-muted text-[10px] uppercase tracking-wide mb-0.5">
                  Summary
                </div>
                <div className="text-text-primary break-words">
                  {selectedNode.commit.summary}
                </div>
              </div>
              <div>
                <div className="text-text-muted text-[10px] uppercase tracking-wide mb-0.5">
                  Author
                </div>
                <div className="text-text-secondary break-words">
                  {selectedNode.commit.authorName}
                  {selectedNode.commit.authorEmail && (
                    <span className="text-text-muted"> &lt;{selectedNode.commit.authorEmail}&gt;</span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-text-muted text-[10px] uppercase tracking-wide mb-0.5">
                  Date
                </div>
                <div className="text-text-secondary">
                  {formatFullDate(selectedNode.commit.timestamp)}
                </div>
              </div>
              <div>
                <div className="text-text-muted text-[10px] uppercase tracking-wide mb-0.5">
                  Hash
                </div>
                <div className="text-text-secondary font-mono break-all">
                  {selectedNode.commit.hash}
                </div>
              </div>
              {selectedNode.commit.parentHashes.length > 0 && (
                <div>
                  <div className="text-text-muted text-[10px] uppercase tracking-wide mb-0.5">
                    Parents
                  </div>
                  <div className="text-text-secondary font-mono break-all space-y-0.5">
                    {selectedNode.commit.parentHashes.map((p) => (
                      <div key={p}>{p.slice(0, 12)}</div>
                    ))}
                  </div>
                </div>
              )}
              {selectedNode.commit.refs && selectedNode.commit.refs.length > 0 && (
                <div>
                  <div className="text-text-muted text-[10px] uppercase tracking-wide mb-0.5">
                    Refs
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {selectedNode.commit.refs.map((ref) => (
                      <span
                        key={ref}
                        className="px-1.5 py-0.5 rounded text-[10px] bg-accent/15 text-accent border border-accent/30"
                      >
                        {ref}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="border-t border-border-subtle p-2 space-y-2">
              <Button
                size="sm"
                variant="secondary"
                className="w-full"
                onClick={handleCheckout}
                disabled={checkoutCommit.isPending}
              >
                {checkoutCommit.isPending ? (
                  <Loader2 size={12} className="animate-spin mr-1" />
                ) : null}
                Checkout
              </Button>
              <div className="flex gap-1">
                <Input
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  placeholder="new-branch"
                  className="h-7 text-xs"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newBranchName.trim()) {
                      e.preventDefault();
                      handleCreateBranch();
                    }
                  }}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleCreateBranch}
                  disabled={!newBranchName.trim() || createBranchAtCommit.isPending}
                  className={cn(
                    'shrink-0',
                    createBranchAtCommit.isPending && 'opacity-70',
                  )}
                  title="Create branch at this commit"
                  aria-label="Create branch at this commit"
                >
                  <GitBranchPlus size={12} />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
