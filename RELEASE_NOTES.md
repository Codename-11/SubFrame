Fix release — CLI commands no longer hijack the running SubFrame instance.

## What's Changed

### Bug Fixes
- **CLI edit spawns standalone window** - `subframe edit <file>` now opens a new standalone editor window instead of silently sending to the running instance. Your existing workspace is never touched.
- **CLI open is non-disruptive** - `subframe open <dir>` adds the project to your workspace without switching the active project. No more losing context mid-work.
