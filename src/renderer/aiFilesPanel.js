/**
 * AI Files Panel Module
 * UI for detecting and managing native AI instruction files
 * (CLAUDE.md, GEMINI.md, AGENTS.md, codex wrapper)
 */

const { ipcRenderer } = require('electron');
const { IPC } = require('../shared/ipcChannels');
const state = require('./state');
const editor = require('./editor');

let contentElement = null;
let aiFilesData = null;
let backlinkConfig = null;
let verificationData = null;

/**
 * File definitions — display name, backend key, filename for IPC
 */
const AI_FILES = [
  { key: 'agents', label: 'AGENTS.md', filename: 'AGENTS.md', supportsBacklink: false },
  { key: 'claude', label: 'CLAUDE.md', filename: 'CLAUDE.md', supportsBacklink: true },
  { key: 'gemini', label: 'GEMINI.md', filename: 'GEMINI.md', supportsBacklink: true },
  { key: 'codexWrapper', label: 'Codex wrapper', filename: '.subframe/bin/codex', supportsBacklink: false }
];

/**
 * Initialize AI files panel
 */
function init() {
  contentElement = document.getElementById('ai-files-content');
  setupIPCListeners();

  // Auto-verify backlinks when Frame status changes to true (project opened)
  state.onFrameStatusChange((isFrame) => {
    if (isFrame) {
      runVerification();
    } else {
      verificationData = null;
    }
  });
}

/**
 * Trigger backlink verification for the current project
 */
function runVerification() {
  const projectPath = state.getProjectPath();
  if (!projectPath) return;
  ipcRenderer.send(IPC.VERIFY_BACKLINKS, projectPath);
}

/**
 * Setup IPC listeners for status updates
 */
function setupIPCListeners() {
  ipcRenderer.on(IPC.AI_FILES_STATUS_DATA, (event, { projectPath, status, error }) => {
    if (error) {
      aiFilesData = null;
      renderError(error);
      return;
    }
    aiFilesData = status;
    render();
  });

  ipcRenderer.on(IPC.AI_FILE_UPDATED, (event, { projectPath, filename, action, success }) => {
    if (success) {
      showToast(`${action === 'inject' ? 'Backlink injected' : action === 'remove' ? 'Backlink removed' : action === 'create' ? 'File created' : 'Symlink migrated'}`, 'success');
    } else {
      showToast(`Failed to ${action} ${filename}`, 'error');
    }
    // Refresh status
    loadStatus();
  });

  ipcRenderer.on(IPC.BACKLINK_CONFIG_DATA, (event, { projectPath, config }) => {
    backlinkConfig = config;
    renderBacklinkCustomize();
  });

  ipcRenderer.on(IPC.BACKLINK_CONFIG_SAVED, (event, { projectPath, success }) => {
    if (success) {
      showToast('Backlink config saved', 'success');
    } else {
      showToast('Failed to save backlink config', 'error');
    }
  });

  ipcRenderer.on(IPC.ALL_BACKLINKS_UPDATED, (event, { projectPath, result }) => {
    if (result.updated.length > 0) {
      showToast(`Updated backlinks in ${result.updated.join(', ')}`, 'success');
    }
    if (result.failed.length > 0) {
      showToast(`Failed to update ${result.failed.join(', ')}`, 'error');
    }
    loadStatus();
  });

  ipcRenderer.on(IPC.BACKLINK_VERIFICATION_RESULT, (event, { projectPath, result, error }) => {
    if (error) {
      verificationData = null;
      return;
    }
    verificationData = result;
    render();
  });
}

/**
 * Load AI files status for the current project
 */
function loadStatus() {
  const projectPath = state.getProjectPath();
  if (!projectPath) {
    aiFilesData = null;
    renderEmpty('No project selected');
    return;
  }
  ipcRenderer.send(IPC.GET_AI_FILES_STATUS, projectPath);
}

/**
 * Render the AI files list
 */
