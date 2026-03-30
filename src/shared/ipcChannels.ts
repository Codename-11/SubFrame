/**
 * IPC Channel Constants — TypeScript Edition
 * Single source of truth for all IPC channel names and their type signatures.
 */

import type { AgentStatePayload } from './agentStateTypes';
import type { ActivityOutputEvent, ActivityStatusEvent, ActivityListPayload, OutputChannelEvent, OutputChannel, OutputChannelListPayload, OutputChannelLogPayload } from './activityTypes';

// ─── Channel Constants ───────────────────────────────────────────────────────

export const IPC = {
  // Terminal
  START_TERMINAL: 'start-terminal',
  RESTART_TERMINAL: 'restart-terminal',
  TERMINAL_INPUT: 'terminal-input',
  TERMINAL_OUTPUT: 'terminal-output',
  TERMINAL_RESIZE: 'terminal-resize',

  // Project
  SELECT_PROJECT_FOLDER: 'select-project-folder',
  CREATE_NEW_PROJECT: 'create-new-project',
  PROJECT_SELECTED: 'project-selected',

  // File Tree
  LOAD_FILE_TREE: 'load-file-tree',
  FILE_TREE_DATA: 'file-tree-data',

  // History
  LOAD_PROMPT_HISTORY: 'load-prompt-history',
  PROMPT_HISTORY_DATA: 'prompt-history-data',
  TOGGLE_HISTORY_PANEL: 'toggle-history-panel',

  // Commands
  RUN_COMMAND: 'run-command',

  // Workspace
  LOAD_WORKSPACE: 'load-workspace',
  WORKSPACE_DATA: 'workspace-data',
  WORKSPACE_UPDATED: 'workspace-updated',
  ADD_PROJECT_TO_WORKSPACE: 'add-project-to-workspace',
  REMOVE_PROJECT_FROM_WORKSPACE: 'remove-project-from-workspace',
  RENAME_PROJECT: 'rename-project',
  SET_PROJECT_AI_TOOL: 'set-project-ai-tool',
  WORKSPACE_LIST: 'workspace-list',
  WORKSPACE_LIST_DATA: 'workspace-list-data',
  WORKSPACE_SWITCH: 'workspace-switch',
  WORKSPACE_CREATE: 'workspace-create',
  WORKSPACE_DUPLICATE: 'workspace-duplicate',
  WORKSPACE_RENAME: 'workspace-rename',
  WORKSPACE_DELETE: 'workspace-delete',
  WORKSPACE_REORDER: 'workspace-reorder',
  WORKSPACE_SET_INACTIVE: 'workspace-set-inactive',

  // Default Project Directory
  SCAN_PROJECT_DIR: 'scan-project-dir',
  SELECT_DEFAULT_PROJECT_DIR: 'select-default-project-dir',

  // Generic Folder Dialogs
  SELECT_FOLDER: 'select-folder',
  CREATE_FOLDER: 'create-folder',

  // SubFrame Project
  INITIALIZE_FRAME_PROJECT: 'initialize-frame-project',
  FRAME_PROJECT_INITIALIZED: 'frame-project-initialized',
  CHECK_IS_FRAME_PROJECT: 'check-is-frame-project',
  IS_FRAME_PROJECT_RESULT: 'is-frame-project-result',
  GET_FRAME_CONFIG: 'get-frame-config',
  FRAME_CONFIG_DATA: 'frame-config-data',

  // File Editor
  READ_FILE: 'read-file',
  FILE_CONTENT: 'file-content',
  WRITE_FILE: 'write-file',
  FILE_SAVED: 'file-saved',
  READ_FILE_IMAGE: 'read-file-image',
  IMAGE_CONTENT: 'image-content',

  // Multi-Terminal
  TERMINAL_CREATE: 'terminal-create',
  TERMINAL_CREATED: 'terminal-created',
  TERMINAL_SHELL_READY: 'terminal-shell-ready',
  TERMINAL_DESTROY: 'terminal-destroy',
  TERMINAL_DESTROYED: 'terminal-destroyed',
  TERMINAL_INPUT_ID: 'terminal-input-id',
  TERMINAL_OUTPUT_ID: 'terminal-output-id',
  TERMINAL_RESIZE_ID: 'terminal-resize-id',
  TERMINAL_FOCUS: 'terminal-focus',
  GET_AVAILABLE_SHELLS: 'get-available-shells',
  AVAILABLE_SHELLS_DATA: 'available-shells-data',
  CLAUDE_ACTIVE_STATUS: 'claude-active-status',
  IS_TERMINAL_CLAUDE_ACTIVE: 'is-terminal-claude-active',
  GET_TERMINAL_SESSION_NAME: 'get-terminal-session-name',
  GET_TERMINAL_STATE: 'get-terminal-state',
  GET_TERMINAL_BACKLOG: 'get-terminal-backlog',
  SAVE_TERMINAL_SCROLLBACK: 'save-terminal-scrollback',
  LOAD_TERMINAL_SCROLLBACK: 'load-terminal-scrollback',
  USER_MESSAGE_SIGNAL: 'user-message-signal',
  TERMINAL_STALL_DETECTED: 'terminal-stall-detected',
  TERMINAL_STALL_CLEARED: 'terminal-stall-cleared',
  TERMINAL_STALL_RECOVER: 'terminal-stall-recover',
  TERMINAL_RESTART: 'terminal-restart-shell',

  // Tasks Panel
  LOAD_TASKS: 'load-tasks',
  TASKS_DATA: 'tasks-data',
  ADD_TASK: 'add-task',
  UPDATE_TASK: 'update-task',
  DELETE_TASK: 'delete-task',
  TASK_UPDATED: 'task-updated',
  TOGGLE_TASKS_PANEL: 'toggle-tasks-panel',
  WATCH_TASKS: 'watch-tasks',
  UNWATCH_TASKS: 'unwatch-tasks',
  ENHANCE_TASK: 'enhance-task',
  TASK_ENHANCE_RESULT: 'task-enhance-result',

  // Plugins Panel
  LOAD_PLUGINS: 'load-plugins',
  PLUGINS_DATA: 'plugins-data',
  TOGGLE_PLUGIN: 'toggle-plugin',
  PLUGIN_TOGGLED: 'plugin-toggled',
  TOGGLE_PLUGINS_PANEL: 'toggle-plugins-panel',
  REFRESH_PLUGINS: 'refresh-plugins',

  // Claude Sessions
  LOAD_CLAUDE_SESSIONS: 'load-claude-sessions',
  REFRESH_CLAUDE_SESSIONS: 'refresh-claude-sessions',
  CHECK_ACTIVE_CLAUDE_SESSION: 'check-active-claude-session',
  RENAME_CLAUDE_SESSION: 'rename-claude-session',
  DELETE_CLAUDE_SESSION: 'delete-claude-session',
  DELETE_ALL_CLAUDE_SESSIONS: 'delete-all-claude-sessions',
  LIST_AI_SESSIONS: 'list-ai-sessions',
  AI_SESSIONS_UPDATED: 'ai-sessions-updated',

  // GitHub Panel
  LOAD_GITHUB_ISSUES: 'load-github-issues',
  LOAD_GITHUB_PRS: 'load-github-prs',
  LOAD_GITHUB_WORKFLOWS: 'load-github-workflows',
  GITHUB_ISSUES_DATA: 'github-issues-data',
  TOGGLE_GITHUB_PANEL: 'toggle-github-panel',
  OPEN_GITHUB_ISSUE: 'open-github-issue',
  VIEW_GITHUB_ISSUE: 'view-github-issue',
  VIEW_GITHUB_PR: 'view-github-pr',
  CREATE_GITHUB_ISSUE: 'create-github-issue',
  LOAD_GITHUB_PR_DIFF: 'load-github-pr-diff',
  RERUN_GITHUB_WORKFLOW: 'rerun-github-workflow',
  DISPATCH_GITHUB_WORKFLOW: 'dispatch-github-workflow',
  LOAD_GITHUB_NOTIFICATIONS: 'load-github-notifications',
  MARK_GITHUB_NOTIFICATION_READ: 'mark-github-notification-read',

  // Claude Usage
  LOAD_CLAUDE_USAGE: 'load-claude-usage',
  CLAUDE_USAGE_DATA: 'claude-usage-data',
  REFRESH_CLAUDE_USAGE: 'refresh-claude-usage',

  // Overview Panel
  LOAD_OVERVIEW: 'load-overview',
  OVERVIEW_DATA: 'overview-data',
  GET_FILE_GIT_HISTORY: 'get-file-git-history',

  // Git Branches Panel
  LOAD_GIT_BRANCHES: 'load-git-branches',
  SWITCH_GIT_BRANCH: 'switch-git-branch',
  CREATE_GIT_BRANCH: 'create-git-branch',
  DELETE_GIT_BRANCH: 'delete-git-branch',
  LOAD_GIT_WORKTREES: 'load-git-worktrees',
  ADD_GIT_WORKTREE: 'add-git-worktree',
  REMOVE_GIT_WORKTREE: 'remove-git-worktree',
  TOGGLE_GIT_BRANCHES_PANEL: 'toggle-git-branches-panel',
  LOAD_GIT_STATUS: 'load-git-status',
  GIT_START_AUTO_FETCH: 'git-start-auto-fetch',
  GIT_STOP_AUTO_FETCH: 'git-stop-auto-fetch',

  // AI Tool Settings
  GET_AI_TOOL_CONFIG: 'get-ai-tool-config',
  AI_TOOL_CONFIG_DATA: 'ai-tool-config-data',
  SET_AI_TOOL: 'set-ai-tool',
  ADD_CUSTOM_AI_TOOL: 'add-custom-ai-tool',
  REMOVE_CUSTOM_AI_TOOL: 'remove-custom-ai-tool',
  RECHECK_AI_TOOLS: 'recheck-ai-tools',
  AI_TOOL_CHANGED: 'ai-tool-changed',

  // Settings Panel
  LOAD_SETTINGS: 'load-settings',
  SETTINGS_DATA: 'settings-data',
  UPDATE_SETTING: 'update-setting',
  SETTINGS_UPDATED: 'settings-updated',

  // AI Files Management
  GET_AI_FILES_STATUS: 'get-ai-files-status',
  AI_FILES_STATUS_DATA: 'ai-files-status-data',
  INJECT_BACKLINK: 'inject-backlink',
  REMOVE_BACKLINK: 'remove-backlink',
  CREATE_NATIVE_FILE: 'create-native-file',
  MIGRATE_SYMLINK: 'migrate-symlink',
  AI_FILE_UPDATED: 'ai-file-updated',
  VERIFY_BACKLINKS: 'verify-backlinks',
  BACKLINK_VERIFICATION_RESULT: 'backlink-verification-result',

  // Backlink Customization
  GET_BACKLINK_CONFIG: 'get-backlink-config',
  BACKLINK_CONFIG_DATA: 'backlink-config-data',
  SAVE_BACKLINK_CONFIG: 'save-backlink-config',
  BACKLINK_CONFIG_SAVED: 'backlink-config-saved',
  UPDATE_ALL_BACKLINKS: 'update-all-backlinks',
  ALL_BACKLINKS_UPDATED: 'all-backlinks-updated',

  // SubFrame Health
  GET_SUBFRAME_HEALTH: 'get-subframe-health',
  SUBFRAME_HEALTH_DATA: 'subframe-health-data',
  UPDATE_SUBFRAME_COMPONENTS: 'update-subframe-components',
  SUBFRAME_COMPONENTS_UPDATED: 'subframe-components-updated',
  UNINSTALL_SUBFRAME: 'uninstall-subframe',
  SUBFRAME_UNINSTALLED: 'subframe-uninstalled',

  // Agent State (real-time visualization)
  LOAD_AGENT_STATE: 'load-agent-state',
  AGENT_STATE_DATA: 'agent-state-data',
  WATCH_AGENT_STATE: 'watch-agent-state',
  UNWATCH_AGENT_STATE: 'unwatch-agent-state',

  // Skills
  LOAD_SKILLS: 'load-skills',

  // Onboarding (AI analysis pipeline)
  DETECT_PROJECT_INTELLIGENCE: 'detect-project-intelligence',
  RUN_ONBOARDING_ANALYSIS: 'run-onboarding-analysis',
  IMPORT_ONBOARDING_RESULTS: 'import-onboarding-results',
  CANCEL_ONBOARDING_ANALYSIS: 'cancel-onboarding-analysis',
  ONBOARDING_PROGRESS: 'onboarding-progress',
  GET_ONBOARDING_SESSION: 'get-onboarding-session',
  CLEAR_ONBOARDING_SESSION: 'clear-onboarding-session',
  GET_ONBOARDING_PROMPT_PREVIEW: 'get-onboarding-prompt-preview',
  BROWSE_ONBOARDING_FILES: 'browse-onboarding-files',

  // Prompt Library
  LOAD_PROMPTS: 'load-prompts',
  SAVE_PROMPT: 'save-prompt',
  DELETE_PROMPT: 'delete-prompt',

  // Global Prompt Library (user-level, ~/.subframe/prompts.json)
  LOAD_GLOBAL_PROMPTS: 'load-global-prompts',
  SAVE_GLOBAL_PROMPT: 'save-global-prompt',
  DELETE_GLOBAL_PROMPT: 'delete-global-prompt',

  // What's New / Changelog
  GET_RELEASE_NOTES: 'get-release-notes',

  // Auto-Updater
  UPDATER_CHECK: 'updater-check',
  UPDATER_STATUS: 'updater-status',
  UPDATER_DOWNLOAD: 'updater-download',
  UPDATER_INSTALL: 'updater-install',
  UPDATER_PROGRESS: 'updater-progress',

  // Pipeline System
  PIPELINE_LIST_WORKFLOWS: 'pipeline-list-workflows',
  PIPELINE_LIST_RUNS: 'pipeline-list-runs',
  PIPELINE_GET_RUN: 'pipeline-get-run',
  PIPELINE_START: 'pipeline-start',
  PIPELINE_CANCEL: 'pipeline-cancel',
  PIPELINE_APPROVE_STAGE: 'pipeline-approve-stage',
  PIPELINE_REJECT_STAGE: 'pipeline-reject-stage',
  PIPELINE_APPLY_PATCH: 'pipeline-apply-patch',
  PIPELINE_DELETE_RUN: 'pipeline-delete-run',
  PIPELINE_SAVE_WORKFLOW: 'pipeline-save-workflow',
  PIPELINE_DELETE_WORKFLOW: 'pipeline-delete-workflow',
  PIPELINE_PROGRESS: 'pipeline-progress',
  PIPELINE_RUN_UPDATED: 'pipeline-run-updated',
  PIPELINE_RUNS_DATA: 'pipeline-runs-data',
  WATCH_PIPELINE: 'watch-pipeline',
  UNWATCH_PIPELINE: 'unwatch-pipeline',

  // Activity Streams
  ACTIVITY_LIST: 'activity-list',
  ACTIVITY_CANCEL: 'activity-cancel',
  ACTIVITY_CLEAR: 'activity-clear',
  ACTIVITY_OUTPUT: 'activity-output',
  ACTIVITY_STATUS: 'activity-status',

  // Output Channels
  OUTPUT_CHANNEL_LIST: 'output-channel-list',
  OUTPUT_CHANNEL_LOG: 'output-channel-log',
  OUTPUT_CHANNEL_CLEAR: 'output-channel-clear',
  OUTPUT_CHANNEL_OUTPUT: 'output-channel-output',
  OUTPUT_CHANNEL_UPDATED: 'output-channel-updated',

  // Pop-Out Terminal
  TERMINAL_POPOUT: 'terminal-popout',
  TERMINAL_DOCK: 'terminal-dock',
  TERMINAL_POPOUT_STATUS: 'terminal-popout-status',
  POPOUT_ACTIVATE: 'popout-activate',

  // Pop-Out Editor
  EDITOR_POPOUT: 'editor-popout',
  EDITOR_DOCK: 'editor-dock',
  EDITOR_POPOUT_STATUS: 'editor-popout-status',

  // CLI Integration (main → renderer)
  CLI_OPEN_FILE: 'cli-open-file',
  CLI_OPEN_PROJECT: 'cli-open-project',
  INSTALL_CLI: 'install-cli',
  UNINSTALL_CLI: 'uninstall-cli',
  CHECK_CLI_STATUS: 'check-cli-status',

  // Windows Context Menu
  INSTALL_CONTEXT_MENU: 'install-context-menu',
  UNINSTALL_CONTEXT_MENU: 'uninstall-context-menu',
  CHECK_CONTEXT_MENU: 'check-context-menu',

  // Graceful Shutdown
  GRACEFUL_SHUTDOWN_REQUEST: 'graceful-shutdown-request',
  GRACEFUL_SHUTDOWN_STATUS: 'graceful-shutdown-status',
  GRACEFUL_SHUTDOWN_COMPLETE: 'graceful-shutdown-complete',
  GRACEFUL_SHUTDOWN_CONFIRM: 'graceful-shutdown-confirm',
  GRACEFUL_SHUTDOWN_CANCEL: 'graceful-shutdown-cancel',
  GRACEFUL_SHUTDOWN_FORCE: 'graceful-shutdown-force',

  // Local API Server (integration bridge)
  API_SELECTION_SYNC: 'api-selection-sync',           // renderer → main: sync terminal selection
  API_GET_TERMINALS: 'api-get-terminals',             // main → renderer: request terminal list
  API_GET_BUFFER: 'api-get-buffer',                   // main → renderer: request visible buffer
  API_GET_ACTIVE_SELECTION: 'api-get-active-selection', // main → renderer: request active terminal selection
  API_GET_CONTEXT: 'api-get-context',                 // main → renderer: request terminal context
  API_RENDERER_RESPONSE: 'api-renderer-response',     // renderer → main: response to request
  API_SERVER_INFO: 'api-server-info',                  // handle: get server port/token
  API_SERVER_TOGGLE: 'api-server-toggle',              // handle: enable/disable server
  API_SERVER_REGEN_TOKEN: 'api-server-regen-token',    // handle: regenerate auth token
  DETECT_AI_FEATURES: 'detect-ai-features',            // handle: scan AI tool config for features

  // Web Server
  WEB_SERVER_INFO: 'web-server-info',
  WEB_SERVER_TOGGLE: 'web-server-toggle',
  WEB_SERVER_REGEN_TOKEN: 'web-server-regen-token',
  WEB_SESSION_STATE: 'web-session-state',
  WEB_SESSION_SYNC: 'web-session-sync',
  WEB_SERVER_GENERATE_PAIRING: 'web-server-generate-pairing',
  WEB_SERVER_GET_SSH_COMMAND: 'web-server-get-ssh-command',
  WEB_REMOTE_POINTER_SYNC: 'web-remote-pointer-sync',
  WEB_REMOTE_POINTER_UPDATED: 'web-remote-pointer-updated',
  WEB_REMOTE_POINTER_CLEARED: 'web-remote-pointer-cleared',
  WEB_CLIENT_CONNECTED: 'web-client-connected',
  WEB_CLIENT_DISCONNECTED: 'web-client-disconnected',

  // Session Control (cooperative control handoff between Electron and web client)
  SESSION_CONTROL_STATE: 'session-control-state',
  SESSION_CONTROL_REQUEST: 'session-control-request',
  SESSION_CONTROL_GRANT: 'session-control-grant',
  SESSION_CONTROL_TAKE: 'session-control-take',
  SESSION_CONTROL_RELEASE: 'session-control-release',

  // Menu Actions (main → renderer)
  MENU_TOGGLE_SIDEBAR: 'menu-toggle-sidebar',
  MENU_TOGGLE_RIGHT_PANEL: 'menu-toggle-right-panel',
  MENU_RESET_LAYOUT: 'menu-reset-layout',
  MENU_CLOSE_TERMINAL: 'menu-close-terminal',
  MENU_OPEN_SETTINGS: 'menu-open-settings',
  MENU_NEW_TERMINAL: 'menu-new-terminal',
  MENU_OPEN_FILE: 'menu-open-file',

  // AI Analysis Panel
  RUN_AI_ANALYSIS: 'run-ai-analysis',
  AI_ANALYSIS_RESULT: 'ai-analysis-result',
  AI_ANALYSIS_STATUS: 'ai-analysis-status',

  // Claude Configuration
  GET_CLAUDE_CONFIG_STATUS: 'get-claude-config-status',

  // Renderer Hot Reload
  RENDERER_HOT_RELOAD: 'renderer-hot-reload',
  TERMINAL_RESYNC: 'terminal-resync',
  RENDERER_RELOADED: 'renderer-reloaded',

  // Session Snapshot (terminal restore across restarts/updates)
  SESSION_SNAPSHOT_SAVE: 'session-snapshot-save',
  SESSION_SNAPSHOT_RESTORE: 'session-snapshot-restore',
  SESSION_SNAPSHOT_STATUS: 'session-snapshot-status',

  // Dev tools
  DEV_SYNC_FROM_PRODUCTION: 'dev-sync-from-production',
} as const;

