/**
 * Tests for onboarding manager — parseAnalysisResponse, gatherContext,
 * buildAnalysisPrompt, importResults, and detectProjectIntelligence.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock Electron-dependent modules that onboardingManager imports at top level
vi.mock('../../src/main/ptyManager', () => ({
  createTerminal: vi.fn(() => 'mock-terminal-id'),
  writeToTerminal: vi.fn(),
  destroyTerminal: vi.fn(),
}));

vi.mock('../../src/main/aiToolManager', () => ({
  getStartCommand: vi.fn(() => 'claude'),
  getProviderName: vi.fn(() => 'claude'),
}));

import {
  detectProjectIntelligence,
  _parseAnalysisResponse as parseAnalysisResponse,
  _gatherContext as gatherContext,
  _buildAnalysisPrompt as buildAnalysisPrompt,
  _importResults as importResults,
} from '../../src/main/onboardingManager';

import type {
  OnboardingAnalysisResult,
  OnboardingImportSelections,
  DetectedIntelligence,
} from '../../src/shared/ipcChannels';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createTmpProject(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'sf-onboard-test-'));
}

function cleanupTmpProject(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

/** Create a mock analysis result with all fields populated */
function mockAnalysisResult(overrides?: Partial<OnboardingAnalysisResult>): OnboardingAnalysisResult {
  return {
    structure: {
      description: 'A test project',
      architecture: 'Monolith',
      conventions: ['camelCase', 'ESM imports'],
      dataFlow: 'Client → Server → DB',
      modules: {
        'src/index.ts': { purpose: 'Entry point', exports: ['main'] },
      },
    },
    projectNotes: {
      vision: 'Build the best widget',
      decisions: [
        { date: '2025-01-01', title: 'Use TypeScript', detail: 'For type safety' },
      ],
      techStack: ['TypeScript', 'Node.js', 'Vitest'],
    },
    suggestedTasks: [
      { title: 'Add unit tests', description: 'Cover core modules', priority: 'high', category: 'test' },
      { title: 'Setup CI', description: 'GitHub Actions pipeline', priority: 'medium', category: 'devops' },
    ],
    ...overrides,
  };
}

// ─── parseAnalysisResponse ────────────────────────────────────────────────────