function render() {
  if (!contentElement) return;
  if (!aiFilesData) {
    renderEmpty('No project selected');
    return;
  }

  const items = AI_FILES.map(file => {
    const status = aiFilesData[file.key];
    if (!status) return '';
    return renderFileItem(file, status);
  }).join('');

  const claudeSettingsSection = renderClaudeSettingsSection();
  const verificationSection = renderVerificationSection();

  contentElement.innerHTML = `
    <div class="ai-files-header-bar">
      <span>AI Instruction Files</span>
      <div class="ai-files-header-actions">
        <button id="ai-files-verify-btn" tabindex="-1" title="Verify backlinks">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 12l2 2 4-4"/><path d="M12 3a9 9 0 1 0 9 9"/>
          </svg>
        </button>
        <button id="ai-files-refresh-btn" tabindex="-1" title="Refresh status">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
          </svg>
        </button>
      </div>
    </div>
    ${verificationSection}
    <div class="ai-files-list">
      ${items}
    </div>
    ${claudeSettingsSection}
    <div id="backlink-customize-section"></div>
  `;

  // Wire up verify button
  const verifyBtn = document.getElementById('ai-files-verify-btn');
  if (verifyBtn) {
    verifyBtn.addEventListener('click', () => {
      verifyBtn.classList.add('spinning');
      verifyBtn.disabled = true;
      runVerification();
      setTimeout(() => {
        verifyBtn.classList.remove('spinning');
        verifyBtn.disabled = false;
      }, 600);
    });
  }

  // Wire up refresh button
  const refreshBtn = document.getElementById('ai-files-refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      refreshBtn.classList.add('spinning');
      refreshBtn.disabled = true;
      loadStatus();
      setTimeout(() => {
        refreshBtn.classList.remove('spinning');
        refreshBtn.disabled = false;
      }, 600);
    });
  }

  // Wire up action buttons
  wireActionButtons();

  // Load backlink config for the customize section
  const projectPath = state.getProjectPath();
  if (projectPath) {
    ipcRenderer.send(IPC.GET_BACKLINK_CONFIG, projectPath);
  }
}

/**
 * Render a single file item
 */
function renderFileItem(file, status) {
  const { statusLabel, statusClass, statusIcon } = getStatusDisplay(file, status);

  let actions = '';

  if (status.exists) {
    // Edit button — always available when file exists
    actions += `<button class="ai-file-action-btn ai-file-edit-btn" data-filename="${file.filename}" title="Edit file">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
      Edit
    </button>`;

    if (file.supportsBacklink) {
      if (status.isSymlink) {
        // Symlink — show migrate button
        actions += `<button class="ai-file-action-btn ai-file-migrate-btn" data-filename="${file.filename}" title="Migrate symlink to real file with backlink">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
          </svg>
          Migrate
        </button>`;
      } else if (status.hasBacklink) {
        // Backlink active — show remove button
        actions += `<button class="ai-file-action-btn ai-file-remove-btn" data-filename="${file.filename}" title="Remove SubFrame backlink">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
          Remove backlink
        </button>`;
      } else {
        // No backlink — show inject button
        actions += `<button class="ai-file-action-btn ai-file-inject-btn" data-filename="${file.filename}" title="Inject SubFrame backlink">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
          Inject backlink
        </button>`;
      }
    }
  } else {
    // File missing — show create button (only for backlink-supporting files)
    if (file.supportsBacklink) {
      actions += `<button class="ai-file-action-btn ai-file-create-btn" data-filename="${file.filename}" title="Create file with backlink">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Create
      </button>`;
    }
  }

  return `
    <div class="ai-file-item ${statusClass}">
      <div class="ai-file-info">
        <div class="ai-file-name-row">
          <span class="ai-file-name">${escapeHtml(file.label)}</span>
          <span class="ai-file-status ${statusClass}">${statusIcon} ${statusLabel}</span>
        </div>
        ${file.key === 'codexWrapper' && status.exists ? `<div class="ai-file-path">.subframe/bin/codex</div>` : ''}
      </div>
      <div class="ai-file-actions">
        ${actions}
      </div>
    </div>
  `;
}

/**
 * Render the verification results section
 * Shows color-coded issues from the last verification run
 */
function renderVerificationSection() {
  if (!verificationData) return '';

  const issues = verificationData.issues;
  if (issues.length === 0) {
    return `
      <div class="verification-banner verification-ok">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
        <span>All backlinks verified</span>
      </div>
    `;
  }

  const issueItems = issues.map(issue => {
    const severityClass = `verification-${issue.severity}`;
    const icon = issue.severity === 'error'
      ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
      : issue.severity === 'warning'
        ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
        : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';

    return `
      <div class="verification-issue ${severityClass}">
        <div class="verification-issue-header">
          ${icon}
          <span class="verification-issue-file">${escapeHtml(issue.file)}</span>
          <span class="verification-issue-type">${escapeHtml(issue.issue)}</span>
        </div>
        <div class="verification-issue-suggestion">${escapeHtml(issue.suggestion)}</div>
      </div>
    `;
  }).join('');

  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const summaryClass = errorCount > 0 ? 'verification-error' : 'verification-warning';
  const summaryParts = [];
  if (errorCount > 0) summaryParts.push(`${errorCount} error${errorCount > 1 ? 's' : ''}`);
  if (warningCount > 0) summaryParts.push(`${warningCount} warning${warningCount > 1 ? 's' : ''}`);
  const infoCount = issues.length - errorCount - warningCount;
  if (infoCount > 0) summaryParts.push(`${infoCount} info`);

  return `
    <div class="verification-banner ${summaryClass}">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
      <span>Verification: ${summaryParts.join(', ')}</span>
    </div>
    <div class="verification-issues">
      ${issueItems}
    </div>
  `;
}

