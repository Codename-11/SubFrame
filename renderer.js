const { ipcRenderer } = require('electron');
const { Terminal } = require('xterm');
const { FitAddon } = require('xterm-addon-fit');
const { IPC } = require('./src/shared/ipcChannels');

// Create terminal instance
const terminal = new Terminal({
  cursorBlink: true,
  fontSize: 14,
  fontFamily: 'Consolas, "Courier New", monospace',
  theme: {
    background: '#1e1e1e',
    foreground: '#d4d4d4',
    cursor: '#ffffff',
    black: '#000000',
    red: '#cd3131',
    green: '#0dbc79',
    yellow: '#e5e510',
    blue: '#2472c8',
    magenta: '#bc3fbc',
    cyan: '#11a8cd',
    white: '#e5e5e5',
    brightBlack: '#666666',
    brightRed: '#f14c4c',
    brightGreen: '#23d18b',
    brightYellow: '#f5f543',
    brightBlue: '#3b8eea',
    brightMagenta: '#d670d6',
    brightCyan: '#29b8db',
    brightWhite: '#e5e5e5'
  },
  allowTransparency: false,
  scrollback: 10000
});

// Fit addon to make terminal fill the container
const fitAddon = new FitAddon();
terminal.loadAddon(fitAddon);

// Open terminal in DOM
terminal.open(document.getElementById('terminal'));

// Fit terminal to window
fitAddon.fit();

// Welcome message
terminal.writeln('\x1b[1;32mClaude Code Terminal\x1b[0m');
terminal.writeln('Terminal başlatılıyor...\n');

// Handle terminal input
terminal.onData((data) => {
  ipcRenderer.send('terminal-input', data);
});

// Receive output from PTY
ipcRenderer.on('terminal-output', (event, data) => {
  terminal.write(data);
});

// Handle menu commands
ipcRenderer.on('run-command', (event, command) => {
  // Send command to terminal as if user typed it
  ipcRenderer.send('terminal-input', command + '\r');
});

// Handle window resize
window.addEventListener('resize', () => {
  fitAddon.fit();
  ipcRenderer.send('terminal-resize', {
    cols: terminal.cols,
    rows: terminal.rows
  });
});

// Project state
let currentProjectPath = null;

// Update project UI
function updateProjectUI(projectPath) {
  currentProjectPath = projectPath;
  const pathElement = document.getElementById('project-path');
  const startClaudeBtn = document.getElementById('btn-start-claude');
  const fileExplorerHeader = document.getElementById('file-explorer-header');

  if (projectPath) {
    pathElement.textContent = projectPath;
    pathElement.style.color = '#569cd6';
    startClaudeBtn.disabled = false;
    fileExplorerHeader.style.display = 'block';

    // Request file tree
    ipcRenderer.send('load-file-tree', projectPath);
  } else {
    pathElement.textContent = 'No project selected';
    pathElement.style.color = '#666';
    startClaudeBtn.disabled = true;
    fileExplorerHeader.style.display = 'none';
    document.getElementById('file-tree').innerHTML = '';
  }
}

// Render file tree
function renderFileTree(files, parentElement, indent = 0) {
  files.forEach(file => {
    // Create wrapper for folder + children
    const wrapper = document.createElement('div');
    wrapper.className = 'file-wrapper';

    const fileItem = document.createElement('div');
    fileItem.className = 'file-item' + (file.isDirectory ? ' folder' : '');
    fileItem.style.paddingLeft = `${8 + indent * 16}px`;

    // Add arrow for folders
    if (file.isDirectory) {
      const arrow = document.createElement('span');
      arrow.textContent = '▶ ';
      arrow.style.fontSize = '10px';
      arrow.style.marginRight = '4px';
      arrow.style.display = 'inline-block';
      arrow.style.transition = 'transform 0.2s';
      arrow.className = 'folder-arrow';
      fileItem.appendChild(arrow);
    }

    const icon = document.createElement('span');
    if (file.isDirectory) {
      icon.className = 'file-icon folder-icon';
    } else {
      const ext = file.name.split('.').pop();
      icon.className = `file-icon file-icon-${ext}`;
      if (!['js', 'json', 'md'].includes(ext)) {
        icon.className = 'file-icon file-icon-default';
      }
    }

    const name = document.createElement('span');
    name.textContent = file.name;

    fileItem.appendChild(icon);
    fileItem.appendChild(name);

    wrapper.appendChild(fileItem);

    // Create children container
    if (file.isDirectory && file.children && file.children.length > 0) {
      const childrenContainer = document.createElement('div');
      childrenContainer.className = 'folder-children';
      childrenContainer.style.display = 'none'; // Start collapsed

      // Recursively render children
      renderFileTree(file.children, childrenContainer, indent + 1);
      wrapper.appendChild(childrenContainer);

      // Toggle folder on click
      fileItem.addEventListener('click', (e) => {
        e.stopPropagation();
        const arrow = fileItem.querySelector('.folder-arrow');
        const isExpanded = childrenContainer.style.display !== 'none';

        if (isExpanded) {
          childrenContainer.style.display = 'none';
          arrow.style.transform = 'rotate(0deg)';
        } else {
          childrenContainer.style.display = 'block';
          arrow.style.transform = 'rotate(90deg)';
        }
      });
    } else if (!file.isDirectory) {
      // File click handler - open in editor
      fileItem.addEventListener('click', () => {
        openFileInEditor(file.path);
      });
    }

    parentElement.appendChild(wrapper);
  });
}