describe('parseAnalysisResponse', () => {
  it('parses a valid JSON code block', () => {
    const raw = 'Here is the analysis:\n```json\n' +
      JSON.stringify(mockAnalysisResult()) +
      '\n```\nDone.';

    const { result, error } = parseAnalysisResponse(raw);
    expect(error).toBeUndefined();
    expect(result).not.toBeNull();
    expect(result!.structure.description).toBe('A test project');
    expect(result!.suggestedTasks).toHaveLength(2);
    expect(result!.projectNotes.techStack).toContain('TypeScript');
  });

  it('returns error for empty input', () => {
    const { result, error } = parseAnalysisResponse('');
    expect(result).toBeNull();
    expect(error).toContain('no output');
  });

  it('returns error for whitespace-only input', () => {
    const { result, error } = parseAnalysisResponse('   \n\n  ');
    expect(result).toBeNull();
    expect(error).toContain('no output');
  });

  it('strips ANSI escape codes before parsing', () => {
    const json = JSON.stringify(mockAnalysisResult());
    // Wrap JSON block in ANSI color codes
    const raw = '\u001b[32m```json\u001b[0m\n' + json + '\n```';

    const { result, error } = parseAnalysisResponse(raw);
    expect(error).toBeUndefined();
    expect(result).not.toBeNull();
    expect(result!.structure.description).toBe('A test project');
  });

  it('detects rate limit error patterns', () => {
    const raw = 'Error: Rate limit exceeded. Please try again later.';
    const { result, error } = parseAnalysisResponse(raw);
    expect(result).toBeNull();
    expect(error).toBeDefined();
    expect(error!.toLowerCase()).toContain('rate limit');
  });

  it('does not false-positive on rate limit in status text', () => {
    // Status bar text like "current: 0% | weekly: 25%" should NOT trigger rate limit
    const raw = 'current: 0% | weekly: 25% | resets 9:00pm\nNo useful output here.';
    const { result, error } = parseAnalysisResponse(raw);
    expect(result).toBeNull();
    expect(error).toBeDefined();
    expect(error!.toLowerCase()).not.toContain('rate limit');
  });

  it('detects permission denied error patterns', () => {
    const raw = 'Permission denied: cannot access /home/user/.config';
    const { result, error } = parseAnalysisResponse(raw);
    expect(result).toBeNull();
    expect(error).toBeDefined();
  });

  it('detects API key error patterns', () => {
    const raw = 'Error: Invalid API key provided. Please check your configuration.';
    const { result, error } = parseAnalysisResponse(raw);
    expect(result).toBeNull();
    expect(error).toBeDefined();
  });

  it('extracts raw JSON without markdown fences', () => {
    const json = JSON.stringify(mockAnalysisResult());
    // No ```json fences — just raw JSON with surrounding text
    const raw = 'Here is the analysis:\n' + json + '\nDone.';

    const { result, error } = parseAnalysisResponse(raw);
    expect(error).toBeUndefined();
    expect(result).not.toBeNull();
    expect(result!.structure.description).toBe('A test project');
    expect(result!.suggestedTasks).toHaveLength(2);
  });

  it('returns error when no JSON code block found', () => {
    const raw = 'This is just plain text with no JSON block at all.';
    const { result, error } = parseAnalysisResponse(raw);
    expect(result).toBeNull();
    expect(error).toContain('JSON');
  });

  it('returns error for invalid JSON inside code block', () => {
    const raw = '```json\n{ invalid json here }\n```';
    const { result, error } = parseAnalysisResponse(raw);
    expect(result).toBeNull();
    expect(error).toContain('parse');
  });

  it('returns error when all top-level keys are missing', () => {
    const raw = '```json\n{"foo": "bar"}\n```';
    const { result, error } = parseAnalysisResponse(raw);
    expect(result).toBeNull();
    expect(error).toContain('lacks');
  });

  it('normalizes partial results — fills missing top-level keys', () => {
    const partial = { structure: { description: 'Hello' } };
    const raw = '```json\n' + JSON.stringify(partial) + '\n```';

    const { result, error } = parseAnalysisResponse(raw);
    expect(error).toBeUndefined();
    expect(result).not.toBeNull();
    expect(result!.structure.description).toBe('Hello');
    // Missing keys get defaults
    expect(result!.projectNotes).toEqual({});
    expect(result!.suggestedTasks).toEqual([]);
  });

  it('normalizes when suggestedTasks is not an array', () => {
    const data = { structure: { description: 'test' }, suggestedTasks: 'not an array' };
    const raw = '```json\n' + JSON.stringify(data) + '\n```';

    const { result } = parseAnalysisResponse(raw);
    expect(result).not.toBeNull();
    expect(result!.suggestedTasks).toEqual([]);
  });

  it('handles JSON with surrounding whitespace in code block', () => {
    const json = JSON.stringify(mockAnalysisResult());
    const raw = '```json\n\n  ' + json + '\n\n```';

    const { result, error } = parseAnalysisResponse(raw);
    expect(error).toBeUndefined();
    expect(result).not.toBeNull();
  });

  it('extracts the first JSON block when multiple exist', () => {
    const first = { structure: { description: 'First' } };
    const second = { structure: { description: 'Second' } };
    const raw = '```json\n' + JSON.stringify(first) + '\n```\n```json\n' + JSON.stringify(second) + '\n```';

    const { result } = parseAnalysisResponse(raw);
    expect(result).not.toBeNull();
    expect(result!.structure.description).toBe('First');
  });
});

// ─── gatherContext ────────────────────────────────────────────────────────────

