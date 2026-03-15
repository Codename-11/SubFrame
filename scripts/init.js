#!/usr/bin/env node
/**
 * SubFrame CLI — Initialize a SubFrame project
 *
 * Usage:
 *   subframe init [path] [--name <name>] [--no-hooks] [--help]
 *   node scripts/init.js [path] [--name <name>] [--no-hooks] [--help]
 *
 * Examples:
 *   subframe init                          # init current directory
 *   subframe init ./my-project             # init specific path
 *   subframe init --name "MyApp"           # set project name
 *   subframe init /path/to/project         # absolute path
 */

const path = require('path');
const fs = require('fs');

// ─── ANSI colors (zero dependencies) ────────────────────────────────

const useColor = !process.argv.includes('--no-color') && !process.env.NO_COLOR && process.stdout.isTTY !== false;
const c = {
  bold:    s => useColor ? `\x1b[1m${s}\x1b[22m` : s,
  dim:     s => useColor ? `\x1b[2m${s}\x1b[22m` : s,
  green:   s => useColor ? `\x1b[32m${s}\x1b[39m` : s,
  yellow:  s => useColor ? `\x1b[33m${s}\x1b[39m` : s,
  cyan:    s => useColor ? `\x1b[36m${s}\x1b[39m` : s,
  magenta: s => useColor ? `\x1b[35m${s}\x1b[39m` : s,
  red:     s => useColor ? `\x1b[31m${s}\x1b[39m` : s,
  gray:    s => useColor ? `\x1b[90m${s}\x1b[39m` : s,
  reset:   useColor ? '\x1b[0m' : '',
};

// Symbols
const SYM = {
  check:  useColor ? c.green('✓') : '+',
  dot:    useColor ? c.green('●') : '*',
  dotAmb: useColor ? c.yellow('●') : '*',
  arrow:  useColor ? c.magenta('❯') : '>',
  skip:   useColor ? c.gray('○') : '-',
  warn:   useColor ? c.yellow('⚠') : '!',
  err:    useColor ? c.red('✗') : 'x',
};

// ─── Ensure templates are built ─────────────────────────────────────

// Only build templates when running from dev source (not packaged)
const templatesPath = path.join(__dirname, '..', 'src', 'shared', 'frameTemplates.ts');
if (fs.existsSync(templatesPath)) {
  process.env.QUIET = '1';
  require('./build-templates');
}

const { initializeProject, checkExistingFiles } = require('../src/shared/projectInit');

// ─── Argument parsing ───────────────────────────────────────────────

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = { path: null, name: null, hooks: true, help: false };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // Skip 'init' if passed from subframe-cli.js
    if (arg === 'init' && i === 0) continue;

    if (arg === '--help' || arg === '-h') {
      opts.help = true;
    } else if (arg === '--no-hooks') {
      opts.hooks = false;
    } else if (arg === '--name' || arg === '-n') {
      i++;
      if (i >= args.length) {
        console.error(`  ${SYM.err} ${c.red('--name requires a value')}`);
        process.exit(1);
      }
      opts.name = args[i];
    } else if (arg === '--no-color') {
      // Already handled above
    } else if (arg.startsWith('-')) {
      console.error(`  ${SYM.err} ${c.red(`Unknown option: ${arg}`)}`);
      console.error(`  Run ${c.cyan('subframe init --help')} for usage.`);
      process.exit(1);
    } else {
      opts.path = arg;
    }
  }

  return opts;
}

function printHelp() {
  console.log('');
  console.log(`  ${c.bold('SubFrame Init')} ${c.dim('— Initialize a SubFrame project')}`);
  console.log('');
  console.log(`  ${c.bold('Usage:')}`);
  console.log(`    ${c.cyan('subframe init')} ${c.dim('[path] [options]')}`);
  console.log('');
  console.log(`  ${c.bold('Arguments:')}`);
  console.log(`    ${c.cyan('path')}                  Project directory ${c.dim('(default: current directory)')}`);
  console.log('');
  console.log(`  ${c.bold('Options:')}`);
  console.log(`    ${c.cyan('--name, -n')} <name>     Project name ${c.dim('(default: directory basename)')}`);
  console.log(`    ${c.cyan('--no-hooks')}             Skip git hook creation`);
  console.log(`    ${c.cyan('--no-color')}             Disable colored output`);
  console.log(`    ${c.cyan('--help, -h')}             Show this help message`);
  console.log('');
  console.log(`  ${c.bold('Examples:')}`);
  console.log(`    ${c.dim('$')} subframe init`);
  console.log(`    ${c.dim('$')} subframe init ./my-project --name "My App"`);
  console.log(`    ${c.dim('$')} subframe init /path/to/project --no-hooks`);
  console.log('');
  console.log(`  ${c.bold('Created files:')}`);
  console.log(`    ${c.dim('.subframe/')}              Project config, structure, tasks, workflows`);
  console.log(`    ${c.dim('AGENTS.md')}               AI instructions ${c.dim('(tool-agnostic)')}`);
  console.log(`    ${c.dim('CLAUDE.md')}               Backlink to AGENTS.md ${c.dim('(Claude Code)')}`);
  console.log(`    ${c.dim('GEMINI.md')}               Backlink to AGENTS.md ${c.dim('(Gemini CLI)')}`);
  console.log(`    ${c.dim('.githooks/')}              Pre-commit & pre-push hooks`);
  console.log(`    ${c.dim('.claude/')}                Skills & hook settings`);
  console.log('');
}

