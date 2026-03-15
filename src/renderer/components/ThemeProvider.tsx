import { useEffect } from 'react';
import { useSettings } from '../hooks/useSettings';
import {
  type ThemeTokens,
  type ThemeDefinition,
  THEME_CLASSIC_AMBER,
  getThemeById,
  TOKEN_TO_CSS,
} from '../../shared/themeTypes';
import { refreshTerminalThemes } from '../lib/terminalRegistry';

/**
 * ThemeProvider reads the active theme from settings and applies
 * CSS custom properties to document.documentElement at runtime.
 *
 * Also manages data-* attributes for feature toggles (neon traces, scanlines).
 * Mount once in the app root — no context needed, uses useSettings() directly.
 */
export function ThemeProvider() {
  const { settings } = useSettings();

  useEffect(() => {
    const appearance = (settings?.appearance as Record<string, unknown>) || {};
    const activeId = (appearance.activeThemeId as string) || 'classic-amber';
    const customThemes = (appearance.customThemes as ThemeDefinition[]) || [];
    const theme = getThemeById(activeId, customThemes) ?? THEME_CLASSIC_AMBER;

    const root = document.documentElement;

    // Apply CSS custom properties
    const entries = Object.entries(TOKEN_TO_CSS) as [keyof ThemeTokens, string | null][];
    for (const [tokenKey, cssVar] of entries) {
      if (cssVar === null) continue; // Feature toggles, not CSS vars
      const value = theme.tokens[tokenKey];
      if (typeof value === 'string') {
        root.style.setProperty(cssVar, value);
      }
    }

    // Also update shadcn/ui mapped tokens that reference SubFrame tokens
    // These need to stay in sync when accent/surfaces change
    root.style.setProperty('--color-background', theme.tokens.bgDeep);
    root.style.setProperty('--color-foreground', theme.tokens.textPrimary);
    root.style.setProperty('--color-card', theme.tokens.bgPrimary);
    root.style.setProperty('--color-card-foreground', theme.tokens.textPrimary);
    root.style.setProperty('--color-popover', theme.tokens.bgSecondary);
    root.style.setProperty('--color-popover-foreground', theme.tokens.textPrimary);
    root.style.setProperty('--color-primary', theme.tokens.accent);
    root.style.setProperty('--color-primary-foreground', theme.tokens.bgDeep);
    root.style.setProperty('--color-secondary', theme.tokens.bgTertiary);
    root.style.setProperty('--color-secondary-foreground', theme.tokens.textPrimary);
    root.style.setProperty('--color-muted', theme.tokens.bgTertiary);
    root.style.setProperty('--color-muted-foreground', theme.tokens.textTertiary);
    root.style.setProperty('--color-accent-foreground', theme.tokens.textPrimary);
    root.style.setProperty('--color-destructive', theme.tokens.error);
    root.style.setProperty('--color-border', theme.tokens.borderDefault);
    root.style.setProperty('--color-input', theme.tokens.borderDefault);

    // Feature toggle resolution — independent settings override theme defaults
    const neonTraces = appearance.enableNeonTraces !== undefined
      ? !!appearance.enableNeonTraces
      : !!theme.tokens.enableNeonTraces;
    const scanlines = appearance.enableScanlines !== undefined
      ? !!appearance.enableScanlines
      : !!theme.tokens.enableScanlines;
    const logoGlow = appearance.enableLogoGlow !== undefined
      ? !!appearance.enableLogoGlow
      : !!theme.tokens.enableLogoGlow;

    // Neon-specific overrides — swap accent tokens to neon purple when active
    if (neonTraces) {
      root.style.setProperty('--color-ring', `color-mix(in srgb, ${theme.tokens.neonPurple} 30%, transparent)`);
      root.style.setProperty('--color-accent', theme.tokens.neonPurple);
      root.style.setProperty('--color-accent-subtle', `color-mix(in srgb, ${theme.tokens.neonPurple} 15%, transparent)`);
      root.style.setProperty('--color-accent-glow', `color-mix(in srgb, ${theme.tokens.neonPurple} 12%, transparent)`);
      root.style.setProperty('--color-primary', theme.tokens.neonPurple);
      root.style.setProperty('--shadow-glow', `0 0 20px color-mix(in srgb, ${theme.tokens.neonPurple} 15%, transparent)`);
    } else {
      root.style.setProperty('--color-ring', `color-mix(in srgb, ${theme.tokens.accent} 30%, transparent)`);
      root.style.setProperty('--shadow-glow', `0 0 20px ${theme.tokens.accentGlow}`);
    }

    if (neonTraces) {
      root.setAttribute('data-neon-traces', '');
    } else {
      root.removeAttribute('data-neon-traces');
    }

    if (scanlines) {
      root.setAttribute('data-scanlines', '');
    } else {
      root.removeAttribute('data-scanlines');
    }

    if (logoGlow) {
      root.setAttribute('data-logo-glow', '');
    } else {
      root.removeAttribute('data-logo-glow');
    }

    // Sync terminal cursor/selection colors with the new accent
    refreshTerminalThemes();
  }, [settings]);

  return null; // No visual output — pure side-effect component
}
