/**
 * Tests for WorkflowEditor utility functions — YAML serialization, quoting, and round-trip.
 *
 * Since stateToYaml/yamlQuote live in a React component file, we test them
 * via the workflow parser round-trip: serialize → parse → verify structure.
 */

import { describe, it, expect } from 'vitest';
import { parseWorkflow } from '../../src/main/pipelineWorkflowParser';

// ─── yamlQuote logic tests (reimplemented here for unit testing) ─────────────

/** Mirror of yamlQuote from WorkflowEditor.tsx */
const YAML_KEYWORDS = new Set(['true', 'false', 'null', 'yes', 'no', 'on', 'off', 'True', 'False', 'Null', 'Yes', 'No', 'On', 'Off', 'TRUE', 'FALSE', 'NULL', 'YES', 'NO', 'ON', 'OFF']);

function yamlQuote(val: string): string {
  if (!val) return "''";
  if (YAML_KEYWORDS.has(val)) return `'${val}'`;
  if (/^[a-zA-Z0-9][a-zA-Z0-9 ._/-]*$/.test(val) && !val.includes(': ') && !val.includes('#')) {
    return val;
  }
  return `'${val.replace(/'/g, "''")}'`;
}

describe('yamlQuote', () => {
  it('leaves simple values unquoted', () => {
    expect(yamlQuote('lint')).toBe('lint');
    expect(yamlQuote('health-check')).toBe('health-check');
    expect(yamlQuote('npm run build')).toBe('npm run build');
    expect(yamlQuote('my-workflow/v2')).toBe('my-workflow/v2');
  });

  it('quotes values with YAML special characters', () => {
    expect(yamlQuote('key: value')).toBe("'key: value'");
    expect(yamlQuote('# comment')).toBe("'# comment'");
    expect(yamlQuote('{object}')).toBe("'{object}'");
    expect(yamlQuote('[array]')).toBe("'[array]'");
    expect(yamlQuote('true')).toBe("'true'");
    expect(yamlQuote('')).toBe("''");
  });

  it('escapes single quotes inside values', () => {
    expect(yamlQuote("it's")).toBe("'it''s'");
    expect(yamlQuote("don't stop")).toBe("'don''t stop'");
  });

  it('quotes values starting with special characters', () => {
    expect(yamlQuote('*wildcard')).toBe("'*wildcard'");
    expect(yamlQuote('!important')).toBe("'!important'");
    expect(yamlQuote('&anchor')).toBe("'&anchor'");
    expect(yamlQuote('@scope')).toBe("'@scope'");
  });

  it('handles multi-word prompts correctly', () => {
    const prompt = 'Check for injection vulnerabilities in all API endpoints';
    // This matches the safe regex (starts with letter, only safe chars)
    expect(yamlQuote(prompt)).toBe(prompt);
  });

  it('quotes prompts with colons', () => {
    const prompt = 'Focus on: security and performance';
    expect(yamlQuote(prompt)).toBe("'Focus on: security and performance'");
  });
});

// ─── stateToYaml round-trip tests via parseWorkflow ──────────────────────────

