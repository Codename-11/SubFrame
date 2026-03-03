---
id: task-mma14h3u-u7og
title: 'Claude analytics dashboard — sessions, tokens, cost, usage'
status: pending
priority: medium
category: feature
blockedBy: []
blocks: []
createdAt: '2026-03-03T03:09:31.673Z'
updatedAt: '2026-03-03T03:09:31.673Z'
completedAt: null
context: Session 2026-03-03
---
Embed a Claud-ometer-style analytics dashboard directly in SubFrame. Reads `~/.claude/` data (session .jsonl logs, stats-cache.json, history.jsonl) to show usage, costs, token breakdowns, and session history — no external server needed.

## Reference
Based on the **Claud-ometer** project at `C:\Users\Bailey\Desktop\Open-Projects\-Claude-\Claud-ometer` (Next.js app by deshraj). SubFrame's version runs in-process via Electron main process file readers instead of HTTP API routes.

### Claud-ometer key types to port
- `ModelPricing` — per-model input/output/cache pricing rates
- `SessionInfo` — duration, message count, tool calls, tokens (input/output/cache_read/cache_write), cost
- `DashboardStats` — aggregate totals, daily activity, model usage, hour counts
- `TokenUsage` — input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens
- `CompactionInfo` — compaction/microcompaction counts, tokens saved

## Key Data Sources (from ~/.claude/)
| Source | Path | Contains |
|--------|------|----------|
| Session logs | `~/.claude/projects/<project>/<session>.jsonl` | Messages, tool calls, token usage per message (input/output/cache_read/cache_write), model, timestamps, compaction events |
| Stats cache | `~/.claude/stats-cache.json` | Pre-computed daily activity, model usage, hourly distribution, longest session |
| History | `~/.claude/history.jsonl` | Every prompt typed with project context and timestamp |

## Dashboard Views

### 1. Overview (hero stats + charts)
- Total sessions, messages, tokens, estimated cost (big number cards)
- Usage-over-time line chart (daily activity)
- Model breakdown donut (Opus/Sonnet/Haiku split by tokens)
- GitHub-style activity heatmap (daily session frequency)
- Peak hours distribution bar chart

### 2. Sessions list
- Sortable table: session ID, project, duration, messages, tool calls, tokens, cost
- Compaction badges (amber) for sessions that hit context limits
- Click-through to session detail

### 3. Session detail
- Conversation replay (user/assistant messages with tool call badges)
- Sidebar: token breakdown (input/output/cache), tools used, compaction timeline, model info

### 4. Cost analytics
- Cost-over-time stacked by model
- Cost-by-project bar chart
- Per-model token breakdown with cache efficiency metrics
- Pricing reference table (from MODEL_PRICING)

### 5. Per-project stats
- Scoped to current SubFrame project (filter by project path)
- Session count, total tokens, cost estimate, model distribution

## Architecture
- `claudeAnalyticsManager.ts` (main process): reads ~/.claude/ files, parses .jsonl, aggregates stats, caches results
- IPC channels: `LOAD_CLAUDE_ANALYTICS`, `LOAD_CLAUDE_SESSIONS`, `LOAD_CLAUDE_SESSION_DETAIL`, `LOAD_CLAUDE_COST_DATA`
- `useClaudeAnalytics` hook (TanStack Query): wraps IPC with staleTime caching
- `AnalyticsPanel.tsx` (renderer): dashboard with Recharts charts, stat cards, session table
- Pricing config: port MODEL_PRICING from Claud-ometer (Opus $15/$75, Sonnet $3/$15, Haiku $0.80/$4 per million tokens)

## Acceptance Criteria
- Overview shows total sessions, messages, tokens, cost
- At least one chart (usage over time or model breakdown)
- Session list with sort/filter
- Cost estimates using per-model pricing (input/output/cache tiers)
- Scopes to current project when project is selected
- Handles missing ~/.claude/ gracefully (empty state)