// Button handlers
document.getElementById('btn-select-project').addEventListener('click', () => {
  ipcRenderer.send('select-project-folder');
});

document.getElementById('btn-create-project').addEventListener('click', () => {
  ipcRenderer.send('create-new-project');
});

document.getElementById('btn-refresh-tree').addEventListener('click', () => {
  if (currentProjectPath) {
    ipcRenderer.send('load-file-tree', currentProjectPath);
  }
});

document.getElementById('btn-start-claude').addEventListener('click', () => {
  if (currentProjectPath) {
    // Restart terminal with new path
    ipcRenderer.send('restart-terminal', currentProjectPath);
    // Auto-start Claude Code
    setTimeout(() => {
      ipcRenderer.send('terminal-input', 'claude\r');
    }, 1000);
  }
});

// Receive selected project path
ipcRenderer.on('project-selected', (event, projectPath) => {
  updateProjectUI(projectPath);
  terminal.writeln(`\x1b[1;32m✓ Project selected:\x1b[0m ${projectPath}`);
});

// Receive file tree data
ipcRenderer.on('file-tree-data', (event, files) => {
  const fileTreeElement = document.getElementById('file-tree');
  fileTreeElement.innerHTML = '';
  renderFileTree(files, fileTreeElement);
});

// History Panel Management
let historyPanelVisible = false;

function toggleHistoryPanel() {
  const panel = document.getElementById('history-panel');
  historyPanelVisible = !historyPanelVisible;

  if (historyPanelVisible) {
    panel.classList.add('visible');
    loadPromptHistory();
  } else {
    panel.classList.remove('visible');
  }

  // Resize terminal to fit new layout
  setTimeout(() => {
    fitAddon.fit();
    ipcRenderer.send('terminal-resize', {
      cols: terminal.cols,
      rows: terminal.rows
    });
  }, 50);
}

function loadPromptHistory() {
  ipcRenderer.send('load-prompt-history');
}

function renderPromptHistory(historyData) {
  const container = document.getElementById('history-content');
  container.innerHTML = '';

  if (!historyData || historyData.trim() === '') {
    container.innerHTML = '<div style="color: #858585; padding: 10px; text-align: center;">No history yet</div>';
    return;
  }

  const lines = historyData.trim().split('\n');

  // Reverse to show newest first
  lines.reverse().forEach(line => {
    const match = line.match(/\[(.*?)\]\s+(.*)/);
    if (match) {
      const timestamp = match[1];
      const command = match[2];

      const item = document.createElement('div');
      item.className = 'history-item';

      const ts = document.createElement('div');
      ts.className = 'history-timestamp';
      ts.textContent = new Date(timestamp).toLocaleString();

      const cmd = document.createElement('div');
      cmd.className = 'history-command';
      cmd.textContent = command;

      item.appendChild(ts);
      item.appendChild(cmd);
      container.appendChild(item);
    }
  });
}

// Close button handler
document.getElementById('history-close').addEventListener('click', () => {
  toggleHistoryPanel();
});

// Receive prompt history data
ipcRenderer.on('prompt-history-data', (event, data) => {
  renderPromptHistory(data);
});

// Toggle from menu
ipcRenderer.on('toggle-history-panel', () => {
  toggleHistoryPanel();
});

// Keyboard shortcut: Ctrl+Shift+H
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.key === 'H') {
    e.preventDefault();
    toggleHistoryPanel();
  }
});

// ==================== FRAME FEATURES ====================

// Frame state
let isCurrentProjectFrame = false;
let projectsList = [];

// Load projects from workspace on startup
function loadProjects() {
  ipcRenderer.send(IPC.LOAD_WORKSPACE);
}

