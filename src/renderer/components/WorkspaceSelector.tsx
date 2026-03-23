import { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronDown, ChevronUp, Plus, FolderOpen, MoreVertical, Loader2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { useIpcQuery } from '../hooks/useIpc';
import { typedInvoke, typedSend } from '../lib/ipc';
import { IPC } from '../../shared/ipcChannels';
import { toast } from 'sonner';
import { Kbd } from './ui/kbd';
import type { WorkspaceListEntry, WorkspaceListResult } from '../../shared/ipcChannels';

/**
 * Workspace selector dropdown.
 * Shows current workspace name, allows switching, creating, renaming, and deleting workspaces.
 */
export function WorkspaceSelector() {
  const workspaceName = useProjectStore((s) => s.workspaceName);
  const setWorkspaceName = useProjectStore((s) => s.setWorkspaceName);

  // Fetch workspace list
  const { data: workspaceList, refetch } = useIpcQuery(IPC.WORKSPACE_LIST, [], {
    staleTime: 10000,
  });

  // Parse the workspace list response — handler returns { active: string, workspaces: [...] }
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
  const activeIndex = activeWorkspaces.findIndex((ws) => ws.active) + 1;

  // Sync workspace name to store
  useEffect(() => {
    if (activeWs && activeWs.name !== workspaceName) {
      setWorkspaceName(activeWs.name);
    }
  }, [activeWs, workspaceName, setWorkspaceName]);

  const [loading, setLoading] = useState(false);

  const handleSwitch = useCallback(
    async (key: string) => {
      if (loading) return;
      // Skip if already the active workspace
      if (parsed?.active === key) return;
      setLoading(true);
      try {
        await typedInvoke(IPC.WORKSPACE_SWITCH, key);
        refetch();
        // Re-load the project list for the newly active workspace
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
      // Reload project list for the new active workspace
      typedSend(IPC.LOAD_WORKSPACE);
      toast.success('Workspace deleted');
    } catch {
      toast.error('Failed to delete workspace');
    } finally {
      setLoading(false);
    }
    setDeleteTarget(null);
  }, [deleteTarget, refetch, loading]);

  const handleMoveUp = useCallback(async () => {
    if (!activeWs || loading) return;
    const idx = workspaces.findIndex(ws => ws.key === activeWs.key);
    if (idx <= 0) return; // Already first
    setLoading(true);
    try {
      const keys = workspaces.map(ws => ws.key);
      // Swap with previous
      [keys[idx - 1], keys[idx]] = [keys[idx], keys[idx - 1]];
      await typedInvoke(IPC.WORKSPACE_REORDER, keys);
      refetch();
    } catch {
      toast.error('Failed to reorder workspace');
    } finally {
      setLoading(false);
    }
  }, [activeWs, workspaces, loading, refetch]);

  const handleMoveDown = useCallback(async () => {
    if (!activeWs || loading) return;
    const idx = workspaces.findIndex(ws => ws.key === activeWs.key);
    if (idx < 0 || idx >= workspaces.length - 1) return; // Already last
    setLoading(true);
    try {
      const keys = workspaces.map(ws => ws.key);
      // Swap with next
      [keys[idx], keys[idx + 1]] = [keys[idx + 1], keys[idx]];
      await typedInvoke(IPC.WORKSPACE_REORDER, keys);
      refetch();
    } catch {
      toast.error('Failed to reorder workspace');
    } finally {
      setLoading(false);
    }
  }, [activeWs, workspaces, loading, refetch]);

  const handleToggleActive = useCallback(async (key: string) => {
    const ws = workspaces.find(w => w.key === key);
    if (!ws || loading) return;

    const wantDeactivate = !ws.inactive;

    // If deactivating the currently active workspace, switch to another first
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
    } catch {
      toast.error('Failed to update workspace');
    } finally {
      setLoading(false);
    }
  }, [workspaces, activeWorkspaces, loading, refetch]);

  return (
    <div className="flex items-center gap-1 px-3 py-2 border-b border-border-subtle">
      {/* Workspace dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-1 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors min-w-0 cursor-pointer">
            {activeIndex > 0 && (
              <span className="font-mono font-semibold text-accent opacity-70">#{activeIndex}</span>
            )}
            <span className="truncate">{activeWs?.name || 'Default Workspace'}</span>
            <ChevronDown className="w-3 h-3 flex-shrink-0 opacity-50" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[220px]">
          {activeWorkspaces.map((ws, i) => {
            const idx = i + 1;
            return (
              <DropdownMenuItem
                key={ws.key}
                onClick={() => handleSwitch(ws.key)}
                disabled={loading}
                className={ws.active ? 'bg-accent-subtle' : ''}
              >
                <span className="font-mono font-semibold text-accent opacity-70 mr-1.5">#{idx}</span>
                <span className="truncate">{ws.name}</span>
                {ws.projectCount > 0 && (
                  <span className="text-text-muted text-[10px] ml-1">({ws.projectCount})</span>
                )}
                {idx <= 9 && (
                  <span className="ml-auto pl-3">
                    <Kbd compact>{`Ctrl+Alt+${idx}`}</Kbd>
                  </span>
                )}
              </DropdownMenuItem>
            );
          })}
          {inactiveWorkspaces.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <div className="px-2 py-0.5 text-[9px] font-semibold text-text-muted uppercase tracking-wider">
                Inactive
              </div>
              {inactiveWorkspaces.map((ws) => (
                <DropdownMenuItem
                  key={ws.key}
                  onClick={() => handleSwitch(ws.key)}
                  disabled={loading}
                  className="opacity-50"
                >
                  <span className="truncate">{ws.name}</span>
                  {ws.projectCount > 0 && (
                    <span className="text-text-muted text-[10px] ml-1">({ws.projectCount})</span>
                  )}
                </DropdownMenuItem>
              ))}
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleCreate} disabled={loading}>
            <Plus className="w-3.5 h-3.5 mr-2" />
            New Workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* More options (rename/delete/reorder) */}
      {activeWs && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="ml-auto p-0.5 text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
              title="Workspace options"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={handleMoveUp}
              disabled={activeIndex <= 1}
            >
              <ChevronUp className="w-3.5 h-3.5 mr-2" />
              Move Up
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleMoveDown}
              disabled={activeIndex >= activeWorkspaces.length}
            >
              <ChevronDown className="w-3.5 h-3.5 mr-2" />
              Move Down
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => handleToggleActive(activeWs.key)}
            >
              Deactivate
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleRename(activeWs.key)}>
              Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => handleDelete(activeWs.key)}
              className="text-error"
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Add project button */}
      <AddProjectButton />

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
          className="p-0.5 text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
          title="Add project"
        >
          <Plus className="w-3.5 h-3.5" />
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