// ─── Pretty output helpers ──────────────────────────────────────────

function printBanner() {
  const version = getVersion();
  console.log('');
  console.log(`  ${c.bold('SubFrame')} ${c.dim(`v${version}`)}`);
  console.log('');
}

function getVersion() {
  try {
    const pkgPath = path.join(__dirname, '..', 'package.json');
    return JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version;
  } catch {
    return '0.0.0';
  }
}

/** Group created files into logical categories for cleaner output */
function categorizeFiles(created, skipped) {
  const categories = [
    { label: 'Project structure',      pattern: /config\.json|STRUCTURE|PROJECT_NOTES|tasks\.json|QUICKSTART|docs-internal|\.subframe\/$/ },
    { label: 'AI agent files',         pattern: /AGENTS|CLAUDE|GEMINI/ },
    { label: 'Git hooks',             pattern: /\.githooks|pre-commit|pre-push|update-structure/ },
    { label: 'Claude hooks',          pattern: /hooks\/(session|prompt|stop|pre-tool|post-tool)/ },
    { label: 'Claude skills',         pattern: /skills\// },
    { label: 'Claude settings',       pattern: /settings\.json/ },
    { label: 'Pipeline workflows',    pattern: /workflows\// },
    { label: 'Codex wrapper',         pattern: /codex/ },
  ];

  const results = [];
  const matched = new Set();

  for (const cat of categories) {
    const catCreated = created.filter(f => cat.pattern.test(f) && !matched.has(f));
    const catSkipped = skipped.filter(f => cat.pattern.test(f) && !matched.has(f));
    if (catCreated.length > 0 || catSkipped.length > 0) {
      catCreated.forEach(f => matched.add(f));
      catSkipped.forEach(f => matched.add(f));
      results.push({ label: cat.label, created: catCreated, skipped: catSkipped });
    }
  }

  // Catch any uncategorized
  const uncatCreated = created.filter(f => !matched.has(f));
  const uncatSkipped = skipped.filter(f => !matched.has(f));
  if (uncatCreated.length > 0 || uncatSkipped.length > 0) {
    results.push({ label: 'Other', created: uncatCreated, skipped: uncatSkipped });
  }

  return results;
}

// ─── Main ───────────────────────────────────────────────────────────

function main() {
  const opts = parseArgs(process.argv);

  if (opts.help) {
    printHelp();
    process.exit(0);
  }

  printBanner();

  const projectPath = path.resolve(opts.path || process.cwd());

  // Validate directory
  if (!fs.existsSync(projectPath)) {
    console.error(`  ${SYM.err} Directory does not exist: ${c.cyan(projectPath)}`);
    process.exit(1);
  }

  if (!fs.statSync(projectPath).isDirectory()) {
    console.error(`  ${SYM.err} Not a directory: ${c.cyan(projectPath)}`);
    process.exit(1);
  }

  const projectName = opts.name || path.basename(projectPath);

  console.log(`  ${SYM.arrow} ${c.bold('Initializing')} ${c.cyan(projectName)}`);
  console.log(`  ${c.dim(projectPath)}`);
  console.log('');

  // Show existing files warning
  const existing = checkExistingFiles(projectPath);
  if (existing.length > 0) {
    console.log(`  ${SYM.dotAmb} ${c.yellow(`${existing.length} existing files will be preserved`)}`);
    console.log('');
  }

  // Run init
  const result = initializeProject(projectPath, {
    name: projectName,
    hooks: opts.hooks,
  });

  // Print categorized results
  const categories = categorizeFiles(result.created, result.skipped);

  for (const cat of categories) {
    if (cat.created.length > 0) {
      console.log(`  ${SYM.check} ${c.bold(cat.label)} ${c.dim(`(${cat.created.length} files)`)}`);
    } else if (cat.skipped.length > 0) {
      console.log(`  ${SYM.skip} ${cat.label} ${c.dim('(already exists)')}`);
    }
  }

  if (!opts.hooks) {
    console.log(`  ${SYM.skip} Git hooks ${c.dim('(--no-hooks)')}`);
  }

  // Summary
  const totalCreated = result.created.length;
  const totalSkipped = result.skipped.length;

  console.log('');
  if (totalCreated > 0) {
    console.log(`  ${SYM.dot} ${c.green(`${totalCreated} files created`)}`);
  }
  if (totalSkipped > 0) {
    console.log(`  ${SYM.skip} ${c.dim(`${totalSkipped} files skipped (already exist)`)}`);
  }

  console.log('');
  console.log(`  ${SYM.check} ${c.bold('Ready to code with Claude')}`);
  console.log('');
  console.log(`  ${c.dim('Next steps:')}`);
  console.log(`    ${c.dim('$')} cd ${projectName !== path.basename(process.cwd()) ? projectName : '.'}`);
  console.log(`    ${c.dim('$')} ${c.cyan('claude')} ${c.dim('  # Start Claude Code')}`);
  console.log(`    ${c.dim('$')} ${c.cyan('subframe')} ${c.dim('# Open in SubFrame')}`);
  console.log('');
}

main();
