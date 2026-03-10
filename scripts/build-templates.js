#!/usr/bin/env node
/**
 * Compile frameTemplates.ts → frameTemplates.js (CJS)
 *
 * Uses esbuild (already a project dependency) to transpile + bundle
 * the TypeScript source into a self-contained CommonJS module that
 * Node.js scripts (init.js, projectInit.js) can require() directly.
 *
 * The .js output is a build artifact — not manually maintained.
 * See .gitignore for the entry that keeps it out of version control.
 */

const esbuild = require('esbuild');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ENTRY = path.join(ROOT, 'src', 'shared', 'frameTemplates.ts');
const OUT = path.join(ROOT, 'src', 'shared', 'frameTemplates.js');

esbuild.buildSync({
  entryPoints: [ENTRY],
  outfile: OUT,
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  bundle: true,
  // Don't bundle Node builtins or Electron — they resolve at runtime
  external: ['fs', 'path', 'electron'],
  // Banner so people know not to edit it
  banner: {
    js: '/* AUTO-GENERATED — do not edit. Source: src/shared/frameTemplates.ts */\n/* Run: node scripts/build-templates.js to regenerate */\n',
  },
});

if (!process.env.QUIET) {
  console.log('[build-templates] Compiled frameTemplates.ts → frameTemplates.js');
}
