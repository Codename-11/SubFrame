/**
 * React + TypeScript esbuild config
 * Bundles src/renderer/index.tsx with Tailwind CSS v4 support.
 * Usage:
 *   node scripts/build-react.js          # single build
 *   node scripts/build-react.js --watch   # watch mode
 */

const esbuild = require('esbuild');
const path = require('path');
const postcss = require('postcss');
const fs = require('fs');

const isWatch = process.argv.includes('--watch');

/**
 * Custom esbuild plugin that processes CSS through PostCSS + @tailwindcss/postcss.
 * Handles Tailwind v4's `@import "tailwindcss"` and `@theme` directives.
 */
function tailwindPostCSSPlugin() {
  return {
    name: 'tailwind-postcss',
    setup(build) {
      // Only intercept .css files that contain tailwind directives
      build.onLoad({ filter: /\.css$/ }, async (args) => {
        const source = await fs.promises.readFile(args.path, 'utf8');

        // Only process through PostCSS if the file uses tailwind features
        if (
          source.includes('@import "tailwindcss"') ||
          source.includes('@import "tw-animate-css"') ||
          source.includes('@theme') ||
          source.includes('@apply')
        ) {
          try {
            const tailwindPlugin = require('@tailwindcss/postcss');
            const processor = postcss([tailwindPlugin]);
            const result = await processor.process(source, {
              from: args.path,
            });
            return {
              contents: result.css,
              loader: 'css',
              watchFiles: [args.path],
            };
          } catch (err) {
            console.warn(`[tailwind-postcss] Failed to process ${args.path}:`, err.message);
            // Fall through to default CSS handling
          }
        }

        // Return undefined to let esbuild handle it normally
        return undefined;
      });
    },
  };
}

/** @type {import('esbuild').BuildOptions} */
const buildOptions = {
  entryPoints: [path.resolve(__dirname, '..', 'src/renderer/index.tsx')],
  bundle: true,
  format: 'iife',
  outfile: path.resolve(__dirname, '..', 'dist/renderer.js'),
  // Use 'browser' platform — Electron's renderer IS a browser context.
  // 'node' caused two issues:
  //   1. style-mod declares `const top = globalThis` which collides with
  //      read-only window.top in the browser-like renderer
  //   2. @lezer CJS exports have initialization order bugs with @__PURE__
  //      annotations causing tags.className to be undefined
  // 'browser' + 'iife' format resolves both by using ESM entry points
  // (proper initialization) and wrapping in a function scope (no global
  // top collision). Electron's require('electron') still works via the
  // 'external' config since nodeIntegration is enabled.
  platform: 'browser',
  mainFields: ['module', 'browser', 'main'],
  conditions: ['import', 'module'],
  external: ['electron'],
  jsx: 'automatic',
  loader: {
    '.ts': 'ts',
    '.tsx': 'tsx',
    '.css': 'css',
  },
  plugins: [tailwindPostCSSPlugin()],
  sourcemap: true,
  target: 'es2020',
  define: {
    'process.env.NODE_ENV': isWatch ? '"development"' : '"production"',
    // Electron renderer has Node globals via nodeIntegration — shim for
    // libraries that check for global/process in browser platform mode
    'global': 'globalThis',
  },
};

async function main() {
  try {
    if (isWatch) {
      const ctx = await esbuild.context(buildOptions);
      await ctx.watch();
      console.log('[build-react] Watching for changes...');
    } else {
      await esbuild.build(buildOptions);
      console.log('[build-react] Build complete.');
    }
  } catch (err) {
    console.error('[build-react] Build failed:', err);
    process.exit(1);
  }
}

main();
