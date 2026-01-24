/**
 * History Panel Module
 * Toggle, load, render prompt history
 */

const { ipcRenderer } = require('electron');
const { IPC } = require('../shared/ipcChannels');

let historyPanel = null;
let historyContent = null;
let historyVisible = false;
let onToggleCallback = null;

/**
 * Initialize history panel
 */
function init(panelId, contentId, onToggle) {
  historyPanel = document.getElementById(panelId);
  historyContent = document.getElementById(contentId);
  onToggleCallback = onToggle;

  setupIPC();
}

/**
 * Check if history panel is visible
 */
function isHistoryVisible() {
  return historyVisible;
}

/**
 * Toggle history panel visibility
 */
function toggleHistoryPanel() {
  historyVisible = !historyVisible;

  if (historyVisible) {
    historyPanel.classList.add('visible');
    loadPromptHistory();
  } else {
    historyPanel.classList.remove('visible');
  }

  // Callback for terminal resize
  if (onToggleCallback) {
    onToggleCallback(historyVisible);
  }

  return historyVisible;
}

/**
 * Show history panel
 */
function showHistoryPanel() {
  if (!historyVisible) {
    toggleHistoryPanel();
  }
}

/**
 * Hide history panel
 */
function hideHistoryPanel() {
  if (historyVisible) {
    toggleHistoryPanel();
  }
}

/**
 * Load prompt history from file
 */
function loadPromptHistory() {
  ipcRenderer.send(IPC.LOAD_PROMPT_HISTORY);
}

/**
 * Render prompt history data
 */
function renderPromptHistory(historyData) {
  historyContent.innerHTML = '';

  if (!historyData || historyData.trim() === '') {
    historyContent.innerHTML = '<div style="color: #858585; padding: 10px; text-align: center;">No history yet</div>';
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
      historyContent.appendChild(item);
    }
  });
}

/**
 * Setup IPC listeners
 */
function setupIPC() {
  ipcRenderer.on(IPC.PROMPT_HISTORY_DATA, (event, data) => {
    renderPromptHistory(data);
  });

  ipcRenderer.on(IPC.TOGGLE_HISTORY_PANEL, () => {
    toggleHistoryPanel();
  });
}

module.exports = {
  init,
  isHistoryVisible,
  toggleHistoryPanel,
  showHistoryPanel,
  hideHistoryPanel,
  loadPromptHistory
};
