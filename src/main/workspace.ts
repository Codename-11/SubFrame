/**
 * Workspace Module
 * Manages workspace configuration in ~/.subframe/workspaces.json
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { App, BrowserWindow, IpcMain } from 'electron';
import { IPC } from '../shared/ipcChannels';
import { WORKSPACE_DIR, WORKSPACE_FILE, FRAME_VERSION, FRAME_DIR, FRAME_CONFIG_FILE } from '../shared/frameConstants';

interface WorkspaceProject {
  path: string;
  name: string;
  isFrameProject: boolean;
  addedAt: string | null;
  lastOpenedAt: string | null;
  source?: 'manual' | 'scanned';
  /** Per-project AI tool binding (tool ID) */
  aiTool?: string;
}

interface WorkspaceEntry {
  name: string;
  createdAt: string;
  projects: WorkspaceProject[];
  shortLabel?: string;
  icon?: string;
  inactive?: boolean; // Defaults to false (active) for backward compat
}

interface WorkspaceData {
  version: string;
  activeWorkspace: string;
  workspaces: Record<string, WorkspaceEntry>;
  workspaceOrder?: string[]; // Display order of workspace keys
}

interface WorkspaceListItem {
  key: string;
  name: string;
  projectCount: number;
  projectPaths: string[];
  shortLabel?: string;
  icon?: string;
  inactive?: boolean;
}

interface WorkspaceListResult {
  active: string;
  workspaces: WorkspaceListItem[];
}

interface ProjectsWithScannedResult {
  projects: WorkspaceProject[];
  workspaceName: string;
}

interface SettingsManagerLike {
  getSetting(keyPath: string): unknown;
}

let workspaceDir: string | null = null;
let workspacePath: string | null = null;
let settingsManager: SettingsManagerLike | null = null;

/**
 * Initialize workspace module
 */
function init(app: App, _window: BrowserWindow, settings: SettingsManagerLike | null): void {
  settingsManager = settings || null;
  workspaceDir = path.join(os.homedir(), WORKSPACE_DIR);
  workspacePath = path.join(workspaceDir, WORKSPACE_FILE);
  ensureWorkspaceDir();
}

/**
 * Ensure workspace directory and file exist
 */
function ensureWorkspaceDir(): void {
  if (!workspaceDir || !workspacePath) return;
  if (!fs.existsSync(workspaceDir)) {
    fs.mkdirSync(workspaceDir, { recursive: true });
  }
  if (!fs.existsSync(workspacePath)) {
    const defaultWorkspace = createDefaultWorkspace();
    saveWorkspace(defaultWorkspace);
  }
}

/**
 * Create default workspace structure
 */
function createDefaultWorkspace(): WorkspaceData {
  return {
    version: FRAME_VERSION,
    activeWorkspace: 'default',
    workspaces: {
      default: {
        name: 'Default Workspace',
        createdAt: new Date().toISOString(),
        projects: [],
      }
    }
  };
}

/**
 * Load workspace from file
 */
function loadWorkspace(): WorkspaceData {
  try {
    if (!workspacePath) return createDefaultWorkspace();
    const data = fs.readFileSync(workspacePath, 'utf8');
    const workspace: WorkspaceData = JSON.parse(data);

    // Guard: if activeWorkspace points to a deleted/missing workspace, fall back to default
    if (!workspace.workspaces[workspace.activeWorkspace]) {
      workspace.activeWorkspace = 'default';
      // Ensure default workspace exists
      if (!workspace.workspaces.default) {
        workspace.workspaces.default = {
          name: 'Default Workspace',
          createdAt: new Date().toISOString(),
          projects: [],
        };
      }
      saveWorkspace(workspace);
    }

    return workspace;
  } catch (err) {
    console.error('Error loading workspace:', err);
    return createDefaultWorkspace();
  }
}

/**
 * Save workspace to file
 */
