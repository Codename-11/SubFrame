/**
 * IPC Channel Constants — TypeScript Edition
 * Single source of truth for all IPC channel names and their type signatures.
 */

import type { AgentStatePayload } from './agentStateTypes';

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
  WORKSPACE_LIST: 'workspace-list',
  WORKSPACE_LIST_DATA: 'workspace-list-data',
  WORKSPACE_SWITCH: 'workspace-switch',
  WORKSPACE_CREATE: 'workspace-create',
  WORKSPACE_RENAME: 'workspace-rename',
  WORKSPACE_DELETE: 'workspace-delete',

  // Default Project Directory
  SCAN_PROJECT_DIR: 'scan-project-dir',
  SELECT_DEFAULT_PROJECT_DIR: 'select-default-project-dir',

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

  // GitHub Panel
  LOAD_GITHUB_ISSUES: 'load-github-issues',
  GITHUB_ISSUES_DATA: 'github-issues-data',
  TOGGLE_GITHUB_PANEL: 'toggle-github-panel',
  OPEN_GITHUB_ISSUE: 'open-github-issue',

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

  // AI Tool Settings
  GET_AI_TOOL_CONFIG: 'get-ai-tool-config',
  AI_TOOL_CONFIG_DATA: 'ai-tool-config-data',
  SET_AI_TOOL: 'set-ai-tool',
  ADD_CUSTOM_AI_TOOL: 'add-custom-ai-tool',
  REMOVE_CUSTOM_AI_TOOL: 'remove-custom-ai-tool',
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

  // Prompt Library
  LOAD_PROMPTS: 'load-prompts',
  SAVE_PROMPT: 'save-prompt',
  DELETE_PROMPT: 'delete-prompt',

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

  // Menu Actions (main → renderer)
  MENU_TOGGLE_SIDEBAR: 'menu-toggle-sidebar',
  MENU_TOGGLE_RIGHT_PANEL: 'menu-toggle-right-panel',
  MENU_RESET_LAYOUT: 'menu-reset-layout',
  MENU_CLOSE_TERMINAL: 'menu-close-terminal',
  MENU_OPEN_SETTINGS: 'menu-open-settings',
  MENU_NEW_TERMINAL: 'menu-new-terminal',
} as const;

export type IPCChannel = (typeof IPC)[keyof typeof IPC];

// ─── Type helpers ────────────────────────────────────────────────────────────

/** A workspace project entry */
export interface WorkspaceProject {
  path: string;
  name: string;
  isFrameProject?: boolean;
}

/** Shape returned by workspace data */
export interface WorkspaceData {
  projects: WorkspaceProject[];
  activeProject?: string;
  settings?: Record<string, unknown>;
}

/** Workspace list entry */
export interface WorkspaceListEntry {
  key: string;
  name: string;
  active: boolean;
}

/** Response from WORKSPACE_LIST handler */
export interface WorkspaceListResult {
  active: string;
  workspaces: Array<{ key: string; name: string; projectCount: number }>;
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

/** Git branch info (matches BranchInfo from gitBranchesManager) */
export interface GitBranch {
  name: string;
  commit: string;
  date: string;
  message: string;
  isRemote: boolean;
  isCurrent: boolean;
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

/** Claude usage data (from claudeUsageManager) */
export interface ClaudeUsageData {
  fiveHour: { utilization: number; resetsAt: string | null } | null;
  sevenDay: { utilization: number; resetsAt: string | null } | null;
  lastUpdated: string;
  error: string | null;
}

/** Shell info */
export interface ShellInfo {
  name: string;
  path: string;
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
  phase: 'detecting' | 'gathering' | 'analyzing' | 'parsing' | 'importing' | 'done' | 'error';
  message: string;
  progress: number;
  /** Set once the analysis terminal is created, so the renderer can focus it immediately */
  terminalId?: string;
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
}

/** Download progress info */
export interface UpdaterProgress {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
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
}

// ─── Handle Map (ipcMain.handle → ipcRenderer.invoke) ───────────────────────

/** Maps invoke channels to their argument tuple and return type */
export interface IPCHandleMap {
  // Workspace (handle)
  [IPC.SCAN_PROJECT_DIR]: { args: [dirPath: string]; return: WorkspaceProject[] };
  [IPC.WORKSPACE_LIST]: { args: []; return: WorkspaceListResult };
  [IPC.WORKSPACE_SWITCH]: { args: [key: string]; return: { projects: WorkspaceProject[]; workspaceName: string } | null };
  [IPC.WORKSPACE_CREATE]: { args: [name: string]; return: unknown };
  [IPC.WORKSPACE_RENAME]: { args: [payload: { key: string; newName: string }]; return: unknown };
  [IPC.WORKSPACE_DELETE]: { args: [key: string]; return: unknown };
  [IPC.SELECT_DEFAULT_PROJECT_DIR]: { args: []; return: string | null };

  // GitHub
  [IPC.LOAD_GITHUB_ISSUES]: { args: [payload: { projectPath: string; state?: string }]; return: GitHubIssuesResult };

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

