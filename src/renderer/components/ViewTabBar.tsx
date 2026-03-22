import React, { useState, useEffect, useRef } from 'react';
import { useUIStore, type FullViewContent, getTabIdForContent } from '../stores/useUIStore';
import { useProjectStore } from '../stores/useProjectStore';
import { useSettings, useAIToolConfig } from '../hooks/useSettings';
import {
  X,
  TerminalSquare,
  LayoutDashboard,
  GitFork,
  CheckSquare,
  BarChart3,
  Lightbulb,
  Workflow,
  Bot,
  Keyboard,
  ListTodo,
  Activity,
  FileDiff,
  PanelRight,
  FolderOpen,
  Loader2,
  Terminal,
  Pin,
  BookMarked,
  Cpu,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import { toast } from 'sonner';
import { IPC } from '../../shared/ipcChannels';
import type { ClaudeUsageData, UsageWindow, UsageSource } from '../../shared/ipcChannels';
import { SHORTCUTS } from '../lib/shortcuts';

const { ipcRenderer } = require('electron');

const TAB_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  terminal: TerminalSquare,
  overview: LayoutDashboard,
  structureMap: GitFork,
  tasks: CheckSquare,
  stats: BarChart3,
  decisions: Lightbulb,
  pipeline: Workflow,
  agentState: Bot,
  shortcuts: Keyboard,
};

/** Panel shortcut buttons shown on the right side of the tab bar — open right sidebar */
const PANEL_SHORTCUTS = [
  { id: 'tasks' as const, label: 'Sub-Tasks', icon: ListTodo, shortcut: 'Ctrl+Shift+S' },
  { id: 'gitChanges' as const, label: 'GitHub', icon: FileDiff, shortcut: 'Ctrl+Shift+G' },
  { id: 'agentState' as const, label: 'Agents', icon: Activity, shortcut: 'Ctrl+Shift+A' },
  { id: 'prompts' as const, label: 'Prompts', icon: BookMarked, shortcut: 'Ctrl+Shift+L' },
  { id: 'pipeline' as const, label: 'Pipeline', icon: Workflow, shortcut: 'Ctrl+Shift+Y' },
  { id: 'overview' as const, label: 'Overview', icon: LayoutDashboard, shortcut: 'Ctrl+Shift+O' },
  { id: 'system' as const, label: 'System', icon: Cpu, shortcut: 'Ctrl+Shift+U' },
] as const;

// ── Source indicator helpers ─────────────────────────────────────────────────

const SOURCE_META: Record<UsageSource, { color: string; label: string; description: string }> = {
  'local-cache': {
    color: 'bg-success',
    label: 'Live',
    description: 'Read from Claude\'s local statusline cache — fast, no network',
  },
  'api': {
    color: 'bg-info',
    label: 'API',
    description: 'Fetched live from Anthropic\'s OAuth usage API',
  },
  'credentials-only': {
    color: 'bg-warning',
    label: 'Tier',
    description: 'Usage data unavailable — showing account tier from credentials',
  },
  'none': {
    color: 'bg-error',
    label: '',
    description: 'No usage data or credentials available',
  },
};

function formatTierName(tier: string | null): string | null {
  if (!tier) return null;
  // "default_claude_max_20x" → "Max 20x"
  const match = tier.match(/claude_(\w+?)(?:_(\d+x))?$/);
  if (match) {
    const plan = match[1].charAt(0).toUpperCase() + match[1].slice(1);
    return match[2] ? `${plan} ${match[2]}` : plan;
  }
  return tier;
}

function formatSubType(subType: string | null): string | null {
  if (!subType) return null;
  return subType.charAt(0).toUpperCase() + subType.slice(1);
}