export type IPCChannel = (typeof IPC)[keyof typeof IPC];

// ─── Type helpers ────────────────────────────────────────────────────────────

/** A workspace project entry */
export interface WorkspaceProject {
  path: string;
  name: string;
  isFrameProject?: boolean;
  /** Optional per-project AI tool binding (tool ID, e.g. 'claude', 'gemini', 'codex') */
  aiTool?: string;
}

/** Shape returned by workspace data */
export interface WorkspaceData {
  projects: WorkspaceProject[];
  activeProject?: string;
  workspaceKey?: string;
  workspaceName?: string;
  defaultProjectPath?: string | null;
  settings?: Record<string, unknown>;
}

/** Live desktop session snapshot used to hydrate remote web clients. */
export interface WebSessionState {
  currentProjectPath: string | null;
  workspaceName: string;
  projects: WorkspaceProject[];
  session: {
    viewMode: 'tabs' | 'grid';
    activeTerminalId: string | null;
    terminalNames: Record<string, string>;
    terminalNameSources?: Record<string, 'default' | 'user' | 'session'>;
    gridLayout?: string;
    gridSlots?: (string | null)[];
    tabOrder?: string[];
    maximizedTerminalId?: string | null;
    terminalCwds?: Record<string, string>;
    terminalShells?: Record<string, string>;
    terminalSessionIds?: Record<string, string>;
  } | null;
  ui: {
    sidebarState: 'expanded' | 'collapsed' | 'hidden';
    sidebarWidth: number;
    activePanel:
      | 'tasks'
      | 'sessions'
      | 'plugins'
      | 'aiSessions'
      | 'gitChanges'
      | 'githubIssues'
      | 'githubPRs'
      | 'githubBranches'
      | 'githubWorktrees'
      | 'githubWorkflows'
      | 'githubNotifications'
      | 'history'
      | 'overview'
      | 'aiFiles'
      | 'subframeHealth'
      | 'agentState'
      | 'skills'
      | 'prompts'
      | 'pipeline'
      | 'system'
      | 'aiAnalysis'
      | null;
    rightPanelCollapsed: boolean;
    rightPanelWidth: number;
    settingsOpen: boolean;
    shortcutsHelpOpen: boolean;
    fullViewContent:
      | 'overview'
      | 'structureMap'
      | 'tasks'
      | 'stats'
      | 'decisions'
      | 'pipeline'
      | 'agentState'
      | 'shortcuts'
      | 'system'
      | null;
    openTabs: Array<{
      id: string;
      label: string;
      closable: boolean;
    }>;
  } | null;
  terminals: Array<{
    id: string;
    cwd: string;
    shell: string;
    claudeActive: boolean;
    sessionId: string | null;
    projectPath: string | null;
  }>;
}

