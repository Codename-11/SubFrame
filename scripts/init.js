#!/usr/bin/env node
/**
 * SubFrame CLI — Initialize a SubFrame project
 *
 * Usage:
 *   node scripts/init.js [path] [--name <name>] [--no-hooks] [--help]
 *
 * Examples:
 *   node scripts/init.js                     # init current directory
 *   node scripts/init.js /path/to/project    # init specific path
 *   node scripts/init.js --name "MyApp"      # set project name
 *   node scripts/init.js --no-hooks          # skip git hook creation
 *   npm run init -- --help                   # show help
 */

const path = require('path');
const fs = require('fs');
const { initializeProject, checkExistingFiles } = require('../src/shared/projectInit');

// ─── Argument parsing ────────────────────────────────────────────────

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = { path: null, name: null, hooks: true, help: false };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      opts.help = true;
    } else if (arg === '--no-hooks') {
      opts.hooks = false;
    } else if (arg === '--name' || arg === '-n') {
      i++;
      if (i >= args.length) {
        console.error('Error: --name requires a value');
        process.exit(1);
      }
      opts.name = args[i];
    } else if (arg.startsWith('-')) {
      console.error(`Unknown option: ${arg}`);
      console.error('Run with --help for usage.');
      process.exit(1);
    } else {
      // Positional argument — project path
      opts.path = arg;
    }
  }

  return opts;
}

function printHelp() {
  console.log(`
SubFrame Init — Initialize a SubFrame project

Usage:
  node scripts/init.js [path] [options]
  npm run init -- [path] [options]

Arguments:
  path                  Project directory (default: current directory)

Options:
  --name, -n <name>     Project name (default: directory basename)
  --no-hooks            Skip git pre-commit hook creation
  --help, -h            Show this help message

Examples:
  node scripts/init.js
  node scripts/init.js ./my-project --name "My App"
  node scripts/init.js /absolute/path --no-hooks
  npm run init -- --name "My App"

Created files:
  .subframe/                    Project files directory
  .subframe/config.json         Project configuration
  .subframe/bin/codex           Codex CLI wrapper
  .subframe/STRUCTURE.json      Codebase module map
  .subframe/PROJECT_NOTES.md    Session notes and decisions
  .subframe/tasks.json          Task tracking
  .subframe/QUICKSTART.md       Getting started guide
  .subframe/docs-internal/      Internal documentation
  AGENTS.md                     AI instructions (tool-agnostic)
  CLAUDE.md                     Backlink to AGENTS.md (Claude Code)
  GEMINI.md                     Backlink to AGENTS.md (Gemini CLI)
  .githooks/pre-commit          Auto-update STRUCTURE.json on commit
`);
}

// ─── Main ────────────────────────────────────────────────────────────

function main() {
  const opts = parseArgs(process.argv);

  if (opts.help) {
    printHelp();
    process.exit(0);
  }

  const projectPath = path.resolve(opts.path || process.cwd());

  // Validate that the target directory exists
  if (!fs.existsSync(projectPath)) {
    console.error(`Error: Directory does not exist: ${projectPath}`);
    process.exit(1);
  }

  if (!fs.statSync(projectPath).isDirectory()) {
    console.error(`Error: Not a directory: ${projectPath}`);
    process.exit(1);
  }

  const projectName = opts.name || path.basename(projectPath);

  // Show what already exists
  const existing = checkExistingFiles(projectPath);
  if (existing.length > 0) {
    console.log(`\nExisting files (will not be overwritten):`);
    existing.forEach(f => console.log(`  - ${f}`));
    console.log('');
  }

  // Run init
  console.log(`Initializing SubFrame project in: ${projectPath}`);
  console.log(`Project name: ${projectName}`);
  if (!opts.hooks) {
    console.log('Git hooks: skipped (--no-hooks)');
  }
  console.log('');

  const result = initializeProject(projectPath, {
    name: projectName,
    hooks: opts.hooks
  });

  // Print results
  if (result.created.length > 0) {
    console.log('Created:');
    result.created.forEach(f => console.log(`  + ${f}`));
  }

  if (result.skipped.length > 0) {
    console.log('Skipped (already exist):');
    result.skipped.forEach(f => console.log(`  - ${f}`));
  }

  console.log(`\nSubFrame project initialized successfully.`);
}

main();
