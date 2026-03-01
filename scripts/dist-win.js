/**
 * Windows distribution build with automatic UAC elevation.
 *
 * electron-builder's winCodeSign cache contains macOS symlinks that require
 * admin privileges (or Developer Mode) to extract on Windows. This script
 * detects whether it's running elevated and, if not, triggers a UAC prompt
 * to re-run the build with the necessary privileges.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function isAdmin() {
  try {
    execSync('net session', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

if (!isAdmin()) {
  console.log('Admin privileges required for electron-builder code-signing cache.');
  console.log('Requesting UAC elevation...\n');

  // Write a temp batch file for the elevated process to execute.
  // This avoids multi-layer shell escaping between Node → PowerShell → cmd.
  const bat = path.join(os.tmpdir(), 'subframe-dist-win.cmd');
  fs.writeFileSync(bat, [
    '@echo off',
    `cd /d "${ROOT}"`,
    'call npm run build && call npx electron-builder --win',
    'if errorlevel 1 (',
    '  echo.',
    '  echo Build failed. See errors above.',
    '  pause',
    ')',
    `del "%~f0"`,
  ].join('\r\n'));

  try {
    execSync(
      `powershell -NoProfile -Command "Start-Process -Verb RunAs -Wait '${bat}'"`,
      { stdio: 'inherit' }
    );
    console.log('Elevated build completed.');
  } catch {
    try { fs.unlinkSync(bat); } catch {}
    console.error('Elevation denied or build failed.');
    console.error('Alternatives:');
    console.error('  1. Run your terminal as Administrator');
    console.error('  2. Enable Developer Mode: Settings > System > For Developers');
    process.exit(1);
  }
  process.exit(0);
}

// Already running elevated — proceed with the build directly.
console.log('Running as administrator...\n');
try {
  execSync('npm run build && electron-builder --win', {
    stdio: 'inherit',
    cwd: ROOT,
  });
} catch (e) {
  process.exit(e.status || 1);
}