function saveWorkspace(data: WorkspaceData): void {
  try {
    if (workspacePath) {
      fs.writeFileSync(workspacePath, JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error('Error saving workspace:', err);
  }
}

/**
 * Get projects from active workspace
 */
function getProjects(): WorkspaceProject[] {
  const workspace = loadWorkspace();
  const active = workspace.activeWorkspace;
  return workspace.workspaces[active]?.projects || [];
}

/**
 * Add project to workspace
 */
function addProject(projectPath: string, name?: string, isFrameProject: boolean = false): boolean {
  const workspace = loadWorkspace();
  const active = workspace.activeWorkspace;

  // Check if already exists
  const exists = workspace.workspaces[active].projects.some(
    p => p.path === projectPath
  );
  if (exists) return false;

  workspace.workspaces[active].projects.push({
    path: projectPath,
    name: name || path.basename(projectPath),
    isFrameProject: isFrameProject,
    addedAt: new Date().toISOString(),
    lastOpenedAt: null
  });

  saveWorkspace(workspace);
  return true;
}

/**
 * Remove project from workspace
 */
function removeProject(projectPath: string): void {
  const workspace = loadWorkspace();
  const active = workspace.activeWorkspace;

  workspace.workspaces[active].projects =
    workspace.workspaces[active].projects.filter(p => p.path !== projectPath);

  saveWorkspace(workspace);
}

/**
 * Update project's last opened timestamp
 */
function updateProjectLastOpened(projectPath: string): void {
  const workspace = loadWorkspace();
  const active = workspace.activeWorkspace;

  const project = workspace.workspaces[active].projects.find(
    p => p.path === projectPath
  );
  if (project) {
    project.lastOpenedAt = new Date().toISOString();
    saveWorkspace(workspace);
  }
}

/**
 * Rename a project in the workspace
 */
function renameProject(projectPath: string, newName: string): boolean {
  if (!newName || !newName.trim()) return false;

  const workspace = loadWorkspace();
  const active = workspace.activeWorkspace;

  const project = workspace.workspaces[active].projects.find(
    p => p.path === projectPath
  );
  if (project) {
    project.name = newName.trim();
    saveWorkspace(workspace);
    return true;
  }
  return false;
}

/**
 * Scan a directory for projects
 */
function scanProjectDir(dirPath: string): WorkspaceProject[] {
  if (!dirPath || !fs.existsSync(dirPath)) return [];

  const results: WorkspaceProject[] = [];
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      // Skip hidden dirs and non-directories
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;

      const fullPath = path.join(dirPath, entry.name);
      const configPath = path.join(fullPath, FRAME_DIR, FRAME_CONFIG_FILE);
      const isFrame = fs.existsSync(configPath);

      results.push({
        path: fullPath,
        name: entry.name,
        isFrameProject: isFrame,
        source: 'scanned',
        addedAt: null,
        lastOpenedAt: null
      });
    }
  } catch (err) {
    console.error('Error scanning project directory:', err);
  }
  return results;
}

/**
 * Re-check isFrameProject by looking for .subframe/config.json on disk.
 */
function recheckFrameStatus(project: WorkspaceProject): WorkspaceProject {
  try {
    const configPath = path.join(project.path, FRAME_DIR, FRAME_CONFIG_FILE);
    project.isFrameProject = fs.existsSync(configPath);
  } catch {
    // Leave as-is on error
  }
  return project;
}

/**
 * Get projects merged with scanned results from default project dir
 */
function getProjectsWithScanned(): ProjectsWithScannedResult {
  const workspace = loadWorkspace();
  const active = workspace.activeWorkspace;
  const workspaceName = workspace.workspaces[active]?.name || 'Default Workspace';

  const manualProjects = getProjects().map(p => recheckFrameStatus({ ...p, source: 'manual' as const }));

  const defaultDir = settingsManager ? settingsManager.getSetting('general.defaultProjectDir') as string : '';
  if (!defaultDir) return { projects: manualProjects, workspaceName };

  const scannedProjects = scanProjectDir(defaultDir);

  // Deduplicate: manual wins over scanned (normalize paths for comparison)
  const manualPaths = new Set(manualProjects.map(p => path.resolve(p.path)));
  const merged: WorkspaceProject[] = [...manualProjects];

  for (const scanned of scannedProjects) {
    if (!manualPaths.has(path.resolve(scanned.path))) {
      merged.push(scanned);
    }
  }

  return { projects: merged, workspaceName };
}

/**
 * Update project's SubFrame status
 */
function updateProjectFrameStatus(projectPath: string, isFrame: boolean): void {
  const workspace = loadWorkspace();
  const active = workspace.activeWorkspace;

  const project = workspace.workspaces[active].projects.find(
    p => p.path === projectPath
  );
  if (project) {
    project.isFrameProject = isFrame;
    saveWorkspace(workspace);
  }
}

/**
 * Set or clear per-project AI tool binding
 */
function setProjectAITool(projectPath: string, aiTool: string | null): boolean {
  const workspace = loadWorkspace();
  const active = workspace.activeWorkspace;

  const project = workspace.workspaces[active]?.projects.find(
    p => p.path === projectPath
  );
  if (!project) return false;

  if (aiTool) {
    project.aiTool = aiTool;
  } else {
    delete project.aiTool;
  }
  saveWorkspace(workspace);
  return true;
}

/**
 * Get per-project AI tool binding (if any)
 */
function getProjectAITool(projectPath: string): string | null {
  const workspace = loadWorkspace();
  const active = workspace.activeWorkspace;

  const project = workspace.workspaces[active]?.projects.find(
    p => p.path === projectPath
  );
  return project?.aiTool || null;
}

