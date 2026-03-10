#!/usr/bin/env node
/**
 * Verify that scripts/hooks/ files match the canonical templates in frameTemplates.js.
 * Used in CI and pre-commit to prevent drift.
 * Exit code 0 = in sync, 1 = drift detected.
 */

const fs = require('fs');
const path = require('path');

// frameTemplates.js uses `path` as a free variable — make it available globally.
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

const hooksDir = path.join(root, 'scripts', 'hooks');

if (!fs.existsSync(hooksDir)) {
  console.error(`ERROR: scripts/hooks/ directory does not exist.`);
  console.error(`Run 'npm run generate:hooks' to create it.`);
  process.exit(1);
}

let stale = [];

for (const { fn, file } of hooks) {
  const expected = templates[fn]();
  const filePath = path.join(hooksDir, file);

  if (!fs.existsSync(filePath)) {
    stale.push({ file, reason: 'missing' });
    continue;
  }

  const actual = fs.readFileSync(filePath, 'utf-8');

  if (actual !== expected) {
    stale.push({ file, reason: 'content differs' });
  }
}

if (stale.length > 0) {
  console.error(`ERROR: scripts/hooks/ is out of sync with frameTemplates.js\n`);
  for (const { file, reason } of stale) {
    console.error(`  ${file} — ${reason}`);
  }
  console.error(`\nRun 'npm run generate:hooks' to fix.`);
  process.exit(1);
}

console.log('scripts/hooks/ is in sync with frameTemplates.js');
