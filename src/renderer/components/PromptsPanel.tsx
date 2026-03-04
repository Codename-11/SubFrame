/**
 * PromptsPanel — Right-panel view for saved prompts.
 * Shows prompts grouped by category with insert, copy, edit, and delete actions.
 * Complements the PromptLibrary overlay (Ctrl+Shift+L) with a persistent panel view.
 */

import { useCallback, useMemo, useState } from 'react';
import { Plus, Trash2, Pencil, Send, Copy, BookMarked } from 'lucide-react';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
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

export function PromptsPanel() {
  const { prompts, savePrompt, deletePrompt } = usePrompts();
  const activeTerminalId = useTerminalStore((s) => s.activeTerminalId);
  const projectPath = useProjectStore((s) => s.currentProjectPath);

  const [search, setSearch] = useState('');
  const [editingPrompt, setEditingPrompt] = useState<SavedPrompt | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  // Filter + group prompts
  const filtered = useMemo(() => {
    if (!search.trim()) return prompts;
    const q = search.toLowerCase();
    return prompts.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.content.toLowerCase().includes(q) ||
        p.tags?.some((t) => t.toLowerCase().includes(q))
    );
  }, [prompts, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, SavedPrompt[]>();
    for (const p of filtered) {
      const cat = p.category || 'General';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(p);
    }
    return map;
  }, [filtered]);

  const insertPrompt = useCallback(
    (prompt: SavedPrompt) => {
      if (!activeTerminalId) {
        toast.warning('No active terminal', { description: 'Open a terminal first.' });
        return;
      }
      let text = prompt.content;
      if (projectPath) {
        const projectName = projectPath.split(/[\\/]/).pop() || '';
        text = text.replace(/\{\{project\}\}/g, projectName);
        text = text.replace(/\{\{projectPath\}\}/g, projectPath);
      }
      const editorFile = useUIStore.getState().editorFilePath;
      text = text.replace(/\{\{file\}\}/g, editorFile || '');
      typedSend(IPC.TERMINAL_INPUT_ID, { terminalId: activeTerminalId, data: text });
      if (projectPath) {
        savePrompt.mutate([{ projectPath, prompt: { ...prompt, usageCount: (prompt.usageCount || 0) + 1 } }]);
      }
      toast.success('Inserted into terminal');
    },
    [activeTerminalId, projectPath, savePrompt]
  );

  const copyPrompt = useCallback((prompt: SavedPrompt) => {
    navigator.clipboard.writeText(prompt.content);
    toast.success('Copied to clipboard');
  }, []);

  const handleNew = useCallback(() => {
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
  }, []);

  const handleEdit = useCallback((prompt: SavedPrompt) => {
    setEditingPrompt({ ...prompt });
    setShowEditor(true);
  }, []);

  const handleDelete = useCallback(
    (promptId: string) => {
      if (!projectPath) return;
      deletePrompt.mutate([{ projectPath, promptId }]);
    },
    [projectPath, deletePrompt]
  );

  const handleSave = useCallback(() => {
    if (!editingPrompt || !projectPath || !editingPrompt.title.trim()) return;
    savePrompt.mutate([{ projectPath, prompt: editingPrompt }]);
    setShowEditor(false);
    setEditingPrompt(null);
  }, [editingPrompt, projectPath, savePrompt]);

  if (!projectPath) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-xs text-text-muted text-center">Select a project to manage prompts.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border-subtle shrink-0">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search prompts..."
          className="h-7 text-xs bg-bg-secondary border-border-subtle"
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={handleNew}
          className="h-7 px-2 shrink-0 text-text-tertiary hover:text-accent"
          title="New prompt"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Prompt list */}
      <ScrollArea className="flex-1">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-6 text-center">
            <BookMarked className="h-8 w-8 text-text-muted" />
            <p className="text-xs text-text-muted">
              {search ? 'No matching prompts.' : 'No prompts yet.'}
            </p>
            {!search && (
              <Button variant="outline" size="sm" onClick={handleNew} className="text-xs mt-1">
                <Plus className="h-3 w-3 mr-1" /> Create prompt
              </Button>
            )}
          </div>
        ) : (
          <div className="p-2 space-y-3">
            {Array.from(grouped.entries()).map(([category, items]) => (
              <div key={category}>
                <p className="text-[10px] uppercase tracking-wider text-text-muted px-1 mb-1">
                  {category}
                </p>
                <div className="space-y-1">
                  {items.map((prompt) => (
                    <div
                      key={prompt.id}
                      className="group rounded-md border border-border-subtle bg-bg-secondary hover:border-border-default transition-colors p-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-text-primary truncate">
                            {prompt.title}
                          </p>
                          <p className="text-[11px] text-text-tertiary mt-0.5 line-clamp-2 leading-relaxed">
                            {prompt.content}
                          </p>
                        </div>
                      </div>

                      {/* Tags */}
                      {prompt.tags && prompt.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {prompt.tags.map((tag) => (
                            <Badge key={tag} variant="outline" className="text-[9px] px-1 py-0 h-4">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* Actions — visible on hover */}
                      <div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => insertPrompt(prompt)}
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-success hover:bg-success/10 transition-colors cursor-pointer"
                          title="Insert into terminal"
                        >
                          <Send className="h-3 w-3" /> Insert
                        </button>
                        <button
                          onClick={() => copyPrompt(prompt)}
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer"
                          title="Copy to clipboard"
                        >
                          <Copy className="h-3 w-3" /> Copy
                        </button>
                        <button
                          onClick={() => handleEdit(prompt)}
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer"
                          title="Edit"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => handleDelete(prompt.id)}
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-text-tertiary hover:text-error hover:bg-error/10 transition-colors cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                        {prompt.usageCount > 0 && (
                          <span className="ml-auto text-[9px] text-text-muted">
                            used {prompt.usageCount}x
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Editor dialog */}
      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="bg-bg-primary border-border-subtle sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {editingPrompt?.createdAt === editingPrompt?.updatedAt ? 'New Prompt' : 'Edit Prompt'}
            </DialogTitle>
          </DialogHeader>
          {editingPrompt && (
            <div className="space-y-3">
              <Input
                value={editingPrompt.title}
                onChange={(e) => setEditingPrompt({ ...editingPrompt, title: e.target.value })}
                placeholder="Prompt title"
                className="text-sm"
              />
              <Textarea
                value={editingPrompt.content}
                onChange={(e) => setEditingPrompt({ ...editingPrompt, content: e.target.value })}
                placeholder="Prompt content... Use {{project}}, {{projectPath}}, {{file}} for variables"
                rows={6}
                className="text-sm font-mono"
              />
              <div className="flex gap-2">
                <Input
                  value={editingPrompt.category || ''}
                  onChange={(e) => setEditingPrompt({ ...editingPrompt, category: e.target.value })}
                  placeholder="Category"
                  className="text-sm flex-1"
                />
                <Input
                  value={editingPrompt.tags?.join(', ') || ''}
                  onChange={(e) =>
                    setEditingPrompt({
                      ...editingPrompt,
                      tags: e.target.value
                        .split(',')
                        .map((t) => t.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="Tags (comma-separated)"
                  className="text-sm flex-1"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setShowEditor(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!editingPrompt?.title.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
