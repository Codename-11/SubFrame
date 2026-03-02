---
id: task-react-ts-refactor
title: Full UI refactor to React + TypeScript
status: completed
priority: high
category: refactor
blockedBy: []
blocks: []
createdAt: '2026-03-01T20:00:00Z'
updatedAt: '2026-03-01T22:58:25.740Z'
completedAt: '2026-03-01T22:58:25.740Z'
context: >-
  Session 2026-03-01 - Major architecture evolution from vanilla JS to React +
  TypeScript. Full plan in PROJECT_NOTES.md.
---
Complete refactor of SubFrame from vanilla JavaScript with imperative DOM manipulation to a modern React + TypeScript stack. This is a multi-phase effort covering the entire codebase.

**Technology Stack:**
- **React 19** — component architecture, hooks, Suspense for lazy-loaded panels
- **TypeScript** (strict mode) — type safety across main, renderer, shared, and IPC layer
- **Zustand** — lightweight global state (UI state: active panel, terminal IDs, sidebar width, view mode)
- **TanStack Query** — IPC call caching, loading/error states, invalidation (file tree, sessions, tasks, overview)
- **TanStack Table** — headless table for tasks list, sessions list with built-in sorting, filtering, column management
- **shadcn/ui** — component library built on Radix UI primitives (buttons, modals/dialogs, tabs, dropdowns, tooltips, context menus, command palette, forms, toasts). Implies **Tailwind CSS** as the styling system.
- **Tailwind CSS v4** — replaces the hand-written CSS files (variables.css, main.css, layout.css, panels.css, terminal.css, ui.css). SubFrame's warm-neutral + amber accent design tokens map to Tailwind theme config / shadcn CSS variables.
- **Framer Motion** — declarative animations for panel open/close, modal transitions, list reorder, AnimatePresence for exit animations, layout animations for sidebar resize.
- **esbuild** (kept) — already supports TSX natively, sub-second builds preserved.

**Scope:**

**Phase 1 — Foundation (TypeScript + Tailwind + Build)**
- Add `tsconfig.json` configs (separate for main, renderer, shared) with strict mode
- Update esbuild config for `.tsx` entry point and JSX transform
- Install and configure Tailwind CSS v4 with PostCSS (esbuild plugin or separate step)
- Initialize shadcn/ui (`npx shadcn@latest init`) — configure theme with SubFrame's warm-neutral palette (--background, --foreground, --accent mapped from current --bg-primary, --text-primary, --accent-primary #d4a574)
- Add dependencies: `react`, `react-dom`, `zustand`, `@tanstack/react-query`, `@tanstack/react-table`, `framer-motion`, `tailwindcss`, `@types/react`, `@types/react-dom`, `@types/node`, `typescript`, plus shadcn peer deps (`class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`)
- Convert `src/shared/ipcChannels.js` → `ipcChannels.ts` with typed channel map (backbone — every IPC call becomes type-safe)
- Convert remaining shared modules: `frameConstants.ts`, `frameTemplates.ts`, `backlinkUtils.ts`, `projectInit.ts`
- Create typed IPC utility: `typedInvoke<Channel>(...args): Promise<ReturnType>` for renderer, `typedHandle<Channel>(handler)` for main
- Create TanStack Query wrapper hooks for IPC: `useIpcQuery(channel, args)` and `useIpcMutation(channel)`

**Phase 2 — Main Process (TypeScript only, no React)**
- Convert all 20 main process files from `.js` to `.ts`
- Add interfaces for all manager modules (e.g., `ISettingsManager`, `IWorkspace`, `IPtyManager`)
- Type all `ipcMain.handle` / `ipcMain.on` handlers with the typed IPC utility
- Type node-pty instances, Electron BrowserWindow, and menu builders
- Files: index.js, ptyManager.js, pty.js, workspace.js, settingsManager.js, tasksManager.js, pluginsManager.js, claudeSessionsManager.js, overviewManager.js, frameProject.js, fileTree.js, fileEditor.js, gitBranchesManager.js, githubManager.js, promptLogger.js, claudeUsageManager.js, aiToolManager.js, aiFilesManager.js, menu.js, dialogs.js