describe('gatherContext', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpProject();
  });

  afterEach(() => {
    cleanupTmpProject(tmpDir);
  });

  it('reads detected files into context string', () => {
    fs.writeFileSync(path.join(tmpDir, 'README.md'), '# My Project\nThis is a test.');

    const detected: DetectedIntelligence[] = [
      { category: 'documentation', path: 'README.md', label: 'README', hasContent: true, size: 30 },
    ];

    const result = gatherContext(tmpDir, detected);
    expect(result).toContain('# My Project');
    expect(result).toContain('--- FILE: README.md');
  });

  it('skips files that do not exist', () => {
    const detected: DetectedIntelligence[] = [
      { category: 'documentation', path: 'MISSING.md', label: 'Missing', hasContent: true, size: 100 },
    ];

    const result = gatherContext(tmpDir, detected);
    // Should not throw, just return empty or context without the file
    expect(typeof result).toBe('string');
  });

  it('truncates files exceeding MAX_FILE_SIZE', () => {
    const bigContent = 'x'.repeat(15_000);
    fs.writeFileSync(path.join(tmpDir, 'big.txt'), bigContent);

    const detected: DetectedIntelligence[] = [
      { category: 'documentation', path: 'big.txt', label: 'Big File', hasContent: true, size: 15000 },
    ];

    const result = gatherContext(tmpDir, detected);
    expect(result).toContain('[truncated]');
    // Should be less than the original 15k
    expect(result.length).toBeLessThan(15_000);
  });

  it('respects total context budget', () => {
    // Create multiple files that together exceed the budget
    for (let i = 0; i < 10; i++) {
      fs.writeFileSync(path.join(tmpDir, `file${i}.md`), 'a'.repeat(8_000));
    }

    const detected: DetectedIntelligence[] = Array.from({ length: 10 }, (_, i) => ({
      category: 'documentation' as const,
      path: `file${i}.md`,
      label: `File ${i}`,
      hasContent: true,
      size: 8000,
    }));

    const result = gatherContext(tmpDir, detected);
    // Budget is 50k, each file ~8k + header → should get ~6 files before budget exhausted
    expect(result.length).toBeLessThanOrEqual(55_000); // some slack for headers
  });

  it('prevents path traversal in extra files', () => {
    // Create a file outside the project directory
    const outsideDir = createTmpProject();
    fs.writeFileSync(path.join(outsideDir, 'secret.txt'), 'SECRET DATA');

    const detected: DetectedIntelligence[] = [];
    const extraFiles = [path.join(outsideDir, 'secret.txt')];

    const result = gatherContext(tmpDir, detected, extraFiles);
    expect(result).not.toContain('SECRET DATA');

    cleanupTmpProject(outsideDir);
  });

  it('allows extra files within project boundary', () => {
    fs.writeFileSync(path.join(tmpDir, 'extra.txt'), 'EXTRA CONTENT');

    const detected: DetectedIntelligence[] = [];
    const extraFiles = [path.join(tmpDir, 'extra.txt')];

    const result = gatherContext(tmpDir, detected, extraFiles);
    expect(result).toContain('EXTRA CONTENT');
    expect(result).toContain('[user-added]');
  });

  it('handles directories in extra files by listing entries', () => {
    const subdir = path.join(tmpDir, 'subdir');
    fs.mkdirSync(subdir);
    fs.writeFileSync(path.join(subdir, 'a.ts'), 'export const a = 1;');
    fs.writeFileSync(path.join(subdir, 'b.ts'), 'export const b = 2;');

    const detected: DetectedIntelligence[] = [];
    const extraFiles = [subdir];

    const result = gatherContext(tmpDir, detected, extraFiles);
    expect(result).toContain('a.ts');
    expect(result).toContain('b.ts');
  });
});

// ─── buildAnalysisPrompt ──────────────────────────────────────────────────────

describe('buildAnalysisPrompt', () => {
  it('includes project name and context', () => {
    const prompt = buildAnalysisPrompt('file content here', 'MyProject');
    expect(prompt).toContain('MyProject');
    expect(prompt).toContain('file content here');
  });

  it('includes output format instructions', () => {
    const prompt = buildAnalysisPrompt('content', 'Test');
    expect(prompt).toContain('structure');
    expect(prompt).toContain('projectNotes');
    expect(prompt).toContain('suggestedTasks');
    expect(prompt).toContain('json');
  });

  it('appends custom context when provided', () => {
    const prompt = buildAnalysisPrompt('content', 'Test', 'Focus on security patterns');
    expect(prompt).toContain('Focus on security patterns');
    expect(prompt).toContain('Additional Instructions');
  });

  it('does not include additional instructions section without custom context', () => {
    const prompt = buildAnalysisPrompt('content', 'Test');
    expect(prompt).not.toContain('Additional Instructions');
  });
});

// ─── detectProjectIntelligence ────────────────────────────────────────────────

