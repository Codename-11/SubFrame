import { useEffect, useCallback, useState, useRef } from 'react';
import {
  FolderOpen,
  X,
  Plus,
  Copy,
} from 'lucide-react';
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
import { useProjectStore } from '../stores/useProjectStore';
import { toast } from 'sonner';
import { typedSend } from '../lib/ipc';
import { useIPCEvent } from '../hooks/useIPCListener';
import { IPC } from '../../shared/ipcChannels';
import type { WorkspaceProject, WorkspaceData } from '../../shared/ipcChannels';
import { getTransport } from '../lib/transportProvider';

/** Extended project type that includes the optional source field from the main process */
type ProjectWithSource = WorkspaceProject & { source?: 'manual' | 'scanned' };

/**
 * Renders the list of projects for the current workspace.
 * Each project card shows name, path, active indicator, and SubFrame badge.
 * Supports keyboard navigation (Arrow Up/Down, Enter, F2, Escape) and inline rename.
 */
export function ProjectList() {
  const currentProjectPath = useProjectStore((s) => s.currentProjectPath);
  const setProject = useProjectStore((s) => s.setProject);
  const setProjectsInStore = useProjectStore((s) => s.setProjects);
  const setWorkspaceName = useProjectStore((s) => s.setWorkspaceName);

  const [projects, setProjects] = useState<ProjectWithSource[]>([]);

  // Dialog state for remove confirmation
  const [removeTarget, setRemoveTarget] = useState<{ path: string; name: string } | null>(null);


  // Keyboard navigation state
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Inline rename state
  const [inlineRenamePath, setInlineRenamePath] = useState<string | null>(null);
  const [inlineRenameValue, setInlineRenameValue] = useState('');
  const inlineRenameRef = useRef<HTMLInputElement>(null);
  const lastWorkspaceKeyRef = useRef<string | null>(null);

  // Focus the inline rename input when it appears
  useEffect(() => {
    if (inlineRenamePath && inlineRenameRef.current) {
      inlineRenameRef.current.focus();
      inlineRenameRef.current.select();
    }
  }, [inlineRenamePath]);

  // Sync project list to store — only show manual (workspace) projects in the list.
  // Scanned/discovered projects appear in the "+" dropdown instead.
  const updateProjects = useCallback((data: WorkspaceData | WorkspaceProject[]) => {
    const workspaceData = data && !Array.isArray(data) && 'projects' in data ? data : null;
    const list = workspaceData?.projects ?? (data as WorkspaceProject[]);
    const workspaceKey = workspaceData?.workspaceKey ?? null;
    const defaultProjectPath = workspaceData?.defaultProjectPath ?? null;
    const manual = (list || []).filter((p: any) => p.source !== 'scanned');
    const sorted = sortProjects(manual);
    setProjects(sorted as ProjectWithSource[]);
    setProjectsInStore(sorted.map((p) => ({ path: p.path, name: p.name, isFrameProject: p.isFrameProject ?? false, aiTool: p.aiTool })));

    const workspaceChanged = workspaceKey !== null && workspaceKey !== lastWorkspaceKeyRef.current;
    if (workspaceKey !== null) {
      lastWorkspaceKeyRef.current = workspaceKey;
    }

    const defaultProject = defaultProjectPath
      ? sorted.find((project) => project.path === defaultProjectPath)
      : undefined;

    const current = useProjectStore.getState().currentProjectPath;
    const inList = sorted.some((p) => p.path === current);
    if (workspaceChanged && defaultProject) {
      setProject(defaultProject.path, defaultProject.isFrameProject ?? false);
    } else if (!inList) {
      if (sorted.length > 0) {
        setProject(sorted[0].path, sorted[0].isFrameProject ?? false);
      } else {
        setProject(null, false);
      }
    }
  }, [setProjectsInStore, setProject]);

  // Listen for workspace data from main process
  // The main process sends { projects: [...], workspaceName: "..." }
  useIPCEvent<WorkspaceData | WorkspaceProject[]>(IPC.WORKSPACE_DATA, (data) => {
    updateProjects(data);
    // Extract workspace name if present
    if (data && 'workspaceName' in data && typeof (data as any).workspaceName === 'string') {
      setWorkspaceName((data as any).workspaceName);
    }
  });

  useIPCEvent<WorkspaceData | WorkspaceProject[]>(IPC.WORKSPACE_UPDATED, (data) => {
    updateProjects(data);
    if (data && 'workspaceName' in data && typeof data.workspaceName === 'string') {
      setWorkspaceName(data.workspaceName);
    }
  });

  // Load projects on mount
  useEffect(() => {
    typedSend(IPC.LOAD_WORKSPACE);
  }, []);

  const handleSelect = useCallback(
    (projectPath: string) => {
      const project = projects.find((p) => p.path === projectPath);
      setProject(projectPath, project?.isFrameProject ?? false);
      // Notify main process
      getTransport().send(IPC.CHECK_IS_FRAME_PROJECT, projectPath);
    },
    [projects, setProject]
  );

  // Auto-select project added via folder picker dialog
  useIPCEvent<string>(IPC.PROJECT_SELECTED, handleSelect);

  const handleRemove = useCallback(
    (projectPath: string, projectName: string) => {
      setRemoveTarget({ path: projectPath, name: projectName });
    },
    []
  );

  const confirmRemove = useCallback(() => {
    if (!removeTarget) return;
    typedSend(IPC.REMOVE_PROJECT_FROM_WORKSPACE, removeTarget.path);
    if (removeTarget.path === currentProjectPath) {
      const other = projects.find((p) => p.path !== removeTarget.path);
      if (other) {
        handleSelect(other.path);
      } else {
        setProject(null);
      }
    }
    setRemoveTarget(null);
  }, [removeTarget, currentProjectPath, projects, handleSelect, setProject]);

  // Inline rename handlers
  const startInlineRename = useCallback((projectPath: string, currentName: string) => {
    setInlineRenamePath(projectPath);
    setInlineRenameValue(currentName);
  }, []);

  const finishInlineRename = useCallback(() => {
    if (!inlineRenamePath) return;
    const trimmed = inlineRenameValue.trim();
    const project = projects.find((p) => p.path === inlineRenamePath);
    if (trimmed && project && trimmed !== project.name) {
      getTransport().send(IPC.RENAME_PROJECT, { projectPath: inlineRenamePath, newName: trimmed });
      toast.success('Project renamed');
    }
    setInlineRenamePath(null);
    setInlineRenameValue('');
  }, [inlineRenamePath, inlineRenameValue, projects]);

  const cancelInlineRename = useCallback(() => {
    setInlineRenamePath(null);
    setInlineRenameValue('');
  }, []);

  const handleAddToWorkspace = useCallback((project: ProjectWithSource) => {
    typedSend(IPC.ADD_PROJECT_TO_WORKSPACE, {
      projectPath: project.path,
      name: project.name,
      isFrameProject: project.isFrameProject,
    });
    toast.success('Project added to workspace');
  }, []);

  // Keyboard navigation handler
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (projects.length === 0) return;

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          setFocusedIndex((prev) => {
            const next = prev + 1;
            return next >= projects.length ? 0 : next;
          });
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          setFocusedIndex((prev) => {
            const next = prev - 1;
            return next < 0 ? projects.length - 1 : next;
          });
          break;
        }
        case 'Enter': {
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < projects.length) {
            handleSelect(projects[focusedIndex].path);
          }
          break;
        }
        case 'F2': {
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < projects.length) {
            const p = projects[focusedIndex];
            startInlineRename(p.path, p.name);
          }
          break;
        }
        case 'Escape': {
          e.preventDefault();
          setFocusedIndex(-1);
          containerRef.current?.blur();
          break;
        }
      }
    },
    [projects, focusedIndex, handleSelect, startInlineRename]
  );

  if (projects.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-text-tertiary text-xs">
        No projects yet. Click + to add a project.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="py-1 outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onBlur={() => setFocusedIndex(-1)}
    >
      {projects.map((project, index) => (
        <ProjectCard
          key={project.path}
          project={project}
          isActive={project.path === currentProjectPath}
          isFocused={index === focusedIndex}
          onSelect={handleSelect}
          onRemove={handleRemove}
          onRename={startInlineRename}
          onAddToWorkspace={handleAddToWorkspace}
          isInlineRenaming={inlineRenamePath === project.path}
          inlineRenameValue={inlineRenameValue}
          onInlineRenameChange={setInlineRenameValue}
          onInlineRenameFinish={finishInlineRename}
          onInlineRenameCancel={cancelInlineRename}
          inlineRenameRef={inlineRenamePath === project.path ? inlineRenameRef : undefined}
        />
      ))}

      {/* Remove confirmation dialog */}
      <AlertDialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent className="bg-bg-primary border-border-subtle text-text-primary">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Project</AlertDialogTitle>
            <AlertDialogDescription className="text-text-secondary text-xs">
              Remove &ldquo;{removeTarget?.name}&rdquo; from the project list? This will only remove it from SubFrame&apos;s list. The project files will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-error text-white hover:bg-error/80 cursor-pointer"
              onClick={confirmRemove}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** A single project card in the list */
function ProjectCard({
  project,
  isActive,
  isFocused,
  onSelect,
  onRemove,
  onRename,
  onAddToWorkspace,
  isInlineRenaming,
  inlineRenameValue,
  onInlineRenameChange,
  onInlineRenameFinish,
  onInlineRenameCancel,
  inlineRenameRef,
}: {
  project: ProjectWithSource;
  isActive: boolean;
  isFocused: boolean;
  onSelect: (path: string) => void;
  onRemove: (path: string, name: string) => void;
  onRename: (path: string, name: string) => void;
  onAddToWorkspace: (project: ProjectWithSource) => void;
  isInlineRenaming: boolean;
  inlineRenameValue: string;
  onInlineRenameChange: (value: string) => void;
  onInlineRenameFinish: () => void;
  onInlineRenameCancel: () => void;
  inlineRenameRef?: React.RefObject<HTMLInputElement | null>;
}) {
  const isScanned = project.source === 'scanned';

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          onClick={() => onSelect(project.path)}
          onDoubleClick={() => onRename(project.path, project.name)}
          className={`group w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors cursor-pointer
            ${
              isActive
                ? 'bg-accent-subtle text-text-primary'
                : isFocused
                  ? 'bg-bg-hover text-text-primary ring-1 ring-accent/40'
                  : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
            }
          `}
          title={project.path}
        >
          {/* Status dot — green pulsing for SubFrame projects */}
          <span
            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
              project.isFrameProject ? 'bg-success' : 'bg-text-muted'
            }`}
            style={project.isFrameProject ? { animation: 'pulse-green 2s ease-in-out infinite' } : undefined}
            title={project.isFrameProject ? 'SubFrame project' : 'Not initialized'}
          />

          {/* Project name — inline rename or display */}
          {isInlineRenaming ? (
            <input
              ref={inlineRenameRef}
              value={inlineRenameValue}
              onChange={(e) => onInlineRenameChange(e.target.value)}
              onBlur={onInlineRenameFinish}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onInlineRenameFinish();
                if (e.key === 'Escape') onInlineRenameCancel();
                e.stopPropagation();
              }}
              onClick={(e) => e.stopPropagation()}
              className="bg-transparent border-none text-xs font-medium w-full text-text-primary focus:ring-1 focus:ring-accent focus:outline-none rounded-sm flex-1 min-w-0"
            />
          ) : (
            <span className="text-xs font-medium truncate flex-1">{project.name}</span>
          )}

          {/* Scanned "Auto" badge */}
          {isScanned && (
            <span className="text-[9px] font-bold text-info/70 bg-info/10 px-1 rounded flex-shrink-0">
              Auto
            </span>
          )}

          {/* SF badge — green to match SubFrame project status */}
          {project.isFrameProject && (
            <span className="text-[9px] font-bold text-success/80 bg-success/15 px-1 rounded flex-shrink-0">
              SF
            </span>
          )}

          {/* Remove button (hover only) — hide for scanned projects */}
          {!isScanned && (
            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(project.path, project.name);
              }}
              className="hidden group-hover:flex items-center text-text-tertiary hover:text-error transition-colors flex-shrink-0"
              title="Remove from list"
            >
              <X className="w-3 h-3" />
            </span>
          )}
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => onSelect(project.path)}>
          <FolderOpen className="w-3.5 h-3.5 mr-2" />
          Open
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onRename(project.path, project.name)}>
          Rename
        </ContextMenuItem>
        <ContextMenuItem onClick={() => { navigator.clipboard.writeText(project.path); toast.success('Path copied'); }}>
          <Copy className="w-3.5 h-3.5 mr-2" />
          Copy Path
        </ContextMenuItem>
        {isScanned && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => onAddToWorkspace(project)}>
              <Plus className="w-3.5 h-3.5 mr-2" />
              Add to Workspace
            </ContextMenuItem>
          </>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={() => onRemove(project.path, project.name)}
          className="text-error"
        >
          Remove
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

/** Sort projects by lastOpenedAt (most recent first), then by name */
function sortProjects(list: WorkspaceProject[]): WorkspaceProject[] {
  return [...list].sort((a, b) => {
    const aTime = (a as any).lastOpenedAt;
    const bTime = (b as any).lastOpenedAt;
    if (aTime && bTime) return new Date(bTime).getTime() - new Date(aTime).getTime();
    if (aTime) return -1;
    if (bTime) return 1;
    return a.name.localeCompare(b.name);
  });
}
