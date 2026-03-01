/**
 * Plugins Panel Module
 * UI for displaying and managing Claude Code plugins and sessions
 */

const { ipcRenderer } = require('electron');
const { IPC } = require('../shared/ipcChannels');
const state = require('./state');
const aiToolSelector = require('./aiToolSelector');

// Lazy-loaded to avoid circular dependency
let aiFilesPanel = null;
function getAiFilesPanel() {
  if (!aiFilesPanel) aiFilesPanel = require('./aiFilesPanel');
  return aiFilesPanel;
}

let isVisible = false;
let isCollapsed = false;
let pluginsData = [];
let currentFilter = 'all'; // all, installed, enabled
let currentTab = 'sessions';

// Sessions state
let sessionsData = [];
let sessionsLoaded = false;

// DOM Elements
let panelElement = null;
let contentElement = null;
let sessionsContentElement = null;

/**
 * Initialize plugins panel
 */
function init() {
  panelElement = document.getElementById('plugins-panel');
  contentElement = document.getElementById('plugins-content');
  sessionsContentElement = document.getElementById('sessions-content');

  if (!panelElement) {
    console.error('Plugins panel element not found');
    return;
  }

  setupEventListeners();
  setupIPCListeners();
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Close button
  const closeBtn = document.getElementById('plugins-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', hide);
  }

  // Collapse button — collapses to icon strip instead of hiding
  const collapseBtn = document.getElementById('plugins-collapse-btn');
  if (collapseBtn) {
    collapseBtn.addEventListener('click', toggleCollapse);
  }

  // Refresh button
  const refreshBtn = document.getElementById('plugins-refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', refreshPlugins);
  }

  // Filter buttons
  document.querySelectorAll('.plugins-filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const filter = e.target.dataset.filter;
      setFilter(filter);
    });
  });

  // Sessions refresh button
  const sessionsRefreshBtn = document.getElementById('sessions-refresh-btn');
  if (sessionsRefreshBtn) {
    sessionsRefreshBtn.addEventListener('click', refreshSessions);
  }

  // Tab buttons (use closest() since tabs contain SVG icons)
  document.querySelectorAll('.claude-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tabBtn = e.target.closest('.claude-tab-btn');
      if (tabBtn) setTab(tabBtn.dataset.tab);
    });
  });

  // Collapsed icon strip buttons — expand to specific tab
  document.querySelectorAll('.claude-collapsed-icon[data-expand-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.expandTab;
      setTab(tab);
      expand();
    });
  });

  // Collapsed strip close button — fully hide
  const collapsedCloseBtn = document.querySelector('.claude-collapsed-close');
  if (collapsedCloseBtn) {
    collapsedCloseBtn.addEventListener('click', hide);
  }
}

/**
 * Setup IPC listeners
 */
function setupIPCListeners() {
  ipcRenderer.on(IPC.PLUGIN_TOGGLED, (event, result) => {
    if (result.success) {
      // Update local data
      const plugin = pluginsData.find(p => p.id === result.pluginId);
      if (plugin) {
        plugin.enabled = result.enabled;
        render();
      }
      showToast(
        result.enabled ? 'Plugin enabled - restart Claude Code to apply' : 'Plugin disabled - restart Claude Code to apply',
        'info'
      );
    }
  });

  ipcRenderer.on(IPC.TOGGLE_PLUGINS_PANEL, () => {
    toggle();
  });
}

/**
 * Load plugins
 */
async function loadPlugins() {
  try {
    pluginsData = await ipcRenderer.invoke(IPC.LOAD_PLUGINS);
    render();
  } catch (err) {
    console.error('Error loading plugins:', err);
    pluginsData = [];
    render();
  }
}

/**
 * Refresh plugins from marketplace
 */
