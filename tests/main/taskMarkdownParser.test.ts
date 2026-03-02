/**
 * Tests for taskMarkdownParser — parse/serialize round-trips and edge cases.
 */

import { describe, it, expect } from 'vitest';
import { parseTaskMarkdown, serializeTaskMarkdown } from '../../src/main/taskMarkdownParser';
import type { Task } from '../../src/shared/ipcChannels';

const FULL_MD = `---
id: task-m6
title: Claude Code chat sidebar
status: in_progress
priority: medium
category: feature
blockedBy: []
blocks:
  - task-s5
createdAt: "2026-03-01T00:00:00.000Z"
updatedAt: "2026-03-02T00:54:07.789Z"
completedAt: null
---

Build a chat sidebar for Claude Code integration.

## Steps
- [x] Define IPC channels
- [ ] Build React component
- [ ] Wire manager IPC

## User Request
> Can we add a sidebar for Claude Code chat?

## Acceptance Criteria
1. Sidebar shows in right panel
2. Messages render as markdown

## Notes
[2026-03-01] Started work.
`;

describe('parseTaskMarkdown', () => {
  it('parses a full task markdown file', () => {
    const task = parseTaskMarkdown(FULL_MD, '/path/to/task-m6.md');

    expect(task.id).toBe('task-m6');
    expect(task.title).toBe('Claude Code chat sidebar');
    expect(task.status).toBe('in_progress');
    expect(task.priority).toBe('medium');
    expect(task.category).toBe('feature');
    expect(task.blockedBy).toEqual([]);
    expect(task.blocks).toEqual(['task-s5']);
    expect(task.createdAt).toBe('2026-03-01T00:00:00.000Z');
    expect(task.updatedAt).toBe('2026-03-02T00:54:07.789Z');
    expect(task.completedAt).toBeNull();
    expect(task.description).toBe('Build a chat sidebar for Claude Code integration.');
    expect(task.filePath).toBe('/path/to/task-m6.md');
  });

  it('parses steps with various checkbox states', () => {
    const task = parseTaskMarkdown(FULL_MD, '/path/to/task.md');

    expect(task.steps).toHaveLength(3);
    expect(task.steps[0]).toEqual({ label: 'Define IPC channels', completed: true });
    expect(task.steps[1]).toEqual({ label: 'Build React component', completed: false });
    expect(task.steps[2]).toEqual({ label: 'Wire manager IPC', completed: false });
  });

  it('strips blockquote prefixes from user request', () => {
    const task = parseTaskMarkdown(FULL_MD, '/path/to/task.md');

    expect(task.userRequest).toBe('Can we add a sidebar for Claude Code chat?');
  });

  it('parses acceptance criteria as raw text', () => {
    const task = parseTaskMarkdown(FULL_MD, '/path/to/task.md');

    expect(task.acceptanceCriteria).toContain('Sidebar shows in right panel');
    expect(task.acceptanceCriteria).toContain('Messages render as markdown');
  });

  it('parses notes section', () => {
    const task = parseTaskMarkdown(FULL_MD, '/path/to/task.md');

    expect(task.notes).toBe('[2026-03-01] Started work.');
  });

  it('handles missing sections gracefully', () => {
    const minimal = `---
id: task-minimal
title: Minimal task
status: pending
priority: low
blockedBy: []
blocks: []
createdAt: "2026-03-01T00:00:00.000Z"
updatedAt: "2026-03-01T00:00:00.000Z"
completedAt: null
---

Just a description, no sections.
`;
    const task = parseTaskMarkdown(minimal, '/path/to/task.md');

    expect(task.id).toBe('task-minimal');
    expect(task.description).toBe('Just a description, no sections.');
    expect(task.steps).toEqual([]);
    expect(task.userRequest).toBeUndefined();
    expect(task.acceptanceCriteria).toBeUndefined();
    expect(task.notes).toBeUndefined();
  });

  it('handles empty frontmatter arrays', () => {
    const md = `---
id: task-empty-arrays
title: Empty arrays
status: pending
priority: medium
blockedBy: []
blocks: []
createdAt: "2026-03-01T00:00:00.000Z"
updatedAt: "2026-03-01T00:00:00.000Z"
completedAt: null
---
`;
    const task = parseTaskMarkdown(md, '/path/to/task.md');

    expect(task.blockedBy).toEqual([]);
    expect(task.blocks).toEqual([]);
  });

  it('handles title with special characters', () => {
    const md = `---
id: task-special
title: "Fix: handle 'quotes' and colons"
status: pending
priority: high
blockedBy: []
blocks: []
createdAt: "2026-03-01T00:00:00.000Z"
updatedAt: "2026-03-01T00:00:00.000Z"
completedAt: null
---
`;
    const task = parseTaskMarkdown(md, '/path/to/task.md');

    expect(task.title).toBe("Fix: handle 'quotes' and colons");
  });

  it('handles completedAt: null correctly', () => {
    const md = `---
id: task-null-completed
title: Null completed
status: pending
priority: medium
blockedBy: []
blocks: []
createdAt: "2026-03-01T00:00:00.000Z"
updatedAt: "2026-03-01T00:00:00.000Z"
completedAt: null
---
`;
    const task = parseTaskMarkdown(md, '/path/to/task.md');
    expect(task.completedAt).toBeNull();
  });

  it('handles completedAt with actual date', () => {
    const md = `---
id: task-completed
title: Completed task
status: completed
priority: medium
blockedBy: []
blocks: []
createdAt: "2026-03-01T00:00:00.000Z"
updatedAt: "2026-03-02T00:00:00.000Z"
completedAt: "2026-03-02T12:00:00.000Z"
---
`;
    const task = parseTaskMarkdown(md, '/path/to/task.md');
    expect(task.completedAt).toBe('2026-03-02T12:00:00.000Z');
  });

  it('preserves unknown sections', () => {
    const md = `---
id: task-unknown
title: Unknown sections
status: pending
priority: medium
blockedBy: []
blocks: []
createdAt: "2026-03-01T00:00:00.000Z"
updatedAt: "2026-03-01T00:00:00.000Z"
completedAt: null
---

Description here.

## Custom Section
Some custom content here.

## Steps
- [ ] Do something
`;
    const task = parseTaskMarkdown(md, '/path/to/task.md');

    expect(task.description).toBe('Description here.');
    expect(task.steps).toHaveLength(1);
    // Unknown section should be preserved
    expect((task as any)._unknownSections).toBeDefined();
    expect((task as any)._unknownSections).toHaveLength(1);
    expect((task as any)._unknownSections[0].heading).toBe('## Custom Section');
  });

  it('defaults missing blockedBy/blocks to empty arrays', () => {
    const md = `---
id: task-no-deps
title: No deps
status: pending
priority: medium
createdAt: "2026-03-01T00:00:00.000Z"
updatedAt: "2026-03-01T00:00:00.000Z"
completedAt: null
---
`;
    const task = parseTaskMarkdown(md, '/path/to/task.md');
    expect(task.blockedBy).toEqual([]);
    expect(task.blocks).toEqual([]);
  });
});

