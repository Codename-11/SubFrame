/**
 * StatusBar — Persistent thin bar at the very bottom of the app (below ActivityBar).
 * Shows at-a-glance status from multiple subsystems: git, agents, tasks, GitHub, output.
 * Each section is clickable to open its corresponding right panel.
 */

import { useMemo } from 'react';
import {
  GitBranch,
  Bot,
  ListTodo,
  GitPullRequestArrow,
  Terminal,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useGitStatus, useGithubWorkflows } from '../hooks/useGithub';
import { useTasks } from '../hooks/useTasks';
import { useTerminalStore } from '../stores/useTerminalStore';
import { useUIStore } from '../stores/useUIStore';

/** Read version at module level — avoids importing frameConstants.ts which uses Node's `path` */
const FRAME_VERSION: string = require('../../../package.json').version;

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="flex items-center gap-1 px-2 h-full hover:bg-bg-hover/50 transition-colors cursor-pointer select-none whitespace-nowrap"
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-3 bg-border-subtle shrink-0" />;
}

// ─── StatusBar ────────────────────────────────────────────────────────────────

export function StatusBar() {
  const { branch, ahead, behind, files } = useGitStatus();
  const { workflows } = useGithubWorkflows();
  const { grouped } = useTasks();

  // Agent count — count terminals where claudeActive is true
  const activeAgents = useTerminalStore((s) => {
    let count = 0;
    for (const t of s.terminals.values()) {
      if (t.claudeActive) count++;
    }
    return count;
  });

  // Task counts
  const inProgressCount = grouped.inProgress.length;
  const pendingCount = grouped.pending.length;

  // Workflow failure detection — check if any workflow has a failed latest run
  const hasFailedWorkflow = useMemo(() => {
    return workflows.some((wf) => {
      const latestRun = wf.runs?.[0];
      return latestRun?.conclusion === 'failure';
    });
  }, [workflows]);

  // Workflow summary for display
  const workflowCount = workflows.length;

  // Git dirty indicator
  const isDirty = files.length > 0;

  // Panel opener — uses direct store access for type safety
  const setActivePanel = useUIStore.getState().setActivePanel;

  return (
    <div className="flex items-center h-[22px] bg-bg-deep border-t border-border-subtle text-[10px] text-text-secondary shrink-0 overflow-hidden">
      {/* ── Left sections ──────────────────────────────────────────────── */}

      {/* Git */}
      <Section onClick={() => setActivePanel('gitChanges')} title="Git status">
        <GitBranch size={11} className="text-text-muted shrink-0" />
        <span className="font-mono">
          {branch || 'no branch'}
        </span>
        {(ahead > 0 || behind > 0) && (
          <span className="font-mono text-text-muted">
            {ahead > 0 && <span>{'\u2191'}{ahead}</span>}
            {behind > 0 && <span>{'\u2193'}{behind}</span>}
          </span>
        )}
        {isDirty ? (
          <span className="text-warning">{'\u25CF'}</span>
        ) : (
          ahead === 0 && behind === 0 && (
            <span className="text-text-muted">{'\u00B7'} Clean</span>
          )
        )}
      </Section>

      <Divider />

      {/* Agent */}
      <Section onClick={() => setActivePanel('agentState')} title="Agent activity">
        <Bot size={11} className={cn('shrink-0', activeAgents > 0 ? 'text-success' : 'text-text-muted')} />
        {activeAgents > 0 ? (
          <span className="text-success">{activeAgents} active</span>
        ) : (
          <span className="text-text-muted">Idle</span>
        )}
      </Section>

      <Divider />

      {/* Sub-Tasks */}
      <Section onClick={() => setActivePanel('tasks')} title="Sub-Tasks">
        <ListTodo size={11} className="text-text-muted shrink-0" />
        {inProgressCount > 0 || pendingCount > 0 ? (
          <span>
            {inProgressCount > 0 && (
              <span className="text-accent">{inProgressCount} in progress</span>
            )}
            {inProgressCount > 0 && pendingCount > 0 && (
              <span className="text-text-muted"> {'\u00B7'} </span>
            )}
            {pendingCount > 0 && (
              <span className="text-text-muted">{pendingCount} pending</span>
            )}
          </span>
        ) : (
          <span className="text-text-muted">No tasks</span>
        )}
      </Section>

      <Divider />

      {/* GitHub Workflows */}
      <Section onClick={() => setActivePanel('githubWorkflows')} title="GitHub workflows">
        <span className="relative shrink-0">
          <GitPullRequestArrow size={11} className="text-text-muted" />
          {hasFailedWorkflow && (
            <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-error" />
          )}
        </span>
        {hasFailedWorkflow ? (
          <span className="text-error">CI failing</span>
        ) : workflowCount > 0 ? (
          <span className="text-text-muted">CI passing</span>
        ) : (
          <span className="text-text-muted">No workflows</span>
        )}
      </Section>

      <Divider />

      {/* Output Channels */}
      <Section
        onClick={() => window.dispatchEvent(new Event('toggle-activity-bar'))}
        title="Toggle activity output"
      >
        <Terminal size={11} className="text-text-muted shrink-0" />
        <span className="text-text-muted">Output</span>
      </Section>

      {/* ── Spacer ─────────────────────────────────────────────────────── */}
      <div className="flex-1" />

      {/* ── Right side ─────────────────────────────────────────────────── */}
      <span className="px-2 font-mono text-text-muted tabular-nums select-none">
        v{FRAME_VERSION}
      </span>
    </div>
  );
}
