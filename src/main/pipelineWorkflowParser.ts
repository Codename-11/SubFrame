/**
 * Pipeline Workflow Parser
 * Parses YAML workflow files from .subframe/workflows/*.yml
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { FRAME_WORKFLOWS_DIR } from '../shared/frameConstants';
import { getDefaultReviewWorkflow, getTaskVerifyWorkflow, getHealthCheckWorkflow as getHealthCheckTemplate } from '../shared/frameTemplates';
import type { WorkflowDefinition } from '../shared/ipcChannels';

/**
 * Parse a YAML workflow string into a WorkflowDefinition.
 * Validates required fields: name, on, jobs.
 */
export function parseWorkflow(content: string): WorkflowDefinition {
  let doc: unknown;
  try {
    doc = yaml.parse(content);
  } catch (err) {
    throw new Error(`YAML parse error: ${(err as Error).message}`);
  }

  if (!doc || typeof doc !== 'object') {
    throw new Error('Workflow must be a YAML object');
  }

  const raw = doc as Record<string, unknown>;

  if (!raw.name || typeof raw.name !== 'string') {
    throw new Error("Workflow missing required field 'name'");
  }

  if (!raw.on || typeof raw.on !== 'object') {
    throw new Error("Workflow missing required field 'on'");
  }

  if (!raw.jobs || typeof raw.jobs !== 'object') {
    throw new Error("Workflow missing required field 'jobs'");
  }

  // Validate each job has steps
  const jobs = raw.jobs as Record<string, unknown>;
  for (const [jobId, jobDef] of Object.entries(jobs)) {
    if (!jobDef || typeof jobDef !== 'object') {
      throw new Error(`Job '${jobId}' must be an object`);
    }
    const job = jobDef as Record<string, unknown>;
    if (!Array.isArray(job.steps) || job.steps.length === 0) {
      throw new Error(`Job '${jobId}' must have at least one step`);
    }
  }

  return {
    name: raw.name as string,
    on: raw.on as WorkflowDefinition['on'],
    jobs: raw.jobs as WorkflowDefinition['jobs'],
  };
}

/**
 * List all workflows from the .subframe/workflows/ directory of a project.
 */
export function listWorkflows(projectPath: string): WorkflowDefinition[] {
  const workflowsDir = path.join(projectPath, FRAME_WORKFLOWS_DIR);

  if (!fs.existsSync(workflowsDir)) {
    return [];
  }

  const files = fs.readdirSync(workflowsDir).filter(
    (f) => f.endsWith('.yml') || f.endsWith('.yaml')
  );

  const workflows: WorkflowDefinition[] = [];

  for (const file of files) {
    const filePath = path.join(workflowsDir, file);
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const workflow = parseWorkflow(content);
      workflows.push(workflow);
    } catch (err) {
      console.error(`Error parsing workflow ${filePath}:`, (err as Error).message);
    }
  }

  return workflows;
}

/** Delegate to shared templates — single source of truth in frameTemplates.ts */
export const getDefaultWorkflow = getDefaultReviewWorkflow;
export const getTaskVerificationWorkflow = getTaskVerifyWorkflow;
export const getHealthCheckWorkflow = getHealthCheckTemplate;