export interface WebRemotePointerState {
  normalizedX: number;
  normalizedY: number;
  pointerType: 'mouse' | 'touch' | 'pen';
  phase: 'move' | 'down' | 'up' | 'leave';
  viewportWidth: number;
  viewportHeight: number;
  label: string;
  timestamp: number;
}

/** Session control state — cooperative control handoff between Electron and web client */
export interface SessionControlState {
  controller: 'electron' | 'web' | null;
  webClientConnected: boolean;
  webClientDevice: string | null;
  controlRequestPending: boolean;
  controlRequestFrom: 'electron' | 'web' | null;
  lastElectronActivity: number;
  lastWebActivity: number;
  idleTimeoutMs: number;
}

/** Session snapshot restore result */
export interface SessionRestoreStatus {
  restored: number;
  total: number;
  terminals: Array<{
    oldId: string;
    newId: string;
    cwd: string;
    projectPath: string | null;
    scrollbackReplayed: boolean;
    agentResumed: boolean;
  }>;
  reason: string | null;
}

/** Workspace list entry */
export interface WorkspaceListEntry {
  key: string;
  name: string;
  active: boolean;
  projectCount?: number;
  projectPaths?: string[];
  projects?: WorkspaceProject[];
  shortLabel?: string;
  icon?: string;
  accentColor?: string;
  defaultProjectPath?: string | null;
  inactive?: boolean;
}

/** Response from WORKSPACE_LIST handler */
export interface WorkspaceListResult {
  active: string;
  workspaces: Array<{
    key: string;
    name: string;
    projectCount: number;
    projectPaths: string[];
    projects?: WorkspaceProject[];
    shortLabel?: string;
    icon?: string;
    accentColor?: string;
    defaultProjectPath?: string | null;
    inactive?: boolean;
  }>;
}

/** File tree node */
export interface FileTreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileTreeNode[];
}

/** A single step in a task checklist (parsed from markdown checkboxes) */
export interface TaskStep {
  label: string;
  completed: boolean;
}

