/**
 * Settings Panel Module
 * UI for application settings including AI tool command customization
 */

const { ipcRenderer } = require('electron');
const { IPC } = require('../shared/ipcChannels');

let isVisible = false;
let settingsData = null;
let aiToolConfig = null;

// DOM Elements
let panelElement = null;
let contentElement = null;

/**
 * Initialize settings panel
 */
function init() {
  panelElement = document.getElementById('settings-panel');
  contentElement = document.getElementById('settings-content');

  if (!panelElement) {
    console.error('Settings panel element not found');
    return;
  }

  setupEventListeners();
  setupIPCListeners();
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  const closeBtn = document.getElementById('settings-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', hide);
  }

  const collapseBtn = document.getElementById('settings-collapse-btn');
  if (collapseBtn) {
    collapseBtn.addEventListener('click', hide);
  }
}

/**
 * Setup IPC listeners
 */
function setupIPCListeners() {
  ipcRenderer.on(IPC.SETTINGS_UPDATED, (event, { key, value, settings }) => {
    settingsData = settings;
    showToast('Settings saved', 'success');
  });
}

/**
 * Load settings and AI tool config
 */
async function loadSettings() {
  try {
    const [settings, toolConfig] = await Promise.all([
      ipcRenderer.invoke(IPC.LOAD_SETTINGS),
      ipcRenderer.invoke(IPC.GET_AI_TOOL_CONFIG)
    ]);
    settingsData = settings;
    aiToolConfig = toolConfig;
    render();
  } catch (err) {
    console.error('Error loading settings:', err);
  }
}

/**
 * Show settings panel
 */
function show() {
  if (panelElement) {
    panelElement.classList.add('visible');
    isVisible = true;
    loadSettings();
  }
}

/**
 * Hide settings panel
 */
function hide() {
  if (panelElement) {
    panelElement.classList.remove('visible');
    isVisible = false;
  }
}

/**
 * Toggle settings panel visibility
 */
function toggle() {
  if (isVisible) {
    hide();
  } else {
    show();
  }
}

/**
 * Render settings content
 */
function render() {
  if (!contentElement || !settingsData || !aiToolConfig) return;

  const activeTool = aiToolConfig.activeTool;
  const toolId = activeTool.id;
  const defaultCommand = activeTool.command;
  const customCommand = (settingsData.aiTools && settingsData.aiTools[toolId] && settingsData.aiTools[toolId].customCommand) || '';
  const displayCommand = customCommand || defaultCommand;

  const generalSettings = settingsData.general || { autoCreateTerminal: false, defaultProjectDir: '' };
  const terminalSettings = settingsData.terminal || { fontSize: 14, scrollback: 10000 };
  const defaultProjectDir = generalSettings.defaultProjectDir || '';

  contentElement.innerHTML = `
    <div class="settings-section">
      <div class="settings-section-header">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
        <span>General</span>
      </div>
      <div class="settings-section-body">
        <div class="settings-field settings-toggle-field">
          <label class="settings-label" for="settings-auto-terminal">Open terminal on startup</label>
          <label class="settings-toggle">
            <input type="checkbox" id="settings-auto-terminal" ${generalSettings.autoCreateTerminal ? 'checked' : ''} />
            <span class="settings-toggle-slider"></span>
          </label>
        </div>
        <div class="settings-hint">Automatically create a terminal when SubFrame launches.</div>
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-section-header">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
        <span>Projects</span>
      </div>
      <div class="settings-section-body">
        <div class="settings-field">
          <label class="settings-label">Default Project Directory</label>
          <div class="settings-dir-row">
            <input type="text" id="settings-default-project-dir" class="settings-input"
              value="${escapeHtml(defaultProjectDir)}" readonly
              placeholder="No directory selected" />
            <button id="settings-browse-dir" class="settings-btn settings-btn-primary">Browse</button>
          </div>
          <div class="settings-hint">Subdirectories of this folder will appear automatically in the project list.</div>
        </div>
        <div class="settings-actions">
          <button id="settings-scan-now" class="settings-btn settings-btn-secondary" ${!defaultProjectDir ? 'disabled' : ''}>Scan Now</button>
          <button id="settings-clear-dir" class="settings-btn settings-btn-secondary" ${!defaultProjectDir ? 'disabled' : ''}>Clear</button>
        </div>
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-section-header">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="M2 17l10 5 10-5"/>
          <path d="M2 12l10 5 10-5"/>
        </svg>
        <span>AI Tool Configuration</span>
      </div>
      <div class="settings-section-body">
        <div class="settings-field">
          <label class="settings-label">Active Tool</label>
          <div class="settings-value">${escapeHtml(activeTool.name)}</div>
        </div>
        <div class="settings-field">
          <label class="settings-label" for="settings-ai-command">Start Command</label>
          <input type="text" id="settings-ai-command" class="settings-input"
            value="${escapeHtml(displayCommand)}"
            placeholder="${escapeHtml(defaultCommand)}" />
          <div class="settings-hint">Default: <code>${escapeHtml(defaultCommand)}</code></div>
        </div>
        <div class="settings-actions">
          <button id="settings-ai-save" class="settings-btn settings-btn-primary">Save</button>
          <button id="settings-ai-reset" class="settings-btn settings-btn-secondary">Reset to Default</button>
        </div>
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-section-header">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <polyline points="4 17 10 11 4 5"/>
          <line x1="12" y1="19" x2="20" y2="19"/>
        </svg>
        <span>Terminal</span>
      </div>
      <div class="settings-section-body">
        <div class="settings-field">
          <label class="settings-label" for="settings-font-size">Font Size</label>
          <div class="settings-range-row">
            <input type="range" id="settings-font-size" class="settings-range"
              min="10" max="24" step="1" value="${terminalSettings.fontSize}" />
            <span id="settings-font-size-value" class="settings-range-value">${terminalSettings.fontSize}px</span>
          </div>
        </div>
        <div class="settings-field">
          <label class="settings-label" for="settings-scrollback">Scrollback Lines</label>
          <input type="number" id="settings-scrollback" class="settings-input"
            value="${terminalSettings.scrollback}" min="1000" max="100000" step="1000" />
        </div>
        <div class="settings-actions">
          <button id="settings-terminal-save" class="settings-btn settings-btn-primary">Save</button>
        </div>
      </div>
    </div>
  `;

  // Bind action listeners
  bindActionListeners();
}