/** Simplified stateToYaml mirror for testing */
function buildTestYaml(opts: {
  name: string;
  manual?: boolean;
  push?: boolean;
  pushBranches?: string;
  steps: Array<{
    name: string;
    uses?: string;
    run?: string;
    withScope?: string;
    withMode?: string;
    withFocus?: string;
    withPrompt?: string;
    continueOnError?: boolean;
    requireApproval?: string;
  }>;
}): string {
  const lines: string[] = [];
  lines.push(`name: ${yamlQuote(opts.name)}`);
  lines.push('on:');
  if (opts.push) {
    lines.push('  push:');
    lines.push(`    branches: ['${opts.pushBranches || '*'}']`);
  }
  if (opts.manual !== false) {
    lines.push('  manual: true');
  }
  lines.push('');
  lines.push('jobs:');
  lines.push('  default:');
  lines.push('    steps:');

  for (const step of opts.steps) {
    lines.push(`      - name: ${yamlQuote(step.name)}`);
    if (step.uses) lines.push(`        uses: ${step.uses}`);
    if (step.run) lines.push(`        run: ${yamlQuote(step.run)}`);
    if (step.continueOnError) lines.push('        continue-on-error: true');
    if (step.requireApproval === 'true') lines.push('        require-approval: true');
    if (step.requireApproval === 'if_patches') lines.push('        require-approval: if_patches');

    const withEntries: [string, string][] = [];
    if (step.withScope) withEntries.push(['scope', step.withScope]);
    if (step.withMode) withEntries.push(['mode', step.withMode]);
    if (step.withFocus) withEntries.push(['focus', step.withFocus]);
    if (step.withPrompt) withEntries.push(['prompt', yamlQuote(step.withPrompt)]);

    if (withEntries.length > 0) {
      lines.push('        with:');
      for (const [k, v] of withEntries) {
        lines.push(`          ${k}: ${v}`);
      }
    }
  }

  return lines.join('\n') + '\n';
}

describe('YAML serialization round-trip', () => {
  it('basic workflow survives serialize → parse', () => {
    const yaml = buildTestYaml({
      name: 'my-workflow',
      steps: [
        { name: 'Lint', uses: 'lint' },
        { name: 'Test', uses: 'test', continueOnError: true },
      ],
    });

    const def = parseWorkflow(yaml);
    expect(def.name).toBe('my-workflow');
    expect(def.jobs.default.steps).toHaveLength(2);
    expect(def.jobs.default.steps[0].uses).toBe('lint');
    expect(def.jobs.default.steps[1]['continue-on-error']).toBe(true);
  });

  it('with: config survives round-trip', () => {
    const yaml = buildTestYaml({
      name: 'audit',
      steps: [
        {
          name: 'Security Review',
          uses: 'critique',
          withScope: 'project',
          withMode: 'agent',
          withFocus: 'security',
          withPrompt: 'Check for OWASP top 10 vulnerabilities',
        },
      ],
    });

    const def = parseWorkflow(yaml);
    const step = def.jobs.default.steps[0];
    expect(step.with?.scope).toBe('project');
    expect(step.with?.mode).toBe('agent');
    expect(step.with?.focus).toBe('security');
    expect(step.with?.prompt).toBe('Check for OWASP top 10 vulnerabilities');
  });

  it('prompt with special characters survives round-trip', () => {
    const yaml = buildTestYaml({
      name: 'special',
      steps: [
        {
          name: 'Review',
          uses: 'critique',
          withPrompt: "Check for: injection, XSS, and it's edge cases",
        },
      ],
    });

    const def = parseWorkflow(yaml);
    expect(def.jobs.default.steps[0].with?.prompt).toBe(
      "Check for: injection, XSS, and it's edge cases"
    );
  });

  it('run command with special characters survives round-trip', () => {
    const yaml = buildTestYaml({
      name: 'custom',
      steps: [
        { name: 'Audit', run: 'npm audit --audit-level=moderate 2>&1 || true' },
      ],
    });

    const def = parseWorkflow(yaml);
    expect(def.jobs.default.steps[0].run).toBe('npm audit --audit-level=moderate 2>&1 || true');
  });

  it('workflow name with spaces survives round-trip', () => {
    const yaml = buildTestYaml({
      name: 'My Custom Workflow',
      steps: [{ name: 'Step One', uses: 'lint' }],
    });

    const def = parseWorkflow(yaml);
    expect(def.name).toBe('My Custom Workflow');
  });

  it('approval options survive round-trip', () => {
    const yaml = buildTestYaml({
      name: 'approval-test',
      steps: [
        { name: 'Always Approve', uses: 'critique', requireApproval: 'true' },
        { name: 'Conditional', uses: 'critique', requireApproval: 'if_patches' },
      ],
    });

    const def = parseWorkflow(yaml);
    expect(def.jobs.default.steps[0]['require-approval']).toBe(true);
    expect(def.jobs.default.steps[1]['require-approval']).toBe('if_patches');
  });
});
