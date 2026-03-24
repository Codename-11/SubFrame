import { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Plus, FolderOpen, MoreVertical, Loader2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useProjectStore } from '../stores/useProjectStore';
import { useTerminalStore } from '../stores/useTerminalStore';
import { useIpcQuery } from '../hooks/useIpc';
import { typedInvoke, typedSend } from '../lib/ipc';
import { IPC } from '../../shared/ipcChannels';
import { toast } from 'sonner';
import type { WorkspaceListEntry, WorkspaceListResult } from '../../shared/ipcChannels';

/**
 * Compact workspace selector — single-line dropdown showing active workspace.
 * Primary workspace switching happens via ViewTabBar pills.
 * This provides: dropdown list, rename, deactivate, delete, reorder, create.
 * Right-click the workspace name for a context menu.
 */
export function WorkspaceSelector() {
  const workspaceName = useProjectStore((s) => s.workspaceName);
  const setWorkspaceName = useProjectStore((s) => s.setWorkspaceName);
  const projects = useProjectStore((s) => s.projects);
  const terminals = useTerminalStore((s) => s.terminals);

  // Fetch workspace list
  const { data: workspaceList, refetch } = useIpcQuery(IPC.WORKSPACE_LIST, [], {
    staleTime: 10000,
  });

  // Parse the workspace list response
  const parsed = workspaceList as WorkspaceListResult | undefined;
  const workspaces = useMemo<(WorkspaceListEntry & { projectCount: number; inactive: boolean })[]>(() =>
    parsed?.workspaces?.map((ws) => ({
      key: ws.key,
      name: ws.name,
      active: ws.key === parsed.active,
      projectCount: ws.projectCount ?? 0,
      inactive: ws.inactive ?? false,
    })) ?? [],
    [parsed]
  );

  // Split workspaces into active and inactive groups
  const activeWorkspaces = workspaces.filter(ws => !ws.inactive);
  const inactiveWorkspaces = workspaces.filter(ws => ws.inactive);

  // Find active workspace and its 1-based index within the active group
  const activeWs = workspaces.find((ws) => ws.active);
  const activeIndex = activeWs ? activeWorkspaces.findIndex(ws => ws.key === activeWs.key) + 1 : 0;

  // Sync workspace name to store
  useEffect(() => {
    if (activeWs && activeWs.name !== workspaceName) {
      setWorkspaceName(activeWs.name);
    }
  }, [activeWs, workspaceName, setWorkspaceName]);

  const [loading, setLoading] = useState(false);

  // Determine agent activity for current workspace
  const allTerminals = useMemo(() => Array.from(terminals.values()), [terminals]);
  const currentProjectPaths = useMemo(
    () => new Set(projects.map(p => p.path)),
    [projects]
  );

  const getAgentStatus = useCallback((wsKey: string, isCurrentWs: boolean): 'active' | 'has-terminals' | 'idle' => {
    if (isCurrentWs) {
      const hasActive = allTerminals.some(
        t => currentProjectPaths.has(t.projectPath) && t.claudeActive
      );
      if (hasActive) return 'active';
      const hasTerminals = allTerminals.some(t => currentProjectPaths.has(t.projectPath));
      if (hasTerminals) return 'has-terminals';
      return 'idle';
    }
    return 'idle';
  }, [allTerminals, currentProjectPaths]);

  const handleSwitch = useCallback(
    async (key: string) => {
      if (loading) return;
      if (parsed?.active === key) return;
      setLoading(true);
      try {
        await typedInvoke(IPC.WORKSPACE_SWITCH, key);
        refetch();
        typedSend(IPC.LOAD_WORKSPACE);
      } catch {
        toast.error('Failed to switch workspace');
      } finally {
        setLoading(false);
      }
    },
    [refetch, loading, parsed]
  );

  // Dialog state for create
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createName, setCreateName] = useState('');

  const handleCreate = useCallback(() => {
    setCreateName('');
    setShowCreateDialog(true);
  }, []);

  // Listen for create event from ViewTabBar's + button
  useEffect(() => {
    const handler = () => handleCreate();
    window.addEventListener('open-workspace-create', handler);
    return () => window.removeEventListener('open-workspace-create', handler);
  }, [handleCreate]);

  const confirmCreate = useCallback(async () => {
    const name = createName.trim();
    if (loading || !name) return;
    setLoading(true);
    try {
      await typedInvoke(IPC.WORKSPACE_CREATE, name);
      refetch();
      typedSend(IPC.LOAD_WORKSPACE);
      toast.success(`Workspace "${name}" created`);
      setShowCreateDialog(false);
    } catch {
      toast.error('Failed to create workspace');
    } finally {
      setLoading(false);
    }
  }, [refetch, loading, createName]);

  // Dialog state for rename
  const [renameTarget, setRenameTarget] = useState<{ key: string; name: string } | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Dialog state for delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{ key: string; name: string } | null>(null);

  const handleRename = useCallback(
    (key: string) => {
      const currentWs = workspaces.find((ws) => ws.key === key);
      setRenameTarget({ key, name: currentWs?.name || '' });
      setRenameValue(currentWs?.name || '');
    },
    [workspaces]
  );

  const confirmRename = useCallback(async () => {
    if (!renameTarget || loading) return;
    const trimmed = renameValue.trim();
    if (trimmed) {
      setLoading(true);
      try {
        await typedInvoke(IPC.WORKSPACE_RENAME, { key: renameTarget.key, newName: trimmed });
        refetch();
        toast.success('Workspace renamed');
      } catch {
        toast.error('Failed to rename workspace');
      } finally {
        setLoading(false);
      }
    }
    setRenameTarget(null);
  }, [renameTarget, renameValue, refetch, loading]);

  const handleDelete = useCallback(
    (key: string) => {
      const currentWs = workspaces.find((ws) => ws.key === key);
      setDeleteTarget({ key, name: currentWs?.name || '' });
    },
    [workspaces]
  );

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget || loading) return;
    setLoading(true);
    try {
      await typedInvoke(IPC.WORKSPACE_DELETE, deleteTarget.key);
      refetch();
      typedSend(IPC.LOAD_WORKSPACE);
      toast.success('Workspace deleted');
    } catch {
      toast.error('Failed to delete workspace');
    } finally {
      setLoading(false);
    }
    setDeleteTarget(null);
  }, [deleteTarget, refetch, loading]);

  const handleMoveLeft = useCallback(async (key: string) => {
    if (loading) return;
    const idx = activeWorkspaces.findIndex(ws => ws.key === key);
    if (idx <= 0) return;
    setLoading(true);
    try {
      const keys = activeWorkspaces.map(ws => ws.key);
      [keys[idx - 1], keys[idx]] = [keys[idx], keys[idx - 1]];
      const inactiveKeys = inactiveWorkspaces.map(ws => ws.key);
      await typedInvoke(IPC.WORKSPACE_REORDER, [...keys, ...inactiveKeys]);
      refetch();
      toast.success('Workspace order updated');
    } catch {
      toast.error('Failed to reorder workspace');
    } finally {
      setLoading(false);
    }
  }, [activeWorkspaces, inactiveWorkspaces, loading, refetch]);

  const handleMoveRight = useCallback(async (key: string) => {
    if (loading) return;
    const idx = activeWorkspaces.findIndex(ws => ws.key === key);
    if (idx < 0 || idx >= activeWorkspaces.length - 1) return;
    setLoading(true);
    try {
      const keys = activeWorkspaces.map(ws => ws.key);
      [keys[idx], keys[idx + 1]] = [keys[idx + 1], keys[idx]];
      const inactiveKeys = inactiveWorkspaces.map(ws => ws.key);
      await typedInvoke(IPC.WORKSPACE_REORDER, [...keys, ...inactiveKeys]);
      refetch();
      toast.success('Workspace order updated');
    } catch {
      toast.error('Failed to reorder workspace');
    } finally {
      setLoading(false);
    }
  }, [activeWorkspaces, inactiveWorkspaces, loading, refetch]);

  const handleToggleActive = useCallback(async (key: string) => {
    const ws = workspaces.find(w => w.key === key);
    if (!ws || loading) return;

    const wantDeactivate = !ws.inactive;

    if (wantDeactivate && ws.active) {
      const otherActive = activeWorkspaces.find(w => w.key !== key);
      if (!otherActive) {
        toast.warning('Cannot deactivate — no other active workspace to switch to');
        return;
      }
      setLoading(true);
      try {
        await typedInvoke(IPC.WORKSPACE_SWITCH, otherActive.key);
        await typedInvoke(IPC.WORKSPACE_SET_INACTIVE, { key, inactive: true });
        refetch();
        typedSend(IPC.LOAD_WORKSPACE);
        toast.success('Workspace deactivated');
      } catch {
        toast.error('Failed to deactivate workspace');
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      await typedInvoke(IPC.WORKSPACE_SET_INACTIVE, { key, inactive: wantDeactivate });
      refetch();
      toast.success(wantDeactivate ? 'Workspace deactivated' : 'Workspace activated');
    } catch {
      toast.error('Failed to update workspace');
    } finally {
      setLoading(false);
    }
  }, [workspaces, activeWorkspaces, loading, refetch]);

  const currentAgentStatus = activeWs ? getAgentStatus(activeWs.key, true) : 'idle';

  return (
    <div className="border-b border-border-subtle">
      <div className="flex items-center h-7 px-1">
        {/* Active workspace dropdown — shows current workspace, click to list all */}
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div className="flex-1 min-w-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    disabled={loading}
                    className="flex items-center gap-1 px-1.5 h-6 text-[11px] font-medium
                      hover:bg-bg-hover/50 transition-colors cursor-pointer rounded
                      text-text-primary disabled:opacity-50 min-w-0 max-w-full"
                  >
                    {loading && <Loader2 className="w-3 h-3 animate-spin flex-shrink-0 text-text-muted" />}
                    <span className="font-mono text-[10px] text-accent flex-shrink-0">#{activeIndex}</span>
                    <span className="truncate">{activeWs?.name ?? 'Workspace'}</span>
                    {/* Agent status dot */}
                    {currentAgentStatus === 'active' && (
                      <span className="relative flex-shrink-0 w-1.5 h-1.5">
                        <span className="absolute inset-0 rounded-full bg-success animate-ping opacity-40" />
                        <span className="absolute inset-0 rounded-full bg-success" />
                      </span>
                    )}
                    <ChevronDown className="w-3 h-3 text-text-muted flex-shrink-0" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[200px] max-h-[400px] overflow-y-auto">
                  {/* Active workspaces */}
                  {activeWorkspaces.map((ws, i) => {
                    const idx = i + 1;
                    const isActive = ws.active;
                    return (
                      <DropdownMenuItem
                        key={ws.key}
                        disabled={loading}
                        onClick={() => handleSwitch(ws.key)}
                        className={`cursor-pointer text-xs py-1 ${isActive ? 'bg-accent/10 text-accent' : ''}`}
                      >
                        <span className="font-mono text-[10px] opacity-70 mr-1.5">#{idx}</span>
                        <span className="truncate">{ws.name}</span>
                        {ws.projectCount > 0 && (
                          <span className="text-text-muted text-[10px] ml-1">({ws.projectCount})</span>
                        )}
                        {isActive && (
                          <span className="ml-auto text-[9px] text-accent">Active</span>
                        )}
                      </DropdownMenuItem>
                    );
                  })}
                  {/* Inactive workspaces */}
                  {inactiveWorkspaces.length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <div className="px-2 py-0.5 text-[9px] font-semibold text-text-muted uppercase tracking-wider">
                        Inactive
                      </div>
                      {inactiveWorkspaces.map((ws) => (
                        <DropdownMenuItem
                          key={ws.key}
                          disabled={loading}
                          className="opacity-50 cursor-pointer text-xs py-1"
                          onClick={() => handleToggleActive(ws.key)}
                        >
                          <span className="truncate">{ws.name}</span>
                          {ws.projectCount > 0 && (
                            <span className="text-text-muted text-[10px] ml-1">({ws.projectCount})</span>
                          )}
                          <span className="ml-auto text-[9px] text-text-muted">Activate</span>
                        </DropdownMenuItem>
                      ))}
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </ContextMenuTrigger>
          {/* Right-click context menu on the active workspace name */}
          {activeWs && (
            <ContextMenuContent className="min-w-[160px]">
              <ContextMenuItem
                onClick={() => handleRename(activeWs.key)}
                className="text-xs cursor-default"
              >
                Rename
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => handleToggleActive(activeWs.key)}
                className="text-xs cursor-default"
              >
                Deactivate
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem
                onClick={() => handleMoveLeft(activeWs.key)}
                disabled={activeIndex <= 1}
                className="text-xs cursor-default"
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-1.5" />
                Move Left
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => handleMoveRight(activeWs.key)}
                disabled={activeIndex >= activeWorkspaces.length}
                className="text-xs cursor-default"
              >
                <ChevronRight className="w-3.5 h-3.5 mr-1.5" />
                Move Right
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem
                onClick={() => handleDelete(activeWs.key)}
                className="text-xs text-error cursor-default"
              >
                Delete
              </ContextMenuItem>
            </ContextMenuContent>
          )}
        </ContextMenu>

        {/* Management menu (three-dot) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center justify-center w-6 h-6 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-hover/50 transition-colors cursor-pointer flex-shrink-0"
              title="Workspace options"
            >
              <MoreVertical className="w-3 h-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[180px]">
            {activeWs && (
              <>
                <DropdownMenuItem onClick={() => handleRename(activeWs.key)} disabled={loading} className="text-xs cursor-pointer">
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleToggleActive(activeWs.key)} disabled={loading} className="text-xs cursor-pointer">
                  Deactivate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={handleCreate} disabled={loading} className="text-xs cursor-pointer">
              <Plus className="w-3.5 h-3.5 mr-2" />
              New Workspace
            </DropdownMenuItem>
            {activeWs && (
              <DropdownMenuItem
                onClick={() => handleDelete(activeWs.key)}
                disabled={loading}
                className="text-xs text-error cursor-pointer"
              >
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Add project button */}
        <AddProjectButton />
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="bg-bg-primary border-border-subtle text-text-primary">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Workspace</AlertDialogTitle>
            <AlertDialogDescription className="text-text-secondary text-xs">
              Delete workspace &ldquo;{deleteTarget?.name}&rdquo;? Projects will not be deleted, only removed from this workspace.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-error text-white hover:bg-error/80 cursor-pointer"
              disabled={loading}
              onClick={confirmDelete}
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create workspace dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => !open && setShowCreateDialog(false)}>
        <DialogContent className="bg-bg-primary border-border-subtle text-text-primary sm:max-w-sm" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>New Workspace</DialogTitle>
            <DialogDescription className="text-text-secondary text-xs">
              Give your workspace a name.
            </DialogDescription>
          </DialogHeader>
          <input
            type="text"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirmCreate();
            }}
            placeholder="e.g. Work, Personal, Client X"
            className="w-full px-3 py-2 text-xs rounded-md bg-bg-deep border border-border-subtle text-text-primary outline-none focus:border-accent"
            autoFocus
          />
          <DialogFooter>
            <button
              onClick={() => setShowCreateDialog(false)}
              className="px-3 py-1.5 text-xs rounded-md border border-border-subtle text-text-secondary hover:bg-bg-hover transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={confirmCreate}
              disabled={loading || !createName.trim()}
              className="px-3 py-1.5 text-xs rounded-md bg-accent text-bg-deep hover:bg-accent/80 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              Create
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={!!renameTarget} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent className="bg-bg-primary border-border-subtle text-text-primary sm:max-w-sm" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Rename Workspace</DialogTitle>
            <DialogDescription className="text-text-secondary text-xs">
              Enter a new name for this workspace.
            </DialogDescription>
          </DialogHeader>
          <input
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirmRename();
            }}
            className="w-full px-3 py-2 text-xs rounded-md bg-bg-deep border border-border-subtle text-text-primary outline-none focus:border-accent"
            autoFocus
          />
          <DialogFooter>
            <button
              onClick={() => setRenameTarget(null)}
              className="px-3 py-1.5 text-xs rounded-md border border-border-subtle text-text-secondary hover:bg-bg-hover transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={confirmRename}
              disabled={loading || !renameValue.trim() || renameValue.trim() === renameTarget?.name}
              className="px-3 py-1.5 text-xs rounded-md bg-accent text-bg-deep hover:bg-accent/80 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              Rename
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Add project button with dropdown for Browse / Create / Discovered */
function AddProjectButton() {
  const projects = useProjectStore((s) => s.projects);
  const [discovered, setDiscovered] = useState<WorkspaceListEntry[]>([]);
  const [open, setOpen] = useState(false);

  // Scan default project dir when dropdown opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const settings = await typedInvoke(IPC.LOAD_SETTINGS);
        const dir = (settings?.general as Record<string, unknown>)?.defaultProjectDir as string;
        if (!dir) {
          setDiscovered([]);
          return;
        }
        const scanned = await typedInvoke(IPC.SCAN_PROJECT_DIR, dir);
        if (cancelled) return;
        // Filter out projects already in the workspace
        const existing = new Set(projects.map((p) => p.path));
        const filtered = (scanned || []).filter((p: any) => !existing.has(p.path));
        setDiscovered(filtered.map((p: any) => ({ key: p.path, name: p.name, active: false })));
      } catch {
        if (!cancelled) setDiscovered([]);
      }
    })();
    return () => { cancelled = true; };
  }, [open, projects]);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center justify-center w-6 h-6 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-hover/50 transition-colors cursor-pointer flex-shrink-0"
          title="Add project"
        >
          <Plus className="w-3 h-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[200px] max-h-[400px] overflow-y-auto">
        <DropdownMenuItem onClick={() => typedSend(IPC.SELECT_PROJECT_FOLDER)} className="cursor-pointer text-xs py-1">
          <FolderOpen className="w-3 h-3 mr-2 text-text-tertiary" />
          Select Folder...
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => typedSend(IPC.CREATE_NEW_PROJECT)} className="cursor-pointer text-xs py-1">
          <Plus className="w-3 h-3 mr-2 text-text-tertiary" />
          Create New Project...
        </DropdownMenuItem>
        {discovered.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-0.5 text-[9px] font-semibold text-text-muted uppercase tracking-wider">
              Discovered
            </div>
            {discovered.map((p) => (
              <DropdownMenuItem
                key={p.key}
                className="cursor-pointer text-xs py-1"
                onClick={() => {
                  typedSend(IPC.ADD_PROJECT_TO_WORKSPACE, {
                    projectPath: p.key,
                    name: p.name,
                  });
                  setOpen(false);
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0 mr-2" />
                <span className="truncate">{p.name}</span>
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