/**
 * Bind action button listeners after render
 */
function bindActionListeners() {
  // General: auto-create terminal toggle (saves immediately)
  const autoTerminalToggle = document.getElementById('settings-auto-terminal');
  if (autoTerminalToggle) {
    autoTerminalToggle.addEventListener('change', () => {
      ipcRenderer.invoke(IPC.UPDATE_SETTING, {
        key: 'general.autoCreateTerminal',
        value: autoTerminalToggle.checked
      });
    });
  }

  // Default project directory: Browse
  const browseDirBtn = document.getElementById('settings-browse-dir');
  if (browseDirBtn) {
    browseDirBtn.addEventListener('click', async () => {
      const selectedPath = await ipcRenderer.invoke(IPC.SELECT_DEFAULT_PROJECT_DIR);
      if (selectedPath) {
        await ipcRenderer.invoke(IPC.UPDATE_SETTING, {
          key: 'general.defaultProjectDir',
          value: selectedPath
        });
        const dirInput = document.getElementById('settings-default-project-dir');
        if (dirInput) dirInput.value = selectedPath;
        // Enable scan/clear buttons
        const scanBtn = document.getElementById('settings-scan-now');
        const clearBtn = document.getElementById('settings-clear-dir');
        if (scanBtn) scanBtn.disabled = false;
        if (clearBtn) clearBtn.disabled = false;
        // Auto-refresh project list
        ipcRenderer.send(IPC.LOAD_WORKSPACE);
        showToast('Default project directory set', 'success');
      }
    });
  }

  // Default project directory: Scan Now
  const scanNowBtn = document.getElementById('settings-scan-now');
  if (scanNowBtn) {
    scanNowBtn.addEventListener('click', () => {
      ipcRenderer.send(IPC.LOAD_WORKSPACE);
      showToast('Project list refreshed', 'success');
    });
  }

  // Default project directory: Clear
  const clearDirBtn = document.getElementById('settings-clear-dir');
  if (clearDirBtn) {
    clearDirBtn.addEventListener('click', async () => {
      await ipcRenderer.invoke(IPC.UPDATE_SETTING, {
        key: 'general.defaultProjectDir',
        value: ''
      });
      const dirInput = document.getElementById('settings-default-project-dir');
      if (dirInput) dirInput.value = '';
      scanNowBtn.disabled = true;
      clearDirBtn.disabled = true;
      ipcRenderer.send(IPC.LOAD_WORKSPACE);
      showToast('Default project directory cleared', 'info');
    });
  }

  // AI command save
  const aiSaveBtn = document.getElementById('settings-ai-save');
  if (aiSaveBtn) {
    aiSaveBtn.addEventListener('click', () => {
      const input = document.getElementById('settings-ai-command');
      if (!input) return;
      const value = input.value.trim();
      const toolId = aiToolConfig.activeTool.id;
      ipcRenderer.invoke(IPC.UPDATE_SETTING, {
        key: `aiTools.${toolId}.customCommand`,
        value: value || ''
      });
    });
  }

  // AI command reset
  const aiResetBtn = document.getElementById('settings-ai-reset');
  if (aiResetBtn) {
    aiResetBtn.addEventListener('click', () => {
      const toolId = aiToolConfig.activeTool.id;
      ipcRenderer.invoke(IPC.UPDATE_SETTING, {
        key: `aiTools.${toolId}.customCommand`,
        value: ''
      });
      const input = document.getElementById('settings-ai-command');
      if (input) {
        input.value = aiToolConfig.activeTool.command;
      }
      showToast('Reset to default command', 'info');
    });
  }

  // Font size slider
  const fontSizeSlider = document.getElementById('settings-font-size');
  const fontSizeValue = document.getElementById('settings-font-size-value');
  if (fontSizeSlider && fontSizeValue) {
    fontSizeSlider.addEventListener('input', () => {
      fontSizeValue.textContent = `${fontSizeSlider.value}px`;
    });
  }

  // Terminal save
  const termSaveBtn = document.getElementById('settings-terminal-save');
  if (termSaveBtn) {
    termSaveBtn.addEventListener('click', () => {
      const fontSize = parseInt(document.getElementById('settings-font-size')?.value || '14', 10);
      const scrollback = parseInt(document.getElementById('settings-scrollback')?.value || '10000', 10);
      ipcRenderer.invoke(IPC.UPDATE_SETTING, {
        key: 'terminal.fontSize',
        value: fontSize
      });
      ipcRenderer.invoke(IPC.UPDATE_SETTING, {
        key: 'terminal.scrollback',
        value: scrollback
      });
    });
  }
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
  const existingToast = panelElement?.querySelector('.settings-toast');
  if (existingToast) {
    existingToast.remove();
  }

  const toast = document.createElement('div');
  toast.className = `settings-toast settings-toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${getToastIcon(type)}</span>
    <span class="toast-message">${message}</span>
  `;

  if (panelElement) {
    panelElement.appendChild(toast);
  }

  requestAnimationFrame(() => {
    toast.classList.add('visible');
  });

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

module.exports = {
  init,
  show,
  hide,
  toggle,
  isVisible: () => isVisible
};
