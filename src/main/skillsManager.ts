/**
 * Skills Manager Module
 * Scans .claude/skills/ for SKILL.md files and returns skill metadata.
 * Managed skills (sub-tasks, sub-docs, sub-audit) are compared against
 * frameTemplates to determine health status.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { IpcMain } from 'electron';
import { IPC } from '../shared/ipcChannels';
import type { SkillInfo } from '../shared/ipcChannels';
import { getSubTasksSkillTemplate, getSubDocsSkillTemplate, getSubAuditSkillTemplate } from '../shared/frameTemplates';

const SKILLS_DIR = path.join('.claude', 'skills');
const MANAGED_SKILLS: Record<string, () => string> = {
  'sub-tasks': getSubTasksSkillTemplate,
  'sub-docs': getSubDocsSkillTemplate,
  'sub-audit': getSubAuditSkillTemplate,
};

/**
 * Parse YAML frontmatter from a SKILL.md file.
 * Returns { frontmatter, content } where content is the body after the closing ---.
 */
function parseFrontmatter(raw: string): { frontmatter: Record<string, string>; content: string } {
  const fm: Record<string, string> = {};
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { frontmatter: fm, content: raw };

  const yamlBlock = match[1];
  const content = match[2];

  for (const line of yamlBlock.split(/\r?\n/)) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    fm[key] = value;
  }

  return { frontmatter: fm, content };
}

/**
 * Load all skills from a project's .claude/skills/ directory.
 */
function loadSkills(projectPath: string): SkillInfo[] {
  const skillsDir = path.join(projectPath, SKILLS_DIR);

  if (!fs.existsSync(skillsDir)) return [];

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const skills: SkillInfo[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const skillMdPath = path.join(skillsDir, entry.name, 'SKILL.md');
    if (!fs.existsSync(skillMdPath)) continue;

    let raw: string;
    try {
      raw = fs.readFileSync(skillMdPath, 'utf8');
    } catch {
      continue;
    }

    const { frontmatter, content } = parseFrontmatter(raw);
    const isManaged = entry.name in MANAGED_SKILLS;

    let healthStatus: SkillInfo['healthStatus'];
    if (isManaged) {
      const templateFn = MANAGED_SKILLS[entry.name];
      const expected = templateFn();
      // Compare frontmatter blocks — managed skills are "healthy" if the
      // first 5 non-empty lines of the frontmatter match.
      const normalize = (s: string) => s.replace(/\r\n/g, '\n').trim();
      healthStatus = normalize(raw) === normalize(expected) ? 'healthy' : 'outdated';
    }

    skills.push({
      id: entry.name,
      name: frontmatter['name'] || entry.name,
      command: `/${frontmatter['name'] || entry.name}`,
      description: frontmatter['description'] || '',
      argumentHint: frontmatter['argument-hint'] || '',
      disableModelInvocation: frontmatter['disable-model-invocation'] === 'true',
      allowedTools: frontmatter['allowed-tools']
        ? frontmatter['allowed-tools'].split(',').map((t) => t.trim()).filter(Boolean)
        : [],
      content,
      isManaged,
      healthStatus,
    });
  }

  // Sort: managed first, then alphabetical
  skills.sort((a, b) => {
    if (a.isManaged && !b.isManaged) return -1;
    if (!a.isManaged && b.isManaged) return 1;
    return a.name.localeCompare(b.name);
  });

  return skills;
}

/**
 * Setup IPC handlers
 */
function setupIPC(ipcMain: IpcMain): void {
  ipcMain.handle(IPC.LOAD_SKILLS, (_event, projectPath: string) => {
    return loadSkills(projectPath);
  });
}

export { setupIPC };
