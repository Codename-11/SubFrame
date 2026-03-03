/**
 * PromptLibrary — Command-palette-style overlay for saved prompts.
 * Triggered by Ctrl+Shift+L. Fuzzy searches across title + content + tags,
 * inserts selected prompt into the active terminal via PTY write.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Pencil, Send, Tag, Copy } from 'lucide-react';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from './ui/command';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner';
import { usePrompts } from '../hooks/usePrompts';
import { useTerminalStore } from '../stores/useTerminalStore';
import { useProjectStore } from '../stores/useProjectStore';
import { useUIStore } from '../stores/useUIStore';
import { typedSend } from '../lib/ipc';
import { IPC } from '../../shared/ipcChannels';
import type { SavedPrompt } from '../../shared/ipcChannels';

function generateId(): string {
  return `prompt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function PromptLibrary() {
  const [open, setOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<SavedPrompt | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  const { prompts, savePrompt, deletePrompt } = usePrompts();
  const activeTerminalId = useTerminalStore((s) => s.activeTerminalId);
  const projectPath = useProjectStore((s) => s.currentProjectPath);

  // Register Ctrl+Shift+L keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Group prompts by category
  const grouped = useMemo(() => {
    const map = new Map<string, SavedPrompt[]>();
    for (const p of prompts) {
      const cat = p.category || 'General';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(p);
    }
    return map;
  }, [prompts]);

  // Insert prompt text into active terminal
  const insertPrompt = useCallback(
    (prompt: SavedPrompt) => {
      if (!activeTerminalId) {
        toast.warning('No active terminal', { description: 'Open a terminal first to insert prompts.' });
        setOpen(false);
        return;
      }

      // Resolve template variables
      let text = prompt.content;
      if (projectPath) {
        const projectName = projectPath.split(/[\\/]/).pop() || '';
        text = text.replace(/\{\{project\}\}/g, projectName);
        text = text.replace(/\{\{projectPath\}\}/g, projectPath);
      }
      const editorFile = useUIStore.getState().editorFilePath;
      text = text.replace(/\{\{file\}\}/g, editorFile || '');

      typedSend(IPC.TERMINAL_INPUT_ID, { terminalId: activeTerminalId, data: text });

      // Increment usage count
      if (projectPath) {
        savePrompt.mutate([{
          projectPath,
          prompt: { ...prompt, usageCount: (prompt.usageCount || 0) + 1 },
        }]);
      }

      setOpen(false);
    },
    [activeTerminalId, projectPath, savePrompt]
  );

  // Copy prompt to clipboard
  const copyPrompt = useCallback((prompt: SavedPrompt) => {
    navigator.clipboard.writeText(prompt.content);
    setOpen(false);
  }, []);

  const handleNewPrompt = useCallback(() => {
    setEditingPrompt({
      id: generateId(),
      title: '',
      content: '',
      tags: [],
      category: 'General',
      usageCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setShowEditor(true);
    setOpen(false);
  }, []);

  const handleEditPrompt = useCallback((prompt: SavedPrompt) => {
    setEditingPrompt({ ...prompt });
    setShowEditor(true);
    setOpen(false);
  }, []);

  const handleDeletePrompt = useCallback(
    (promptId: string) => {
      if (!projectPath) return;
      deletePrompt.mutate([{ projectPath, promptId }]);
    },
    [projectPath, deletePrompt]
  );

  const handleSavePrompt = useCallback(() => {
    if (!editingPrompt || !projectPath || !editingPrompt.title.trim()) return;
    savePrompt.mutate([{ projectPath, prompt: editingPrompt }]);
    setShowEditor(false);
    setEditingPrompt(null);
  }, [editingPrompt, projectPath, savePrompt]);

  return (
    <>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        className="bg-bg-primary border-border-subtle sm:max-w-lg"
        showCloseButton={false}
      >
        <CommandInput
          placeholder="Search prompts..."
          className="text-text-primary placeholder:text-text-muted"
        />
        <CommandList className="text-text-primary max-h-80">
          <CommandEmpty className="text-text-tertiary">
            No prompts found.{' '}
            <button
              onClick={handleNewPrompt}
              className="text-accent hover:underline cursor-pointer"
            >
              Create one
            </button>
          </CommandEmpty>

          {/* New prompt action */}
          <CommandGroup heading="Actions">
            <CommandItem onSelect={handleNewPrompt}>
              <Plus className="text-text-tertiary" />
              <span>New Prompt</span>
            </CommandItem>
          </CommandGroup>

          {/* Prompts by category */}
          {Array.from(grouped.entries()).map(([category, categoryPrompts]) => (
            <CommandGroup key={category} heading={category}>
              {categoryPrompts.map((prompt) => (
                <CommandItem
                  key={prompt.id}
                  value={`${prompt.title} ${prompt.content} ${prompt.tags.join(' ')}`}
                  onSelect={() => insertPrompt(prompt)}
                  className="group"
                >
                  <Send className="text-text-tertiary w-3.5 h-3.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-medium">{prompt.title}</span>
                      {prompt.tags.length > 0 && (
                        <span className="flex items-center gap-0.5 flex-shrink-0">
                          <Tag className="w-2.5 h-2.5 text-text-muted" />
                          <span className="text-[10px] text-text-muted truncate max-w-[100px]">
                            {prompt.tags.join(', ')}
                          </span>
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-text-tertiary truncate">
                      {prompt.content.slice(0, 80)}
                      {prompt.content.length > 80 ? '...' : ''}
                    </div>
                  </div>
                  {/* Action buttons — visible on hover */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); copyPrompt(prompt); }}
                      className="p-0.5 rounded hover:bg-bg-hover cursor-pointer"
                      title="Copy to clipboard"
                    >
                      <Copy className="w-3 h-3 text-text-tertiary" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleEditPrompt(prompt); }}
                      className="p-0.5 rounded hover:bg-bg-hover cursor-pointer"
                      title="Edit prompt"
                    >
                      <Pencil className="w-3 h-3 text-text-tertiary" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeletePrompt(prompt.id); }}
                      className="p-0.5 rounded hover:bg-bg-hover cursor-pointer"
                      title="Delete prompt"
                    >
                      <Trash2 className="w-3 h-3 text-error/60" />
                    </button>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>

      {/* Prompt editor dialog */}
      <Dialog open={showEditor} onOpenChange={(o) => { if (!o) { setShowEditor(false); setEditingPrompt(null); } }}>
        <DialogContent className="bg-bg-primary border-border-subtle text-text-primary sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {editingPrompt?.createdAt === editingPrompt?.updatedAt ? 'New Prompt' : 'Edit Prompt'}
            </DialogTitle>
          </DialogHeader>
          {editingPrompt && (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-text-secondary mb-1 block">Title</label>
                <Input
                  value={editingPrompt.title}
                  onChange={(e) => setEditingPrompt({ ...editingPrompt, title: e.target.value })}
                  placeholder="e.g. Fix TypeScript errors"
                  className="bg-bg-deep border-border-subtle text-text-primary text-xs"
                />
              </div>
              <div>
                <label className="text-xs text-text-secondary mb-1 block">Content</label>
                <Textarea
                  value={editingPrompt.content}
                  onChange={(e) => setEditingPrompt({ ...editingPrompt, content: e.target.value })}
                  placeholder="The prompt text to insert into terminal..."
                  rows={5}
                  className="bg-bg-deep border-border-subtle text-text-primary text-xs font-mono resize-y"
                />
                <p className="text-[10px] text-text-muted mt-1">
                  Variables: {'{{project}}'}, {'{{projectPath}}'}, {'{{file}}'}
                </p>
              </div>
              <div>
                <label className="text-xs text-text-secondary mb-1 block">Category</label>
                <Input
                  value={editingPrompt.category}
                  onChange={(e) => setEditingPrompt({ ...editingPrompt, category: e.target.value })}
                  placeholder="General"
                  className="bg-bg-deep border-border-subtle text-text-primary text-xs"
                />
              </div>
              <div>
                <label className="text-xs text-text-secondary mb-1 block">Tags (comma-separated)</label>
                <Input
                  value={editingPrompt.tags.join(', ')}
                  onChange={(e) =>
                    setEditingPrompt({
                      ...editingPrompt,
                      tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean),
                    })
                  }
                  placeholder="debug, typescript, fix"
                  className="bg-bg-deep border-border-subtle text-text-primary text-xs"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <button
              onClick={() => { setShowEditor(false); setEditingPrompt(null); }}
              className="px-3 py-1.5 text-xs rounded-md text-text-secondary hover:bg-bg-hover transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSavePrompt}
              disabled={!editingPrompt?.title.trim()}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-accent text-bg-deep hover:bg-accent/80 transition-colors disabled:opacity-40 cursor-pointer"
            >
              Save
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
