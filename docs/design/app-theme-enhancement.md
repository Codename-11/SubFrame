# SubFrame App Theme Enhancement Proposal

## Philosophy: Warm Amber + Synthwave Traces

The app keeps its warm, earthy soul — amber `#d4a574` as the primary accent, DM Sans typography, muted neutral surfaces. But we introduce **subtle neon-synthwave touches** inspired by the logo palette, like finding glowing vacuum tubes inside a weathered Fallout terminal.

The logo colors (purple/pink/cyan) appear as **energy traces** — scanline effects, focus glows, status indicators, and decorative accents — not as the dominant theme. Think "retrotech warmth with neon undercurrent."

---

## Token Changes (`globals.css`)

### New Tokens (add to `@theme`)

```css
/* Synthwave accent traces — from the logo palette */
--color-neon-purple: #b480ff;
--color-neon-pink: #ff6eb4;
--color-neon-cyan: #64d8ff;
--color-neon-purple-glow: rgba(180, 128, 255, 0.12);
--color-neon-pink-glow: rgba(255, 110, 180, 0.10);
--color-neon-cyan-glow: rgba(100, 216, 255, 0.08);
--color-neon-gradient: linear-gradient(135deg, #b480ff, #ff6eb4, #64d8ff);

/* CRT scanline overlay (optional, very subtle) */
--color-scanline: rgba(255, 255, 255, 0.015);
```

### Unchanged (keep as-is)

```css
/* These stay — they ARE SubFrame's identity */
--color-accent: #d4a574;           /* Primary amber accent */
--color-accent-secondary: #c9956a; /* Hover amber */
--color-bg-*: ...                  /* All surface colors stay */
--color-text-*: ...                /* All text colors stay */
--color-border-*: ...              /* All borders stay */
```

---

## Where Neon Appears (Surgical Touches)

### 1. Focus Rings — Purple Glow

Currently: `--color-ring: rgba(212, 165, 116, 0.3)` (amber)

**Proposal:** Focus rings get a purple neon glow instead of amber. This creates a subtle "powered on" feeling when navigating with keyboard.

```css
--color-ring: rgba(180, 128, 255, 0.3);
```

Alternatively, a dual-tone ring:
```css
/* Focus ring = thin purple outline + faint pink outer glow */
box-shadow: 0 0 0 2px var(--color-neon-purple-glow), 0 0 8px var(--color-neon-pink-glow);
```

### 2. Active Tab Indicators — Gradient Underline

Currently: Active terminal tabs likely use amber.

**Proposal:** The active tab indicator (bottom border/underline) uses the logo gradient `purple → pink → cyan`. This is the most visible neon touch — a thin 2px gradient bar under the active tab.

```css
.tab-active::after {
  background: var(--color-neon-gradient);
  height: 2px;
}
```

### 3. Terminal Cursor — Pink Pulse

Currently: Cursor is likely amber or white.

**Proposal:** Terminal cursor blinks pink `#ff6eb4` with a faint glow. Gives each terminal that "live neon sign" energy.

```css
/* In xterm.js theme config */
cursor: '#ff6eb4',
cursorAccent: '#0f0f10',
```

### 4. Scrollbar Thumb on Hover — Cyan Hint

Currently: `rgba(255, 255, 255, 0.18)` on hover.

**Proposal:** Scrollbar thumb hover gets a faint cyan tint:

```css
*::-webkit-scrollbar-thumb:hover {
  background: rgba(100, 216, 255, 0.18);
}
```

### 5. Selection Highlight — Purple

Currently: Likely uses default or amber.

**Proposal:** Text selection uses purple background, matching the docs site.

```css
::selection {
  background: rgba(180, 128, 255, 0.35);
  color: #fafafa;
}
```

### 6. Status Indicators — Logo Color Mapping

Map agent/process states to the neon palette:

| State | Current | Proposed |
|-------|---------|----------|
| Active/Running | Green | Cyan `#64d8ff` (or keep green) |
| Thinking/Processing | Amber pulse | Purple `#b480ff` pulse |
| Error | Red | Keep red `#d47878` |
| Success | Green | Keep green `#7cb382` |
| Idle | Gray | Gray (unchanged) |

### 7. Sidebar Logo Glow — Enhanced

The sidebar already shows the animated atom logo. **Proposal:** Add a very subtle ambient glow behind it that pulses slowly — `box-shadow: 0 0 20px var(--color-neon-pink-glow)` with a slow CSS animation. Makes the logo feel alive in context.

### 8. Command Palette Input — Gradient Border on Focus

Currently: Standard border.

**Proposal:** When the command palette input is focused, the border shifts to a subtle gradient or purple glow:

```css
.command-palette-input:focus {
  border-color: var(--color-neon-purple);
  box-shadow: 0 0 0 1px var(--color-neon-purple-glow), 0 0 12px var(--color-neon-purple-glow);
}
```

### 9. Scanline Overlay (Optional — Very Subtle)

A faint CRT scanline texture across the app background, at 1-2% opacity. Adds subliminal retro texture without affecting readability.

```css
.app-root::after {
  content: '';
  position: fixed;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    var(--color-scanline) 2px,
    var(--color-scanline) 4px
  );
  pointer-events: none;
  z-index: 9999;
}
```

### 10. Loading/Progress Bars — Gradient Fill

Currently: Probably amber or white.

**Proposal:** Any progress indicators use the logo gradient as their fill. This echoes the splash screen loading bar in `logo-mockups.html` which already uses `linear-gradient(90deg, #b480ff, #ff6eb4)`.

---

## What Does NOT Change

- **Primary accent color** — Amber `#d4a574` stays for buttons, links, badges, active states
- **Surface colors** — All `bg-*` tokens unchanged
- **Text hierarchy** — All `text-*` tokens unchanged
- **Border system** — All `border-*` tokens unchanged
- **Typography** — DM Sans + JetBrains Mono stays
- **Component structure** — No layout changes
- **shadcn/ui tokens** — `--color-primary` stays amber

---

## Visual Summary

```
┌─────────────────────────────────────────────┐
│  WARM AMBER (unchanged)     NEON TRACES     │
│  ─────────────────────      ───────────     │
│  Links, buttons, badges     Focus rings     │
│  Active sidebar items       Tab indicators  │
│  Code highlights            Terminal cursor  │
│  Hover states               Scrollbar hover │
│  Primary CTA                Selection bg    │
│  Toast/notification accent  Progress bars   │
│  Section headers            Logo glow       │
│                             Agent status    │
│                             Cmd palette     │
│                             Scanlines (opt) │
└─────────────────────────────────────────────┘
```

The amber is **what you interact with**. The neon is **what breathes underneath**.

---

## Implementation Order

1. Add neon tokens to `globals.css` (zero visual change)
2. Focus ring + selection color (immediate subtle impact)
3. Active tab gradient indicator
4. Terminal cursor pink
5. Scrollbar hover cyan
6. Command palette focus glow
7. Loading bar gradients
8. Status indicator mapping (if desired)
9. Scanline overlay (experimental — try it, might be too much)
