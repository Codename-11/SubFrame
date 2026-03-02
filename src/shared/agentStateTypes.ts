/**
 * Agent State Types — Real-time agent/session visualization
 *
 * These types define the data contract between:
 * - Claude Code hooks (scripts/hooks/pre-tool-use.js, post-tool-use.js)
 *   → writes .subframe/agent-state.json
 * - Main process (agentStateManager.ts)
 *   → watches file, broadcasts via IPC
 * - Renderer (useAgentState hook, AgentStateView components)
 *   → consumes IPC events, renders timeline/graph
 *
 * AI-tool agnostic: the hook scripts are Claude-specific adapters,
 * but these types work for any AI tool that writes the same JSON format.
 */

// ─── Agent Step (single tool invocation in timeline) ─────────────────────────

export type AgentStepStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface AgentStep {
  /** Unique step ID (e.g., "step-1709000000000") */
  id: string;
  /** Human-readable label (e.g., "Reading src/main/index.ts") */
  label: string;
  /** Tool name (e.g., "Read", "Edit", "Bash", "Agent") */
  toolName?: string;
  /** Step execution status */
  status: AgentStepStatus;
  /** When the step started */
  startedAt?: string;
  /** When the step completed (or failed) */
  completedAt?: string;
  /** Brief result summary */
  result?: string;
}

// ─── Agent Session (one active agent/session being tracked) ──────────────────

export type AgentSessionStatus = 'idle' | 'active' | 'busy' | 'completed';

export interface AgentSession {
  /** Claude session ID (from hook stdin) */
  sessionId: string;
  /** Friendly agent name (e.g., "main", "subagent-1") */
  agentName?: string;
  /** Parent session ID for subagent hierarchy */
  parentSessionId?: string;
  /** Current agent status */
  status: AgentSessionStatus;
  /** Tool currently in use (set by PreToolUse, cleared by PostToolUse) */
  currentTool?: string;
  /** Current task being worked on */
  currentTask?: string;
  /** Timeline of executed steps */
  steps: AgentStep[];
  /** When this session started */
  startedAt: string;
  /** Last activity timestamp */
  lastActivityAt: string;
}

// ─── Agent State Payload (full state sent over IPC) ──────────────────────────

export interface AgentStatePayload {
  /** Project path this state belongs to */
  projectPath: string;
  /** All tracked sessions */
  sessions: AgentSession[];
  /** When this state was last updated */
  lastUpdated: string;
}
