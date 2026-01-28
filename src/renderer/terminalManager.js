/**
 * Terminal Manager Module
 * Manages multiple terminal instances in the renderer
 */

const { ipcRenderer } = require('electron');
const { Terminal } = require('xterm');
const { FitAddon } = require('xterm-addon-fit');
const { IPC } = require('../shared/ipcChannels');

// Terminal theme (VS Code dark)
const terminalTheme = {
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
};

class TerminalManager {
  constructor() {
    this.terminals = new Map(); // Map<id, {terminal, fitAddon, element, state}>
    this.activeTerminalId = null;
    this.viewMode = 'tabs'; // 'tabs' or 'grid'
    this.gridLayout = '2x2';
    this.maxTerminals = 9;
    this.terminalCounter = 0;
    this.onStateChange = null;
    this._setupIPC();
  }

  /**
   * Create a new terminal
   */
  async createTerminal(options = {}) {
    if (this.terminals.size >= this.maxTerminals) {
      console.error('Maximum terminal limit reached');
      return null;
    }

    return new Promise((resolve, reject) => {
      const handler = (event, response) => {
        ipcRenderer.removeListener(IPC.TERMINAL_CREATED, handler);
        if (response.success) {
          this._initializeTerminal(response.terminalId, options);
          resolve(response.terminalId);
        } else {
          reject(new Error(response.error));
        }
      };

      ipcRenderer.on(IPC.TERMINAL_CREATED, handler);
      ipcRenderer.send(IPC.TERMINAL_CREATE, options.cwd || null);
    });
  }

  /**
   * Initialize xterm.js instance for a terminal
   */
  _initializeTerminal(terminalId, options) {
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Consolas, "Courier New", monospace',
      theme: terminalTheme,
      allowTransparency: false,
      scrollback: 10000
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    // Create container element
    const element = document.createElement('div');
    element.id = `terminal-${terminalId}`;
    element.className = 'terminal-instance';
    element.style.height = '100%';
    element.style.width = '100%';

    // Focus terminal on click anywhere in the container
    element.addEventListener('click', () => {
      terminal.focus();
    });

    const state = {
      id: terminalId,
      name: options.name || `Terminal ${++this.terminalCounter}`,
      customName: null,
      isActive: false,
      createdAt: Date.now()
    };

    this.terminals.set(terminalId, { terminal, fitAddon, element, state });

    // Allow app-level shortcuts to pass through when terminal has focus
    terminal.attachCustomKeyEventHandler((event) => {
      const modKey = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      // Ctrl/Cmd + Shift combinations → pass to app
      if (modKey && event.shiftKey) {
        return false;
      }
      // Ctrl/Cmd + 1-9 → pass to app
      if (modKey && event.key >= '1' && event.key <= '9') {
        return false;
      }
      // Ctrl/Cmd + K (Start Claude) → pass to app
      if (modKey && key === 'k') {
        return false;
      }
      // Ctrl/Cmd + I (/init) → pass to app
      if (modKey && key === 'i') {
        return false;
      }
      // Ctrl/Cmd + H (history) → pass to app
      if (modKey && key === 'h') {
        return false;
      }
      // Ctrl/Cmd + Tab → pass to app
      if (modKey && event.key === 'Tab') {
        return false;
      }
      // Let terminal handle everything else
      return true;
    });

    // Handle input
    terminal.onData((data) => {
      ipcRenderer.send(IPC.TERMINAL_INPUT_ID, { terminalId, data });
    });

    // If first terminal or no active terminal, make it active
    if (this.terminals.size === 1 || !this.activeTerminalId) {
      this.setActiveTerminal(terminalId);
    }

    this._notifyStateChange();
    return terminalId;
  }

  /**
   * Mount terminal in a container
   */
  mountTerminal(terminalId, container) {
    const instance = this.terminals.get(terminalId);
    if (instance && container) {
      // Clear container first
      container.innerHTML = '';

      // Ensure element has proper sizing
      instance.element.style.height = '100%';
      instance.element.style.width = '100%';

      container.appendChild(instance.element);

      // Open terminal if not already opened
      if (!instance.opened) {
        instance.terminal.open(instance.element);
        instance.opened = true;
      }

      // Fit after a short delay to ensure container is sized
      setTimeout(() => {
        instance.fitAddon.fit();
        this._sendResize(terminalId);
        // Focus if this is the active terminal
        if (this.activeTerminalId === terminalId) {
          instance.terminal.focus();
        }
      }, 50);
    }
  }

