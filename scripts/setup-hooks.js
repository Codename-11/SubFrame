#!/usr/bin/env node
/**
 * SubFrame Hook Setup
 *
 * Deploys Claude Code hook scripts to a project's .subframe/hooks/ directory
 * and configures .claude/settings.json to use them with git-root-relative paths.
 *
 * Usage:
 *   node scripts/setup-hooks.js [options]
 *
 * Options:
 *   --target <dir>    Target project root (default: current working directory)
 *   --core-only       Only deploy core hooks (session-start, prompt-submit, stop)
 *                     Skips agent-state hooks (pre/post-tool-use) which are
 *                     SubFrame IDE-specific
 *   --force           Overwrite existing hook files without prompting
 *   --dry-run         Show what would be done without writing files
 *
 * Hooks deployed:
 *   session-start.js  - Injects pending/in-progress sub-tasks at session start
 *   prompt-submit.js  - Fuzzy-matches prompts to pending sub-tasks
 *   stop.js           - Reminds about in-progress tasks, detects untracked work
 *   pre-tool-use.js   - Tracks agent activity in .subframe/agent-state.json
 *   post-tool-use.js  - Completes agent activity steps in agent-state.json
 */

const fs = require('fs');
const path = require('path');

// ── Parse Arguments ─────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getArg(name) {
  const idx = args.indexOf(name);
  const val = idx >= 0 ? args[idx + 1] : null;
  return val && !val.startsWith('--') ? val : null;
}

const hasFlag = (name) => args.includes(name);

const targetRoot = path.resolve(getArg('--target') || process.cwd());

// Validate target directory exists
if (!fs.existsSync(targetRoot)) {
  console.error(`Error: Target directory does not exist: ${targetRoot}`);
  process.exit(1);
}
const coreOnly = hasFlag('--core-only');
const force = hasFlag('--force');
const dryRun = hasFlag('--dry-run');

// ── Constants ───────────────────────────────────────────────────────────────

const SCRIPT_DIR = __dirname;
const HOOKS_TEMPLATE_DIR = path.join(SCRIPT_DIR, 'hooks');

const CORE_HOOKS = ['session-start.js', 'prompt-submit.js', 'stop.js'];
const AGENT_STATE_HOOKS = ['pre-tool-use.js', 'post-tool-use.js'];

const HOOK_FILES = coreOnly ? CORE_HOOKS : [...CORE_HOOKS, ...AGENT_STATE_HOOKS];

// ── Helpers ─────────────────────────────────────────────────────────────────

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    if (dryRun) {
      console.log(`  [dry-run] Would create directory: ${dir}`);
      return;
    }
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ── Deploy Hook Scripts ─────────────────────────────────────────────────────

function deployHooks() {
  const targetHooksDir = path.join(targetRoot, '.subframe', 'hooks');
  ensureDir(targetHooksDir);

  let deployed = 0;
  let skipped = 0;

  for (const file of HOOK_FILES) {
    const src = path.join(HOOKS_TEMPLATE_DIR, file);
    const dest = path.join(targetHooksDir, file);

    if (!fs.existsSync(src)) {
      console.log(`  ! Template not found: ${file} (skipped)`);
      skipped++;
      continue;
    }

    if (fs.existsSync(dest) && !force) {
      console.log(`  - ${file} (exists, use --force to overwrite)`);
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(`  [dry-run] Would copy: ${file}`);
      deployed++;
      continue;
    }

    fs.copyFileSync(src, dest);
    deployed++;
    console.log(`  + ${file}`);
  }

  return { deployed, skipped };
}

// ── Configure .claude/settings.json ─────────────────────────────────────────

function configureSettings() {
  const claudeDir = path.join(targetRoot, '.claude');
  const settingsPath = path.join(claudeDir, 'settings.json');
  ensureDir(claudeDir);

  // Load existing settings (preserve non-hook config)
  let settings = {};
  if (fs.existsSync(settingsPath)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    } catch {
      console.log('  ! Existing settings.json is invalid JSON, creating new one');
    }
  }

  // Build hook command using git rev-parse for monorepo robustness
  const cmd = (script) =>
    `node "$(git rev-parse --show-toplevel)/.subframe/hooks/${script}"`;

  // Build hooks config for deployed files
  const hookEntries = {};
  const hookMap = {
    'session-start.js': 'SessionStart',
    'prompt-submit.js': 'UserPromptSubmit',
    'stop.js': 'Stop',
    'pre-tool-use.js': 'PreToolUse',
    'post-tool-use.js': 'PostToolUse',
  };

  for (const file of HOOK_FILES) {
    const event = hookMap[file];
    if (!event) continue;
    hookEntries[event] = [{
      matcher: '',
      hooks: [{ type: 'command', command: cmd(file) }],
    }];
  }

  // Merge: for each event type, remove existing SubFrame matchers then add new ones.
  // Preserves non-SubFrame hooks (user-defined) within the same event type.
  if (!settings.hooks) settings.hooks = {};
  const SF_PREFIX = '.subframe/hooks/';
  for (const [event, newMatchers] of Object.entries(hookEntries)) {
    if (!Array.isArray(settings.hooks[event])) {
      settings.hooks[event] = [];
    }
    // Remove existing SubFrame matchers for this event
    settings.hooks[event] = settings.hooks[event].filter((matcher) => {
      if (!Array.isArray(matcher.hooks)) return true;
      return !matcher.hooks.some((h) => h.command?.includes(SF_PREFIX));
    });
    // Add new SubFrame matchers
    settings.hooks[event].push(...newMatchers);
  }

  if (dryRun) {
    console.log('  [dry-run] Would write .claude/settings.json:');
    console.log(JSON.stringify(settings, null, 2).split('\n').map(l => '    ' + l).join('\n'));
    return;
  }

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
  console.log('  + .claude/settings.json configured');
}

// ── Main ────────────────────────────────────────────────────────────────────

console.log();
console.log(`SubFrame Hook Setup${dryRun ? ' (dry run)' : ''}`);
console.log(`Target: ${targetRoot}`);
console.log();

// Verify template directory exists
if (!fs.existsSync(HOOKS_TEMPLATE_DIR)) {
  console.error(`Error: Hook templates not found at ${HOOKS_TEMPLATE_DIR}`);
  console.error('Run this script from the SubFrame project root, or ensure scripts/hooks/ exists.');
  process.exit(1);
}

console.log('Deploying hook scripts:');
const { deployed, skipped } = deployHooks();

console.log();
console.log('Configuring Claude Code settings:');
configureSettings();

console.log();
if (dryRun) {
  console.log(`Done (dry run) - ${deployed} hooks would be deployed, ${skipped} skipped.`);
} else {
  console.log(`Done - ${deployed} hooks deployed, ${skipped} skipped.`);
}
console.log();
