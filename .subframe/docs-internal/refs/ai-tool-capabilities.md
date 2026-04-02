# AI Tool Capabilities Reference

> **Last verified:** 2026-03-31
>
> AI tool CLIs evolve rapidly. Before assuming a capability exists (or doesn't),
> check the live documentation links below. Update this file when capabilities change.

## Live Documentation

| Tool | Hooks Docs | CLI Reference | Changelog |
|------|-----------|---------------|-----------|
| **Claude Code** | [code.claude.com/docs/en/hooks](https://code.claude.com/docs/en/hooks) | [code.claude.com/docs/en/cli](https://code.claude.com/docs/en/cli) | [claude-code releases](https://github.com/anthropics/claude-code/releases) |
| **Codex CLI** | [developers.openai.com/codex/hooks](https://developers.openai.com/codex/hooks) | [developers.openai.com/codex/cli/reference](https://developers.openai.com/codex/cli/reference) | [developers.openai.com/codex/changelog](https://developers.openai.com/codex/changelog) |
| **Gemini CLI** | [geminicli.com/docs/hooks/reference](https://geminicli.com/docs/hooks/reference/) | [geminicli.com/docs](https://geminicli.com/docs/) | [geminicli.com/docs/changelogs/latest](https://geminicli.com/docs/changelogs/latest/) |

## Hook Event Matrix

Event names differ per tool. This table maps equivalent events.

| Capability | Claude Code | Codex CLI | Gemini CLI |
|------------|:-----------:|:---------:|:----------:|
| Pre-tool hook | `PreToolUse` | `PreToolUse` | `BeforeTool` |
| Post-tool hook | `PostToolUse` | `PostToolUse` | `AfterTool` |
| Session start | `SessionStart` | `SessionStart` | `SessionStart` |
| Session end | `SessionEnd` | — | `SessionEnd` |
| Stop / after-agent | `Stop` | `Stop` | `AfterAgent` |
| User prompt submit | `UserPromptSubmit` | `UserPromptSubmit` | `BeforeAgent` |
| Notification | `Notification` | — | `Notification` |
| Permission control | `PermissionRequest` | — | — |
| Post-tool failure | `PostToolUseFailure` | — | — |
| Subagent lifecycle | `SubagentStart/Stop` | — | — |
| Task lifecycle | `TaskCreated/Completed` | — | — |
| Compaction | `PreCompact/PostCompact` | — | `PreCompress` |
| Config change | `ConfigChange` | — | — |
| File/dir watch | `FileChanged/CwdChanged` | — | — |
| Instructions loaded | `InstructionsLoaded` | — | — |
| Model-level hooks | — | — | `BeforeModel/AfterModel` |
| Tool selection | — | — | `BeforeToolSelection` |
| Worktree hooks | `WorktreeCreate/Remove` | — | — |
| Elicitation | `Elicitation/Result` | — | — |
| Teammate idle | `TeammateIdle` | — | — |

## Feature Support Matrix

| Feature | Claude Code | Codex CLI | Gemini CLI |
|---------|:-----------:|:---------:|:----------:|
| Hook system | Yes (20+ events) | Yes (5 events, v0.114+) | Yes (12+ events) |
| Hook maturity | Mature | Early-stage | Comprehensive |
| Block via exit code 2 | Yes | Yes | Yes |
| JSON control output | Yes | Yes | Yes |
| Regex matchers | Yes | Yes | Yes |
| `if` field filtering | Yes (v2.1.85+) | — | — |
| Command hooks | Yes | Yes | Yes |
| HTTP hooks | Yes | — | — |
| Prompt-based hooks | Yes (`type: "prompt"`) | — | — |
| Agent-based hooks | Yes (`type: "agent"`) | — | — |
| Plugin hooks (npm) | — | — | Yes |
| Streaming output | `--output-format stream-json` | `--json` (NDJSON) | `--output-format stream-json` |
| JSON output | `--output-format json` | `--output-last-message` | `--output-format json` |
| Plugins/extensions | Yes | — | — |
| MCP servers | Yes | Yes (`config.toml`) | Yes (`gemini mcp add`) |
| Skills system | Yes | — | — |

## Hook Configuration Locations

| Tool | Config file | Scope |
|------|-----------|-------|
| **Claude Code** | `.claude/settings.json` | Project |
| **Claude Code** | `~/.claude/settings.json` | Global |
| **Claude Code** | `.claude/settings.local.json` | Project (gitignored) |
| **Codex CLI** | `.codex/hooks.json` | Project |
| **Gemini CLI** | `settings.json` (Gemini config dir) | Global |

## Hook Stdin JSON Schema (Common Fields)

All three tools pass similar JSON to hook scripts via stdin:

```json
{
  "session_id": "abc123",
  "cwd": "/path/to/project",
  "hook_event_name": "PreToolUse",
  "tool_name": "Bash",
  "tool_input": { "command": "npm test" }
}
```

Additional fields vary by event and tool. See each tool's hooks docs for details.

## SubFrame Integration

### ACP (Agent Communication Protocol)

SubFrame's hooks write to `.subframe/agent-state.json` on pre/post tool events.
Since all three tools support pre/post tool hooks with compatible stdin schemas,
the same ACP approach works across all tools — deploy tool-specific hooks during
`subframe init` that write to the shared state file.

### Hook deployment during init

| Tool | Hook files to deploy |
|------|---------------------|
| Claude Code | `.claude/settings.json` → `hooks.PreToolUse`, `hooks.PostToolUse`, `hooks.Stop`, etc. |
| Codex CLI | `.codex/hooks.json` → equivalent events |
| Gemini CLI | Gemini settings → `BeforeTool`, `AfterTool`, `AfterAgent`, etc. |

### Streaming output for pipelines

For pipeline print-mode stages, structured streaming output avoids PTY overhead:

| Tool | Flag | Output format |
|------|------|--------------|
| Claude Code | `--output-format stream-json` | JSONL with `type` field (`assistant`, `tool_use`, `tool_result`, `result`) |
| Codex CLI | `--json` | NDJSON events (one per state change) |
| Gemini CLI | `--output-format stream-json` | JSONL with `type` field (`tool_use`, `message`, `result`) |

### Feature flags in code

The `AIToolFeatures` interface in `src/shared/ipcChannels.ts` and the per-tool
defaults in `src/main/aiToolManager.ts` drive runtime capability checks.
The renderer can use `tool.features.preToolUse` etc. to show/hide UI elements
and gracefully degrade when a feature isn't available.

## Keeping This Document Current

1. **Check live docs** before each release or when adding tool integrations
2. **Update `AIToolFeatures` defaults** in `src/main/aiToolManager.ts` when capabilities change
3. **Update the "Last verified" date** at the top of this file
4. **Watch changelogs** — Codex hooks are early-stage and evolving fast
