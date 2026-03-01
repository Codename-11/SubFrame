/**
 * Sidebar Resize Module
 * Allows users to drag and resize the sidebar width.
 *
 * Three states:
 *   expanded  — full sidebar (180–500px, resizable)
 *   collapsed — icon strip (54px)
 *   hidden    — sidebar gone, floating logo overlay visible
 *
 * Collapse button steps: expanded → collapsed → hidden
 * Float logo click:      hidden → expanded
 * Ctrl+B (toggle):       expanded ↔ hidden  (skips collapsed)
 */

const STORAGE_KEY = 'sidebar-width';
const STATE_KEY = 'sidebar-state';       // 'expanded' | 'collapsed' | 'hidden'
const LEGACY_HIDDEN_KEY = 'sidebar-hidden'; // migrate from old boolean key
const MIN_WIDTH = 180;
const MAX_WIDTH = 500;
const DEFAULT_WIDTH = 260;
const COLLAPSED_WIDTH = 54;

// State: 'expanded' | 'collapsed' | 'hidden'
let sidebarState = 'expanded';

let sidebar = null;
let floatLogo = null;
let widthBeforeHide = DEFAULT_WIDTH;
let resizeHandle = null;
let isResizing = false;
let startX = 0;
let startWidth = 0;
let onResizeCallback = null;

/**
 * Initialize sidebar resize functionality
 * @param {Function} onResize - Optional callback when resize completes
 */
function init(onResize) {
  sidebar = document.getElementById('sidebar');
  resizeHandle = document.getElementById('sidebar-resize-handle');
  floatLogo = document.getElementById('sidebar-float-logo');
  onResizeCallback = onResize;

  if (!sidebar || !resizeHandle) {
    console.error('Sidebar resize: Required elements not found');
    return;
  }

  // Collapse button: expanded → collapsed, collapsed → hidden
  const collapseBtn = document.getElementById('btn-collapse-sidebar');
  if (collapseBtn) {
    collapseBtn.addEventListener('click', () => {
      if (sidebarState === 'expanded') collapse();
      else if (sidebarState === 'collapsed') hideAll();
    });
  }

  // Expand button (inside collapse bar): collapsed → expanded
  const expandBtn = document.getElementById('btn-expand-sidebar');
  if (expandBtn) {
    expandBtn.addEventListener('click', expand);
  }

  // Float logo: hidden → expanded
  if (floatLogo) {
    floatLogo.addEventListener('click', expand);
  }

  // Restore saved width
  const savedWidth = localStorage.getItem(STORAGE_KEY);
  if (savedWidth) {
    const width = parseInt(savedWidth, 10);
    if (width >= MIN_WIDTH && width <= MAX_WIDTH) {
      sidebar.style.width = `${width}px`;
      widthBeforeHide = width;
    }
  }

  // Restore state (with migration from old boolean key)
  const restoredState = restoreState();
  if (restoredState !== 'expanded') {
    // Apply state immediately without transition
    sidebar.style.transition = 'none';
    applyState(restoredState);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        sidebar.style.transition = '';
      });
    });
  }

  // Setup resize listeners
  resizeHandle.addEventListener('mousedown', handleMouseDown);
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
  resizeHandle.addEventListener('dblclick', resetWidth);
}

// ── State helpers ──────────────────────────────────────────

function restoreState() {
  // Try new key first
  let saved = localStorage.getItem(STATE_KEY);
  if (saved && ['expanded', 'collapsed', 'hidden'].includes(saved)) {
    return saved;
  }
  // Migrate from legacy boolean key
  const legacy = localStorage.getItem(LEGACY_HIDDEN_KEY);
  if (legacy === 'true') {
    localStorage.removeItem(LEGACY_HIDDEN_KEY);
    localStorage.setItem(STATE_KEY, 'hidden');
    return 'hidden';
  }
  return 'expanded';
}

function saveState() {
  localStorage.setItem(STATE_KEY, sidebarState);
}

/** Apply visual state without saving or triggering callbacks */
function applyState(state) {
  sidebarState = state;
  sidebar.classList.remove('collapsed', 'sidebar-hidden');

  if (state === 'collapsed') {
    sidebar.classList.add('collapsed');
    if (floatLogo) floatLogo.classList.remove('visible');
  } else if (state === 'hidden') {
    sidebar.classList.add('sidebar-hidden');
    if (floatLogo) floatLogo.classList.add('visible');
  } else {
    // expanded
    sidebar.style.width = `${widthBeforeHide}px`;
    if (floatLogo) floatLogo.classList.remove('visible');
  }
}

