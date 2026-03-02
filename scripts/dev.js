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

// Resolve node binary for spawning scripts
const nodeBin = process.execPath;

console.log('[dev] Building main process + starting React watch + Electron...\n');

// 0. Build main process first (fast — ~40ms)
const mainBuild = spawn(esbuildBin, [
  'src/main/index.ts',
  '--bundle',
  '--platform=node',
  '--outdir=dist/main',
  '--external:electron',
  '--external:node-pty',
  '--format=cjs',
  '--sourcemap'
], { cwd: root, stdio: 'inherit', shell: isWin });

mainBuild.on('close', (code) => {
  if (code !== 0) {
    console.error('[dev] Main process build failed');
    process.exit(1);
  }
  console.log('[dev] Main process built.\n');
});

// 1. Start React renderer in watch mode (no shell needed — node.exe is not a .cmd)
const esbuild = spawn(nodeBin, [
  path.join(root, 'scripts', 'build-react.js'),
  '--watch'
], { cwd: root, stdio: 'pipe' });

let electronProc = null;

esbuild.stdout.on('data', (data) => {
  const msg = data.toString().trim();
  if (msg) console.log(`[esbuild] ${msg}`);

  // Launch Electron after first successful build
  if (!electronProc && (msg.includes('watch mode enabled') || msg.includes('Watching'))) {
    startElectron();
  }
});

esbuild.stderr.on('data', (data) => {
  const msg = data.toString().trim();
  if (msg) console.error(`[esbuild] ${msg}`);

  // esbuild 0.27+ prints the watch message to stderr
  if (!electronProc && (msg.includes('watching') || msg.includes('Watching'))) {
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
    shell: isWin,
    env: { ...process.env, ELECTRON_DEV: '1' }
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