describe('detectProjectIntelligence', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpProject();
  });

  afterEach(() => {
    cleanupTmpProject(tmpDir);
  });

  it('returns empty detection for an empty project', () => {
    const result = detectProjectIntelligence(tmpDir);
    expect(result.projectPath).toBe(tmpDir);
    expect(result.detected).toEqual([]);
    expect(result.sourceFileCount).toBe(0);
    expect(result.worthAnalyzing).toBe(false);
  });

  it('detects package.json', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name": "test"}');

    const result = detectProjectIntelligence(tmpDir);
    const pkg = result.detected.find((d) => d.path === 'package.json');
    expect(pkg).toBeDefined();
    expect(pkg!.category).toBe('project-metadata');
    expect(pkg!.hasContent).toBe(true);
  });

  it('detects CLAUDE.md in root or .claude/ directory', () => {
    fs.writeFileSync(path.join(tmpDir, 'CLAUDE.md'), '# Instructions');

    const result = detectProjectIntelligence(tmpDir);
    const claude = result.detected.find((d) => d.label === 'CLAUDE.md');
    expect(claude).toBeDefined();
    expect(claude!.category).toBe('ai-config');
  });

  it('counts source files and detects primary language', () => {
    // Create some TypeScript files
    const srcDir = path.join(tmpDir, 'src');
    fs.mkdirSync(srcDir);
    fs.writeFileSync(path.join(srcDir, 'index.ts'), 'console.log("hello");');
    fs.writeFileSync(path.join(srcDir, 'utils.ts'), 'export const x = 1;');
    fs.writeFileSync(path.join(srcDir, 'helper.js'), 'module.exports = {};');

    const result = detectProjectIntelligence(tmpDir);
    expect(result.sourceFileCount).toBeGreaterThanOrEqual(3);
    expect(result.primaryLanguage).toBe('TypeScript');
  });

  it('sets worthAnalyzing when enough intelligence files detected', () => {
    // Need >= 2 detected files with at least one from ai-config or documentation
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name": "test"}');
    fs.writeFileSync(path.join(tmpDir, 'CLAUDE.md'), '# Instructions');
    fs.writeFileSync(path.join(tmpDir, 'README.md'), '# README');

    const result = detectProjectIntelligence(tmpDir);
    expect(result.worthAnalyzing).toBe(true);
  });

  it('does not set worthAnalyzing for single metadata file', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name": "test"}');

    const result = detectProjectIntelligence(tmpDir);
    expect(result.worthAnalyzing).toBe(false);
  });

  it('derives project name from directory', () => {
    const result = detectProjectIntelligence(tmpDir);
    expect(result.projectName).toBe(path.basename(tmpDir));
  });

  it('detects git repository', () => {
    fs.mkdirSync(path.join(tmpDir, '.git'));

    const result = detectProjectIntelligence(tmpDir);
    expect(result.hasGit).toBe(true);
  });

  it('skips node_modules when counting source files', () => {
    const nmDir = path.join(tmpDir, 'node_modules', 'some-pkg');
    fs.mkdirSync(nmDir, { recursive: true });
    fs.writeFileSync(path.join(nmDir, 'index.js'), 'module.exports = {};');

    // Also add a real source file
    fs.writeFileSync(path.join(tmpDir, 'index.ts'), 'export {};');

    const result = detectProjectIntelligence(tmpDir);
    expect(result.sourceFileCount).toBe(1);
  });
});

// ─── importResults ────────────────────────────────────────────────────────────