/**
 * Render the .claude/ Directory section (read-only, informational)
 * SubFrame never touches .claude/ — it belongs to Claude Code.
 */
function renderClaudeSettingsSection() {
  if (!aiFilesData || !aiFilesData.claudeSettings || !aiFilesData.claudeSettings.exists) {
    return '';
  }

  const cs = aiFilesData.claudeSettings;
  const details = [];
  if (cs.hasConfig) details.push('settings.json');
  if (cs.hasMemory) details.push('memory.md');
  if (cs.hasProjects) details.push('projects/');

  const detailsText = details.length > 0
    ? details.join(', ')
    : 'empty';

  const checkIcon = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';

  return `
    <div class="ai-files-header-bar claude-settings-header">
      <span>.claude/ Directory</span>
    </div>
    <div class="ai-files-list">
      <div class="ai-file-item status-info">
        <div class="ai-file-info">
          <div class="ai-file-name-row">
            <span class="ai-file-name">.claude/</span>
            <span class="ai-file-status status-info">${checkIcon} Detected</span>
          </div>
          <div class="ai-file-path">Contains: ${escapeHtml(detailsText)}</div>
          <div class="claude-settings-note">Managed by Claude Code — SubFrame does not modify this directory</div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Get display info for a file status
 */
function getStatusDisplay(file, status) {
  if (!status.exists) {
    return {
      statusLabel: 'Missing',
      statusClass: 'status-missing',
      statusIcon: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
    };
  }

  if (status.isSymlink) {
    return {
      statusLabel: 'Legacy symlink',
      statusClass: 'status-symlink',
      statusIcon: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
    };
  }

  if (file.supportsBacklink) {
    if (status.hasBacklink) {
      return {
        statusLabel: 'Backlink active',
        statusClass: 'status-active',
        statusIcon: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>'
      };
    }
    return {
      statusLabel: 'No backlink',
      statusClass: 'status-warning',
      statusIcon: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
    };
  }

  // Non-backlink files (AGENTS.md, codex wrapper) — just present/missing
  return {
    statusLabel: 'Present',
    statusClass: 'status-present',
    statusIcon: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>'
  };
}

/**
 * Wire up action button click handlers
 */
function wireActionButtons() {
  if (!contentElement) return;
  const projectPath = state.getProjectPath();
  if (!projectPath) return;

  // Edit buttons
  contentElement.querySelectorAll('.ai-file-edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const filename = btn.dataset.filename;
      const filePath = filename.includes('/')
        ? `${projectPath}/${filename}`
        : `${projectPath}/${filename}`;
      editor.openFile(filePath, 'ai-files');
    });
  });

  // Inject backlink buttons
  contentElement.querySelectorAll('.ai-file-inject-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      ipcRenderer.send(IPC.INJECT_BACKLINK, { projectPath, filename: btn.dataset.filename });
    });
  });

  // Remove backlink buttons
  contentElement.querySelectorAll('.ai-file-remove-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      ipcRenderer.send(IPC.REMOVE_BACKLINK, { projectPath, filename: btn.dataset.filename });
    });
  });

  // Create file buttons
  contentElement.querySelectorAll('.ai-file-create-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      ipcRenderer.send(IPC.CREATE_NATIVE_FILE, { projectPath, filename: btn.dataset.filename });
    });
  });

  // Migrate symlink buttons
  contentElement.querySelectorAll('.ai-file-migrate-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      ipcRenderer.send(IPC.MIGRATE_SYMLINK, { projectPath, filename: btn.dataset.filename });
    });
  });
}

/**
 * Render the backlink customization section
 * Populates #backlink-customize-section if it exists
 */
function renderBacklinkCustomize() {
  const container = document.getElementById('backlink-customize-section');
  if (!container) return;

  const customMessage = (backlinkConfig && backlinkConfig.customMessage) || '';
  const additionalRefs = (backlinkConfig && backlinkConfig.additionalRefs) || [];
  const refsValue = additionalRefs.join('\n');

  container.innerHTML = `
    <div class="ai-files-header-bar">
      <span>Customize Backlinks</span>
    </div>
    <div class="backlink-customize-form">
      <div class="backlink-customize-field">
        <label for="backlink-custom-message">Custom message</label>
        <textarea id="backlink-custom-message" rows="2" placeholder="Leave empty for default message">${escapeHtml(customMessage)}</textarea>
        <div class="backlink-customize-hint">Replaces the default backlink text. Supports Markdown.</div>
      </div>
      <div class="backlink-customize-field">
        <label for="backlink-additional-refs">Additional references</label>
        <textarea id="backlink-additional-refs" rows="3" placeholder="One per line, e.g.:&#10;> Also read [STYLE.md](./STYLE.md)">${escapeHtml(refsValue)}</textarea>
        <div class="backlink-customize-hint">Extra lines appended after the main message. One per line.</div>
      </div>
      <div class="backlink-customize-actions">
        <button id="backlink-save-btn" class="ai-file-action-btn" title="Save settings to .subframe/config.json">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
          </svg>
          Save
        </button>
        <button id="backlink-update-all-btn" class="ai-file-action-btn" title="Save and re-inject all backlinks with current settings">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
          </svg>
          Update all backlinks
        </button>
        <button id="backlink-reset-btn" class="ai-file-action-btn" title="Reset to defaults">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
          Reset
        </button>
      </div>
    </div>
  `;

  wireBacklinkCustomizeButtons();
}

/**
 * Wire up event handlers for backlink customize form
 */
function wireBacklinkCustomizeButtons() {
  const projectPath = state.getProjectPath();
  if (!projectPath) return;

  const saveBtn = document.getElementById('backlink-save-btn');
  const updateAllBtn = document.getElementById('backlink-update-all-btn');
  const resetBtn = document.getElementById('backlink-reset-btn');

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const customMessage = (document.getElementById('backlink-custom-message') || {}).value || '';
      const refsText = (document.getElementById('backlink-additional-refs') || {}).value || '';
      const additionalRefs = refsText.split('\n').filter(line => line.trim());
      ipcRenderer.send(IPC.SAVE_BACKLINK_CONFIG, {
        projectPath,
        backlinkConfig: { customMessage, additionalRefs }
      });
      backlinkConfig = { customMessage, additionalRefs };
    });
  }

  if (updateAllBtn) {
    updateAllBtn.addEventListener('click', () => {
      const customMessage = (document.getElementById('backlink-custom-message') || {}).value || '';
      const refsText = (document.getElementById('backlink-additional-refs') || {}).value || '';
      const additionalRefs = refsText.split('\n').filter(line => line.trim());
      ipcRenderer.send(IPC.SAVE_BACKLINK_CONFIG, {
        projectPath,
        backlinkConfig: { customMessage, additionalRefs }
      });
      backlinkConfig = { customMessage, additionalRefs };
      setTimeout(() => {
        ipcRenderer.send(IPC.UPDATE_ALL_BACKLINKS, projectPath);
      }, 100);
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      ipcRenderer.send(IPC.SAVE_BACKLINK_CONFIG, {
        projectPath,
        backlinkConfig: { customMessage: '', additionalRefs: [] }
      });
      backlinkConfig = { customMessage: '', additionalRefs: [] };
      renderBacklinkCustomize();
    });
  }
}

/**
 * Render empty state
 */
function renderEmpty(message) {
  if (!contentElement) return;

  contentElement.innerHTML = `
    <div class="ai-files-empty">
      <div class="plugins-empty-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15l2 2 4-4"/>
        </svg>
      </div>
      <p>${escapeHtml(message)}</p>
      <span>AI instruction file status will appear here</span>
    </div>
  `;
}

/**
 * Render error state
 */
function renderError(error) {
  if (!contentElement) return;

  contentElement.innerHTML = `
    <div class="ai-files-empty">
      <div class="plugins-empty-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
      </div>
      <p>Error loading AI files</p>
      <span>${escapeHtml(error)}</span>
    </div>
  `;
}

/**
 * Show toast notification (reuses pluginsPanel pattern)
 */
function showToast(message, type = 'info') {
  const existingToast = document.querySelector('.ai-files-toast');
  if (existingToast) existingToast.remove();

  const icons = {
    success: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
    error: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    info: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
  };

  const toast = document.createElement('div');
  toast.className = `plugins-toast plugins-toast-${type} ai-files-toast`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-message">${message}</span>
  `;

  const panel = document.getElementById('plugins-panel');
  if (panel) panel.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('visible'));
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  }, 2000);
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
  loadStatus,
  runVerification
};