/** Task object */
export interface Task {
  id: string;
  title: string;
  description: string;
  userRequest?: string;
  acceptanceCriteria?: string;
  notes?: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'high' | 'medium' | 'low';
  category?: string;
  context?: string;
  blockedBy: string[];
  blocks: string[];
  steps: TaskStep[];
  private?: boolean;
  filePath?: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

/** Tasks data grouped by status */
export interface TasksPayload {
  projectPath: string;
  tasks: {
    pending: Task[];
    inProgress: Task[];
    completed: Task[];
  };
}

/** Plugin entry */
export interface Plugin {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  installed?: boolean;
  category?: string;
  path?: string;
}

/** Individual segment within a conversation chain (one per JSONL file / resume) */
export interface SessionSegment {
  sessionId: string;
  firstPrompt: string;
  messageCount: number;
  created: string;
  modified: string;
  state: 'active' | 'recent' | 'inactive';
  gitBranch: string;
}

/** Claude session entry (matches GroupedSession from claudeSessionsManager) */
export interface ClaudeSession {
  sessionId: string;
  customTitle: string;
  slug: string;
  gitBranch: string;
  isSidechain: boolean;
  firstPrompt: string;
  messageCount: number;
  segmentCount: number;
  modified: string;
  created: string;
  state: 'active' | 'recent' | 'inactive';
  /** SubFrame-managed friendly name (stored in .subframe-meta.json, not in Claude's JSONL) */
  friendlyName?: string;
  /** Individual segments, only included when segmentCount > 1 */
  segments?: SessionSegment[];
}

/** Live PTY-backed AI session summary */
export interface AISessionSummary {
  id: string;
  name: string;
  toolId: string;
  source: 'onboarding' | 'pipeline' | 'tasks' | 'plugin' | 'system';
  projectPath: string;
  terminalId: string;
  activityStreamId?: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  status: 'starting' | 'running' | 'completed' | 'failed' | 'cancelled';
  startCommand: string | null;
  error: string | null;
}

export interface AISessionsPayload {
  sessions: AISessionSummary[];
}

/** Git branch info (matches BranchInfo from gitBranchesManager) */
export interface GitBranch {
  name: string;
  commit: string;
  date: string;
  message: string;
  isRemote: boolean;
  isCurrent: boolean;
  /** Remote name (e.g. "origin", "upstream") or null for local branches */
  remote: string | null;
}

/** Git branches result wrapper */
export interface GitBranchesResult {
  error: string | null;
  currentBranch?: string;
  branches: GitBranch[];
}

/** Git worktree info (matches WorktreeInfo from gitBranchesManager) */
export interface GitWorktree {
  path: string;
  head?: string;
  branch?: string;
  bare?: boolean;
  detached?: boolean;
  isMain?: boolean;
}

/** Git worktrees result wrapper */
export interface GitWorktreesResult {
  error: string | null;
  worktrees: GitWorktree[];
}

/** Git operation result (branch switch, create, delete, worktree add/remove) */
export interface GitOperationResult {
  error: string | null;
  branch?: string;
  path?: string;
  message?: string;
  changes?: string[];
}

/** Git file status from `git status --porcelain` */
export interface GitFileStatus {
  path: string;
  index: string;
  working: string;
}

/** Git status result */
export interface GitStatusResult {
  error: string | null;
  branch: string;
  ahead: number;
  behind: number;
  files: GitFileStatus[];
  staged: number;
  modified: number;
  untracked: number;
}

/** Saved prompt for the prompt library */
export interface SavedPrompt {
  id: string;
  title: string;
  content: string;
  tags: string[];
  category: string;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
  /** Whether this prompt is global (user-level) or project-level. Defaults to 'project' for backward compat. */
  scope?: 'global' | 'project';
}

/** Result from loading prompts */
export interface PromptsResult {
  error: string | null;
  prompts: SavedPrompt[];
}

/** GitHub issue label */
export interface GitHubLabel {
  name: string;
  color?: string;
}

/** GitHub issue */
export interface GitHubIssue {
  number: number;
  title: string;
  state: string;
  url: string;
  labels: (string | GitHubLabel)[];
  createdAt: string;
  updatedAt?: string;
  author?: { login: string } | null;
}

/** GitHub issues result wrapper */
export interface GitHubIssuesResult {
  error: string | null;
  issues: GitHubIssue[];
  repoName?: string | null;
}

/** GitHub Actions workflow run */
export interface GitHubWorkflowRun {
  databaseId: number;
  displayTitle: string;
  status: string;       // 'completed' | 'in_progress' | 'queued' | 'waiting'
  conclusion: string | null;  // 'success' | 'failure' | 'cancelled' | 'skipped' | null
  event: string;        // 'push' | 'pull_request' | 'workflow_dispatch' | etc.
  headBranch: string;
  createdAt: string;
  updatedAt: string;
  url: string;
}

/** GitHub Actions workflow */
export interface GitHubWorkflow {
  id: number;
  name: string;
  path: string;
  state: string;       // 'active' | 'disabled_manually' | etc.
  runs: GitHubWorkflowRun[];
}

/** GitHub workflows result wrapper */
export interface GitHubWorkflowsResult {
  error: string | null;
  workflows: GitHubWorkflow[];
  repoName?: string | null;
}

/** GitHub comment */
export interface GitHubComment {
  id: number;
  author: { login: string } | null;
  body: string;
  createdAt: string;
}

/** Full GitHub issue detail (from gh issue view) */
export interface GitHubIssueDetail {
  number: number;
  title: string;
  state: string;
  body: string;
  url: string;
  assignees: { login: string }[];
  comments: GitHubComment[];
  labels: (string | GitHubLabel)[];
  author: { login: string } | null;
  createdAt: string;
  updatedAt: string;
  milestone?: { title: string } | null;
}

/** Full PR detail */
export interface GitHubPRDetail extends GitHubIssueDetail {
  headRefName: string;
  baseRefName: string;
  mergeable: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  reviewDecision?: string;
}

/** PR diff result */
export interface GitHubPRDiff {
  diff: string;
  files: { path: string; additions: number; deletions: number; status: string }[];
}

/** GitHub notification */
export interface GitHubNotification {
  id: string;
  subject: { title: string; url: string | null; type: string };
  reason: string;
  unread: boolean;
  updated_at: string;
  repository: { full_name: string; html_url: string };
}

/** Create issue payload */
export interface CreateGitHubIssuePayload {
  projectPath: string;
  title: string;
  body?: string;
  labels?: string[];
  assignees?: string[];
}

/** Create issue result */
export interface CreateGitHubIssueResult {
  error: string | null;
  issue?: GitHubIssue;
  url?: string;
}

/** Individual AI tool definition */
export interface AITool {
  id: string;
  name: string;
  command: string;
  fallbackCommand?: string;
  description: string;
  commands: Record<string, string>;
  menuLabel: string;
  supportsPlugins: boolean;
  /** URL to install/setup page */
  installUrl?: string;
  /** Whether the tool's command is available on PATH (checked at runtime) */
  installed?: boolean;
}

/** AI tool config response from GET_AI_TOOL_CONFIG */
export interface AIToolConfig {
  activeTool: AITool;
  availableTools: Record<string, AITool>;
}

/** Settings object */
export interface SettingsData {
  [key: string]: unknown;
}

/** Overview structure data (from STRUCTURE.json) */
export interface OverviewStructure {
  modules?: Record<string, { purpose?: string; exports?: string[] }>;
  groups?: Array<{ name: string; count: number; modules: Array<{ name: string; purpose: string; exports: string[] }> }>;
  totalModules: number;
  ipcChannels?: number;
  error?: string;
}

/** Overview tasks summary */
export interface OverviewTasks {
  tasks: unknown[];
  total: number;
  completed: number;
  pending: number;
  inProgress: number;
  progress?: number;
  error?: string;
}

/** Overview decisions summary */
export interface OverviewDecisions {
  decisions: Array<{ date: string; title: string }>;
  total: number;
  lastDecision?: { date: string; title: string } | null;
  error?: string;
}

/** Per-day commit activity with author breakdown */
export interface DayActivity {
  total: number;
  authors: Record<string, number>;
}

/** Overview stats */
export interface OverviewStats {
  linesOfCode: { total: number; byExtension: Record<string, number> } | number;
  fileCount: { total: number } | number;
  git: { lastCommit: string; commitCount: number; branch: string; activity?: Record<string, DayActivity> } | null;
  error?: string;
}

/** Recently modified source file */
export interface RecentFile {
  file: string;
  modified: string;
}

/** Overview data (matches OverviewResult from overviewManager) */
export interface OverviewData {
  error: string | null;
  projectPath?: string;
  projectName?: string;
  generatedAt?: string;
  structure?: OverviewStructure;
  tasks?: OverviewTasks;
  decisions?: OverviewDecisions;
  stats?: OverviewStats;
  recentFiles?: RecentFile[];
}

/** AI file status for a single native file */
export interface NativeFileStatus {
  exists: boolean;
  isSymlink: boolean;
  hasBacklink: boolean;
  hasUserContent: boolean;
}

/** Claude settings directory status */
export interface ClaudeSettingsStatus {
  exists: boolean;
  hasConfig: boolean;
  hasMemory: boolean;
  hasProjects: boolean;
}

/** AI files status result */
export interface AIFilesStatus {
  agents: { exists: boolean };
  claude: NativeFileStatus;
  gemini: NativeFileStatus;
  codexWrapper: { exists: boolean };
  claudeSettings: ClaudeSettingsStatus;
  claudeNative?: unknown;
}

/** Backlink verification result */
export interface BacklinkVerificationResult {
  agents: { exists: boolean };
  claude: { exists: boolean; isSymlink: boolean; hasBacklink: boolean; backlinkValid: boolean; backlinkTarget: string | null };
  gemini: { exists: boolean; isSymlink: boolean; hasBacklink: boolean; backlinkValid: boolean; backlinkTarget: string | null };
  issues: Array<{ file: string; issue: string; severity: string; suggestion: string }>;
}

/** Backlink config */
export interface BacklinkConfig {
  customMessage: string;
  additionalRefs: string[];
}

/** SubFrame component health status (per-component) */
export interface SubFrameComponentStatus {
  id: string;
  label: string;
  category: 'core' | 'hooks' | 'claude-integration' | 'git' | 'skills' | 'pipeline';
  exists: boolean;
  current: boolean;
  needsUpdate: boolean;
  path: string;
  /** Version extracted from @subframe-version header (if present) */
  deployedVersion?: string;
  /** True if the file has @subframe-managed: false (user opted out of updates) */
  managedOptOut?: boolean;
  /** For claude-settings: which expected hook event types are missing */
  missingHooks?: string[];
}

/** SubFrame health status (aggregate) */
export interface SubFrameHealthStatus {
  components: SubFrameComponentStatus[];
  healthy: number;
  total: number;
  needsUpdate: number;
  missing: number;
  claudeSettingsMerged: boolean;
  gitHooksPath: string | null;
}

/** Options for uninstalling SubFrame from a project */
export interface UninstallOptions {
  removeClaudeHooks: boolean;
  removeGitHooks: boolean;
  removeBacklinks: boolean;
  removeAgentsMd: boolean;
  removeClaudeSkills: boolean;
  removeSubframeDir: boolean;
  dryRun: boolean;
}

/** Result of an uninstall operation */
export interface UninstallResult {
  success: boolean;
  removed: string[];
  preserved: string[];
  errors: string[];
  dryRun: boolean;
}

/** Skill info (from skillsManager) */
export interface SkillInfo {
  id: string;
  name: string;
  command: string;
  description: string;
  argumentHint: string;
  disableModelInvocation: boolean;
  allowedTools: string[];
  content: string;
  isManaged: boolean;
  healthStatus?: 'healthy' | 'outdated' | 'missing';
}

/** Usage window with utilization percentage and reset time */
export interface UsageWindow {
  utilization: number;  // 0–100 (already a percentage)
  resetsAt: string | null;
}

/** Extra usage credits info (Max/Team plan) */
export interface ExtraUsageInfo {
  isEnabled: boolean;
  monthlyLimit: number | null;
  usedCredits: number | null;
  utilization: number | null;
}

/** Which data source provided usage data */
export type UsageSource = 'local-cache' | 'api' | 'cached' | 'credentials-only' | 'none';

/** Claude usage data (from claudeUsageManager — hybrid 4-layer approach) */
export interface ClaudeUsageData {
  // Primary usage windows
  fiveHour: UsageWindow | null;
  sevenDay: UsageWindow | null;
  // Per-model breakdowns
  sevenDaySonnet: UsageWindow | null;
  sevenDayOpus: UsageWindow | null;
  // Extra usage credits (Max plan)
  extraUsage: ExtraUsageInfo | null;
  // Data source transparency
  source: UsageSource;
  /** How old the local cache was when read (null if API or no cache) */
  cacheAgeSeconds: number | null;
  // Account metadata (from credentials file — always available)
  subscriptionType: string | null;
  rateLimitTier: string | null;
  // Metadata
  lastUpdated: string;
  error: string | null;
  /** Set after consecutive polling failures — suggests user disable polling */
  persistentFailure?: boolean;
}

/** Shell info */
export interface ShellInfo {
  id: string;
  name: string;
  path: string;
  isDefault?: boolean;
}

/** Frame config */
export interface FrameConfig {
  version: string;
  name: string;
  description: string;
  createdAt: string;
  initializedBy: string;
  settings: Record<string, unknown>;
  backlink: BacklinkConfig;
  files: Record<string, string>;
}

// ─── Onboarding Types ────────────────────────────────────────────────────────

/** A detected intelligence file in the project */
export interface DetectedIntelligence {
  category: 'ai-config' | 'project-metadata' | 'documentation' | 'dev-config';
  path: string;
  label: string;
  hasContent: boolean;
  size: number;
}

/** Result of project intelligence detection */
export interface OnboardingDetectionResult {
  projectPath: string;
  projectName: string;
  detected: DetectedIntelligence[];
  hasGit: boolean;
  sourceFileCount: number;
  primaryLanguage: string;
  worthAnalyzing: boolean;
}

/** Parsed analysis result from AI provider */
export interface OnboardingAnalysisResult {
  structure: {
    description?: string;
    architecture?: string;
    conventions?: string[];
    dataFlow?: string;
    modules?: Record<string, { purpose?: string; exports?: string[] }>;
  };
  projectNotes: {
    vision?: string;
    decisions?: Array<{ date: string; title: string; detail: string }>;
    techStack?: string[];
  };
  suggestedTasks: Array<{
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    category: string;
  }>;
}

/** Progress event during onboarding analysis */
export interface OnboardingProgressEvent {
  projectPath: string;
  phase: 'detecting' | 'gathering' | 'analyzing' | 'parsing' | 'importing' | 'imported' | 'done' | 'error' | 'cancelled';
  message: string;
  progress: number;
  /** Set once the analysis terminal is created, so the renderer can focus it immediately */
  terminalId?: string;
  /** Activity stream backing this onboarding analysis */
  activityStreamId?: string;
  /** Total timeout for the analysis (ms) */
  timeoutMs?: number;
  /** Time elapsed since analysis started (ms) */
  elapsedMs?: number;
  /** True if no output received for 30+ seconds */
  stalled?: boolean;
  /** How long the stall has lasted (ms) */
  stallDurationMs?: number;
}

/** Durable onboarding session state for a single project. */
export interface OnboardingSessionState {
  projectPath: string;
  detection: OnboardingDetectionResult | null;
  analysisResult: OnboardingAnalysisResult | null;
  progress: OnboardingProgressEvent | null;
  terminalId: string | null;
  activityStreamId: string | null;
  error: string | null;
  cancelled: string | null;
  importResult: OnboardingImportResult | null;
  status: 'idle' | 'detecting' | 'gathering' | 'analyzing' | 'parsing' | 'importing' | 'imported' | 'done' | 'error' | 'cancelled';
  updatedAt: string;
}

/** Result of importing onboarding analysis */
export interface OnboardingImportResult {
  imported: string[];
  skipped: string[];
  errors: string[];
}

/** Selection options for what to import */
export interface OnboardingImportSelections {
  structure: boolean;
  projectNotes: boolean;
  taskIds: number[];
}

/** Options for customizing the AI analysis */
export interface OnboardingAnalysisOptions {
  /** Optional per-run AI tool override (defaults to the globally active tool) */
  toolId?: string;
  /** Additional user-provided instructions appended to the prompt */
  customContext?: string;
  /** Extra file/directory paths to include in the context (absolute paths) */
  extraFiles?: string[];
  /** Custom timeout in ms (used for "retry with longer timeout") */
  timeoutOverride?: number;
}

// ─── Updater Types ───────────────────────────────────────────────────────────

/** Result of checking for updates */
export interface UpdateCheckResult {
  updateAvailable: boolean;
  version?: string;
  releaseNotes?: string;
}

/** Updater status pushed from main → renderer */
export interface UpdaterStatus {
  status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
  version?: string;
  error?: string;
  /** True when triggered by user action (menu / settings "Check Now") */
  manual?: boolean;
}

/** Download progress info */
export interface UpdaterProgress {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

// ─── Graceful Shutdown Types ─────────────────────────────────────────────

/** Per-terminal status during graceful shutdown */
export interface GracefulShutdownTerminalInfo {
  terminalId: string;
  claudeActive: boolean;
  label: string;
  status: 'waiting' | 'exiting' | 'exited' | 'timeout' | 'killed';
}

/** Sent from main → renderer to open the graceful shutdown dialog */
export interface GracefulShutdownRequest {
  reason: 'close' | 'update' | 'close-confirm';
  terminals: GracefulShutdownTerminalInfo[];
  pipelineRunning: boolean;
  analysisRunning: boolean;
  activeStreams: boolean;
}

/** Per-terminal status update during shutdown */
export interface GracefulShutdownStatusEvent {
  terminalId: string;
  status: 'exiting' | 'exited' | 'timeout' | 'killed';
}

/** Sent when graceful shutdown is complete */
export interface GracefulShutdownCompleteEvent {
  reason: 'close' | 'update';
  success: boolean;
}

// ─── Pipeline Types ──────────────────────────────────────────────────────────

export type PipelineTrigger = 'manual' | 'pre-push' | 'skill';
export type PipelineRunStatus = 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
export type StageType = 'lint' | 'test' | 'describe' | 'critique' | 'freeze' | 'push' | 'create-pr' | 'custom';
export type StageStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
export type ArtifactSeverity = 'error' | 'warning' | 'info' | 'suggestion';

export interface ContentArtifact {
  id: string;
  type: 'content';
  stageId: string;
  title: string;
  body: string;
  createdAt: string;
}

export interface CommentArtifact {
  id: string;
  type: 'comment';
  stageId: string;
  file: string;
  line: number;
  endLine?: number;
  message: string;
  severity: ArtifactSeverity;
  category?: string;
  createdAt: string;
}

export interface PatchArtifact {
  id: string;
  type: 'patch';
  stageId: string;
  title: string;
  explanation: string;
  diff: string;
  files: string[];
  applied: boolean;
  createdAt: string;
}

export type PipelineArtifact = ContentArtifact | CommentArtifact | PatchArtifact;

export type StageFailureReason = 'max-turns' | 'timeout' | 'error' | null;

export interface PipelineStage {
  id: string;
  name: string;
  type: StageType;
  status: StageStatus;
  requireApproval: boolean | 'if_patches';
  continueOnError: boolean;
  frozen: boolean;
  artifacts: string[];
  logs: string[];
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  /** Why the stage failed — enables targeted retry UI (e.g. "Re-run unlimited") */
  failureReason: StageFailureReason;
}

export interface PipelineJob {
  id: string;
  name: string;
  needs: string[];
  stages: PipelineStage[];
  status: StageStatus;
  startedAt: string | null;
  completedAt: string | null;
}

export interface PipelineRun {
  id: string;
  projectPath: string;
  workflowId: string;
  trigger: PipelineTrigger;
  status: PipelineRunStatus;
  branch: string;
  baseSha: string;
  headSha: string;
  jobs: PipelineJob[];
  artifacts: PipelineArtifact[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  /** Runtime overrides applied to all AI stage stepConfig (e.g. { 'max-turns': '0' }) */
  overrides?: Record<string, string>;
}

export interface WorkflowStep {
  name: string;
  uses?: string;
  run?: string;
  'require-approval'?: boolean | 'if_patches';
  'continue-on-error'?: boolean;
  timeout?: number;
  env?: Record<string, string>;
  /** Per-step configuration passed to stage handlers (scope, mode, focus, prompt, etc.) */
  with?: Record<string, string>;
}

export interface WorkflowJob {
  name?: string;
  needs?: string[];
  steps: WorkflowStep[];
}

export interface WorkflowDefinition {
  name: string;
  /** Human-readable description shown in the pipeline selector */
  description?: string;
  /** On-disk filename (e.g. "health-check.yml"). Set by listWorkflows. */
  filename?: string;
  on: {
    push?: { branches?: string[]; 'branches-ignore'?: string[] };
    manual?: boolean;
  };
  jobs: Record<string, WorkflowJob>;
}

export interface PipelineRunsPayload {
  projectPath: string;
  runs: PipelineRun[];
}

export interface PipelineProgressEvent {
  runId: string;
  stageId: string;
  log: string;
  /** Optional metadata for enhanced progress display */
  meta?: {
    isHeartbeat?: boolean;
    elapsedMs?: number;
    turnCount?: number;
  };
}

// ─── Handle Map (ipcMain.handle → ipcRenderer.invoke) ───────────────────────

/** Maps invoke channels to their argument tuple and return type */
export interface IPCHandleMap {
  // Workspace (handle)
  [IPC.SCAN_PROJECT_DIR]: { args: [dirPath: string]; return: WorkspaceProject[] };
  [IPC.WORKSPACE_LIST]: { args: []; return: WorkspaceListResult };
  [IPC.WORKSPACE_SWITCH]: { args: [key: string]; return: { projects: WorkspaceProject[]; workspaceName: string; workspaceKey: string; defaultProjectPath?: string | null } | null };
  [IPC.WORKSPACE_CREATE]: { args: [name: string]; return: unknown };
  [IPC.WORKSPACE_DUPLICATE]: { args: [key: string]; return: WorkspaceListResult | null };
  [IPC.WORKSPACE_RENAME]: {
    args: [payload: { key: string; newName?: string; shortLabel?: string | null; icon?: string | null; accentColor?: string | null; defaultProjectPath?: string | null }];
    return: unknown;
  };
  [IPC.WORKSPACE_DELETE]: { args: [key: string]; return: unknown };
  [IPC.WORKSPACE_REORDER]: { args: [orderedKeys: string[]]; return: boolean };
  [IPC.WORKSPACE_SET_INACTIVE]: { args: [payload: { key: string; inactive: boolean }]; return: boolean };