  // Claude Sessions
  [IPC.LOAD_CLAUDE_SESSIONS]: { args: [projectPath: string]; return: ClaudeSession[] };
  [IPC.REFRESH_CLAUDE_SESSIONS]: { args: [projectPath: string]; return: ClaudeSession[] };
  [IPC.CHECK_ACTIVE_CLAUDE_SESSION]: { args: [projectPath: string]; return: boolean };
  [IPC.RENAME_CLAUDE_SESSION]: { args: [payload: { projectPath: string; sessionId: string; name: string }]; return: boolean };
  [IPC.DELETE_CLAUDE_SESSION]: { args: [payload: { projectPath: string; sessionId: string; slug: string }]; return: boolean };
  [IPC.DELETE_ALL_CLAUDE_SESSIONS]: { args: [projectPath: string]; return: { deleted: number } };

  // Terminal Agent Status
  [IPC.IS_TERMINAL_CLAUDE_ACTIVE]: { args: [terminalId: string]; return: boolean };

  // Terminal Session Name
  [IPC.GET_TERMINAL_SESSION_NAME]: { args: [payload: { terminalId: string }]; return: { name: string | null } };

  // Skills
  [IPC.LOAD_SKILLS]: { args: [projectPath: string]; return: SkillInfo[] };

  // Onboarding
  [IPC.DETECT_PROJECT_INTELLIGENCE]: { args: [projectPath: string]; return: OnboardingDetectionResult };
  [IPC.RUN_ONBOARDING_ANALYSIS]: { args: [projectPath: string]; return: { terminalId: string } };
  [IPC.IMPORT_ONBOARDING_RESULTS]: { args: [payload: { projectPath: string; results: OnboardingAnalysisResult; selections: OnboardingImportSelections }]; return: OnboardingImportResult };

  // Prompt Library
  [IPC.LOAD_PROMPTS]: { args: [projectPath: string]; return: PromptsResult };
  [IPC.SAVE_PROMPT]: { args: [payload: { projectPath: string; prompt: SavedPrompt }]; return: PromptsResult };
  [IPC.DELETE_PROMPT]: { args: [payload: { projectPath: string; promptId: string }]; return: PromptsResult };

  // What's New
  [IPC.GET_RELEASE_NOTES]: { args: []; return: { version: string; content: string } };

  // Auto-Updater
  [IPC.UPDATER_CHECK]: { args: []; return: UpdateCheckResult };
  [IPC.UPDATER_DOWNLOAD]: { args: []; return: void };
  [IPC.UPDATER_INSTALL]: { args: []; return: void };

  // Pipeline
  [IPC.PIPELINE_LIST_WORKFLOWS]: { args: [projectPath: string]; return: WorkflowDefinition[] };
  [IPC.PIPELINE_START]: { args: [payload: { projectPath: string; workflowId: string; trigger: PipelineTrigger }]; return: { runId: string } };
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
}

// ─── Event Map (main → renderer via webContents.send) ────────────────────────

/** Maps event channels received by the renderer to their payload type */
export interface IPCEventMap {
  [IPC.PROJECT_SELECTED]: string; // selectedPath
  [IPC.FILE_TREE_DATA]: FileTreeNode[];
  [IPC.PROMPT_HISTORY_DATA]: unknown;
  [IPC.TOGGLE_HISTORY_PANEL]: void;
  [IPC.RUN_COMMAND]: string; // command
  [IPC.WORKSPACE_DATA]: WorkspaceData;
  [IPC.WORKSPACE_UPDATED]: { projects: WorkspaceProject[]; workspaceName: string };
  [IPC.TERMINAL_OUTPUT]: string; // data
  [IPC.TERMINAL_CREATED]: { terminalId?: string; success: boolean; error?: string };
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
  [IPC.SUBFRAME_COMPONENTS_UPDATED]: { projectPath: string; updated: string[]; failed: string[]; error?: string };
  [IPC.SUBFRAME_UNINSTALLED]: { projectPath: string; result: UninstallResult | null; error?: string };

  // Agent State
  [IPC.AGENT_STATE_DATA]: AgentStatePayload;

  // Onboarding
  [IPC.ONBOARDING_PROGRESS]: OnboardingProgressEvent;

  // Auto-Updater
  [IPC.UPDATER_STATUS]: UpdaterStatus;
  [IPC.UPDATER_PROGRESS]: UpdaterProgress;

  // Pipeline
  [IPC.PIPELINE_PROGRESS]: PipelineProgressEvent;
  [IPC.PIPELINE_RUN_UPDATED]: PipelineRun;
  [IPC.PIPELINE_RUNS_DATA]: PipelineRunsPayload;

  // Menu Actions
  [IPC.MENU_TOGGLE_SIDEBAR]: void;
  [IPC.MENU_TOGGLE_RIGHT_PANEL]: void;
  [IPC.MENU_RESET_LAYOUT]: void;
  [IPC.MENU_CLOSE_TERMINAL]: void;
  [IPC.MENU_OPEN_SETTINGS]: void;
  [IPC.MENU_NEW_TERMINAL]: void;
}

// ─── CommonJS compat (keep old require('...ipcChannels') working) ────────────

// When this file is compiled for the main process (CommonJS), module.exports
// is set automatically by TypeScript's esModuleInterop. For the renderer
// (ESM via esbuild), named exports work directly.
