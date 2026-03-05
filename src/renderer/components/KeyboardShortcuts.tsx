/**
 * KeyboardShortcuts — Dialog showing all available keyboard shortcuts.
 * Opened via Ctrl+? (Ctrl+Shift+/) or from useUIStore.shortcutsHelpOpen.
 */

import { Keyboard } from 'lucide-react';
import { useUIStore } from '../stores/useUIStore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

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
      { keys: 'Ctrl+Shift+G', description: 'GitHub Issues' },
      { keys: 'Ctrl+Shift+X', description: 'Plugins' },
      { keys: 'Ctrl+Shift+H', description: 'History' },
      { keys: 'Ctrl+Shift+Y', description: 'Pipeline' },
    ],
  },
  {
    title: 'Terminal',
    shortcuts: [
      { keys: 'Ctrl+Shift+Enter', description: 'Start AI tool' },
      { keys: 'Ctrl+Shift+T', description: 'New terminal' },
      { keys: 'Ctrl+Shift+W', description: 'Close terminal' },
      { keys: 'Ctrl+Tab', description: 'Next terminal' },
      { keys: 'Ctrl+Shift+Tab', description: 'Previous terminal' },
      { keys: 'Ctrl+1-9', description: 'Jump to terminal' },
      { keys: 'Ctrl+G', description: 'Toggle grid view' },
      { keys: 'Ctrl+F', description: 'Search in terminal' },
      { keys: 'Ctrl+Shift+O', description: 'Toggle overview' },
      { keys: 'Ctrl+Shift+K', description: 'Toggle tasks full-view' },
      { keys: 'Ctrl+Shift+Y', description: 'Toggle pipeline full-view' },
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
      { keys: 'Ctrl+/', description: 'Command palette' },
      { keys: 'Ctrl+Shift+P', description: 'Command palette (alt)' },
      { keys: 'Ctrl+Shift+L', description: 'Prompt library' },
      { keys: 'Ctrl+,', description: 'Settings' },
      { keys: 'Ctrl+Shift+/', description: 'This help' },
      { keys: 'F11', description: 'Toggle editor fullscreen' },
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="bg-bg-primary border-border-subtle text-text-primary sm:max-w-2xl !flex !flex-col max-h-[80vh] overflow-hidden p-0">
        <DialogHeader className="shrink-0 px-6 pt-6">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Keyboard className="w-4 h-4 text-accent" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 py-2">
            {SHORTCUT_CATEGORIES.map((category) => (
              <div key={category.title}>
                <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wide mb-2">
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
