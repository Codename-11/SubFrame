/**
 * SettingsPanel — Settings dialog/modal with tabs.
 * Opens via useUIStore.settingsOpen.
 */

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ScrollArea } from './ui/scroll-area';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { FolderSearch, FolderOpen, Plus, Trash2, X as XIcon } from 'lucide-react';
import { useUIStore } from '../stores/useUIStore';
import { useSettings, useAIToolConfig } from '../hooks/useSettings';
import { typedInvoke } from '../lib/ipc';
import { IPC } from '../../shared/ipcChannels';
import { toast } from 'sonner';

const BUILTIN_TOOL_IDS = new Set(['claude', 'codex', 'gemini']);

export function SettingsPanel() {
  const settingsOpen = useUIStore((s) => s.settingsOpen);
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen);
  const { settings, updateSetting } = useSettings();
  const { config: aiToolConfig, setAITool, addCustomTool, removeCustomTool } = useAIToolConfig();

  // Local form state
  const [activeTab, setActiveTab] = useState('general');
  const [aiCommand, setAiCommand] = useState('');
  const [fontSize, setFontSize] = useState(14);
  const [scrollback, setScrollback] = useState(10000);

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
  const showDotfiles = (general.showDotfiles as boolean) || false;
  const defaultProjectDir = (general.defaultProjectDir as string) || '';

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
    toast.success('Terminal settings saved');
  }

  return (
    <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
      <DialogContent className="bg-bg-primary border-border-subtle text-text-primary sm:max-w-lg max-h-[80vh] overflow-hidden flex flex-col" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0 flex flex-col">
          <TabsList className="bg-bg-deep border border-border-subtle shrink-0">
            <TabsTrigger value="general" className="text-xs data-[state=active]:bg-bg-hover cursor-pointer">
              General
            </TabsTrigger>
            <TabsTrigger value="ai-tool" className="text-xs data-[state=active]:bg-bg-hover cursor-pointer">
              AI Tool
            </TabsTrigger>
            <TabsTrigger value="terminal" className="text-xs data-[state=active]:bg-bg-hover cursor-pointer">
              Terminal
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 min-h-0 mt-4">
            {/* General tab */}
            <TabsContent value="general" className="mt-0 space-y-4">
              {/* Auto terminal */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-text-primary">Open terminal on startup</div>
                  <div className="text-xs text-text-tertiary">Automatically create a terminal when SubFrame launches</div>
                </div>
                <button
                  onClick={() => saveToggle('general.autoCreateTerminal', !autoCreateTerminal)}
                  className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${autoCreateTerminal ? 'bg-accent' : 'bg-zinc-600'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${autoCreateTerminal ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
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
                  className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${showDotfiles ? 'bg-accent' : 'bg-zinc-600'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${showDotfiles ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                </button>
              </div>

              {/* Default project directory */}
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

              {/* Check for Updates */}
              <div>
                <div className="text-sm text-text-primary mb-1">Updates</div>
                <div className="text-xs text-text-tertiary mb-2">Check if a newer version of SubFrame is available</div>
                <Button
                  size="sm"
                  variant="outline"
                  className="cursor-pointer text-xs"
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
                  Check for Updates
                </Button>
              </div>
            </TabsContent>

            {/* AI Tool tab */}
            <TabsContent value="ai-tool" className="mt-0 space-y-4">
              <div>
                <div className="text-sm text-text-primary mb-1">Active Tool</div>
                <select
                  value={aiToolConfig?.activeTool.id || 'claude'}
                  onChange={(e) => {
                    setAITool.mutate([e.target.value]);
                  }}
                  className="w-full bg-bg-deep border border-border-subtle rounded-md px-2 py-1.5 text-sm text-text-primary cursor-pointer"
                >
                  {aiToolConfig && Object.values(aiToolConfig.availableTools).map((tool) => (
                    <option key={tool.id} value={tool.id}>
                      {tool.name}
                    </option>
                  ))}
                </select>
                <div className="text-xs text-text-tertiary mt-1">
                  {aiToolConfig?.activeTool.description || ''}
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

            {/* Terminal tab */}
            <TabsContent value="terminal" className="mt-0 space-y-4">
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
              <Button size="sm" onClick={saveTerminal} className="bg-accent text-bg-deep hover:bg-accent/80 cursor-pointer">
                Save
              </Button>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
