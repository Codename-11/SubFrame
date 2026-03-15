#!/usr/bin/env node
/**
 * Compile shared TypeScript modules → CJS .js files
 *
 * Uses esbuild (already a project dependency) to transpile + bundle
 * TypeScript sources into self-contained CommonJS modules that
 * Node.js scripts (init.js, task.js) can require() directly.
 *
 * The .js outputs are build artifacts — not manually maintained.
 * See .gitignore for entries that keep them out of version control.
 */

const esbuild = require('esbuild');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SHARED = path.join(ROOT, 'src', 'shared');

const targets = [
  {
    entry: path.join(SHARED, 'frameTemplates.ts'),
    out: path.join(SHARED, 'frameTemplates.js'),
    label: 'frameTemplates',
  },
  {
    entry: path.join(SHARED, 'projectInit.ts'),
    out: path.join(SHARED, 'projectInit.js'),
    label: 'projectInit',
  },
];

for (const target of targets) {
  esbuild.buildSync({
    entryPoints: [target.entry],
    outfile: target.out,
    format: 'cjs',
    platform: 'node',
    target: 'node18',
    bundle: true,
    // Don't bundle Node builtins or Electron — they resolve at runtime
    external: ['fs', 'path', 'child_process', 'electron'],
    // Banner so people know not to edit it
    banner: {
      js: `/* AUTO-GENERATED — do not edit. Source: src/shared/${path.basename(target.entry)} */\n/* Run: node scripts/build-templates.js to regenerate */\n`,
    },
  });

  if (!process.env.QUIET) {
    console.log(`[build-templates] Compiled ${target.label}.ts → ${target.label}.js`);
  }
}
