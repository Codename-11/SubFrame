#!/usr/bin/env node
/**
 * Verify compiled .js artefacts are up-to-date with their .ts sources
 *
 * Compiles each .ts source to a temp file via esbuild, then compares
 * it against the committed .js artefact.  Exits 0 when all match,
 * 1 when any .js file is missing or stale.
 *
 * Used by `npm run check` / CI to catch forgotten rebuilds.
 */

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const SHARED = path.join(ROOT, 'src', 'shared');

const targets = [
  {
    entry: path.join(SHARED, 'frameTemplates.ts'),
    existing: path.join(SHARED, 'frameTemplates.js'),
    label: 'frameTemplates',
    external: ['fs', 'path', 'electron'],
  },
  {
    entry: path.join(SHARED, 'projectInit.ts'),
    existing: path.join(SHARED, 'projectInit.js'),
    label: 'projectInit',
    external: ['fs', 'path', 'child_process', 'electron'],
  },
];

let allOk = true;

for (const target of targets) {
  const TMP = path.join(os.tmpdir(), `${target.label}-verify-${Date.now()}.js`);

  // 1. Does the .js file exist?
  if (!fs.existsSync(target.existing)) {
    console.error(`[verify-templates] FAIL — ${target.label}.js does not exist.`);
    console.error('  Run: node scripts/build-templates.js');
    allOk = false;
    continue;
  }

  // 2. Compile .ts → temp .js (same settings as build-templates.js)
  esbuild.buildSync({
    entryPoints: [target.entry],
    outfile: TMP,
    format: 'cjs',
    platform: 'node',
    target: 'node18',
    bundle: true,
    external: target.external,
    banner: {
      js: `/* AUTO-GENERATED — do not edit. Source: src/shared/${path.basename(target.entry)} */\n/* Run: node scripts/build-templates.js to regenerate */\n`,
    },
  });

  // 3. Compare (byte-for-byte)
  const expected = fs.readFileSync(TMP);
  const actual = fs.readFileSync(target.existing);

  try { fs.unlinkSync(TMP); } catch { /* ignore */ }

  if (expected.equals(actual)) {
    console.log(`[verify-templates] OK — ${target.label}.js matches .ts source.`);
  } else {
    console.error(`[verify-templates] FAIL — ${target.label}.js is out of date.`);
    console.error('  Run: node scripts/build-templates.js');
    allOk = false;
  }
}

process.exit(allOk ? 0 : 1);
