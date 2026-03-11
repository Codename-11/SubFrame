This release adds global prompt management to the sidebar, first-launch seed prompts, new template variables for prompt content, and safety guards on all AI tool spawn paths.

## What's Changed

### Features
- **Global Prompts in Sidebar** - PromptsPanel now shows both global and project prompts with a scope toggle (All / Global / Project), scope badges, and full scope-aware CRUD including scope-change-as-move
- **Seed Prompts** - 7 starter prompts auto-seeded on first launch: Quick Audit, Explain This, Refactor Suggestions, Write Tests, PR Description, Security Review, and Summarize Session
- **New Template Variables** - `{{branch}}` (current git branch), `{{date}}` (today's date), `{{aiTool}}` (active AI tool name) join existing `{{project}}`, `{{projectPath}}`, `{{file}}` — all resolved at insert time from live data
- **AI Tool Install Guards** - Task enhance, pipeline stages, and onboarding now verify the AI tool is installed before spawning, with actionable error messages
- **AI Tool Recheck** - Settings panel shows a recheck button to re-detect tool installation without restarting

### Improvements
- **Async Tool Detection** - AI tool install detection converted from blocking `execSync` to async `execFile` across the full call chain, eliminating UI freezes
- **AIToolPalette** - Renamed from AIToolSelector, now warns when binding an uninstalled tool to a project
- **"Agents" Tab** - "Agent Activity" tab shortened to "Agents" in the view tab bar

### Bug Fixes
- **Menu Start for Uninstalled Tools** - Start menu item now disabled when the active AI tool is not installed
- **Onboarding Duplicate Check** - Removed standalone install check in favor of shared aiToolManager cache
- **Recheck Toast Timing** - Settings and AIToolPalette now await refetch before showing success toast
