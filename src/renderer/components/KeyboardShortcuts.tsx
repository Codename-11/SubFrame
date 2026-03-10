/**
 * KeyboardShortcuts — Dialog showing all available keyboard shortcuts.
 * Opened via Ctrl+? (Ctrl+Shift+/) or from useUIStore.shortcutsHelpOpen.
 *
 * Auto-generated from the centralized shortcut registry (lib/shortcuts.ts).
 */

import { useState, useMemo } from 'react';
import { Keyboard, Search } from 'lucide-react';
import { useUIStore } from '../stores/useUIStore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { getShortcutsByCategory } from '../lib/shortcuts';

function Kbd({ children }: { children: string }) {
  const parts = children.split('+');
  return (
    <span className="inline-flex items-center gap-0.5">
      {parts.map((part, i) => (
        <kbd
          key={i}
          className="inline-flex items-center justify-center min-w-[20px] px-1.5 py-0.5 text-[11px] font-mono bg-bg-deep border border-border-subtle rounded text-text-secondary"
        >
          {part}
        </kbd>
      ))}
    </span>
  );
}

export function KeyboardShortcuts() {
  const open = useUIStore((s) => s.shortcutsHelpOpen);
  const setOpen = useUIStore((s) => s.setShortcutsHelpOpen);
  const [filter, setFilter] = useState('');

  // Get categories from centralized registry
  const allCategories = useMemo(() => getShortcutsByCategory(), []);

  // Filter shortcuts by search term
  const filteredCategories = useMemo(() => {
    if (!filter.trim()) return allCategories;
    const q = filter.toLowerCase();
    return allCategories
      .map((cat) => ({
        ...cat,
        shortcuts: cat.shortcuts.filter(
          (s) =>
            s.description.toLowerCase().includes(q) ||
            s.keys.toLowerCase().includes(q) ||
            cat.title.toLowerCase().includes(q)
        ),
      }))
      .filter((cat) => cat.shortcuts.length > 0);
  }, [allCategories, filter]);

  // Reset filter when dialog closes
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setFilter('');
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-bg-primary border-border-subtle text-text-primary sm:max-w-2xl !flex !flex-col max-h-[80vh] overflow-hidden p-0">
        <DialogHeader className="shrink-0 px-6 pt-6 pb-0">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Keyboard className="w-4 h-4 text-accent" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="shrink-0 px-6 pt-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter shortcuts..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md bg-bg-deep border border-border-subtle text-text-primary placeholder:text-text-muted outline-none focus:border-accent transition-colors"
              autoFocus
            />
          </div>
        </div>

        {/* Shortcut grid */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
          {filteredCategories.length === 0 ? (
            <p className="text-xs text-text-muted py-6 text-center">No shortcuts match &ldquo;{filter}&rdquo;</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-5 py-3">
              {filteredCategories.map((category) => (
                <div key={category.title}>
                  <h3 className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-2.5 border-b border-border-subtle pb-1">
                    {category.title}
                  </h3>
                  <div className="space-y-2">
                    {category.shortcuts.map((shortcut) => (
                      <div
                        key={shortcut.keys}
                        className="flex items-center justify-between gap-3"
                      >
                        <span className="text-xs text-text-secondary truncate">{shortcut.description}</span>
                        <Kbd>{shortcut.keys}</Kbd>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
