/**
 * SettingsPanel — Settings dialog/modal with sidebar navigation.
 * Opens via useUIStore.settingsOpen.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import QRCode from 'qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Button } from './ui/button';
import {
  FolderSearch, FolderOpen, Plus, Trash2, X as XIcon, RefreshCw, ExternalLink,
  Github, FileText, Sparkles, Scale, Info, Check, RotateCcw, Save,
  Palette, SlidersHorizontal, TerminalSquare, Code2, Bot, Download, Search, Globe,
  Zap, ChevronDown, ChevronRight, Pencil, Wand2, Play, Shield, FileCode, Bell,
  Monitor, Wifi, Copy, QrCode,
} from 'lucide-react';
import { useUIStore } from '../stores/useUIStore';
import { useProjectStore } from '../stores/useProjectStore';
import { useTerminalStore } from '../stores/useTerminalStore';
import { useSettings, useAIToolConfig } from '../hooks/useSettings';
import { typedInvoke, typedSend } from '../lib/ipc';
import { useIpcQuery } from '../hooks/useIpc';
import { useIPCEvent } from '../hooks/useIPCListener';
import { IPC, type ShellInfo } from '../../shared/ipcChannels';
import { WebServerSetup } from './WebServerSetup';
import { toast } from 'sonner';
import { EDITOR_THEMES } from '../lib/codemirror-theme';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';
import {
  type ThemeTokens,
  type ThemeDefinition,
  BUILTIN_THEMES,
  THEME_CLASSIC_AMBER,
  getThemeById,
} from '../../shared/themeTypes';

import { getTransport } from '../lib/transportProvider';
const APP_VERSION = require('../../../package.json').version;

const BUILTIN_TOOL_IDS = new Set(['claude', 'codex', 'gemini']);

const DEFAULT_FONT = "'JetBrainsMono Nerd Font', 'CaskaydiaCove Nerd Font', 'FiraCode Nerd Font', 'JetBrains Mono', 'Cascadia Code', 'Fira Code', monospace";

/** Nerd Font families to probe — the font-family name as installed on disk. */
const NERD_FONTS = [
  'JetBrainsMono Nerd Font',
  'CaskaydiaCove Nerd Font',
  'FiraCode Nerd Font',
  'Hack Nerd Font',
  'MesloLGS Nerd Font',
];

function detectNerdFont(): string | null {
  if (typeof document === 'undefined') return null;
  for (const font of NERD_FONTS) {
    if (document.fonts.check(`12px "${font}"`)) return font;
  }
  return null;
}

/* ---------- Navigation items ---------- */

const NAV_ITEMS = [
  { key: 'appearance', label: 'Appearance', icon: Palette },
  { key: 'general', label: 'General', icon: SlidersHorizontal },
  { key: 'terminal', label: 'Terminal', icon: TerminalSquare },
  { key: 'editor', label: 'Editor', icon: Code2 },
  { key: 'ai-tool', label: 'AI Tool', icon: Bot },
  { key: 'hooks', label: 'Hooks', icon: Zap },
  { key: 'integrations', label: 'Integrations', icon: Globe },
  { key: 'updates', label: 'Updates', icon: Download },
  { key: 'about', label: 'About', icon: Info },
] as const;

/* ---------- Searchable setting metadata per section ---------- */

const SECTION_LABELS: Record<string, string[]> = {
  appearance: [
    'Theme Presets', 'Customize', 'Neon Traces', 'CRT Scanlines', 'Logo Glow',
    'Accent', 'Neon Purple', 'Neon Pink', 'Neon Cyan', 'Save as Custom Theme',
  ],
  general: [
    'Open terminal on startup', 'Reuse idle terminal for agent',
    'Show hidden files (.dotfiles)', 'Confirm before closing',
    'Auto-poll usage', 'Grid overflow auto-switch',
    'Highlight user messages', 'Default Project Directory',
    'Startup', 'Behavior', 'Paths', 'Git', 'Auto-fetch', 'Install CLI', 'CLI',
  ],
  terminal: [
    'Font Size', 'Font Family', 'Line Height', 'Scrollback Lines',
    'Cursor Style', 'Cursor Blink', 'Default Shell', 'Bell Sound',
    'Copy on Select', 'Max Terminals', 'Font', 'Display', 'Behavior', 'Nerd Font',
  ],
  editor: [
    'Font Size', 'Font Family', 'Tab Size', 'Theme',
    'Word Wrap', 'Minimap', 'Line Numbers', 'Bracket Matching',
    'Font', 'Display',
  ],
  'ai-tool': [
    'Active Tool', 'Start Command', 'Custom Tools',
    'Add custom AI tools',
  ],
  hooks: [
    'Hooks', 'PreToolUse', 'PostToolUse', 'Notification', 'Stop',
    'UserPromptSubmit', 'SessionStart', 'Add Hook', 'Templates',
    'AI Generate', 'Block .env writes', 'Log all commands',
    'Auto-approve reads', 'Notify on completion',
  ],
  integrations: [
    'Local API Server', 'API Server', 'Enable API', 'DTSP', 'Desktop Text Source Protocol',
    'SubFrame Server', 'Web Server', 'Remote Access', 'SSH Tunnel', 'Pairing',
    'Shell Integration', 'CLI Status', 'Context Menu', 'Explorer',
  ],
  updates: [
    'Auto-check for updates', 'Pre-release Channel',
    'Check Interval', 'Update Preferences',
  ],
  about: [
    'SubFrame', 'GitHub', 'Report Issue', "What's New",
    'Changelog', 'Links', 'About',
  ],
};

/* ---------- Hooks types & constants ---------- */

/** A single hook command entry in Claude Code's settings.json */
interface HookCommand {
  type: 'command';
  command: string;
}

/** A hook entry (matcher + list of commands) */
interface HookEntry {
  matcher: string;
  hooks: HookCommand[];
}

/** The hooks object from .claude/settings.json */
interface HooksConfig {
  [eventType: string]: HookEntry[];
}

/** All supported hook event types */
const HOOK_EVENT_TYPES = [
  { key: 'PreToolUse', label: 'Pre Tool Use', description: 'Runs before a tool is executed', icon: Shield },
  { key: 'PostToolUse', label: 'Post Tool Use', description: 'Runs after a tool completes', icon: Check },
  { key: 'Notification', label: 'Notification', description: 'Runs on notifications', icon: Bell },
  { key: 'Stop', label: 'Stop', description: 'Runs when Claude stops responding', icon: Play },
  { key: 'UserPromptSubmit', label: 'Prompt Submit', description: 'Runs when user submits a prompt', icon: FileText },
  { key: 'SessionStart', label: 'Session Start', description: 'Runs at session start', icon: Zap },
] as const;

/** Common matcher suggestions per event type */
const MATCHER_SUGGESTIONS: Record<string, string[]> = {
  PreToolUse: ['Bash', 'Write', 'Read', 'Edit', 'Glob', 'Grep', '*'],
  PostToolUse: ['Bash', 'Write', 'Read', 'Edit', '*'],
  Notification: [''],
  Stop: [''],
  UserPromptSubmit: [''],
  SessionStart: [''],
};

/** Quick hook templates */
const HOOK_TEMPLATES = [
  {
    name: 'Block .env writes',
    description: 'Prevent writing to .env files',
    eventType: 'PreToolUse',
    matcher: 'Write',
    scriptDescription: 'Block any writes to files matching .env* patterns. If the tool_input.file_path contains ".env", output a JSON object with { "decision": "block", "reason": "Writing to .env files is not allowed" }.',
  },
  {
    name: 'Log all commands',
    description: 'Log tool usage to a file',
    eventType: 'PostToolUse',
    matcher: '*',
    scriptDescription: 'Log the tool name, timestamp, and a summary of the tool input to a file at .claude/hooks/tool-log.txt. Append each entry as a new line.',
  },
  {
    name: 'Auto-approve reads',
    description: 'Auto-approve read-only tools',
    eventType: 'PreToolUse',
    matcher: 'Read',
    scriptDescription: 'Auto-approve all Read tool invocations by outputting a JSON object with { "decision": "approve" }.',
  },
  {
    name: 'Notify on completion',
    description: 'Desktop notification when agent stops',
    eventType: 'Stop',
    matcher: '',
    scriptDescription: 'Send a desktop notification (using node-notifier or native OS commands) saying "Claude has finished responding" when the agent stops.',
  },
];

/* ---------- Reusable setting components (file-local) ---------- */

function SettingGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div data-setting-group={label}>
      <div className="text-[10px] uppercase tracking-wider text-text-tertiary font-medium mb-1.5">{label}</div>
      <div className="bg-bg-secondary/50 rounded-lg p-3 space-y-3">{children}</div>
    </div>
  );
}

