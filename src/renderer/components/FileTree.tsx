/**
 * Recursive file tree component.
 * Renders a collapsible tree of files and directories with keyboard navigation,
 * context menus, and file-type icons.
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  ChevronRight,
  ChevronsDownUp,
  Clipboard,
  ClipboardCopy,
  Folder,
  FolderOpen,
  File,
  FileCode,
  FileJson,
  FileText,
  Copy,
  FilePlus,
  FolderPlus,
  Pencil,
  Trash2,
  TerminalSquare,
  List,
  FolderTree,
  Search,
  X,
} from 'lucide-react';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { IPC } from '../../shared/ipcChannels';
import { useFileTree } from '../hooks/useFileTree';
import { useGitStatus } from '../hooks/useGithub';
import { getTransport } from '../lib/transportProvider';
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

type ViewMode = 'tree' | 'flat';

/** State for inline input (new file, new folder, rename) */
interface InlineInputState {
  type: 'newFile' | 'newFolder' | 'rename';
  /** The directory path where the new item will be created, or the parent of the item being renamed */
  parentPath: string;
  /** For rename: the full path of the item being renamed */
  targetPath?: string;
  /** For rename: the current name pre-filled in the input */
  currentName?: string;
  /** Whether the target is a directory (for rename) */
  isDirectory?: boolean;
}

/** State for the delete confirmation dialog */
interface DeleteConfirmState {
  filePath: string;
  fileName: string;
  isDirectory: boolean;
}

/** Flatten tree nodes recursively into a single sorted list of files (no directories) */
function flattenTree(nodes: FileTreeNode[], projectPath: string): { node: FileTreeNode; relativePath: string }[] {
  const result: { node: FileTreeNode; relativePath: string }[] = [];
  function walk(items: FileTreeNode[]) {
    for (const item of items) {
      if (item.isDirectory) {
        if (item.children) walk(item.children);
      } else {
        const rel = item.path.replace(projectPath, '').replace(/^[\\/]+/, '').replace(/\\/g, '/');
        result.push({ node: item, relativePath: rel });
      }
    }
  }
  walk(nodes);
  return result.sort((a, b) => a.relativePath.localeCompare(b.relativePath, undefined, { sensitivity: 'base' }));
}

/** Filter tree nodes to only include files/directories matching the query. Preserves parent structure for matched files. */
function filterTree(nodes: FileTreeNode[], query: string): FileTreeNode[] {
  const lowerQuery = query.toLowerCase();
  const result: FileTreeNode[] = [];
  for (const node of nodes) {
    if (node.isDirectory) {
      const filteredChildren = node.children ? filterTree(node.children, query) : [];
      if (filteredChildren.length > 0) {
        result.push({ ...node, children: filteredChildren });
      }
    } else {
      if (node.name.toLowerCase().includes(lowerQuery) || node.path.toLowerCase().includes(lowerQuery)) {
        result.push(node);
      }
    }
  }
  return result;
}

/** Collect all directory paths from a tree (used to auto-expand filtered tree) */
function collectDirPaths(nodes: FileTreeNode[]): Set<string> {
  const paths = new Set<string>();
  function walk(items: FileTreeNode[]) {
    for (const item of items) {
      if (item.isDirectory) {
        paths.add(item.path);
        if (item.children) walk(item.children);
      }
    }
  }
  walk(nodes);
  return paths;
}

/** Find a node in the tree by its path */
function findNodeByPath(nodes: FileTreeNode[], targetPath: string): FileTreeNode | null {
  for (const node of nodes) {
    if (node.path === targetPath) return node;
    if (node.isDirectory && node.children) {
      const found = findNodeByPath(node.children, targetPath);
      if (found) return found;
    }
  }
  return null;
}