  // API Server
  [IPC.API_SERVER_INFO]: { args: []; return: { enabled: boolean; dtspEnabled: boolean; port: number; token: string; connectedClients: number; totalRequests: number; ttsMessageCount: number; lastTtsMessage: { text: string; voice: string; timestamp: string } | null } };
  [IPC.API_SERVER_TOGGLE]: { args: [enabled: boolean]; return: { enabled: boolean; port: number; token: string } };
  [IPC.API_SERVER_REGEN_TOKEN]: { args: []; return: { token: string } };
  [IPC.DETECT_AI_FEATURES]: { args: [projectPath: string]; return: { hooks: boolean; mcpServers: boolean; skills: boolean; hookCount: number; mcpServerCount: number } };
  [IPC.SELECT_DEFAULT_PROJECT_DIR]: { args: []; return: string | null };
  [IPC.SELECT_FOLDER]: { args: []; return: { path: string } | null };
  [IPC.CREATE_FOLDER]: { args: [payload: { parentPath: string; folderName: string }]; return: { path: string } };

  // Web Server
  [IPC.WEB_SERVER_INFO]: {
    args: [];
    return: {
      enabled: boolean;
      startOnLaunch: boolean;
      port: number;
      token: string;
      configuredPort: number;
      lanMode: boolean;
      lanIp: string | null;
      lanIps: string[];
      clientConnected: boolean;
      clientInfo: { userAgent: string; connectedAt: string } | null;
      sessionContext: { workspaceName: string; projectPath: string | null; projectName: string | null } | null;
      lastStartError: string | null;
    };
  };
  [IPC.WEB_SESSION_STATE]: {
    args: [];
    return: WebSessionState;
  };
  [IPC.SESSION_CONTROL_STATE]: {
    args: [];
    return: SessionControlState;
  };
  [IPC.WEB_SERVER_TOGGLE]: {
    args: [enable: boolean];
    return: { enabled: boolean; port: number; token: string };
  };
  [IPC.WEB_SERVER_REGEN_TOKEN]: {
    args: [];
    return: { token: string };
  };
  [IPC.WEB_SERVER_GENERATE_PAIRING]: {
    args: [];
    return: { code: string; expiresIn: number };
  };
  [IPC.WEB_SERVER_GET_SSH_COMMAND]: {
    args: [];
    return: { command: string; sshAvailable: boolean };
  };

