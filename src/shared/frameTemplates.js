/**
 * Frame Templates
 * Templates for auto-generated Frame project files
 * Each template includes instructions header for Claude Code
 */

/**
 * Get current date in YYYY-MM-DD format
 */
function getDateString() {
  return new Date().toISOString().split('T')[0];
}

/**
 * STRUCTURE.json template
 */
function getStructureTemplate(projectName) {
  return {
    _frame_metadata: {
      purpose: "Project structure and module map for AI assistants",
      forClaude: "Read this file FIRST when starting work on this project. It contains the module structure, data flow, and conventions. Update this file when you add new modules or change the architecture.",
      lastUpdated: getDateString(),
      generatedBy: "Frame"
    },
    version: "1.0",
    description: `${projectName} - update this description`,
    architecture: {
      type: "",
      entryPoint: "",
      notes: ""
    },
    modules: {},
    dataFlow: [],
    conventions: {}
  };
}

/**
 * PROJECT_NOTES.md template
 */
function getNotesTemplate(projectName) {
  const date = getDateString();
  return `<!-- FRAME AUTO-GENERATED FILE -->
<!-- Purpose: Project notes, decisions, and context for AI assistants -->
<!-- For Claude: Read this to understand project history, decisions made, and current context. Update this file with important decisions, context, and notes during development sessions. -->
<!-- Last Updated: ${date} -->

# ${projectName} - Project Notes

## Overview
*Brief description of what this project does*

## Current Status
*What state is the project in? What's the current focus?*

## Key Decisions
*Important architectural or design decisions and their rationale*

| Decision | Rationale | Date |
|----------|-----------|------|
| | | |

## Session Log
*Brief notes from development sessions*

### ${date}
- Initial Frame project setup

## Known Issues
*Current bugs or limitations*

- None yet

## Next Steps
*What should be worked on next*

1.

## Context for Claude
*Special instructions or context for AI assistants*

- Read STRUCTURE.json for module architecture
- Check todos.json for pending tasks
- Follow existing code patterns and conventions
`;
}

/**
 * todos.json template
 */
function getTodosTemplate(projectName) {
  return {
    _frame_metadata: {
      purpose: "Task tracking for the project",
      forClaude: "Check this file to understand what tasks are pending, in progress, or completed. Update task status as you work. Add new tasks when discovered during development.",
      lastUpdated: getDateString(),
      generatedBy: "Frame"
    },
    project: projectName,
    lastUpdated: new Date().toISOString(),
    todos: {
      pending: [],
      inProgress: [],
      completed: []
    },
    categories: {
      feature: "New features",
      fix: "Bug fixes",
      refactor: "Code improvements",
      docs: "Documentation",
      test: "Testing"
    }
  };
}

/**
 * QUICKSTART.md template
 */
function getQuickstartTemplate(projectName) {
  const date = getDateString();
  return `<!-- FRAME AUTO-GENERATED FILE -->
<!-- Purpose: Quick onboarding guide for developers and AI assistants -->
<!-- For Claude: Read this FIRST to quickly understand how to work with this project. Contains setup instructions, common commands, and key files to know. -->
<!-- Last Updated: ${date} -->

# ${projectName} - Quick Start Guide

## Setup

\`\`\`bash
# Clone and install
git clone <repo-url>
cd ${projectName}
npm install  # or appropriate package manager
\`\`\`

## Common Commands

\`\`\`bash
# Development
npm run dev

# Build
npm run build

# Test
npm test
\`\`\`

## Key Files

| File | Purpose |
|------|---------|
| \`STRUCTURE.json\` | Module map and architecture |
| \`PROJECT_NOTES.md\` | Decisions and context |
| \`todos.json\` | Task tracking |
| \`QUICKSTART.md\` | This file |

## Project Structure

\`\`\`
${projectName}/
├── .frame/           # Frame configuration
├── src/              # Source code
└── ...
\`\`\`

## For AI Assistants (Claude)

1. **First**: Read \`STRUCTURE.json\` for architecture overview
2. **Then**: Check \`PROJECT_NOTES.md\` for current context and decisions
3. **Check**: \`todos.json\` for pending tasks
4. **Follow**: Existing code patterns and conventions
5. **Update**: These files as you make changes

## Quick Context

*Add a brief summary of what this project does and its current state here*
`;
}

/**
 * .frame/config.json template
 */
function getFrameConfigTemplate(projectName) {
  return {
    version: "1.0",
    name: projectName,
    description: "",
    createdAt: new Date().toISOString(),
    initializedBy: "Frame",
    settings: {
      autoUpdateStructure: true,
      autoUpdateNotes: false
    },
    files: {
      structure: "STRUCTURE.json",
      notes: "PROJECT_NOTES.md",
      todos: "todos.json",
      quickstart: "QUICKSTART.md"
    }
  };
}

module.exports = {
  getStructureTemplate,
  getNotesTemplate,
  getTodosTemplate,
  getQuickstartTemplate,
  getFrameConfigTemplate
};
