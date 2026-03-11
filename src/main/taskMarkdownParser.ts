/**
 * Task Markdown Parser
 * Parses and serializes tasks between markdown files (with YAML frontmatter) and Task objects.
 * Uses gray-matter for frontmatter extraction.
 */

import * as path from 'path';
import matter from 'gray-matter';
import type { Task, TaskStep } from '../shared/ipcChannels';

// ─── Section names ───────────────────────────────────────────────────────────

const SECTION_STEPS = '## Steps';
const SECTION_USER_REQUEST = '## User Request';
const SECTION_ACCEPTANCE = '## Acceptance Criteria';
const SECTION_NOTES = '## Notes';

// Known section headings (order matters for serialization)
const KNOWN_SECTIONS = [SECTION_STEPS, SECTION_USER_REQUEST, SECTION_ACCEPTANCE, SECTION_NOTES];

// ─── Parse ───────────────────────────────────────────────────────────────────

/**
 * Split markdown body into description (text before first ##) and named sections.
 * Unknown sections are preserved under their heading key.
 */
function parseSections(body: string): { description: string; sections: Map<string, string> } {
  const sections = new Map<string, string>();
  const lines = body.split('\n');
  let currentSection: string | null = null;
  let currentLines: string[] = [];
  const descriptionLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith('## ')) {
      // Flush previous section
      if (currentSection) {
        sections.set(currentSection, currentLines.join('\n').trim());
      }
      currentSection = line;
      currentLines = [];
    } else if (currentSection) {
      currentLines.push(line);
    } else {
      descriptionLines.push(line);
    }
  }

  // Flush last section
  if (currentSection) {
    sections.set(currentSection, currentLines.join('\n').trim());
  }

  return {
    description: descriptionLines.join('\n').trim(),
    sections,
  };
}

/**
 * Parse step checkboxes from a section body.
 * Matches: `- [x] Label` or `- [ ] Label`
 */
function parseSteps(text: string): TaskStep[] {
  const steps: TaskStep[] = [];
  const re = /^- \[(x| )\] (.+)$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    steps.push({ completed: m[1] === 'x', label: m[2].trim() });
  }
  return steps;
}

/**
 * Strip blockquote prefixes from user request text.
 */
function stripBlockquotes(text: string): string {
  return text
    .split('\n')
    .map((line) => line.replace(/^>\s?/, ''))
    .join('\n')
    .trim();
}

/**
 * Parse a task markdown file into a Task object.
 */
export function parseTaskMarkdown(content: string, filePath: string): Task {
  const { data: fm, content: body } = matter(content);
  const { description, sections } = parseSections(body);

  // Parse steps from ## Steps section
  const stepsText = sections.get(SECTION_STEPS) ?? '';
  const steps = parseSteps(stepsText);

  // Parse user request (strip blockquotes)
  const userRequestRaw = sections.get(SECTION_USER_REQUEST) ?? '';
  const userRequest = stripBlockquotes(userRequestRaw);

  // Acceptance criteria — raw text
  const acceptanceCriteria = sections.get(SECTION_ACCEPTANCE) ?? '';

  // Notes — raw text
  const notes = sections.get(SECTION_NOTES) ?? '';

  // Collect unknown sections for round-trip preservation
  const unknownSections: Array<{ heading: string; content: string }> = [];
  for (const [heading, content] of sections) {
    if (!KNOWN_SECTIONS.includes(heading)) {
      unknownSections.push({ heading, content });
    }
  }

  // Derive id from frontmatter or filename (never allow empty id)
  const id = fm.id || path.basename(filePath, '.md');

  return {
    id,
    title: fm.title ?? '',
    status: fm.status ?? 'pending',
    priority: fm.priority ?? 'medium',
    category: fm.category ?? undefined,
    context: fm.context ?? undefined,
    private: fm.private === true ? true : undefined,
    blockedBy: Array.isArray(fm.blockedBy) ? fm.blockedBy : [],
    blocks: Array.isArray(fm.blocks) ? fm.blocks : [],
    createdAt: fm.createdAt ? new Date(fm.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: fm.updatedAt ? new Date(fm.updatedAt).toISOString() : new Date().toISOString(),
    completedAt: fm.completedAt ? new Date(fm.completedAt).toISOString() : null,
    description: description || '',
    userRequest: userRequest || undefined,
    acceptanceCriteria: acceptanceCriteria || undefined,
    notes: notes || undefined,
    steps,
    filePath,
    // Attach unknown sections for round-trip (stored as non-standard property)
    ...(unknownSections.length > 0 ? { _unknownSections: unknownSections } : {}),
  } as Task;
}

// ─── Serialize ───────────────────────────────────────────────────────────────

/**
 * Serialize a Task object back to markdown with YAML frontmatter.
 */
export function serializeTaskMarkdown(task: Task): string {
  // Build frontmatter data
  const fm: Record<string, unknown> = {
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    category: task.category ?? 'feature',
    blockedBy: task.blockedBy ?? [],
    blocks: task.blocks ?? [],
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    completedAt: task.completedAt,
  };

  if (task.context) fm.context = task.context;
  if (task.private) fm.private = true;

  // Build body sections
  const bodyParts: string[] = [];

  // Description (before any ## heading)
  if (task.description) {
    bodyParts.push(task.description);
    bodyParts.push('');
  }

  // Steps
  if (task.steps && task.steps.length > 0) {
    bodyParts.push(SECTION_STEPS);
    for (const step of task.steps) {
      bodyParts.push(`- [${step.completed ? 'x' : ' '}] ${step.label}`);
    }
    bodyParts.push('');
  }

  // User Request
  if (task.userRequest) {
    bodyParts.push(SECTION_USER_REQUEST);
    const lines = task.userRequest.split('\n');
    for (const line of lines) {
      bodyParts.push(`> ${line}`);
    }
    bodyParts.push('');
  }

  // Acceptance Criteria
  if (task.acceptanceCriteria) {
    bodyParts.push(SECTION_ACCEPTANCE);
    bodyParts.push(task.acceptanceCriteria);
    bodyParts.push('');
  }

  // Notes
  if (task.notes) {
    bodyParts.push(SECTION_NOTES);
    bodyParts.push(task.notes);
    bodyParts.push('');
  }

  // Unknown sections (round-trip preservation)
  const unknownSections = (task as any)._unknownSections as Array<{ heading: string; content: string }> | undefined;
  if (unknownSections) {
    for (const { heading, content } of unknownSections) {
      bodyParts.push(heading);
      bodyParts.push(content);
      bodyParts.push('');
    }
  }

  // Use gray-matter's stringify to produce frontmatter + body
  const body = bodyParts.join('\n').trimEnd() + '\n';
  return matter.stringify(body, fm);
}
