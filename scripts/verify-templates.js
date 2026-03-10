#!/usr/bin/env node
/**
 * Verify frameTemplates.js is up-to-date with frameTemplates.ts
 *
 * Compiles the .ts source to a temp file via esbuild, then compares
 * it against the committed .js artefact.  Exits 0 when they match,
 * 1 when the .js file is missing or stale.
 *
 * Used by `npm run check` / CI to catch forgotten rebuilds.
 */

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const ENTRY = path.join(ROOT, 'src', 'shared', 'frameTemplates.ts');
const EXISTING = path.join(ROOT, 'src', 'shared', 'frameTemplates.js');
const TMP = path.join(os.tmpdir(), `frameTemplates-verify-${Date.now()}.js`);

// 1. Does the .js file exist at all?
if (!fs.existsSync(EXISTING)) {
  console.error('[verify-templates] FAIL — frameTemplates.js does not exist.');
  console.error('  Run: node scripts/build-templates.js');
  process.exit(1);
}

// 2. Compile .ts → temp .js (same settings as build-templates.js)
esbuild.buildSync({
  entryPoints: [ENTRY],
  outfile: TMP,
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  bundle: true,
  external: ['fs', 'path', 'electron'],
  banner: {
    js: '/* AUTO-GENERATED — do not edit. Source: src/shared/frameTemplates.ts */\n/* Run: node scripts/build-templates.js to regenerate */\n',
  },
});

// 3. Compare (byte-for-byte)
const expected = fs.readFileSync(TMP);
const actual = fs.readFileSync(EXISTING);

// Clean up temp file
try { fs.unlinkSync(TMP); } catch { /* ignore */ }

if (expected.equals(actual)) {
  console.log('[verify-templates] OK — frameTemplates.js matches .ts source.');
  process.exit(0);
} else {
  console.error('[verify-templates] FAIL — frameTemplates.js is out of date.');
  console.error('  Run: node scripts/build-templates.js');
  process.exit(1);
}
