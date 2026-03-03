/**
 * Cross-platform dev script with full hot-reload
 *
 * - Main process:     esbuild watch → auto-restart Electron on change
 * - Renderer process: esbuild watch → Electron reloads via fs.watch (see index.ts)
 *
 * Works on Windows, macOS, and Linux without extra dependencies.
 */

const { spawn } = require('child_process');
const path = require('path');
const esbuild = require('esbuild');

const isWin = process.platform === 'win32';
const root = path.resolve(__dirname, '..');

// Resolve local binaries
const electronBin = path.join(root, 'node_modules', '.bin', isWin ? 'electron.cmd' : 'electron');
const nodeBin = process.execPath;

let electronProc = null;
let rendererCtx = null;
let mainCtx = null;
let isRestarting = false;
let shuttingDown = false;

// ── Electron launcher / restarter ────────────────────────────────────

function startElectron() {
  if (shuttingDown) return;

  console.log('[dev] Starting Electron...\n');
  electronProc = spawn(electronBin, ['.'], {
    cwd: root,
    stdio: 'inherit',
    shell: isWin,
    env: { ...process.env, ELECTRON_DEV: '1' },
  });

  electronProc.on('close', (code) => {
    electronProc = null;
    if (isRestarting) {
      // Restarting due to main process rebuild — relaunch
      isRestarting = false;
      startElectron();
    } else {
      // User closed the window — shut everything down
      console.log(`\n[dev] Electron exited (code ${code}). Stopping watchers...`);
      cleanup();
    }
  });
}

function restartElectron() {
  if (shuttingDown) return;

  if (electronProc) {
    console.log('[dev] Main process changed — restarting Electron...');
    isRestarting = true;
    // On Windows, spawned .cmd processes need taskkill; kill() may not work
    if (isWin) {
      spawn('taskkill', ['/pid', String(electronProc.pid), '/T', '/F'], {
        stdio: 'ignore',
      });
    } else {
      electronProc.kill();
    }
  } else {
    startElectron();
  }
}

// ── esbuild plugin: triggers Electron restart after main rebuilds ────

function mainRebuildPlugin() {
  let isFirstBuild = true;
  return {
    name: 'main-rebuild',
    setup(build) {
      build.onEnd((result) => {
        if (result.errors.length > 0) {
          console.error('[dev:main] Build failed — not restarting');
          return;
        }
        if (isFirstBuild) {
          isFirstBuild = false;
          console.log('[dev:main] Initial build complete.');
          return; // Don't restart — Electron hasn't launched yet
        }
        console.log('[dev:main] Rebuild complete.');
        restartElectron();
      });
    },
  };
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  console.log('[dev] Starting dev environment (main watch + renderer watch + Electron)...\n');

  // 1. Start main process watcher (esbuild API — same options as build:main)
  mainCtx = await esbuild.context({
    entryPoints: [path.resolve(root, 'src/main/index.ts')],
    bundle: true,
    platform: 'node',
    outdir: path.resolve(root, 'dist/main'),
    external: ['electron', 'node-pty', 'electron-updater'],
    format: 'cjs',
    sourcemap: true,
    logLevel: 'warning',
    plugins: [mainRebuildPlugin()],
  });
  await mainCtx.watch();
  console.log('[dev:main] Watching src/main/**\n');

  // 2. Start renderer watcher (spawns build-react.js --watch as a child)
  const rendererProc = spawn(
    nodeBin,
    [path.join(root, 'scripts', 'build-react.js'), '--watch'],
    { cwd: root, stdio: 'pipe' },
  );

  rendererProc.stdout.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg) console.log(`[dev:renderer] ${msg}`);

    // Launch Electron after renderer's first build
    if (!electronProc && !isRestarting && (msg.includes('Watching') || msg.includes('watch'))) {
      startElectron();
    }
  });

  rendererProc.stderr.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg) console.error(`[dev:renderer] ${msg}`);

    // esbuild 0.27+ prints watch message to stderr
    if (!electronProc && !isRestarting && (msg.includes('watching') || msg.includes('Watching'))) {
      startElectron();
    }
  });

  // Fallback: start Electron after a short delay if watch message not detected
  setTimeout(() => {
    if (!electronProc && !isRestarting) {
      console.log('[dev] Starting Electron (timeout fallback)...');
      startElectron();
    }
  }, 3000);

  // Store for cleanup
  rendererCtx = rendererProc;
}

// ── Clean shutdown ───────────────────────────────────────────────────

async function cleanup() {
  if (shuttingDown) return;
  shuttingDown = true;

  if (electronProc) {
    if (isWin) {
      spawn('taskkill', ['/pid', String(electronProc.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      electronProc.kill();
    }
  }
  if (rendererCtx) rendererCtx.kill();
  if (mainCtx) await mainCtx.dispose().catch(() => {});

  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

main().catch((err) => {
  console.error('[dev] Fatal error:', err);
  process.exit(1);
});
