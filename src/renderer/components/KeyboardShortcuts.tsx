/**
 * KeyboardShortcuts — Modal overlay showing all available keyboard shortcuts.
 * Opened via Ctrl+? (Ctrl+Shift+/) or from useUIStore.shortcutsHelpOpen.
 */

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useUIStore } from '../stores/useUIStore';
import { ScrollArea } from './ui/scroll-area';

interface ShortcutEntry {
  keys: string;
  description: string;
}

interface ShortcutCategory {
  title: string;
  shortcuts: ShortcutEntry[];
}

const SHORTCUT_CATEGORIES: ShortcutCategory[] = [
  {
    title: 'Sidebar',
    shortcuts: [
      { keys: 'Ctrl+B', description: 'Toggle sidebar' },
      { keys: 'Ctrl+E', description: 'Focus projects' },
      { keys: 'Ctrl+Shift+E', description: 'Focus file tree' },
    ],
  },
  {
    title: 'Panels',
    shortcuts: [
      { keys: 'Ctrl+Shift+S', description: 'Sub-Tasks' },
      { keys: 'Ctrl+Shift+A', description: 'Agent Activity' },
      { keys: 'Ctrl+Shift+P', description: 'Plugins' },
      { keys: 'Ctrl+Shift+H', description: 'History' },
    ],
  },
  {
    title: 'Terminal',
    shortcuts: [
      { keys: 'Ctrl+Shift+T', description: 'New terminal' },
      { keys: 'Ctrl+Shift+W', description: 'Close terminal' },
      { keys: 'Ctrl+Tab', description: 'Next terminal' },
      { keys: 'Ctrl+Shift+Tab', description: 'Previous terminal' },
      { keys: 'Ctrl+1-9', description: 'Jump to terminal' },
      { keys: 'Ctrl+Shift+G', description: 'Toggle grid view' },
      { keys: 'Ctrl+Shift+O', description: 'Toggle overview' },
      { keys: 'Ctrl+Shift+K', description: 'Toggle tasks full-view' },
    ],
  },
  {
    title: 'Navigation',
    shortcuts: [
      { keys: 'Ctrl+Shift+[', description: 'Previous project' },
      { keys: 'Ctrl+Shift+]', description: 'Next project' },
    ],
  },
  {
    title: 'Other',
    shortcuts: [
      { keys: 'Ctrl+,', description: 'Settings' },
      { keys: 'Ctrl+?', description: 'This help' },
    ],
  },
];

function Kbd({ children }: { children: string }) {
  // Split on + to render each key segment separately
  const parts = children.split('+');
  return (
    <span className="inline-flex items-center gap-1">
      {parts.map((part, i) => (
        <kbd
          key={i}
          className="inline-flex items-center px-1.5 py-0.5 text-[11px] font-mono bg-bg-deep border border-border-subtle rounded text-text-secondary"
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

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [open, setOpen]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="shortcuts-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
          onClick={() => setOpen(false)}
        >
          <motion.div
            key="shortcuts-card"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="bg-bg-primary border border-border-subtle rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-subtle shrink-0">
              <h2 className="text-sm font-semibold text-text-primary">Keyboard Shortcuts</h2>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <ScrollArea className="flex-1 px-5 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {SHORTCUT_CATEGORIES.map((category) => (
                  <div key={category.title}>
                    <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">
                      {category.title}
                    </h3>
                    <div className="space-y-1.5">
                      {category.shortcuts.map((shortcut) => (
                        <div
                          key={shortcut.keys}
                          className="flex items-center justify-between gap-3"
                        >
                          <span className="text-xs text-text-secondary">{shortcut.description}</span>
                          <Kbd>{shortcut.keys}</Kbd>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