// Render projects list
function renderProjects(projects) {
  const container = document.getElementById('projects-list');
  if (!container) return;

  container.innerHTML = '';
  projectsList = projects || [];

  if (projectsList.length === 0) {
    container.innerHTML = '<div class="no-projects-message">No projects yet. Add a project to get started.</div>';
    return;
  }

  // Sort by lastOpenedAt (most recent first)
  const sorted = [...projectsList].sort((a, b) => {
    if (a.lastOpenedAt && b.lastOpenedAt) {
      return new Date(b.lastOpenedAt) - new Date(a.lastOpenedAt);
    }
    if (a.lastOpenedAt) return -1;
    if (b.lastOpenedAt) return 1;
    return a.name.localeCompare(b.name);
  });

  sorted.forEach(project => {
    const item = document.createElement('div');
    item.className = 'project-item' + (project.path === currentProjectPath ? ' active' : '');
    item.dataset.path = project.path;

    const icon = document.createElement('span');
    icon.className = 'project-icon';
    icon.textContent = project.isFrameProject ? '📦' : '📁';
    item.appendChild(icon);

    const name = document.createElement('span');
    name.className = 'project-name';
    name.textContent = project.name;
    name.title = project.path;
    item.appendChild(name);

    if (project.isFrameProject) {
      const badge = document.createElement('span');
      badge.className = 'frame-badge';
      badge.textContent = 'Frame';
      item.appendChild(badge);
    }

    item.addEventListener('click', () => {
      selectProjectFromList(project.path);
    });

    container.appendChild(item);
  });
}

// Select project from list
function selectProjectFromList(projectPath) {
  // Update UI
  updateProjectUI(projectPath);

  // Check if Frame project
  ipcRenderer.send(IPC.CHECK_IS_FRAME_PROJECT, projectPath);

  // Update active state in list
  const items = document.querySelectorAll('.project-item');
  items.forEach(item => {
    item.classList.toggle('active', item.dataset.path === projectPath);
  });

  terminal.writeln(`\x1b[1;32m✓ Project selected:\x1b[0m ${projectPath}`);
}

// Add project to workspace
function addProjectToWorkspace(projectPath, projectName, isFrame = false) {
  ipcRenderer.send(IPC.ADD_PROJECT_TO_WORKSPACE, {
    projectPath,
    name: projectName || projectPath.split('/').pop() || projectPath.split('\\').pop(),
    isFrameProject: isFrame
  });
}

// Update Frame UI (Initialize button visibility)
function updateFrameUI() {
  const initBtn = document.getElementById('btn-initialize-frame');
  if (initBtn) {
    if (currentProjectPath && !isCurrentProjectFrame) {
      initBtn.style.display = 'block';
    } else {
      initBtn.style.display = 'none';
    }
  }
}

// Initialize as Frame project
function initializeAsFrameProject() {
  if (currentProjectPath) {
    const projectName = currentProjectPath.split('/').pop() || currentProjectPath.split('\\').pop();
    ipcRenderer.send(IPC.INITIALIZE_FRAME_PROJECT, {
      projectPath: currentProjectPath,
      projectName: projectName
    });
  }
}

// IPC listeners for Frame
ipcRenderer.on(IPC.WORKSPACE_DATA, (event, projects) => {
  renderProjects(projects);
});

ipcRenderer.on(IPC.WORKSPACE_UPDATED, (event, projects) => {
  renderProjects(projects);
});

ipcRenderer.on(IPC.IS_FRAME_PROJECT_RESULT, (event, { projectPath, isFrame }) => {
  if (projectPath === currentProjectPath) {
    isCurrentProjectFrame = isFrame;
    updateFrameUI();
  }
});

ipcRenderer.on(IPC.FRAME_PROJECT_INITIALIZED, (event, { projectPath, success }) => {
  if (success && projectPath === currentProjectPath) {
    isCurrentProjectFrame = true;
    updateFrameUI();
    terminal.writeln(`\x1b[1;32m✓ Frame project initialized!\x1b[0m`);
    terminal.writeln(`  Created: .frame/, STRUCTURE.json, PROJECT_NOTES.md, todos.json, QUICKSTART.md`);
    // Refresh file tree
    ipcRenderer.send('load-file-tree', currentProjectPath);
  }
});

// Add project button handler
const addProjectBtn = document.getElementById('btn-add-project');
if (addProjectBtn) {
  addProjectBtn.addEventListener('click', () => {
    ipcRenderer.send('select-project-folder');
  });
}

// Initialize Frame button handler
const initFrameBtn = document.getElementById('btn-initialize-frame');
if (initFrameBtn) {
  initFrameBtn.addEventListener('click', () => {
    initializeAsFrameProject();
  });
}