  // GitHub
  [IPC.LOAD_GITHUB_ISSUES]: { args: [payload: { projectPath: string; state?: string }]; return: GitHubIssuesResult };
  [IPC.LOAD_GITHUB_PRS]: { args: [payload: { projectPath: string; state?: string }]; return: GitHubIssuesResult };
  [IPC.LOAD_GITHUB_WORKFLOWS]: { args: [projectPath: string]; return: GitHubWorkflowsResult };
  [IPC.VIEW_GITHUB_ISSUE]: { args: [payload: { projectPath: string; issueNumber: number }]; return: { error: string | null; issue: GitHubIssueDetail | null } };
  [IPC.VIEW_GITHUB_PR]: { args: [payload: { projectPath: string; prNumber: number }]; return: { error: string | null; pr: GitHubPRDetail | null } };
  [IPC.CREATE_GITHUB_ISSUE]: { args: [payload: CreateGitHubIssuePayload]; return: CreateGitHubIssueResult };
  [IPC.LOAD_GITHUB_PR_DIFF]: { args: [payload: { projectPath: string; prNumber: number }]; return: { error: string | null; diff: GitHubPRDiff | null } };
  [IPC.RERUN_GITHUB_WORKFLOW]: { args: [payload: { projectPath: string; runId: number }]; return: { error: string | null; success: boolean } };
  [IPC.DISPATCH_GITHUB_WORKFLOW]: { args: [payload: { projectPath: string; workflowId: string; ref?: string }]; return: { error: string | null; success: boolean } };
  [IPC.LOAD_GITHUB_NOTIFICATIONS]: { args: []; return: { error: string | null; notifications: GitHubNotification[] } };
  [IPC.MARK_GITHUB_NOTIFICATION_READ]: { args: [payload: { threadId: string }]; return: { error: string | null; success: boolean } };

  // Git Branches
  [IPC.LOAD_GIT_BRANCHES]: { args: [projectPath: string]; return: GitBranchesResult };
  [IPC.SWITCH_GIT_BRANCH]: { args: [payload: { projectPath: string; branchName: string }]; return: GitOperationResult };
  [IPC.CREATE_GIT_BRANCH]: { args: [payload: { projectPath: string; branchName: string; checkout?: boolean; baseBranch?: string }]; return: GitOperationResult };
  [IPC.DELETE_GIT_BRANCH]: { args: [payload: { projectPath: string; branchName: string; force?: boolean }]; return: GitOperationResult };
  [IPC.LOAD_GIT_WORKTREES]: { args: [projectPath: string]; return: GitWorktreesResult };
  [IPC.ADD_GIT_WORKTREE]: { args: [payload: { projectPath: string; worktreePath: string; branchName: string; createBranch?: boolean }]; return: GitOperationResult };
  [IPC.REMOVE_GIT_WORKTREE]: { args: [payload: { projectPath: string; worktreePath: string; force?: boolean }]; return: GitOperationResult };
  [IPC.LOAD_GIT_STATUS]: { args: [projectPath: string]; return: GitStatusResult };

  // Plugins
  [IPC.LOAD_PLUGINS]: { args: []; return: Plugin[] };
  [IPC.TOGGLE_PLUGIN]: { args: [pluginId: string]; return: { success: boolean; plugin?: Plugin; error?: string } };
  [IPC.REFRESH_PLUGINS]: { args: []; return: Plugin[] };

  // Settings
  [IPC.LOAD_SETTINGS]: { args: []; return: SettingsData };
  [IPC.UPDATE_SETTING]: { args: [payload: { key: string; value: unknown }]; return: { success: boolean; settings: SettingsData } };

  // Overview
  [IPC.LOAD_OVERVIEW]: { args: [projectPath: string]; return: OverviewData };
  [IPC.GET_FILE_GIT_HISTORY]: { args: [projectPath: string, filePath: string]; return: unknown };

  // AI Tool
  [IPC.GET_AI_TOOL_CONFIG]: { args: []; return: AIToolConfig };
  [IPC.SET_AI_TOOL]: { args: [toolId: string]; return: boolean };
  [IPC.ADD_CUSTOM_AI_TOOL]: { args: [tool: { id: string; name: string; command: string; description?: string }]; return: boolean };
  [IPC.REMOVE_CUSTOM_AI_TOOL]: { args: [toolId: string]; return: boolean };
  [IPC.RECHECK_AI_TOOLS]: { args: []; return: AIToolConfig };

  // Claude Sessions
  [IPC.LOAD_CLAUDE_SESSIONS]: { args: [projectPath: string]; return: ClaudeSession[] };
  [IPC.REFRESH_CLAUDE_SESSIONS]: { args: [projectPath: string]; return: ClaudeSession[] };
  [IPC.CHECK_ACTIVE_CLAUDE_SESSION]: { args: [projectPath: string]; return: boolean };
  [IPC.RENAME_CLAUDE_SESSION]: { args: [payload: { projectPath: string; sessionId: string; name: string }]; return: boolean };
  [IPC.DELETE_CLAUDE_SESSION]: { args: [payload: { projectPath: string; sessionId: string; slug: string }]; return: boolean };
  [IPC.DELETE_ALL_CLAUDE_SESSIONS]: { args: [projectPath: string]; return: { deleted: number } };
  [IPC.LIST_AI_SESSIONS]: { args: [projectPath: string | null]; return: AISessionsPayload };

  // Terminal Agent Status
  [IPC.IS_TERMINAL_CLAUDE_ACTIVE]: { args: [terminalId: string]; return: boolean };

  // Pop-Out Terminal
  [IPC.TERMINAL_POPOUT]: { args: [terminalId: string]; return: { success: boolean } };
  [IPC.TERMINAL_DOCK]: { args: [terminalId: string]; return: { success: boolean } };

  // Pop-Out Editor
  [IPC.EDITOR_POPOUT]: { args: [filePath: string]; return: { success: boolean } };
  [IPC.EDITOR_DOCK]: { args: [filePath: string]; return: { success: boolean } };

  // Terminal Session Name
  [IPC.GET_TERMINAL_SESSION_NAME]: { args: [payload: { terminalId: string; sessionId?: string }]; return: { name: string | null } };

  // Terminal State (cwd, shell, session per terminal)
  [IPC.GET_TERMINAL_STATE]: { args: []; return: { terminals: Array<{ id: string; cwd: string; shell: string; claudeActive: boolean; sessionId: string | null; projectPath: string | null }> } };
  [IPC.GET_TERMINAL_BACKLOG]: { args: [payload: { terminalId: string }]; return: { data: string } };
  [IPC.SAVE_TERMINAL_SCROLLBACK]: { args: [payload: { projectPath: string; terminalId: string; lines: string[] }]; return: { success: boolean } };
  [IPC.LOAD_TERMINAL_SCROLLBACK]: { args: [payload: { projectPath: string; terminalId: string }]; return: { lines: string[] } };

  // Terminal Stall Recovery
  [IPC.TERMINAL_STALL_RECOVER]: { args: [payload: { terminalId: string; action: 'sigwinch' | 'ctrl-c' | 'sigcont' }]; return: { success: boolean } };

  // Terminal Shell Restart
  [IPC.TERMINAL_RESTART]: { args: [terminalId: string]; return: { success: boolean; error?: string } };

  // Skills
  [IPC.LOAD_SKILLS]: { args: [projectPath: string]; return: SkillInfo[] };

  // Onboarding
  [IPC.DETECT_PROJECT_INTELLIGENCE]: { args: [projectPath: string]; return: OnboardingDetectionResult };
  [IPC.RUN_ONBOARDING_ANALYSIS]: {
    args: [projectPath: string, options?: OnboardingAnalysisOptions];
    return: { terminalId: string; activityStreamId: string };
  };
  [IPC.GET_ONBOARDING_SESSION]: { args: [projectPath: string]; return: OnboardingSessionState | null };
  [IPC.CLEAR_ONBOARDING_SESSION]: { args: [projectPath: string]; return: { success: boolean } };
  [IPC.GET_ONBOARDING_PROMPT_PREVIEW]: { args: [projectPath: string, options?: OnboardingAnalysisOptions]; return: { prompt: string; contextSize: number } };
  [IPC.BROWSE_ONBOARDING_FILES]: { args: [projectPath: string, type: 'file' | 'directory']; return: string[] };
  [IPC.IMPORT_ONBOARDING_RESULTS]: { args: [payload: { projectPath: string; results: OnboardingAnalysisResult; selections: OnboardingImportSelections }]; return: OnboardingImportResult };

  // Prompt Library
  [IPC.LOAD_PROMPTS]: { args: [projectPath: string]; return: PromptsResult };
  [IPC.SAVE_PROMPT]: { args: [payload: { projectPath: string; prompt: SavedPrompt }]; return: PromptsResult };
  [IPC.DELETE_PROMPT]: { args: [payload: { projectPath: string; promptId: string }]; return: PromptsResult };