/** Get workspace keys in display order, falling back to insertion order for migration. */
function getOrderedKeys(data: WorkspaceData): string[] {
  const allKeys = Object.keys(data.workspaces);
  if (data.workspaceOrder && data.workspaceOrder.length > 0) {
    // Use saved order, appending any new keys not in the order array
    const ordered = data.workspaceOrder.filter(k => allKeys.includes(k));
    const remaining = allKeys.filter(k => !ordered.includes(k));
    return [...ordered, ...remaining];
  }
  return allKeys;
}

/**
 * Convert workspace name to slug key
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Get workspace list for the renderer selector
 */
function getWorkspaceList(): WorkspaceListResult {
  const workspace = loadWorkspace();
  const orderedKeys = getOrderedKeys(workspace);
  return {
    active: workspace.activeWorkspace,
    workspaces: orderedKeys
      .filter(key => workspace.workspaces[key])
      .map(key => ({
        key,
        name: workspace.workspaces[key].name,
        projectCount: workspace.workspaces[key].projects ? workspace.workspaces[key].projects.length : 0,
        projectPaths: workspace.workspaces[key].projects ? workspace.workspaces[key].projects.map((project) => project.path) : [],
        shortLabel: workspace.workspaces[key].shortLabel,
        icon: workspace.workspaces[key].icon,
        inactive: workspace.workspaces[key].inactive ?? false,
      })),
  };
}

/**
 * Switch to a different workspace
 */
function switchWorkspace(key: string): ProjectsWithScannedResult | null {
  const workspace = loadWorkspace();
  if (!workspace.workspaces[key]) return null;

  workspace.activeWorkspace = key;
  // Auto-reactivate if switching to an inactive workspace
  if (workspace.workspaces[key].inactive) {
    workspace.workspaces[key].inactive = false;
  }
  saveWorkspace(workspace);
  return getProjectsWithScanned();
}

/**
 * Create a new workspace
 */
function createWorkspace(name: string): WorkspaceListResult | null {
  if (!name || !name.trim()) return null;

  const workspace = loadWorkspace();
  const baseSlug = slugify(name);
  if (!baseSlug) return null;

  // Handle slug collisions by appending counter
  let slug = baseSlug;
  let counter = 2;
  while (workspace.workspaces[slug]) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  workspace.workspaces[slug] = {
    name: name.trim(),
    createdAt: new Date().toISOString(),
    projects: [],
  };
  workspace.activeWorkspace = slug;

  // Append to display order
  if (!workspace.workspaceOrder) workspace.workspaceOrder = Object.keys(workspace.workspaces);
  if (!workspace.workspaceOrder.includes(slug)) workspace.workspaceOrder.push(slug);

  saveWorkspace(workspace);

  return getWorkspaceList();
}

/**
 * Rename a workspace (cannot change the slug key)
 */
function renameWorkspace(key: string, updates: { newName?: string; shortLabel?: string | null; icon?: string | null }): boolean {
  const workspace = loadWorkspace();
  if (!workspace.workspaces[key]) return false;

  if (typeof updates.newName === 'string') {
    if (!updates.newName.trim()) return false;
    workspace.workspaces[key].name = updates.newName.trim();
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'shortLabel')) {
    const shortLabel = updates.shortLabel?.trim().toUpperCase().replace(/\s+/g, '').slice(0, 4) ?? '';
    if (shortLabel) {
      workspace.workspaces[key].shortLabel = shortLabel;
    } else {
      delete workspace.workspaces[key].shortLabel;
    }
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'icon')) {
    const icon = updates.icon?.trim() ?? '';
    if (icon) {
      workspace.workspaces[key].icon = icon;
    } else {
      delete workspace.workspaces[key].icon;
    }
  }

  saveWorkspace(workspace);
  return true;
}

/**
 * Delete a workspace
 */
function deleteWorkspace(key: string): { success: boolean; error?: string } {
  const workspace = loadWorkspace();
  if (!workspace.workspaces[key]) return { success: false, error: 'Workspace not found' };

  delete workspace.workspaces[key];

  // Remove from display order
  if (workspace.workspaceOrder) {
    workspace.workspaceOrder = workspace.workspaceOrder.filter(k => k !== key);
  }

  // If deleting the active workspace, switch to another or create a fresh default
  if (workspace.activeWorkspace === key) {
    const remaining = Object.keys(workspace.workspaces);
    if (remaining.length > 0) {
      workspace.activeWorkspace = remaining[0];
    } else {
      // All workspaces deleted — create a fresh default
      workspace.activeWorkspace = 'default';
      workspace.workspaces.default = {
        name: 'Default Workspace',
        createdAt: new Date().toISOString(),
        projects: [],
      };
    }
  }

  saveWorkspace(workspace);
  return { success: true };
}