interface SettingToggleProps {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  extra?: React.ReactNode;
}
function SettingToggle({ label, description, value, onChange, extra }: SettingToggleProps) {
  return (
    <div className="flex items-center justify-between" data-setting-label={label}>
      <div className="flex-1 min-w-0 mr-3">
        <div className="text-sm text-text-primary">{label}</div>
        {description && <div className="text-xs text-text-tertiary">{description}</div>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {extra}
        <button
          onClick={() => onChange(!value)}
          className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${value ? 'bg-accent' : 'bg-bg-tertiary'}`}
        >
          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${value ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
        </button>
      </div>
    </div>
  );
}

interface SettingSelectProps {
  label: string;
  description?: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}
function SettingSelect({ label, description, value, onChange, options }: SettingSelectProps) {
  return (
    <div data-setting-label={label}>
      <div className="text-sm text-text-primary mb-1">{label}</div>
      {description && <div className="text-xs text-text-tertiary mb-1">{description}</div>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-bg-deep border border-border-subtle rounded px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

interface SettingInputProps {
  label: string;
  description?: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: 'text' | 'number';
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  readOnly?: boolean;
  extra?: React.ReactNode;
}
function SettingInput({ label, description, value, onChange, type = 'text', placeholder, min, max, step, readOnly, extra }: SettingInputProps) {
  return (
    <div data-setting-label={label}>
      <div className="text-sm text-text-primary mb-1">{label}</div>
      {description && <div className="text-xs text-text-tertiary mb-1">{description}</div>}
      <div className="flex gap-2">
        <Input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          min={min}
          max={max}
          step={step}
          readOnly={readOnly}
          className="bg-bg-deep border-border-subtle text-sm flex-1"
        />
        {extra}
      </div>
    </div>
  );
}

interface SettingSliderProps {
  label: string;
  description?: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  formatValue?: (v: number) => string;
}
function SettingSlider({ label, description, value, onChange, min, max, step, formatValue }: SettingSliderProps) {
  return (
    <div data-setting-label={label}>
      <div className="text-sm text-text-primary mb-1">{label}</div>
      {description && <div className="text-xs text-text-tertiary mb-1">{description}</div>}
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 accent-accent cursor-pointer"
        />
        <span className="text-xs text-text-secondary w-14 text-right tabular-nums">
          {formatValue ? formatValue(value) : value}
        </span>
      </div>
    </div>
  );
}

/* ---------- Main component ---------- */

export function SettingsPanel() {
  const settingsOpen = useUIStore((s) => s.settingsOpen);
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen);
  const { settings, updateSetting } = useSettings();
  const { config: aiToolConfig, setAITool, addCustomTool, removeCustomTool, refetch: refetchAITools } = useAIToolConfig();
  const [recheckingTools, setRecheckingTools] = useState(false);
  const [cliInstalling, setCliInstalling] = useState(false);
  const [cliUninstalling, setCliUninstalling] = useState(false);
  const [scanning, setScanning] = useState(false);

  // Local form state
  const [activeTab, setActiveTab] = useState('appearance');
  const [searchQuery, setSearchQuery] = useState('');
  const [aiCommand, setAiCommand] = useState('');
  const [fontSize, setFontSize] = useState(14);
  const [scrollback, setScrollback] = useState(10000);
  const [maxTerminals, setMaxTerminals] = useState(9);

  // Terminal settings
  const [nerdFontDetected] = useState(() => detectNerdFont());
  const [fontFamily, setFontFamily] = useState(DEFAULT_FONT);
  const [lineHeight, setLineHeight] = useState(1.2);
  const [cursorBlink, setCursorBlink] = useState(true);
  const [cursorStyle, setCursorStyle] = useState('bar');
  const [defaultShell, setDefaultShell] = useState('');
  const [availableShells, setAvailableShells] = useState<ShellInfo[]>([]);
  const [bellSound, setBellSound] = useState(false);
  const [copyOnSelect, setCopyOnSelect] = useState(false);

  // Editor settings
  const [editorFontSize, setEditorFontSize] = useState(12);
  const [editorFontFamily, setEditorFontFamily] = useState(DEFAULT_FONT);
  const [editorWordWrap, setEditorWordWrap] = useState(false);
  const [editorMinimap, setEditorMinimap] = useState(false);
  const [editorLineNumbers, setEditorLineNumbers] = useState(true);
  const [editorBracketMatching, setEditorBracketMatching] = useState(true);
  const [editorTabSize, setEditorTabSize] = useState(2);
  const [editorTheme, setEditorTheme] = useState<string>('subframe-dark');

  // Updater settings
  const [autoCheck, setAutoCheck] = useState(true);
  const [allowPrerelease, setAllowPrerelease] = useState('auto');
  const [checkIntervalHours, setCheckIntervalHours] = useState(4);

  // Appearance / theme state
  const [activeThemeId, setActiveThemeId] = useState('classic-amber');
  const [customTokenOverrides, setCustomTokenOverrides] = useState<Partial<ThemeTokens>>({});
  const [customThemeName, setCustomThemeName] = useState('');
  const [showSaveThemeInput, setShowSaveThemeInput] = useState(false);

  // Custom tool form state
  const [newToolName, setNewToolName] = useState('');
  const [newToolCommand, setNewToolCommand] = useState('');
  const [newToolDescription, setNewToolDescription] = useState('');

  // Hooks state
  const currentProjectPath = useProjectStore((s) => s.currentProjectPath);
  const activeTerminalId = useTerminalStore((s) => s.activeTerminalId);
  const [hooksConfig, setHooksConfig] = useState<HooksConfig>({});
  const [hooksLoading, setHooksLoading] = useState(false);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set(['PreToolUse', 'PostToolUse']));
  const [showAddHookDialog, setShowAddHookDialog] = useState(false);
  const [editingHook, setEditingHook] = useState<{ eventType: string; entryIndex: number } | null>(null);
  const [hookFormEvent, setHookFormEvent] = useState('PreToolUse');
  const [hookFormMatcher, setHookFormMatcher] = useState('');
  const [hookFormCommand, setHookFormCommand] = useState('');
  const [showAIGenerate, setShowAIGenerate] = useState(false);
  const [aiGeneratePrompt, setAiGeneratePrompt] = useState('');
  const [disabledHooks, setDisabledHooks] = useState<Set<string>>(new Set());

  // Web Server setup dialog
  const [webServerSetupOpen, setWebServerSetupOpen] = useState(false);
  const [webServerPairingCode, setWebServerPairingCode] = useState<string | null>(null);
  const [webServerQrVisible, setWebServerQrVisible] = useState(false);
  const [webServerQrDataUrl, setWebServerQrDataUrl] = useState<string | null>(null);

  // Shell integration status
  const [cliStatus, setCliStatus] = useState<{ installed: boolean; inPath: boolean; path: string | null } | null>(null);
  const [contextMenuInstalled, setContextMenuInstalled] = useState(false);

  // Web Server info query — only active when integrations tab is shown
  const isIntegrationsTab = activeTab === 'integrations';
  const { data: webServerInfo, refetch: refetchWebServerInfo } = useIpcQuery(
    IPC.WEB_SERVER_INFO,
    [],
    { enabled: settingsOpen && isIntegrationsTab, refetchInterval: isIntegrationsTab ? 5000 : false }
  );

  // Listen for web client connect/disconnect to refresh server info
  useIPCEvent(
    IPC.WEB_CLIENT_CONNECTED,
    useCallback(() => { refetchWebServerInfo(); }, [refetchWebServerInfo])
  );
  useIPCEvent(
    IPC.WEB_CLIENT_DISCONNECTED,
    useCallback(() => { refetchWebServerInfo(); }, [refetchWebServerInfo])
  );

  // Generate QR code for SubFrame Server when toggled visible
  useEffect(() => {
    if (webServerQrVisible && webServerInfo?.enabled && webServerInfo.port && webServerInfo.token) {
      const url = `http://localhost:${webServerInfo.port}/?token=${webServerInfo.token}`;
      QRCode.toDataURL(url, {
        width: 150,
        margin: 2,
        color: { dark: '#e8e6e3', light: '#0f0f10' },
      }).then(setWebServerQrDataUrl).catch(() => setWebServerQrDataUrl(null));
    } else {
      setWebServerQrDataUrl(null);
    }
  }, [webServerQrVisible, webServerInfo?.enabled, webServerInfo?.port, webServerInfo?.token]);

  // Check CLI and context menu status when integrations tab is active
  useEffect(() => {
    if (!isIntegrationsTab) return;
    typedInvoke(IPC.CHECK_CLI_STATUS).then(setCliStatus).catch(() => {});
    if (process.platform === 'win32') {
      typedInvoke(IPC.CHECK_CONTEXT_MENU).then((r) => setContextMenuInstalled(r.installed)).catch(() => {});
    }
  }, [isIntegrationsTab]);

  const checkContextMenu = useCallback(() => {
    typedInvoke(IPC.CHECK_CONTEXT_MENU).then((r) => setContextMenuInstalled(r.installed)).catch(() => {});
  }, []);

  const refreshCliStatus = useCallback(() => {
    typedInvoke(IPC.CHECK_CLI_STATUS).then(setCliStatus).catch(() => {});
  }, []);

  // Sync form state from loaded data
  useEffect(() => {
    if (!settings) return;
    const terminal = (settings.terminal as Record<string, unknown>) || {};
    setFontSize((terminal.fontSize as number) || 14);
    setScrollback((terminal.scrollback as number) || 10000);
    setMaxTerminals((terminal.maxTerminals as number) || 9);
    setFontFamily((terminal.fontFamily as string) || DEFAULT_FONT);
    setLineHeight((terminal.lineHeight as number) || 1.2);
    setCursorBlink(terminal.cursorBlink !== false);
    setCursorStyle((terminal.cursorStyle as string) || 'bar');
    setDefaultShell((terminal.defaultShell as string) || '');
    setBellSound((terminal.bellSound as boolean) || false);
    setCopyOnSelect((terminal.copyOnSelect as boolean) || false);

    const editor = (settings.editor as Record<string, unknown>) || {};
    setEditorFontSize((editor.fontSize as number) || 12);
    setEditorFontFamily((editor.fontFamily as string) || DEFAULT_FONT);
    setEditorWordWrap((editor.wordWrap as boolean) || false);
    setEditorMinimap((editor.minimap as boolean) || false);
    setEditorLineNumbers(editor.lineNumbers !== false);
    setEditorBracketMatching(editor.bracketMatching !== false);
    setEditorTabSize((editor.tabSize as number) || 2);
    setEditorTheme((editor.theme as string) || 'subframe-dark');

    const updater = (settings.updater as Record<string, unknown>) || {};
    setAutoCheck(updater.autoCheck !== false);
    setAllowPrerelease((updater.allowPrerelease as string) || 'auto');
    setCheckIntervalHours((updater.checkIntervalHours as number) || 4);

    const appearance = (settings.appearance as Record<string, unknown>) || {};
    setActiveThemeId((appearance.activeThemeId as string) || 'classic-amber');
    setCustomTokenOverrides({});

    if (aiToolConfig) {
      const activeTool = aiToolConfig.activeTool;
      const aiTools = (settings.aiTools as Record<string, Record<string, unknown>>) || {};
      const toolSettings = aiTools[activeTool.id] || {};
      const customCmd = (toolSettings.customCommand as string) || '';
      setAiCommand(customCmd || activeTool.command);
    }
  }, [settings, aiToolConfig]);

  // Fetch available shells for the terminal shell dropdown
  useEffect(() => {
    const handler = (_event: unknown, data: { shells: ShellInfo[]; success: boolean }) => {
      if (data.success) setAvailableShells(data.shells);
    };
    const unsub = getTransport().on(IPC.AVAILABLE_SHELLS_DATA, handler);
    getTransport().send(IPC.GET_AVAILABLE_SHELLS);
    return unsub;
  }, []);

  const general = (settings.general as Record<string, unknown>) || {};
  const autoCreateTerminal = (general.autoCreateTerminal as boolean) || false;
  const reuseIdleTerminal = general.reuseIdleTerminal !== false; // default true
  const showDotfiles = (general.showDotfiles as boolean) || false;
  const confirmBeforeClose = (general.confirmBeforeClose !== false);
  const defaultProjectDir = (general.defaultProjectDir as string) || '';
  const usagePollingInterval = (general.usagePollingInterval as number) || 0;
  const gridOverflowAutoSwitch = general.gridOverflowAutoSwitch !== false;
  const highlightUserMessages = general.highlightUserMessages !== false; // default true
  const userMessageColor = (general.userMessageColor as string) || '#ff6eb4';

  function saveToggle(key: string, value: boolean) {
    updateSetting.mutate([{ key, value }]);
  }

  function saveAiCommand() {
    if (!aiToolConfig) return;
    const toolId = aiToolConfig.activeTool.id;
    updateSetting.mutate([{ key: `aiTools.${toolId}.customCommand`, value: aiCommand.trim() }]);
    toast.success('Start command saved');
  }

  function saveTerminal() {
    updateSetting.mutate([{ key: 'terminal.fontSize', value: fontSize }]);
    updateSetting.mutate([{ key: 'terminal.scrollback', value: scrollback }]);
    updateSetting.mutate([{ key: 'terminal.fontFamily', value: fontFamily }]);
    updateSetting.mutate([{ key: 'terminal.lineHeight', value: lineHeight }]);
    updateSetting.mutate([{ key: 'terminal.cursorBlink', value: cursorBlink }]);
    updateSetting.mutate([{ key: 'terminal.cursorStyle', value: cursorStyle }]);
    updateSetting.mutate([{ key: 'terminal.defaultShell', value: defaultShell }]);
    updateSetting.mutate([{ key: 'terminal.bellSound', value: bellSound }]);
    updateSetting.mutate([{ key: 'terminal.copyOnSelect', value: copyOnSelect }]);
    updateSetting.mutate([{ key: 'terminal.maxTerminals', value: maxTerminals }]);
    toast.success('Terminal settings saved');
  }

  function saveEditor() {
    updateSetting.mutate([{ key: 'editor.fontSize', value: editorFontSize }]);
    updateSetting.mutate([{ key: 'editor.fontFamily', value: editorFontFamily }]);
    updateSetting.mutate([{ key: 'editor.wordWrap', value: editorWordWrap }]);
    updateSetting.mutate([{ key: 'editor.minimap', value: editorMinimap }]);
    updateSetting.mutate([{ key: 'editor.lineNumbers', value: editorLineNumbers }]);
    updateSetting.mutate([{ key: 'editor.bracketMatching', value: editorBracketMatching }]);
    updateSetting.mutate([{ key: 'editor.tabSize', value: editorTabSize }]);
    updateSetting.mutate([{ key: 'editor.theme', value: editorTheme }]);
    toast.success('Editor settings saved');
  }

  function saveUpdater() {
    updateSetting.mutate([{ key: 'updater.autoCheck', value: autoCheck }]);
    updateSetting.mutate([{ key: 'updater.allowPrerelease', value: allowPrerelease }]);
    updateSetting.mutate([{ key: 'updater.checkIntervalHours', value: checkIntervalHours }]);
    toast.success('Update settings saved');
  }

  /* ---------- Hooks helpers ---------- */

  const claudeSettingsPath = currentProjectPath
    ? `${currentProjectPath.replace(/\\/g, '/')}/.claude/settings.json`
    : null;

  /** Load hooks from .claude/settings.json via IPC send/response */
  const loadHooks = useCallback(() => {
    if (!claudeSettingsPath) return;
    setHooksLoading(true);

    let unsub: (() => void) | null = null;
    unsub = getTransport().on(IPC.FILE_CONTENT, (_event: unknown, result: { filePath: string; content?: string; error?: string }) => {
      if (result.filePath !== claudeSettingsPath) return;
      unsub?.();
      setHooksLoading(false);

      if (result.error || !result.content) {
        setHooksConfig({});
        return;
      }
      try {
        const parsed = JSON.parse(result.content);
        setHooksConfig((parsed.hooks as HooksConfig) || {});
      } catch {
        setHooksConfig({});
      }
    });

    typedSend(IPC.READ_FILE, claudeSettingsPath);
  }, [claudeSettingsPath]);

  /** Save hooks back to .claude/settings.json */
  const saveHooks = useCallback((newHooks: HooksConfig) => {
    if (!claudeSettingsPath) return;

    // First read the full file to preserve other keys, then merge hooks
    let unsubRead: (() => void) | null = null;
    const readTimer = setTimeout(() => { unsubRead?.(); }, 10_000);
    unsubRead = getTransport().on(IPC.FILE_CONTENT, (_event: unknown, result: { filePath: string; content?: string; error?: string }) => {
      if (result.filePath !== claudeSettingsPath) return;
      unsubRead?.();
      clearTimeout(readTimer);

      let existing: Record<string, unknown> = {};
      if (!result.error && result.content) {
        try { existing = JSON.parse(result.content); } catch { /* start fresh */ }
      }
      existing.hooks = newHooks;

      let unsubSave: (() => void) | null = null;
      const saveTimer = setTimeout(() => { unsubSave?.(); }, 10_000);
      unsubSave = getTransport().on(IPC.FILE_SAVED, (_e: unknown, saveResult: { filePath: string; success?: boolean; error?: string }) => {
        if (saveResult.filePath !== claudeSettingsPath) return;
        unsubSave?.();
        clearTimeout(saveTimer);
        if (saveResult.success) {
          setHooksConfig(newHooks);
          toast.success('Hooks saved');
        } else {
          toast.error('Failed to save hooks');
        }
      });
      typedSend(IPC.WRITE_FILE, { filePath: claudeSettingsPath, content: JSON.stringify(existing, null, 2) + '\n' });
    });

    typedSend(IPC.READ_FILE, claudeSettingsPath);
  }, [claudeSettingsPath]);

  /** Load hooks when switching to the hooks tab */
  useEffect(() => {
    if (activeTab === 'hooks' && claudeSettingsPath) {
      loadHooks();
    }
  }, [activeTab, claudeSettingsPath, loadHooks]);

  function toggleEventExpanded(eventKey: string) {
    setExpandedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(eventKey)) next.delete(eventKey);
      else next.add(eventKey);
      return next;
    });
  }

  function addHookEntry(eventType: string, matcher: string, command: string) {
    const newHooks = { ...hooksConfig };
    if (!newHooks[eventType]) newHooks[eventType] = [];
    newHooks[eventType] = [
      ...newHooks[eventType],
      { matcher, hooks: [{ type: 'command', command }] },
    ];
    saveHooks(newHooks);
  }

  function updateHookEntry(eventType: string, entryIndex: number, matcher: string, command: string) {
    const newHooks = { ...hooksConfig };
    if (!newHooks[eventType] || !newHooks[eventType][entryIndex]) return;
    newHooks[eventType] = [...newHooks[eventType]];
    newHooks[eventType][entryIndex] = {
      matcher,
      hooks: [{ type: 'command', command }],
    };
    saveHooks(newHooks);
  }

  function deleteHookEntry(eventType: string, entryIndex: number) {
    const newHooks = { ...hooksConfig };
    if (!newHooks[eventType]) return;
    newHooks[eventType] = newHooks[eventType].filter((_, i) => i !== entryIndex);
    if (newHooks[eventType].length === 0) delete newHooks[eventType];
    saveHooks(newHooks);
  }

  function toggleHookDisabled(eventType: string, entryIndex: number) {
    const key = `${eventType}:${entryIndex}`;
    setDisabledHooks((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function resetHookForm() {
    setHookFormEvent('PreToolUse');
    setHookFormMatcher('');
    setHookFormCommand('');
    setShowAIGenerate(false);
    setAiGeneratePrompt('');
    setEditingHook(null);
  }

  function openAddHookDialog() {
    resetHookForm();
    setShowAddHookDialog(true);
  }

  function openEditHookDialog(eventType: string, entryIndex: number) {
    const entry = hooksConfig[eventType]?.[entryIndex];
    if (!entry) return;
    setHookFormEvent(eventType);
    setHookFormMatcher(entry.matcher);
    setHookFormCommand(entry.hooks[0]?.command || '');
    setEditingHook({ eventType, entryIndex });
    setShowAddHookDialog(true);
  }

  function handleHookFormSubmit() {
    if (!hookFormCommand.trim()) {
      toast.warning('Command is required');
      return;
    }
    if (editingHook) {
      updateHookEntry(editingHook.eventType, editingHook.entryIndex, hookFormMatcher.trim(), hookFormCommand.trim());
    } else {
      addHookEntry(hookFormEvent, hookFormMatcher.trim(), hookFormCommand.trim());
    }
    setShowAddHookDialog(false);
    resetHookForm();
  }

  function handleAIGenerate() {
    if (!activeTerminalId) {
      toast.warning('No active terminal — open a terminal first');
      return;
    }
    if (!aiGeneratePrompt.trim()) {
      toast.warning('Describe what you want the hook to do');
      return;
    }
    const safeMatcher = hookFormMatcher || '*';
    const hookDir = '.claude/hooks';
    const fileName = `${hookFormEvent.toLowerCase()}-${safeMatcher.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}.js`;
    const prompt = [
      `Generate a Claude Code hook script for the ${hookFormEvent} event with matcher "${safeMatcher}".`,
      `The hook should: ${aiGeneratePrompt.trim().replace(/[\r\n]+/g, ' ')}`,
      '',
      `Write it to ${hookDir}/${fileName} and output ONLY the absolute file path when done.`,
      `Make sure to create the ${hookDir} directory if it doesn't exist.`,
      '',
      'The hook receives JSON on stdin with tool_name, tool_input, etc.',
      hookFormEvent.startsWith('Pre') ? 'It can output JSON with { "decision": "approve"|"block"|"deny", "reason": "..." } to control the tool.' : '',
    ].filter(Boolean).join('\n');

    getTransport().send(IPC.TERMINAL_INPUT_ID, { terminalId: activeTerminalId, data: prompt + '\r' });
    toast.info('Sent to agent — check your terminal');
    setShowAIGenerate(false);
    setAiGeneratePrompt('');
  }

  function applyTemplate(template: (typeof HOOK_TEMPLATES)[number]) {
    setHookFormEvent(template.eventType);
    setHookFormMatcher(template.matcher);
    setShowAIGenerate(true);
    setAiGeneratePrompt(template.scriptDescription);
    setShowAddHookDialog(true);
    setEditingHook(null);
  }

  /** Total hook entries count */
  const totalHookCount = useMemo(() => {
    return Object.values(hooksConfig).reduce((sum, entries) => sum + entries.length, 0);
  }, [hooksConfig]);

  /* ---------- Search logic ---------- */

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const sectionMatchCounts = useMemo(() => {
    if (!normalizedQuery) return null;
    const counts: Record<string, number> = {};
    for (const [section, labels] of Object.entries(SECTION_LABELS)) {
      counts[section] = labels.filter((l) => l.toLowerCase().includes(normalizedQuery)).length;
    }
    return counts;
  }, [normalizedQuery]);

  // Auto-switch to the first section with matches when searching
  useEffect(() => {
    if (!sectionMatchCounts) return;
    const currentCount = sectionMatchCounts[activeTab] ?? 0;
    if (currentCount > 0) return; // Current section has matches, stay
    const firstMatch = NAV_ITEMS.find((item) => (sectionMatchCounts[item.key] ?? 0) > 0);
    if (firstMatch) setActiveTab(firstMatch.key);
  }, [sectionMatchCounts]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Returns true if a setting label matches the current search query (or if no search is active). */
  function matchesSearch(label: string): boolean {
    if (!normalizedQuery) return true;
    return label.toLowerCase().includes(normalizedQuery);
  }

  return (
    <>
    <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
      <DialogContent className="bg-bg-primary border-border-subtle text-text-primary sm:max-w-[800px] !flex !flex-col h-[80vh] overflow-hidden p-0" aria-describedby={undefined}>
        <DialogHeader className="shrink-0 px-6 pt-6">
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 min-h-0">
          {/* Sidebar navigation */}
          <div className="w-44 border-r border-border-subtle shrink-0 flex flex-col">
            {/* Search input */}
            <div className="px-3 pt-3 pb-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="w-full bg-bg-deep border border-border-subtle rounded px-2 py-1 pl-7 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent/50"
                />
                {searchQuery && (
                  <button
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary cursor-pointer"
                    onClick={() => setSearchQuery('')}
                  >
                    <XIcon className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Nav items */}
            <nav className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.key;
                const matchCount = sectionMatchCounts?.[item.key] ?? 0;
                const isHidden = sectionMatchCounts && matchCount === 0;
                if (isHidden) return null;
                return (
                  <button
                    key={item.key}
                    onClick={() => setActiveTab(item.key)}
                    className={cn(
                      'flex items-center gap-2.5 w-full text-left px-2.5 py-1.5 rounded-md text-sm transition-colors cursor-pointer',
                      isActive
                        ? 'bg-bg-hover text-text-primary border-l-2 border-accent'
                        : 'text-text-secondary hover:bg-bg-hover/50 hover:text-text-primary border-l-2 border-transparent'
                    )}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="flex-1 truncate">{item.label}</span>
                    {sectionMatchCounts && matchCount > 0 && (
                      <span className="text-[10px] bg-accent/20 text-accent px-1.5 rounded-full">{matchCount}</span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Content pane */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

            {/* ===== Appearance ===== */}
            {activeTab === 'appearance' && (
              <>
                {/* Theme Presets */}
                {matchesSearch('Theme Presets') && (
                  <div data-setting-group="Theme Presets">
                    <div className="text-[10px] uppercase tracking-wider text-text-tertiary font-medium mb-1.5">Theme Presets</div>
                    <div className="grid grid-cols-2 gap-2">
                      {(() => {
                        const appearance = (settings.appearance as Record<string, unknown>) || {};
                        const customThemes = (appearance.customThemes as ThemeDefinition[]) || [];
                        const allThemes = [...BUILTIN_THEMES, ...customThemes];
                        return allThemes.map((theme) => (
                          <motion.div
                            key={theme.id}
                            whileTap={{ scale: 0.97 }}
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              setActiveThemeId(theme.id);
                              setCustomTokenOverrides({});
                              // Clear independent toggle overrides so the new theme's defaults apply
                              updateSetting.mutate([{ key: 'appearance.activeThemeId', value: theme.id }]);
                              updateSetting.mutate([{ key: 'appearance.enableNeonTraces', value: undefined }]);
                              updateSetting.mutate([{ key: 'appearance.enableScanlines', value: undefined }]);
                              updateSetting.mutate([{ key: 'appearance.enableLogoGlow', value: undefined }]);
                            }}
                            onKeyDown={(e: React.KeyboardEvent) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setActiveThemeId(theme.id);
                                setCustomTokenOverrides({});
                                updateSetting.mutate([{ key: 'appearance.activeThemeId', value: theme.id }]);
                                updateSetting.mutate([{ key: 'appearance.enableNeonTraces', value: undefined }]);
                                updateSetting.mutate([{ key: 'appearance.enableScanlines', value: undefined }]);
                                updateSetting.mutate([{ key: 'appearance.enableLogoGlow', value: undefined }]);
                              }
                            }}
                            className={`relative text-left rounded-lg p-3 border transition-colors cursor-pointer ${
                              activeThemeId === theme.id
                                ? 'border-accent bg-bg-elevated'
                                : 'border-border-subtle bg-bg-secondary/50 hover:bg-bg-hover'
                            }`}
                          >
                            {activeThemeId === theme.id && (
                              <div className="absolute top-2 right-2">
                                <Check className="w-3.5 h-3.5 text-accent" />
                              </div>
                            )}
                            <div className="text-sm text-text-primary font-medium mb-0.5">{theme.name}</div>
                            <div className="text-xs text-text-tertiary mb-2 line-clamp-1">{theme.description}</div>
                            <div className="flex gap-1.5">
                              <div className="w-4 h-4 rounded-full border border-border-subtle" style={{ background: theme.tokens.bgDeep }} />
                              <div className="w-4 h-4 rounded-full border border-border-subtle" style={{ background: theme.tokens.accent }} />
                              <div className="w-4 h-4 rounded-full border border-border-subtle" style={{ background: theme.tokens.neonPurple }} />
                              <div className="w-4 h-4 rounded-full border border-border-subtle" style={{ background: theme.tokens.neonPink }} />
                              <div className="w-4 h-4 rounded-full border border-border-subtle" style={{ background: theme.tokens.neonCyan }} />
                            </div>
                            {!theme.builtIn && (
                              <button
                                className="absolute bottom-2 right-2 text-text-muted hover:text-red-400 transition-colors cursor-pointer"
                                title="Delete custom theme"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const updated = customThemes.filter((t: ThemeDefinition) => t.id !== theme.id);
                                  updateSetting.mutate([{ key: 'appearance.customThemes', value: updated }]);
                                  if (activeThemeId === theme.id) {
                                    setActiveThemeId('classic-amber');
                                    updateSetting.mutate([{ key: 'appearance.activeThemeId', value: 'classic-amber' }]);
                                    updateSetting.mutate([{ key: 'appearance.enableNeonTraces', value: undefined }]);
                                    updateSetting.mutate([{ key: 'appearance.enableScanlines', value: undefined }]);
                                    updateSetting.mutate([{ key: 'appearance.enableLogoGlow', value: undefined }]);
                                  }
                                  toast.success(`Deleted "${theme.name}"`);
                                }}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </motion.div>
                        ));
                      })()}
                    </div>
                  </div>
                )}

                {/* Customization */}
                {matchesSearch('Customize') && (
                  <SettingGroup label="Customize">
                    {/* Color pickers */}
                    {(() => {
                      const appearance = (settings.appearance as Record<string, unknown>) || {};
                      const customThemes = (appearance.customThemes as ThemeDefinition[]) || [];
                      const baseTheme = getThemeById(activeThemeId, customThemes) ?? THEME_CLASSIC_AMBER;
                      const currentTokens = { ...baseTheme.tokens, ...customTokenOverrides };

                      const colorFields: { key: keyof ThemeTokens; label: string }[] = [
                        { key: 'accent', label: 'Accent' },
                        { key: 'neonPurple', label: 'Neon Purple' },
                        { key: 'neonPink', label: 'Neon Pink' },
                        { key: 'neonCyan', label: 'Neon Cyan' },
                      ];

                      const hasOverrides = Object.keys(customTokenOverrides).length > 0;

                      return (
                        <>
                          <div className="grid grid-cols-2 gap-3">
                            {colorFields.map(({ key, label }) => (
                              <div key={key} className="flex items-center gap-2" data-setting-label={label}>
                                <input
                                  type="color"
                                  value={currentTokens[key] as string}
                                  onChange={(e) => {
                                    setCustomTokenOverrides((prev) => ({ ...prev, [key]: e.target.value }));
                                  }}
                                  className="w-8 h-8 rounded border border-border-subtle cursor-pointer bg-transparent"
                                />
                                <div className="text-sm text-text-primary">{label}</div>
                              </div>
                            ))}
                          </div>

                          {/* Live preview swatch */}
                          {hasOverrides && (
                            <div className="mt-2 space-y-1.5">
                              <div className="text-[10px] uppercase tracking-wider text-text-tertiary font-medium">Preview</div>
                              <div
                                className="rounded-lg p-3 border border-border-subtle overflow-hidden"
                                style={{ backgroundColor: currentTokens.bgPrimary }}
                              >
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: currentTokens.accent }} />
                                  <span className="text-xs font-medium" style={{ color: currentTokens.textPrimary }}>Sample text</span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: `${currentTokens.accent}20`, color: currentTokens.accent }}>Badge</span>
                                </div>
                                <div className="flex gap-1.5">
                                  <div className="h-1.5 flex-1 rounded-full" style={{ backgroundColor: currentTokens.accent }} />
                                  <div className="h-1.5 w-8 rounded-full" style={{ backgroundColor: currentTokens.bgTertiary }} />
                                </div>
                                {currentTokens.enableNeonTraces && (
                                  <div className="flex gap-1 mt-2">
                                    <div className="h-1 w-6 rounded-full" style={{ backgroundColor: currentTokens.neonPurple, opacity: 0.6 }} />
                                    <div className="h-1 w-4 rounded-full" style={{ backgroundColor: currentTokens.neonPink, opacity: 0.6 }} />
                                    <div className="h-1 w-5 rounded-full" style={{ backgroundColor: currentTokens.neonCyan, opacity: 0.6 }} />
                                  </div>
                                )}
                              </div>
                              <p className="text-[10px] text-text-muted">Save as custom theme to apply color changes</p>
                            </div>
                          )}

                          {/* Feature toggles — saved independently, apply in real time */}
                          <div className="border-t border-border-subtle pt-3 mt-3 space-y-3">
                            <p className="text-[10px] text-text-muted -mb-1">Toggles apply instantly to any theme</p>
                            <SettingToggle
                              label="Neon Traces"
                              description="Synthwave glow effects on scrollbars and selections"
                              value={!!((settings.appearance as Record<string, unknown>)?.enableNeonTraces ?? currentTokens.enableNeonTraces)}
                              onChange={(v) => updateSetting.mutate([{ key: 'appearance.enableNeonTraces', value: v }])}
                            />
                            <SettingToggle
                              label="CRT Scanlines"
                              description="Subtle scanline overlay for retro feel"
                              value={!!((settings.appearance as Record<string, unknown>)?.enableScanlines ?? currentTokens.enableScanlines)}
                              onChange={(v) => updateSetting.mutate([{ key: 'appearance.enableScanlines', value: v }])}
                            />
                            <SettingToggle
                              label="Logo Glow"
                              description="Ambient glow effect on sidebar logo"
                              value={!!((settings.appearance as Record<string, unknown>)?.enableLogoGlow ?? currentTokens.enableLogoGlow)}
                              onChange={(v) => updateSetting.mutate([{ key: 'appearance.enableLogoGlow', value: v }])}
                            />
                          </div>
                        </>
                      );
                    })()}
                  </SettingGroup>
                )}

                {/* Action buttons */}
                <div className="flex gap-2 flex-wrap">
                  {showSaveThemeInput ? (
                    <div className="flex gap-2 items-center flex-1">
                      <Input
                        value={customThemeName}
                        onChange={(e) => setCustomThemeName(e.target.value)}
                        placeholder="Theme name"
                        className="bg-bg-deep border-border-subtle text-sm flex-1"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            setShowSaveThemeInput(false);
                            setCustomThemeName('');
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        className="bg-accent text-bg-deep hover:bg-accent/80 cursor-pointer shrink-0"
                        disabled={!customThemeName.trim()}
                        onClick={() => {
                          const appearance = (settings.appearance as Record<string, unknown>) || {};
                          const customThemes = (appearance.customThemes as ThemeDefinition[]) || [];
                          const base = getThemeById(activeThemeId, customThemes) ?? THEME_CLASSIC_AMBER;
                          const newTheme: ThemeDefinition = {
                            id: `custom-${Date.now()}`,
                            name: customThemeName.trim(),
                            description: 'Custom theme',
                            tokens: { ...base.tokens, ...customTokenOverrides } as ThemeTokens,
                            builtIn: false,
                            createdAt: new Date().toISOString(),
                          };
                          const updated = [...customThemes, newTheme];
                          updateSetting.mutate([{ key: 'appearance.customThemes', value: updated }]);
                          updateSetting.mutate([{ key: 'appearance.activeThemeId', value: newTheme.id }]);
                          setActiveThemeId(newTheme.id);
                          setCustomTokenOverrides({});
                          setShowSaveThemeInput(false);
                          setCustomThemeName('');
                          toast.success(`Saved theme "${newTheme.name}"`);
                        }}
                      >
                        <Save className="h-3.5 w-3.5 mr-1" />
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="cursor-pointer shrink-0"
                        onClick={() => {
                          setShowSaveThemeInput(false);
                          setCustomThemeName('');
                        }}
                      >
                        <XIcon className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        className={cn(
                          'cursor-pointer',
                          Object.keys(customTokenOverrides).length > 0
                            ? 'bg-accent text-bg-deep hover:bg-accent/80'
                            : 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover',
                        )}
                        onClick={() => setShowSaveThemeInput(true)}
                      >
                        <Save className="h-3.5 w-3.5 mr-1" />
                        Save as Custom Theme
                      </Button>
                      {Object.keys(customTokenOverrides).length > 0 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="cursor-pointer"
                          onClick={() => {
                            setCustomTokenOverrides({});
                            toast.info('Reset to preset defaults');
                          }}
                        >
                          <RotateCcw className="h-3.5 w-3.5 mr-1" />
                          Reset
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </>
            )}

            {/* ===== General ===== */}
            {activeTab === 'general' && (
              <>
                {/* Startup group */}
                {(matchesSearch('Open terminal on startup') || matchesSearch('Reuse idle terminal for agent') || matchesSearch('Show hidden files (.dotfiles)') || matchesSearch('Startup')) && (
                  <SettingGroup label="Startup">
                    {matchesSearch('Open terminal on startup') && (
                      <SettingToggle
                        label="Open terminal on startup"
                        description="Automatically create a terminal when SubFrame launches"
                        value={autoCreateTerminal}
                        onChange={(v) => saveToggle('general.autoCreateTerminal', v)}
                      />
                    )}
                    {matchesSearch('Reuse idle terminal for agent') && (
                      <SettingToggle
                        label="Reuse idle terminal for agent"
                        description="Start agent in the active terminal if no agent is running, instead of creating a new one"
                        value={reuseIdleTerminal}
                        onChange={(v) => saveToggle('general.reuseIdleTerminal', v)}
                      />
                    )}
                    {matchesSearch('Show hidden files (.dotfiles)') && (
                      <SettingToggle
                        label="Show hidden files (.dotfiles)"
                        description="Show files starting with a dot in the file tree"
                        value={showDotfiles}
                        onChange={(v) => saveToggle('general.showDotfiles', v)}
                      />
                    )}
                  </SettingGroup>
                )}

                {/* Behavior group */}
                {(matchesSearch('Confirm before closing') || matchesSearch('Auto-poll usage') || matchesSearch('Grid overflow auto-switch') || matchesSearch('Highlight user messages') || matchesSearch('Behavior')) && (
                  <SettingGroup label="Behavior">
                    {matchesSearch('Confirm before closing') && (
                      <SettingToggle
                        label="Confirm before closing"
                        description="Show a confirmation dialog before closing the window"
                        value={confirmBeforeClose}
                        onChange={(v) => saveToggle('general.confirmBeforeClose', v)}
                      />
                    )}

                    {matchesSearch('Auto-poll usage') && (
                      <div data-setting-label="Auto-poll usage">
                        <SettingToggle
                          label="Auto-poll usage"
                          description="Periodically check Claude API usage. Off = on-demand only (click to refresh)."
                          value={usagePollingInterval > 0}
                          onChange={() => {
                            updateSetting.mutate([{ key: 'general.usagePollingInterval', value: usagePollingInterval === 0 ? 300 : 0 }]);
                          }}
                        />
                        {usagePollingInterval > 0 && (
                          <div className="mt-2">
                            <SettingSlider
                              label=""
                              value={usagePollingInterval}
                              onChange={(v) => updateSetting.mutate([{ key: 'general.usagePollingInterval', value: v }])}
                              min={30}
                              max={600}
                              step={30}
                              formatValue={(v) =>
                                v >= 60
                                  ? `${Math.floor(v / 60)}m${v % 60 ? ` ${v % 60}s` : ''}`
                                  : `${v}s`
                              }
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {matchesSearch('Grid overflow auto-switch') && (
                      <SettingToggle
                        label="Grid overflow auto-switch"
                        description="Auto-switch to single view when selecting a terminal outside the grid, and back when selecting one inside"
                        value={gridOverflowAutoSwitch}
                        onChange={(v) => saveToggle('general.gridOverflowAutoSwitch', v)}
                      />
                    )}

                    {matchesSearch('Highlight user messages') && (
                      <SettingToggle
                        label="Highlight user messages"
                        description="Mark your messages in agent sessions with a left border and enable scroll-to-last-message navigation"
                        value={highlightUserMessages}
                        onChange={(v) => saveToggle('general.highlightUserMessages', v)}
                        extra={highlightUserMessages ? (
                          <input
                            type="color"
                            value={userMessageColor}
                            onChange={(e) => updateSetting.mutate([{ key: 'general.userMessageColor', value: e.target.value }])}
                            className="w-7 h-5 rounded cursor-pointer border border-border-subtle bg-transparent"
                            title="Message border color"
                          />
                        ) : undefined}
                      />
                    )}
                  </SettingGroup>
                )}

                {/* Paths group */}
                {(matchesSearch('Default Project Directory') || matchesSearch('Paths')) && (
                  <SettingGroup label="Paths">
                    <SettingInput
                      label="Default Project Directory"
                      description="Subdirectories appear automatically in the project list"
                      value={defaultProjectDir}
                      onChange={() => {}}
                      readOnly
                      placeholder="No directory selected"
                      extra={
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="cursor-pointer shrink-0"
                            title="Browse for directory"
                            onClick={async () => {
                              const selected = await typedInvoke(IPC.SELECT_DEFAULT_PROJECT_DIR);
                              if (selected) {
                                updateSetting.mutate([{ key: 'general.defaultProjectDir', value: selected }]);
                                toast.success('Default project directory set');
                              }
                            }}
                          >
                            <FolderOpen className="h-4 w-4" />
                          </Button>
                          {defaultProjectDir && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="cursor-pointer shrink-0"
                              title="Clear directory"
                              onClick={() => {
                                updateSetting.mutate([{ key: 'general.defaultProjectDir', value: '' }]);
                                toast.info('Default project directory cleared');
                              }}
                            >
                              <XIcon className="h-4 w-4" />
                            </Button>
                          )}
                        </>
                      }
                    />
                    {defaultProjectDir && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="cursor-pointer mt-2 text-xs"
                        disabled={scanning}
                        onClick={async () => {
                          setScanning(true);
                          try {
                            toast.info('Scanning directory...');
                            await typedInvoke(IPC.SCAN_PROJECT_DIR, defaultProjectDir);
                            toast.success('Scan complete');
                          } catch {
                            toast.error('Failed to scan directory');
                          } finally {
                            setScanning(false);
                          }
                        }}
                      >
                        {scanning ? <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <FolderSearch className="h-3.5 w-3.5 mr-1.5" />}
                        Scan Now
                      </Button>
                    )}
                  </SettingGroup>
                )}

                {/* Git group */}
                {(matchesSearch('Auto-fetch') || matchesSearch('Git')) && (
                  <SettingGroup label="Git">
                    {matchesSearch('Auto-fetch') && (
                      <SettingSelect
                        label="Auto-fetch"
                        description="Periodically run git fetch in the background to keep remote refs up to date"
                        value={localStorage.getItem('git-auto-fetch-interval') || '0'}
                        onChange={(v) => {
                          localStorage.setItem('git-auto-fetch-interval', v);
                          toast.success(v === '0' ? 'Auto-fetch disabled' : `Auto-fetch set to every ${v === '180' ? '3' : v === '300' ? '5' : v === '600' ? '10' : '15'} minutes`);
                        }}
                        options={[
                          { value: '0', label: 'Off' },
                          { value: '180', label: 'Every 3 minutes' },
                          { value: '300', label: 'Every 5 minutes' },
                          { value: '600', label: 'Every 10 minutes' },
                          { value: '900', label: 'Every 15 minutes' },
                        ]}
                      />
                    )}
                  </SettingGroup>
                )}

                {/* CLI group */}
                {(matchesSearch('Install CLI') || matchesSearch('CLI')) && (
                  <SettingGroup label="CLI">
                    <div data-setting-label="Install CLI">
                      <div className="text-sm text-text-primary mb-1">SubFrame CLI</div>
                      <div className="text-xs text-text-tertiary mb-2">
                        Install the <code className="text-accent">subframe</code> command to open files and projects from your terminal.
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs"
                        disabled={cliInstalling || cliUninstalling}
                        onClick={async () => {
                          setCliInstalling(true);
                          try {
                            const result = await typedInvoke(IPC.INSTALL_CLI);
                            if (result.success) {
                              toast.success(result.message);
                              refreshCliStatus();
                            } else {
                              toast.error(result.message);
                            }
                          } catch {
                            toast.error('Failed to install CLI');
                          } finally {
                            setCliInstalling(false);
                          }
                        }}
                      >
                        {cliInstalling && <RefreshCw className="w-3 h-3 mr-1 animate-spin" />}
                        Install CLI to PATH
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs text-text-muted hover:text-error ml-2"
                        disabled={cliInstalling || cliUninstalling}
                        onClick={async () => {
                          setCliUninstalling(true);
                          try {
                            const result = await typedInvoke(IPC.UNINSTALL_CLI);
                            if (result.success) {
                              toast.success(result.message);
                              refreshCliStatus();
                            } else {
                              toast.error(result.message);
                            }
                          } catch {
                            toast.error('Failed to uninstall CLI');
                          } finally {
                            setCliUninstalling(false);
                          }
                        }}
                      >
                        {cliUninstalling && <RefreshCw className="w-3 h-3 mr-1 animate-spin" />}
                        Uninstall
                      </Button>
                    </div>
                  </SettingGroup>
                )}
              </>
            )}

            {/* ===== Terminal ===== */}
            {activeTab === 'terminal' && (
              <>
                {/* Font group */}
                {(matchesSearch('Font Size') || matchesSearch('Font Family') || matchesSearch('Font') || matchesSearch('Nerd Font')) && (
                  <SettingGroup label="Font">
                    {matchesSearch('Font Size') && (
                      <SettingSlider
                        label="Font Size"
                        value={fontSize}
                        onChange={setFontSize}
                        min={10}
                        max={24}
                        step={1}
                        formatValue={(v) => `${v}px`}
                      />
                    )}
                    {(matchesSearch('Font Family') || matchesSearch('Nerd Font')) && (
                      <div data-setting-label="Font Family">
                        <SettingInput
                          label="Font Family"
                          value={fontFamily}
                          onChange={setFontFamily}
                        />
                        {nerdFontDetected ? (
                          <p className="text-xs text-success mt-1 flex items-center gap-1">
                            <Check className="w-3 h-3" /> Nerd Font detected: {nerdFontDetected}
                          </p>
                        ) : (
                          <p className="text-xs text-text-tertiary mt-1">
                            For Oh My Posh / Starship icons, install a{' '}
                            <a
                              href="https://www.nerdfonts.com/font-downloads"
                              target="_blank"
                              rel="noreferrer"
                              className="text-accent hover:underline"
                            >
                              Nerd Font
                            </a>
                            {' '}(e.g. JetBrainsMono Nerd Font)
                          </p>
                        )}
                      </div>
                    )}
                  </SettingGroup>
                )}

                {/* Display group */}
                {(matchesSearch('Line Height') || matchesSearch('Scrollback Lines') || matchesSearch('Cursor Style') || matchesSearch('Cursor Blink') || matchesSearch('Display')) && (
                  <SettingGroup label="Display">
                    {matchesSearch('Line Height') && (
                      <SettingInput
                        label="Line Height"
                        value={lineHeight}
                        onChange={(v) => setLineHeight(Number(v))}
                        type="number"
                        min={1.0}
                        max={2.0}
                        step={0.1}
                      />
                    )}
                    {matchesSearch('Scrollback Lines') && (
                      <SettingInput
                        label="Scrollback Lines"
                        value={scrollback}
                        onChange={(v) => setScrollback(Number(v))}
                        type="number"
                        min={1000}
                        max={100000}
                        step={1000}
                      />
                    )}
                    {matchesSearch('Cursor Style') && (
                      <SettingSelect
                        label="Cursor Style"
                        value={cursorStyle}
                        onChange={setCursorStyle}
                        options={[
                          { value: 'block', label: 'Block' },
                          { value: 'underline', label: 'Underline' },
                          { value: 'bar', label: 'Bar' },
                        ]}
                      />
                    )}
                    {matchesSearch('Cursor Blink') && (
                      <SettingToggle
                        label="Cursor Blink"
                        description="Enable blinking cursor in the terminal"
                        value={cursorBlink}
                        onChange={setCursorBlink}
                      />
                    )}
                  </SettingGroup>
                )}

                {/* Behavior group */}
                {(matchesSearch('Default Shell') || matchesSearch('Bell Sound') || matchesSearch('Copy on Select') || matchesSearch('Max Terminals') || matchesSearch('Behavior')) && (
                  <SettingGroup label="Behavior">
                    {matchesSearch('Default Shell') && availableShells.length > 0 && (
                      <SettingSelect
                        label="Default Shell"
                        description="Shell used for new terminals"
                        value={defaultShell}
                        onChange={(v) => setDefaultShell(v)}
                        options={[
                          { value: '', label: 'System Default' },
                          ...availableShells.map((s) => ({
                            value: s.path,
                            label: `${s.name}${s.isDefault ? ' (default)' : ''}`,
                          })),
                        ]}
                      />
                    )}
                    {matchesSearch('Default Shell') && availableShells.length === 0 && (
                      <SettingInput
                        label="Default Shell"
                        description="Leave empty for system default"
                        value={defaultShell}
                        onChange={setDefaultShell}
                        placeholder="System default"
                      />
                    )}
                    {matchesSearch('Bell Sound') && (
                      <SettingToggle
                        label="Bell Sound"
                        description="Play a sound on terminal bell"
                        value={bellSound}
                        onChange={setBellSound}
                      />
                    )}
                    {matchesSearch('Copy on Select') && (
                      <SettingToggle
                        label="Copy on Select"
                        description="Automatically copy selected text to clipboard"
                        value={copyOnSelect}
                        onChange={setCopyOnSelect}
                      />
                    )}
                    {matchesSearch('Max Terminals') && (
                      <SettingSlider
                        label="Max Terminals"
                        description="Maximum number of terminal instances allowed (global, across all projects)"
                        value={maxTerminals}
                        onChange={setMaxTerminals}
                        min={1}
                        max={20}
                        step={1}
                      />
                    )}
                  </SettingGroup>
                )}

                <Button size="sm" onClick={saveTerminal} className="bg-accent text-bg-deep hover:bg-accent/80 cursor-pointer">
                  Save
                </Button>
              </>
            )}

            {/* ===== Editor ===== */}
            {activeTab === 'editor' && (
              <>
                {/* Font group */}
                {(matchesSearch('Font Size') || matchesSearch('Font Family') || matchesSearch('Tab Size') || matchesSearch('Font')) && (
                  <SettingGroup label="Font">
                    {matchesSearch('Font Size') && (
                      <SettingSlider
                        label="Font Size"
                        value={editorFontSize}
                        onChange={setEditorFontSize}
                        min={8}
                        max={24}
                        step={1}
                        formatValue={(v) => `${v}px`}
                      />
                    )}
                    {matchesSearch('Font Family') && (
                      <SettingInput
                        label="Font Family"
                        value={editorFontFamily}
                        onChange={setEditorFontFamily}
                      />
                    )}
                    {matchesSearch('Tab Size') && (
                      <SettingSelect
                        label="Tab Size"
                        value={String(editorTabSize)}
                        onChange={(v) => setEditorTabSize(Number(v))}
                        options={[
                          { value: '2', label: '2 spaces' },
                          { value: '4', label: '4 spaces' },
                        ]}
                      />
                    )}
                  </SettingGroup>
                )}

                {/* Display group */}
                {(matchesSearch('Theme') || matchesSearch('Word Wrap') || matchesSearch('Minimap') || matchesSearch('Line Numbers') || matchesSearch('Bracket Matching') || matchesSearch('Display')) && (
                  <SettingGroup label="Display">
                    {matchesSearch('Theme') && (
                      <SettingSelect
                        label="Theme"
                        value={editorTheme}
                        onChange={setEditorTheme}
                        options={Object.values(EDITOR_THEMES).map((theme) => ({
                          value: theme.id,
                          label: theme.label,
                        }))}
                      />
                    )}
                    {matchesSearch('Word Wrap') && (
                      <SettingToggle
                        label="Word Wrap"
                        description="Wrap long lines in the editor"
                        value={editorWordWrap}
                        onChange={setEditorWordWrap}
                      />
                    )}
                    {matchesSearch('Minimap') && (
                      <SettingToggle
                        label="Minimap"
                        description="Show a minimap overview of the file"
                        value={editorMinimap}
                        onChange={setEditorMinimap}
                      />
                    )}
                    {matchesSearch('Line Numbers') && (
                      <SettingToggle
                        label="Line Numbers"
                        description="Show line numbers in the gutter"
                        value={editorLineNumbers}
                        onChange={setEditorLineNumbers}
                      />
                    )}
                    {matchesSearch('Bracket Matching') && (
                      <SettingToggle
                        label="Bracket Matching"
                        description="Highlight matching brackets"
                        value={editorBracketMatching}
                        onChange={setEditorBracketMatching}
                      />
                    )}
                  </SettingGroup>
                )}

                <Button size="sm" onClick={saveEditor} className="bg-accent text-bg-deep hover:bg-accent/80 cursor-pointer">
                  Save
                </Button>
              </>
            )}

            {/* ===== AI Tool ===== */}
            {activeTab === 'ai-tool' && (
              <>
                {matchesSearch('Active Tool') && (
                  <div data-setting-label="Active Tool">
                    <div className="text-sm text-text-primary mb-1">Active Tool</div>
                    <select
                      value={aiToolConfig?.activeTool.id || 'claude'}
                      onChange={async (e) => {
                        try {
                          await setAITool.mutateAsync([e.target.value]);
                          toast.success('Active tool updated');
                        } catch {
                          toast.error('Failed to update active tool');
                        }
                      }}
                      className="w-full bg-bg-deep border border-border-subtle rounded px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 cursor-pointer"
                    >
                      {aiToolConfig && Object.values(aiToolConfig.availableTools).map((tool) => (
                        <option key={tool.id} value={tool.id}>
                          {tool.name}{tool.installed === false ? ' (not installed)' : ''}
                        </option>
                      ))}
                    </select>
                    <div className="text-xs text-text-tertiary mt-1 flex items-center gap-1.5">
                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${aiToolConfig?.activeTool.installed === false ? 'bg-error' : 'bg-success'}`} />
                      {aiToolConfig?.activeTool.installed === false
                        ? <span className="text-error">
                            Not installed
                            {aiToolConfig.activeTool.installUrl && (
                              <> — <a
                                href="#"
                                className="underline hover:text-accent"
                                onClick={(e) => { e.preventDefault(); getTransport().platform.openExternal(aiToolConfig.activeTool.installUrl!); }}
                              >view install guide</a></>
                            )}
                          </span>
                        : <span>{aiToolConfig?.activeTool.description || ''}</span>
                      }
                      <button
                        onClick={async () => {
                          setRecheckingTools(true);
                          try {
                            await typedInvoke(IPC.RECHECK_AI_TOOLS);
                            await refetchAITools();
                            toast.success('Install status refreshed');
                          } catch {
                            toast.error('Failed to check tools');
                          } finally {
                            setRecheckingTools(false);
                          }
                        }}
                        disabled={recheckingTools}
                        className="ml-auto text-text-muted hover:text-text-primary transition-colors disabled:opacity-50 cursor-pointer"
                        title="Recheck install status"
                      >
                        <RefreshCw className={`w-3 h-3 ${recheckingTools ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  </div>
                )}

                {matchesSearch('Start Command') && (
                  <div data-setting-label="Start Command">
                    <SettingInput
                      label="Start Command"
                      value={aiCommand}
                      onChange={setAiCommand}
                      placeholder={aiToolConfig?.activeTool.command || 'claude'}
                    />
                    <div className="text-xs text-text-tertiary mt-1">
                      Default: <code className="text-text-secondary">{aiToolConfig?.activeTool.command || 'claude'}</code>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" onClick={saveAiCommand} className="bg-accent text-bg-deep hover:bg-accent/80 cursor-pointer">
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const defaultCmd = aiToolConfig?.activeTool.command || 'claude';
                          setAiCommand(defaultCmd);
                          if (aiToolConfig) {
                            updateSetting.mutate([{ key: `aiTools.${aiToolConfig.activeTool.id}.customCommand`, value: '' }]);
                          }
                          toast.info('Reset to default command');
                        }}
                        className="cursor-pointer"
                      >
                        Reset to Default
                      </Button>
                    </div>
                  </div>
                )}

                {/* Custom Tools */}
                {matchesSearch('Custom Tools') && (
                  <div className="border-t border-border-subtle pt-4 mt-4" data-setting-label="Custom Tools">
                    <div className="text-sm text-text-primary mb-2">Custom Tools</div>
                    <div className="text-xs text-text-tertiary mb-3">
                      Add custom AI tools that appear in the sidebar and session dropdowns
                    </div>

                    {/* Existing custom tools list */}
                    {aiToolConfig && (() => {
                      const customTools = Object.values(aiToolConfig.availableTools).filter(
                        (t) => !BUILTIN_TOOL_IDS.has(t.id)
                      );
                      if (customTools.length === 0) return (
                        <div className="text-xs text-text-muted mb-3">No custom tools added yet</div>
                      );
                      return (
                        <div className="space-y-1.5 mb-3">
                          {customTools.map((tool) => (
                            <div
                              key={tool.id}
                              className="flex items-center justify-between bg-bg-deep rounded-md px-2.5 py-1.5 border border-border-subtle"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="text-sm text-text-primary truncate">{tool.name}</div>
                                <div className="text-xs text-text-tertiary truncate">
                                  <code>{tool.command}</code>
                                  {tool.description && ` — ${tool.description}`}
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="cursor-pointer shrink-0 ml-2 text-text-muted hover:text-red-400"
                                title={`Remove ${tool.name}`}
                                onClick={() => {
                                  removeCustomTool.mutate([tool.id]);
                                  toast.success(`Removed ${tool.name}`);
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      );
                    })()}

                    {/* Add custom tool form */}
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Input
                          value={newToolName}
                          onChange={(e) => setNewToolName(e.target.value)}
                          placeholder="Name (e.g. Aider)"
                          className="bg-bg-deep border-border-subtle text-sm flex-1"
                        />
                        <Input
                          value={newToolCommand}
                          onChange={(e) => setNewToolCommand(e.target.value)}
                          placeholder="Command (e.g. aider)"
                          className="bg-bg-deep border-border-subtle text-sm flex-1"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={newToolDescription}
                          onChange={(e) => setNewToolDescription(e.target.value)}
                          placeholder="Description (optional)"
                          className="bg-bg-deep border-border-subtle text-sm flex-1"
                        />
                        <Button
                          size="sm"
                          className="bg-accent text-bg-deep hover:bg-accent/80 cursor-pointer shrink-0"
                          disabled={!newToolName.trim() || !newToolCommand.trim()}
                          onClick={() => {
                            const id = newToolName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
                            addCustomTool.mutate([{
                              id,
                              name: newToolName.trim(),
                              command: newToolCommand.trim(),
                              description: newToolDescription.trim() || undefined,
                            }]);
                            setNewToolName('');
                            setNewToolCommand('');
                            setNewToolDescription('');
                            toast.success(`Added ${newToolName.trim()}`);
                          }}
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" />
                          Add
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ===== Hooks ===== */}
            {activeTab === 'hooks' && (
              <>
                {/* Header */}
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <div className="text-sm text-text-primary font-medium">Claude Code Hooks</div>
                    <div className="text-xs text-text-tertiary">
                      Manage hook scripts that run on Claude Code events.
                      {totalHookCount > 0 && <span className="text-accent ml-1">{totalHookCount} hook{totalHookCount !== 1 ? 's' : ''} configured</span>}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="bg-accent text-bg-deep hover:bg-accent/80 cursor-pointer"
                    onClick={openAddHookDialog}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add Hook
                  </Button>
                </div>

                {!currentProjectPath && (
                  <div className="text-xs text-warning bg-warning/10 border border-warning/20 rounded-md p-3">
                    Select a project to manage hooks. Hooks are stored in each project's <code className="text-accent">.claude/settings.json</code>.
                  </div>
                )}

                {currentProjectPath && hooksLoading && (
                  <div className="flex items-center gap-2 py-8 justify-center text-text-muted">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Loading hooks...</span>
                  </div>
                )}

                {/* Event Type Groups */}
                {currentProjectPath && !hooksLoading && (
                  <div className="space-y-2">
                    {HOOK_EVENT_TYPES.map(({ key: eventKey, label, description, icon: EventIcon }) => {
                      const entries = hooksConfig[eventKey] || [];
                      const isExpanded = expandedEvents.has(eventKey);

                      return (
                        <div key={eventKey} className="rounded-lg border border-border-subtle bg-bg-secondary/50 overflow-hidden">
                          {/* Event header — collapsible */}
                          <button
                            onClick={() => toggleEventExpanded(eventKey)}
                            className="flex items-center gap-2.5 w-full text-left px-3 py-2 hover:bg-bg-hover/50 transition-colors cursor-pointer"
                          >
                            {isExpanded
                              ? <ChevronDown className="w-3.5 h-3.5 text-text-muted shrink-0" />
                              : <ChevronRight className="w-3.5 h-3.5 text-text-muted shrink-0" />
                            }
                            <EventIcon className="w-3.5 h-3.5 text-text-tertiary shrink-0" />
                            <span className="text-sm text-text-primary font-medium flex-1">{label}</span>
                            <span className="text-[10px] text-text-tertiary">{description}</span>
                            {entries.length > 0 && (
                              <span className="text-[10px] bg-accent/20 text-accent px-1.5 py-0.5 rounded-full ml-1">
                                {entries.length}
                              </span>
                            )}
                          </button>

                          {/* Expanded content */}
                          {isExpanded && (
                            <div className="border-t border-border-subtle">
                              {entries.length === 0 ? (
                                <div className="px-3 py-3 text-xs text-text-muted text-center">
                                  No hooks configured for this event
                                </div>
                              ) : (
                                <div className="divide-y divide-border-subtle">
                                  {entries.map((entry, entryIndex) => {
                                    const isDisabled = disabledHooks.has(`${eventKey}:${entryIndex}`);
                                    return (
                                      <div
                                        key={entryIndex}
                                        className={cn(
                                          'px-3 py-2 flex items-start gap-2.5 group',
                                          isDisabled && 'opacity-40',
                                        )}
                                      >
                                        {/* Matcher badge */}
                                        <div className="shrink-0 mt-0.5">
                                          <span className="inline-flex items-center text-[10px] font-mono bg-bg-deep border border-border-subtle text-text-secondary px-1.5 py-0.5 rounded">
                                            {entry.matcher || '*'}
                                          </span>
                                        </div>

                                        {/* Command(s) */}
                                        <div className="flex-1 min-w-0">
                                          {entry.hooks.map((hook, hookIdx) => (
                                            <div key={hookIdx} className="text-xs text-text-primary font-mono truncate" title={hook.command}>
                                              {hook.command}
                                            </div>
                                          ))}
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                          {/* Edit */}
                                          <button
                                            onClick={() => openEditHookDialog(eventKey, entryIndex)}
                                            className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer"
                                            title="Edit hook"
                                          >
                                            <Pencil className="w-3 h-3" />
                                          </button>
                                          {/* Delete */}
                                          <button
                                            onClick={() => {
                                              if (confirm('Delete this hook entry?')) {
                                                deleteHookEntry(eventKey, entryIndex);
                                              }
                                            }}
                                            className="p-1 rounded text-text-muted hover:text-red-400 hover:bg-bg-hover transition-colors cursor-pointer"
                                            title="Delete hook"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Quick add for this event type */}
                              <div className="px-3 py-1.5 border-t border-border-subtle">
                                <button
                                  onClick={() => {
                                    resetHookForm();
                                    setHookFormEvent(eventKey);
                                    setShowAddHookDialog(true);
                                  }}
                                  className="text-[11px] text-text-muted hover:text-accent transition-colors cursor-pointer"
                                >
                                  + Add hook to {label}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Quick Templates */}
                {currentProjectPath && !hooksLoading && (matchesSearch('Templates') || matchesSearch('Block .env writes') || matchesSearch('Log all commands') || matchesSearch('Auto-approve reads') || matchesSearch('Notify on completion')) && (
                  <div className="mt-4">
                    <div className="text-[10px] uppercase tracking-wider text-text-tertiary font-medium mb-1.5">Quick Templates</div>
                    <div className="grid grid-cols-2 gap-2">
                      {HOOK_TEMPLATES.map((template) => (
                        <button
                          key={template.name}
                          onClick={() => applyTemplate(template)}
                          className="text-left rounded-md border border-border-subtle bg-bg-secondary/30 p-3 hover:bg-bg-hover/30 cursor-pointer transition-colors group"
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            <FileCode className="w-3 h-3 text-text-tertiary group-hover:text-accent transition-colors" />
                            <span className="text-xs text-text-primary font-medium">{template.name}</span>
                          </div>
                          <div className="text-[10px] text-text-tertiary">{template.description}</div>
                          <div className="flex items-center gap-1 mt-1.5">
                            <span className="text-[9px] font-mono bg-bg-deep border border-border-subtle px-1 py-0.5 rounded text-text-muted">
                              {template.eventType}
                            </span>
                            {template.matcher && (
                              <span className="text-[9px] font-mono bg-bg-deep border border-border-subtle px-1 py-0.5 rounded text-text-muted">
                                {template.matcher}
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reload button */}
                {currentProjectPath && !hooksLoading && (
                  <div className="flex items-center gap-2 mt-3">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs cursor-pointer"
                      onClick={loadHooks}
                    >
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                      Reload from disk
                    </Button>
                    <span className="text-[10px] text-text-muted">
                      {claudeSettingsPath && <>Source: <code className="text-text-tertiary">.claude/settings.json</code></>}
                    </span>
                  </div>
                )}

                {/* ===== Add/Edit Hook Dialog ===== */}
                {showAddHookDialog && (
                  <Dialog open={showAddHookDialog} onOpenChange={(open) => { if (!open) { setShowAddHookDialog(false); resetHookForm(); } }}>
                    <DialogContent className="bg-bg-primary border-border-subtle text-text-primary sm:max-w-[520px] p-0" aria-describedby={undefined}>
                      <DialogHeader className="px-5 pt-5 pb-0">
                        <DialogTitle>{editingHook ? 'Edit Hook' : 'Add Hook'}</DialogTitle>
                      </DialogHeader>

                      <div className="px-5 pb-5 space-y-4 mt-2">
                        {/* Event Type */}
                        <div>
                          <div className="text-sm text-text-primary mb-1">Event Type</div>
                          <select
                            value={hookFormEvent}
                            onChange={(e) => setHookFormEvent(e.target.value)}
                            disabled={!!editingHook}
                            className="w-full bg-bg-deep border border-border-subtle rounded px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 cursor-pointer disabled:opacity-50"
                          >
                            {HOOK_EVENT_TYPES.map(({ key, label: lbl }) => (
                              <option key={key} value={key}>{lbl} ({key})</option>
                            ))}
                          </select>
                        </div>

                        {/* Matcher */}
                        <div>
                          <div className="text-sm text-text-primary mb-1">Matcher</div>
                          <div className="text-xs text-text-tertiary mb-1">
                            Tool name pattern to match (e.g., "Bash", "Write", "*" for all). Leave empty for events without tools.
                          </div>
                          <Input
                            value={hookFormMatcher}
                            onChange={(e) => setHookFormMatcher(e.target.value)}
                            placeholder={hookFormEvent === 'PreToolUse' || hookFormEvent === 'PostToolUse' ? 'e.g., Bash, Write, *' : 'Leave empty'}
                            className="bg-bg-deep border-border-subtle text-sm"
                          />
                          {/* Matcher suggestions */}
                          {(MATCHER_SUGGESTIONS[hookFormEvent] || []).length > 0 && (
                            <div className="flex gap-1 mt-1.5 flex-wrap">
                              {MATCHER_SUGGESTIONS[hookFormEvent].filter(Boolean).map((s) => (
                                <button
                                  key={s}
                                  onClick={() => setHookFormMatcher(s)}
                                  className={cn(
                                    'text-[10px] font-mono px-1.5 py-0.5 rounded border cursor-pointer transition-colors',
                                    hookFormMatcher === s
                                      ? 'bg-accent/20 border-accent/40 text-accent'
                                      : 'bg-bg-deep border-border-subtle text-text-muted hover:text-text-secondary hover:border-border-default',
                                  )}
                                >
                                  {s}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Command */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <div className="text-sm text-text-primary">Command</div>
                            <button
                              onClick={() => setShowAIGenerate(!showAIGenerate)}
                              className="flex items-center gap-1 text-[11px] text-accent hover:text-accent/80 transition-colors cursor-pointer"
                            >
                              <Wand2 className="w-3 h-3" />
                              {showAIGenerate ? 'Manual' : 'Generate with AI'}
                            </button>
                          </div>

                          {!showAIGenerate ? (
                            <>
                              <Input
                                value={hookFormCommand}
                                onChange={(e) => setHookFormCommand(e.target.value)}
                                placeholder="node .claude/hooks/my-hook.js"
                                className="bg-bg-deep border-border-subtle text-sm font-mono"
                              />
                              <div className="text-[10px] text-text-muted mt-1">
                                Point to a .js file that will be executed when this event fires.
                                Hook receives JSON on stdin with tool_name, tool_input, etc.
                              </div>
                            </>
                          ) : (
                            <>
                              <textarea
                                value={aiGeneratePrompt}
                                onChange={(e) => setAiGeneratePrompt(e.target.value)}
                                placeholder="Describe what you want the hook to do..."
                                rows={3}
                                className="w-full bg-bg-deep border border-border-subtle rounded px-2 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none"
                              />
                              <div className="text-[10px] text-text-muted mt-1 space-y-0.5">
                                <div>Examples:</div>
                                <div className="text-text-tertiary">"Block writes to .env files"</div>
                                <div className="text-text-tertiary">"Log all Bash commands to a file"</div>
                                <div className="text-text-tertiary">"Auto-approve read-only tools"</div>
                              </div>
                              <Button
                                size="sm"
                                className="mt-2 bg-accent text-bg-deep hover:bg-accent/80 cursor-pointer"
                                disabled={!aiGeneratePrompt.trim() || !activeTerminalId}
                                onClick={handleAIGenerate}
                              >
                                <Wand2 className="h-3.5 w-3.5 mr-1" />
                                Send to Agent
                              </Button>
                              {!activeTerminalId && (
                                <div className="text-[10px] text-warning mt-1">No active terminal. Open a terminal first.</div>
                              )}
                            </>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-2 border-t border-border-subtle">
                          {!showAIGenerate && (
                            <Button
                              size="sm"
                              className="bg-accent text-bg-deep hover:bg-accent/80 cursor-pointer"
                              disabled={!hookFormCommand.trim()}
                              onClick={handleHookFormSubmit}
                            >
                              {editingHook ? 'Update Hook' : 'Add Hook'}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="cursor-pointer"
                            onClick={() => { setShowAddHookDialog(false); resetHookForm(); }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </>
            )}

            {/* ===== Integrations ===== */}
            {activeTab === 'integrations' && (
              <>
                {matchesSearch('Local API Server') && (
                  <SettingGroup label="Local API Server">
                    <SettingToggle
                      label="Enable API Server"
                      description="Expose terminal state via localhost HTTP for external tools (Conjure, scripts, etc.)"
                      value={(settings?.integrations as Record<string, unknown>)?.apiServer !== false}
                      onChange={(v) => updateSetting.mutate([{ key: 'integrations.apiServer', value: v }])}
                    />
                    <SettingToggle
                      label="DTSP Registration"
                      description="Register as a Desktop Text Source Protocol source for auto-discovery by external tools"
                      value={(settings?.integrations as Record<string, unknown>)?.dtsp !== false}
                      onChange={(v) => updateSetting.mutate([{ key: 'integrations.dtsp', value: v }])}
                    />
                    <div className="text-[10px] text-text-tertiary mt-1 px-1">
                      API: <span className="font-mono">~/.subframe/api.json</span>
                      {' · '}
                      DTSP: <span className="font-mono">~/.dtsp/sources/subframe.json</span>
                    </div>
                  </SettingGroup>
                )}

                {matchesSearch('SubFrame Server') && (
                  <SettingGroup label="SubFrame Server">
                    <SettingToggle
                      label="Enable SubFrame Server"
                      description="Serve the IDE UI as a web app accessible from remote devices via SSH tunnel"
                      value={(settings?.server as Record<string, unknown>)?.enabled === true}
                      onChange={(v) => {
                        updateSetting.mutate([{ key: 'server.enabled', value: v }]);
                        // Also toggle the server immediately
                        typedInvoke(IPC.WEB_SERVER_TOGGLE, v)
                          .then(() => refetchWebServerInfo())
                          .catch(() => {});
                      }}
                    />

                    {/* Server status — shown when enabled */}
                    {webServerInfo?.enabled && (
                      <>
                        <div className="bg-bg-deep rounded-lg p-2.5 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            <span className="text-xs text-text-secondary">Server running</span>
                            <span className="text-[10px] text-text-muted ml-auto font-mono">
                              port {webServerInfo.port}
                            </span>
                          </div>

                          {/* Connected client indicator */}
                          {webServerInfo.clientConnected && webServerInfo.clientInfo ? (
                            <div className="flex items-center gap-2 pt-1 border-t border-border-subtle">
                              <Monitor className="w-3.5 h-3.5 text-accent shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="text-xs text-text-secondary truncate">
                                  {webServerInfo.clientInfo.userAgent.split(' ').slice(0, 3).join(' ')}
                                </div>
                                <div className="text-[10px] text-text-muted">
                                  Connected {new Date(webServerInfo.clientInfo.connectedAt).toLocaleTimeString()}
                                </div>
                              </div>
                              <Wifi className="w-3 h-3 text-green-500 shrink-0" />
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 pt-1 border-t border-border-subtle">
                              <span className="text-[10px] text-text-muted">No client connected</span>
                            </div>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="cursor-pointer text-xs"
                            onClick={() => setWebServerSetupOpen(true)}
                          >
                            <Globe className="w-3 h-3 mr-1.5" />
                            Setup Guide
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="cursor-pointer text-xs"
                            onClick={() => {
                              typedInvoke(IPC.WEB_SERVER_REGEN_TOKEN)
                                .then(() => {
                                  refetchWebServerInfo();
                                  toast.success('Auth token regenerated');
                                })
                                .catch(() => toast.error('Failed to regenerate token'));
                            }}
                          >
                            <RefreshCw className="w-3 h-3 mr-1.5" />
                            Regenerate Token
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="cursor-pointer text-xs"
                            onClick={() => {
                              typedInvoke(IPC.WEB_SERVER_GENERATE_PAIRING)
                                .then((result) => {
                                  setWebServerPairingCode(result.code);
                                  toast.success(`Pairing code: ${result.code}`, { duration: 10000 });
                                })
                                .catch(() => toast.error('Failed to generate pairing code'));
                            }}
                          >
                            <Copy className="w-3 h-3 mr-1.5" />
                            {webServerPairingCode ? `Code: ${webServerPairingCode}` : 'Show Pairing Code'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="cursor-pointer text-xs"
                            onClick={() => setWebServerQrVisible((v) => !v)}
                          >
                            <QrCode className="w-3 h-3 mr-1.5" />
                            {webServerQrVisible ? 'Hide QR Code' : 'Show QR Code'}
                          </Button>
                        </div>

                        {/* Inline QR Code */}
                        {webServerQrVisible && webServerQrDataUrl && (
                          <div className="flex justify-center py-2">
                            <img src={webServerQrDataUrl} alt="QR Code for connection URL" className="rounded-lg" style={{ width: 150, height: 150 }} />
                          </div>
                        )}
                      </>
                    )}

                    {/* Setup guide button when server is not enabled */}
                    {!webServerInfo?.enabled && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="cursor-pointer text-xs"
                        onClick={() => setWebServerSetupOpen(true)}
                      >
                        <Globe className="w-3 h-3 mr-1.5" />
                        Setup Guide
                      </Button>
                    )}
                  </SettingGroup>
                )}

                {/* Shell Integration (Experimental) */}
                {(matchesSearch('Shell Integration') || matchesSearch('CLI Status') || matchesSearch('Context Menu') || matchesSearch('Explorer')) && (
                  <SettingGroup label="Shell Integration">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-warning/15 text-warning border border-warning/30">
                        Experimental
                      </span>
                    </div>
                    <p className="text-xs text-text-tertiary mb-3">
                      Integrate SubFrame with your operating system for quick access from file explorers and terminal.
                    </p>

                    {/* CLI Status */}
                    <div className="p-3 rounded-md border border-border-subtle bg-bg-secondary/30">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-medium text-text-primary">CLI Tool</span>
                          <p className="text-[10px] text-text-muted mt-0.5">
                            {cliStatus?.installed
                              ? cliStatus.inPath
                                ? `Installed at ${cliStatus.path}`
                                : 'Installed but not in PATH'
                              : 'Not installed'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {cliStatus?.installed && !cliStatus.inPath && (
                            <span className="text-[9px] text-warning px-1.5 py-0.5 rounded bg-warning/10 border border-warning/20">PATH issue</span>
                          )}
                          <div className={`w-2 h-2 rounded-full ${cliStatus?.installed ? (cliStatus.inPath ? 'bg-success' : 'bg-warning') : 'bg-text-muted'}`} />
                        </div>
                      </div>
                    </div>

                    {/* Windows Context Menu */}
                    {process.platform === 'win32' && (
                      <div className="flex items-center justify-between p-3 rounded-md border border-border-subtle bg-bg-secondary/30 mt-2">
                        <div>
                          <span className="text-xs font-medium text-text-primary">Explorer Context Menu</span>
                          <p className="text-[10px] text-text-muted mt-0.5">
                            Add &quot;Open with SubFrame&quot; to right-click menu in Windows Explorer
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {contextMenuInstalled && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={async () => {
                                try {
                                  const r = await typedInvoke(IPC.UNINSTALL_CONTEXT_MENU);
                                  if (r.success) { toast.success('Context menu removed'); checkContextMenu(); }
                                  else toast.error(r.message);
                                } catch { toast.error('Failed to remove context menu'); }
                              }}
                              className="h-7 px-2 text-xs text-error hover:text-error cursor-pointer"
                            >
                              Remove
                            </Button>
                          )}
                          <Button
                            size="sm"
                            onClick={async () => {
                              try {
                                const r = await typedInvoke(IPC.INSTALL_CONTEXT_MENU);
                                if (r.success) { toast.success('Context menu registered'); checkContextMenu(); }
                                else toast.error(r.message);
                              } catch { toast.error('Failed to register context menu'); }
                            }}
                            className="h-7 px-3 text-xs bg-accent text-bg-deep hover:bg-accent/80 cursor-pointer"
                          >
                            {contextMenuInstalled ? 'Reinstall' : 'Install'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </SettingGroup>
                )}
              </>
            )}

            {/* ===== Updates ===== */}
            {activeTab === 'updates' && (
              <>
                <div className="text-xs text-text-tertiary">
                  Current version: <code className="text-text-secondary">v{APP_VERSION}</code>
                </div>

                {(matchesSearch('Auto-check for updates') || matchesSearch('Pre-release Channel') || matchesSearch('Check Interval') || matchesSearch('Update Preferences')) && (
                  <SettingGroup label="Update Preferences">
                    {matchesSearch('Auto-check for updates') && (
                      <SettingToggle
                        label="Auto-check for updates"
                        description="Automatically check for new versions in the background"
                        value={autoCheck}
                        onChange={setAutoCheck}
                      />
                    )}
                    {matchesSearch('Pre-release Channel') && (
                      <SettingSelect
                        label="Pre-release Channel"
                        description="Auto detects based on your current version"
                        value={allowPrerelease}
                        onChange={setAllowPrerelease}
                        options={[
                          { value: 'auto', label: 'Auto' },
                          { value: 'always', label: 'Always' },
                          { value: 'never', label: 'Never' },
                        ]}
                      />
                    )}
                    {matchesSearch('Check Interval') && (
                      <SettingInput
                        label="Check Interval (hours)"
                        value={checkIntervalHours}
                        onChange={(v) => setCheckIntervalHours(Number(v))}
                        type="number"
                        min={1}
                        max={24}
                      />
                    )}
                  </SettingGroup>
                )}

                <div className="flex gap-2">
                  <Button size="sm" onClick={saveUpdater} className="bg-accent text-bg-deep hover:bg-accent/80 cursor-pointer">
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="cursor-pointer"
                    onClick={() => {
                      // Fire and forget — UpdateNotification handles all toast feedback
                      typedInvoke(IPC.UPDATER_CHECK).catch(() => {});
                    }}
                  >
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    Check Now
                  </Button>
                </div>
              </>
            )}

            {/* ===== About ===== */}
            {activeTab === 'about' && (
              <>
                {/* App identity */}
                <div className="flex flex-col items-center text-center py-4">
                  <div className="text-lg font-bold text-text-primary">SubFrame</div>
                  <div className="text-xs text-text-tertiary mt-0.5">Terminal-first IDE for AI coding tools</div>
                  <div className="flex items-center gap-2 mt-2.5">
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-bg-tertiary text-accent px-2 py-0.5 rounded-full">
                      v{APP_VERSION}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-bg-tertiary text-text-secondary px-2 py-0.5 rounded-full">
                      <Scale className="w-2.5 h-2.5" />
                      MIT
                    </span>
                  </div>
                </div>

                {/* Links group */}
                <SettingGroup label="Links">
                  <button
                    className="flex items-center gap-3 w-full text-left px-2 py-2 rounded-md hover:bg-bg-hover transition-colors cursor-pointer"
                    onClick={() => getTransport().platform.openExternal('https://github.com/Codename-11/SubFrame')}
                  >
                    <Github className="w-4 h-4 text-text-tertiary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-text-primary">GitHub</div>
                      <div className="text-xs text-text-tertiary">View source code and documentation</div>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-text-muted shrink-0" />
                  </button>

                  <button
                    className="flex items-center gap-3 w-full text-left px-2 py-2 rounded-md hover:bg-bg-hover transition-colors cursor-pointer"
                    onClick={() => getTransport().platform.openExternal('https://github.com/Codename-11/SubFrame/issues')}
                  >
                    <Info className="w-4 h-4 text-text-tertiary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-text-primary">Report Issue</div>
                      <div className="text-xs text-text-tertiary">File a bug report or feature request</div>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-text-muted shrink-0" />
                  </button>

                  <button
                    className="flex items-center gap-3 w-full text-left px-2 py-2 rounded-md hover:bg-bg-hover transition-colors cursor-pointer"
                    onClick={() => {
                      setSettingsOpen(false);
                      setTimeout(() => window.dispatchEvent(new Event('open-whats-new')), 200);
                    }}
                  >
                    <Sparkles className="w-4 h-4 text-text-tertiary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-text-primary">What&apos;s New</div>
                      <div className="text-xs text-text-tertiary">View release notes for the current version</div>
                    </div>
                  </button>
                </SettingGroup>

                {/* Changelog */}
                <SettingGroup label="Changelog">
                  <button
                    className="flex items-center gap-3 w-full text-left px-2 py-2 rounded-md hover:bg-bg-hover transition-colors cursor-pointer"
                    onClick={() => getTransport().platform.openExternal('https://github.com/Codename-11/SubFrame/blob/main/CHANGELOG.md')}
                  >
                    <FileText className="w-4 h-4 text-text-tertiary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-text-primary">View Changelog</div>
                      <div className="text-xs text-text-tertiary">Full history of changes and releases</div>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-text-muted shrink-0" />
                  </button>
                </SettingGroup>
              </>
            )}

          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* SubFrame Server setup wizard */}
    <WebServerSetup open={webServerSetupOpen} onOpenChange={setWebServerSetupOpen} />
    </>
  );
}