async function refreshPlugins() {
  const refreshBtn = document.getElementById('plugins-refresh-btn');

  try {
    // Add spinning animation
    if (refreshBtn) {
      refreshBtn.classList.add('spinning');
      refreshBtn.disabled = true;
    }

    const result = await ipcRenderer.invoke(IPC.REFRESH_PLUGINS);

    if (result.error) {
      showToast('Failed to refresh: ' + result.error, 'error');
    } else {
      pluginsData = result;
      render();
      showToast('Plugins refreshed', 'success');
    }
  } catch (err) {
    console.error('Error refreshing plugins:', err);
    showToast('Failed to refresh plugins', 'error');
  } finally {
    // Remove spinning animation
    if (refreshBtn) {
      refreshBtn.classList.remove('spinning');
      refreshBtn.disabled = false;
    }
  }
}

/**
 * Show plugins panel (expanded)
 */
function show() {
  if (!panelElement) return;

  const strip = panelElement.querySelector('.claude-collapsed-strip');
  const content = panelElement.querySelector('.claude-expanded-content');

  panelElement.classList.add('visible');
  panelElement.style.width = '';
  panelElement.style.minWidth = '';

  if (strip) strip.style.display = 'none';
  if (content) content.style.display = '';

  isVisible = true;
  isCollapsed = false;
  sessionsLoaded = false;

  if (currentTab === 'plugins') {
    loadPlugins();
  } else if (currentTab === 'sessions') {
    loadSessions();
  } else if (currentTab === 'ai-files') {
    getAiFilesPanel().loadStatus();
  }
}

/**
 * Hide plugins panel completely
 */
function hide() {
  if (!panelElement) return;

  const strip = panelElement.querySelector('.claude-collapsed-strip');
  const content = panelElement.querySelector('.claude-expanded-content');

  panelElement.classList.remove('visible');
  panelElement.style.width = '';
  panelElement.style.minWidth = '';

  if (strip) strip.style.display = 'none';
  if (content) content.style.display = '';

  isVisible = false;
  isCollapsed = false;
}

/**
 * Toggle plugins panel visibility
 */
function toggle() {
  if (isVisible && !isCollapsed) {
    hide();
  } else {
    show();
  }
}

/**
 * Collapse to icon strip
 */
function collapse() {
  if (!panelElement) return;

  const strip = panelElement.querySelector('.claude-collapsed-strip');
  const content = panelElement.querySelector('.claude-expanded-content');

  // Keep panel visible but narrow
  panelElement.classList.add('visible');
  panelElement.style.width = '44px';
  panelElement.style.minWidth = '44px';

  if (strip) strip.style.display = 'flex';
  if (content) content.style.display = 'none';

  isVisible = true;
  isCollapsed = true;
}

/**
 * Expand from collapsed icon strip
 */
function expand() {
  if (!panelElement) return;

  const strip = panelElement.querySelector('.claude-collapsed-strip');
  const content = panelElement.querySelector('.claude-expanded-content');

  panelElement.classList.add('visible');
  panelElement.style.width = '';
  panelElement.style.minWidth = '';

  if (strip) strip.style.display = 'none';
  if (content) content.style.display = '';

  isCollapsed = false;
  sessionsLoaded = false;

  if (currentTab === 'plugins') {
    loadPlugins();
  } else if (currentTab === 'sessions') {
    loadSessions();
  } else if (currentTab === 'ai-files') {
    getAiFilesPanel().loadStatus();
  }
}

/**
 * Toggle between collapsed and expanded
 */
function toggleCollapse() {
  if (isCollapsed) {
    expand();
  } else {
    collapse();
  }
}

/**
 * Set active tab
 */