  // Global Prompt Library
  [IPC.LOAD_GLOBAL_PROMPTS]: { args: []; return: PromptsResult };
  [IPC.SAVE_GLOBAL_PROMPT]: { args: [prompt: SavedPrompt]; return: PromptsResult };
  [IPC.DELETE_GLOBAL_PROMPT]: { args: [promptId: string]; return: PromptsResult };

  // What's New
  [IPC.GET_RELEASE_NOTES]: { args: []; return: { version: string; content: string } };

  // Auto-Updater
  [IPC.UPDATER_CHECK]: { args: []; return: UpdateCheckResult };
  [IPC.UPDATER_DOWNLOAD]: { args: []; return: void };
  [IPC.UPDATER_INSTALL]: { args: []; return: void };

  // Renderer Hot Reload
  [IPC.RENDERER_HOT_RELOAD]: { args: []; return: { success: boolean } };
  [IPC.TERMINAL_RESYNC]: {
    args: [];
    return: {
      terminals: Array<{
        terminalId: string;
        cwd: string;
        shell: string;
        projectPath: string | null;
        claudeActive: boolean;
        cols: number;
        rows: number;
        sessionId: string | null;
        backlog: string;
      }>;
    };
  };

  // Pipeline
  [IPC.PIPELINE_LIST_WORKFLOWS]: { args: [projectPath: string]; return: WorkflowDefinition[] };
  [IPC.PIPELINE_START]: { args: [payload: { projectPath: string; workflowId: string; trigger: PipelineTrigger; overrides?: Record<string, string> }]; return: { runId: string } };
  [IPC.PIPELINE_CANCEL]: { args: [runId: string]; return: { success: boolean } };
  [IPC.PIPELINE_APPROVE_STAGE]: { args: [payload: { runId: string; stageId: string }]; return: { success: boolean } };
  [IPC.PIPELINE_REJECT_STAGE]: { args: [payload: { runId: string; stageId: string }]; return: { success: boolean } };
  [IPC.PIPELINE_APPLY_PATCH]: { args: [payload: { runId: string; patchId: string }]; return: { success: boolean; error?: string } };
  [IPC.PIPELINE_DELETE_RUN]: { args: [payload: { runId: string; projectPath: string }]; return: { success: boolean } };
  [IPC.PIPELINE_SAVE_WORKFLOW]: {
    args: [payload: { projectPath: string; filename: string; content: string }];
    return: { success: boolean; error?: string };
  };
  [IPC.PIPELINE_DELETE_WORKFLOW]: {
    args: [payload: { projectPath: string; filename: string }];
    return: { success: boolean; error?: string };
  };

  // AI Analysis Panel
  [IPC.RUN_AI_ANALYSIS]: {
    args: [payload: { projectPath: string; prompt: string; terminalId?: string }];
    return: { terminalId: string; reused: boolean };
  };

  // Task AI Enhance
  [IPC.ENHANCE_TASK]: {
    args: [payload: { projectPath: string; task: Partial<Task> }];
    return: { started: boolean; activityStreamId: string; error?: string };
  };

  // Activity Streams
  [IPC.ACTIVITY_LIST]: {
    args: [];
    return: ActivityListPayload;
  };
  [IPC.ACTIVITY_CANCEL]: {
    args: [streamId: string];
    return: { success: boolean };
  };

  // Output Channels
  [IPC.OUTPUT_CHANNEL_LIST]: { args: []; return: OutputChannelListPayload };
  [IPC.OUTPUT_CHANNEL_LOG]: { args: [channelId: string]; return: OutputChannelLogPayload };
  [IPC.OUTPUT_CHANNEL_CLEAR]: { args: [channelId: string]; return: { success: boolean } };

  // Graceful Shutdown
  [IPC.GRACEFUL_SHUTDOWN_CONFIRM]: { args: []; return: void };
  [IPC.GRACEFUL_SHUTDOWN_CANCEL]: { args: []; return: void };
  [IPC.GRACEFUL_SHUTDOWN_FORCE]: { args: []; return: void };

  // CLI Install/Uninstall
  [IPC.INSTALL_CLI]: {
    args: [];
    return: { success: boolean; path?: string; message: string };
  };
  [IPC.UNINSTALL_CLI]: {
    args: [];
    return: { success: boolean; message: string };
  };
  [IPC.CHECK_CLI_STATUS]: {
    args: [];
    return: { installed: boolean; inPath: boolean; path: string | null };
  };

  // Windows Context Menu
  [IPC.INSTALL_CONTEXT_MENU]: {
    args: [];
    return: { success: boolean; message: string };
  };
  [IPC.UNINSTALL_CONTEXT_MENU]: {
    args: [];
    return: { success: boolean; message: string };
  };
  [IPC.CHECK_CONTEXT_MENU]: {
    args: [];
    return: { installed: boolean };
  };

  // Claude Configuration
  [IPC.GET_CLAUDE_CONFIG_STATUS]: {
    args: [projectPath: string | null];
    return: {
      global: {
        claudeMd: { exists: boolean; path: string };
        settings: { exists: boolean; path: string };
      };
      project: {
        claudeMd: { exists: boolean; path: string };
        settings: { exists: boolean; path: string };
        privateMd: { exists: boolean; path: string };
      } | null;
    };
  };

  // Session Snapshot
  [IPC.SESSION_SNAPSHOT_SAVE]: {
    args: [];
    return: { success: boolean; terminalCount: number };
  };
  [IPC.SESSION_SNAPSHOT_RESTORE]: {
    args: [];
    return: SessionRestoreStatus;
  };

  // Dev tools
  [IPC.DEV_SYNC_FROM_PRODUCTION]: {
    args: [];
    return: { success: boolean; copied: string[]; message: string };
  };
}

// ─── Send Map (ipcRenderer.send → ipcMain.on) ───────────────────────────────

/** Maps send channels to their payload type */
export interface IPCSendMap {
  // Terminal (legacy single)
  [IPC.START_TERMINAL]: void;
  [IPC.RESTART_TERMINAL]: string; // projectPath
  [IPC.TERMINAL_INPUT]: string; // data
  [IPC.TERMINAL_RESIZE]: { cols: number; rows: number };

  // Project dialogs
  [IPC.SELECT_PROJECT_FOLDER]: void;
  [IPC.CREATE_NEW_PROJECT]: void;

  // File Tree
  [IPC.LOAD_FILE_TREE]: { path: string; showDotfiles?: boolean };

  // History
  [IPC.LOAD_PROMPT_HISTORY]: void;

  // Workspace (send-based)
  [IPC.LOAD_WORKSPACE]: void;
  [IPC.ADD_PROJECT_TO_WORKSPACE]: { projectPath: string; name: string; isFrameProject?: boolean };
  [IPC.REMOVE_PROJECT_FROM_WORKSPACE]: string; // projectPath
  [IPC.RENAME_PROJECT]: { projectPath: string; newName: string };
  [IPC.SET_PROJECT_AI_TOOL]: { projectPath: string; aiTool: string | null };
  [IPC.WEB_SESSION_SYNC]: {
    origin: 'electron' | 'web';
    currentProjectPath: string | null;
    session?: WebSessionState['session'];
    ui?: WebSessionState['ui'];
  };
  [IPC.WEB_REMOTE_POINTER_SYNC]: {
    normalizedX: number;
    normalizedY: number;
    pointerType: 'mouse' | 'touch' | 'pen';
    phase: 'move' | 'down' | 'up' | 'leave';
    viewportWidth: number;
    viewportHeight: number;
    timestamp: number;
  };

  // Multi-Terminal
  [IPC.TERMINAL_CREATE]: { projectPath?: string; shell?: string; cwd?: string };
  [IPC.TERMINAL_DESTROY]: string; // terminalId
  [IPC.TERMINAL_INPUT_ID]: { terminalId: string; data: string };
  [IPC.TERMINAL_RESIZE_ID]: { terminalId: string; cols: number; rows: number };
  [IPC.GET_AVAILABLE_SHELLS]: void;

  // Tasks
  [IPC.LOAD_TASKS]: string; // projectPath
  [IPC.WATCH_TASKS]: string; // projectPath
  [IPC.UNWATCH_TASKS]: void;
  [IPC.ADD_TASK]: { projectPath: string; task: Partial<Task> };
  [IPC.UPDATE_TASK]: { projectPath: string; taskId: string; updates: Partial<Task> };
  [IPC.DELETE_TASK]: { projectPath: string; taskId: string };

  // Frame Project
  [IPC.CHECK_IS_FRAME_PROJECT]: string; // projectPath
  [IPC.INITIALIZE_FRAME_PROJECT]: { projectPath: string; projectName?: string; confirmed?: boolean };
  [IPC.GET_FRAME_CONFIG]: string; // projectPath

  // File Editor
  [IPC.READ_FILE]: string; // filePath
  [IPC.WRITE_FILE]: { filePath: string; content: string };
  [IPC.READ_FILE_IMAGE]: string; // filePath

  // Claude Usage
  [IPC.LOAD_CLAUDE_USAGE]: void;
  [IPC.REFRESH_CLAUDE_USAGE]: void;

  // GitHub
  [IPC.OPEN_GITHUB_ISSUE]: string; // url

  // Git Branches panel toggle
  [IPC.TOGGLE_GIT_BRANCHES_PANEL]: void;

  // Git Auto-fetch
  [IPC.GIT_START_AUTO_FETCH]: { projectPath: string; intervalMs: number };
  [IPC.GIT_STOP_AUTO_FETCH]: void;

  // AI Files
  [IPC.GET_AI_FILES_STATUS]: string; // projectPath
  [IPC.INJECT_BACKLINK]: { projectPath: string; filename: string };
  [IPC.REMOVE_BACKLINK]: { projectPath: string; filename: string };
  [IPC.CREATE_NATIVE_FILE]: { projectPath: string; filename: string };
  [IPC.MIGRATE_SYMLINK]: { projectPath: string; filename: string };
  [IPC.VERIFY_BACKLINKS]: string; // projectPath

