/**
 * Project List UI Module
 * Renders project list in sidebar
 */

const { ipcRenderer } = require('electron');
const { IPC } = require('../shared/ipcChannels');

let projectsListElement = null;
let activeProjectPath = null;
let onProjectSelectCallback = null;

/**
 * Initialize project list UI
 */
function init(containerId, onSelectCallback) {
  projectsListElement = document.getElementById(containerId);
  onProjectSelectCallback = onSelectCallback;
  setupIPC();
}

/**
 * Load projects from workspace
 */
function loadProjects() {
  ipcRenderer.send(IPC.LOAD_WORKSPACE);
}

/**
 * Render project list
 */
function renderProjects(projects) {
  if (!projectsListElement) return;

  projectsListElement.innerHTML = '';

  if (!projects || projects.length === 0) {
    const noProjectsMsg = document.createElement('div');
    noProjectsMsg.className = 'no-projects-message';
    noProjectsMsg.textContent = 'No projects yet. Add a project to get started.';
    projectsListElement.appendChild(noProjectsMsg);
    return;
  }

  // Sort by lastOpenedAt (most recent first), then by name
  const sortedProjects = [...projects].sort((a, b) => {
    if (a.lastOpenedAt && b.lastOpenedAt) {
      return new Date(b.lastOpenedAt) - new Date(a.lastOpenedAt);
    }
    if (a.lastOpenedAt) return -1;
    if (b.lastOpenedAt) return 1;
    return a.name.localeCompare(b.name);
  });

  sortedProjects.forEach(project => {
    const projectItem = createProjectItem(project);
    projectsListElement.appendChild(projectItem);
  });
}

/**
 * Create a project item element
 */
function createProjectItem(project) {
  const item = document.createElement('div');
  item.className = 'project-item';
  item.dataset.path = project.path;

  if (project.path === activeProjectPath) {
    item.classList.add('active');
  }

  // Project icon
  const icon = document.createElement('span');
  icon.className = 'project-icon';
  icon.textContent = project.isFrameProject ? '📦' : '📁';
  item.appendChild(icon);

  // Project name
  const name = document.createElement('span');
  name.className = 'project-name';
  name.textContent = project.name;
  name.title = project.path;
  item.appendChild(name);

  // Frame badge
  if (project.isFrameProject) {
    const badge = document.createElement('span');
    badge.className = 'frame-badge';
    badge.textContent = 'Frame';
    item.appendChild(badge);
  }

  // Click handler
  item.addEventListener('click', () => {
    selectProject(project.path);
  });

  return item;
}

/**
 * Select a project
 */
function selectProject(projectPath) {
  setActiveProject(projectPath);

  if (onProjectSelectCallback) {
    onProjectSelectCallback(projectPath);
  }
}

/**
 * Set active project (visual only)
 */
function setActiveProject(projectPath) {
  activeProjectPath = projectPath;

  // Update visual state
  if (projectsListElement) {
    const items = projectsListElement.querySelectorAll('.project-item');
    items.forEach(item => {
      if (item.dataset.path === projectPath) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }
}

/**
 * Get active project path
 */
function getActiveProject() {
  return activeProjectPath;
}

/**
 * Add project to workspace
 */
function addProject(projectPath, projectName, isFrameProject = false) {
  ipcRenderer.send(IPC.ADD_PROJECT_TO_WORKSPACE, {
    projectPath,
    name: projectName,
    isFrameProject
  });
}

/**
 * Remove project from workspace
 */
function removeProject(projectPath) {
  ipcRenderer.send(IPC.REMOVE_PROJECT_FROM_WORKSPACE, projectPath);
}

/**
 * Setup IPC listeners
 */
function setupIPC() {
  ipcRenderer.on(IPC.WORKSPACE_DATA, (event, projects) => {
    renderProjects(projects);
  });

  ipcRenderer.on(IPC.WORKSPACE_UPDATED, (event, projects) => {
    renderProjects(projects);
  });
}

module.exports = {
  init,
  loadProjects,
  renderProjects,
  selectProject,
  setActiveProject,
  getActiveProject,
  addProject,
  removeProject
};
