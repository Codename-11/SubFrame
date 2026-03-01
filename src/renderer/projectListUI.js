/**
 * Project List UI Module
 * Renders project list in sidebar
 */

const { ipcRenderer } = require('electron');
const { IPC } = require('../shared/ipcChannels');

let projectsListElement = null;
let activeProjectPath = null;
let onProjectSelectCallback = null;
let projects = []; // Store projects list for navigation
let focusedIndex = -1; // Currently focused project index
let contextMenu = null; // Right-click context menu

/**
 * Initialize project list UI
 */
function init(containerId, onSelectCallback) {
  projectsListElement = document.getElementById(containerId);
  onProjectSelectCallback = onSelectCallback;
  setupIPC();
  _createContextMenu();
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
function renderProjects(projectsList) {
  if (!projectsListElement) return;

  projectsListElement.innerHTML = '';

  if (!projectsList || projectsList.length === 0) {
    projects = [];
    const noProjectsMsg = document.createElement('div');
    noProjectsMsg.className = 'no-projects-message';
    noProjectsMsg.textContent = 'No projects yet. Add a project to get started.';
    projectsListElement.appendChild(noProjectsMsg);
    return;
  }

  // Sort by lastOpenedAt (most recent first), then by name
  const sortedProjects = [...projectsList].sort((a, b) => {
    if (a.lastOpenedAt && b.lastOpenedAt) {
      return new Date(b.lastOpenedAt) - new Date(a.lastOpenedAt);
    }
    if (a.lastOpenedAt) return -1;
    if (b.lastOpenedAt) return 1;
    return a.name.localeCompare(b.name);
  });

  // Store sorted projects for navigation
  projects = sortedProjects;

  sortedProjects.forEach((project, index) => {
    const projectItem = createProjectItem(project, index);
    projectsListElement.appendChild(projectItem);
  });

  // Update focused index based on active project
  focusedIndex = projects.findIndex(p => p.path === activeProjectPath);
}

/**
 * Create a project item element
 */
function createProjectItem(project, index) {
  const item = document.createElement('div');
  item.className = 'project-item';
  item.dataset.path = project.path;
  item.dataset.index = index;
  item.tabIndex = 0; // Make focusable

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

  // Remove button (visible on hover)
  const removeBtn = document.createElement('button');
  removeBtn.className = 'project-remove-btn';
  removeBtn.title = 'Remove from list';
  removeBtn.innerHTML = '&times;';
  removeBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent project selection
    confirmRemoveProject(project.path, project.name);
  });
  item.appendChild(removeBtn);

  // Click handler
  item.addEventListener('click', () => {
    selectProject(project.path);
  });

  // Double-click to rename
  item.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    _startRename(item);
  });

  // Right-click context menu
  item.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    _showContextMenu(e.clientX, e.clientY, item);
  });

  return item;
}

/**
 * Start inline rename on a project item
 */
function _startRename(itemElement) {
  const nameSpan = itemElement.querySelector('.project-name');
  if (!nameSpan) return;

  const currentName = nameSpan.textContent;
  const projectPath = itemElement.dataset.path;

  // Create input
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'project-rename-input';
  input.value = currentName;

  nameSpan.replaceWith(input);
  input.focus();
  input.select();

  let finished = false;

  const finishRename = (save) => {
    if (finished) return;
    finished = true;

    const newName = save ? (input.value.trim() || currentName) : currentName;

    // Restore the span
    const span = document.createElement('span');
    span.className = 'project-name';
    span.textContent = newName;
    span.title = projectPath;
    if (input.parentNode) {
      input.replaceWith(span);
    }

    // Send rename IPC if name changed
    if (save && newName !== currentName) {
      ipcRenderer.send(IPC.RENAME_PROJECT, { projectPath, newName });
    }
  };

  input.addEventListener('blur', () => finishRename(true));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      input.blur();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      finishRename(false);
    }
  });
  // Prevent click from triggering project selection while renaming
  input.addEventListener('click', (e) => {
    e.stopPropagation();
  });
}

/**
 * Create the right-click context menu element
 */
function _createContextMenu() {
  // Inject styles once
  if (!document.getElementById('project-context-menu-styles')) {
    const style = document.createElement('style');
    style.id = 'project-context-menu-styles';
    style.textContent = `
      .project-context-menu {
        position: fixed;
        background: var(--bg-elevated);
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-md);
        padding: 4px 0;
        z-index: 10000;
        display: none;
        min-width: 140px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        animation: fadeIn 0.1s ease-out;
      }
      .project-context-menu.visible {
        display: block;
      }
      .project-context-menu-item {
        padding: 6px 12px;
        font-size: 12px;
        color: var(--text-primary);
        cursor: pointer;
        white-space: nowrap;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: background var(--transition-fast);
      }
      .project-context-menu-item:hover {
        background: var(--bg-hover);
      }
      .project-context-menu-item svg {
        opacity: 0.7;
      }
      .project-context-menu-divider {
        height: 1px;
        background: var(--border-subtle);
        margin: 4px 0;
      }
      .project-rename-input {
        background: var(--bg-primary);
        border: 1px solid var(--accent-primary);
        color: var(--text-primary);
        font-family: var(--font-sans);
        font-size: 13px;
        font-weight: 500;
        padding: 1px 4px;
        flex: 1;
        min-width: 0;
        outline: none;
        border-radius: var(--radius-sm);
      }
    `;
    document.head.appendChild(style);
  }

  contextMenu = document.createElement('div');
  contextMenu.className = 'project-context-menu';
  document.body.appendChild(contextMenu);

  // Hide menu on click elsewhere
  document.addEventListener('click', () => {
    _hideContextMenu();
  });
}

