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
  /** SubFrame terminal ID (from SUBFRAME_TERMINAL_ID env var) — enables direct correlation */
  terminalId?: string;
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

// ─── User Message Signal (from prompt-submit hook) ───────────────────────────

export interface UserMessageSignal {
  /** SubFrame terminal ID (from SUBFRAME_TERMINAL_ID env var) */
  terminalId: string;
  /** When the message was submitted */
  timestamp: string;
  /** First 100 chars of the prompt (for debugging/display) */
  promptPreview?: string;
}

// ─── Terminal Status (7-state enum, driven by AI tool hook events) ──────────
//
// Ported from Maestro (https://github.com/its-maestro-baby/maestro).
// Unlike the loose xterm-output-based `claudeActive` boolean, these states
// are driven by AI tool hook events (PreToolUse → working, Stop → done, etc.)
// and are the formal status model for each terminal.

export type TerminalStatus =
  | 'starting'
  | 'idle'
  | 'working'
  | 'needs-input'
  | 'done'
  | 'error'
  | 'timeout';

export interface TerminalStatusEntry {
  /** SubFrame terminal ID the status applies to */
  terminalId: string;
  /** Current 7-state status */
  status: TerminalStatus;
  /** Optional human-readable reason/context (e.g. "Running: Bash") */
  message?: string;
  /** Epoch millis when this entry was last written */
  lastUpdated: number;
}

// ─── Agent State Payload (full state sent over IPC) ──────────────────────────

export interface AgentStatePayload {
  /** Project path this state belongs to */
  projectPath: string;
  /** All tracked sessions */
  sessions: AgentSession[];
  /** When this state was last updated */
  lastUpdated: string;
  /** Last user message signal (written by prompt-submit hook) */
  lastUserMessage?: UserMessageSignal;
  /**
   * Per-terminal status map (keyed by terminalId). Written by the tool hooks
   * and mirrored into the renderer via `TERMINAL_STATUS_CHANGED` broadcasts.
   */
  terminalStatus?: Record<string, TerminalStatusEntry>;
}