/**
 * Reorder workspaces by providing the new order of keys.
 * Keys not in the provided array are appended at the end.
 */
function reorderWorkspaces(orderedKeys: string[]): boolean {
  try {
    const workspace = loadWorkspace();
    const allKeys = Object.keys(workspace.workspaces);
    // Validate: all provided keys must exist
    const validKeys = orderedKeys.filter(k => allKeys.includes(k));
    // Append any keys not in the provided order
    const remaining = allKeys.filter(k => !validKeys.includes(k));
    workspace.workspaceOrder = [...validKeys, ...remaining];
    saveWorkspace(workspace);
    return true;
  } catch (err) {
    console.error('[Workspace] Failed to reorder:', err);
    return false;
  }
}

/**
 * Set a workspace as inactive or active.
 * The currently active workspace cannot be set to inactive.
 */
function setWorkspaceInactive(key: string, inactive: boolean): boolean {
  try {
    const workspace = loadWorkspace();
    if (!workspace.workspaces[key]) return false;

    // Guard: cannot deactivate the currently active workspace
    if (inactive && workspace.activeWorkspace === key) return false;

    workspace.workspaces[key].inactive = inactive;
    saveWorkspace(workspace);
    return true;
  } catch (err) {
    console.error('[Workspace] Failed to set inactive:', err);
    return false;
  }
}

/**
 * Setup IPC handlers
 */
function setupIPC(ipcMain: IpcMain): void {
  ipcMain.on(IPC.LOAD_WORKSPACE, (event) => {
    const result = getProjectsWithScanned();
    event.sender.send(IPC.WORKSPACE_DATA, result);
  });

  ipcMain.on(IPC.ADD_PROJECT_TO_WORKSPACE, (event, { projectPath, name, isFrameProject }: { projectPath: string; name: string; isFrameProject?: boolean }) => {
    addProject(projectPath, name, isFrameProject);
    const result = getProjectsWithScanned();
    event.sender.send(IPC.WORKSPACE_UPDATED, result);
  });

  ipcMain.on(IPC.REMOVE_PROJECT_FROM_WORKSPACE, (event, projectPath: string) => {
    removeProject(projectPath);
    const result = getProjectsWithScanned();
    event.sender.send(IPC.WORKSPACE_UPDATED, result);
  });

  ipcMain.on(IPC.RENAME_PROJECT, (event, { projectPath, newName }: { projectPath: string; newName: string }) => {
    renameProject(projectPath, newName);
    const result = getProjectsWithScanned();
    event.sender.send(IPC.WORKSPACE_UPDATED, result);
  });

  ipcMain.on(IPC.SET_PROJECT_AI_TOOL, (event, { projectPath, aiTool }: { projectPath: string; aiTool: string | null }) => {
    setProjectAITool(projectPath, aiTool);
    const result = getProjectsWithScanned();
    event.sender.send(IPC.WORKSPACE_UPDATED, result);
  });

  ipcMain.handle(IPC.SCAN_PROJECT_DIR, (_event, dirPath: string) => {
    return scanProjectDir(dirPath);
  });

  // Workspace management handlers
  ipcMain.handle(IPC.WORKSPACE_LIST, () => getWorkspaceList());
  ipcMain.handle(IPC.WORKSPACE_SWITCH, (_e, key: string) => switchWorkspace(key));
  ipcMain.handle(IPC.WORKSPACE_CREATE, (_e, name: string) => createWorkspace(name));
  ipcMain.handle(
    IPC.WORKSPACE_RENAME,
    (_e, payload: { key: string; newName?: string; shortLabel?: string | null; icon?: string | null }) => (
      renameWorkspace(payload.key, {
        newName: payload.newName,
        shortLabel: payload.shortLabel,
        icon: payload.icon,
      })
    )
  );
  ipcMain.handle(IPC.WORKSPACE_DELETE, (_e, key: string) => deleteWorkspace(key));
  ipcMain.handle(IPC.WORKSPACE_REORDER, (_event, orderedKeys: string[]) => {
    return reorderWorkspaces(orderedKeys);
  });
  ipcMain.handle(IPC.WORKSPACE_SET_INACTIVE, (_event, payload: { key: string; inactive: boolean }) => {
    return setWorkspaceInactive(payload.key, payload.inactive);
  });
}

export {
  init, loadWorkspace, getProjects, getProjectsWithScanned, scanProjectDir,
  addProject, removeProject, renameProject, updateProjectLastOpened,
  updateProjectFrameStatus, getWorkspaceList, switchWorkspace,
  createWorkspace, renameWorkspace, deleteWorkspace, reorderWorkspaces,
  setWorkspaceInactive, setProjectAITool, getProjectAITool, setupIPC
};