describe('serializeTaskMarkdown', () => {
  it('serializes a full task to markdown', () => {
    const task: Task = {
      id: 'task-ser',
      title: 'Serialization test',
      status: 'in_progress',
      priority: 'high',
      category: 'feature',
      blockedBy: ['task-a'],
      blocks: ['task-b', 'task-c'],
      steps: [
        { label: 'First step', completed: true },
        { label: 'Second step', completed: false },
      ],
      filePath: '/path/to/task.md',
      description: 'This is the description.',
      userRequest: 'Please add this feature',
      acceptanceCriteria: '1. It works\n2. It tests well',
      notes: '[2026-03-01] Started.',
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-02T00:00:00.000Z',
      completedAt: null,
    };

    const md = serializeTaskMarkdown(task);

    expect(md).toContain('id: task-ser');
    expect(md).toContain('title: Serialization test');
    expect(md).toContain('status: in_progress');
    expect(md).toContain('priority: high');
    expect(md).toContain('This is the description.');
    expect(md).toContain('## Steps');
    expect(md).toContain('- [x] First step');
    expect(md).toContain('- [ ] Second step');
    expect(md).toContain('## User Request');
    expect(md).toContain('> Please add this feature');
    expect(md).toContain('## Acceptance Criteria');
    expect(md).toContain('## Notes');
    expect(md).toContain('[2026-03-01] Started.');
  });

  it('omits empty sections', () => {
    const task: Task = {
      id: 'task-minimal',
      title: 'Minimal',
      status: 'pending',
      priority: 'medium',
      blockedBy: [],
      blocks: [],
      steps: [],
      description: 'Just a description.',
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
      completedAt: null,
    };

    const md = serializeTaskMarkdown(task);

    expect(md).toContain('Just a description.');
    expect(md).not.toContain('## Steps');
    expect(md).not.toContain('## User Request');
    expect(md).not.toContain('## Notes');
  });
});

describe('round-trip', () => {
  it('parse → serialize → parse produces same Task', () => {
    const original = parseTaskMarkdown(FULL_MD, '/path/to/task-m6.md');
    const serialized = serializeTaskMarkdown(original);
    const reparsed = parseTaskMarkdown(serialized, '/path/to/task-m6.md');

    // Compare key fields (filePath will match since we pass same path)
    expect(reparsed.id).toBe(original.id);
    expect(reparsed.title).toBe(original.title);
    expect(reparsed.status).toBe(original.status);
    expect(reparsed.priority).toBe(original.priority);
    expect(reparsed.category).toBe(original.category);
    expect(reparsed.blockedBy).toEqual(original.blockedBy);
    expect(reparsed.blocks).toEqual(original.blocks);
    expect(reparsed.description).toBe(original.description);
    expect(reparsed.userRequest).toBe(original.userRequest);
    expect(reparsed.acceptanceCriteria).toBe(original.acceptanceCriteria);
    expect(reparsed.notes).toBe(original.notes);
    expect(reparsed.steps).toEqual(original.steps);
    expect(reparsed.completedAt).toBe(original.completedAt);
  });

  it('handles a task with no optional fields', () => {
    const task: Task = {
      id: 'task-bare',
      title: 'Bare minimum',
      status: 'pending',
      priority: 'low',
      blockedBy: [],
      blocks: [],
      steps: [],
      description: '',
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
      completedAt: null,
    };

    const md = serializeTaskMarkdown(task);
    const reparsed = parseTaskMarkdown(md, '/path/to/task.md');

    expect(reparsed.id).toBe('task-bare');
    expect(reparsed.title).toBe('Bare minimum');
    expect(reparsed.steps).toEqual([]);
    expect(reparsed.blockedBy).toEqual([]);
    expect(reparsed.blocks).toEqual([]);
  });
});
