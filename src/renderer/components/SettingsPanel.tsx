/**
 * SettingsPanel — Settings dialog/modal with tabs.
 * Opens via useUIStore.settingsOpen.
 */

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { FolderSearch, FolderOpen, Plus, Trash2, X as XIcon, RefreshCw, ExternalLink, Github, FileText, Sparkles, Scale, Info, Check, RotateCcw, Save } from 'lucide-react';
import { useUIStore } from '../stores/useUIStore';
import { useSettings, useAIToolConfig } from '../hooks/useSettings';
import { typedInvoke } from '../lib/ipc';
import { IPC } from '../../shared/ipcChannels';
import { toast } from 'sonner';
import { EDITOR_THEMES } from '../lib/codemirror-theme';
import { motion } from 'framer-motion';
import {
  type ThemeTokens,
  type ThemeDefinition,
  BUILTIN_THEMES,
  THEME_CLASSIC_AMBER,
  getThemeById,
} from '../../shared/themeTypes';

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

export function SettingsPanel() {
  const settingsOpen = useUIStore((s) => s.settingsOpen);
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen);
  const { settings, updateSetting } = useSettings();
  const { config: aiToolConfig, setAITool, addCustomTool, removeCustomTool, refetch: refetchAITools } = useAIToolConfig();
  const [recheckingTools, setRecheckingTools] = useState(false);

  // Local form state
  const [activeTab, setActiveTab] = useState('general');
  const [aiCommand, setAiCommand] = useState('');
  const [fontSize, setFontSize] = useState(14);
  const [scrollback, setScrollback] = useState(10000);

  // Terminal settings
  const [nerdFontDetected] = useState(() => detectNerdFont());
  const [fontFamily, setFontFamily] = useState(DEFAULT_FONT);
  const [lineHeight, setLineHeight] = useState(1.2);
  const [cursorBlink, setCursorBlink] = useState(true);
  const [cursorStyle, setCursorStyle] = useState('bar');
  const [defaultShell, setDefaultShell] = useState('');
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

  // Sync form state from loaded data
  useEffect(() => {
    if (!settings) return;
    const terminal = (settings.terminal as Record<string, unknown>) || {};
    setFontSize((terminal.fontSize as number) || 14);
    setScrollback((terminal.scrollback as number) || 10000);
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

  return (
    <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
      <DialogContent className="bg-bg-primary border-border-subtle text-text-primary sm:max-w-2xl !flex !flex-col max-h-[80vh] overflow-hidden p-0" aria-describedby={undefined}>
        <DialogHeader className="shrink-0 px-6 pt-6">
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0 flex flex-col px-6 pb-6">
          <TabsList className="bg-bg-deep border border-border-subtle shrink-0">
            <TabsTrigger value="appearance" className="text-xs data-[state=active]:bg-bg-hover cursor-pointer">
              Appearance
            </TabsTrigger>
            <TabsTrigger value="general" className="text-xs data-[state=active]:bg-bg-hover cursor-pointer">
              General
            </TabsTrigger>
            <TabsTrigger value="terminal" className="text-xs data-[state=active]:bg-bg-hover cursor-pointer">
              Terminal
            </TabsTrigger>
            <TabsTrigger value="editor" className="text-xs data-[state=active]:bg-bg-hover cursor-pointer">
              Editor
            </TabsTrigger>
            <TabsTrigger value="ai-tool" className="text-xs data-[state=active]:bg-bg-hover cursor-pointer">
              AI Tool
            </TabsTrigger>
            <TabsTrigger value="updates" className="text-xs data-[state=active]:bg-bg-hover cursor-pointer">
              Updates
            </TabsTrigger>
            <TabsTrigger value="about" className="text-xs data-[state=active]:bg-bg-hover cursor-pointer">
              About
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 min-h-0 overflow-y-auto mt-4">
            {/* Appearance tab */}
            <TabsContent value="appearance" className="mt-0 space-y-4 px-4 pb-4">
              {/* Theme Presets */}
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
                        updateSetting.mutate([{ key: 'appearance.activeThemeId', value: theme.id }]);
                      }}
                      onKeyDown={(e: React.KeyboardEvent) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setActiveThemeId(theme.id);
                          setCustomTokenOverrides({});
                          updateSetting.mutate([{ key: 'appearance.activeThemeId', value: theme.id }]);
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

              {/* Customization */}
              <div className="text-[10px] uppercase tracking-wider text-text-tertiary font-medium mb-1.5">Customize</div>
              <div className="bg-bg-secondary/50 rounded-lg p-3 space-y-3">
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

                  return (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        {colorFields.map(({ key, label }) => (
                          <div key={key} className="flex items-center gap-2">
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

                      {/* Feature toggles */}
                      <div className="border-t border-border-subtle pt-3 mt-3 space-y-3">
                        {/* Neon Traces toggle */}
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm text-text-primary">Neon Traces</div>
                            <div className="text-xs text-text-tertiary">Synthwave glow effects on scrollbars and selections</div>
                          </div>
                          <button
                            onClick={() => {
                              const newVal = !(customTokenOverrides.enableNeonTraces ?? currentTokens.enableNeonTraces);
                              setCustomTokenOverrides((prev) => ({ ...prev, enableNeonTraces: newVal }));
                            }}
                            className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${
                              (customTokenOverrides.enableNeonTraces ?? currentTokens.enableNeonTraces) ? 'bg-accent' : 'bg-bg-tertiary'
                            }`}
                          >
                            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                              (customTokenOverrides.enableNeonTraces ?? currentTokens.enableNeonTraces) ? 'translate-x-4.5' : 'translate-x-0.5'
                            }`} />
                          </button>
                        </div>

                        {/* Scanlines toggle */}
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm text-text-primary">CRT Scanlines</div>
                            <div className="text-xs text-text-tertiary">Subtle scanline overlay for retro feel</div>
                          </div>
                          <button
                            onClick={() => {
                              const newVal = !(customTokenOverrides.enableScanlines ?? currentTokens.enableScanlines);
                              setCustomTokenOverrides((prev) => ({ ...prev, enableScanlines: newVal }));
                            }}
                            className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${
                              (customTokenOverrides.enableScanlines ?? currentTokens.enableScanlines) ? 'bg-accent' : 'bg-bg-tertiary'
                            }`}
                          >
                            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                              (customTokenOverrides.enableScanlines ?? currentTokens.enableScanlines) ? 'translate-x-4.5' : 'translate-x-0.5'
                            }`} />
                          </button>
                        </div>

                        {/* Logo glow toggle */}
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm text-text-primary">Logo Glow</div>
                            <div className="text-xs text-text-tertiary">Ambient glow effect on sidebar logo</div>
                          </div>
                          <button
                            onClick={() => {
                              const newVal = !(customTokenOverrides.enableLogoGlow ?? currentTokens.enableLogoGlow);
                              setCustomTokenOverrides((prev) => ({ ...prev, enableLogoGlow: newVal }));
                            }}
                            className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${
                              (customTokenOverrides.enableLogoGlow ?? currentTokens.enableLogoGlow) ? 'bg-accent' : 'bg-bg-tertiary'
                            }`}
                          >
                            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                              (customTokenOverrides.enableLogoGlow ?? currentTokens.enableLogoGlow) ? 'translate-x-4.5' : 'translate-x-0.5'
                            }`} />
                          </button>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 flex-wrap">
                {/* Save as Custom Theme */}
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
                    {Object.keys(customTokenOverrides).length > 0 && (
                      <>
                        <Button
                          size="sm"
                          className="bg-accent text-bg-deep hover:bg-accent/80 cursor-pointer"
                          onClick={() => setShowSaveThemeInput(true)}
                        >
                          <Save className="h-3.5 w-3.5 mr-1" />
                          Save as Custom Theme
                        </Button>
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
                          Reset to Preset
                        </Button>
                      </>
                    )}
                  </>
                )}
              </div>
            </TabsContent>

            {/* General tab */}
            <TabsContent value="general" className="mt-0 space-y-4 px-4 pb-4">
              {/* Startup group */}
              <div className="text-[10px] uppercase tracking-wider text-text-tertiary font-medium mb-1.5">Startup</div>
              <div className="bg-bg-secondary/50 rounded-lg p-3 space-y-3">
                {/* Auto terminal */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-text-primary">Open terminal on startup</div>
                    <div className="text-xs text-text-tertiary">Automatically create a terminal when SubFrame launches</div>
                  </div>
                  <button
                    onClick={() => saveToggle('general.autoCreateTerminal', !autoCreateTerminal)}
                    className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${autoCreateTerminal ? 'bg-accent' : 'bg-bg-tertiary'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${autoCreateTerminal ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                  </button>
                </div>

                {/* Reuse idle terminal */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-text-primary">Reuse idle terminal for agent</div>
                    <div className="text-xs text-text-tertiary">Start agent in the active terminal if no agent is running, instead of creating a new one</div>
                  </div>
                  <button
                    onClick={() => saveToggle('general.reuseIdleTerminal', !reuseIdleTerminal)}
                    className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${reuseIdleTerminal ? 'bg-accent' : 'bg-bg-tertiary'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${reuseIdleTerminal ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                  </button>
                </div>

                {/* Show dotfiles */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-text-primary">Show hidden files (.dotfiles)</div>
                    <div className="text-xs text-text-tertiary">Show files starting with a dot in the file tree</div>
                  </div>
                  <button
                    onClick={() => saveToggle('general.showDotfiles', !showDotfiles)}
                    className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${showDotfiles ? 'bg-accent' : 'bg-bg-tertiary'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${showDotfiles ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>

              {/* Behavior group */}
              <div className="text-[10px] uppercase tracking-wider text-text-tertiary font-medium mb-1.5">Behavior</div>
              <div className="bg-bg-secondary/50 rounded-lg p-3 space-y-3">
                {/* Confirm before close */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-text-primary">Confirm before closing</div>
                    <div className="text-xs text-text-tertiary">Show a confirmation dialog before closing the window</div>
                  </div>
                  <button
                    onClick={() => saveToggle('general.confirmBeforeClose', !confirmBeforeClose)}
                    className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${confirmBeforeClose ? 'bg-accent' : 'bg-bg-tertiary'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${confirmBeforeClose ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                  </button>
                </div>

                {/* Usage auto-polling */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <div className="text-sm text-text-primary">Auto-poll usage</div>
                      <div className="text-xs text-text-tertiary">Periodically check Claude API usage. Off = on-demand only (click to refresh).</div>
                    </div>
                    <button
                      onClick={() => {
                        updateSetting.mutate([{ key: 'general.usagePollingInterval', value: usagePollingInterval === 0 ? 300 : 0 }]);
                      }}
                      className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${usagePollingInterval > 0 ? 'bg-accent' : 'bg-bg-tertiary'}`}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${usagePollingInterval > 0 ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                  {usagePollingInterval > 0 && (
                    <div className="flex items-center gap-3 mt-2">
                      <input
                        type="range"
                        min={30}
                        max={600}
                        step={30}
                        value={usagePollingInterval}
                        onChange={(e) => {
                          updateSetting.mutate([{ key: 'general.usagePollingInterval', value: Number(e.target.value) }]);
                        }}
                        className="flex-1 accent-accent"
                      />
                      <span className="text-xs text-text-secondary w-14 text-right tabular-nums">
                        {usagePollingInterval >= 60
                          ? `${Math.floor(usagePollingInterval / 60)}m${usagePollingInterval % 60 ? ` ${usagePollingInterval % 60}s` : ''}`
                          : `${usagePollingInterval}s`}
                      </span>
                    </div>
                  )}
                </div>

                {/* Grid overflow auto-switch */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-text-primary">Grid overflow auto-switch</div>
                    <div className="text-xs text-text-tertiary">Auto-switch to single view when selecting a terminal outside the grid, and back when selecting one inside</div>
                  </div>
                  <button
                    onClick={() => saveToggle('general.gridOverflowAutoSwitch', !gridOverflowAutoSwitch)}
                    className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${gridOverflowAutoSwitch ? 'bg-accent' : 'bg-bg-tertiary'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${gridOverflowAutoSwitch ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                  </button>
                </div>

                {/* Highlight user messages */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-text-primary">Highlight user messages</div>
                    <div className="text-xs text-text-tertiary">Mark your messages in agent sessions with a left border and enable scroll-to-last-message navigation</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {highlightUserMessages && (
                      <input
                        type="color"
                        value={userMessageColor}
                        onChange={(e) => updateSetting.mutate([{ key: 'general.userMessageColor', value: e.target.value }])}
                        className="w-7 h-5 rounded cursor-pointer border border-border-subtle bg-transparent"
                        title="Message border color"
                      />
                    )}
                    <button
                      onClick={() => saveToggle('general.highlightUserMessages', !highlightUserMessages)}
                      className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${highlightUserMessages ? 'bg-accent' : 'bg-bg-tertiary'}`}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${highlightUserMessages ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Paths group */}
              <div className="text-[10px] uppercase tracking-wider text-text-tertiary font-medium mb-1.5">Paths</div>
              <div className="bg-bg-secondary/50 rounded-lg p-3 space-y-3">
                <div>
                  <div className="text-sm text-text-primary mb-1">Default Project Directory</div>
                  <div className="text-xs text-text-tertiary mb-2">Subdirectories appear automatically in the project list</div>
                  <div className="flex gap-2">
                    <Input
                      value={defaultProjectDir}
                      readOnly
                      placeholder="No directory selected"
                      className="bg-bg-deep border-border-subtle text-sm flex-1"
                    />
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
                  </div>
                  {defaultProjectDir && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="cursor-pointer mt-2 text-xs"
                      onClick={async () => {
                        toast.info('Scanning directory...');
                        await typedInvoke(IPC.SCAN_PROJECT_DIR, defaultProjectDir);
                        toast.success('Scan complete');
                      }}
                    >
                      <FolderSearch className="h-3.5 w-3.5 mr-1.5" />
                      Scan Now
                    </Button>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Terminal tab */}
            <TabsContent value="terminal" className="mt-0 space-y-4 px-4 pb-4">
              {/* Font group */}
              <div className="text-[10px] uppercase tracking-wider text-text-tertiary font-medium mb-1.5">Font</div>
              <div className="bg-bg-secondary/50 rounded-lg p-3 space-y-3">
                <div>
                  <div className="text-sm text-text-primary mb-1">Font Size</div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={10}
                      max={24}
                      step={1}
                      value={fontSize}
                      onChange={(e) => setFontSize(Number(e.target.value))}
                      className="flex-1 accent-accent"
                    />
                    <span className="text-xs text-text-secondary w-10">{fontSize}px</span>
                  </div>
                </div>
                <div>
                  <div className="text-sm text-text-primary mb-1">Font Family</div>
                  <Input
                    value={fontFamily}
                    onChange={(e) => setFontFamily(e.target.value)}
                    className="bg-bg-deep border-border-subtle text-sm"
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
              </div>

              {/* Display group */}
              <div className="text-[10px] uppercase tracking-wider text-text-tertiary font-medium mb-1.5">Display</div>
              <div className="bg-bg-secondary/50 rounded-lg p-3 space-y-3">
                <div>
                  <div className="text-sm text-text-primary mb-1">Line Height</div>
                  <Input
                    type="number"
                    value={lineHeight}
                    onChange={(e) => setLineHeight(Number(e.target.value))}
                    min={1.0}
                    max={2.0}
                    step={0.1}
                    className="bg-bg-deep border-border-subtle text-sm"
                  />
                </div>
                <div>
                  <div className="text-sm text-text-primary mb-1">Scrollback Lines</div>
                  <Input
                    type="number"
                    value={scrollback}
                    onChange={(e) => setScrollback(Number(e.target.value))}
                    min={1000}
                    max={100000}
                    step={1000}
                    className="bg-bg-deep border-border-subtle text-sm"
                  />
                </div>

                <div>
                  <div className="text-sm text-text-primary mb-1">Cursor Style</div>
                  <select
                    value={cursorStyle}
                    onChange={(e) => setCursorStyle(e.target.value)}
                    className="w-full bg-bg-deep border border-border-subtle rounded px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 cursor-pointer"
                  >
                    <option value="block">Block</option>
                    <option value="underline">Underline</option>
                    <option value="bar">Bar</option>
                  </select>
                </div>

                {/* Cursor blink */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-text-primary">Cursor Blink</div>
                    <div className="text-xs text-text-tertiary">Enable blinking cursor in the terminal</div>
                  </div>
                  <button
                    onClick={() => setCursorBlink(!cursorBlink)}
                    className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${cursorBlink ? 'bg-accent' : 'bg-bg-tertiary'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${cursorBlink ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>

              {/* Behavior group */}
              <div className="text-[10px] uppercase tracking-wider text-text-tertiary font-medium mb-1.5">Behavior</div>
              <div className="bg-bg-secondary/50 rounded-lg p-3 space-y-3">
                <div>
                  <div className="text-sm text-text-primary mb-1">Default Shell</div>
                  <Input
                    value={defaultShell}
                    onChange={(e) => setDefaultShell(e.target.value)}
                    placeholder="System default"
                    className="bg-bg-deep border-border-subtle text-sm"
                  />
                  <div className="text-xs text-text-tertiary mt-1">Leave empty to use the system default shell</div>
                </div>

                {/* Bell sound */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-text-primary">Bell Sound</div>
                    <div className="text-xs text-text-tertiary">Play a sound on terminal bell</div>
                  </div>
                  <button
                    onClick={() => setBellSound(!bellSound)}
                    className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${bellSound ? 'bg-accent' : 'bg-bg-tertiary'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${bellSound ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                  </button>
                </div>

                {/* Copy on select */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-text-primary">Copy on Select</div>
                    <div className="text-xs text-text-tertiary">Automatically copy selected text to clipboard</div>
                  </div>
                  <button
                    onClick={() => setCopyOnSelect(!copyOnSelect)}
                    className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${copyOnSelect ? 'bg-accent' : 'bg-bg-tertiary'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${copyOnSelect ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>

              <Button size="sm" onClick={saveTerminal} className="bg-accent text-bg-deep hover:bg-accent/80 cursor-pointer">
                Save
              </Button>
            </TabsContent>

            {/* Editor tab */}
            <TabsContent value="editor" className="mt-0 space-y-4 px-4 pb-4">
              {/* Font group */}
              <div className="text-[10px] uppercase tracking-wider text-text-tertiary font-medium mb-1.5">Font</div>
              <div className="bg-bg-secondary/50 rounded-lg p-3 space-y-3">
                <div>
                  <div className="text-sm text-text-primary mb-1">Font Size</div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={8}
                      max={24}
                      step={1}
                      value={editorFontSize}
                      onChange={(e) => setEditorFontSize(Number(e.target.value))}
                      className="flex-1 accent-accent"
                    />
                    <span className="text-xs text-text-secondary w-10">{editorFontSize}px</span>
                  </div>
                </div>
                <div>
                  <div className="text-sm text-text-primary mb-1">Font Family</div>
                  <Input
                    value={editorFontFamily}
                    onChange={(e) => setEditorFontFamily(e.target.value)}
                    className="bg-bg-deep border-border-subtle text-sm"
                  />
                </div>
                <div>
                  <div className="text-sm text-text-primary mb-1">Tab Size</div>
                  <select
                    value={editorTabSize}
                    onChange={(e) => setEditorTabSize(Number(e.target.value))}
                    className="w-full bg-bg-deep border border-border-subtle rounded px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 cursor-pointer"
                  >
                    <option value={2}>2 spaces</option>
                    <option value={4}>4 spaces</option>
                  </select>
                </div>
              </div>

              {/* Display group */}
              <div className="text-[10px] uppercase tracking-wider text-text-tertiary font-medium mb-1.5">Display</div>
              <div className="bg-bg-secondary/50 rounded-lg p-3 space-y-3">
                <div>
                  <div className="text-sm text-text-primary mb-1">Theme</div>
                  <select
                    value={editorTheme}
                    onChange={(e) => setEditorTheme(e.target.value)}
                    className="w-full bg-bg-deep border border-border-subtle rounded px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 cursor-pointer"
                  >
                    {Object.values(EDITOR_THEMES).map((theme) => (
                      <option key={theme.id} value={theme.id}>{theme.label}</option>
                    ))}
                  </select>
                </div>

                {/* Word wrap */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-text-primary">Word Wrap</div>
                    <div className="text-xs text-text-tertiary">Wrap long lines in the editor</div>
                  </div>
                  <button
                    onClick={() => setEditorWordWrap(!editorWordWrap)}
                    className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${editorWordWrap ? 'bg-accent' : 'bg-bg-tertiary'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${editorWordWrap ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                  </button>
                </div>

                {/* Minimap */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-text-primary">Minimap</div>
                    <div className="text-xs text-text-tertiary">Show a minimap overview of the file</div>
                  </div>
                  <button
                    onClick={() => setEditorMinimap(!editorMinimap)}
                    className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${editorMinimap ? 'bg-accent' : 'bg-bg-tertiary'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${editorMinimap ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                  </button>
                </div>

                {/* Line numbers */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-text-primary">Line Numbers</div>
                    <div className="text-xs text-text-tertiary">Show line numbers in the gutter</div>
                  </div>
                  <button
                    onClick={() => setEditorLineNumbers(!editorLineNumbers)}
                    className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${editorLineNumbers ? 'bg-accent' : 'bg-bg-tertiary'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${editorLineNumbers ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                  </button>
                </div>

                {/* Bracket matching */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-text-primary">Bracket Matching</div>
                    <div className="text-xs text-text-tertiary">Highlight matching brackets</div>
                  </div>
                  <button
                    onClick={() => setEditorBracketMatching(!editorBracketMatching)}
                    className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${editorBracketMatching ? 'bg-accent' : 'bg-bg-tertiary'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${editorBracketMatching ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>

              <Button size="sm" onClick={saveEditor} className="bg-accent text-bg-deep hover:bg-accent/80 cursor-pointer">
                Save
              </Button>
            </TabsContent>

            {/* AI Tool tab */}
            <TabsContent value="ai-tool" className="mt-0 space-y-4 px-4 pb-4">
              <div>
                <div className="text-sm text-text-primary mb-1">Active Tool</div>
                <select
                  value={aiToolConfig?.activeTool.id || 'claude'}
                  onChange={(e) => {
                    setAITool.mutate([e.target.value]);
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
                            onClick={(e) => { e.preventDefault(); require('electron').shell.openExternal(aiToolConfig.activeTool.installUrl!); }}
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
              <div>
                <div className="text-sm text-text-primary mb-1">Start Command</div>
                <Input
                  value={aiCommand}
                  onChange={(e) => setAiCommand(e.target.value)}
                  placeholder={aiToolConfig?.activeTool.command || 'claude'}
                  className="bg-bg-deep border-border-subtle text-sm"
                />
                <div className="text-xs text-text-tertiary mt-1">
                  Default: <code className="text-text-secondary">{aiToolConfig?.activeTool.command || 'claude'}</code>
                </div>
              </div>
              <div className="flex gap-2">
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

              {/* Custom Tools */}
              <div className="border-t border-border-subtle pt-4 mt-4">
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
            </TabsContent>

            {/* Updates tab */}
            <TabsContent value="updates" className="mt-0 space-y-4 px-4 pb-4">
              <div className="text-xs text-text-tertiary">
                Current version: <code className="text-text-secondary">v{APP_VERSION}</code>
              </div>

              {/* Update Preferences group */}
              <div className="text-[10px] uppercase tracking-wider text-text-tertiary font-medium mb-1.5">Update Preferences</div>
              <div className="bg-bg-secondary/50 rounded-lg p-3 space-y-3">
                {/* Auto-check for updates */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-text-primary">Auto-check for updates</div>
                    <div className="text-xs text-text-tertiary">Automatically check for new versions in the background</div>
                  </div>
                  <button
                    onClick={() => setAutoCheck(!autoCheck)}
                    className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${autoCheck ? 'bg-accent' : 'bg-bg-tertiary'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${autoCheck ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                  </button>
                </div>

                <div>
                  <div className="text-sm text-text-primary mb-1">Pre-release Channel</div>
                  <select
                    value={allowPrerelease}
                    onChange={(e) => setAllowPrerelease(e.target.value)}
                    className="w-full bg-bg-deep border border-border-subtle rounded px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 cursor-pointer"
                  >
                    <option value="auto">Auto</option>
                    <option value="always">Always</option>
                    <option value="never">Never</option>
                  </select>
                  <div className="text-xs text-text-tertiary mt-1">Auto detects based on your current version</div>
                </div>

                <div>
                  <div className="text-sm text-text-primary mb-1">Check Interval (hours)</div>
                  <Input
                    type="number"
                    value={checkIntervalHours}
                    onChange={(e) => setCheckIntervalHours(Number(e.target.value))}
                    min={1}
                    max={24}
                    className="bg-bg-deep border-border-subtle text-sm"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button size="sm" onClick={saveUpdater} className="bg-accent text-bg-deep hover:bg-accent/80 cursor-pointer">
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="cursor-pointer"
                  onClick={async () => {
                    toast.loading('Checking for updates...', { id: 'updater-manual' });
                    try {
                      const result = await typedInvoke(IPC.UPDATER_CHECK);
                      if (result.updateAvailable) {
                        toast.dismiss('updater-manual');
                      } else {
                        toast.success('You are on the latest version', { id: 'updater-manual' });
                      }
                    } catch {
                      toast.error('Failed to check for updates', { id: 'updater-manual' });
                    }
                  }}
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  Check Now
                </Button>
              </div>
            </TabsContent>

            {/* About tab */}
            <TabsContent value="about" className="mt-0 space-y-4 px-4 pb-4">
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
                    BUSL-1.1
                  </span>
                </div>
              </div>

              {/* Links group */}
              <div className="text-[10px] uppercase tracking-wider text-text-tertiary font-medium mb-1.5">Links</div>
              <div className="bg-bg-secondary/50 rounded-lg p-3 space-y-0.5">
                <button
                  className="flex items-center gap-3 w-full text-left px-2 py-2 rounded-md hover:bg-bg-hover transition-colors cursor-pointer"
                  onClick={() => require('electron').shell.openExternal('https://github.com/Codename-11/SubFrame')}
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
                  onClick={() => require('electron').shell.openExternal('https://github.com/Codename-11/SubFrame/issues')}
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
              </div>

              {/* Changelog */}
              <div className="text-[10px] uppercase tracking-wider text-text-tertiary font-medium mb-1.5">Changelog</div>
              <div className="bg-bg-secondary/50 rounded-lg p-3">
                <button
                  className="flex items-center gap-3 w-full text-left px-2 py-2 rounded-md hover:bg-bg-hover transition-colors cursor-pointer"
                  onClick={() => require('electron').shell.openExternal('https://github.com/Codename-11/SubFrame/blob/main/CHANGELOG.md')}
                >
                  <FileText className="w-4 h-4 text-text-tertiary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-text-primary">View Changelog</div>
                    <div className="text-xs text-text-tertiary">Full history of changes and releases</div>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-text-muted shrink-0" />
                </button>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
