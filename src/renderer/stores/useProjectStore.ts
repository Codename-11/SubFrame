import { create } from 'zustand';

export interface ProjectInfo {
  path: string;
  name: string;
  isFrameProject: boolean;
}

interface ProjectState {
  currentProjectPath: string | null;
  isFrameProject: boolean;
  workspaceName: string;
  /** Sorted project list for keyboard navigation */
  projects: ProjectInfo[];
  setProject: (path: string | null, isFrame?: boolean) => void;
  setIsFrameProject: (isFrame: boolean) => void;
  setWorkspaceName: (name: string) => void;
  setProjects: (projects: ProjectInfo[]) => void;
  /** Select prev/next project in the sorted list */
  selectAdjacentProject: (direction: -1 | 1) => void;
}

const STORAGE_KEY = 'subframe-last-project';

/** Restore last selected project from localStorage */
function loadLastProject(): { path: string | null; isFrame: boolean } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      return { path: data.path || null, isFrame: data.isFrame || false };
    }
  } catch { /* ignore */ }
  return { path: null, isFrame: false };
}

/** Persist selected project to localStorage */
function saveLastProject(path: string | null, isFrame: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ path, isFrame }));
  } catch { /* ignore */ }
}

const initial = loadLastProject();

export const useProjectStore = create<ProjectState>((set, get) => ({
  currentProjectPath: initial.path,
  isFrameProject: initial.isFrame,
  workspaceName: 'default',
  projects: [],
  setProject: (path, isFrame = false) => {
    saveLastProject(path, isFrame);
    set({ currentProjectPath: path, isFrameProject: isFrame });
  },
  setIsFrameProject: (isFrame) => {
    const { currentProjectPath } = get();
    saveLastProject(currentProjectPath, isFrame);
    set({ isFrameProject: isFrame });
  },
  setWorkspaceName: (name) => set({ workspaceName: name }),
  setProjects: (projects) => set({ projects }),
  selectAdjacentProject: (direction) => {
    const { projects, currentProjectPath } = get();
    if (projects.length === 0) return;
    const idx = projects.findIndex((p) => p.path === currentProjectPath);
    let next = idx + direction;
    if (next < 0) next = projects.length - 1;
    if (next >= projects.length) next = 0;
    const p = projects[next];
    saveLastProject(p.path, p.isFrameProject);
    set({ currentProjectPath: p.path, isFrameProject: p.isFrameProject });
  },
}));
