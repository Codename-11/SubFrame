import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useUIStore, type FullViewContent, getTabIdForContent, isEditorTab, getEditorTabPath, makeEditorTabId } from '../stores/useUIStore';
import { useProjectStore } from '../stores/useProjectStore';
import { useTerminalStore } from '../stores/useTerminalStore';
import { useSettings, useAIToolConfig } from '../hooks/useSettings';
import { useIpcQuery } from '../hooks/useIpc';
import { useActivity } from '../hooks/useActivity';
import { typedInvoke, typedSend } from '../lib/ipc';
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
  Github,
  PanelRight,
  FolderOpen,
  Loader2,
  Terminal,
  Pin,
  BookMarked,
  Cpu,
  Plus,
  MoreHorizontal,
  FileText,
  ArrowUpDown,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from './ui/context-menu';
import { Reorder, useDragControls, motion } from 'framer-motion';
import { toast } from 'sonner';
import { IPC } from '../../shared/ipcChannels';
import type { ClaudeUsageData, UsageWindow, UsageSource, WorkspaceListResult } from '../../shared/ipcChannels';
import { SHORTCUTS } from '../lib/shortcuts';
import { getTransport } from '../lib/transportProvider';
import { focusActivityBar } from '../lib/activityBarEvents';
import {
  WORKSPACE_ICON_COMPONENTS,
  normalizeWorkspacePillDisplay,
  normalizeWorkspaceAccentColor,
  getWorkspacePillPresentation,
  withWorkspaceAccentAlpha,
} from '../lib/workspacePills';

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
  { id: 'gitChanges' as const, label: 'GitHub', icon: Github, shortcut: 'Ctrl+Shift+G' },
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
  'cached': {
    color: 'bg-warning',
    label: 'Cached',
    description: 'Showing data from a previous fetch — API is currently unavailable',
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

function dedupeWorkspaceKeys(keys: string[], validKeys: Set<string>): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const key of keys) {
    if (!validKeys.has(key) || seen.has(key)) continue;
    seen.add(key);
    deduped.push(key);
  }
  return deduped;
}

function fillPinnedWorkspaceKeys(
  pinnedKeys: string[],
  workspaceOrder: string[],
  slotCount: number,
): string[] {
  if (slotCount <= 0) return [];
  const nextPinned = [...pinnedKeys];
  for (const key of workspaceOrder) {
    if (nextPinned.length >= slotCount) break;
    if (nextPinned.includes(key)) continue;
    nextPinned.push(key);
  }
  return nextPinned.slice(0, slotCount);
}

function getLeastRecentlyUsedWorkspaceKey(
  keys: string[],
  timestamps: Record<string, number>,
): string | null {
  if (keys.length === 0) return null;
  return keys.reduce((oldestKey, key) => {
    if (oldestKey == null) return key;
    return (timestamps[key] ?? 0) < (timestamps[oldestKey] ?? 0) ? key : oldestKey;
  }, keys[0] ?? null);
}

interface WorkspacePillInfo {
  key: string;
  name: string;
  active: boolean;
  projectCount: number;
  projectPaths: string[];
  shortLabel: string | null;
  icon: string | null;
  accentColor: string | null;
  index: number;
}

