/**
 * File Tree Module
 * Generates directory tree structure
 */

const fs = require('fs');
const path = require('path');
const { IPC } = require('../shared/ipcChannels');

/**
 * Get file tree for a directory
 * @param {string} dirPath - Directory path
 * @param {number} maxDepth - Maximum depth to traverse
 * @param {number} currentDepth - Current depth level
 * @returns {Array} File tree structure
 */
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

/**
 * Setup IPC handlers
 */
function setupIPC(ipcMain) {
  ipcMain.on(IPC.LOAD_FILE_TREE, (event, projectPath) => {
    const files = getFileTree(projectPath);
    event.sender.send(IPC.FILE_TREE_DATA, files);
  });
}

module.exports = {
  getFileTree,
  setupIPC
};
