/**
 * Recursive file tree component.
 * Renders a collapsible tree of files and directories with keyboard navigation,
 * context menus, and file-type icons.
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  ChevronRight,
  Folder,
  FolderOpen,
  File,
  FileCode,
  FileJson,
  FileText,
  Copy,
  ExternalLink,
  FileSearch,
} from 'lucide-react';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { useFileTree } from '../hooks/useFileTree';
import { useGitStatus } from '../hooks/useGithub';
import { useProjectStore } from '../stores/useProjectStore';
import type { FileTreeNode, GitFileStatus } from '../../shared/ipcChannels';

interface FileTreeProps {
  onFileOpen?: (filePath: string) => void;
}

/** Map file extensions to lucide icons */
function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'js':
    case 'jsx':
    case 'ts':
    case 'tsx':
    case 'mjs':
    case 'cjs':
      return FileCode;
    case 'json':
      return FileJson;
    case 'md':
    case 'mdx':
    case 'txt':
    case 'log':
      return FileText;
    default:
      return File;
  }
}

/** Sort nodes: directories first, then alphabetical */
function sortNodes(nodes: FileTreeNode[]): FileTreeNode[] {
  return [...nodes].sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}

/** Get display info for a git file status */
function getGitIndicator(file: GitFileStatus): { label: string; color: string; title: string } | null {
  const idx = file.index;
  const wt = file.working;
  // Untracked
  if (idx === '?' && wt === '?') return { label: 'U', color: 'text-text-tertiary', title: 'Untracked' };
  // Merge conflicts (UU, AA, DD, etc.)
  if (idx === 'U' || wt === 'U' || (idx === 'A' && wt === 'A') || (idx === 'D' && wt === 'D')) {
    return { label: '!', color: 'text-error', title: 'Conflict' };
  }
  // Fully staged (index changed, working tree clean)
  if (idx !== ' ' && idx !== '?' && wt === ' ') {
    const labels: Record<string, string> = { A: 'Added', M: 'Staged', D: 'Deleted', R: 'Renamed', C: 'Copied' };
    return { label: idx, color: 'text-success', title: labels[idx] || 'Staged' };
  }
  // Working tree modifications
  if (wt === 'M') return { label: 'M', color: 'text-warning', title: 'Modified' };
  if (wt === 'D') return { label: 'D', color: 'text-error', title: 'Deleted' };
  // Partially staged (both index and working tree have changes)
  if (idx !== ' ' && idx !== '?') return { label: idx, color: 'text-success', title: 'Staged' };
  return null;
}

/** Build a map of relative path → GitFileStatus for O(1) lookup */
function buildGitStatusMap(files: GitFileStatus[]): Map<string, GitFileStatus> {
  const map = new Map<string, GitFileStatus>();
  for (const f of files) map.set(f.path, f);
  return map;
}

/** Check if a directory path contains any changed files */
function dirHasChanges(dirPath: string, projectPath: string, gitMap: Map<string, GitFileStatus>): boolean {
  const rel = dirPath.replace(projectPath, '').replace(/^[\\/]+/, '').replace(/\\/g, '/');
  const prefix = rel ? rel + '/' : '';
  for (const key of gitMap.keys()) {
    if (key.startsWith(prefix)) return true;
  }
  return false;
}

