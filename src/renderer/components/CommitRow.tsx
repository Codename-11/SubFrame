/**
 * CommitRow — a single row in the commit graph. Positioned absolutely by
 * its parent (CommitGraph) so the SVG overlay aligns 1:1 with each row.
 */

import { type GraphNode, RAIL_WIDTH, ROW_HEIGHT } from '../lib/gitGraphLayout';
import { cn } from '../lib/utils';

interface CommitRowProps {
  node: GraphNode;
  isSelected: boolean;
  onClick: () => void;
  /** Width reserved on the left for the SVG rails (px). */
  railsWidth: number;
}

function formatRelativeTime(unixSeconds: number): string {
  if (!unixSeconds) return '';
  const date = new Date(unixSeconds * 1000);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  if (diffD < 30) return `${Math.floor(diffD / 7)}w ago`;
  return date.toLocaleDateString();
}

export function CommitRow({ node, isSelected, onClick, railsWidth }: CommitRowProps) {
  const { commit } = node;
  const shortHash = commit.hash.slice(0, 7);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        'relative flex items-center gap-2 cursor-pointer select-none text-xs',
        'border-b border-border-subtle/40',
        isSelected ? 'bg-bg-hover' : 'hover:bg-bg-hover/50',
      )}
      style={{ height: ROW_HEIGHT, paddingLeft: railsWidth + RAIL_WIDTH / 2 }}
      title={commit.summary}
    >
      <span className="font-mono text-text-muted tabular-nums w-[54px] shrink-0">
        {shortHash}
      </span>
      <span className="truncate flex-1 text-text-primary min-w-0">
        {commit.summary}
      </span>
      {commit.refs && commit.refs.length > 0 && (
        <span className="hidden sm:flex items-center gap-1 shrink-0">
          {commit.refs.slice(0, 2).map((ref) => (
            <span
              key={ref}
              className="px-1.5 py-0.5 rounded text-[10px] bg-accent/15 text-accent border border-accent/30"
            >
              {ref.replace(/^HEAD -> /, '').replace(/^origin\//, 'origin/')}
            </span>
          ))}
        </span>
      )}
      <span className="text-text-secondary truncate max-w-[120px] shrink-0">
        {commit.authorName}
      </span>
      <span className="text-text-muted tabular-nums shrink-0 pr-3">
        {formatRelativeTime(commit.timestamp)}
      </span>
    </div>
  );
}