  /**
   * Set active terminal
   */
  setActiveTerminal(terminalId) {
    // Update previous active
    if (this.activeTerminalId) {
      const prev = this.terminals.get(this.activeTerminalId);
      if (prev) prev.state.isActive = false;
    }

    // Set new active
    this.activeTerminalId = terminalId;
    const current = this.terminals.get(terminalId);
    if (current) {
      current.state.isActive = true;
      current.terminal.focus();
    }

    this._notifyStateChange();
  }

  /**
   * Rename terminal
   */
  renameTerminal(terminalId, newName) {
    const instance = this.terminals.get(terminalId);
    if (instance) {
      instance.state.customName = newName;
      instance.state.name = newName;
      this._notifyStateChange();
    }
  }

  /**
   * Close terminal
   */
  closeTerminal(terminalId) {
    const instance = this.terminals.get(terminalId);
    if (instance) {
      instance.terminal.dispose();
      instance.element.remove();
      this.terminals.delete(terminalId);
      ipcRenderer.send(IPC.TERMINAL_DESTROY, terminalId);

      // Switch to another terminal if closing active
      if (this.activeTerminalId === terminalId) {
        const remaining = Array.from(this.terminals.keys());
        this.activeTerminalId = remaining.length > 0 ? remaining[remaining.length - 1] : null;
        if (this.activeTerminalId) {
          this.setActiveTerminal(this.activeTerminalId);
        }
      }

      this._notifyStateChange();
    }
  }

  /**
   * Set view mode
   */
  setViewMode(mode) {
    this.viewMode = mode;
    this._notifyStateChange();
  }

  /**
   * Set grid layout
   */
  setGridLayout(layout) {
    this.gridLayout = layout;
    this._notifyStateChange();
  }

  /**
   * Get all terminal states
   */
  getTerminalStates() {
    return Array.from(this.terminals.values())
      .map(t => ({ ...t.state }))
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  /**
   * Get terminal instance
   */
  getTerminal(terminalId) {
    return this.terminals.get(terminalId);
  }

  /**
   * Fit all terminals
   */
  fitAll() {
    for (const [id, instance] of this.terminals) {
      if (instance.opened) {
        instance.fitAddon.fit();
        this._sendResize(id);
      }
    }
  }

  /**
   * Fit specific terminal
   */
  fitTerminal(terminalId) {
    const instance = this.terminals.get(terminalId);
    if (instance && instance.opened) {
      instance.fitAddon.fit();
      this._sendResize(terminalId);
    }
  }

  /**
   * Write to active terminal
   */
  writeToActive(data) {
    if (this.activeTerminalId) {
      const instance = this.terminals.get(this.activeTerminalId);
      if (instance) {
        instance.terminal.write(data);
      }
    }
  }

  /**
   * Send command to active terminal
   */
  sendCommand(command) {
    if (this.activeTerminalId) {
      ipcRenderer.send(IPC.TERMINAL_INPUT_ID, {
        terminalId: this.activeTerminalId,
        data: command + '\r'
      });
    }
  }

  // Private methods
  _sendResize(terminalId) {
    const instance = this.terminals.get(terminalId);
    if (instance) {
      ipcRenderer.send(IPC.TERMINAL_RESIZE_ID, {
        terminalId,
        cols: instance.terminal.cols,
        rows: instance.terminal.rows
      });
    }
  }

  _notifyStateChange() {
    if (this.onStateChange) {
      this.onStateChange({
        terminals: this.getTerminalStates(),
        activeTerminalId: this.activeTerminalId,
        viewMode: this.viewMode,
        gridLayout: this.gridLayout
      });
    }
  }

  _setupIPC() {
    // Receive output from specific terminal
    ipcRenderer.on(IPC.TERMINAL_OUTPUT_ID, (event, { terminalId, data }) => {
      const instance = this.terminals.get(terminalId);
      if (instance) {
        instance.terminal.write(data);
      }
    });

    // Handle terminal destroyed from main process
    ipcRenderer.on(IPC.TERMINAL_DESTROYED, (event, { terminalId }) => {
      if (this.terminals.has(terminalId)) {
        this.closeTerminal(terminalId);
      }
    });
  }
}

module.exports = { TerminalManager };