/**
 * Show context menu at position for a project item
 */
function _showContextMenu(x, y, itemElement) {
  if (!contextMenu) return;

  contextMenu.innerHTML = '';
  const projectPath = itemElement.dataset.path;
  const project = projects.find(p => p.path === projectPath);
  if (!project) return;

  // Rename option
  const renameItem = document.createElement('div');
  renameItem.className = 'project-context-menu-item';
  renameItem.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
    </svg>
    Rename
  `;
  renameItem.addEventListener('click', (e) => {
    e.stopPropagation();
    _startRename(itemElement);
    _hideContextMenu();
  });

  // Divider
  const divider = document.createElement('div');
  divider.className = 'project-context-menu-divider';

  // Remove option
  const removeItem = document.createElement('div');
  removeItem.className = 'project-context-menu-item';
  removeItem.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
    Remove
  `;
  removeItem.addEventListener('click', (e) => {
    e.stopPropagation();
    confirmRemoveProject(project.path, project.name);
    _hideContextMenu();
  });

  contextMenu.appendChild(renameItem);
  contextMenu.appendChild(divider);
  contextMenu.appendChild(removeItem);

  // Position and show
  contextMenu.style.left = `${x}px`;
  contextMenu.style.top = `${y}px`;
  contextMenu.classList.add('visible');

  // Adjust position if out of bounds
  const rect = contextMenu.getBoundingClientRect();
  if (rect.right > window.innerWidth) {
    contextMenu.style.left = `${window.innerWidth - rect.width - 5}px`;
  }
  if (rect.bottom > window.innerHeight) {
    contextMenu.style.top = `${window.innerHeight - rect.height - 5}px`;
  }
}

/**
 * Hide context menu
 */
function _hideContextMenu() {
  if (contextMenu) {
    contextMenu.classList.remove('visible');
  }
}

/**
 * Show confirmation dialog and remove project
 */
function confirmRemoveProject(projectPath, projectName) {
  const confirmed = window.confirm(
    `Remove "${projectName}" from the project list?\n\nThis will only remove it from Frame's list. The project files will not be deleted.`
  );

  if (confirmed) {
    // If removing the active project, select another one
    if (projectPath === activeProjectPath) {
      const otherProject = projects.find(p => p.path !== projectPath);
      if (otherProject) {
        selectProject(otherProject.path);
      } else {
        activeProjectPath = null;
        if (onProjectSelectCallback) {
          onProjectSelectCallback(null);
        }
      }
    }
    removeProject(projectPath);
  }
}

/**
 * Select a project
 * Terminal session switching is handled by state.js via multiTerminalUI
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

/**
 * Select next project in list
 */
function selectNextProject() {
  if (projects.length === 0) return;

  const currentIndex = projects.findIndex(p => p.path === activeProjectPath);
  const nextIndex = currentIndex < projects.length - 1 ? currentIndex + 1 : 0;
  selectProject(projects[nextIndex].path);
}

/**
 * Select previous project in list
 */
function selectPrevProject() {
  if (projects.length === 0) return;

  const currentIndex = projects.findIndex(p => p.path === activeProjectPath);
  const prevIndex = currentIndex > 0 ? currentIndex - 1 : projects.length - 1;
  selectProject(projects[prevIndex].path);
}

/**
 * Focus project list for keyboard navigation
 */
function focus() {
  if (!projectsListElement || projects.length === 0) return;

  // Focus current active project or first project
  const currentIndex = projects.findIndex(p => p.path === activeProjectPath);
  focusedIndex = currentIndex >= 0 ? currentIndex : 0;

  const items = projectsListElement.querySelectorAll('.project-item');
  if (items[focusedIndex]) {
    items[focusedIndex].focus();
    items[focusedIndex].classList.add('focused');
  }

  // Setup keyboard navigation (one-time)
  if (!projectsListElement.dataset.keyboardSetup) {
    projectsListElement.dataset.keyboardSetup = 'true';
    projectsListElement.addEventListener('keydown', handleKeydown);
  }
}

/**
 * Handle keyboard navigation in project list
 */
function handleKeydown(e) {
  const items = projectsListElement.querySelectorAll('.project-item');

  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    items[focusedIndex]?.classList.remove('focused');

    if (e.key === 'ArrowDown') {
      focusedIndex = focusedIndex < projects.length - 1 ? focusedIndex + 1 : 0;
    } else {
      focusedIndex = focusedIndex > 0 ? focusedIndex - 1 : projects.length - 1;
    }

    items[focusedIndex]?.focus();
    items[focusedIndex]?.classList.add('focused');
  }

  if (e.key === 'Enter' && focusedIndex >= 0) {
    e.preventDefault();
    selectProject(projects[focusedIndex].path);
  }

  // F2 to rename focused project
  if (e.key === 'F2' && focusedIndex >= 0) {
    e.preventDefault();
    _startRename(items[focusedIndex]);
  }

  if (e.key === 'Escape') {
    e.preventDefault();
    items[focusedIndex]?.classList.remove('focused');
    // Return focus to terminal
    if (typeof window.terminalFocus === 'function') {
      window.terminalFocus();
    }
  }
}

/**
 * Blur/unfocus project list
 */
function blur() {
  const items = projectsListElement?.querySelectorAll('.project-item');
  items?.forEach(item => item.classList.remove('focused'));
}

module.exports = {
  init,
  loadProjects,
  renderProjects,
  selectProject,
  setActiveProject,
  getActiveProject,
  addProject,
  removeProject,
  selectNextProject,
  selectPrevProject,
  focus,
  blur
};
