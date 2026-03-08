/**
 * Tests for pipelineWorkflowParser — YAML parsing, validation, and with: config preservation.
 */

import { describe, it, expect } from 'vitest';
import { parseWorkflow } from '../../src/main/pipelineWorkflowParser';

describe('parseWorkflow', () => {
  it('parses a minimal valid workflow', () => {
    const yaml = `
name: test-workflow
on:
  manual: true
jobs:
  build:
    steps:
      - name: Lint
        uses: lint
`;
    const def = parseWorkflow(yaml);
    expect(def.name).toBe('test-workflow');
    expect(def.on.manual).toBe(true);
    expect(Object.keys(def.jobs)).toEqual(['build']);
    expect(def.jobs.build.steps).toHaveLength(1);
    expect(def.jobs.build.steps[0].name).toBe('Lint');
    expect(def.jobs.build.steps[0].uses).toBe('lint');
  });

  it('preserves with: config on steps (JS reserved word)', () => {
    const yaml = `
name: health-check
on:
  manual: true
jobs:
  audit:
    steps:
      - name: Critique
        uses: critique
        with:
          scope: project
          mode: agent
          focus: security
          prompt: "Check for injection vulnerabilities"
`;
    const def = parseWorkflow(yaml);
    const step = def.jobs.audit.steps[0];
    expect(step.with).toBeDefined();
    expect(step.with?.scope).toBe('project');
    expect(step.with?.mode).toBe('agent');
    expect(step.with?.focus).toBe('security');
    expect(step.with?.prompt).toBe('Check for injection vulnerabilities');
  });

  it('preserves require-approval and continue-on-error', () => {
    const yaml = `
name: review
on:
  manual: true
jobs:
  review:
    steps:
      - name: Review
        uses: critique
        require-approval: if_patches
        continue-on-error: true
        timeout: 300
`;
    const def = parseWorkflow(yaml);
    const step = def.jobs.review.steps[0];
    expect(step['require-approval']).toBe('if_patches');
    expect(step['continue-on-error']).toBe(true);
    expect(step.timeout).toBe(300);
  });

  it('parses push trigger with branches', () => {
    const yaml = `
name: ci
on:
  push:
    branches: ['main', 'feature/*']
  manual: true
jobs:
  test:
    steps:
      - name: Test
        uses: test
`;
    const def = parseWorkflow(yaml);
    expect(def.on.push?.branches).toEqual(['main', 'feature/*']);
    expect(def.on.manual).toBe(true);
  });

  it('parses job needs (dependencies)', () => {
    const yaml = `
name: pipeline
on:
  manual: true
jobs:
  quality:
    steps:
      - name: Lint
        uses: lint
  review:
    needs: [quality]
    steps:
      - name: Review
        uses: critique
`;
    const def = parseWorkflow(yaml);
    expect(def.jobs.review.needs).toEqual(['quality']);
  });

  it('parses run command steps', () => {
    const yaml = `
name: custom
on:
  manual: true
jobs:
  build:
    steps:
      - name: Build
        run: npm run build
`;
    const def = parseWorkflow(yaml);
    expect(def.jobs.build.steps[0].run).toBe('npm run build');
    expect(def.jobs.build.steps[0].uses).toBeUndefined();
  });

  it('throws on missing name', () => {
    expect(() => parseWorkflow(`
on:
  manual: true
jobs:
  build:
    steps:
      - name: Lint
        uses: lint
`)).toThrow("missing required field 'name'");
  });

  it('throws on missing jobs', () => {
    expect(() => parseWorkflow(`
name: bad
on:
  manual: true
`)).toThrow("missing required field 'jobs'");
  });

  it('throws on empty steps', () => {
    expect(() => parseWorkflow(`
name: bad
on:
  manual: true
jobs:
  build:
    steps: []
`)).toThrow('must have at least one step');
  });

  it('throws on invalid YAML', () => {
    expect(() => parseWorkflow('{{invalid yaml')).toThrow('YAML parse error');
  });

  it('round-trips with: config through parse without data loss', () => {
    const yaml = `
name: full-config
on:
  manual: true
jobs:
  audit:
    name: Full Audit
    steps:
      - name: Describe
        uses: describe
        with:
          scope: project
      - name: Critique
        uses: critique
        with:
          scope: project
          mode: agent
          focus: architecture
          prompt: "Deep architecture review"
        require-approval: true
        continue-on-error: true
`;
    const def = parseWorkflow(yaml);

    // Step 1
    expect(def.jobs.audit.steps[0].with?.scope).toBe('project');
    expect(def.jobs.audit.steps[0].with?.mode).toBeUndefined();

    // Step 2 — all with: keys preserved
    const step2 = def.jobs.audit.steps[1];
    expect(step2.with?.scope).toBe('project');
    expect(step2.with?.mode).toBe('agent');
    expect(step2.with?.focus).toBe('architecture');
    expect(step2.with?.prompt).toBe('Deep architecture review');
    expect(step2['require-approval']).toBe(true);
    expect(step2['continue-on-error']).toBe(true);
  });
});
