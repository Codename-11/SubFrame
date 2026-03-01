/**
 * Cross-platform dev script
 * Runs esbuild in watch mode and Electron concurrently.
 * Works on Windows, macOS, and Linux without extra dependencies.
 */

const { spawn } = require('child_process');
const path = require('path');

const isWin = process.platform === 'win32';
const root = path.resolve(__dirname, '..');

// Resolve local binaries from node_modules
const esbuildBin = path.join(root, 'node_modules', '.bin', isWin ? 'esbuild.cmd' : 'esbuild');
const electronBin = path.join(root, 'node_modules', '.bin', isWin ? 'electron.cmd' : 'electron');

console.log('[dev] Starting esbuild watch + Electron...\n');

// 1. Start esbuild in watch mode
const esbuild = spawn(esbuildBin, [
  'src/renderer/index.js',
  '--bundle',
  '--outfile=dist/renderer.js',
  '--platform=node',
  '--external:electron',
  '--watch'
], { cwd: root, stdio: 'pipe', shell: isWin });

let electronProc = null;

esbuild.stdout.on('data', (data) => {
  const msg = data.toString().trim();
  if (msg) console.log(`[esbuild] ${msg}`);

  // Launch Electron after first successful build
  if (!electronProc && msg.includes('watch mode enabled')) {
    startElectron();
  }
});

esbuild.stderr.on('data', (data) => {
  const msg = data.toString().trim();
  if (msg) console.error(`[esbuild] ${msg}`);

  // esbuild 0.27+ prints the watch message to stderr
  if (!electronProc && msg.includes('watching')) {
    startElectron();
  }
});

// Fallback: start Electron after a short delay if watch message not detected
setTimeout(() => {
  if (!electronProc) {
    console.log('[dev] Starting Electron (timeout fallback)...');
    startElectron();
  }
}, 3000);

function startElectron() {
  console.log('[dev] Starting Electron...\n');

  electronProc = spawn(electronBin, ['.'], {
    cwd: root,
    stdio: 'inherit',
    shell: isWin
  });

  electronProc.on('close', (code) => {
    console.log(`\n[dev] Electron exited (code ${code}). Stopping esbuild...`);
    esbuild.kill();
    process.exit(code || 0);
  });
}

// Clean shutdown
function cleanup() {
  if (electronProc) electronProc.kill();
  esbuild.kill();
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