describe('importResults', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpProject();
    // Create .subframe directory
    fs.mkdirSync(path.join(tmpDir, '.subframe'), { recursive: true });
  });

  afterEach(() => {
    cleanupTmpProject(tmpDir);
  });

  describe('STRUCTURE.json import', () => {
    it('creates STRUCTURE.json when it does not exist', () => {
      const analysis = mockAnalysisResult();
      const selections: OnboardingImportSelections = {
        structure: true,
        projectNotes: false,
        taskIds: [],
      };

      const result = importResults(tmpDir, analysis, selections);
      expect(result.imported).toContain('STRUCTURE.json');

      const structurePath = path.join(tmpDir, '.subframe', 'STRUCTURE.json');
      expect(fs.existsSync(structurePath)).toBe(true);

      const content = JSON.parse(fs.readFileSync(structurePath, 'utf8'));
      expect(content.description).toBe('A test project');
      expect(content.architecture).toBe('Monolith');
      expect(content.conventions).toEqual(['camelCase', 'ESM imports']);
    });

    it('does not overwrite existing fields in STRUCTURE.json', () => {
      const structurePath = path.join(tmpDir, '.subframe', 'STRUCTURE.json');
      fs.writeFileSync(
        structurePath,
        JSON.stringify({ description: 'Existing description', architecture: 'Microservices' }),
      );

      const analysis = mockAnalysisResult();
      const selections: OnboardingImportSelections = {
        structure: true,
        projectNotes: false,
        taskIds: [],
      };

      importResults(tmpDir, analysis, selections);

      const content = JSON.parse(fs.readFileSync(structurePath, 'utf8'));
      expect(content.description).toBe('Existing description');
      expect(content.architecture).toBe('Microservices');
      // New fields should still be added
      expect(content.dataFlow).toBe('Client → Server → DB');
      expect(content.conventions).toEqual(['camelCase', 'ESM imports']);
    });

    it('merges modules without overwriting existing ones', () => {
      const structurePath = path.join(tmpDir, '.subframe', 'STRUCTURE.json');
      fs.writeFileSync(
        structurePath,
        JSON.stringify({
          modules: { 'src/existing.ts': { purpose: 'Existing' } },
        }),
      );

      const analysis = mockAnalysisResult();
      const selections: OnboardingImportSelections = {
        structure: true,
        projectNotes: false,
        taskIds: [],
      };

      importResults(tmpDir, analysis, selections);

      const content = JSON.parse(fs.readFileSync(structurePath, 'utf8'));
      expect(content.modules['src/existing.ts'].purpose).toBe('Existing');
      expect(content.modules['src/index.ts'].purpose).toBe('Entry point');
    });

    it('skips when no new fields to fill', () => {
      const structurePath = path.join(tmpDir, '.subframe', 'STRUCTURE.json');
      fs.writeFileSync(
        structurePath,
        JSON.stringify({
          description: 'Existing',
          architecture: 'Existing',
          dataFlow: 'Existing',
          conventions: ['existing'],
          modules: { 'src/index.ts': { purpose: 'Existing' } },
        }),
      );

      const analysis = mockAnalysisResult();
      const selections: OnboardingImportSelections = {
        structure: true,
        projectNotes: false,
        taskIds: [],
      };

      const result = importResults(tmpDir, analysis, selections);
      expect(result.skipped).toEqual(expect.arrayContaining([expect.stringContaining('no new fields')]));
    });
  });

  describe('PROJECT_NOTES.md import', () => {
    it('creates notes from scratch when no file exists', () => {
      const analysis = mockAnalysisResult();
      const selections: OnboardingImportSelections = {
        structure: false,
        projectNotes: true,
        taskIds: [],
      };

      const result = importResults(tmpDir, analysis, selections);
      expect(result.imported).toContain('PROJECT_NOTES.md');

      const notesPath = path.join(tmpDir, '.subframe', 'PROJECT_NOTES.md');
      const content = fs.readFileSync(notesPath, 'utf8');
      expect(content).toContain('# Project Notes');
      expect(content).toContain('Build the best widget');
      expect(content).toContain('TypeScript');
      expect(content).toContain('Use TypeScript');
    });

    it('replaces default template content', () => {
      const notesPath = path.join(tmpDir, '.subframe', 'PROJECT_NOTES.md');
      fs.writeFileSync(notesPath, '# Notes\n\nNo decisions logged yet.\n');

      const analysis = mockAnalysisResult();
      const selections: OnboardingImportSelections = {
        structure: false,
        projectNotes: true,
        taskIds: [],
      };

      importResults(tmpDir, analysis, selections);

      const content = fs.readFileSync(notesPath, 'utf8');
      expect(content).not.toContain('No decisions logged yet');
      expect(content).toContain('Build the best widget');
    });

    it('appends AI Analysis section to existing content', () => {
      const notesPath = path.join(tmpDir, '.subframe', 'PROJECT_NOTES.md');
      const existingContent = '# My Notes\n\nThis is existing content with enough characters to pass the threshold for default detection. We need at least 100 characters of meaningful content here.';
      fs.writeFileSync(notesPath, existingContent);

      const analysis = mockAnalysisResult();
      const selections: OnboardingImportSelections = {
        structure: false,
        projectNotes: true,
        taskIds: [],
      };

      importResults(tmpDir, analysis, selections);

      const content = fs.readFileSync(notesPath, 'utf8');
      expect(content).toContain('My Notes');
      expect(content).toContain('## AI Analysis');
      expect(content).toContain('Build the best widget');
    });
  });

  describe('Task import', () => {
    it('creates task markdown files', () => {
      const analysis = mockAnalysisResult();
      const selections: OnboardingImportSelections = {
        structure: false,
        projectNotes: false,
        taskIds: [0, 1],
      };

      const result = importResults(tmpDir, analysis, selections);
      expect(result.imported).toContain('Task: Add unit tests');
      expect(result.imported).toContain('Task: Setup CI');

      const tasksDir = path.join(tmpDir, '.subframe', 'tasks');
      const files = fs.readdirSync(tasksDir).filter((f) => f.endsWith('.md'));
      expect(files).toHaveLength(2);
    });

    it('task files contain correct frontmatter', () => {
      const analysis = mockAnalysisResult();
      const selections: OnboardingImportSelections = {
        structure: false,
        projectNotes: false,
        taskIds: [0],
      };

      importResults(tmpDir, analysis, selections);

      const tasksDir = path.join(tmpDir, '.subframe', 'tasks');
      const files = fs.readdirSync(tasksDir).filter((f) => f.endsWith('.md'));
      const content = fs.readFileSync(path.join(tasksDir, files[0]), 'utf8');

      expect(content).toContain('title: "Add unit tests"');
      expect(content).toContain('priority: high');
      expect(content).toContain('category: test');
      expect(content).toContain('status: pending');
    });

    it('deduplicates tasks by title (case-insensitive)', () => {
      // Create an existing task with the same title
      const tasksDir = path.join(tmpDir, '.subframe', 'tasks');
      fs.mkdirSync(tasksDir, { recursive: true });
      fs.writeFileSync(
        path.join(tasksDir, 'existing-task.md'),
        '---\ntitle: "Add Unit Tests"\nstatus: pending\n---\n',
      );

      const analysis = mockAnalysisResult();
      const selections: OnboardingImportSelections = {
        structure: false,
        projectNotes: false,
        taskIds: [0, 1],
      };

      const result = importResults(tmpDir, analysis, selections);
      expect(result.skipped).toEqual(expect.arrayContaining([expect.stringContaining('duplicate')]));
      expect(result.imported).toContain('Task: Setup CI');

      // Should only have created 1 new file (+ the existing one)
      const files = fs.readdirSync(tasksDir).filter((f) => f.endsWith('.md'));
      expect(files).toHaveLength(2);
    });

    it('skips out-of-bounds task indices', () => {
      const analysis = mockAnalysisResult();
      const selections: OnboardingImportSelections = {
        structure: false,
        projectNotes: false,
        taskIds: [0, 99, -1],
      };

      const result = importResults(tmpDir, analysis, selections);
      expect(result.imported).toHaveLength(1);
      expect(result.imported).toContain('Task: Add unit tests');
    });

    it('creates tasks directory if it does not exist', () => {
      const analysis = mockAnalysisResult();
      const selections: OnboardingImportSelections = {
        structure: false,
        projectNotes: false,
        taskIds: [0],
      };

      // Don't create tasks dir ahead of time
      importResults(tmpDir, analysis, selections);

      const tasksDir = path.join(tmpDir, '.subframe', 'tasks');
      expect(fs.existsSync(tasksDir)).toBe(true);
    });
  });

  describe('Combined imports', () => {
    it('imports all three targets at once', () => {
      const analysis = mockAnalysisResult();
      const selections: OnboardingImportSelections = {
        structure: true,
        projectNotes: true,
        taskIds: [0, 1],
      };

      const result = importResults(tmpDir, analysis, selections);
      expect(result.imported).toContain('STRUCTURE.json');
      expect(result.imported).toContain('PROJECT_NOTES.md');
      expect(result.imported).toContain('Task: Add unit tests');
      expect(result.imported).toContain('Task: Setup CI');
      expect(result.errors).toHaveLength(0);
    });

    it('returns empty arrays when nothing is selected', () => {
      const analysis = mockAnalysisResult();
      const selections: OnboardingImportSelections = {
        structure: false,
        projectNotes: false,
        taskIds: [],
      };

      const result = importResults(tmpDir, analysis, selections);
      expect(result.imported).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('escapes double quotes in task titles', () => {
      const analysis = mockAnalysisResult({
        suggestedTasks: [
          { title: 'Fix "broken" thing', description: 'A task with "quotes"', priority: 'low', category: 'fix' },
        ],
      });
      const selections: OnboardingImportSelections = {
        structure: false,
        projectNotes: false,
        taskIds: [0],
      };

      const result = importResults(tmpDir, analysis, selections);
      expect(result.imported).toHaveLength(1);

      const tasksDir = path.join(tmpDir, '.subframe', 'tasks');
      const files = fs.readdirSync(tasksDir).filter((f) => f.endsWith('.md'));
      const content = fs.readFileSync(path.join(tasksDir, files[0]), 'utf8');
      expect(content).toContain('\\"broken\\"');
    });
  });
});
