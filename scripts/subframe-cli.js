#!/usr/bin/env node
/**
 * SubFrame CLI — opens files, projects, and initializes workspaces.
 *
 * Usage:
 *   subframe                    Launch SubFrame (or show status if not found)
 *   subframe init [path]        Initialize a SubFrame project
 *   subframe edit <file>        Open file in editor
 *   subframe open <dir>         Open directory as project
 *   subframe <path>             Auto-detect file or directory
 *   subframe .                  Open current directory as project
 *   subframe --help             Show usage information
 *   subframe --version          Show version
 */

const { execSync, spawn, fork } = require('child_process');
const path = require('path');
const fs = require('fs');

// ─── ANSI colors (zero dependencies) ────────────────────────────────

const useColor = !process.argv.includes('--no-color') && !process.env.NO_COLOR && process.stdout.isTTY !== false;
const c = {
  bold:    s => useColor ? `\x1b[1m${s}\x1b[22m` : s,
  dim:     s => useColor ? `\x1b[2m${s}\x1b[22m` : s,
  green:   s => useColor ? `\x1b[32m${s}\x1b[39m` : s,
  yellow:  s => useColor ? `\x1b[33m${s}\x1b[39m` : s,
  cyan:    s => useColor ? `\x1b[36m${s}\x1b[39m` : s,
  magenta: s => useColor ? `\x1b[35m${s}\x1b[39m` : s,
  red:     s => useColor ? `\x1b[31m${s}\x1b[39m` : s,
  gray:    s => useColor ? `\x1b[90m${s}\x1b[39m` : s,
};

const SYM = {
  dot:   useColor ? c.green('●') : '*',
  arrow: useColor ? c.magenta('❯') : '>',
};

function getVersion() {
  try {
    const pkgPath = path.join(__dirname, '..', 'package.json');
    return JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version;
  } catch {
    return '0.0.0';
  }
}

// ─── Argument handling ──────────────────────────────────────────────

const args = process.argv.slice(2);
const command = args[0] || '';

// --version
if (command === '--version' || command === '-v') {
  console.log(`SubFrame v${getVersion()}`);
  process.exit(0);
}

// --help (no args)
if (args.length === 0 || command === '--help' || command === '-h') {
  const v = getVersion();
  console.log('');
  console.log(`  ${c.bold('SubFrame')} ${c.dim(`v${v}`)} ${c.dim('— Terminal-First IDE for AI Coding Tools')}`);
  console.log('');
  console.log(`  ${c.bold('Usage:')}`);
  console.log(`    ${c.cyan('subframe')}                    Launch SubFrame`);
  console.log(`    ${c.cyan('subframe init')} ${c.dim('[path]')}        Initialize a SubFrame project`);
  console.log(`    ${c.cyan('subframe edit')} ${c.dim('<file>')}        Open file in the editor`);
  console.log(`    ${c.cyan('subframe open')} ${c.dim('<dir>')}         Open directory as project`);
  console.log(`    ${c.cyan('subframe')} ${c.dim('<path>')}             Auto-detect: file or directory`);
  console.log(`    ${c.cyan('subframe .')}                  Open current directory`);
  console.log('');
  console.log(`  ${c.bold('Options:')}`);
  console.log(`    ${c.cyan('--help, -h')}               Show this help message`);
  console.log(`    ${c.cyan('--version, -v')}            Show version`);
  console.log('');
  console.log(`  ${c.bold('Examples:')}`);
  console.log(`    ${c.dim('$')} subframe init my-project`);
  console.log(`    ${c.dim('$')} subframe edit src/index.ts`);
  console.log(`    ${c.dim('$')} subframe .`);
  console.log('');

  // If no args, also try to launch SubFrame
  if (args.length === 0) {
    launchSubFrame([]);
  }
  process.exit(0);
}

// ─── Init command — delegate to init.js ─────────────────────────────

if (command === 'init') {
  const initScript = path.join(__dirname, 'init.js');
  if (!fs.existsSync(initScript)) {
    console.error(`  ${c.red('✗')} Could not find init script at: ${initScript}`);
    process.exit(1);
  }

  // Fork init.js, passing all args (init.js will skip the 'init' keyword)
  const child = fork(initScript, args, { stdio: 'inherit' });
  child.on('exit', (code, signal) => {
    if (signal) process.exit(1);
    process.exit(code ?? 0);
  });
  child.on('error', err => {
    console.error(`  ${c.red('✗')} Could not start init: ${err.message}`);
    process.exit(1);
  });
  return;
}

// ─── Launch SubFrame (edit/open/path) ───────────────────────────────

const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';

/**
 * Try to find the SubFrame executable path.
 * Checks common install locations for each platform.
 */
function findSubFrame() {
  if (isWin) {
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
    try {
      const result = execSync('which subframe 2>/dev/null', { encoding: 'utf8' }).trim();
      if (result) return result;
    } catch { /* not found on PATH */ }
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

function launchSubFrame(launchArgs) {
  const subframePath = findSubFrame();

  if (!subframePath) {
    console.log('');
    console.log(`  ${c.yellow('⚠')} Could not find SubFrame installation.`);
    console.log(`  ${c.dim('Download from:')} ${c.cyan('https://github.com/Codename-11/SubFrame/releases')}`);
    console.log('');
    return;
  }

  try {
    if (isWin) {
      spawn(subframePath, launchArgs, { detached: true, stdio: 'ignore' }).unref();
    } else if (isMac) {
      spawn('open', ['-a', 'SubFrame', '--args', ...launchArgs], { detached: true, stdio: 'ignore' }).unref();
    } else {
      spawn(subframePath, launchArgs, { detached: true, stdio: 'ignore' }).unref();
    }
  } catch {
    console.error(`  ${c.red('✗')} Could not launch SubFrame. Is it installed?`);
    process.exit(1);
  }
}

launchSubFrame(args);
