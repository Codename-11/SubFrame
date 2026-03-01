/**
 * Backlink Utilities
 * Manages backlink blocks in native AI instruction files (CLAUDE.md, GEMINI.md)
 * Backlinks reference AGENTS.md without replacing user content
 */

const fs = require('fs');
const path = require('path');

const BACKLINK_START = '<!-- SUBFRAME:BEGIN -->';
const BACKLINK_END = '<!-- SUBFRAME:END -->';

/**
 * Get the full backlink block to inject into native AI files
 * @param {object} [options] - Custom backlink content options
 * @param {string[]} [options.additionalRefs] - Additional markdown lines to include in the block
 * @param {string} [options.customMessage] - Custom message to replace the default text
 * @returns {string}
 */
function getBacklinkBlock(options) {
  const defaultMessage = '> **[SubFrame Project]** — Read [AGENTS.md](./AGENTS.md) for project instructions, task management rules, and context preservation guidelines.';
  const message = (options && options.customMessage) ? options.customMessage : defaultMessage;

  let lines = [BACKLINK_START, message];
  if (options && options.additionalRefs && options.additionalRefs.length > 0) {
    for (const ref of options.additionalRefs) {
      if (ref.trim()) lines.push(ref);
    }
  }
  lines.push(BACKLINK_END);
  return lines.join('\n');
}

/**
 * Check if a file already contains the backlink marker
 * @param {string} filePath - Absolute path to the file
 * @returns {boolean}
 */
function hasBacklink(filePath) {
  try {
    if (!fs.existsSync(filePath)) return false;
    const content = fs.readFileSync(filePath, 'utf8');
    return content.includes(BACKLINK_START);
  } catch (err) {
    console.error('Error checking backlink:', err);
    return false;
  }
}

/**
 * Inject backlink block at the top of a file (idempotent)
 * If file doesn't exist, creates it with the block only.
 * If file exists but has no backlink, prepends the block.
 * @param {string} filePath - Absolute path to the file
 * @param {object} [options] - Custom backlink content options (passed to getBacklinkBlock)
 * @returns {boolean} Whether the operation succeeded
 */
function injectBacklink(filePath, options) {
  try {
    const block = getBacklinkBlock(options);

    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, block + '\n', 'utf8');
      return true;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes(BACKLINK_START)) {
      return true; // Already has backlink
    }

    fs.writeFileSync(filePath, block + '\n\n' + content, 'utf8');
    return true;
  } catch (err) {
    console.error('Error injecting backlink:', err);
    return false;
  }
}

/**
 * Update an existing backlink block in a file (replace in-place)
 * If no backlink exists, injects one at the top instead.
 * @param {string} filePath - Absolute path to the file
 * @param {object} [options] - Custom backlink content options (passed to getBacklinkBlock)
 * @returns {boolean} Whether the operation succeeded
 */
function updateBacklink(filePath, options) {
  try {
    if (!fs.existsSync(filePath)) {
      return injectBacklink(filePath, options);
    }

    const content = fs.readFileSync(filePath, 'utf8');
    if (!content.includes(BACKLINK_START)) {
      return injectBacklink(filePath, options);
    }

    const startIdx = content.indexOf(BACKLINK_START);
    const endIdx = content.indexOf(BACKLINK_END);
    if (startIdx === -1 || endIdx === -1) {
      return injectBacklink(filePath, options);
    }

    const before = content.substring(0, startIdx);
    const after = content.substring(endIdx + BACKLINK_END.length);
    const block = getBacklinkBlock(options);
    fs.writeFileSync(filePath, before + block + after, 'utf8');
    return true;
  } catch (err) {
    console.error('Error updating backlink:', err);
    return false;
  }
}

/**
 * Remove the backlink block from a file, preserving all other content
 * @param {string} filePath - Absolute path to the file
 * @returns {boolean} Whether the operation succeeded
 */