export function ViewTabBar() {
  const openTabs = useUIStore(s => s.openTabs);
  const fullViewContent = useUIStore(s => s.fullViewContent);
  const setFullViewContent = useUIStore(s => s.setFullViewContent);
  const closeTab = useUIStore(s => s.closeTab);
  const activePanel = useUIStore(s => s.activePanel);
  const togglePanel = useUIStore(s => s.togglePanel);
  const closeRightPanel = useUIStore(s => s.closeRightPanel);
  const sidebarState = useUIStore(s => s.sidebarState);
  const setSidebarState = useUIStore(s => s.setSidebarState);
  const currentProjectPath = useProjectStore(s => s.currentProjectPath);
  const workspaceName = useProjectStore(s => s.workspaceName);
  const { updateSetting } = useSettings();
  const { config: aiToolConfig } = useAIToolConfig();
  const projects = useProjectStore(s => s.projects);

  // Derive per-project tool binding
  const currentProject = currentProjectPath ? projects.find(p => p.path === currentProjectPath) : null;
  const projectToolBinding = currentProject?.aiTool ?? null;
  const activeToolName = aiToolConfig?.activeTool?.name ?? 'Claude Code';
  const activeToolInstalled = aiToolConfig?.activeTool?.installed !== false;

  // Usage data state
  const [usageData, setUsageData] = useState<ClaudeUsageData | null>(null);
  const [usageFetching, setUsageFetching] = useState(false);

  // Map sub-views to their parent tab for active highlighting
  const activeTabId = fullViewContent ? getTabIdForContent(fullViewContent) : 'terminal';

  // Extract project folder name from path
  const projectName = currentProjectPath
    ? currentProjectPath.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? null
    : null;

  // Load Claude usage data (main process handles periodic polling via settings)
  useEffect(() => {
    const handler = (_event: unknown, data: ClaudeUsageData) => {
      setUsageFetching(false);
      // On error, preserve existing usage values if backend didn't
      if (data?.error && !(data.fiveHour || data.sevenDay)) {
        setUsageData(prev => prev?.fiveHour || prev?.sevenDay
          ? { ...prev, error: data.error, lastUpdated: data.lastUpdated, source: data.source }
          : data
        );
      } else {
        setUsageData(data);
      }
    };
    ipcRenderer.on(IPC.CLAUDE_USAGE_DATA, handler);
    setUsageFetching(true);
    ipcRenderer.send(IPC.LOAD_CLAUDE_USAGE);

    return () => {
      ipcRenderer.removeListener(IPC.CLAUDE_USAGE_DATA, handler);
    };
  }, []);

  // Show toast on persistent usage polling failures with option to disable
  const persistentFailureShown = useRef(false);
  useEffect(() => {
    if (usageData?.persistentFailure && !persistentFailureShown.current) {
      persistentFailureShown.current = true;
      toast.warning('Usage polling is failing repeatedly', {
        description: 'The Claude API usage endpoint is unreachable. You can disable auto-polling and refresh manually instead.',
        duration: 15000,
        action: {
          label: 'Disable polling',
          onClick: () => {
            updateSetting.mutate([{ key: 'general.usagePollingInterval', value: 0 }]);
            toast.success('Usage auto-polling disabled');
          },
        },
      });
    }
    // Reset flag when errors clear
    if (usageData && !usageData.error) {
      persistentFailureShown.current = false;
    }
  }, [usageData?.persistentFailure, usageData?.error]);

  // Derived display state
  const hasUsage = usageData?.fiveHour || usageData?.sevenDay;
  const showPill = usageFetching || hasUsage || usageData?.error || usageData?.subscriptionType;
  const source = usageData?.source ?? 'none';
  const sourceMeta = SOURCE_META[source];
  const tierDisplay = formatTierName(usageData?.rateLimitTier ?? null) || formatSubType(usageData?.subscriptionType ?? null);

  return (
    <div className="flex items-center bg-bg-secondary border-b border-border-subtle shrink-0" data-neon-bar="">
      {/* Workspace + project badge — visible when sidebar is not expanded */}
      {sidebarState !== 'expanded' && (
        <TooltipProvider delayDuration={400}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setSidebarState('expanded')}
                className="flex items-center gap-1 px-2.5 py-1 text-xs
                           hover:bg-bg-hover transition-colors cursor-pointer
                           border-r border-border-subtle shrink-0"
              >
                <FolderOpen className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                {workspaceName && workspaceName !== 'default' && (
                  <>
                    <span className="font-semibold text-text-primary truncate max-w-[100px]">{workspaceName}</span>
                    {projectName && <span className="text-text-muted">/</span>}
                  </>
                )}
                {projectName && (
                  <span className="text-text-secondary truncate max-w-[120px]">{projectName}</span>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{workspaceName && workspaceName !== 'default' ? `${workspaceName} — ` : ''}{currentProjectPath}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Active AI tool indicator */}
      <TooltipProvider delayDuration={400}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => window.dispatchEvent(new Event('open-ai-tool-palette'))}
              className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium
                         hover:bg-bg-hover transition-colors cursor-pointer
                         border-r border-border-subtle shrink-0 text-text-secondary hover:text-text-primary"
            >
              <Terminal className={`w-3 h-3 flex-shrink-0 ${activeToolInstalled ? 'text-accent' : 'text-error'}`} />
              <span className="truncate max-w-[100px]">{activeToolName}</span>
              {!activeToolInstalled && (
                <span className="w-1.5 h-1.5 rounded-full bg-error flex-shrink-0" title="Not installed" />
              )}
              {projectToolBinding && (
                <Pin className="w-2.5 h-2.5 text-accent flex-shrink-0" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>
              {activeToolName}
              {projectToolBinding ? ' (bound to project)' : ''}
              {` — ${SHORTCUTS.AI_TOOL_PALETTE.keys}`}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Open tabs */}
      <div className="flex items-center overflow-x-auto scrollbar-none flex-1 min-w-0">
        {openTabs.map(tab => {
          const isActive = tab.id === activeTabId;
          const Icon = TAB_ICONS[tab.id];
          return (
            <button
              key={tab.id}
              onClick={() => {
                const content = tab.id === 'terminal' ? null : (tab.id as FullViewContent);
                setFullViewContent(content);
              }}
              className={`group flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 transition-colors shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-bg-primary text-text-primary border-accent'
                  : 'text-text-tertiary hover:text-text-secondary hover:bg-bg-hover border-transparent'
              }`}
            >
              {Icon && <Icon className="w-3.5 h-3.5" />}
              <span>{tab.label}</span>
              {tab.closable && (
                <span
                  role="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className={`ml-1 p-0.5 rounded hover:bg-bg-tertiary transition-colors ${
                    isActive ? 'opacity-60 hover:opacity-100' : 'opacity-0 group-hover:opacity-60 hover:!opacity-100'
                  }`}
                >
                  <X className="w-3 h-3" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Usage pill + view shortcuts + sidebar toggle on the right */}
      <div className="flex items-center gap-1 px-1.5 flex-shrink-0">
        {/* Usage pill */}
        {showPill && (
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={`group/usage flex items-center gap-1.5 px-2 py-0.5 bg-bg-tertiary border border-border-subtle
                             rounded-md cursor-pointer hover:bg-bg-hover hover:border-border-default transition-all
                             flex-shrink-0 overflow-hidden ${usageData?.error && hasUsage ? 'opacity-80' : ''}`}
                  onClick={() => {
                    if (!usageFetching) {
                      setUsageFetching(true);
                      ipcRenderer.send(IPC.REFRESH_CLAUDE_USAGE);
                    }
                  }}
                >
                  {/* Source / status indicator */}
                  {usageFetching ? (
                    <Loader2 className="h-3 w-3 text-text-tertiary animate-spin flex-shrink-0" />
                  ) : (
                    <span
                      className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${sourceMeta.color}${
                        usageData?.error ? ' animate-pulse' : ''
                      }`}
                    />
                  )}

                  {/* Primary: Session (5h) usage */}
                  {usageData?.fiveHour ? (
                    <UsageItem label="Session" utilization={usageData.fiveHour.utilization} resetsAt={usageData.fiveHour.resetsAt} />
                  ) : tierDisplay && !hasUsage ? (
                    <span className="text-[10px] text-text-secondary whitespace-nowrap font-medium">{tierDisplay}</span>
                  ) : usageData?.error ? (
                    <span className="text-[10px] text-text-secondary whitespace-nowrap">Usage unavailable</span>
                  ) : null}

                  {/* Hover expand: Weekly (7d) usage */}
                  {usageData?.sevenDay && (
                    <div className="max-w-0 opacity-0 overflow-hidden transition-all duration-300 ease-in-out
                                    group-hover/usage:max-w-[160px] group-hover/usage:opacity-100 group-hover/usage:ml-0.5">
                      <UsageItem label="Weekly" utilization={usageData.sevenDay.utilization} resetsAt={usageData.sevenDay.resetsAt} />
                    </div>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <UsageTooltip data={usageData} fetching={usageFetching} />
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        <div className="h-4 w-px bg-border-subtle mx-0.5" />

        {/* Panel shortcut buttons — open right sidebar */}
        {PANEL_SHORTCUTS.map((panel) => {
          const Icon = panel.icon;
          const isActive = activePanel === panel.id;
          return (
            <TooltipProvider key={panel.id} delayDuration={400}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => togglePanel(panel.id)}
                    className={`flex items-center gap-1.5 h-6 px-2 rounded text-xs font-medium transition-colors cursor-pointer ${
                      isActive
                        ? 'text-accent bg-accent-subtle'
                        : 'text-text-tertiary hover:text-text-secondary hover:bg-bg-hover'
                    }`}
                    aria-label={`${panel.label} (${panel.shortcut})`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{panel.label}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>{panel.shortcut}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}

        <div className="h-4 w-px bg-border-subtle mx-0.5" />

        {/* Right panel toggle */}
        <TooltipProvider delayDuration={400}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => {
                  if (activePanel) {
                    closeRightPanel();
                  } else {
                    togglePanel('overview');
                  }
                }}
                className={`flex items-center justify-center h-6 w-6 rounded transition-colors cursor-pointer ${
                  activePanel
                    ? 'text-accent bg-accent-subtle'
                    : 'text-text-tertiary hover:text-text-secondary hover:bg-bg-hover'
                }`}
                aria-label={activePanel ? 'Close right panel' : 'Open right panel'}
              >
                <PanelRight className="w-3.5 h-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{activePanel ? 'Close Panel' : 'Open Panel'}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}

// ── Rich tooltip ────────────────────────────────────────────────────────────

function UsageTooltip({ data, fetching }: { data: ClaudeUsageData | null; fetching: boolean }) {
  if (fetching) return <p className="text-xs">Fetching usage data...</p>;
  if (!data) return <p className="text-xs">Click to load usage</p>;

  const source = data.source ?? 'none';
  const sourceMeta = SOURCE_META[source];
  const tierDisplay = formatTierName(data.rateLimitTier) || formatSubType(data.subscriptionType);

  // Collect all windows for display
  const windows: { label: string; window: UsageWindow }[] = [];
  if (data.fiveHour) windows.push({ label: 'Session (5h)', window: data.fiveHour });
  if (data.sevenDay) windows.push({ label: 'Weekly (7d)', window: data.sevenDay });
  if (data.sevenDaySonnet) windows.push({ label: 'Sonnet (7d)', window: data.sevenDaySonnet });
  if (data.sevenDayOpus) windows.push({ label: 'Opus (7d)', window: data.sevenDayOpus });

  return (
    <div className="space-y-2 text-xs min-w-[180px]">
      {/* Header: tier + source */}
      <div className="flex items-center justify-between gap-3">
        {tierDisplay && (
          <span className="font-semibold text-text-primary">{tierDisplay}</span>
        )}
        <span className="flex items-center gap-1 text-text-muted">
          <span className={`h-1.5 w-1.5 rounded-full ${sourceMeta.color} inline-block`} />
          {sourceMeta.label}
          {source !== 'local-cache' && data.cacheAgeSeconds !== null && data.cacheAgeSeconds !== undefined && (
            <span className="font-mono">({data.cacheAgeSeconds}s ago)</span>
          )}
          {data.error && data.lastUpdated && (
            <span className="font-mono">
              {new Date(data.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </span>
      </div>

      {/* Usage windows */}
      {windows.length > 0 ? (
        <div className="space-y-1.5">
          {windows.map(({ label, window: w }) => (
            <TooltipUsageRow key={label} label={label} utilization={w.utilization} resetsAt={w.resetsAt} />
          ))}
        </div>
      ) : (
        <p className="text-text-muted">No usage data available</p>
      )}

      {/* Extra usage (Max plan credits) */}
      {data.extraUsage?.isEnabled && (
        <div className="border-t border-border-subtle pt-1.5">
          <div className="flex items-center justify-between text-text-secondary">
            <span>Extra credits</span>
            <span className="font-mono">
              {data.extraUsage.utilization !== null ? `${Math.round(data.extraUsage.utilization)}%` : '—'}
            </span>
          </div>
        </div>
      )}

      {/* Error message */}
      {data.error && (
        <p className="text-warning text-[10px]">{data.error}</p>
      )}

      {/* Source explanation */}
      <p className="text-text-muted text-[10px] border-t border-border-subtle pt-1">
        {sourceMeta.description}
        {' · '}Click to refresh
      </p>
    </div>
  );
}

/** Tooltip row with wider bar and reset time */
function TooltipUsageRow({ label, utilization, resetsAt }: { label: string; utilization: number; resetsAt: string | null }) {
  const pct = Math.round(Math.min(utilization, 100));
  const colorClass = pct >= 80 ? 'bg-error' : pct >= 50 ? 'bg-warning' : 'bg-success';

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between">
        <span className="text-text-secondary">{label}</span>
        <span className="flex items-center gap-1.5">
          <span className="font-mono font-semibold text-text-primary">{pct}%</span>
          {resetsAt && <ResetTime resetsAt={resetsAt} />}
        </span>
      </div>
      <div className="w-full h-[4px] rounded-full bg-bg-deep overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${colorClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── Shared sub-components ───────────────────────────────────────────────────

/** A single usage row: LABEL [BAR] PERCENT (RESET) */
function UsageItem({ label, utilization, resetsAt }: { label: string; utilization: number; resetsAt: string | null }) {
  // utilization is already 0–100 from the API — do NOT multiply by 100
  const pct = Math.round(Math.min(utilization, 100));
  const colorClass = pct >= 80 ? 'bg-error' : pct >= 50 ? 'bg-warning' : 'bg-success';

  return (
    <div className="flex items-center gap-1 pointer-events-none whitespace-nowrap">
      <span className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide">{label}</span>
      <div className="w-10 h-[5px] rounded-[3px] bg-bg-deep overflow-hidden flex-shrink-0">
        <div
          className={`h-full rounded-[3px] transition-all duration-300 ${colorClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] font-semibold text-text-secondary tabular-nums font-mono min-w-[22px] text-right">
        {pct}%
      </span>
      {resetsAt && <ResetTime resetsAt={resetsAt} />}
    </div>
  );
}

/** Formats reset time as relative countdown: "42m", "3h 15m", "2d 5h" */
function ResetTime({ resetsAt }: { resetsAt: string }) {
  const diff = new Date(resetsAt).getTime() - Date.now();
  if (diff <= 0) return <span className="text-[9px] text-text-muted font-mono">(soon)</span>;

  const mins = Math.floor(diff / 60000);
  let label: string;
  if (mins < 60) {
    label = `${mins}m`;
  } else {
    const hours = Math.floor(mins / 60);
    if (hours < 24) {
      label = `${hours}h ${mins % 60}m`;
    } else {
      const days = Math.floor(hours / 24);
      label = `${days}d ${hours % 24}h`;
    }
  }
  return <span className="text-[9px] text-text-muted font-mono">({label})</span>;
}