**Phase 3 — Renderer: React + shadcn Components**
- Replace `index.html` monolithic structure with a single `<div id='root'>` + React mount
- Set up providers: `<QueryClientProvider>` (TanStack Query), Zustand stores (no provider needed)
- Install shadcn components as needed: `button`, `dialog`, `tabs`, `dropdown-menu`, `context-menu`, `command`, `input`, `textarea`, `badge`, `tooltip`, `toast`/`sonner`, `separator`, `scroll-area`, `resizable` (for sidebar/panels), `sheet` (for mobile-style slide panels), `table`
- Create React component tree:
  - `<App>` — root layout with `<ResizablePanelGroup>` (shadcn resizable) for sidebar + main + right panel
  - `<Sidebar>` — workspace `<DropdownMenu>`, project list, action `<Button>`s
  - `<FileTree>` — recursive tree with expand/collapse via `<Collapsible>`, icons from `lucide-react`
  - `<TerminalArea>` — `<Tabs>` (shadcn) for tab bar + terminal grid container
  - `<Terminal>` — xterm.js wrapper with useEffect lifecycle, `<ContextMenu>` for right-click (shadcn)
  - `<Editor>` — file editor as `<Dialog>` or `<Sheet>` overlay
  - `<RightPanel>` — `<Tabs>` container for sub-panels
  - `<TasksPanel>` — TanStack Table for task list with sorting/filtering, `<Dialog>` for add/edit modal with shadcn form components, `<Badge>` for status/priority
  - `<SessionsPanel>` — TanStack Table for session list with sorting by date/status, split `<Button>` for resume
  - `<PluginsPanel>` — plugin cards
  - `<SettingsPanel>` — `<Dialog>` with `<Tabs>` sections (General, AI Tool, Terminal)
  - `<OverviewPanel>` — dashboard cards with `<motion.div>` entry animations
  - `<AIFilesPanel>` — status indicators + action `<Button>`s
  - `<GithubPanel>` — PR/issue list
  - `<ProjectListUI>` — project cards in sidebar
  - `<AIToolSelector>` — `<DropdownMenu>` or `<Command>` palette for tool selection
  - `<StructureMap>` — D3 visualization via useRef + useEffect (D3 manages its own DOM subtree)
- Zustand stores: `useUIStore` (sidebar state, active panel, view mode), `useProjectStore` (active project, workspace), `useTerminalStore` (terminal IDs, active terminal, grid layout)
- TanStack Query hooks: `useFileTree(projectPath)`, `useTasks(projectPath)`, `useSessions()`, `useOverview()`, `usePlugins()`, `useSettings()`
- TanStack Table instances: `useTasksTable()` with column defs for title/status/priority/category/date + sorting + filtering, `useSessionsTable()` with column defs for title/date/branch/messages/state + sorting
- Framer Motion: `<AnimatePresence>` for panel show/hide, `<motion.div>` with `layout` prop for sidebar resize, `<Reorder>` for draggable terminal tabs, staggered list animations for task/session entries

**Phase 4 — Styles Migration (CSS → Tailwind)**
- Delete hand-written CSS files: variables.css, main.css, layout.css, panels.css, terminal.css, ui.css
- Map current design tokens to Tailwind theme:
  - `--bg-primary: #0f0f10` → `--background` in shadcn theme
  - `--bg-secondary: #1a1a1c` → `--card` / `--muted`
  - `--accent-primary: #d4a574` → `--primary` (amber accent preserved)
  - `--text-primary: #e8e6e3` → `--foreground`
  - Spacing scale (`--space-xs` through `--space-xl`) → Tailwind spacing utilities
  - Semantic colors (`--success`, `--warning`, `--error`) → custom Tailwind colors