export function FileTree({ onFileOpen }: FileTreeProps) {
  const currentProjectPath = useProjectStore((s) => s.currentProjectPath);
  const { data: treeData, isLoading, loadChildren, refresh } = useFileTree(currentProjectPath);
  const { files: gitFiles } = useGitStatus();
  const gitStatusMap = useMemo(() => buildGitStatusMap(gitFiles), [gitFiles]);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());
  const [focusedPath, setFocusedPath] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('tree');
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Clear loading state when tree data updates (children loaded)
  useEffect(() => {
    if (!treeData || loadingPaths.size === 0) return;
    setLoadingPaths((prev) => {
      const next = new Set<string>();
      for (const p of prev) {
        const node = findNodeByPath(treeData, p);
        // Keep in loading set only if children still not loaded
        if (node && !node.childrenLoaded) next.add(p);
      }
      return next.size === prev.size ? prev : next;
    });
  }, [treeData, loadingPaths.size]);

  // ── CRUD state ───────────────────────────────────────────────────────────
  const [inlineInput, setInlineInput] = useState<InlineInputState | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState | null>(null);

  // Filtered tree data (for search in tree mode)
  const filteredTreeData = useMemo(() => {
    if (!treeData || !searchQuery.trim()) return treeData ?? [];
    return filterTree(treeData, searchQuery.trim());
  }, [treeData, searchQuery]);

  // Auto-expand all dirs in filtered tree so matches are visible
  const searchExpandedPaths = useMemo(() => {
    if (!searchQuery.trim() || viewMode !== 'tree') return null;
    return collectDirPaths(filteredTreeData);
  }, [filteredTreeData, searchQuery, viewMode]);

  // Effective expanded paths: search overrides manual when searching in tree mode
  const effectiveExpandedPaths = searchExpandedPaths ?? expandedPaths;

  // Flat list of all files (for flat view)
  const flatItems = useMemo(() => {
    if (!treeData || !currentProjectPath) return [];
    const items = flattenTree(treeData, currentProjectPath);
    if (!searchQuery.trim()) return items;
    const lowerQuery = searchQuery.toLowerCase();
    return items.filter((item) => item.relativePath.toLowerCase().includes(lowerQuery));
  }, [treeData, currentProjectPath, searchQuery]);

  // Build a flat list of visible items for keyboard navigation
  const visibleNodes = useMemo(() => {
    if (viewMode === 'flat') {
      return flatItems.map((item) => ({ node: item.node, depth: 0 }));
    }
    const sourceData = filteredTreeData;
    if (!sourceData || sourceData.length === 0) return [];
    const result: { node: FileTreeNode; depth: number }[] = [];

    function walk(nodes: FileTreeNode[], depth: number) {
      for (const node of sortNodes(nodes)) {
        result.push({ node, depth });
        if (node.isDirectory && effectiveExpandedPaths.has(node.path) && node.children) {
          walk(node.children, depth + 1);
        }
      }
    }

    walk(sourceData, 0);
    return result;
  }, [viewMode, flatItems, filteredTreeData, effectiveExpandedPaths]);

  const toggleExpand = useCallback((dirPath: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(dirPath)) {
        next.delete(dirPath);
      } else {
        next.add(dirPath);

        // Lazy-load children if not yet loaded
        const node = findNodeByPath(treeData ?? [], dirPath);
        if (node && node.isDirectory && !node.childrenLoaded && node.hasChildren) {
          setLoadingPaths((prevLoading) => new Set(prevLoading).add(dirPath));
          loadChildren(dirPath);
        }
      }
      return next;
    });
  }, [treeData, loadChildren]);

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

  const handleRevealInExplorer = useCallback((filePath: string) => {
    getTransport().platform.showItemInFolder(filePath);
  }, []);

  // ── CRUD handlers ──────────────────────────────────────────────────────────

  const handleCreateFile = useCallback(async (parentDir: string, fileName: string) => {
    if (!fileName.trim()) return;
    const filePath = `${parentDir}/${fileName}`.replace(/\\/g, '/');
    const result = await getTransport().invoke(IPC.CREATE_FILE, { filePath });
    if (result.success) {
      toast.success(`Created ${fileName}`);
      refresh();
      onFileOpen?.(filePath);
    } else {
      toast.error(result.error ?? 'Failed to create file');
    }
  }, [refresh, onFileOpen]);

  const handleCreateDirectory = useCallback(async (parentDir: string, dirName: string) => {
    if (!dirName.trim()) return;
    const dirPath = `${parentDir}/${dirName}`.replace(/\\/g, '/');
    const result = await getTransport().invoke(IPC.CREATE_DIRECTORY, { dirPath });
    if (result.success) {
      toast.success(`Created folder ${dirName}`);
      refresh();
      // Auto-expand the parent so the new folder is visible
      setExpandedPaths((prev) => new Set([...prev, parentDir]));
    } else {
      toast.error(result.error ?? 'Failed to create folder');
    }
  }, [refresh]);

  const handleRename = useCallback(async (oldPath: string, newName: string, wasDirectory: boolean) => {
    if (!newName.trim()) return;
    const parentDir = oldPath.replace(/\\/g, '/').replace(/\/[^/]+$/, '');
    const newPath = `${parentDir}/${newName}`.replace(/\\/g, '/');
    if (newPath === oldPath.replace(/\\/g, '/')) return; // No change
    const result = await getTransport().invoke(IPC.RENAME_FILE, { oldPath, newPath });
    if (result.success) {
      toast.success(`Renamed to ${newName}`);
      refresh();
      // If renamed file was active in editor, open the new path
      if (!wasDirectory && activeFilePath === oldPath) {
        setActiveFilePath(newPath);
        onFileOpen?.(newPath);
      }
    } else {
      toast.error(result.error ?? 'Failed to rename');
    }
  }, [refresh, activeFilePath, onFileOpen]);

  const handleDelete = useCallback(async () => {
    if (!deleteConfirm) return;
    const { filePath, isDirectory } = deleteConfirm;
    const result = await getTransport().invoke(IPC.DELETE_FILE, { filePath, isDirectory });
    if (result.success) {
      toast.success(`Deleted ${deleteConfirm.fileName}`);
      refresh();
      // If deleted file was active in editor, clear it
      if (activeFilePath === filePath || (isDirectory && activeFilePath?.startsWith(filePath))) {
        setActiveFilePath(null);
      }
    } else {
      toast.error(result.error ?? 'Failed to delete');
    }
    setDeleteConfirm(null);
  }, [deleteConfirm, refresh, activeFilePath]);

  const handleDuplicate = useCallback(async (filePath: string) => {
    const normalized = filePath.replace(/\\/g, '/');
    const parentDir = normalized.replace(/\/[^/]+$/, '');
    const fileName = normalized.split('/').pop() ?? '';
    const dotIndex = fileName.lastIndexOf('.');
    const baseName = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;
    const ext = dotIndex > 0 ? fileName.slice(dotIndex) : '';
    const copyName = `${baseName} (copy)${ext}`;
    const copyPath = `${parentDir}/${copyName}`;

    // Read original file content first
    const content = await new Promise<string>((resolve) => {
      const unsub = getTransport().on(IPC.FILE_CONTENT, (_event: unknown, data: { content?: string; filePath: string }) => {
        if (data.filePath === filePath) {
          unsub();
          resolve(data.content ?? '');
        }
      });
      getTransport().send(IPC.READ_FILE, filePath);
    });

    const result = await getTransport().invoke(IPC.CREATE_FILE, { filePath: copyPath, content });
    if (result.success) {
      toast.success(`Duplicated as ${copyName}`);
      refresh();
    } else {
      toast.error(result.error ?? 'Failed to duplicate file');
    }
  }, [refresh]);

  const handleCopyRelativePath = useCallback((filePath: string) => {
    if (!currentProjectPath) return;
    const rel = filePath.replace(currentProjectPath, '').replace(/^[\\/]+/, '').replace(/\\/g, '/');
    navigator.clipboard.writeText(rel).then(
      () => toast.success('Relative path copied'),
      () => toast.error('Failed to copy path')
    );
  }, [currentProjectPath]);

  const handleCopyFileName = useCallback((filePath: string) => {
    const fileName = filePath.replace(/\\/g, '/').split('/').pop() ?? '';
    navigator.clipboard.writeText(fileName).then(
      () => toast.success('File name copied'),
      () => toast.error('Failed to copy name')
    );
  }, []);

  const handleOpenTerminalAt = useCallback((dirPath: string) => {
    window.dispatchEvent(new CustomEvent('create-terminal-at', { detail: { cwd: dirPath } }));
  }, []);

  const collapseAll = useCallback(() => {
    setExpandedPaths(new Set());
  }, []);

  const handleInlineInputConfirm = useCallback((value: string) => {
    if (!inlineInput || !value.trim()) {
      setInlineInput(null);
      return;
    }
    const { type, parentPath, targetPath, isDirectory: wasDirectory } = inlineInput;
    setInlineInput(null);
    if (type === 'newFile') {
      handleCreateFile(parentPath, value.trim());
    } else if (type === 'newFolder') {
      handleCreateDirectory(parentPath, value.trim());
    } else if (type === 'rename' && targetPath) {
      handleRename(targetPath, value.trim(), !!wasDirectory);
    }
  }, [inlineInput, handleCreateFile, handleCreateDirectory, handleRename]);

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
          if (current.node.isDirectory && !effectiveExpandedPaths.has(current.node.path)) {
            toggleExpand(current.node.path);
          }
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          if (current.node.isDirectory && effectiveExpandedPaths.has(current.node.path)) {
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
    [focusedPath, visibleNodes, effectiveExpandedPaths, toggleExpand, handleFileClick]
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
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Header: view toggle + search */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border-subtle">
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setViewMode('tree')}
            className={`p-1 rounded transition-colors ${
              viewMode === 'tree'
                ? 'text-accent bg-accent-subtle'
                : 'text-text-tertiary hover:text-text-secondary hover:bg-bg-hover'
            }`}
            title="Tree view"
            aria-label="Tree view"
          >
            <FolderTree className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewMode('flat')}
            className={`p-1 rounded transition-colors ${
              viewMode === 'flat'
                ? 'text-accent bg-accent-subtle'
                : 'text-text-tertiary hover:text-text-secondary hover:bg-bg-hover'
            }`}
            title="Flat list view"
            aria-label="Flat list view"
          >
            <List className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex-1 relative">
          <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-text-tertiary pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter files..."
            className="w-full h-6 pl-5 pr-6 text-xs bg-bg-secondary border border-border-subtle rounded
              text-text-primary placeholder:text-text-muted
              focus:outline-none focus:border-accent/50 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-text-tertiary hover:text-text-secondary rounded transition-colors"
              title="Clear search"
              aria-label="Clear search"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      <ContextMenu>
        <ContextMenuTrigger asChild>
          <ScrollArea className="flex-1 min-h-0">
            <div
              ref={containerRef}
              className="py-1 outline-none min-h-full"
              tabIndex={0}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                if (!focusedPath && visibleNodes.length > 0) {
                  setFocusedPath(visibleNodes[0].node.path);
                }
              }}
            >
              {viewMode === 'tree' ? (
                /* Tree view */
                <>
                  {sortNodes(filteredTreeData).map((node) => (
                    <TreeNode
                      key={node.path}
                      node={node}
                      depth={0}
                      expandedPaths={effectiveExpandedPaths}
                      loadingPaths={loadingPaths}
                      activeFilePath={activeFilePath}
                      focusedPath={focusedPath}
                      onToggle={toggleExpand}
                      onClick={handleFileClick}
                      onCopyPath={handleCopyPath}
                      onCopyRelativePath={handleCopyRelativePath}
                      onCopyFileName={handleCopyFileName}
                      onRevealInExplorer={handleRevealInExplorer}
                      onFileOpen={onFileOpen}
                      onOpenTerminalAt={handleOpenTerminalAt}
                      onStartInlineInput={setInlineInput}
                      onRequestDelete={setDeleteConfirm}
                      onDuplicate={handleDuplicate}
                      onCollapseAll={collapseAll}
                      inlineInput={inlineInput}
                      onInlineInputConfirm={handleInlineInputConfirm}
                      onInlineInputCancel={() => setInlineInput(null)}
                      gitStatusMap={gitStatusMap}
                      projectPath={currentProjectPath ?? ''}
                    />
                  ))}
                  {/* Inline input for new item at project root */}
                  {inlineInput && inlineInput.parentPath === currentProjectPath && inlineInput.type !== 'rename' && (
                    <InlineInputRow
                      depth={0}
                      defaultValue=""
                      isDirectory={inlineInput.type === 'newFolder'}
                      onConfirm={handleInlineInputConfirm}
                      onCancel={() => setInlineInput(null)}
                    />
                  )}
                </>
              ) : (
                /* Flat list view */
                flatItems.map((item) => (
                  <FlatFileRow
                    key={item.node.path}
                    node={item.node}
                    relativePath={item.relativePath}
                    isActive={activeFilePath === item.node.path}
                    isFocused={focusedPath === item.node.path}
                    onClick={handleFileClick}
                    onCopyPath={handleCopyPath}
                    onCopyRelativePath={handleCopyRelativePath}
                    onCopyFileName={handleCopyFileName}
                    onRevealInExplorer={handleRevealInExplorer}
                    onFileOpen={onFileOpen}
                    onOpenTerminalAt={handleOpenTerminalAt}
                    onStartInlineInput={setInlineInput}
                    onRequestDelete={setDeleteConfirm}
                    onDuplicate={handleDuplicate}
                    inlineInput={inlineInput}
                    onInlineInputConfirm={handleInlineInputConfirm}
                    onInlineInputCancel={() => setInlineInput(null)}
                    gitStatusMap={gitStatusMap}
                    projectPath={currentProjectPath ?? ''}
                  />
                ))
              )}
              {visibleNodes.length === 0 && searchQuery && (
                <div className="flex items-center justify-center text-text-tertiary text-xs py-6">
                  No matching files
                </div>
              )}
            </div>
          </ScrollArea>
        </ContextMenuTrigger>
        {/* Background context menu (empty area) */}
        <ContextMenuContent className="bg-bg-elevated border-border-subtle">
          <ContextMenuItem
            onClick={() => currentProjectPath && setInlineInput({ type: 'newFile', parentPath: currentProjectPath })}
            className="text-xs gap-2"
          >
            <FilePlus className="w-3.5 h-3.5" />
            New File...
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => currentProjectPath && setInlineInput({ type: 'newFolder', parentPath: currentProjectPath })}
            className="text-xs gap-2"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            New Folder...
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
        <AlertDialogContent className="bg-bg-elevated border-border-subtle">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-text-primary">
              Delete {deleteConfirm?.isDirectory ? 'folder' : 'file'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-text-secondary">
              Are you sure you want to delete{' '}
              <span className="font-mono text-text-primary">{deleteConfirm?.fileName}</span>?
              {deleteConfirm?.isDirectory && (
                <span className="block mt-1 text-warning">
                  This will recursively delete all contents inside the folder.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" className="text-xs" onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface TreeNodeProps {
  node: FileTreeNode;
  depth: number;
  expandedPaths: Set<string>;
  loadingPaths: Set<string>;
  activeFilePath: string | null;
  focusedPath: string | null;
  onToggle: (path: string) => void;
  onClick: (node: FileTreeNode) => void;
  onCopyPath: (path: string) => void;
  onCopyRelativePath: (path: string) => void;
  onCopyFileName: (path: string) => void;
  onRevealInExplorer: (path: string) => void;
  onFileOpen?: (filePath: string) => void;
  onOpenTerminalAt: (dirPath: string) => void;
  onStartInlineInput: (state: InlineInputState) => void;
  onRequestDelete: (state: DeleteConfirmState) => void;
  onDuplicate: (filePath: string) => void;
  onCollapseAll: () => void;
  inlineInput: InlineInputState | null;
  onInlineInputConfirm: (value: string) => void;
  onInlineInputCancel: () => void;
  gitStatusMap: Map<string, GitFileStatus>;
  projectPath: string;
}

function TreeNode({
  node,
  depth,
  expandedPaths,
  loadingPaths,
  activeFilePath,
  focusedPath,
  onToggle,
  onClick,
  onCopyPath,
  onCopyRelativePath,
  onCopyFileName,
  onRevealInExplorer,
  onFileOpen,
  onOpenTerminalAt,
  onStartInlineInput,
  onRequestDelete,
  onDuplicate,
  onCollapseAll,
  inlineInput,
  onInlineInputConfirm,
  onInlineInputCancel,
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

  // Is this node currently being renamed?
  const isBeingRenamed = inlineInput?.type === 'rename' && inlineInput.targetPath === node.path;

  // Parent path for file context menu (new file / new folder in parent dir)
  const parentPath = node.path.replace(/\\/g, '/').replace(/\/[^/]+$/, '');

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
            {isBeingRenamed ? (
              <InlineInputRow
                depth={0}
                defaultValue={node.name}
                isDirectory={node.isDirectory}
                inline
                onConfirm={onInlineInputConfirm}
                onCancel={onInlineInputCancel}
              />
            ) : (
              <span className="truncate">{node.name}</span>
            )}
            {gitIndicator && !isBeingRenamed && (
              <span className={`ml-auto flex-shrink-0 text-[10px] font-mono font-bold ${gitIndicator.color}`} title={gitIndicator.title} aria-label={`File status: ${gitIndicator.title}`}>
                {gitIndicator.label}
              </span>
            )}
            {showDirDot && !gitIndicator && !isBeingRenamed && (
              <span className="ml-auto flex-shrink-0 w-1.5 h-1.5 rounded-full bg-warning/60" title="Contains changes" aria-label="Contains changes" />
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="bg-bg-elevated border-border-subtle">
          {node.isDirectory ? (
            <>
              {/* Directory context menu */}
              <ContextMenuItem
                onClick={() => onOpenTerminalAt(node.path)}
                className="text-xs gap-2"
              >
                <TerminalSquare className="w-3.5 h-3.5" />
                Open in Integrated Terminal
              </ContextMenuItem>
              <ContextMenuSeparator className="border-border-subtle" />
              <ContextMenuItem
                onClick={() => onStartInlineInput({ type: 'newFile', parentPath: node.path })}
                className="text-xs gap-2"
              >
                <FilePlus className="w-3.5 h-3.5" />
                New File...
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => onStartInlineInput({ type: 'newFolder', parentPath: node.path })}
                className="text-xs gap-2"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                New Folder...
              </ContextMenuItem>
              <ContextMenuSeparator className="border-border-subtle" />
              <ContextMenuItem
                onClick={() => onStartInlineInput({ type: 'rename', parentPath, targetPath: node.path, currentName: node.name, isDirectory: true })}
                className="text-xs gap-2"
              >
                <Pencil className="w-3.5 h-3.5" />
                Rename...
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => onRequestDelete({ filePath: node.path, fileName: node.name, isDirectory: true })}
                className="text-xs gap-2 text-error"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </ContextMenuItem>
              <ContextMenuSeparator className="border-border-subtle" />
              <ContextMenuItem
                onClick={onCollapseAll}
                className="text-xs gap-2"
              >
                <ChevronsDownUp className="w-3.5 h-3.5" />
                Collapse All
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => onCopyPath(node.path)}
                className="text-xs gap-2"
              >
                <Clipboard className="w-3.5 h-3.5" />
                Copy Path
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => onCopyRelativePath(node.path)}
                className="text-xs gap-2"
              >
                <ClipboardCopy className="w-3.5 h-3.5" />
                Copy Relative Path
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => onRevealInExplorer(node.path)}
                className="text-xs gap-2"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                Reveal in Explorer
              </ContextMenuItem>
            </>
          ) : (
            <>
              {/* File context menu */}
              <ContextMenuItem
                onClick={() => onFileOpen?.(node.path)}
                className="text-xs gap-2"
              >
                <FileCode className="w-3.5 h-3.5" />
                Open in Editor
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => onOpenTerminalAt(parentPath)}
                className="text-xs gap-2"
              >
                <TerminalSquare className="w-3.5 h-3.5" />
                Open in Integrated Terminal
              </ContextMenuItem>
              <ContextMenuSeparator className="border-border-subtle" />
              <ContextMenuItem
                onClick={() => onStartInlineInput({ type: 'newFile', parentPath })}
                className="text-xs gap-2"
              >
                <FilePlus className="w-3.5 h-3.5" />
                New File...
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => onStartInlineInput({ type: 'newFolder', parentPath })}
                className="text-xs gap-2"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                New Folder...
              </ContextMenuItem>
              <ContextMenuSeparator className="border-border-subtle" />
              <ContextMenuItem
                onClick={() => onStartInlineInput({ type: 'rename', parentPath, targetPath: node.path, currentName: node.name, isDirectory: false })}
                className="text-xs gap-2"
              >
                <Pencil className="w-3.5 h-3.5" />
                Rename...
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => onDuplicate(node.path)}
                className="text-xs gap-2"
              >
                <Copy className="w-3.5 h-3.5" />
                Duplicate
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => onRequestDelete({ filePath: node.path, fileName: node.name, isDirectory: false })}
                className="text-xs gap-2 text-error"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </ContextMenuItem>
              <ContextMenuSeparator className="border-border-subtle" />
              <ContextMenuItem
                onClick={() => onCopyPath(node.path)}
                className="text-xs gap-2"
              >
                <Clipboard className="w-3.5 h-3.5" />
                Copy Path
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => onCopyRelativePath(node.path)}
                className="text-xs gap-2"
              >
                <ClipboardCopy className="w-3.5 h-3.5" />
                Copy Relative Path
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => onCopyFileName(node.path)}
                className="text-xs gap-2"
              >
                <FileText className="w-3.5 h-3.5" />
                Copy File Name
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => onRevealInExplorer(node.path)}
                className="text-xs gap-2"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                Reveal in Explorer
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>

      {/* Render children if directory is expanded */}
      {node.isDirectory && isExpanded && (
        <>
          {loadingPaths.has(node.path) && !node.childrenLoaded && (
            <div
              className="flex items-center gap-1.5 py-[3px] pr-2 text-xs text-text-muted"
              style={{ paddingLeft: 8 + (depth + 1) * 16 }}
            >
              <span className="w-3.5 h-3.5 flex-shrink-0 animate-spin rounded-full border border-text-muted border-t-transparent" />
              <span>Loading...</span>
            </div>
          )}
          {node.children && sortNodes(node.children).map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              expandedPaths={expandedPaths}
              loadingPaths={loadingPaths}
              activeFilePath={activeFilePath}
              focusedPath={focusedPath}
              onToggle={onToggle}
              onClick={onClick}
              onCopyPath={onCopyPath}
              onCopyRelativePath={onCopyRelativePath}
              onCopyFileName={onCopyFileName}
              onRevealInExplorer={onRevealInExplorer}
              onFileOpen={onFileOpen}
              onOpenTerminalAt={onOpenTerminalAt}
              onStartInlineInput={onStartInlineInput}
              onRequestDelete={onRequestDelete}
              onDuplicate={onDuplicate}
              onCollapseAll={onCollapseAll}
              inlineInput={inlineInput}
              onInlineInputConfirm={onInlineInputConfirm}
              onInlineInputCancel={onInlineInputCancel}
              gitStatusMap={gitStatusMap}
              projectPath={projectPath}
            />
          ))}
          {/* Inline input for new item inside this directory */}
          {inlineInput && inlineInput.parentPath === node.path && inlineInput.type !== 'rename' && (
            <InlineInputRow
              depth={depth + 1}
              defaultValue=""
              isDirectory={inlineInput.type === 'newFolder'}
              onConfirm={onInlineInputConfirm}
              onCancel={onInlineInputCancel}
            />
          )}
        </>
      )}

      {/* If new file/folder requested in this dir but dir was collapsed, expand and show input */}
      {node.isDirectory && !isExpanded && inlineInput && inlineInput.parentPath === node.path && inlineInput.type !== 'rename' && (
        <InlineInputRow
          depth={depth + 1}
          defaultValue=""
          isDirectory={inlineInput.type === 'newFolder'}
          onConfirm={onInlineInputConfirm}
          onCancel={onInlineInputCancel}
        />
      )}
    </>
  );
}

