/**
 * PromptsPanel — Right-panel view for saved prompts.
 * Shows prompts grouped by category with inline editing, tag filtering,
 * sort toggles, variable highlighting, keyboard navigation, and category rename.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus,
  Trash2,
  Pencil,
  Send,
  Copy,
  BookMarked,
  ArrowUpDown,
  Check,
  X,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
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
  sortPrompts,
  TEMPLATE_VARIABLES,
  TEMPLATE_VAR_REGEX,
  type PromptSortMode,
} from '../lib/promptUtils';

/** Highlight {{variable}} tokens in text with accent-colored spans */
function HighlightedContent({ text }: { text: string }) {
  const parts = text.split(TEMPLATE_VAR_REGEX);
  const tokens = new Set(['project', 'projectPath', 'file']);

  return (
    <>
      {parts.map((part, i) =>
        tokens.has(part) ? (
          <span key={i} className="text-accent font-medium">{`{{${part}}}`}</span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

export function PromptsPanel() {
  const { prompts, savePrompt, deletePrompt } = usePrompts();
  const activeTerminalId = useTerminalStore((s) => s.activeTerminalId);
  const projectPath = useProjectStore((s) => s.currentProjectPath);

  // Search and filter state
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<PromptSortMode>('usage');

  // Inline editor state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<SavedPrompt | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Delete confirmation state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const deletingPrompt = prompts.find((p) => p.id === deletingId);

  // Category rename state
  const [renamingCategory, setRenamingCategory] = useState<string | null>(null);
  const [categoryRenameValue, setCategoryRenameValue] = useState('');
  const categoryInputRef = useRef<HTMLInputElement>(null);

  // Collapsed categories
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  // Keyboard navigation
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const listRef = useRef<HTMLDivElement>(null);

  // Collect all unique tags for display
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const p of prompts) {
      p.tags?.forEach((t) => tagSet.add(t));
    }
    return Array.from(tagSet).sort();
  }, [prompts]);

  // Filter + sort prompts
  const filtered = useMemo(() => {
    let result = prompts;

    // Tag filter
    if (activeTag) {
      result = result.filter((p) => p.tags?.includes(activeTag));
    }

    // Text search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.content.toLowerCase().includes(q) ||
          p.tags?.some((t) => t.toLowerCase().includes(q))
      );
    }

    return sortPrompts(result, sortMode);
  }, [prompts, search, activeTag, sortMode]);

  // Group filtered prompts by category
  const grouped = useMemo(() => {
    const map = new Map<string, SavedPrompt[]>();
    for (const p of filtered) {
      const cat = p.category || 'General';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(p);
    }
    return map;
  }, [filtered]);

  // Flat list for keyboard navigation
  const flatList = useMemo(() => {
    const items: SavedPrompt[] = [];
    for (const [category, categoryPrompts] of grouped) {
      if (!collapsedCategories.has(category)) {
        items.push(...categoryPrompts);
      }
    }
    return items;
  }, [grouped, collapsedCategories]);

  // Insert prompt
  const handleInsert = useCallback(
    (prompt: SavedPrompt) => {
      const ok = insertPromptIntoTerminal(prompt, activeTerminalId, projectPath);
      if (ok && projectPath) {
        savePrompt.mutate([
          { projectPath, prompt: { ...prompt, usageCount: (prompt.usageCount || 0) + 1 } },
        ]);
      }
    },
    [activeTerminalId, projectPath, savePrompt]
  );

  // Start creating a new prompt (inline)
  const handleNew = useCallback(() => {
    const blank = createBlankPrompt();
    setEditDraft(blank);
    setEditingId(blank.id);
    setIsCreating(true);
  }, []);

  // Start editing an existing prompt (inline)
  const handleEdit = useCallback((prompt: SavedPrompt) => {
    setEditDraft({ ...prompt });
    setEditingId(prompt.id);
    setIsCreating(false);
  }, []);

  // Cancel editing
  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditDraft(null);
    setIsCreating(false);
  }, []);

  // Save edited/new prompt
  const handleSave = useCallback(() => {
    if (!editDraft || !projectPath || !editDraft.title.trim()) return;
    savePrompt.mutate([{ projectPath, prompt: editDraft }]);
    setEditingId(null);
    setEditDraft(null);
    setIsCreating(false);
    toast.success(isCreating ? 'Prompt created' : 'Prompt saved');
  }, [editDraft, projectPath, savePrompt, isCreating]);

  // Confirm delete
  const handleConfirmDelete = useCallback(() => {
    if (!deletingId || !projectPath) return;
    deletePrompt.mutate([{ projectPath, promptId: deletingId }]);
    setDeletingId(null);
    toast.success('Prompt deleted');
  }, [deletingId, projectPath, deletePrompt]);

  // Category rename — save
  const handleCategoryRename = useCallback(() => {
    if (!renamingCategory || !categoryRenameValue.trim() || !projectPath) return;
    const newName = categoryRenameValue.trim();
    if (newName === renamingCategory) {
      setRenamingCategory(null);
      return;
    }
    // Batch update all prompts in this category
    const inCategory = prompts.filter((p) => (p.category || 'General') === renamingCategory);
    for (const p of inCategory) {
      savePrompt.mutate([{ projectPath, prompt: { ...p, category: newName } }]);
    }
    setRenamingCategory(null);
    toast.success(`Renamed category to "${newName}"`);
  }, [renamingCategory, categoryRenameValue, prompts, projectPath, savePrompt]);

  // Toggle category collapse
  const toggleCategory = useCallback((category: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }, []);

  // Focus category rename input when it opens
  useEffect(() => {
    if (renamingCategory && categoryInputRef.current) {
      categoryInputRef.current.focus();
      categoryInputRef.current.select();
    }
  }, [renamingCategory]);

  // Keyboard navigation
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    const handler = (e: KeyboardEvent) => {
      // Only handle when list area has focus
      if (!el.contains(document.activeElement) && document.activeElement !== el) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((i) => Math.min(i + 1, flatList.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && focusedIndex >= 0 && focusedIndex < flatList.length) {
        e.preventDefault();
        handleInsert(flatList[focusedIndex]);
      } else if (e.key === 'e' && focusedIndex >= 0 && focusedIndex < flatList.length && !editingId) {
        e.preventDefault();
        handleEdit(flatList[focusedIndex]);
      }
    };

    el.addEventListener('keydown', handler);
    return () => el.removeEventListener('keydown', handler);
  }, [flatList, focusedIndex, editingId, handleInsert, handleEdit]);

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
        {/* Sort dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 shrink-0 text-text-tertiary hover:text-text-primary"
              title="Sort prompts"
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-bg-tertiary border-border-subtle" align="end">
            <DropdownMenuRadioGroup value={sortMode} onValueChange={(v) => setSortMode(v as PromptSortMode)}>
              <DropdownMenuRadioItem value="usage" className="text-xs cursor-pointer">
                Most used
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="updated" className="text-xs cursor-pointer">
                Recently updated
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="alpha" className="text-xs cursor-pointer">
                Alphabetical
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
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

      {/* Tag filter bar */}
      {allTags.length > 0 && (
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border-subtle overflow-x-auto shrink-0">
          {activeTag && (
            <button
              onClick={() => setActiveTag(null)}
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] bg-accent/15 text-accent hover:bg-accent/25 transition-colors cursor-pointer shrink-0"
              title="Clear filter"
            >
              <X className="h-2.5 w-2.5" />
              Clear
            </button>
          )}
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              className={`px-1.5 py-0.5 rounded text-[9px] transition-colors cursor-pointer shrink-0 ${
                activeTag === tag
                  ? 'bg-accent/20 text-accent border border-accent/30'
                  : 'bg-bg-secondary text-text-muted hover:text-text-secondary border border-transparent hover:border-border-subtle'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Prompt list */}
      <ScrollArea className="flex-1">
        <div ref={listRef} tabIndex={0} className="outline-none">
          {/* Inline create form at top */}
          {isCreating && editDraft && (
            <div className="p-2">
              <InlineEditor
                draft={editDraft}
                onChange={setEditDraft}
                onSave={handleSave}
                onCancel={handleCancelEdit}
                isNew
              />
            </div>
          )}

          {filtered.length === 0 && !isCreating ? (
            <div className="flex flex-col items-center justify-center gap-2 p-6 text-center">
              <BookMarked className="h-8 w-8 text-text-muted" />
              <p className="text-xs text-text-muted">
                {search || activeTag ? 'No matching prompts.' : 'No prompts yet.'}
              </p>
              {!search && !activeTag && (
                <Button variant="outline" size="sm" onClick={handleNew} className="text-xs mt-1">
                  <Plus className="h-3 w-3 mr-1" /> Create prompt
                </Button>
              )}
            </div>
          ) : (
            <div className="p-2 space-y-3">
              {Array.from(grouped.entries()).map(([category, items]) => (
                <div key={category}>
                  {/* Category header */}
                  <div className="flex items-center gap-1 px-1 mb-1 group">
                    <button
                      onClick={() => toggleCategory(category)}
                      className="flex items-center gap-0.5 text-[10px] uppercase tracking-wider text-text-muted hover:text-text-secondary transition-colors cursor-pointer"
                    >
                      {collapsedCategories.has(category) ? (
                        <ChevronRight className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )}
                      {renamingCategory === category ? null : category}
                    </button>

                    {renamingCategory === category ? (
                      <div className="flex items-center gap-1 flex-1">
                        <input
                          ref={categoryInputRef}
                          value={categoryRenameValue}
                          onChange={(e) => setCategoryRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCategoryRename();
                            if (e.key === 'Escape') setRenamingCategory(null);
                          }}
                          className="text-[10px] uppercase tracking-wider bg-bg-secondary border border-border-subtle rounded px-1 py-0.5 text-text-primary outline-none w-24"
                        />
                        <button
                          onClick={handleCategoryRename}
                          className="p-0.5 text-success hover:bg-success/10 rounded cursor-pointer"
                        >
                          <Check className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => setRenamingCategory(null)}
                          className="p-0.5 text-text-muted hover:bg-bg-hover rounded cursor-pointer"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setRenamingCategory(category);
                          setCategoryRenameValue(category);
                        }}
                        className="p-0.5 opacity-0 group-hover:opacity-100 text-text-muted hover:text-text-secondary transition-all cursor-pointer"
                        title="Rename category"
                      >
                        <Pencil className="h-2.5 w-2.5" />
                      </button>
                    )}

                    <span className="text-[9px] text-text-muted ml-auto">
                      {items.length}
                    </span>
                  </div>

                  {/* Category items */}
                  {!collapsedCategories.has(category) && (
                    <div className="space-y-1">
                      {items.map((prompt) => {
                        const flatIdx = flatList.indexOf(prompt);
                        const isFocused = flatIdx === focusedIndex;
                        const isEditing = editingId === prompt.id && !isCreating;

                        if (isEditing && editDraft) {
                          return (
                            <InlineEditor
                              key={prompt.id}
                              draft={editDraft}
                              onChange={setEditDraft}
                              onSave={handleSave}
                              onCancel={handleCancelEdit}
                            />
                          );
                        }

                        return (
                          <div
                            key={prompt.id}
                            className={`group rounded-md border transition-colors p-2 ${
                              isFocused
                                ? 'border-accent/40 bg-accent/5'
                                : 'border-border-subtle bg-bg-secondary hover:border-border-default'
                            }`}
                            onClick={() => setFocusedIndex(flatIdx)}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium text-text-primary truncate">
                                  {prompt.title}
                                </p>
                                <p className="text-[11px] text-text-tertiary mt-0.5 line-clamp-2 leading-relaxed">
                                  <HighlightedContent text={prompt.content} />
                                </p>
                              </div>
                            </div>

                            {/* Tags — clickable for filtering */}
                            {prompt.tags && prompt.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {prompt.tags.map((tag) => (
                                  <Badge
                                    key={tag}
                                    variant="outline"
                                    className={`text-[9px] px-1 py-0 h-4 cursor-pointer transition-colors ${
                                      activeTag === tag
                                        ? 'border-accent/40 text-accent bg-accent/10'
                                        : 'hover:border-accent/30 hover:text-accent'
                                    }`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveTag(activeTag === tag ? null : tag);
                                    }}
                                  >
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            )}

                            {/* Actions — visible on hover */}
                            <div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleInsert(prompt)}
                                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-success hover:bg-success/10 transition-colors cursor-pointer"
                                title="Insert into terminal (Enter)"
                              >
                                <Send className="h-3 w-3" /> Insert
                              </button>
                              <button
                                onClick={() => copyPromptToClipboard(prompt)}
                                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer"
                                title="Copy to clipboard"
                              >
                                <Copy className="h-3 w-3" /> Copy
                              </button>
                              <button
                                onClick={() => handleEdit(prompt)}
                                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer"
                                title="Edit (e)"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => setDeletingId(prompt.id)}
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
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

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
    </div>
  );
}

// ── Inline Editor Component ──────────────────────────────────────────────────

interface InlineEditorProps {
  draft: SavedPrompt;
  onChange: (draft: SavedPrompt) => void;
  onSave: () => void;
  onCancel: () => void;
  isNew?: boolean;
}

function InlineEditor({ draft, onChange, onSave, onCancel, isNew }: InlineEditorProps) {
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  return (
    <div className="rounded-md border border-accent/30 bg-bg-secondary p-2.5 space-y-2">
      <div className="text-[10px] uppercase tracking-wider text-accent mb-1">
        {isNew ? 'New Prompt' : 'Editing'}
      </div>

      <Input
        ref={titleRef}
        value={draft.title}
        onChange={(e) => onChange({ ...draft, title: e.target.value })}
        placeholder="Prompt title"
        className="h-7 text-xs bg-bg-deep border-border-subtle"
        onKeyDown={(e) => {
          if (e.key === 'Escape') onCancel();
        }}
      />

      <div className="relative">
        <Textarea
          value={draft.content}
          onChange={(e) => onChange({ ...draft, content: e.target.value })}
          placeholder="Prompt content..."
          rows={4}
          className="text-xs font-mono bg-bg-deep border-border-subtle resize-y"
          onKeyDown={(e) => {
            if (e.key === 'Escape') onCancel();
          }}
        />
        {/* Variable insert buttons */}
        <div className="flex items-center gap-1 mt-1">
          {TEMPLATE_VARIABLES.map((v) => (
            <button
              key={v.token}
              onClick={() => {
                // Insert at cursor position or append
                onChange({ ...draft, content: draft.content + v.token });
              }}
              className="px-1.5 py-0.5 rounded text-[9px] bg-accent/10 text-accent hover:bg-accent/20 transition-colors cursor-pointer"
              title={v.description}
            >
              {v.token}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <Input
          value={draft.category || ''}
          onChange={(e) => onChange({ ...draft, category: e.target.value })}
          placeholder="Category"
          className="h-7 text-xs bg-bg-deep border-border-subtle flex-1"
        />
        <Input
          value={draft.tags?.join(', ') || ''}
          onChange={(e) => onChange({ ...draft, tags: parseTags(e.target.value) })}
          placeholder="Tags (comma-separated)"
          className="h-7 text-xs bg-bg-deep border-border-subtle flex-1"
        />
      </div>

      <div className="flex items-center gap-1.5 pt-1">
        <Button
          size="sm"
          onClick={onSave}
          disabled={!draft.title.trim()}
          className="h-6 px-2.5 text-[10px] bg-accent text-bg-deep hover:bg-accent/80 cursor-pointer"
        >
          <Check className="h-3 w-3 mr-1" />
          Save
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="h-6 px-2.5 text-[10px] cursor-pointer"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