function removeBacklink(filePath) {
  try {
    if (!fs.existsSync(filePath)) return true;

    const content = fs.readFileSync(filePath, 'utf8');
    if (!content.includes(BACKLINK_START)) {
      return true; // No backlink to remove
    }

    const startIdx = content.indexOf(BACKLINK_START);
    const endIdx = content.indexOf(BACKLINK_END);
    if (startIdx === -1 || endIdx === -1) return true;

    const before = content.substring(0, startIdx);
    const after = content.substring(endIdx + BACKLINK_END.length);

    // Clean up leading/trailing whitespace from the splice
    let result = before + after;
    // Remove leading newlines left behind
    result = result.replace(/^\n+/, '');

    fs.writeFileSync(filePath, result, 'utf8');
    return true;
  } catch (err) {
    console.error('Error removing backlink:', err);
    return false;
  }
}

/**
 * Check if a file is a symlink
 * @param {string} filePath - Absolute path to the file
 * @returns {boolean}
 */
function isSymlinkFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return false;
    const stats = fs.lstatSync(filePath);
    return stats.isSymbolicLink();
  } catch (err) {
    return false;
  }
}

/**
 * Get the status of a native AI file (CLAUDE.md, GEMINI.md)
 * @param {string} projectPath - Project root path
 * @param {string} filename - File name (e.g. 'CLAUDE.md')
 * @returns {{ exists: boolean, isSymlink: boolean, hasBacklink: boolean, hasUserContent: boolean }}
 */
function getNativeFileStatus(projectPath, filename) {
  const filePath = path.join(projectPath, filename);
  const status = {
    exists: false,
    isSymlink: false,
    hasBacklink: false,
    hasUserContent: false
  };

  try {
    if (!fs.existsSync(filePath)) return status;

    status.exists = true;
    status.isSymlink = isSymlinkFile(filePath);

    if (status.isSymlink) return status;

    const content = fs.readFileSync(filePath, 'utf8');
    status.hasBacklink = content.includes(BACKLINK_START);

    // Check if there's content outside the markers
    if (status.hasBacklink) {
      const startIdx = content.indexOf(BACKLINK_START);
      const endIdx = content.indexOf(BACKLINK_END);
      if (startIdx !== -1 && endIdx !== -1) {
        const before = content.substring(0, startIdx).trim();
        const after = content.substring(endIdx + BACKLINK_END.length).trim();
        status.hasUserContent = before.length > 0 || after.length > 0;
      }
    } else {
      // No backlink — any content is user content
      status.hasUserContent = content.trim().length > 0;
    }
  } catch (err) {
    console.error(`Error getting status for ${filename}:`, err);
  }

  return status;
}

/**
 * Get the status of Claude Code's native .claude/ directory
 * SubFrame never modifies this directory — it belongs to Claude Code.
 * This is read-only detection for user awareness in the AI Files panel.
 * @param {string} projectPath - Project root path
 * @returns {{ exists: boolean, hasConfig: boolean, hasMemory: boolean, hasProjects: boolean }}
 */
function getClaudeNativeStatus(projectPath) {
  const claudeDir = path.join(projectPath, '.claude');
  const status = {
    exists: false,
    hasConfig: false,
    hasMemory: false,
    hasProjects: false
  };

  try {
    if (!fs.existsSync(claudeDir)) return status;

    const stats = fs.statSync(claudeDir);
    if (!stats.isDirectory()) return status;

    status.exists = true;
    status.hasConfig = fs.existsSync(path.join(claudeDir, 'settings.json'));
    status.hasMemory = fs.existsSync(path.join(claudeDir, 'memory.md'));
    status.hasProjects = fs.existsSync(path.join(claudeDir, 'projects'));
  } catch (err) {
    console.error('Error checking .claude/ directory:', err);
  }

  return status;
}

/**
 * Extract the backlink target path from a file's backlink block
 * Parses the markdown link inside the SUBFRAME markers to find the referenced file
 * @param {string} filePath - Absolute path to the file
 * @returns {string|null} Relative path from the backlink, or null if not found
 */
function getBacklinkTarget(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, 'utf8');
    const startIdx = content.indexOf(BACKLINK_START);
    const endIdx = content.indexOf(BACKLINK_END);
    if (startIdx === -1 || endIdx === -1) return null;

    const block = content.substring(startIdx, endIdx + BACKLINK_END.length);
    // Match markdown link pattern: [text](./path)
    const linkMatch = block.match(/\[.*?\]\(\.\/(.*?)\)/);
    return linkMatch ? linkMatch[1] : null;
  } catch (err) {
    console.error('Error reading backlink target:', err);
    return null;
  }
}

