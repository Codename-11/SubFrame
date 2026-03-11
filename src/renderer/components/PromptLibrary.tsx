/**
 * PromptLibrary — Command-palette-style overlay for saved prompts.
 * Triggered by Ctrl+Shift+L. Fuzzy searches across title + content + tags,
 * inserts selected prompt into the active terminal via PTY write.
 * Supports both global (user-level) and project-level prompts.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Pencil, Send, Tag, Copy, Globe, FolderOpen, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner';
import { usePrompts } from '../hooks/usePrompts';
import { useTerminalStore } from '../stores/useTerminalStore';
import { useProjectStore } from '../stores/useProjectStore';
import type { SavedPrompt } from '../../shared/ipcChannels';
import {
  createBlankPrompt,
  insertPromptIntoTerminal,
  copyPromptToClipboard,
  parseTags,
  TEMPLATE_VARIABLES,
  TEMPLATE_VAR_REGEX,
} from '../lib/promptUtils';

type PromptScope = 'global' | 'project';

/** Highlight {{variable}} tokens in text with accent color */
function highlightVars(text: string, maxLen: number): React.ReactNode {
  const truncated = text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
  const parts = truncated.split(TEMPLATE_VAR_REGEX);
  const tokens = new Set(['project', 'projectPath', 'file']);
  return parts.map((part, i) =>
    tokens.has(part) ? (
      <span key={i} className="text-accent">{`{{${part}}}`}</span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

/** Scope badge component */
function ScopeBadge({ scope }: { scope: PromptScope }) {
  if (scope === 'global') {
    return (
      <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-medium bg-blue-900/60 text-blue-300 flex-shrink-0">
        <Globe className="w-2 h-2" />
        Global
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-medium bg-amber-900/60 text-amber-300 flex-shrink-0">
      <FolderOpen className="w-2 h-2" />
      Project
    </span>
  );
}

export function PromptLibrary() {
  const [open, setOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<SavedPrompt | null>(null);
  const [editingScope, setEditingScope] = useState<PromptScope>('project');
  const [showEditor, setShowEditor] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingScope, setDeletingScope] = useState<PromptScope>('project');

  const {
    prompts,
    globalPrompts,
    savePrompt,
    deletePrompt,
    saveGlobalPrompt,
    deleteGlobalPrompt,
    promoteToGlobal,
    demoteToProject,
  } = usePrompts();
  const activeTerminalId = useTerminalStore((s) => s.activeTerminalId);
  const projectPath = useProjectStore((s) => s.currentProjectPath);

  const allPrompts = useMemo(
    () => [...globalPrompts, ...prompts],
    [globalPrompts, prompts]
  );

  const deletingPrompt = allPrompts.find((p) => p.id === deletingId);

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

  // Listen for command palette trigger
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('open-prompt-library', handler);
    return () => window.removeEventListener('open-prompt-library', handler);
  }, []);

  // Group prompts by scope, then by category
  const groupedGlobal = useMemo(() => {
    const map = new Map<string, SavedPrompt[]>();
    for (const p of globalPrompts) {
      const cat = p.category || 'General';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(p);
    }
    return map;
  }, [globalPrompts]);

  const groupedProject = useMemo(() => {
    const map = new Map<string, SavedPrompt[]>();
    for (const p of prompts) {
      const cat = p.category || 'General';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(p);
    }
    return map;
  }, [prompts]);

  // Insert prompt text into active terminal
  const handleInsert = useCallback(
    (prompt: SavedPrompt) => {
      const ok = insertPromptIntoTerminal(prompt, activeTerminalId, projectPath);
      if (ok) {
        // Increment usage count in the appropriate store
        const scope = prompt.scope ?? 'project';
        if (scope === 'global') {
          saveGlobalPrompt.mutate([{ ...prompt, usageCount: (prompt.usageCount || 0) + 1 }]);
        } else if (projectPath) {
          savePrompt.mutate([{
            projectPath,
            prompt: { ...prompt, usageCount: (prompt.usageCount || 0) + 1 },
          }]);
        }
      }
      setOpen(false);
    },
    [activeTerminalId, projectPath, savePrompt, saveGlobalPrompt]
  );

  // Copy prompt to clipboard
  const handleCopy = useCallback((prompt: SavedPrompt) => {
    copyPromptToClipboard(prompt);
    setOpen(false);
  }, []);

  const handleNewPrompt = useCallback(() => {
    const blank = createBlankPrompt();
    setEditingPrompt(blank);
    // Default scope: 'project' if a project is open, else 'global'
    setEditingScope(projectPath ? 'project' : 'global');
    setShowEditor(true);
    setOpen(false);
  }, [projectPath]);

  const handleEditPrompt = useCallback((prompt: SavedPrompt) => {
    setEditingPrompt({ ...prompt });
    setEditingScope((prompt.scope ?? 'project') as PromptScope);
    setShowEditor(true);
    setOpen(false);
  }, []);

  const handleRequestDelete = useCallback((promptId: string, scope: PromptScope) => {
    setDeletingId(promptId);
    setDeletingScope(scope);
    setOpen(false);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (!deletingId) return;
    if (deletingScope === 'global') {
      deleteGlobalPrompt.mutate([deletingId]);
    } else if (projectPath) {
      deletePrompt.mutate([{ projectPath, promptId: deletingId }]);
    }
    setDeletingId(null);
    toast.success('Prompt deleted');
  }, [deletingId, deletingScope, projectPath, deletePrompt, deleteGlobalPrompt]);

  const handleSavePrompt = useCallback(() => {
    if (!editingPrompt || !editingPrompt.title.trim()) return;

    const promptToSave = { ...editingPrompt, scope: editingScope };

    // Determine if the scope changed from the original
    const originalScope = (editingPrompt.scope ?? 'project') as PromptScope;
    const isNewPrompt = editingPrompt.createdAt === editingPrompt.updatedAt;

    if (editingScope === 'global') {
      saveGlobalPrompt.mutate([promptToSave], {
        onSuccess: () => {
          // If scope changed from project to global, remove from project
          if (!isNewPrompt && originalScope === 'project' && projectPath) {
            deletePrompt.mutate([{ projectPath, promptId: editingPrompt.id }]);
          }
        },
      });
    } else if (projectPath) {
      savePrompt.mutate([{ projectPath, prompt: promptToSave }], {
        onSuccess: () => {
          // If scope changed from global to project, remove from global
          if (!isNewPrompt && originalScope === 'global') {
            deleteGlobalPrompt.mutate([editingPrompt.id]);
          }
        },
      });
    } else {
      toast.warning('No project selected', { description: 'Select a project to save project-level prompts.' });
      return;
    }

    setShowEditor(false);
    setEditingPrompt(null);
  }, [editingPrompt, editingScope, projectPath, savePrompt, saveGlobalPrompt, deletePrompt, deleteGlobalPrompt]);

  const handlePromote = useCallback((prompt: SavedPrompt) => {
    promoteToGlobal(prompt);
    toast.success('Promoted to global');
  }, [promoteToGlobal]);

  const handleDemote = useCallback((prompt: SavedPrompt) => {
    demoteToProject(prompt);
    toast.success('Moved to project');
  }, [demoteToProject]);

  /** Render a single prompt item in the command list */
  const renderPromptItem = (prompt: SavedPrompt, scope: PromptScope) => (
    <CommandItem
      key={prompt.id}
      value={`${prompt.title} ${prompt.content} ${prompt.tags.join(' ')} ${scope}`}
      onSelect={() => handleInsert(prompt)}
      className="group"
    >
      <Send className="text-text-tertiary w-3.5 h-3.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-medium">{prompt.title}</span>
          <ScopeBadge scope={scope} />
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
          {highlightVars(prompt.content, 80)}
        </div>
      </div>
      {/* Action buttons — visible on hover */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); handleCopy(prompt); }}
          className="p-0.5 rounded hover:bg-bg-hover cursor-pointer"
          title="Copy to clipboard"
        >
          <Copy className="w-3 h-3 text-text-tertiary" />
        </button>
        {/* Promote/Demote button */}
        {scope === 'project' && (
          <button
            onClick={(e) => { e.stopPropagation(); handlePromote(prompt); }}
            className="p-0.5 rounded hover:bg-bg-hover cursor-pointer"
            title="Promote to global"
          >
            <ArrowUpRight className="w-3 h-3 text-blue-400" />
          </button>
        )}
        {scope === 'global' && projectPath && (
          <button
            onClick={(e) => { e.stopPropagation(); handleDemote(prompt); }}
            className="p-0.5 rounded hover:bg-bg-hover cursor-pointer"
            title="Move to project"
          >
            <ArrowDownLeft className="w-3 h-3 text-amber-400" />
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); handleEditPrompt(prompt); }}
          className="p-0.5 rounded hover:bg-bg-hover cursor-pointer"
          title="Edit prompt"
        >
          <Pencil className="w-3 h-3 text-text-tertiary" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleRequestDelete(prompt.id, scope); }}
          className="p-0.5 rounded hover:bg-bg-hover cursor-pointer"
          title="Delete prompt"
        >
          <Trash2 className="w-3 h-3 text-error/60" />
        </button>
      </div>
    </CommandItem>
  );

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

          {/* Global Prompts */}
          {globalPrompts.length > 0 && (
            <>
              {Array.from(groupedGlobal.entries()).map(([category, categoryPrompts]) => (
                <CommandGroup
                  key={`global-${category}`}
                  heading={
                    <span className="flex items-center gap-1.5">
                      <Globe className="w-3 h-3 text-blue-400" />
                      <span>Global &mdash; {category}</span>
                    </span>
                  }
                >
                  {categoryPrompts.map((prompt) => renderPromptItem(prompt, 'global'))}
                </CommandGroup>
              ))}
            </>
          )}

          {/* Project Prompts */}
          {prompts.length > 0 && (
            <>
              {Array.from(groupedProject.entries()).map(([category, categoryPrompts]) => (
                <CommandGroup
                  key={`project-${category}`}
                  heading={
                    <span className="flex items-center gap-1.5">
                      <FolderOpen className="w-3 h-3 text-amber-400" />
                      <span>Project &mdash; {category}</span>
                    </span>
                  }
                >
                  {categoryPrompts.map((prompt) => renderPromptItem(prompt, 'project'))}
                </CommandGroup>
              ))}
            </>
          )}
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
                {/* Variable insert buttons */}
                <div className="flex items-center gap-1 mt-1">
                  {TEMPLATE_VARIABLES.map((v) => (
                    <button
                      key={v.token}
                      onClick={() => {
                        setEditingPrompt({
                          ...editingPrompt,
                          content: editingPrompt.content + v.token,
                        });
                      }}
                      className="px-1.5 py-0.5 rounded text-[9px] bg-accent/10 text-accent hover:bg-accent/20 transition-colors cursor-pointer"
                      title={v.description}
                    >
                      {v.token}
                    </button>
                  ))}
                </div>
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
                      tags: parseTags(e.target.value),
                    })
                  }
                  placeholder="debug, typescript, fix"
                  className="bg-bg-deep border-border-subtle text-text-primary text-xs"
                />
              </div>
              {/* Scope selector */}
              <div>
                <label className="text-xs text-text-secondary mb-1 block">Scope</label>
                <div className="flex rounded-md overflow-hidden border border-border-subtle">
                  <button
                    onClick={() => setEditingScope('global')}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                      editingScope === 'global'
                        ? 'bg-blue-900/60 text-blue-300'
                        : 'bg-bg-deep text-text-tertiary hover:text-text-secondary hover:bg-bg-hover'
                    }`}
                  >
                    <Globe className="w-3 h-3" />
                    Global
                  </button>
                  <button
                    onClick={() => {
                      if (!projectPath) {
                        toast.warning('No project selected', { description: 'Open a project to use project scope.' });
                        return;
                      }
                      setEditingScope('project');
                    }}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                      editingScope === 'project'
                        ? 'bg-amber-900/60 text-amber-300'
                        : 'bg-bg-deep text-text-tertiary hover:text-text-secondary hover:bg-bg-hover'
                    } ${!projectPath ? 'opacity-40 cursor-not-allowed' : ''}`}
                    disabled={!projectPath}
                  >
                    <FolderOpen className="w-3 h-3" />
                    Project
                  </button>
                </div>
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

      {/* Delete confirmation */}
      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent className="bg-bg-primary border-border-subtle text-text-primary">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Prompt</AlertDialogTitle>
            <AlertDialogDescription className="text-text-secondary text-xs">
              Delete &quot;{deletingPrompt?.title}&quot;? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-error text-white hover:bg-error/80 cursor-pointer"
              onClick={handleConfirmDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
