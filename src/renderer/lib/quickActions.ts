/**
 * Quick Action Pills configuration.
 *
 * Pure TS module defining the default set of quick-action pills that appear
 * above the focused terminal. Each action has a literal text snippet that
 * gets injected into the active terminal when the pill is clicked, plus a
 * list of tools the pill is contextually relevant for.
 *
 * Tools: 'claude' | 'codex' | 'gemini' | 'shell' | 'all'
 *   - 'all' pills are always visible regardless of active tool
 *   - Other values filter by detected AI tool (or 'shell' when no AI agent)
 *
 * Inspired by Maestro's QuickActionPills pattern.
 */

export type QuickActionTool = 'claude' | 'codex' | 'gemini' | 'shell' | 'all';

export interface QuickAction {
  id: string;
  label: string;
  /** Literal text to inject into the terminal (newline appended by injector). */
  text: string;
  /** lucide-react icon name. */
  icon: string;
  /** Which tool contexts this pill applies to. */
  tools: QuickActionTool[];
}

export const DEFAULT_QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'clear',
    label: '/clear',
    text: '/clear',
    icon: 'Eraser',
    tools: ['claude'],
  },
  {
    id: 'continue',
    label: 'Continue',
    text: 'continue',
    icon: 'Play',
    tools: ['claude', 'codex', 'gemini'],
  },
  {
    id: 'run-tests',
    label: 'Run tests',
    text: 'npm test',
    icon: 'FlaskConical',
    tools: ['shell', 'all'],
  },
  {
    id: 'explain',
    label: 'Explain',
    text: 'explain what this does',
    icon: 'HelpCircle',
    tools: ['claude', 'codex', 'gemini'],
  },
  {
    id: 'fix-it',
    label: 'Fix it',
    text: 'fix the errors you just introduced',
    icon: 'Wrench',
    tools: ['claude', 'codex', 'gemini'],
  },
  {
    id: 'commit',
    label: 'Commit',
    text: '/commit',
    icon: 'GitCommit',
    tools: ['claude'],
  },
  {
    id: 'status',
    label: 'Status',
    text: 'git status',
    icon: 'Activity',
    tools: ['shell', 'all'],
  },
];

/**
 * Filter quick actions to those relevant for the given tool key.
 * Pills tagged 'all' are always included. Unknown tool keys fall back to
 * returning 'all' + 'shell' pills.
 */
export function getActionsForTool(tool: string): QuickAction[] {
  const key = normalizeToolKey(tool);
  return DEFAULT_QUICK_ACTIONS.filter(
    (a) => a.tools.includes('all') || a.tools.includes(key)
  );
}

/**
 * Normalize an arbitrary tool identifier (e.g. 'Claude Code', 'Codex CLI',
 * 'Gemini CLI', or a bare 'claude') to a QuickActionTool key.
 */
export function normalizeToolKey(tool: string | null | undefined): QuickActionTool {
  if (!tool) return 'shell';
  const lower = tool.toLowerCase();
  if (lower.includes('claude')) return 'claude';
  if (lower.includes('codex')) return 'codex';
  if (lower.includes('gemini')) return 'gemini';
  return 'shell';
}