// Override project selection to also add to workspace
const originalUpdateProjectUI = updateProjectUI;
updateProjectUI = function(projectPath) {
  originalUpdateProjectUI(projectPath);

  if (projectPath) {
    // Add to workspace
    const projectName = projectPath.split('/').pop() || projectPath.split('\\').pop();
    addProjectToWorkspace(projectPath, projectName, false);

    // Check if Frame project
    ipcRenderer.send(IPC.CHECK_IS_FRAME_PROJECT, projectPath);
  } else {
    isCurrentProjectFrame = false;
    updateFrameUI();
  }
};

// ==================== END FRAME FEATURES ====================

// ==================== FILE EDITOR ====================

// Editor state
let currentEditingFile = null;
let originalContent = '';
let isModified = false;

// Open file in editor
function openFileInEditor(filePath) {
  ipcRenderer.send(IPC.READ_FILE, filePath);
}

// Close editor
function closeEditor() {
  if (isModified) {
    if (!confirm('You have unsaved changes. Close anyway?')) {
      return;
    }
  }

  const overlay = document.getElementById('editor-overlay');
  overlay.classList.remove('visible');
  currentEditingFile = null;
  originalContent = '';
  isModified = false;
}

// Save file
function saveFile() {
  if (!currentEditingFile) return;

  const content = document.getElementById('editor-textarea').value;
  ipcRenderer.send(IPC.WRITE_FILE, {
    filePath: currentEditingFile,
    content: content
  });
}

// Update editor status
function updateEditorStatus(status, className = '') {
  const statusEl = document.getElementById('editor-status');
  statusEl.textContent = status;
  statusEl.className = className;
}

// Check if content modified
function checkModified() {
  const content = document.getElementById('editor-textarea').value;
  isModified = content !== originalContent;

  if (isModified) {
    updateEditorStatus('Modified', 'modified');
  } else {
    updateEditorStatus('Ready', '');
  }
}

// Receive file content
ipcRenderer.on(IPC.FILE_CONTENT, (event, result) => {
  if (result.success) {
    currentEditingFile = result.filePath;
    originalContent = result.content;
    isModified = false;

    // Update UI
    document.getElementById('editor-filename').textContent = result.fileName;
    document.getElementById('editor-ext').textContent = result.extension.toUpperCase() || 'FILE';
    document.getElementById('editor-textarea').value = result.content;
    document.getElementById('editor-path').textContent = result.filePath;
    updateEditorStatus('Ready', '');

    // Show overlay
    document.getElementById('editor-overlay').classList.add('visible');

    // Focus textarea
    document.getElementById('editor-textarea').focus();
  } else {
    terminal.writeln(`\x1b[1;31mError opening file:\x1b[0m ${result.error}`);
  }
});

// Receive save confirmation
ipcRenderer.on(IPC.FILE_SAVED, (event, result) => {
  if (result.success) {
    originalContent = document.getElementById('editor-textarea').value;
    isModified = false;
    updateEditorStatus('Saved!', 'saved');

    // Reset status after 2 seconds
    setTimeout(() => {
      if (!isModified) {
        updateEditorStatus('Ready', '');
      }
    }, 2000);

    // Refresh file tree
    if (currentProjectPath) {
      ipcRenderer.send('load-file-tree', currentProjectPath);
    }
  } else {
    updateEditorStatus('Save failed: ' + result.error, 'modified');
  }
});

// Editor button handlers
document.getElementById('btn-editor-close').addEventListener('click', closeEditor);
document.getElementById('btn-editor-save').addEventListener('click', saveFile);

// Track modifications
document.getElementById('editor-textarea').addEventListener('input', checkModified);

// Keyboard shortcuts in editor
document.getElementById('editor-textarea').addEventListener('keydown', (e) => {
  // Ctrl+S or Cmd+S to save
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    saveFile();
  }

  // Escape to close
  if (e.key === 'Escape') {
    closeEditor();
  }

  // Tab for indentation
  if (e.key === 'Tab') {
    e.preventDefault();
    const textarea = e.target;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    textarea.value = textarea.value.substring(0, start) + '  ' + textarea.value.substring(end);
    textarea.selectionStart = textarea.selectionEnd = start + 2;
    checkModified();
  }
});

// Close on overlay click (outside editor)
document.getElementById('editor-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'editor-overlay') {
    closeEditor();
  }
});

// ==================== END FILE EDITOR ====================

// Start terminal when ready
window.addEventListener('load', () => {
  // Load projects from workspace
  loadProjects();

  // Give a moment for terminal to fully render
  setTimeout(() => {
    ipcRenderer.send('start-terminal');
    // Notify about resize
    ipcRenderer.send('terminal-resize', {
      cols: terminal.cols,
      rows: terminal.rows
    });
  }, 100);
});