interface FlatFileRowProps {
  node: FileTreeNode;
  relativePath: string;
  isActive: boolean;
  isFocused: boolean;
  onClick: (node: FileTreeNode) => void;
  onCopyPath: (path: string) => void;
  onCopyRelativePath: (path: string) => void;
  onCopyFileName: (path: string) => void;
  onRevealInExplorer: (path: string) => void;
  onFileOpen?: (filePath: string) => void;
  onOpenTerminalAt: (dirPath: string) => void;
  onStartInlineInput: (state: InlineInputState) => void;
  onRequestDelete: (state: DeleteConfirmState) => void;
  onDuplicate: (filePath: string) => void;
  inlineInput: InlineInputState | null;
  onInlineInputConfirm: (value: string) => void;
  onInlineInputCancel: () => void;
  gitStatusMap: Map<string, GitFileStatus>;
  projectPath: string;
}

function FlatFileRow({
  node,
  relativePath,
  isActive,
  isFocused,
  onClick,
  onCopyPath,
  onCopyRelativePath,
  onCopyFileName,
  onRevealInExplorer,
  onFileOpen,
  onOpenTerminalAt,
  onStartInlineInput,
  onRequestDelete,
  onDuplicate,
  inlineInput,
  onInlineInputConfirm,
  onInlineInputCancel,
  gitStatusMap,
  projectPath,
}: FlatFileRowProps) {
  const Icon = getFileIcon(node.name);
  const relPath = node.path.replace(projectPath, '').replace(/^[\\/]+/, '').replace(/\\/g, '/');
  const gitFile = gitStatusMap.get(relPath);
  const gitIndicator = gitFile ? getGitIndicator(gitFile) : null;

  // Split relativePath into directory prefix and filename
  const lastSlash = relativePath.lastIndexOf('/');
  const dirPrefix = lastSlash > -1 ? relativePath.slice(0, lastSlash + 1) : '';
  const fileName = lastSlash > -1 ? relativePath.slice(lastSlash + 1) : relativePath;

  const parentPath = node.path.replace(/\\/g, '/').replace(/\/[^/]+$/, '');
  const isBeingRenamed = inlineInput?.type === 'rename' && inlineInput.targetPath === node.path;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          data-path={node.path}
          className={`flex items-center gap-1.5 py-[3px] px-2 cursor-pointer text-xs select-none
            transition-colors
            ${isActive ? 'bg-accent-subtle text-text-primary' : 'text-text-secondary hover:bg-bg-hover'}
            ${isFocused ? 'ring-1 ring-inset ring-accent/40' : ''}
          `}
          onClick={() => onClick(node)}
        >
          <Icon className="w-3.5 h-3.5 flex-shrink-0 text-text-tertiary" />
          {isBeingRenamed ? (
            <InlineInputRow
              depth={0}
              defaultValue={node.name}
              isDirectory={false}
              inline
              onConfirm={onInlineInputConfirm}
              onCancel={onInlineInputCancel}
            />
          ) : (
            <span className="truncate">
              {dirPrefix && <span className="text-text-muted">{dirPrefix}</span>}
              <span className="text-text-primary">{fileName}</span>
            </span>
          )}
          {gitIndicator && !isBeingRenamed && (
            <span className={`ml-auto flex-shrink-0 text-[10px] font-mono font-bold ${gitIndicator.color}`} title={gitIndicator.title} aria-label={`File status: ${gitIndicator.title}`}>
              {gitIndicator.label}
            </span>
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="bg-bg-elevated border-border-subtle">
        <ContextMenuItem
          onClick={() => onFileOpen?.(node.path)}
          className="text-xs gap-2"
        >
          <FileCode className="w-3.5 h-3.5" />
          Open in Editor
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => onOpenTerminalAt(parentPath)}
          className="text-xs gap-2"
        >
          <TerminalSquare className="w-3.5 h-3.5" />
          Open in Integrated Terminal
        </ContextMenuItem>
        <ContextMenuSeparator className="border-border-subtle" />
        <ContextMenuItem
          onClick={() => onStartInlineInput({ type: 'newFile', parentPath })}
          className="text-xs gap-2"
        >
          <FilePlus className="w-3.5 h-3.5" />
          New File...
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => onStartInlineInput({ type: 'newFolder', parentPath })}
          className="text-xs gap-2"
        >
          <FolderPlus className="w-3.5 h-3.5" />
          New Folder...
        </ContextMenuItem>
        <ContextMenuSeparator className="border-border-subtle" />
        <ContextMenuItem
          onClick={() => onStartInlineInput({ type: 'rename', parentPath, targetPath: node.path, currentName: node.name, isDirectory: false })}
          className="text-xs gap-2"
        >
          <Pencil className="w-3.5 h-3.5" />
          Rename...
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => onDuplicate(node.path)}
          className="text-xs gap-2"
        >
          <Copy className="w-3.5 h-3.5" />
          Duplicate
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => onRequestDelete({ filePath: node.path, fileName: node.name, isDirectory: false })}
          className="text-xs gap-2 text-error"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Delete
        </ContextMenuItem>
        <ContextMenuSeparator className="border-border-subtle" />
        <ContextMenuItem
          onClick={() => onCopyPath(node.path)}
          className="text-xs gap-2"
        >
          <Clipboard className="w-3.5 h-3.5" />
          Copy Path
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => onCopyRelativePath(node.path)}
          className="text-xs gap-2"
        >
          <ClipboardCopy className="w-3.5 h-3.5" />
          Copy Relative Path
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => onCopyFileName(node.path)}
          className="text-xs gap-2"
        >
          <FileText className="w-3.5 h-3.5" />
          Copy File Name
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => onRevealInExplorer(node.path)}
          className="text-xs gap-2"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          Reveal in Explorer
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