  // Backlink Config
  [IPC.GET_BACKLINK_CONFIG]: string; // projectPath
  [IPC.SAVE_BACKLINK_CONFIG]: { projectPath: string; backlinkConfig: BacklinkConfig };
  [IPC.UPDATE_ALL_BACKLINKS]: string; // projectPath

  // SubFrame Health
  [IPC.GET_SUBFRAME_HEALTH]: string; // projectPath
  [IPC.UPDATE_SUBFRAME_COMPONENTS]: { projectPath: string; componentIds: string[] };
  [IPC.UNINSTALL_SUBFRAME]: { projectPath: string; options: UninstallOptions };

  // Agent State
  [IPC.LOAD_AGENT_STATE]: string; // projectPath
  [IPC.WATCH_AGENT_STATE]: string; // projectPath
  [IPC.UNWATCH_AGENT_STATE]: void;

  // Onboarding
  [IPC.CANCEL_ONBOARDING_ANALYSIS]: string; // projectPath

  // Pipeline
  [IPC.PIPELINE_LIST_RUNS]: { projectPath: string };
  [IPC.PIPELINE_GET_RUN]: { runId: string };
  [IPC.WATCH_PIPELINE]: string; // projectPath
  [IPC.UNWATCH_PIPELINE]: void;

  // Activity Streams
  [IPC.ACTIVITY_CLEAR]: string; // streamId

  // Session Control
  [IPC.SESSION_CONTROL_REQUEST]: void;
  [IPC.SESSION_CONTROL_GRANT]: void;
  [IPC.SESSION_CONTROL_TAKE]: void;
  [IPC.SESSION_CONTROL_RELEASE]: void;

  // API Server bridge (renderer → main responses)
  [IPC.API_SELECTION_SYNC]: { terminalId: string; text: string };
  [IPC.API_RENDERER_RESPONSE]: { requestId: string; payload: unknown };

  // Renderer Hot Reload
  [IPC.RENDERER_RELOADED]: void;
}

// ─── Event Map (main → renderer via webContents.send) ────────────────────────

/** Maps event channels received by the renderer to their payload type */
export interface IPCEventMap {
  [IPC.PROJECT_SELECTED]: string; // selectedPath
  [IPC.FILE_TREE_DATA]: FileTreeNode[];
  [IPC.PROMPT_HISTORY_DATA]: unknown;
  [IPC.TOGGLE_HISTORY_PANEL]: void;
  [IPC.RUN_COMMAND]: string; // command
  [IPC.WORKSPACE_DATA]: WorkspaceData | WorkspaceProject[];
  [IPC.WORKSPACE_UPDATED]: WorkspaceData | WorkspaceProject[];
  [IPC.TERMINAL_OUTPUT]: string; // data
  [IPC.TERMINAL_CREATED]: { terminalId?: string; success: boolean; error?: string };
  [IPC.TERMINAL_SHELL_READY]: { terminalId: string };
  [IPC.TERMINAL_DESTROYED]: { terminalId: string; exitCode: number };
  [IPC.TERMINAL_OUTPUT_ID]: { terminalId: string; data: string };
  [IPC.AVAILABLE_SHELLS_DATA]: { shells: ShellInfo[]; success: boolean; error?: string };
  [IPC.CLAUDE_ACTIVE_STATUS]: { terminalId: string; active: boolean; sessionId?: string };
  [IPC.TASKS_DATA]: TasksPayload;
  [IPC.TASK_UPDATED]: { projectPath: string; taskId: string; action: string; success: boolean; error?: string };
  [IPC.PLUGINS_DATA]: Plugin[];
  [IPC.PLUGIN_TOGGLED]: { success: boolean; plugin?: Plugin; error?: string };
  [IPC.FILE_CONTENT]: { filePath: string; content?: string; error?: string };
  [IPC.FILE_SAVED]: { filePath: string; success: boolean; error?: string };
  [IPC.IMAGE_CONTENT]: { filePath: string; dataUrl?: string; fileSize?: number; error?: string };
  [IPC.SETTINGS_UPDATED]: { key: string; value: unknown; settings: SettingsData };
  [IPC.IS_FRAME_PROJECT_RESULT]: { projectPath: string; isFrame: boolean };
  [IPC.FRAME_PROJECT_INITIALIZED]: { projectPath: string; success: boolean; error?: string; created?: string[]; skipped?: string[] };
  [IPC.FRAME_CONFIG_DATA]: { projectPath: string; config: FrameConfig | null };
  [IPC.AI_TOOL_CHANGED]: AITool;
  [IPC.AI_FILES_STATUS_DATA]: { projectPath: string; status: AIFilesStatus | null; error?: string };
  [IPC.AI_FILE_UPDATED]: { projectPath: string; filename: string; action: string; success: boolean };
  [IPC.BACKLINK_VERIFICATION_RESULT]: { projectPath: string; result: BacklinkVerificationResult | null; error?: string };
  [IPC.BACKLINK_CONFIG_DATA]: { projectPath: string; config: BacklinkConfig | null };
  [IPC.BACKLINK_CONFIG_SAVED]: { projectPath: string; success: boolean };
  [IPC.ALL_BACKLINKS_UPDATED]: { projectPath: string; result: unknown };
  [IPC.CLAUDE_USAGE_DATA]: ClaudeUsageData;
  [IPC.TOGGLE_GIT_BRANCHES_PANEL]: void;
  [IPC.OVERVIEW_DATA]: OverviewData;

  // SubFrame Health
  [IPC.SUBFRAME_HEALTH_DATA]: { projectPath: string; health: SubFrameHealthStatus | null; error?: string };
  [IPC.SUBFRAME_COMPONENTS_UPDATED]: { projectPath: string; updated: string[]; failed: string[]; skipped?: string[]; error?: string };
  [IPC.SUBFRAME_UNINSTALLED]: { projectPath: string; result: UninstallResult | null; error?: string };

  // Agent State
  [IPC.AGENT_STATE_DATA]: AgentStatePayload;
  [IPC.USER_MESSAGE_SIGNAL]: { terminalId: string; timestamp: string; promptPreview?: string };

  // Terminal Stall Recovery
  [IPC.TERMINAL_STALL_DETECTED]: { terminalId: string; stallDurationMs: number };
  [IPC.TERMINAL_STALL_CLEARED]: { terminalId: string };

  // Onboarding
  [IPC.ONBOARDING_PROGRESS]: OnboardingProgressEvent;
  [IPC.TASK_ENHANCE_RESULT]: { activityStreamId: string; success: boolean; enhanced: Partial<Task>; error?: string };
  [IPC.AI_SESSIONS_UPDATED]: AISessionsPayload;

  // Auto-Updater
  [IPC.UPDATER_STATUS]: UpdaterStatus;
  [IPC.UPDATER_PROGRESS]: UpdaterProgress;

  // Pipeline
  [IPC.PIPELINE_PROGRESS]: PipelineProgressEvent;
  [IPC.PIPELINE_RUN_UPDATED]: PipelineRun;
  [IPC.PIPELINE_RUNS_DATA]: PipelineRunsPayload;

  // Activity Streams
  [IPC.ACTIVITY_OUTPUT]: ActivityOutputEvent;
  [IPC.ACTIVITY_STATUS]: ActivityStatusEvent;

  // Output Channels
  [IPC.OUTPUT_CHANNEL_OUTPUT]: OutputChannelEvent;
  [IPC.OUTPUT_CHANNEL_UPDATED]: OutputChannel;

  // Pop-Out Terminal
  [IPC.TERMINAL_POPOUT_STATUS]: { terminalId: string; poppedOut: boolean };
  [IPC.POPOUT_ACTIVATE]: { terminalId: string };

  // Pop-Out Editor
  [IPC.EDITOR_POPOUT_STATUS]: { filePath: string; popped: boolean };

  // CLI Integration
  [IPC.CLI_OPEN_FILE]: string; // absolute file path
  [IPC.CLI_OPEN_PROJECT]: string; // absolute directory path

  // Graceful Shutdown
  [IPC.GRACEFUL_SHUTDOWN_REQUEST]: GracefulShutdownRequest;
  [IPC.GRACEFUL_SHUTDOWN_STATUS]: GracefulShutdownStatusEvent;
  [IPC.GRACEFUL_SHUTDOWN_COMPLETE]: GracefulShutdownCompleteEvent;

  // Menu Actions
  [IPC.MENU_TOGGLE_SIDEBAR]: void;
  [IPC.MENU_TOGGLE_RIGHT_PANEL]: void;
  [IPC.MENU_RESET_LAYOUT]: void;
  [IPC.MENU_CLOSE_TERMINAL]: void;
  [IPC.MENU_OPEN_SETTINGS]: void;
  [IPC.MENU_NEW_TERMINAL]: void;
  [IPC.MENU_OPEN_FILE]: string; // absolute file path

  // Web Server
  [IPC.WEB_CLIENT_CONNECTED]: { userAgent: string; connectedAt: string };
  [IPC.WEB_CLIENT_DISCONNECTED]: void;

  // Session Control
  [IPC.SESSION_CONTROL_REQUEST]: void;
  [IPC.SESSION_CONTROL_GRANT]: void;
  [IPC.SESSION_CONTROL_TAKE]: void;
  [IPC.SESSION_CONTROL_RELEASE]: void;
  [IPC.SESSION_CONTROL_STATE]: SessionControlState;

  // AI Analysis Panel
  [IPC.AI_ANALYSIS_STATUS]: { projectPath: string; status: 'running' | 'complete' | 'error'; message?: string; terminalId?: string };
  [IPC.AI_ANALYSIS_RESULT]: { projectPath: string; result: string; timestamp: string };

  // Session Snapshot
  [IPC.SESSION_SNAPSHOT_STATUS]: SessionRestoreStatus;

  // Renderer Hot Reload
  [IPC.RENDERER_RELOADED]: void;
}

// ─── CommonJS compat (keep old require('...ipcChannels') working) ────────────

// When this file is compiled for the main process (CommonJS), module.exports
// is set automatically by TypeScript's esModuleInterop. For the renderer
// (ESM via esbuild), named exports work directly.
