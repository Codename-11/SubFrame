/**
 * Renderer Entry Point
 * Initializes all UI modules and sets up event handlers
 */

const terminal = require('./terminal');
const fileTreeUI = require('./fileTreeUI');
const historyPanel = require('./historyPanel');
const tasksPanel = require('./tasksPanel');
const pluginsPanel = require('./pluginsPanel');
const githubPanel = require('./githubPanel');
const state = require('./state');
const projectListUI = require('./projectListUI');
const editor = require('./editor');
const sidebarResize = require('./sidebarResize');
const aiToolSelector = require('./aiToolSelector');
const settingsPanel = require('./settingsPanel');
const aiFilesPanel = require('./aiFilesPanel');
const { getLogoSVG } = require('../shared/logoSVG');

/**
 * Initialize critical-path modules (visible UI, layout, interaction)
 */
function initCritical() {
  // Inject sidebar logo from centralized SVG module
  const sidebarLogo = document.getElementById('sidebar-logo');
  if (sidebarLogo) {
    sidebarLogo.innerHTML = getLogoSVG({ size: 54, id: 'sb', frame: false });
  }

  // Inject logo into floating overlay (shown when sidebar is fully hidden)
  const floatLogo = document.getElementById('sidebar-float-logo');
  if (floatLogo) {
    floatLogo.innerHTML = getLogoSVG({ size: 32, id: 'fl', frame: false });
  }

  // Initialize terminal structure (no actual PTY yet)
  const multiTerminalUI = terminal.initTerminal('terminal');

  // Initialize state management
  state.init({
    pathElement: document.getElementById('project-path'),
    startClaudeBtn: document.getElementById('btn-start-ai'),
    fileExplorerHeader: document.getElementById('file-explorer-header'),
    initializeFrameBtn: document.getElementById('btn-initialize-frame')
  });

  // Initialize AI tool selector
  aiToolSelector.init((tool) => {
    console.log('AI tool changed to:', tool.name);
  });

  // Connect state with multiTerminalUI for project-terminal session management
  state.setMultiTerminalUI(multiTerminalUI);

  // Initialize project list UI
  projectListUI.init('projects-list', (projectPath) => {
    state.setProjectPath(projectPath);
  });

  // Load projects from workspace
  projectListUI.loadProjects();

  // Initialize sidebar resize
  sidebarResize.init(() => {
    terminal.fitTerminal();
  });

  // Setup button handlers and keyboard shortcuts
  setupButtonHandlers();
  setupKeyboardShortcuts();

  // Setup window resize handler (debounced to avoid flooding during maximize animation)
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => terminal.fitTerminal(), 80);
  });
}

/**
 * Initialize deferred modules (hidden panels, secondary features)
 * Runs after the first paint so it doesn't block the UI.
 */
function initDeferred() {
  // Initialize file tree UI
  fileTreeUI.init('file-tree', state.getProjectPath);
  fileTreeUI.setProjectPathGetter(state.getProjectPath);

  // Initialize editor with file tree refresh callback
  editor.init(() => {
    fileTreeUI.refreshFileTree();
  });

  // Connect file tree clicks to editor
  fileTreeUI.setOnFileClick((filePath, source) => {
    editor.openFile(filePath, source);
  });

  // Initialize history panel with terminal resize callback
  historyPanel.init('history-panel', 'history-content', () => {
    setTimeout(() => terminal.fitTerminal(), 50);
  });

  // Initialize hidden panels
  tasksPanel.init();
  pluginsPanel.init();
  githubPanel.init();
  settingsPanel.init();
  aiFilesPanel.init();

  // Setup state change listeners
  state.onProjectChange((projectPath, previousPath) => {
    if (projectPath) {
      fileTreeUI.loadFileTree(projectPath);

      // Add to workspace and update project list
      const projectName = projectPath.split('/').pop() || projectPath.split('\\').pop();
      projectListUI.addProject(projectPath, projectName, state.getIsFrameProject());
      projectListUI.setActiveProject(projectPath);

      // Always load tasks on project change so data is ready when panel opens
      tasksPanel.loadTasks();
    } else {
      fileTreeUI.clearFileTree();
    }
  });

  // Setup SubFrame status change listener
  state.onFrameStatusChange((isFrame) => {
    // Refresh project list when SubFrame status changes
    projectListUI.loadProjects();
  });

  // Setup SubFrame initialized listener
  state.onFrameInitialized((projectPath) => {
    terminal.writelnToTerminal(`\x1b[1;32m✓ SubFrame project initialized!\x1b[0m`);
    terminal.writelnToTerminal(`  Created: .subframe/, AGENTS.md, CLAUDE.md (backlink), STRUCTURE.json, PROJECT_NOTES.md, tasks.json, QUICKSTART.md`);
    // Refresh file tree to show new files
    fileTreeUI.refreshFileTree();
    // Load tasks for the new project
    tasksPanel.loadTasks();
  });
}

/**
 * Setup button click handlers
 */