export function FileTree({ onFileOpen }: FileTreeProps) {
  const currentProjectPath = useProjectStore((s) => s.currentProjectPath);
  const { data: treeData, isLoading } = useFileTree(currentProjectPath);
  const { files: gitFiles } = useGitStatus();
  const gitStatusMap = useMemo(() => buildGitStatusMap(gitFiles), [gitFiles]);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [focusedPath, setFocusedPath] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Build a flat list of visible items for keyboard navigation
  const visibleNodes = useMemo(() => {
    if (!treeData) return [];
    const result: { node: FileTreeNode; depth: number }[] = [];

    function walk(nodes: FileTreeNode[], depth: number) {
      for (const node of sortNodes(nodes)) {
        result.push({ node, depth });
        if (node.isDirectory && expandedPaths.has(node.path) && node.children) {
          walk(node.children, depth + 1);
        }
      }
    }

    walk(treeData, 0);
    return result;
  }, [treeData, expandedPaths]);

  const toggleExpand = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const handleFileClick = useCallback(
    (node: FileTreeNode) => {
      if (node.isDirectory) {
        toggleExpand(node.path);
      } else {
        setActiveFilePath(node.path);
        onFileOpen?.(node.path);
      }
      setFocusedPath(node.path);
    },
    [toggleExpand, onFileOpen]
  );

  const handleCopyPath = useCallback((path: string) => {
    navigator.clipboard.writeText(path).then(
      () => toast.success('Path copied'),
      () => toast.error('Failed to copy path')
    );
  }, []);

  const handleRevealInExplorer = useCallback((path: string) => {
    // Use Electron shell to show file in OS file manager
    const { shell } = require('electron');
    shell.showItemInFolder(path);
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!focusedPath || visibleNodes.length === 0) return;

      const currentIndex = visibleNodes.findIndex((v) => v.node.path === focusedPath);
      if (currentIndex === -1) return;

      const current = visibleNodes[currentIndex];

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          const nextIndex = currentIndex < visibleNodes.length - 1 ? currentIndex + 1 : 0;
          setFocusedPath(visibleNodes[nextIndex].node.path);
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : visibleNodes.length - 1;
          setFocusedPath(visibleNodes[prevIndex].node.path);
          break;
        }
        case 'ArrowRight': {
          e.preventDefault();
          if (current.node.isDirectory && !expandedPaths.has(current.node.path)) {
            toggleExpand(current.node.path);
          }
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          if (current.node.isDirectory && expandedPaths.has(current.node.path)) {
            toggleExpand(current.node.path);
          }
          break;
        }
        case 'Enter': {
          e.preventDefault();
          handleFileClick(current.node);
          break;
        }
      }
    },
    [focusedPath, visibleNodes, expandedPaths, toggleExpand, handleFileClick]
  );

  // Scroll focused item into view
  useEffect(() => {
    if (!focusedPath || !containerRef.current) return;
    const el = containerRef.current.querySelector(`[data-path="${CSS.escape(focusedPath)}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [focusedPath]);

  if (!currentProjectPath) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-tertiary text-xs px-4 text-center">
        Select a project to browse files
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-tertiary text-xs">
        Loading files...
      </div>
    );
  }

  if (!treeData || treeData.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-tertiary text-xs">
        No files found
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 min-h-0">
      <div
        ref={containerRef}
        className="py-1 outline-none"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (!focusedPath && visibleNodes.length > 0) {
            setFocusedPath(visibleNodes[0].node.path);
          }
        }}
      >
        {sortNodes(treeData).map((node) => (
          <TreeNode
            key={node.path}
            node={node}
            depth={0}
            expandedPaths={expandedPaths}
            activeFilePath={activeFilePath}
            focusedPath={focusedPath}
            onToggle={toggleExpand}
            onClick={handleFileClick}
            onCopyPath={handleCopyPath}
            onRevealInExplorer={handleRevealInExplorer}
            onFileOpen={onFileOpen}
            gitStatusMap={gitStatusMap}
            projectPath={currentProjectPath ?? ''}
          />
        ))}
      </div>
    </ScrollArea>
  );
}

interface TreeNodeProps {
  node: FileTreeNode;
  depth: number;
  expandedPaths: Set<string>;
  activeFilePath: string | null;
  focusedPath: string | null;
  onToggle: (path: string) => void;
  onClick: (node: FileTreeNode) => void;
  onCopyPath: (path: string) => void;
  onRevealInExplorer: (path: string) => void;
  onFileOpen?: (filePath: string) => void;
  gitStatusMap: Map<string, GitFileStatus>;
  projectPath: string;
}

function TreeNode({
  node,
  depth,
  expandedPaths,
  activeFilePath,
  focusedPath,
  onToggle,
  onClick,
  onCopyPath,
  onRevealInExplorer,
  onFileOpen,
  gitStatusMap,
  projectPath,
}: TreeNodeProps) {
  const isExpanded = expandedPaths.has(node.path);
  const isActive = activeFilePath === node.path;
  const isFocused = focusedPath === node.path;
  const Icon = node.isDirectory
    ? isExpanded
      ? FolderOpen
      : Folder
    : getFileIcon(node.name);

  const paddingLeft = 8 + depth * 16;

  // Git status for this node
  const relPath = node.path.replace(projectPath, '').replace(/^[\\/]+/, '').replace(/\\/g, '/');
  const gitFile = gitStatusMap.get(relPath);
  const gitIndicator = gitFile ? getGitIndicator(gitFile) : null;
  const showDirDot = node.isDirectory && dirHasChanges(node.path, projectPath, gitStatusMap);

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            data-path={node.path}
            className={`flex items-center gap-1.5 py-[3px] pr-2 cursor-pointer text-xs select-none
              transition-colors
              ${isActive ? 'bg-accent-subtle text-text-primary' : 'text-text-secondary hover:bg-bg-hover'}
              ${isFocused ? 'ring-1 ring-inset ring-accent/40' : ''}
            `}
            style={{ paddingLeft }}
            onClick={() => onClick(node)}
          >
            {node.isDirectory ? (
              <ChevronRight
                className={`w-3.5 h-3.5 flex-shrink-0 text-text-tertiary transition-transform duration-150
                  ${isExpanded ? 'rotate-90' : ''}
                `}
                aria-label={isExpanded ? 'Collapse folder' : 'Expand folder'}
              />
            ) : (
              <span className="w-3.5 flex-shrink-0" />
            )}
            <Icon
              className={`w-3.5 h-3.5 flex-shrink-0 ${
                node.isDirectory ? 'text-accent' : 'text-text-tertiary'
              }`}
            />
            <span className="truncate">{node.name}</span>
            {gitIndicator && (
              <span className={`ml-auto flex-shrink-0 text-[10px] font-mono font-bold ${gitIndicator.color}`} title={gitIndicator.title} aria-label={`File status: ${gitIndicator.title}`}>
                {gitIndicator.label}
              </span>
            )}
            {showDirDot && !gitIndicator && (
              <span className="ml-auto flex-shrink-0 w-1.5 h-1.5 rounded-full bg-warning/60" title="Contains changes" aria-label="Contains changes" />
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="bg-bg-elevated border-border-subtle">
          {!node.isDirectory && (
            <ContextMenuItem
              onClick={() => onFileOpen?.(node.path)}
              className="text-xs gap-2"
            >
              <FileSearch className="w-3.5 h-3.5" />
              Open in Editor
            </ContextMenuItem>
          )}
          <ContextMenuItem
            onClick={() => onRevealInExplorer(node.path)}
            className="text-xs gap-2"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Reveal in Explorer
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() => onCopyPath(node.path)}
            className="text-xs gap-2"
          >
            <Copy className="w-3.5 h-3.5" />
            Copy Path
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Render children if directory is expanded */}
      {node.isDirectory && isExpanded && node.children && (
        <>
          {sortNodes(node.children).map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              expandedPaths={expandedPaths}
              activeFilePath={activeFilePath}
              focusedPath={focusedPath}
              onToggle={onToggle}
              onClick={onClick}
              onCopyPath={onCopyPath}
              onRevealInExplorer={onRevealInExplorer}
              onFileOpen={onFileOpen}
              gitStatusMap={gitStatusMap}
              projectPath={projectPath}
            />
          ))}
        </>
      )}
    </>
  );
}
