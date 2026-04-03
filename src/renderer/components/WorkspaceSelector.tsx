import { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Plus, FolderOpen, FolderPlus, SkipForward, ArrowLeft, MoreVertical, Loader2, Check } from 'lucide-react';
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
import { normalizeWorkspaceAccentColor } from '../lib/workspacePills';

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
  const workspaces = useMemo<(WorkspaceListEntry & { projectCount: number; inactive: boolean; accentColor?: string })[]>(() =>
    parsed?.workspaces?.map((ws) => ({
      key: ws.key,
      name: ws.name,
      active: ws.key === parsed.active,
      projectCount: ws.projectCount ?? 0,
      inactive: ws.inactive ?? false,
      accentColor: normalizeWorkspaceAccentColor(ws.accentColor) ?? undefined,
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
  const [workspaceDropdownOpen, setWorkspaceDropdownOpen] = useState(false);

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
        setWorkspaceDropdownOpen(false);
      } catch {
        toast.error('Failed to switch workspace');
      } finally {
        setLoading(false);
      }
    },
    [refetch, loading, parsed]
  );

  // Dialog state for create (two-step)
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createStep, setCreateStep] = useState<1 | 2>(1);

  // Step 2 state
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderParent, setNewFolderParent] = useState('');
  const [initAsSubFrame, setInitAsSubFrame] = useState(false);
  const [createMode, setCreateMode] = useState<'browse' | 'create' | null>(null);

  const resetCreateDialog = useCallback(() => {
    setCreateName('');
    setCreateStep(1);
    setNewFolderName('');
    setNewFolderParent('');
    setInitAsSubFrame(false);
    setCreateMode(null);
  }, []);

  const handleCreate = useCallback(() => {
    resetCreateDialog();
    setShowCreateDialog(true);
  }, [resetCreateDialog]);

  // Listen for create event from ViewTabBar's + button
  useEffect(() => {
    const handler = () => handleCreate();
    window.addEventListener('open-workspace-create', handler);
    return () => window.removeEventListener('open-workspace-create', handler);
  }, [handleCreate]);

  const finalizeWorkspaceCreate = useCallback(async (projectPath?: string, projectName?: string, shouldInit?: boolean) => {
    const name = createName.trim();
    if (loading || !name) return;
    setLoading(true);
    try {
      await typedInvoke(IPC.WORKSPACE_CREATE, name);
      // If a project was selected/created, add it to the new workspace
      if (projectPath && projectName) {
        typedSend(IPC.ADD_PROJECT_TO_WORKSPACE, {
          projectPath,
          name: projectName,
        });
        // Optionally initialize as SubFrame project
        if (shouldInit) {
          typedSend(IPC.INITIALIZE_FRAME_PROJECT, {
            projectPath,
            projectName,
            confirmed: true,
          });
        }
      }
      refetch();
      typedSend(IPC.LOAD_WORKSPACE);
      toast.success(`Workspace "${name}" created`);
      setShowCreateDialog(false);
      resetCreateDialog();
    } catch {
      toast.error('Failed to create workspace');
    } finally {
      setLoading(false);
    }
  }, [refetch, loading, createName, resetCreateDialog]);

  const handleBrowseExisting = useCallback(async () => {
    try {
      const result = await typedInvoke(IPC.SELECT_FOLDER);
      if (result) {
        const folderName = result.path.split(/[/\\]/).pop() || 'Project';
        await finalizeWorkspaceCreate(result.path, folderName, initAsSubFrame);
      }
    } catch {
      toast.error('Failed to select folder');
    }
  }, [finalizeWorkspaceCreate, initAsSubFrame]);

  const handleCreateNewFolder = useCallback(async () => {
    const trimmedName = newFolderName.trim();
    if (!trimmedName || !newFolderParent) return;
    setLoading(true);
    try {
      const result = await typedInvoke(IPC.CREATE_FOLDER, {
        parentPath: newFolderParent,
        folderName: trimmedName,
      });
      await finalizeWorkspaceCreate(result.path, trimmedName, initAsSubFrame);
    } catch {
      toast.error('Failed to create folder');
    } finally {
      setLoading(false);
    }
  }, [newFolderName, newFolderParent, finalizeWorkspaceCreate, initAsSubFrame]);

  const handleChooseParentDir = useCallback(async () => {
    try {
      const result = await typedInvoke(IPC.SELECT_FOLDER);
      if (result) {
        setNewFolderParent(result.path);
      }
    } catch {
      toast.error('Failed to select location');
    }
  }, []);

  // Dialog state for rename
  const [renameTarget, setRenameTarget] = useState<{ key: string; name: string } | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Dialog state for delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{ key: string; name: string } | null>(null);

  const handleRename = useCallback(
    (key: string) => {
      const currentWs = workspaces.find((ws) => ws.key === key);
      setWorkspaceDropdownOpen(false);
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
      setWorkspaceDropdownOpen(false);
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
      // Safety: restore body pointer-events (Radix modal menu cleanup)
      setTimeout(() => {
        if (document.body.style.pointerEvents === 'none') {
          document.body.style.pointerEvents = '';
        }
      }, 300);
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
      const currentIndex = activeWorkspaces.findIndex(w => w.key === key);
      const otherActive =
        activeWorkspaces[currentIndex + 1]
        ?? activeWorkspaces[currentIndex - 1]
        ?? activeWorkspaces.find(w => w.key !== key);
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
        setWorkspaceDropdownOpen(false);
        toast.success('Workspace deactivated');
      } catch {
        toast.error('Failed to deactivate workspace');
      } finally {
        setLoading(false);
        // Safety: Radix modal menus add pointer-events:none to <body> while open.
        // If the menu trigger unmounts (workspace removed from list) before the
        // close animation completes, that style can be orphaned — blocking all UI.
        setTimeout(() => {
          if (document.body.style.pointerEvents === 'none') {
            document.body.style.pointerEvents = '';
          }
        }, 300);
      }
      return;
    }

    setLoading(true);
    try {
      await typedInvoke(IPC.WORKSPACE_SET_INACTIVE, { key, inactive: wantDeactivate });
      refetch();
      setWorkspaceDropdownOpen(false);
      toast.success(wantDeactivate ? 'Workspace deactivated' : 'Workspace activated');
    } catch {
      toast.error('Failed to update workspace');
    } finally {
      setLoading(false);
      // Safety: same pointer-events cleanup
      setTimeout(() => {
        if (document.body.style.pointerEvents === 'none') {
          document.body.style.pointerEvents = '';
        }
      }, 300);
    }
  }, [workspaces, activeWorkspaces, loading, refetch]);

  const openWorkspaceSettings = useCallback((key: string) => {
    setWorkspaceDropdownOpen(false);
    window.dispatchEvent(new CustomEvent('open-workspace-settings', { detail: { key } }));
  }, []);

  const handleDuplicate = useCallback(async (key: string) => {
    if (loading) return;
    setLoading(true);
    try {
      await typedInvoke(IPC.WORKSPACE_DUPLICATE, key);
      refetch();
      typedSend(IPC.LOAD_WORKSPACE);
      setWorkspaceDropdownOpen(false);
      toast.success('Workspace duplicated');
    } catch {
      toast.error('Failed to duplicate workspace');
    } finally {
      setLoading(false);
    }
  }, [loading, refetch]);

  const renderWorkspaceContextMenu = useCallback((ws: { key: string; name: string; active: boolean; inactive: boolean }, activePosition: number) => (
    <ContextMenuContent className="min-w-[170px]">
      {ws.inactive ? (
        <>
          <ContextMenuItem onClick={() => handleToggleActive(ws.key)} className="text-xs cursor-default">
            Activate
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => handleDuplicate(ws.key)} className="text-xs cursor-default">
            Duplicate Workspace
          </ContextMenuItem>
          <ContextMenuItem onClick={() => openWorkspaceSettings(ws.key)} className="text-xs cursor-default">
            Manage Identity
          </ContextMenuItem>
          <ContextMenuItem onClick={() => handleRename(ws.key)} className="text-xs cursor-default">
            Rename
          </ContextMenuItem>
          <ContextMenuItem onClick={() => handleDelete(ws.key)} className="text-xs text-error cursor-default">
            Delete
          </ContextMenuItem>
        </>
      ) : (
        <>
          {!ws.active && (
            <ContextMenuItem onClick={() => handleSwitch(ws.key)} className="text-xs cursor-default">
              Switch To Workspace
            </ContextMenuItem>
          )}
          <ContextMenuItem onClick={() => handleDuplicate(ws.key)} className="text-xs cursor-default">
            Duplicate Workspace
          </ContextMenuItem>
          <ContextMenuItem onClick={() => openWorkspaceSettings(ws.key)} className="text-xs cursor-default">
            Manage Identity
          </ContextMenuItem>
          <ContextMenuItem onClick={() => handleRename(ws.key)} className="text-xs cursor-default">
            Rename
          </ContextMenuItem>
          <ContextMenuItem onClick={() => handleToggleActive(ws.key)} className="text-xs cursor-default">
            Deactivate
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() => handleMoveLeft(ws.key)}
            disabled={activePosition <= 1}
            className="text-xs cursor-default"
          >
            <ChevronLeft className="w-3.5 h-3.5 mr-1.5" />
            Move Left
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => handleMoveRight(ws.key)}
            disabled={activePosition >= activeWorkspaces.length}
            className="text-xs cursor-default"
          >
            <ChevronRight className="w-3.5 h-3.5 mr-1.5" />
            Move Right
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => handleDelete(ws.key)} className="text-xs text-error cursor-default">
            Delete
          </ContextMenuItem>
        </>
      )}
    </ContextMenuContent>
  ), [activeWorkspaces.length, handleDelete, handleDuplicate, handleMoveLeft, handleMoveRight, handleRename, handleSwitch, handleToggleActive, openWorkspaceSettings]);

  const currentAgentStatus = activeWs ? getAgentStatus(activeWs.key, true) : 'idle';

  return (
    <div className="border-b border-border-subtle">
      <div className="flex items-center h-7 px-1">
        {/* Active workspace dropdown — shows current workspace, click to list all */}
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div className="flex-1 min-w-0">
              <DropdownMenu open={workspaceDropdownOpen} onOpenChange={setWorkspaceDropdownOpen}>
                <DropdownMenuTrigger asChild>
                  <button
                    disabled={loading}
                    className="flex items-center gap-1 px-1.5 h-6 text-[11px] font-medium
                      hover:bg-bg-hover/50 transition-colors cursor-pointer rounded
                      text-text-primary disabled:opacity-50 min-w-0 max-w-full"
                  >
                    {loading && <Loader2 className="w-3 h-3 animate-spin flex-shrink-0 text-text-muted" />}
                    <span className="font-mono text-[10px] text-accent flex-shrink-0">#{activeIndex}</span>
                    {activeWs?.accentColor && (
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0 border border-black/20"
                        style={{ backgroundColor: activeWs.accentColor }}
                      />
                    )}
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
                      <ContextMenu key={ws.key}>
                        <ContextMenuTrigger asChild>
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => handleSwitch(ws.key)}
                            className={`flex w-full items-center px-2 py-1.5 text-left text-xs rounded-sm ${
                              isActive ? 'bg-accent/10 text-accent' : 'text-text-primary hover:bg-bg-hover'
                            } disabled:opacity-50 disabled:pointer-events-none`}
                          >
                            <span className="font-mono text-[10px] opacity-70 mr-1.5">#{idx}</span>
                            {ws.accentColor && (
                              <span
                                className="w-2 h-2 rounded-full mr-1.5 flex-shrink-0 border border-black/20"
                                style={{ backgroundColor: ws.accentColor }}
                              />
                            )}
                            <span className="truncate">{ws.name}</span>
                            {ws.projectCount > 0 && (
                              <span className="text-text-muted text-[10px] ml-1">({ws.projectCount})</span>
                            )}
                            {isActive && (
                              <span className="ml-auto text-[9px] text-accent">Active</span>
                            )}
                          </button>
                        </ContextMenuTrigger>
                        {renderWorkspaceContextMenu(ws, idx)}
                      </ContextMenu>
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
                        <ContextMenu key={ws.key}>
                          <ContextMenuTrigger asChild>
                            <button
                              type="button"
                              disabled={loading}
                              className="flex w-full items-center px-2 py-1.5 text-left text-xs rounded-sm opacity-65 text-text-secondary hover:bg-bg-hover disabled:opacity-40 disabled:pointer-events-none"
                              onClick={() => handleToggleActive(ws.key)}
                            >
                              {ws.accentColor && (
                                <span
                                  className="w-2 h-2 rounded-full mr-2 mt-0.5 flex-shrink-0 border border-black/20"
                                  style={{ backgroundColor: ws.accentColor }}
                                />
                              )}
                              <div className="min-w-0">
                                <div className="truncate">{ws.name}</div>
                                <div className="text-[9px] text-text-muted">Click to reactivate</div>
                              </div>
                              {ws.projectCount > 0 && (
                                <span className="text-text-muted text-[10px] ml-1">({ws.projectCount})</span>
                              )}
                              <span className="ml-auto text-[9px] text-text-muted">Activate</span>
                            </button>
                          </ContextMenuTrigger>
                          {renderWorkspaceContextMenu(ws, -1)}
                        </ContextMenu>
                      ))}
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </ContextMenuTrigger>
          {/* Right-click context menu on the current workspace label */}
          {activeWs && (
            renderWorkspaceContextMenu(activeWs, activeIndex)
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
                <DropdownMenuItem onClick={() => handleDuplicate(activeWs.key)} disabled={loading} className="text-xs cursor-pointer">
                  Duplicate Workspace
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

      {/* Create workspace dialog (two-step) */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => {
        if (!open) {
          setShowCreateDialog(false);
          resetCreateDialog();
        }
      }}>
        <DialogContent className="bg-bg-primary border-border-subtle text-text-primary sm:max-w-md" showCloseButton={false}>
          {createStep === 1 ? (
            <>
              <DialogHeader>
                <DialogTitle>New Workspace</DialogTitle>
                <DialogDescription className="text-text-secondary text-xs">
                  Step 1 of 2 — Give your workspace a name.
                </DialogDescription>
              </DialogHeader>
              <input
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && createName.trim()) setCreateStep(2);
                }}
                placeholder="e.g. Work, Personal, Client X"
                className="w-full px-3 py-2 text-xs rounded-md bg-bg-deep border border-border-subtle text-text-primary outline-none focus:border-accent"
                autoFocus
              />
              <DialogFooter>
                <button
                  onClick={() => { setShowCreateDialog(false); resetCreateDialog(); }}
                  className="px-3 py-1.5 text-xs rounded-md border border-border-subtle text-text-secondary hover:bg-bg-hover transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setCreateStep(2)}
                  disabled={!createName.trim()}
                  className="px-3 py-1.5 text-xs rounded-md bg-accent text-bg-deep hover:bg-accent/80 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>New Workspace</DialogTitle>
                <DialogDescription className="text-text-secondary text-xs">
                  Step 2 of 2 — Add a project to &ldquo;{createName.trim()}&rdquo;.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-2">
                {/* Option: Browse Existing Folder */}
                <button
                  onClick={handleBrowseExisting}
                  disabled={loading}
                  className="flex items-center gap-3 w-full px-3 py-3 text-left text-xs rounded-md border border-border-subtle bg-bg-deep hover:border-accent hover:bg-bg-hover transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FolderOpen className="w-4 h-4 text-accent flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium text-text-primary">Add Existing Folder</div>
                    <div className="text-[10px] text-text-muted mt-0.5">Browse for an existing project folder</div>
                  </div>
                </button>

                {/* Option: Create New Folder */}
                <button
                  onClick={() => setCreateMode(createMode === 'create' ? null : 'create')}
                  disabled={loading}
                  className={`flex items-center gap-3 w-full px-3 py-3 text-left text-xs rounded-md border transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    createMode === 'create'
                      ? 'border-accent bg-accent/5'
                      : 'border-border-subtle bg-bg-deep hover:border-accent hover:bg-bg-hover'
                  }`}
                >
                  <FolderPlus className="w-4 h-4 text-accent flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium text-text-primary">Create New Folder</div>
                    <div className="text-[10px] text-text-muted mt-0.5">Create a new project folder on disk</div>
                  </div>
                </button>

                {/* Expanded sub-form for Create New Folder */}
                {createMode === 'create' && (
                  <div className="ml-7 flex flex-col gap-2 pl-3 border-l border-border-subtle">
                    <div>
                      <label className="text-[10px] text-text-muted mb-1 block">Folder name</label>
                      <input
                        type="text"
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        placeholder="my-project"
                        className="w-full px-2.5 py-1.5 text-xs rounded-md bg-bg-deep border border-border-subtle text-text-primary outline-none focus:border-accent"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-text-muted mb-1 block">Location</label>
                      <div className="flex items-center gap-2">
                        <span className="flex-1 px-2.5 py-1.5 text-xs rounded-md bg-bg-deep border border-border-subtle text-text-secondary truncate min-w-0">
                          {newFolderParent || 'No location selected'}
                        </span>
                        <button
                          onClick={handleChooseParentDir}
                          className="px-2.5 py-1.5 text-xs rounded-md border border-border-subtle text-text-secondary hover:bg-bg-hover transition-colors cursor-pointer flex-shrink-0"
                        >
                          Choose...
                        </button>
                      </div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <span className={`flex items-center justify-center w-3.5 h-3.5 rounded border transition-colors ${
                        initAsSubFrame ? 'bg-accent border-accent' : 'border-border-default bg-bg-deep'
                      }`}>
                        {initAsSubFrame && <Check className="w-2.5 h-2.5 text-bg-deep" />}
                      </span>
                      <input
                        type="checkbox"
                        checked={initAsSubFrame}
                        onChange={(e) => setInitAsSubFrame(e.target.checked)}
                        className="sr-only"
                      />
                      <span className="text-[11px] text-text-secondary">Initialize as SubFrame project</span>
                    </label>
                    <button
                      onClick={handleCreateNewFolder}
                      disabled={loading || !newFolderName.trim() || !newFolderParent}
                      className="px-3 py-1.5 text-xs rounded-md bg-accent text-bg-deep hover:bg-accent/80 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 self-end mt-1"
                    >
                      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                      Create & Add
                    </button>
                  </div>
                )}

                {/* Option: Skip */}
                <button
                  onClick={() => finalizeWorkspaceCreate()}
                  disabled={loading}
                  className="flex items-center gap-3 w-full px-3 py-3 text-left text-xs rounded-md border border-border-subtle bg-bg-deep hover:border-accent hover:bg-bg-hover transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <SkipForward className="w-4 h-4 text-text-muted flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium text-text-primary">Skip for now</div>
                    <div className="text-[10px] text-text-muted mt-0.5">Create an empty workspace, add projects later</div>
                  </div>
                </button>
              </div>
              <DialogFooter>
                <button
                  onClick={() => { setCreateStep(1); setCreateMode(null); }}
                  className="px-3 py-1.5 text-xs rounded-md border border-border-subtle text-text-secondary hover:bg-bg-hover transition-colors cursor-pointer flex items-center gap-1"
                >
                  <ArrowLeft className="w-3 h-3" />
                  Back
                </button>
                <button
                  onClick={() => { setShowCreateDialog(false); resetCreateDialog(); }}
                  className="px-3 py-1.5 text-xs rounded-md border border-border-subtle text-text-secondary hover:bg-bg-hover transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </DialogFooter>
            </>
          )}
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
