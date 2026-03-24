/**
 * Web build — bundles src/renderer/web-entry.tsx for browser access.
 *
 * Same as build-react.js but:
 *   - Entry point: web-entry.tsx (WebSocketTransport instead of ElectronTransport)
 *   - No external: ['electron'] (no Electron in browser mode)
 *   - Output: dist/web-renderer.js
 *   - Defines __SUBFRAME_WEB__ for conditional code paths
 *
 * Usage:
 *   node scripts/build-web.js           # single build
 *   node scripts/build-web.js --watch   # watch mode
 */

const esbuild = require('esbuild');
const path = require('path');
const postcss = require('postcss');
const fs = require('fs');

const isWatch = process.argv.includes('--watch');

/**
 * Custom esbuild plugin that processes CSS through PostCSS + @tailwindcss/postcss.
 * Identical to build-react.js — shared Tailwind v4 processing.
 */
function tailwindPostCSSPlugin() {
  return {
    name: 'tailwind-postcss',
    setup(build) {
      build.onLoad({ filter: /\.css$/ }, async (args) => {
        const source = await fs.promises.readFile(args.path, 'utf8');
        if (
          source.includes('@import "tailwindcss"') ||
          source.includes('@import "tw-animate-css"') ||
          source.includes('@theme') ||
          source.includes('@apply')
        ) {
          try {
            const tailwindPlugin = require('@tailwindcss/postcss');
            const processor = postcss([tailwindPlugin]);
            const result = await processor.process(source, { from: args.path });
            return { contents: result.css, loader: 'css', watchFiles: [args.path] };
          } catch (err) {
            console.warn(`[tailwind-postcss] Failed to process ${args.path}:`, err.message);
          }
        }
        return undefined;
      });
    },
  };
}

/** @type {import('esbuild').BuildOptions} */
const buildOptions = {
  entryPoints: [path.resolve(__dirname, '..', 'src/renderer/web-entry.tsx')],
  bundle: true,
  format: 'iife',
  outfile: path.resolve(__dirname, '..', 'dist/web-renderer.js'),
  platform: 'browser',
  mainFields: ['module', 'browser', 'main'],
  conditions: ['import', 'module'],
  // No electron external — this runs in a plain browser
  external: [],
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
    '__SUBFRAME_WEB__': 'true',
    'global': 'globalThis',
    // Polyfill process.platform for libraries that check it
    'process.platform': '"browser"',
  },
};

async function main() {
  try {
    if (isWatch) {
      const ctx = await esbuild.context(buildOptions);
      await ctx.watch();
      console.log('[build-web] Watching for changes...');
    } else {
      await esbuild.build(buildOptions);
      console.log('[build-web] Build complete.');
    }
  } catch (err) {
    console.error('[build-web] Build failed:', err);
    process.exit(1);
  }
}

main();