// ── Public state transitions ───────────────────────────────

/** Collapse sidebar to icon strip (expanded → collapsed) */
function collapse() {
  if (!sidebar || sidebarState !== 'expanded') return;
  widthBeforeHide = sidebar.offsetWidth;
  sidebarState = 'collapsed';
  sidebar.classList.remove('sidebar-hidden');
  sidebar.classList.add('collapsed');
  if (floatLogo) floatLogo.classList.remove('visible');
  saveState();
  if (onResizeCallback) onResizeCallback(COLLAPSED_WIDTH);
}

/** Fully hide sidebar, show floating logo */
function hideAll() {
  if (!sidebar || sidebarState === 'hidden') return;
  if (sidebarState === 'expanded') {
    widthBeforeHide = sidebar.offsetWidth;
  }
  sidebarState = 'hidden';
  sidebar.classList.remove('collapsed');
  sidebar.classList.add('sidebar-hidden');
  if (floatLogo) floatLogo.classList.add('visible');
  saveState();
  if (onResizeCallback) onResizeCallback(0);
}

/** Expand sidebar to full width (from any state) */
function expand() {
  if (!sidebar || sidebarState === 'expanded') return;
  sidebarState = 'expanded';
  sidebar.classList.remove('collapsed', 'sidebar-hidden');
  sidebar.style.width = `${widthBeforeHide}px`;
  if (floatLogo) floatLogo.classList.remove('visible');
  saveState();
  if (onResizeCallback) onResizeCallback(widthBeforeHide);
}

/**
 * Quick toggle: expanded ↔ hidden  (Ctrl+B)
 * If currently collapsed, goes to expanded.
 */
function toggle() {
  if (!sidebar) return;
  if (sidebarState === 'expanded') hideAll();
  else expand(); // from collapsed or hidden → expanded
}

// ── Backward-compat public API (used by index.js tab handler) ──

/** hide = collapse when expanded, hideAll when collapsed */
function hide() {
  if (sidebarState === 'expanded') collapse();
  else if (sidebarState === 'collapsed') hideAll();
}

/** show = expand from any non-expanded state */
function show() { expand(); }

/** Returns true when sidebar occupies space (expanded or collapsed) */
function isVisible() {
  return sidebarState !== 'hidden';
}

/** Returns true only when in collapsed icon-strip state */
function isCollapsed() {
  return sidebarState === 'collapsed';
}

// ── Drag resize (only when expanded) ───────────────────────

function handleMouseDown(e) {
  if (sidebarState !== 'expanded') return;
  e.preventDefault();
  isResizing = true;
  startX = e.clientX;
  startWidth = sidebar.offsetWidth;
  resizeHandle.classList.add('dragging');
  document.body.classList.add('sidebar-resizing');
}

function handleMouseMove(e) {
  if (!isResizing) return;
  const deltaX = e.clientX - startX;
  let newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth + deltaX));
  sidebar.style.transition = 'none';
  sidebar.style.width = `${newWidth}px`;
}

function handleMouseUp() {
  if (!isResizing) return;
  isResizing = false;
  resizeHandle.classList.remove('dragging');
  document.body.classList.remove('sidebar-resizing');
  sidebar.style.transition = '';

  const currentWidth = sidebar.offsetWidth;
  localStorage.setItem(STORAGE_KEY, currentWidth.toString());
  widthBeforeHide = currentWidth;
  if (onResizeCallback) onResizeCallback(currentWidth);
}

function resetWidth() {
  sidebar.style.width = `${DEFAULT_WIDTH}px`;
  localStorage.setItem(STORAGE_KEY, DEFAULT_WIDTH.toString());
  widthBeforeHide = DEFAULT_WIDTH;
  if (onResizeCallback) onResizeCallback(DEFAULT_WIDTH);
}

function getWidth() {
  if (!sidebar) return DEFAULT_WIDTH;
  if (sidebarState === 'hidden') return 0;
  if (sidebarState === 'collapsed') return COLLAPSED_WIDTH;
  return sidebar.offsetWidth;
}

function setWidth(width) {
  if (!sidebar || sidebarState !== 'expanded') return;
  const clamped = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, width));
  sidebar.style.width = `${clamped}px`;
  localStorage.setItem(STORAGE_KEY, clamped.toString());
  widthBeforeHide = clamped;
  if (onResizeCallback) onResizeCallback(clamped);
}

module.exports = {
  init,
  getWidth,
  setWidth,
  resetWidth,
  toggle,
  hide,
  show,
  expand,
  collapse,
  hideAll,
  isVisible,
  isCollapsed
};