function setupButtonHandlers() {
  // Select project folder
  document.getElementById('btn-select-project').addEventListener('click', () => {
    state.selectProjectFolder();
  });

  // Create new project
  document.getElementById('btn-create-project').addEventListener('click', () => {
    state.createNewProject();
  });

  // Start AI Tool (Claude Code / Codex CLI / etc.)
  document.getElementById('btn-start-ai').addEventListener('click', async () => {
    const projectPath = state.getProjectPath();
    if (projectPath) {
      const newTerminalId = await terminal.restartTerminal(projectPath);

      if (newTerminalId) {
        // Ensure the new terminal is focused
        terminal.setActiveTerminal(newTerminalId);

        // Send start command for the selected AI tool
        const startCommand = aiToolSelector.getStartCommand();
        setTimeout(() => {
          terminal.sendCommand(startCommand, newTerminalId);
        }, 1000);
      }
    }
  });

  // Refresh file tree
  document.getElementById('btn-refresh-tree').addEventListener('click', () => {
    fileTreeUI.refreshFileTree();
  });

  // Close history panel
  document.getElementById('history-close').addEventListener('click', () => {
    historyPanel.toggleHistoryPanel();
  });

  // Add project to workspace
  document.getElementById('btn-add-project').addEventListener('click', () => {
    state.selectProjectFolder();
  });

  // Initialize as SubFrame project
  document.getElementById('btn-initialize-frame').addEventListener('click', () => {
    state.initializeAsFrameProject();
  });

  // Settings button
  document.getElementById('btn-settings').addEventListener('click', () => {
    settingsPanel.toggle();
  });

  // Sidebar tabs — clicking a tab icon while collapsed expands the sidebar first
  document.querySelectorAll('.sidebar-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tabBtn = e.currentTarget;
      const tab = tabBtn.dataset.sidebarTab;

      // If sidebar is collapsed (icon strip), expand it
      if (sidebarResize.isCollapsed()) {
        sidebarResize.expand();
        terminal.fitTerminal();
      }

      document.querySelectorAll('.sidebar-tab-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.sidebarTab === tab);
      });
      document.querySelectorAll('[data-sidebar-tab-content]').forEach(el => {
        el.style.display = el.dataset.sidebarTabContent === tab ? '' : 'none';
      });
    });
  });
}

/**
 * Setup keyboard shortcuts
 */
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    const modKey = e.ctrlKey || e.metaKey; // Support both Ctrl (Windows/Linux) and Cmd (macOS)
    const key = e.key.toLowerCase(); // Normalize key to lowercase

    // Ctrl/Cmd+Shift+H - Toggle history panel
    if (modKey && e.shiftKey && key === 'h') {
      e.preventDefault();
      historyPanel.toggleHistoryPanel();
    }
    // Ctrl/Cmd+Shift+P - Toggle plugins panel
    if (modKey && e.shiftKey && key === 'p') {
      e.preventDefault();
      pluginsPanel.toggle();
    }
    // Ctrl/Cmd+Shift+G - Toggle GitHub panel
    if (modKey && e.shiftKey && key === 'g') {
      e.preventDefault();
      githubPanel.toggle();
    }
    // Ctrl/Cmd+B - Toggle sidebar
    if (modKey && !e.shiftKey && key === 'b') {
      e.preventDefault();
      sidebarResize.toggle();
      terminal.fitTerminal();
    }
    // Ctrl/Cmd+Shift+[ - Previous project
    if (modKey && e.shiftKey && e.key === '[') {
      e.preventDefault();
      projectListUI.selectPrevProject();
    }
    // Ctrl/Cmd+Shift+] - Next project
    if (modKey && e.shiftKey && e.key === ']') {
      e.preventDefault();
      projectListUI.selectNextProject();
    }
    // Ctrl/Cmd+E - Focus project list
    if (modKey && !e.shiftKey && key === 'e') {
      e.preventDefault();
      fileTreeUI.blur();
      projectListUI.focus();
    }
    // Ctrl/Cmd+Shift+E - Focus file tree
    if (modKey && e.shiftKey && key === 'e') {
      e.preventDefault();
      projectListUI.blur();
      fileTreeUI.focus();
    }
    // Ctrl/Cmd+T - Toggle tasks panel
    if (modKey && !e.shiftKey && key === 't') {
      e.preventDefault();
      tasksPanel.toggle()
    }
    // Ctrl/Cmd+, - Toggle settings panel
    if (modKey && !e.shiftKey && key === ',') {
      e.preventDefault();
      settingsPanel.toggle();
    }
  });
}

/**
 * Start application when DOM is ready.
 * Uses DOMContentLoaded (not 'load') so we don't wait for external CDN
 * resources (Google Fonts, D3.js) before initializing.
 */
document.addEventListener('DOMContentLoaded', () => {
  // Phase 1: Critical-path — visible layout, sidebar, project list
  initCritical();

  // Phase 2: Deferred — hidden panels, file tree, editor
  // Runs after the browser has had a chance to paint the initial layout.
  requestAnimationFrame(() => {
    initDeferred();

    // Give a moment for terminal to fully render, then start PTY
    setTimeout(() => {
      terminal.startTerminal();
    }, 100);

    // Dismiss loading screen — fade out then remove from DOM
    const loadingEl = document.getElementById('app-loading');
    if (loadingEl) {
      loadingEl.classList.add('fade-out');
      loadingEl.addEventListener('transitionend', () => loadingEl.remove(), { once: true });
    }
  });
});
