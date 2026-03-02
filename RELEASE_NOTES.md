# SubFrame v0.1.0-beta.1

The first public beta of SubFrame — a terminal-centric IDE for Claude Code. This release marks a ground-up rebuild: the entire codebase has been migrated from JavaScript to strict TypeScript, and the renderer has been rewritten in React 19 with a modern component architecture.

## What's Changed

### Architecture

- **TypeScript Migration** — Full codebase converted from JavaScript to TypeScript with strict mode enabled
- **React 19 Renderer** — Renderer rebuilt from vanilla DOM manipulation to React 19 + Zustand + TanStack Query
- **shadcn/ui + Tailwind CSS v4** — New component library and design system with warm neutral theme and amber accents
- **CodeMirror 6 Editor** — Custom SubFrame theme with language-aware syntax highlighting
- **Typed IPC Channels** — String-based channel names replaced with typed definitions in `ipcChannels.ts`
- **Framer Motion** — Smooth animations throughout the UI
- **esbuild Bundler** — Fast builds for main process with custom React bundler for the renderer

### Features

- **Agent Activity Monitor** — Real-time timeline of AI tool calls (Read, Edit, Bash) with color-coded entries
- **SubFrame Health Panel** — Component health dashboard for all SubFrame files, hooks, skills, and git integration with one-click updates
- **Sub-Task System** — Markdown-based task tracking with YAML frontmatter and CLI tool (`scripts/task.js`)
- **Task Views** — Kanban board, timeline (Gantt-style), and dependency graph views for task management
- **Skills System** — Slash commands (`/sub-tasks`, `/sub-audit`, `/sub-docs`, `/release`, `/sub-ipc`) for specialized AI capabilities
- **Hooks & Automation** — Five Claude Code hooks (SessionStart, UserPromptSubmit, Stop, PreToolUse, PostToolUse) for context injection and task matching
- **Initialize Workspace** — One-click project setup creating AGENTS.md, STRUCTURE.json, PROJECT_NOTES.md, task tracking, hooks, and skills
- **Project Overview Panel** — Decisions log, module stats, and context preservation dashboard
- **Multi-AI Support** — Switch between Claude Code, Codex CLI, and Gemini CLI with toolbar selector
- **File Previews** — Markdown, HTML, and image preview panels in the editor
- **Keyboard Shortcuts** — Comprehensive shortcut system with help overlay

### Documentation

- **VitePress Docs Site** — Custom-themed documentation at axiom-labs.cloud
- **Animated Logo** — SubFrame atom logo with orbiting electrons, pulsing nucleus, and frame outline
- **Blog Posts** — Five articles covering Why SubFrame, Context Preservation, Multi-AI Support, SubFrame Server, and Initialize Workspace
- **Interactive Showcase** — Feature cards with SVG mockups on the landing page
- **Comprehensive README** — Full feature coverage with screenshots and getting started guide

### Developer Experience

- **CI Workflow** — GitHub Actions running typecheck + lint + test on push and PR
- **Docs Deployment** — Automated VitePress deployment via GitHub Actions
- **Release Workflow** — Automated Electron builds for macOS (dmg) and Windows (nsis)
- **ESLint + Prettier** — Configured for TypeScript and TSX
- **Vitest** — Test framework with shared utility tests
- **Pre-commit Hook** — Automatic STRUCTURE.json updates on commit

### Infrastructure

- **electron-builder** — Build configuration for macOS and Windows installers
- **ADRs** — Six architectural decision records documenting key choices
- **Internal Docs** — Architecture overview, IPC channel reference, and changelog

---

> This is a beta release. Expect rough edges — please report issues on GitHub.