- Keep `xterm.css` (xterm.js's own stylesheet — not ours to replace)
- Font setup: DM Sans + JetBrains Mono configured in Tailwind fontFamily
- Dark mode: shadcn's `dark` class on root (SubFrame is dark-only, so hardcode this)

**Phase 5 — Testing & Cleanup**
- Remove all 20 vanilla renderer `.js` files
- Remove dead HTML markup from index.html
- Remove old CSS files (replaced by Tailwind + shadcn)
- Verify all IPC channels work end-to-end with typed system
- Test xterm.js lifecycle in React (mount, unmount, resize, fit)
- Test TanStack Table sorting/filtering on tasks and sessions
- Test all shadcn components render correctly in Electron (no browser-only APIs)
- Test Framer Motion animations don't cause layout thrashing
- Test all panel toggles, modals, keyboard shortcuts, context menus
- Cross-platform verification (Windows + macOS)
- Update esbuild scripts, dev.js, STRUCTURE.json
- Update CLAUDE.md CSS Design System section to reference Tailwind + shadcn instead of variables.css

**Key technical considerations:**
- xterm.js in React requires careful lifecycle management — Terminal instance must be created in useEffect, disposed on unmount, and fit() called on resize via ResizeObserver
- shadcn/ui in Electron: components are copied into the project (not a node_module), so no CDN or network dependency — works offline
- Tailwind CSS in Electron: PostCSS build step integrates with esbuild via plugin or as a pre-build step
- TanStack Table is headless — shadcn's `<Table>` component provides the styling, TanStack provides the logic (sorting, filtering, column visibility)
- TanStack Query `queryClient.invalidateQueries(['fileTree'])` triggered by fs.watch events from main process = automatic UI refresh
- Framer Motion `AnimatePresence` requires components to have `key` props and `exit` animations — plan component structure accordingly
- node-pty stays server-side (main process) — only the IPC transport changes type signatures
- Electron's contextBridge/preload pattern stays the same — React just calls the exposed API
- The two-phase init (initCritical/initDeferred) maps to React.lazy + Suspense for deferred panels
- D3.js coexists with React via useRef + useEffect (D3 manages its own DOM subtree within a ref'd container)

**Dependency additions:**
- Production: `react`, `react-dom`, `zustand`, `@tanstack/react-query`, `@tanstack/react-table`, `framer-motion`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`
- Dev: `typescript`, `@types/react`, `@types/react-dom`, `@types/node`, `tailwindcss`, `postcss`, `autoprefixer`
- shadcn components: installed via CLI into `src/renderer/components/ui/` (not a dependency — source code copied in)

**Files affected:** Every file in src/renderer/ (20 files rewritten to TSX), every file in src/main/ (20 files converted to TS), every file in src/shared/ (6 files converted to TS), all 6 CSS files (deleted/replaced by Tailwind), index.html (simplified), package.json, esbuild config, plus new: tsconfig.json files, tailwind.config.ts, postcss.config.js, components.json (shadcn config), src/renderer/components/ui/ directory. ~52 files total affected.

## User Request
> User said: 'I want you to ref our docs/refs etc - Create a proper subtask to implement a full refactor of our UI to use React and TypeScript-etc'. Follow-up: User chose 'Moderate — React + Zustand + TanStack Query' stack, then added: 'plus shadcn and framermotion etc' and 'we should add table so we can add proper sorting/filtering etc cleanly' (TanStack Table).

## Acceptance Criteria
1. TypeScript compiles with strict mode — zero `any` escape hatches in new code. 2. All IPC channels are type-safe (channel name → payload → return type). 3. All 20 renderer modules are React TSX components with proper hooks (no imperative DOM manipulation). 4. xterm.js terminals mount/unmount cleanly in React lifecycle without memory leaks. 5. Zustand stores for UI state — no global mutable state object. 6. TanStack Query wraps all IPC data-fetching calls with proper caching and invalidation. 7. TanStack Table powers tasks list and sessions list with working sort + filter. 8. shadcn/ui components used for all interactive elements (buttons, dialogs, tabs, dropdowns, context menus, toasts, forms). 9. Tailwind CSS is the sole styling system — no hand-written CSS files remain (except xterm.css). 10. SubFrame's warm-neutral + amber accent design preserved in Tailwind theme config. 11. Framer Motion animations on panel transitions, modal open/close, list items. 12. All existing features work identically: multi-terminal (tabs + grid), file tree, editor, all panels (tasks, plugins/sessions, settings, overview, AI files, GitHub), sidebar resize, keyboard shortcuts, workspace switching. 13. Main process fully typed in TypeScript. 14. Shared modules fully typed with exported interfaces. 15. Build still works via esbuild (sub-second builds preserved). 16. Cross-platform: Windows + macOS verified. 17. index.html reduced to minimal shell (React root div + loading screen). 18. No regressions in startup performance (splash screen, deferred panel loading via Suspense).

## Notes
This is the largest refactor in SubFrame's history. Full implementation plan written to .subframe/PROJECT_NOTES.md [2026-03-01] section with exact configs, commands, migration order, and risk mitigations.

**Research completed (4-agent team):**
- Renderer: 20 files, 9,100 lines, all DOM patterns + module dependencies mapped
- IPC: 154 channels traced (28 handle, 126 on) — 35 query candidates, 40 mutation candidates, 10 streams
- CSS: 7,158 lines, 41 design tokens, 15 keyframe animations, 913 selectors, full Tailwind mapping
- Stack: shadcn manual setup confirmed (rsc:false), Tailwind v4 via esbuild-plugin-tailwindcss v2.x, TanStack Query wraps ipcRenderer.invoke() directly, React 19 works on Electron 28 (but v28 is EOL — upgrade recommended), Framer Motion hardware-accelerated in Electron, DIY xterm.js hook recommended over wrappers

**Stack decision rationale:**
- **Zustand over Redux/Context**: SubFrame's state is simple UI state + server-derived data. Zustand is ~1KB, zero boilerplate, works outside React (keyboard handlers).
- **TanStack Query for IPC**: Wraps ipcRenderer.invoke() with caching, stale-while-revalidate, loading/error states. queryClient.invalidateQueries() triggered by fs.watch = automatic UI refresh.
- **TanStack Table for lists**: Tasks panel needs sort by priority/status/date + text filter. Sessions panel needs sort by date/state + search. Headless — shadcn provides styled `<Table>` shell.
- **shadcn/ui**: Accessible, themed components copied into project (no runtime dependency). Built on Radix UI primitives. Works offline in Electron.
- **Tailwind v4**: CSS-first config (no tailwind.config.js). @theme directive replaces variables.css. Dark-mode-only simplifies config.
- **Framer Motion**: AnimatePresence enables exit animations (impossible with CSS). Layout animations for sidebar resize.

**Migration order (leaf → root):** state.js → sidebarResize → aiToolSelector → editor → fileTree → projectList → historyPanel → terminal system → all panels → overviewPanel → structureMap → App root.

**Critical finding:** Electron 28 is EOL since Oct 2025 — bundle upgrade to v33+ in Phase 0.

Some existing pending sub-tasks (task-subtask-enhancements, task-subtask-ux, task-terminal-warp) will be significantly easier to implement AFTER this refactor. The SubFrame Server (web app mode) future vision also benefits — React + Tailwind components work identically in Electron and browser.