function WorkspacePillButton({
  workspace,
  activity,
  display,
  disabled,
  suppressClickUntil,
  onPointerDown,
  onPointerUp,
  onSwitch,
  onDuplicate,
  onManageIdentity,
  onDeactivate,
}: {
  workspace: WorkspacePillInfo;
  activity: { terminalCount: number; agentCount: number };
  display: ReturnType<typeof normalizeWorkspacePillDisplay>;
  disabled: boolean;
  suppressClickUntil: React.MutableRefObject<number>;
  onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: () => void;
  onSwitch: (key: string) => void;
  onDuplicate: (key: string) => void;
  onManageIdentity: (key: string) => void;
  onDeactivate: (key: string) => void;
}) {
  const hasTerminals = activity.terminalCount > 0;
  const hasAgents = activity.agentCount > 0;
  const presentation = getWorkspacePillPresentation({
    display,
    index: workspace.index,
    name: workspace.name,
    shortLabel: workspace.shortLabel,
    icon: workspace.icon,
  });
  const WorkspaceIcon = presentation.icon ? WORKSPACE_ICON_COMPONENTS[presentation.icon] : null;
  const usesCompactWidth = !presentation.indexText && !presentation.text && !!WorkspaceIcon;
  const accentColor = normalizeWorkspaceAccentColor(workspace.accentColor) ?? null;
  const activeAccentStyle = accentColor ? {
    backgroundColor: withWorkspaceAccentAlpha(accentColor, '22') ?? undefined,
    borderColor: withWorkspaceAccentAlpha(accentColor, '66') ?? accentColor,
    color: accentColor,
  } : undefined;
  const inactiveAccentStyle = accentColor ? {
    borderColor: withWorkspaceAccentAlpha(accentColor, '33') ?? undefined,
  } : undefined;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <ContextMenu>
            <ContextMenuTrigger asChild>
              <button
                onPointerDown={onPointerDown}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerUp}
                onPointerCancel={onPointerUp}
                onClick={() => {
                  if (suppressClickUntil.current > Date.now()) return;
                  onSwitch(workspace.key);
                }}
                disabled={disabled}
                className={`group/pill relative flex items-center h-5 rounded-md text-[10px] font-semibold
                  transition-all duration-200 cursor-pointer disabled:opacity-50 mx-0.5 touch-none
                  ${usesCompactWidth ? 'min-w-[24px] px-1.5' : 'min-w-[28px] px-2 gap-1'}
                  ${presentation.indexText && !presentation.text && !WorkspaceIcon ? 'font-mono' : 'tracking-wide'}
                  ${workspace.active
                    ? 'bg-accent/20 text-accent border border-accent/30'
                    : hasAgents
                      ? 'text-text-primary bg-success/8 border border-success/25 hover:bg-success/12'
                      : hasTerminals
                        ? 'text-text-secondary border border-info/15 hover:text-text-primary hover:bg-bg-hover/50'
                        : 'text-text-muted hover:text-text-primary hover:bg-bg-hover/50 border border-transparent'
                  }`}
                style={workspace.active ? activeAccentStyle ?? undefined : inactiveAccentStyle ?? undefined}
              >
                {presentation.indexText && <span className="font-mono shrink-0">{presentation.indexText}</span>}
                {!workspace.active && accentColor && (
                  <span
                    className="h-1.5 w-1.5 rounded-full flex-shrink-0 border border-black/20"
                    style={{ backgroundColor: accentColor }}
                  />
                )}
                {WorkspaceIcon && <WorkspaceIcon className="w-3 h-3 flex-shrink-0" />}
                {presentation.text && <span className="truncate max-w-[48px]">{presentation.text}</span>}
                {hasAgents && (
                  <span className="absolute -top-0.5 -right-0.5 flex-shrink-0">
                    <span className="absolute inset-0 w-1.5 h-1.5 rounded-full bg-success animate-ping opacity-40" />
                    <span className="block w-1.5 h-1.5 rounded-full bg-success" />
                  </span>
                )}
                {!hasAgents && hasTerminals && (
                  <span className="absolute -top-0.5 -right-0.5 flex-shrink-0">
                    <span className="block w-1.5 h-1.5 rounded-full bg-info/60" />
                  </span>
                )}
                {hasTerminals && (
                  <span className="absolute -bottom-0.5 -right-1.5 min-w-[12px] h-3 px-0.5 rounded-full bg-info/90 text-[8px] leading-3 text-bg-deep font-bold text-center shadow-sm z-10">
                    {activity.terminalCount > 9 ? '9+' : activity.terminalCount}
                  </span>
                )}
              </button>
            </ContextMenuTrigger>
            <ContextMenuContent className="min-w-[150px]">
              {!workspace.active && (
                <ContextMenuItem onClick={() => onSwitch(workspace.key)} className="text-xs cursor-default">
                  Switch To Workspace
                </ContextMenuItem>
              )}
              <ContextMenuItem onClick={() => onDuplicate(workspace.key)} className="text-xs cursor-default">
                Duplicate Workspace
              </ContextMenuItem>
              <ContextMenuItem onClick={() => onManageIdentity(workspace.key)} className="text-xs cursor-default">
                Manage Identity
              </ContextMenuItem>
              <ContextMenuItem onClick={() => onDeactivate(workspace.key)} className="text-xs cursor-default">
                Deactivate
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">
            {workspace.name}
            {workspace.projectCount > 0 ? ` (${workspace.projectCount} project${workspace.projectCount > 1 ? 's' : ''})` : ''}
            {hasTerminals ? ` — ${activity.terminalCount} terminal${activity.terminalCount > 1 ? 's' : ''}` : ' — no terminals'}
            {hasAgents ? `, ${activity.agentCount} active AI` : ''}
            {` — #${workspace.index}`}
            {workspace.index <= 9 ? ` · ${SHORTCUTS[`WORKSPACE_${workspace.index}` as keyof typeof SHORTCUTS]?.keys}` : ''}
            {' · hold and drag to reorder'}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Wrapper that owns the Reorder.Item + drag controls for a single workspace pill.
 * Reorder.Item must be the outermost layout element so Framer Motion can
 * measure its bounding box for swap detection during drag.
 */