function setTab(tab) {
  currentTab = tab;

  // Update active tab button
  document.querySelectorAll('.claude-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });

  // Show/hide tab content
  document.querySelectorAll('[data-tab-content]').forEach(el => {
    el.style.display = el.dataset.tabContent === tab ? '' : 'none';
  });

  // Load data for the active tab
  if (tab === 'sessions' && !sessionsLoaded) {
    loadSessions();
  } else if (tab === 'ai-files') {
    getAiFilesPanel().loadStatus();
  }
}

/**
 * Set filter
 */
function setFilter(filter) {
  currentFilter = filter;

  // Update active button
  document.querySelectorAll('.plugins-filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });

  render();
}

/**
 * Get filtered plugins
 */
function getFilteredPlugins() {
  if (!pluginsData || pluginsData.length === 0) return [];

  switch (currentFilter) {
    case 'installed':
      return pluginsData.filter(p => p.installed);
    case 'enabled':
      return pluginsData.filter(p => p.enabled);
    default:
      return pluginsData;
  }
}

/**
 * Render plugins list
 */
function render() {
  if (!contentElement) return;

  const plugins = getFilteredPlugins();

  if (plugins.length === 0) {
    contentElement.innerHTML = `
      <div class="plugins-empty">
        <div class="plugins-empty-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
          </svg>
        </div>
        <p>No plugins found</p>
        <span>${currentFilter === 'all' ? 'Claude Code plugins will appear here' : `No ${currentFilter} plugins`}</span>
      </div>
    `;
    return;
  }

  contentElement.innerHTML = plugins.map(plugin => renderPluginItem(plugin)).join('');

  // Add event listeners to toggle buttons
  contentElement.querySelectorAll('.plugin-toggle-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const pluginId = btn.dataset.pluginId;
      await togglePlugin(pluginId);
    });
  });

  // Add event listeners to install buttons
  contentElement.querySelectorAll('.plugin-install-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const pluginName = btn.dataset.pluginName;
      installPlugin(pluginName);
    });
  });
}

/**
 * Render single plugin item
 */
function renderPluginItem(plugin) {
  const statusClass = plugin.enabled ? 'enabled' : plugin.installed ? 'installed' : 'available';
  const statusLabel = plugin.enabled ? 'Enabled' : plugin.installed ? 'Installed' : 'Available';

  // Icon based on plugin type/name
  const icon = getPluginIcon(plugin.name);

  return `
    <div class="plugin-item ${statusClass}" data-plugin-id="${plugin.id}">
      <div class="plugin-icon">
        ${icon}
      </div>
      <div class="plugin-content">
        <div class="plugin-header">
          <span class="plugin-name">${escapeHtml(plugin.name)}</span>
          <span class="plugin-status status-${statusClass}">${statusLabel}</span>
        </div>
        <div class="plugin-description">${escapeHtml(plugin.description)}</div>
        <div class="plugin-meta">
          <span class="plugin-author">by ${escapeHtml(plugin.author)}</span>
        </div>
      </div>
      <div class="plugin-actions">
        ${plugin.installed ? `
          <button class="plugin-toggle-btn ${plugin.enabled ? 'enabled' : ''}"
                  data-plugin-id="${plugin.id}"
                  title="${plugin.enabled ? 'Disable' : 'Enable'}">
            <div class="toggle-track">
              <div class="toggle-thumb"></div>
            </div>
          </button>
        ` : `
          <button class="plugin-install-btn"
                  data-plugin-name="${plugin.name}"
                  title="Install plugin">
            Install
          </button>
        `}
      </div>
    </div>
  `;
}

/**
 * Get icon for plugin based on name
 */
