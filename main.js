const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron');
const pty = require('node-pty');
const path = require('path');
const fs = require('fs');

let mainWindow;
let ptyProcess;
let currentProjectPath = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    backgroundColor: '#1e1e1e',
    title: 'Claude Code Terminal'
  });

  mainWindow.loadFile('index.html');

  // Open DevTools for debugging (optional)
  // mainWindow.webContents.openDevTools();

  mainWindow.on('closed', () => {
    if (ptyProcess) {
      ptyProcess.kill();
    }
    mainWindow = null;
  });

  // Create menu
  const menuTemplate = [
    {
      label: 'Claude Commands',
      submenu: [
        {
          label: 'Initialize Project (/init)',
          accelerator: 'CmdOrCtrl+I',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('run-command', '/init');
            }
          }
        },
        {
          label: 'Commit Changes (/commit)',
          accelerator: 'CmdOrCtrl+Shift+C',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('run-command', '/commit');
            }
          }
        },
        {
          label: 'Review PR (/review-pr)',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('run-command', '/review-pr');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Start Claude Code',
          accelerator: 'CmdOrCtrl+K',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('run-command', 'claude');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Toggle Prompt History Panel',
          accelerator: 'CmdOrCtrl+Shift+H',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('toggle-history-panel');
            }
          }
        },
        {
          label: 'Open History File',
          accelerator: 'CmdOrCtrl+H',
          click: () => {
            const { shell } = require('electron');
            const logPath = path.join(app.getPath('userData'), 'prompts-history.txt');

            // Create file if it doesn't exist
            if (!fs.existsSync(logPath)) {
              fs.writeFileSync(logPath, '# Prompt History\n\n', 'utf8');
            }

            // Open file with default text editor
            shell.openPath(logPath);
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
}

// Function to start PTY
function startPTY(workingDir = null) {
  // Kill existing process if any
  if (ptyProcess) {
    ptyProcess.kill();
  }

  // Determine shell based on platform
  let shell;
  if (process.platform === 'win32') {
    // Try PowerShell Core first (pwsh), fallback to Windows PowerShell
    try {
      require('child_process').execSync('where pwsh', { stdio: 'ignore' });
      shell = 'pwsh.exe';
      console.log('Using PowerShell Core (pwsh)');
    } catch {
      shell = 'powershell.exe';
      console.log('Using Windows PowerShell');
    }
  } else {
    // macOS/Linux: use user's default shell or fallback to zsh/bash
    shell = process.env.SHELL || '/bin/zsh';
    console.log('Using shell:', shell);
  }

  // Use provided working dir or fallback to home
  const cwd = workingDir || currentProjectPath || process.env.HOME || process.env.USERPROFILE;

  // Spawn PTY with interactive and login flags
  const shellArgs = process.platform === 'win32' ? [] : ['-i', '-l'];

  ptyProcess = pty.spawn(shell, shellArgs, {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd: cwd,
    env: {
      ...process.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor'
    }
  });

  // Send PTY output to renderer
  ptyProcess.onData((data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('terminal-output', data);
    }
  });

  // Handle PTY exit
  ptyProcess.onExit(({ exitCode, signal }) => {
    console.log('PTY exited:', exitCode, signal);
  });
}

// Start PTY when renderer is ready
ipcMain.on('start-terminal', (event) => {
  startPTY();
});

// Restart terminal with new working directory
ipcMain.on('restart-terminal', (event, projectPath) => {
  currentProjectPath = projectPath;
  startPTY(projectPath);
});

// Select project folder dialog
ipcMain.on('select-project-folder', async (event) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Project Folder'
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const selectedPath = result.filePaths[0];
    currentProjectPath = selectedPath;
    event.sender.send('project-selected', selectedPath);
  }
});

// Create new project dialog
ipcMain.on('create-new-project', async (event) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Select Location for New Project',
    buttonLabel: 'Create Project Here'
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const selectedPath = result.filePaths[0];

    // Optionally create a project folder
    // For now, just use the selected directory
    currentProjectPath = selectedPath;
    event.sender.send('project-selected', selectedPath);
  }
});

// Load file tree
function getFileTree(dirPath, maxDepth = 5, currentDepth = 0) {
  if (currentDepth >= maxDepth) return [];

  try {
    const items = fs.readdirSync(dirPath, { withFileTypes: true });
    const files = [];

    // Sort: directories first, then files
    items.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    for (const item of items) {
      // Skip hidden files and node_modules
      if (item.name.startsWith('.') || item.name === 'node_modules') continue;

      const fullPath = path.join(dirPath, item.name);
      const fileInfo = {
        name: item.name,
        path: fullPath,
        isDirectory: item.isDirectory()
      };

      // Recursively get children for directories
      if (item.isDirectory()) {
        fileInfo.children = getFileTree(fullPath, maxDepth, currentDepth + 1);
      }

      files.push(fileInfo);
    }

    return files;
  } catch (err) {
    console.error('Error reading directory:', err);
    return [];
  }
}

ipcMain.on('load-file-tree', (event, projectPath) => {
  const files = getFileTree(projectPath);
  event.sender.send('file-tree-data', files);
});

// Input buffer for logging
let inputBuffer = '';
const logFilePath = path.join(app.getPath('userData'), 'prompts-history.txt');

// Load prompt history
ipcMain.on('load-prompt-history', (event) => {
  try {
    if (fs.existsSync(logFilePath)) {
      const data = fs.readFileSync(logFilePath, 'utf8');
      event.sender.send('prompt-history-data', data);
    } else {
      event.sender.send('prompt-history-data', '');
    }
  } catch (err) {
    console.error('Error reading prompt history:', err);
    event.sender.send('prompt-history-data', '');
  }
});

// Receive input from renderer and send to PTY
ipcMain.on('terminal-input', (event, data) => {
  if (ptyProcess) {
    ptyProcess.write(data);

    // Log input to file
    for (let char of data) {
      if (char === '\r' || char === '\n') {
        // Enter pressed - save the line
        if (inputBuffer.trim().length > 0) {
          const timestamp = new Date().toISOString();
          const logEntry = `[${timestamp}] ${inputBuffer}\n`;
          fs.appendFileSync(logFilePath, logEntry, 'utf8');
        }
        inputBuffer = '';
      } else if (char === '\x7f' || char === '\b') {
        // Backspace - remove last char
        inputBuffer = inputBuffer.slice(0, -1);
      } else if (char >= ' ' && char <= '~') {
        // Printable character
        inputBuffer += char;
      }
    }
  }
});

// Handle terminal resize
ipcMain.on('terminal-resize', (event, { cols, rows }) => {
  if (ptyProcess) {
    ptyProcess.resize(cols, rows);
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