function WorkspacePillReorderItem({
  workspaceKey,
  ws,
  activity,
  display,
  disabled,
  isOverflow,
  needsExpand,
  onSwitch,
  onDuplicate,
  onManageIdentity,
  onDeactivate,
  onReorderCommit,
}: {
  workspaceKey: string;
  ws: WorkspacePillInfo;
  activity: { terminalCount: number; agentCount: number };
  display: ReturnType<typeof normalizeWorkspacePillDisplay>;
  disabled: boolean;
  isOverflow: boolean;
  needsExpand: boolean;
  onSwitch: (key: string) => void;
  onDuplicate: (key: string) => void;
  onManageIdentity: (key: string) => void;
  onDeactivate: (key: string) => void;
  onReorderCommit: () => void;
}) {
  const dragControls = useDragControls();
  const holdTimerRef = useRef<number | null>(null);
  const suppressClickUntilRef = useRef(0);

  const clearHoldTimer = useCallback(() => {
    if (holdTimerRef.current != null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
    clearHoldTimer();
    holdTimerRef.current = window.setTimeout(() => {
      suppressClickUntilRef.current = Date.now() + 250;
      dragControls.start(event, { snapToCursor: false });
    }, 180);
  }, [clearHoldTimer, disabled, dragControls]);

  useEffect(() => clearHoldTimer, [clearHoldTimer]);

  return (
    <Reorder.Item
      value={workspaceKey}
      layout
      layoutId={`ws-pill-${ws.key}`}
      initial={false}
      transition={{ type: 'spring', stiffness: 500, damping: 35, mass: 0.8 }}
      dragListener={false}
      dragControls={dragControls}
      onDragEnd={() => {
        clearHoldTimer();
        suppressClickUntilRef.current = Date.now() + 250;
        onReorderCommit();
      }}
      className={`list-none ${isOverflow && needsExpand
        ? 'max-w-0 opacity-0 overflow-hidden transition-[max-width,opacity] duration-300 ease-in-out group-hover/ws-pills:max-w-[60px] group-hover/ws-pills:opacity-100'
        : ''
      }`}
    >
      <WorkspacePillButton
        workspace={ws}
        activity={activity}
        display={display}
        disabled={disabled}
        suppressClickUntil={suppressClickUntilRef}
        onPointerDown={handlePointerDown}
        onPointerUp={clearHoldTimer}
        onSwitch={onSwitch}
        onDuplicate={onDuplicate}
        onManageIdentity={onManageIdentity}
        onDeactivate={onDeactivate}
      />
    </Reorder.Item>
  );
}

export function ViewTabBar() {
  const openTabs = useUIStore(s => s.openTabs);
  const fullViewContent = useUIStore(s => s.fullViewContent);
  const setFullViewContent = useUIStore(s => s.setFullViewContent);
  const closeTab = useUIStore(s => s.closeTab);
  const activePanel = useUIStore(s => s.activePanel);
  const togglePanel = useUIStore(s => s.togglePanel);
  const closeRightPanel = useUIStore(s => s.closeRightPanel);
  const toggleFullView = useUIStore(s => s.toggleFullView);
  const sidebarState = useUIStore(s => s.sidebarState);
  const setSidebarState = useUIStore(s => s.setSidebarState);
  const activeEditorFile = useUIStore(s => s.activeEditorFile);
  const setActiveEditorFile = useUIStore(s => s.setActiveEditorFile);
  const dirtyEditorFiles = useUIStore(s => s.dirtyEditorFiles);
  const currentProjectPath = useProjectStore(s => s.currentProjectPath);
  const workspaceName = useProjectStore(s => s.workspaceName);
  const projects = useProjectStore(s => s.projects);
  const { settings, updateSetting } = useSettings();
  const { config: aiToolConfig } = useAIToolConfig();
  const terminals = useTerminalStore(s => s.terminals);

  // ── Workspace pills data ─────────────────────────────────────────────────
  const { data: workspaceListRaw, refetch: refetchWorkspaces } = useIpcQuery(IPC.WORKSPACE_LIST, [], {
    staleTime: 10000,
  });
  const wsParsed = workspaceListRaw as WorkspaceListResult | undefined;
  const wsWorkspaces = useMemo<WorkspacePillInfo[]>(() =>
    wsParsed?.workspaces?.filter(ws => !(ws.inactive))?.map((ws, i) => ({
      key: ws.key,
      name: ws.name,
      active: ws.key === wsParsed!.active,
      projectCount: ws.projectCount ?? 0,
      projectPaths: ws.projectPaths ?? [],
      shortLabel: ws.shortLabel ?? null,
      icon: ws.icon ?? null,
      accentColor: normalizeWorkspaceAccentColor(ws.accentColor) ?? null,
      index: i + 1,
    })) ?? [],
    [wsParsed]
  );
  const workspacePillDisplay = normalizeWorkspacePillDisplay((settings?.appearance as Record<string, unknown>)?.workspacePillDisplay ?? (settings?.appearance as Record<string, unknown>)?.workspacePillStyle);
  const generalSettings = (settings?.general as Record<string, unknown>) || {};
  const maxVisibleWorkspaces = typeof generalSettings.maxVisibleWorkspaces === 'number' ? generalSettings.maxVisibleWorkspaces : 12;
  const collapsedWorkspaceCount = typeof generalSettings.collapsedWorkspaceCount === 'number' ? generalSettings.collapsedWorkspaceCount : 3;
  const autoSortWorkspacePills = generalSettings.autoSortWorkspacePills !== false; // default true
  const maxVisibleWorkspacePills = typeof generalSettings.maxVisibleWorkspacePills === 'number' ? generalSettings.maxVisibleWorkspacePills : 0; // 0 = auto
  const inactiveWorkspaceKeys = useMemo(
    () => wsParsed?.workspaces?.filter(ws => ws.inactive)?.map(ws => ws.key) ?? [],
    [wsParsed]
  );

  // Workspace activity detection for pills
  const allTerminals = useMemo(() => Array.from(terminals.values()), [terminals]);
  const workspaceActivity = useMemo(() => {
    const activity = new Map<string, { terminalCount: number; agentCount: number }>();
    for (const ws of wsWorkspaces) {
      const pathSet = new Set(ws.projectPaths);
      let terminalCount = 0;
      let agentCount = 0;
      for (const terminal of allTerminals) {
        if (!pathSet.has(terminal.projectPath || '')) continue;
        terminalCount += 1;
        if (terminal.claudeActive) agentCount += 1;
      }
      activity.set(ws.key, { terminalCount, agentCount });
    }
    return activity;
  }, [allTerminals, wsWorkspaces]);

  const [wsSwitching, setWsSwitching] = useState(false);
  const [wsReordering, setWsReordering] = useState(false);
  const [wsPulse, setWsPulse] = useState(false);
  const [wsManualReorder, setWsManualReorder] = useState(false);
  const [workspaceOrderKeys, setWorkspaceOrderKeys] = useState<string[]>([]);
  const workspaceOrderKeysRef = useRef<string[]>([]);
  const workspaceByKey = useMemo(
    () => new Map(wsWorkspaces.map((workspace) => [workspace.key, workspace])),
    [wsWorkspaces]
  );
  const [pinnedWorkspaceKeys, setPinnedWorkspaceKeys] = useState<string[]>([]);
  const pinnedWorkspaceKeysRef = useRef<string[]>([]);
  const [workspaceActivationTimes, setWorkspaceActivationTimes] = useState<Record<string, number>>({});
  const workspaceActivationTimesRef = useRef<Record<string, number>>({});
  const activeWorkspaceKey = wsParsed?.active ?? null;
  const previousActiveWorkspaceKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const nextKeys = wsWorkspaces.map((workspace) => workspace.key);
    workspaceOrderKeysRef.current = nextKeys;
    setWorkspaceOrderKeys(nextKeys);
  }, [wsWorkspaces]);

  useEffect(() => {
    pinnedWorkspaceKeysRef.current = pinnedWorkspaceKeys;
  }, [pinnedWorkspaceKeys]);

  useEffect(() => {
    workspaceActivationTimesRef.current = workspaceActivationTimes;
  }, [workspaceActivationTimes]);

  useEffect(() => {
    const validKeys = new Set(wsWorkspaces.map((workspace) => workspace.key));
    const orderedKeys = workspaceOrderKeysRef.current.filter((key) => validKeys.has(key));
    const nextTimes = Object.fromEntries(
      Object.entries(workspaceActivationTimesRef.current).filter(([key]) => validKeys.has(key))
    );

    workspaceActivationTimesRef.current = nextTimes;
    setWorkspaceActivationTimes(nextTimes);

    setPinnedWorkspaceKeys((prev) => {
      const deduped = dedupeWorkspaceKeys(prev, validKeys);
      const trimmed =
        deduped.length > collapsedWorkspaceCount
          ? deduped
              .slice()
              .sort((a, b) => (nextTimes[b] ?? 0) - (nextTimes[a] ?? 0))
              .slice(0, collapsedWorkspaceCount)
          : deduped;
      const trimmedSet = new Set(trimmed);
      const preservedOrder = deduped.filter((key) => trimmedSet.has(key));
      const nextPinned = fillPinnedWorkspaceKeys(preservedOrder, orderedKeys, collapsedWorkspaceCount);
      pinnedWorkspaceKeysRef.current = nextPinned;
      return nextPinned;
    });
  }, [collapsedWorkspaceCount, wsWorkspaces]);

  const noteWorkspaceActivation = useCallback((key: string, activatedAt = Date.now()) => {
    const nextTimes = {
      ...workspaceActivationTimesRef.current,
      [key]: activatedAt,
    };
    workspaceActivationTimesRef.current = nextTimes;
    setWorkspaceActivationTimes(nextTimes);
    return nextTimes;
  }, []);

  const promoteWorkspaceToPinnedSlots = useCallback((key: string, activatedAt = Date.now()) => {
    if (collapsedWorkspaceCount <= 0 || !workspaceByKey.has(key)) return;

    const orderedKeys = workspaceOrderKeysRef.current.filter((workspaceKey) => workspaceByKey.has(workspaceKey));
    const nextTimes = noteWorkspaceActivation(key, activatedAt);

    setPinnedWorkspaceKeys((prev) => {
      const validKeys = new Set(orderedKeys);
      const deduped = dedupeWorkspaceKeys(prev, validKeys);

      if (deduped.includes(key)) {
        pinnedWorkspaceKeysRef.current = deduped;
        return deduped;
      }

      if (deduped.length < collapsedWorkspaceCount) {
        const nextPinned = fillPinnedWorkspaceKeys([...deduped, key], orderedKeys, collapsedWorkspaceCount);
        pinnedWorkspaceKeysRef.current = nextPinned;
        return nextPinned;
      }

      const lruKey = getLeastRecentlyUsedWorkspaceKey(deduped, nextTimes);
      if (!lruKey) {
        const nextPinned = fillPinnedWorkspaceKeys([key], orderedKeys, collapsedWorkspaceCount);
        pinnedWorkspaceKeysRef.current = nextPinned;
        return nextPinned;
      }

      const nextPinned = deduped.map((workspaceKey) => (workspaceKey === lruKey ? key : workspaceKey));
      pinnedWorkspaceKeysRef.current = nextPinned;
      return nextPinned;
    });
  }, [collapsedWorkspaceCount, noteWorkspaceActivation, workspaceByKey]);

  useEffect(() => {
    if (!activeWorkspaceKey || !workspaceByKey.has(activeWorkspaceKey)) {
      previousActiveWorkspaceKeyRef.current = activeWorkspaceKey;
      return;
    }

    const previousActiveKey = previousActiveWorkspaceKeyRef.current;
    previousActiveWorkspaceKeyRef.current = activeWorkspaceKey;

    if (previousActiveKey == null) {
      noteWorkspaceActivation(activeWorkspaceKey);
      return;
    }

    if (previousActiveKey === activeWorkspaceKey) return;

    if (pinnedWorkspaceKeysRef.current.includes(activeWorkspaceKey)) {
      noteWorkspaceActivation(activeWorkspaceKey);
      return;
    }

    promoteWorkspaceToPinnedSlots(activeWorkspaceKey);
  }, [activeWorkspaceKey, noteWorkspaceActivation, promoteWorkspaceToPinnedSlots, workspaceByKey]);

  const handleWsSwitch = useCallback(async (key: string) => {
    if (wsSwitching || wsParsed?.active === key) return;
    setWsSwitching(true);
    try {
      await typedInvoke(IPC.WORKSPACE_SWITCH, key);
      const activatedAt = Date.now();
      if (pinnedWorkspaceKeysRef.current.includes(key)) {
        noteWorkspaceActivation(key, activatedAt);
      } else {
        promoteWorkspaceToPinnedSlots(key, activatedAt);
      }
      refetchWorkspaces();
      typedSend(IPC.LOAD_WORKSPACE);
    } catch {
      toast.error('Failed to switch workspace');
    } finally {
      setWsSwitching(false);
    }
  }, [noteWorkspaceActivation, promoteWorkspaceToPinnedSlots, refetchWorkspaces, wsParsed, wsSwitching]);

  const handleWorkspaceDeactivate = useCallback(async (key: string) => {
    if (wsSwitching || wsReordering) return;
    const target = wsWorkspaces.find((workspace) => workspace.key === key);
    if (!target) return;

    if (target.active) {
      const currentIndex = wsWorkspaces.findIndex((workspace) => workspace.key === key);
      const fallbackWorkspace =
        wsWorkspaces[currentIndex + 1]
        ?? wsWorkspaces[currentIndex - 1]
        ?? null;

      if (!fallbackWorkspace) {
        toast.warning('Cannot deactivate the only active workspace');
        return;
      }

      setWsSwitching(true);
      try {
        await typedInvoke(IPC.WORKSPACE_SWITCH, fallbackWorkspace.key);
        await typedInvoke(IPC.WORKSPACE_SET_INACTIVE, { key, inactive: true });
        refetchWorkspaces();
        typedSend(IPC.LOAD_WORKSPACE);
        toast.success('Workspace deactivated');
      } catch {
        toast.error('Failed to deactivate workspace');
      } finally {
        setWsSwitching(false);
        // Safety: Radix modal menus add pointer-events:none to <body> while open.
        // If the workspace pill (context menu trigger) unmounts before the menu's
        // close animation completes, that style can be orphaned — blocking all UI
        // interaction. Schedule a cleanup after animations settle.
        setTimeout(() => {
          if (document.body.style.pointerEvents === 'none') {
            document.body.style.pointerEvents = '';
          }
        }, 300);
      }
      return;
    }

    try {
      await typedInvoke(IPC.WORKSPACE_SET_INACTIVE, { key, inactive: true });
      refetchWorkspaces();
      toast.success('Workspace deactivated');
    } catch {
      toast.error('Failed to deactivate workspace');
    } finally {
      // Safety: same pointer-events cleanup as above
      setTimeout(() => {
        if (document.body.style.pointerEvents === 'none') {
          document.body.style.pointerEvents = '';
        }
      }, 300);
    }
  }, [refetchWorkspaces, wsParsed, wsReordering, wsSwitching, wsWorkspaces]);

  const openWorkspaceSettings = useCallback((key: string) => {
    window.dispatchEvent(new CustomEvent('open-workspace-settings', { detail: { key } }));
  }, []);

  const handleWorkspaceDuplicate = useCallback(async (key: string) => {
    if (wsSwitching || wsReordering) return;
    setWsSwitching(true);
    try {
      await typedInvoke(IPC.WORKSPACE_DUPLICATE, key);
      refetchWorkspaces();
      typedSend(IPC.LOAD_WORKSPACE);
      toast.success('Workspace duplicated');
    } catch {
      toast.error('Failed to duplicate workspace');
    } finally {
      setWsSwitching(false);
    }
  }, [refetchWorkspaces, wsReordering, wsSwitching]);

  const handleWorkspaceReorderCommit = useCallback(async () => {
    if (wsReordering) return;
    const orderedActiveKeys = workspaceOrderKeysRef.current.filter((key) => workspaceByKey.has(key));
    const currentActiveKeys = wsWorkspaces.map((workspace) => workspace.key);
    if (
      orderedActiveKeys.length !== currentActiveKeys.length ||
      orderedActiveKeys.every((key, index) => key === currentActiveKeys[index]) === false
    ) {
      setWsReordering(true);
      try {
        await typedInvoke(IPC.WORKSPACE_REORDER, [...orderedActiveKeys, ...inactiveWorkspaceKeys]);
        refetchWorkspaces();
        typedSend(IPC.LOAD_WORKSPACE);
      } catch {
        toast.error('Failed to reorder workspace');
        workspaceOrderKeysRef.current = currentActiveKeys;
        setWorkspaceOrderKeys(currentActiveKeys);
      } finally {
        setWsReordering(false);
      }
    }
  }, [inactiveWorkspaceKeys, refetchWorkspaces, workspaceByKey, wsReordering, wsWorkspaces]);

  // Compute which workspace keys have active agents or terminals
  const activeWorkspaceKeysSet = useMemo(() => {
    const active = new Set<string>();
    for (const [key, act] of workspaceActivity.entries()) {
      if (act.agentCount > 0 || act.terminalCount > 0) active.add(key);
    }
    return active;
  }, [workspaceActivity]);

  const displayedWorkspaceKeys = useMemo(() => {
    const validKeys = new Set(workspaceOrderKeys.filter((key) => workspaceByKey.has(key)));
    const pinned = dedupeWorkspaceKeys(pinnedWorkspaceKeys, validKeys);
    const overflow = workspaceOrderKeys.filter((key) => validKeys.has(key) && !pinned.includes(key));
    const baseOrder = [...pinned, ...overflow];

    // Activity-based sorting: active-first when enabled and no manual reorder.
    // Within each tier, sort by most-recently-selected (activation time) so the
    // user's manual workspace selections are respected within activity groups.
    if (autoSortWorkspacePills && !wsManualReorder) {
      const withAgents: string[] = [];
      const withTerminals: string[] = [];
      const idle: string[] = [];
      for (const key of baseOrder) {
        const act = workspaceActivity.get(key);
        if (act && act.agentCount > 0) withAgents.push(key);
        else if (act && act.terminalCount > 0) withTerminals.push(key);
        else idle.push(key);
      }
      const byRecent = (a: string, b: string) =>
        (workspaceActivationTimes[b] ?? 0) - (workspaceActivationTimes[a] ?? 0);
      withAgents.sort(byRecent);
      withTerminals.sort(byRecent);
      idle.sort(byRecent);
      return [...withAgents, ...withTerminals, ...idle];
    }

    return baseOrder;
  }, [autoSortWorkspacePills, pinnedWorkspaceKeys, workspaceActivity, workspaceActivationTimes, workspaceByKey, workspaceOrderKeys, wsManualReorder]);

  // Determine effective visible pill count: always show active pills + fill up to max
  const effectiveCollapsedCount = useMemo(() => {
    if (maxVisibleWorkspacePills > 0) {
      // User specified a max — always show active ones even if exceeds max
      const activeCount = displayedWorkspaceKeys.filter(k => activeWorkspaceKeysSet.has(k)).length;
      return Math.max(maxVisibleWorkspacePills, activeCount);
    }
    // Auto mode (0): use collapsedWorkspaceCount but always show active pills
    const activeCount = displayedWorkspaceKeys.filter(k => activeWorkspaceKeysSet.has(k)).length;
    return Math.max(collapsedWorkspaceCount, activeCount);
  }, [activeWorkspaceKeysSet, collapsedWorkspaceCount, displayedWorkspaceKeys, maxVisibleWorkspacePills]);

  const handleWsCreate = useCallback(() => {
    window.dispatchEvent(new Event('open-workspace-create'));
  }, []);

  // Keyboard navigation for workspace pills (WAI-ARIA toolbar pattern)
  const handleWsPillKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const buttons = (e.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('button:not([disabled])');
    const focused = document.activeElement;
    const idx = Array.from(buttons).indexOf(focused as HTMLButtonElement);
    if (idx < 0) return;
    const next = e.key === 'ArrowRight'
      ? (idx + 1) % buttons.length
      : (idx - 1 + buttons.length) % buttons.length;
    buttons[next].focus();
  }, []);

  // Ctrl+Alt+W highlight pulse
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        setWsPulse(true);
        setTimeout(() => setWsPulse(false), 1200);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Derive per-project tool binding
  const currentProject = currentProjectPath ? projects.find(p => p.path === currentProjectPath) : null;
  const projectToolBinding = currentProject?.aiTool ?? null;
  const activeToolName = aiToolConfig?.activeTool?.name ?? 'Claude Code';
  const activeToolInstalled = aiToolConfig?.activeTool?.installed !== false;

  // Usage data state
  const [usageData, setUsageData] = useState<ClaudeUsageData | null>(null);
  const [usageFetching, setUsageFetching] = useState(false);

  // Map sub-views to their parent tab for active highlighting
  // Editor tabs take precedence when an editor file is active and no full-view content
  const activeTabId = fullViewContent
    ? getTabIdForContent(fullViewContent)
    : activeEditorFile
      ? makeEditorTabId(activeEditorFile)
      : 'terminal';

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
    const unsub = getTransport().on(IPC.CLAUDE_USAGE_DATA, handler);
    setUsageFetching(true);
    getTransport().send(IPC.LOAD_CLAUDE_USAGE);

    return unsub;
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
  const { streams } = useActivity();
  const runningStreams = useMemo(
    () => streams.filter((stream) => stream.status === 'running' || stream.status === 'pending'),
    [streams],
  );
  const runningSummary = useMemo(() => {
    const counts = new Map<string, number>();
    for (const stream of runningStreams) {
      counts.set(stream.source, (counts.get(stream.source) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([sourceName, count]) => `${count} ${sourceName}`).join(' · ');
  }, [runningStreams]);
  const primaryRunningStream = runningStreams[0] ?? null;

  return (
    <div className="flex items-center bg-bg-secondary border-b border-border-subtle shrink-0 overflow-visible relative z-10" data-neon-bar="">
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

      {/* ── Workspace pills (left side, expands rightward on hover) ── */}
      {wsWorkspaces.length > 0 && (() => {
        const needsExpand = displayedWorkspaceKeys.length > effectiveCollapsedCount;

        return (
        <div
          className={`group/ws-pills flex items-center border-r border-border-subtle mr-1 pr-1 shrink-0 overflow-visible transition-all duration-300 ${
            wsPulse ? 'ring-1 ring-accent/40 rounded-md bg-accent/5' : ''
          }`}
        >
          <div className="flex items-center overflow-visible" role="toolbar" onKeyDown={handleWsPillKeyDown}>
            {/* Collapsed pills — always visible */}
          <Reorder.Group
            axis="x"
            values={displayedWorkspaceKeys}
            onReorder={(nextOrder) => {
              setWsManualReorder(true);
              workspaceOrderKeysRef.current = nextOrder;
              setWorkspaceOrderKeys(nextOrder);
              const nextPinned = nextOrder.slice(0, effectiveCollapsedCount);
              pinnedWorkspaceKeysRef.current = nextPinned;
              setPinnedWorkspaceKeys(nextPinned);
            }}
            className="flex items-center"
          >
            {displayedWorkspaceKeys.map((workspaceKey, i) => {
              const ws = workspaceByKey.get(workspaceKey);
              if (!ws) return null;
              const act = workspaceActivity.get(ws.key) ?? { terminalCount: 0, agentCount: 0 };
              const isOverflow = i >= effectiveCollapsedCount;
              return (
                <WorkspacePillReorderItem
                  key={ws.key}
                  workspaceKey={workspaceKey}
                  ws={{ ...ws, index: workspaceOrderKeys.indexOf(workspaceKey) + 1 }}
                  activity={act}
                  display={workspacePillDisplay}
                  disabled={wsSwitching || wsReordering}
                  isOverflow={isOverflow}
                  needsExpand={needsExpand}
                  onSwitch={handleWsSwitch}
                  onDuplicate={handleWorkspaceDuplicate}
                  onManageIdentity={openWorkspaceSettings}
                  onDeactivate={handleWorkspaceDeactivate}
                  onReorderCommit={handleWorkspaceReorderCommit}
                />
              );
            })}
          </Reorder.Group>
          {/* Overflow hint — fades out as hidden pills animate in on hover */}
          {needsExpand && (
            <span className="flex items-center text-text-muted opacity-50 group-hover/ws-pills:opacity-0 transition-opacity duration-200 pointer-events-none mx-0.5">
              <MoreHorizontal className="w-3 h-3" />
            </span>
          )}
          </div>
          {/* Auto-sort toggle — shows when manual reorder overrode auto-sort */}
          {autoSortWorkspacePills && wsManualReorder && (
            <TooltipProvider delayDuration={400}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setWsManualReorder(false)}
                    className="flex items-center justify-center h-5 w-5 rounded-md text-warning hover:text-text-primary hover:bg-bg-hover/50
                      transition-colors cursor-pointer mx-0.5 border border-transparent"
                  >
                    <ArrowUpDown className="w-2.5 h-2.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Re-enable auto-sort by activity</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {/* Add workspace button */}
          <TooltipProvider delayDuration={400}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleWsCreate}
                  className="flex items-center justify-center h-5 w-5 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-hover/50
                    transition-colors cursor-pointer mx-0.5 border border-transparent"
                >
                  <Plus className="w-2.5 h-2.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>New workspace</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        );
      })()}

      {/* Open tabs (flex-1 fills remaining space) */}
      <div className="flex items-center overflow-x-auto scrollbar-none flex-1 min-w-0">
        {openTabs.map(tab => {
          const isActive = tab.id === activeTabId;
          const isEditor = isEditorTab(tab.id);
          const editorPath = isEditor ? getEditorTabPath(tab.id) : null;
          const isDirty = editorPath ? dirtyEditorFiles.has(editorPath) : false;
          const Icon = isEditor ? FileText : TAB_ICONS[tab.id];
          return (
            <button
              key={tab.id}
              onClick={() => {
                if (isEditor && editorPath) {
                  // Switch to this editor file
                  setActiveEditorFile(editorPath);
                  useUIStore.getState().setFullViewContent(null);
                } else if (tab.id === 'terminal') {
                  // Switch to terminal — clear both full-view and editor
                  setFullViewContent(null);
                  setActiveEditorFile(null);
                } else {
                  const content = tab.id as FullViewContent;
                  setFullViewContent(content);
                }
              }}
              className={`group flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 transition-colors shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-bg-primary text-text-primary border-accent'
                  : 'text-text-tertiary hover:text-text-secondary hover:bg-bg-hover border-transparent'
              }`}
              title={editorPath ?? tab.label}
            >
              {isDirty && (
                <span className="w-2 h-2 rounded-full bg-warning flex-shrink-0" />
              )}
              {Icon && <Icon className="w-3.5 h-3.5" />}
              <span className={isEditor ? 'max-w-[140px] truncate' : ''}>{tab.label}</span>
              {tab.closable && (
                <span
                  role="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Guard: confirm before closing a dirty editor tab
                    if (isDirty) {
                      const fileName = tab.label || 'this file';
                      if (!window.confirm(`"${fileName}" has unsaved changes. Close anyway?`)) return;
                    }
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
                      getTransport().send(IPC.REFRESH_CLAUDE_USAGE);
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

        {runningStreams.length > 0 && (
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => focusActivityBar({ mode: 'activity', streamId: primaryRunningStream?.id ?? null })}
                  className="group/running flex items-center gap-1.5 px-2 py-0.5 bg-accent/10 border border-accent/20 rounded-md
                    text-accent hover:bg-accent/15 hover:border-accent/30 transition-colors flex-shrink-0"
                >
                  <Loader2 className="h-3 w-3 animate-spin flex-shrink-0" />
                  <span className="text-[10px] font-medium whitespace-nowrap">
                    {runningStreams.length} running
                  </span>
                  {primaryRunningStream && (
                    <span className="max-w-[120px] truncate text-[10px] text-text-secondary group-hover/running:text-text-primary">
                      {primaryRunningStream.name}
                    </span>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{runningSummary || `${runningStreams.length} active stream${runningStreams.length === 1 ? '' : 's'}`}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        <div className="h-4 w-px bg-border-subtle mx-0.5" />

        {/* Panel shortcut buttons — full-view dashboards open as tabs, others open right sidebar */}
        {PANEL_SHORTCUTS.map((panel) => {
          const Icon = panel.icon;
          // Dashboard panels open as full-view tabs (primary), not right sidebar
          const isFullViewPanel = panel.id === 'overview' || panel.id === 'system';
          const isActive = isFullViewPanel
            ? fullViewContent === panel.id
            : activePanel === panel.id;
          return (
            <TooltipProvider key={panel.id} delayDuration={400}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => isFullViewPanel ? toggleFullView(panel.id as any) : togglePanel(panel.id)}
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
          {source !== 'local-cache' && !data.error && data.cacheAgeSeconds != null && (
            <span className="font-mono">({data.cacheAgeSeconds}s ago)</span>
          )}
          {(data.error || source === 'cached') && data.lastUpdated && (
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
          {resetsAt && <ResetTime resetsAt={resetsAt} showAbsolute />}
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

/** Formats reset time as relative countdown + absolute time */
function ResetTime({ resetsAt, showAbsolute = false }: { resetsAt: string; showAbsolute?: boolean }) {
  // Live countdown — re-render every 60s so the displayed time ticks down
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  const resetDate = new Date(resetsAt);
  const diff = resetDate.getTime() - Date.now();

  // Format absolute time: "2:59 PM" or "Mar 27, 4:59 PM"
  const isToday = resetDate.toDateString() === new Date().toDateString();
  const absoluteTime = isToday
    ? resetDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : resetDate.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', ' + resetDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  // If reset time is in the past, show "resetting..." instead of hiding
  if (diff <= 0) {
    return <span className="text-[9px] text-text-muted font-mono" title={`Was ${absoluteTime}`}>(resetting)</span>;
  }

  const mins = Math.floor(diff / 60000);
  let relative: string;
  if (mins < 60) {
    relative = `${mins}m`;
  } else {
    const hours = Math.floor(mins / 60);
    if (hours < 24) {
      relative = `${hours}h ${mins % 60}m`;
    } else {
      const days = Math.floor(hours / 24);
      relative = `${days}d ${hours % 24}h`;
    }
  }

  if (showAbsolute) {
    return <span className="text-[9px] text-text-muted font-mono">{relative} · {absoluteTime}</span>;
  }
  return <span className="text-[9px] text-text-muted font-mono" title={`Resets ${absoluteTime}`}>({relative})</span>;
}