/** Inline input row for creating new files/folders or renaming */
function InlineInputRow({
  depth,
  defaultValue,
  isDirectory,
  inline,
  onConfirm,
  onCancel,
}: {
  depth: number;
  defaultValue: string;
  isDirectory: boolean;
  /** If true, renders just the input (no wrapper row) — used for inline rename inside an existing row */
  inline?: boolean;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-focus and select the name (without extension for files)
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    if (defaultValue) {
      const dotIndex = defaultValue.lastIndexOf('.');
      if (!isDirectory && dotIndex > 0) {
        input.setSelectionRange(0, dotIndex);
      } else {
        input.select();
      }
    }
  }, [defaultValue, isDirectory]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      onConfirm(inputRef.current?.value ?? '');
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    }
  };

  const paddingLeft = inline ? 0 : 8 + depth * 16;
  const Icon = isDirectory ? FolderPlus : FilePlus;

  if (inline) {
    return (
      <input
        ref={inputRef}
        type="text"
        defaultValue={defaultValue}
        onKeyDown={handleKeyDown}
        onBlur={() => onCancel()}
        className="flex-1 min-w-0 h-5 px-1 text-xs bg-bg-secondary border border-accent/50 rounded
          text-text-primary focus:outline-none focus:border-accent"
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <div
      className="flex items-center gap-1.5 py-[3px] pr-2 text-xs"
      style={{ paddingLeft }}
    >
      <span className="w-3.5 flex-shrink-0" />
      <Icon className="w-3.5 h-3.5 flex-shrink-0 text-accent" />
      <input
        ref={inputRef}
        type="text"
        defaultValue={defaultValue}
        onKeyDown={handleKeyDown}
        onBlur={() => onCancel()}
        className="flex-1 min-w-0 h-5 px-1 text-xs bg-bg-secondary border border-accent/50 rounded
          text-text-primary focus:outline-none focus:border-accent"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
