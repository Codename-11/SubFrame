/**
 * ShortcutsPanel — Full-view panel for keyboard shortcuts.
 * Replaces the old dialog modal with a VS Code-style full-panel view.
 * Renders inside the TerminalArea full-view system (like TasksPanel, PipelinePanel).
 *
 * Auto-generated from the centralized shortcut registry (lib/shortcuts.ts).
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import { Search } from 'lucide-react';
import { getShortcutsByCategory } from '../lib/shortcuts';
import { Kbd } from './ui/kbd';

export function ShortcutsPanel() {
  const [filter, setFilter] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus search input on mount
  useEffect(() => {
    // Small delay to let the full-view animation start before focusing
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, []);

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

  // Total shortcut count for display
  const totalCount = useMemo(
    () => filteredCategories.reduce((sum, cat) => sum + cat.shortcuts.length, 0),
    [filteredCategories]
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Search bar */}
      <div className="shrink-0 px-6 py-4 border-b border-border-subtle bg-bg-secondary/50">
        <div className="max-w-2xl mx-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              ref={inputRef}
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Type to search shortcuts..."
              className="w-full pl-10 pr-4 py-2 text-sm rounded-md bg-bg-deep border border-border-subtle text-text-primary placeholder:text-text-muted outline-none focus:border-accent transition-colors"
            />
            {filter && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-text-muted">
                {totalCount} result{totalCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Shortcuts list */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
        <div className="max-w-2xl mx-auto">
          {filteredCategories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-text-muted">
              <Search className="w-8 h-8 mb-3 opacity-30" />
              <p className="text-sm">No shortcuts match &ldquo;{filter}&rdquo;</p>
              <button
                type="button"
                onClick={() => setFilter('')}
                className="mt-2 text-xs text-accent hover:text-accent/80 transition-colors cursor-pointer"
              >
                Clear search
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredCategories.map((category) => (
                <div key={category.title}>
                  {/* Category header */}
                  <h3 className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-2 pb-1.5 border-b border-border-subtle">
                    {category.title}
                    <span className="ml-2 text-text-muted font-normal normal-case tracking-normal">
                      ({category.shortcuts.length})
                    </span>
                  </h3>

                  {/* Shortcut rows */}
                  <div className="space-y-0.5">
                    {category.shortcuts.map((shortcut) => (
                      <div
                        key={shortcut.description}
                        className="flex items-center justify-between gap-4 px-3 py-1.5 rounded-md hover:bg-bg-hover transition-colors group"
                      >
                        <span className="text-xs text-text-secondary group-hover:text-text-primary transition-colors">
                          {shortcut.description}
                        </span>
                        <Kbd>{shortcut.keys}</Kbd>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
