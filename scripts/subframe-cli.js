#!/usr/bin/env node
/**
 * SubFrame CLI — opens files and projects in SubFrame.
 *
 * Usage:
 *   subframe edit <file>     Open file in editor
 *   subframe open <dir>      Open directory as project
 *   subframe <path>          Auto-detect file or directory
 *   subframe .               Open current directory as project
 *   subframe --help          Show usage information
 */

const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  console.log(`
SubFrame CLI — Open files and projects in SubFrame

Usage:
  subframe edit <file>     Open a file in the SubFrame editor
  subframe open <dir>      Open a directory as a project
  subframe <path>          Auto-detect: open as file or project
  subframe .               Open current directory as project
  subframe --help          Show this help message

Examples:
  subframe .
  subframe edit src/main/index.ts
  subframe open ~/projects/my-app
  subframe /path/to/file.ts
`);
  process.exit(0);
}

const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';

/**
 * Try to find the SubFrame executable path.
 * Checks common install locations for each platform.
 */
function findSubFrame() {
  if (isWin) {
    // Check common Windows install paths
    const candidates = [
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'SubFrame', 'SubFrame.exe'),
      path.join(process.env.PROGRAMFILES || '', 'SubFrame', 'SubFrame.exe'),
      path.join(process.env['PROGRAMFILES(X86)'] || '', 'SubFrame', 'SubFrame.exe'),
    ];
    for (const candidate of candidates) {
      if (candidate && fs.existsSync(candidate)) return candidate;
    }
  } else if (isMac) {
    const macPath = '/Applications/SubFrame.app/Contents/MacOS/SubFrame';
    if (fs.existsSync(macPath)) return macPath;
  } else {
    // Linux — check PATH
    try {
      const result = execSync('which subframe 2>/dev/null', { encoding: 'utf8' }).trim();
      if (result) return result;
    } catch { /* not found on PATH */ }
    // Check common Linux install paths
    const linuxCandidates = [
      '/usr/local/bin/subframe',
      '/usr/bin/subframe',
      path.join(process.env.HOME || '', '.local', 'bin', 'subframe'),
    ];
    for (const candidate of linuxCandidates) {
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return null;
}

const subframePath = findSubFrame();

if (!subframePath) {
  console.error('Could not find SubFrame installation.');
  console.error('Make sure SubFrame is installed and accessible.');
  process.exit(1);
}

// Build the arguments to pass to SubFrame
// The Electron app will parse these via handleCLIArgs / second-instance handler
try {
  if (isWin) {
    spawn(subframePath, args, { detached: true, stdio: 'ignore' }).unref();
  } else if (isMac) {
    // Use 'open' to properly launch the .app bundle
    spawn('open', ['-a', 'SubFrame', '--args', ...args], { detached: true, stdio: 'ignore' }).unref();
  } else {
    spawn(subframePath, args, { detached: true, stdio: 'ignore' }).unref();
  }
} catch {
  console.error('Could not launch SubFrame. Is it installed?');
  process.exit(1);
}
