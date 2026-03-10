#!/usr/bin/env node
/**
 * Generate hook scripts from canonical templates in src/shared/frameTemplates.js.
 * Writes to both scripts/hooks/ and .subframe/hooks/ so file copies never drift.
 *
 * The pre-tool-use and post-tool-use template functions in frameTemplates.js
 * read from scripts/hooks/ at runtime (they use path without a module-level
 * require), so we inject `path` into the global scope before loading.
 */

const fs = require('fs');
const path = require('path');

// frameTemplates.js uses `path` as a free variable in two functions —
// make it available globally so the require succeeds.
global.path = path;

const root = path.join(__dirname, '..');
const templates = require(path.join(root, 'src', 'shared', 'frameTemplates.js'));

const hooks = [
  { fn: 'getSessionStartHookTemplate', file: 'session-start.js' },
  { fn: 'getPromptSubmitHookTemplate', file: 'prompt-submit.js' },
  { fn: 'getStopHookTemplate', file: 'stop.js' },
  { fn: 'getPreToolUseHookTemplate', file: 'pre-tool-use.js' },
  { fn: 'getPostToolUseHookTemplate', file: 'post-tool-use.js' },
];

const dirs = [
  path.join(root, 'scripts', 'hooks'),
  path.join(root, '.subframe', 'hooks'),
];

for (const dir of dirs) {
  fs.mkdirSync(dir, { recursive: true });
}

let count = 0;
for (const { fn, file } of hooks) {
  const content = templates[fn]();
  for (const dir of dirs) {
    const dest = path.join(dir, file);
    fs.writeFileSync(dest, content, { mode: 0o755 });
    console.log(`  wrote ${path.relative(root, dest)}`);
    count++;
  }
}

console.log(`\nGenerated ${count} hook files from frameTemplates.js`);