/**
 * Verify a single native AI file's backlink status
 * @param {string} projectPath
 * @param {string} filename
 * @returns {{ exists: boolean, isSymlink: boolean, hasBacklink: boolean, backlinkValid: boolean, backlinkTarget: string|null }}
 */
function verifyNativeFile(projectPath, filename) {
  const filePath = path.join(projectPath, filename);
  const status = {
    exists: false,
    isSymlink: false,
    hasBacklink: false,
    backlinkValid: false,
    backlinkTarget: null
  };

  try {
    if (!fs.existsSync(filePath)) return status;

    status.exists = true;
    status.isSymlink = isSymlinkFile(filePath);

    if (status.isSymlink) return status;

    const content = fs.readFileSync(filePath, 'utf8');
    status.hasBacklink = content.includes(BACKLINK_START);

    if (status.hasBacklink) {
      const target = getBacklinkTarget(filePath);
      status.backlinkTarget = target;
      if (target) {
        const targetPath = path.join(projectPath, target);
        status.backlinkValid = fs.existsSync(targetPath);
      }
    }
  } catch (err) {
    console.error(`Error verifying ${filename}:`, err);
  }

  return status;
}

/**
 * Collect issues for a native AI file and push them to the result
 */
function collectNativeFileIssues(result, filename, fileStatus) {
  if (!fileStatus.exists) {
    result.issues.push({
      file: filename,
      issue: 'missing',
      severity: 'info',
      suggestion: `Create ${filename} with a backlink to AGENTS.md`
    });
    return;
  }

  if (fileStatus.isSymlink) {
    result.issues.push({
      file: filename,
      issue: 'legacy-symlink',
      severity: 'warning',
      suggestion: `${filename} is a legacy symlink. Migrate it to a real file with a backlink.`
    });
    return;
  }

  if (!fileStatus.hasBacklink) {
    result.issues.push({
      file: filename,
      issue: 'no-backlink',
      severity: 'warning',
      suggestion: `${filename} exists but has no SubFrame backlink. Inject a backlink to connect it to AGENTS.md.`
    });
    return;
  }

  if (!fileStatus.backlinkValid) {
    result.issues.push({
      file: filename,
      issue: 'broken-backlink',
      severity: 'error',
      suggestion: `${filename} has a backlink pointing to ${fileStatus.backlinkTarget || 'unknown'}, but the target file does not exist.`
    });
  }
}

/**
 * Verify backlink health for all AI files in a project
 * Checks AGENTS.md existence, native file backlinks, and target validity
 * @param {string} projectPath - Project root path
 * @returns {{ agents: object, claude: object, gemini: object, issues: Array }}
 */
function verifyBacklinks(projectPath) {
  const agentsPath = path.join(projectPath, 'AGENTS.md');
  const agentsExists = fs.existsSync(agentsPath);

  const result = {
    agents: { exists: agentsExists },
    claude: verifyNativeFile(projectPath, 'CLAUDE.md'),
    gemini: verifyNativeFile(projectPath, 'GEMINI.md'),
    issues: []
  };

  // Collect issues
  if (!agentsExists) {
    result.issues.push({
      file: 'AGENTS.md',
      issue: 'missing',
      severity: 'error',
      suggestion: 'AGENTS.md is missing. Backlinks in other files reference it. Re-initialize the project or create AGENTS.md.'
    });
  }

  collectNativeFileIssues(result, 'CLAUDE.md', result.claude);
  collectNativeFileIssues(result, 'GEMINI.md', result.gemini);

  return result;
}

module.exports = {
  BACKLINK_START,
  BACKLINK_END,
  getBacklinkBlock,
  hasBacklink,
  injectBacklink,
  updateBacklink,
  removeBacklink,
  isSymlinkFile,
  getNativeFileStatus,
  getClaudeNativeStatus,
  getBacklinkTarget,
  verifyBacklinks
};
