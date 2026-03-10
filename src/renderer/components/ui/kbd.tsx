import { cn } from '../../lib/utils';

interface KbdProps {
  children: string;
  /** Compact variant for use in dropdown menus and tight spaces */
  compact?: boolean;
  className?: string;
}

/**
 * Kbd — Renders keyboard shortcut text as styled <kbd> badges.
 * Splits on "+" to render each key individually (e.g. "Ctrl+Alt+1" → three badges).
 */
export function Kbd({ children, compact = false, className }: KbdProps) {
  const parts = children.split('+');
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)}>
      {parts.map((part, i) => (
        <kbd
          key={i}
          className={cn(
            'inline-flex items-center justify-center font-mono bg-bg-deep border border-border-subtle rounded text-text-secondary',
            compact
              ? 'min-w-[16px] px-1 py-0 text-[9px]'
              : 'min-w-[20px] px-1.5 py-0.5 text-[11px]'
          )}
        >
          {part}
        </kbd>
      ))}
    </span>
  );
}