function getPluginIcon(name) {
  // Return different icons based on plugin category
  if (name.includes('lsp') || name.includes('typescript') || name.includes('python')) {
    // Language/LSP icon
    return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
    </svg>`;
  }

  if (name.includes('commit') || name.includes('pr') || name.includes('review')) {
    // Git icon
    return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 21V9a9 9 0 0 0 9 9"/>
    </svg>`;
  }

  if (name.includes('security')) {
    // Security icon
    return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>`;
  }

  if (name.includes('frontend') || name.includes('design')) {
    // Design icon
    return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>
    </svg>`;
  }

  // Default plugin icon
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
  </svg>`;
}

/**
 * Toggle plugin enabled/disabled
 */
async function togglePlugin(pluginId) {
  try {
    await ipcRenderer.invoke(IPC.TOGGLE_PLUGIN, pluginId);
  } catch (err) {
    console.error('Error toggling plugin:', err);
    showToast('Failed to toggle plugin', 'error');
  }
}

/**
 * Install plugin via terminal command
 */
function installPlugin(pluginName) {
  const command = `claude plugin install ${pluginName}`;

  // Send command to terminal
  if (typeof window.terminalSendCommand === 'function') {
    window.terminalSendCommand(command);
    showToast(`Installing ${pluginName}...`, 'info');
    // Hide panel so user can see terminal
    hide();
  } else {
    showToast('Terminal not available', 'error');
  }
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
  // Remove existing toast
  const existingToast = document.querySelector('.plugins-toast');
  if (existingToast) {
    existingToast.remove();
  }

  // Create toast element
  const toast = document.createElement('div');
  toast.className = `plugins-toast plugins-toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${getToastIcon(type)}</span>
    <span class="toast-message">${message}</span>
  `;

  // Add to panel
  if (panelElement) {
    panelElement.appendChild(toast);
  }

  // Animate in
  requestAnimationFrame(() => {
    toast.classList.add('visible');
  });

  // Remove after delay
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

/**
 * Get toast icon based on type
 */
function getToastIcon(type) {
  switch (type) {
    case 'success':
      return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
    case 'error':
      return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
    default:
      return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
  }
}

/**
 * Escape HTML for safe rendering
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ==================== SESSIONS ====================

/**
 * Load sessions from Claude data
 */
async function loadSessions() {
  const projectPath = state.getProjectPath();

  if (!projectPath) {
    sessionsData = [];
    sessionsLoaded = true;
    renderSessionsEmpty('No project selected');
    return;
  }

  try {
    sessionsData = await ipcRenderer.invoke(IPC.LOAD_CLAUDE_SESSIONS, projectPath);
    sessionsLoaded = true;
    renderSessions();
  } catch (err) {
    console.error('Error loading sessions:', err);
    sessionsData = [];
    sessionsLoaded = true;
    renderSessionsEmpty('Failed to load sessions');
  }
}

/**
 * Refresh sessions with spinner animation
 */
async function refreshSessions() {
  const refreshBtn = document.getElementById('sessions-refresh-btn');

  try {
    if (refreshBtn) {
      refreshBtn.classList.add('spinning');
      refreshBtn.disabled = true;
    }

    sessionsLoaded = false;
    await loadSessions();
  } finally {
    if (refreshBtn) {
      refreshBtn.classList.remove('spinning');
      refreshBtn.disabled = false;
    }
  }
}

/**
 * Render sessions list
 */
function renderSessions() {
  if (!sessionsContentElement) return;

  // Update count
  const countEl = document.getElementById('sessions-count');
  if (countEl) {
    countEl.textContent = `${sessionsData.length} session${sessionsData.length !== 1 ? 's' : ''}`;
  }

  if (sessionsData.length === 0) {
    renderSessionsEmpty('No sessions found for this project');
    return;
  }

  sessionsContentElement.innerHTML = sessionsData.map(session => renderSessionItem(session)).join('');

  // Resume button click listeners
  sessionsContentElement.querySelectorAll('.session-resume-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      resumeSession(btn.dataset.sessionId);
    });
  });

  // Resume dropdown click listeners
  sessionsContentElement.querySelectorAll('.session-resume-dropdown-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      showResumeDropdown(btn, btn.dataset.sessionId);
    });
  });
}

/**
 * Render a single session item
 */
function renderSessionItem(session) {
  const title = escapeHtml(session.summary || session.firstPrompt || 'Untitled session');
  const timeStr = formatRelativeTime(session.modified || session.created);
  const branch = session.gitBranch ? `<span class="session-branch">${escapeHtml(session.gitBranch)}</span>` : '';
  const msgCount = session.messageCount || 0;
  const sidechainClass = session.isSidechain ? ' sidechain' : '';
  const sessionState = session.state || 'inactive';

  // State label for tooltip
  const stateLabel = sessionState === 'active' ? 'Active' : sessionState === 'recent' ? 'Recent' : 'Inactive';

  return `
    <div class="session-item${sidechainClass}" data-session-id="${escapeHtml(session.sessionId)}">
      <div class="session-state-dot ${sessionState}" title="${stateLabel}"></div>
      <div class="session-content">
        <div class="session-title">${title}</div>
        <div class="session-meta">
          <span>${timeStr}</span>
          <span>${msgCount} msg${msgCount !== 1 ? 's' : ''}</span>
          ${branch}
        </div>
      </div>
      <div class="session-actions">
        <div class="session-resume-group">
          <button class="session-resume-btn" data-session-id="${escapeHtml(session.sessionId)}" title="Resume session">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
          </button>
          <button class="session-resume-dropdown-btn" data-session-id="${escapeHtml(session.sessionId)}" title="Resume options">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render sessions empty state
 */
function renderSessionsEmpty(message) {
  if (!sessionsContentElement) return;

  const countEl = document.getElementById('sessions-count');
  if (countEl) countEl.textContent = '';

  sessionsContentElement.innerHTML = `
    <div class="sessions-empty">
      <div class="plugins-empty-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </div>
      <p>${escapeHtml(message)}</p>
      <span>Claude Code sessions will appear here</span>
    </div>
  `;
}

/**
 * Resume a session by sending command to terminal.
 * Uses the configured AI tool command by default.
 */
function resumeSession(sessionId, customCommand) {
  const baseCommand = customCommand || aiToolSelector.getStartCommand() || 'claude';
  const command = `${baseCommand} --resume ${sessionId}`;

  if (typeof window.terminalSendCommand === 'function') {
    window.terminalSendCommand(command);
    hide();
  } else {
    showToast('Terminal not available', 'error');
  }
}

/**
 * Show resume dropdown with command options
 */
function showResumeDropdown(anchorEl, sessionId) {
  // Remove any existing dropdown
  const existing = document.querySelector('.session-resume-dropdown');
  if (existing) { existing.remove(); return; }

  const defaultCmd = aiToolSelector.getStartCommand() || 'claude';
  const options = [
    { label: `${defaultCmd} (default)`, command: defaultCmd },
    { label: 'claude', command: 'claude' },
    { label: 'claude --continue', command: 'claude --continue', isContinue: true },
    { label: 'Custom command...', command: null, isCustom: true }
  ];

  // Deduplicate if default is already 'claude'
  const seen = new Set();
  const uniqueOptions = options.filter(opt => {
    if (opt.isCustom || opt.isContinue) return true;
    const key = opt.command;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const dropdown = document.createElement('div');
  dropdown.className = 'session-resume-dropdown';

  uniqueOptions.forEach(opt => {
    const item = document.createElement('button');
    item.className = 'session-resume-dropdown-item';
    item.textContent = opt.label;
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.remove();

      if (opt.isCustom) {
        showCustomCommandPrompt(sessionId);
      } else if (opt.isContinue) {
        // --continue doesn't use session ID
        if (typeof window.terminalSendCommand === 'function') {
          window.terminalSendCommand(`${opt.command}`);
          hide();
        }
      } else {
        resumeSession(sessionId, opt.command);
      }
    });
    dropdown.appendChild(item);
  });

  // Position near the anchor
  const rect = anchorEl.getBoundingClientRect();
  const panelRect = panelElement.getBoundingClientRect();
  dropdown.style.position = 'absolute';
  dropdown.style.top = `${rect.bottom - panelRect.top + 4}px`;
  dropdown.style.right = `${panelRect.right - rect.right}px`;

  panelElement.appendChild(dropdown);

  // Close on click outside
  const closeHandler = (e) => {
    if (!dropdown.contains(e.target)) {
      dropdown.remove();
      document.removeEventListener('click', closeHandler, true);
    }
  };
  setTimeout(() => document.addEventListener('click', closeHandler, true), 0);
}

/**
 * Show a simple inline prompt for custom command
 */
function showCustomCommandPrompt(sessionId) {
  const cmd = prompt('Enter command to resume session:', 'claude');
  if (cmd && cmd.trim()) {
    resumeSession(sessionId, cmd.trim());
  }
}

/**
 * Format a date string to relative time
 */
function formatRelativeTime(dateString) {
  if (!dateString) return '';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour !== 1 ? 's' : ''} ago`;
  if (diffDay === 1) return 'yesterday';
  if (diffDay < 7) return `${diffDay} days ago`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)} week${Math.floor(diffDay / 7) !== 1 ? 's' : ''} ago`;

  return date.toLocaleDateString();
}

module.exports = {
  init,
  show,
  hide,
  toggle,
  collapse,
  expand,
  loadPlugins,
  isVisible: () => isVisible,
  isCollapsed: () => isCollapsed
};
