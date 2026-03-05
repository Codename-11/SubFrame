/**
 * SubFrame Theme System — Type definitions and built-in presets.
 *
 * Themes control CSS custom property values applied at runtime.
 * Users can select presets or create fully custom themes.
 */

/** All customizable CSS tokens in the SubFrame theme */
export interface ThemeTokens {
  // Surfaces
  bgDeep: string;
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  bgElevated: string;
  bgHover: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textMuted: string;

  // Primary accent (interactive elements)
  accent: string;
  accentSecondary: string;
  accentSubtle: string;    // rgba
  accentGlow: string;      // rgba

  // Neon traces (decorative/peripheral)
  neonPurple: string;
  neonPink: string;
  neonCyan: string;
  neonPurpleGlow: string;  // rgba
  neonPinkGlow: string;    // rgba
  neonCyanGlow: string;    // rgba

  // Status
  success: string;
  warning: string;
  error: string;
  info: string;

  // Borders
  borderSubtle: string;    // rgba
  borderDefault: string;   // rgba
  borderStrong: string;    // rgba

  // Feature toggles
  enableNeonTraces: boolean;   // Master toggle for synthwave touches
  enableScanlines: boolean;    // CRT scanline overlay
  enableLogoGlow: boolean;     // Sidebar logo ambient glow
}

/** A named theme preset or user-saved theme */
export interface ThemeDefinition {
  id: string;
  name: string;
  description: string;
  tokens: ThemeTokens;
  builtIn: boolean;          // true for presets, false for user-created
  createdAt?: string;        // ISO date for user themes
}

/** Appearance settings stored in frame-settings.json */
export interface AppearanceSettings {
  activeThemeId: string;           // ID of current theme
  customThemes: ThemeDefinition[]; // User-saved themes
}

/** Default appearance settings */
export const DEFAULT_APPEARANCE: AppearanceSettings = {
  activeThemeId: 'classic-amber',
  customThemes: [],
};

/** Classic Amber — the original SubFrame look */
export const THEME_CLASSIC_AMBER: ThemeDefinition = {
  id: 'classic-amber',
  name: 'Classic Amber',
  description: 'Warm amber accent on dark neutrals — the original SubFrame look.',
  builtIn: true,
  tokens: {
    bgDeep: '#0f0f10',
    bgPrimary: '#151516',
    bgSecondary: '#1a1a1c',
    bgTertiary: '#222225',
    bgElevated: '#28282c',
    bgHover: '#2e2e33',
    textPrimary: '#e8e6e3',
    textSecondary: '#a09b94',
    textTertiary: '#6b6660',
    textMuted: '#4a4642',
    accent: '#d4a574',
    accentSecondary: '#c9956a',
    accentSubtle: 'rgba(212, 165, 116, 0.15)',
    accentGlow: 'rgba(212, 165, 116, 0.08)',
    neonPurple: '#b480ff',
    neonPink: '#ff6eb4',
    neonCyan: '#64d8ff',
    neonPurpleGlow: 'rgba(180, 128, 255, 0.12)',
    neonPinkGlow: 'rgba(255, 110, 180, 0.10)',
    neonCyanGlow: 'rgba(100, 216, 255, 0.08)',
    success: '#7cb382',
    warning: '#e0a458',
    error: '#d47878',
    info: '#78a5d4',
    borderSubtle: 'rgba(255, 255, 255, 0.06)',
    borderDefault: 'rgba(255, 255, 255, 0.08)',
    borderStrong: 'rgba(255, 255, 255, 0.12)',
    enableNeonTraces: false,
    enableScanlines: false,
    enableLogoGlow: false,
  },
};

/** Synthwave Traces — warm amber + neon logo palette as accent traces */
export const THEME_SYNTHWAVE_TRACES: ThemeDefinition = {
  id: 'synthwave-traces',
  name: 'Synthwave Traces',
  description: 'Warm amber core with neon purple/pink/cyan traces — like glowing tubes in a Fallout terminal.',
  builtIn: true,
  tokens: {
    bgDeep: '#0f0f10',
    bgPrimary: '#151516',
    bgSecondary: '#1a1a1c',
    bgTertiary: '#222225',
    bgElevated: '#28282c',
    bgHover: '#2e2e33',
    textPrimary: '#e8e6e3',
    textSecondary: '#a09b94',
    textTertiary: '#6b6660',
    textMuted: '#4a4642',
    accent: '#d4a574',
    accentSecondary: '#c9956a',
    accentSubtle: 'rgba(212, 165, 116, 0.15)',
    accentGlow: 'rgba(212, 165, 116, 0.08)',
    neonPurple: '#b480ff',
    neonPink: '#ff6eb4',
    neonCyan: '#64d8ff',
    neonPurpleGlow: 'rgba(180, 128, 255, 0.12)',
    neonPinkGlow: 'rgba(255, 110, 180, 0.10)',
    neonCyanGlow: 'rgba(100, 216, 255, 0.08)',
    success: '#7cb382',
    warning: '#e0a458',
    error: '#d47878',
    info: '#78a5d4',
    borderSubtle: 'rgba(255, 255, 255, 0.06)',
    borderDefault: 'rgba(255, 255, 255, 0.08)',
    borderStrong: 'rgba(255, 255, 255, 0.12)',
    enableNeonTraces: true,
    enableScanlines: false,
    enableLogoGlow: true,
  },
};

/** Midnight Purple — purple-forward aesthetic */
export const THEME_MIDNIGHT_PURPLE: ThemeDefinition = {
  id: 'midnight-purple',
  name: 'Midnight Purple',
  description: 'Deep purple accent with cool blue undertones — for the synthwave purist.',
  builtIn: true,
  tokens: {
    bgDeep: '#0c0a12',
    bgPrimary: '#12101a',
    bgSecondary: '#181522',
    bgTertiary: '#201d2c',
    bgElevated: '#272435',
    bgHover: '#2e2b3d',
    textPrimary: '#e4e2ed',
    textSecondary: '#9b97b0',
    textTertiary: '#6b6680',
    textMuted: '#4a4660',
    accent: '#b480ff',
    accentSecondary: '#9b6be0',
    accentSubtle: 'rgba(180, 128, 255, 0.15)',
    accentGlow: 'rgba(180, 128, 255, 0.08)',
    neonPurple: '#b480ff',
    neonPink: '#ff6eb4',
    neonCyan: '#64d8ff',
    neonPurpleGlow: 'rgba(180, 128, 255, 0.15)',
    neonPinkGlow: 'rgba(255, 110, 180, 0.12)',
    neonCyanGlow: 'rgba(100, 216, 255, 0.10)',
    success: '#7cb382',
    warning: '#e0a458',
    error: '#d47878',
    info: '#78a5d4',
    borderSubtle: 'rgba(180, 128, 255, 0.06)',
    borderDefault: 'rgba(180, 128, 255, 0.08)',
    borderStrong: 'rgba(180, 128, 255, 0.14)',
    enableNeonTraces: true,
    enableScanlines: false,
    enableLogoGlow: true,
  },
};

/** Terminal Green — retro hacker terminal */
export const THEME_TERMINAL_GREEN: ThemeDefinition = {
  id: 'terminal-green',
  name: 'Terminal Green',
  description: 'Classic green phosphor terminal — full retro hacker aesthetic.',
  builtIn: true,
  tokens: {
    bgDeep: '#0a0f0a',
    bgPrimary: '#0f150f',
    bgSecondary: '#141c14',
    bgTertiary: '#1c261c',
    bgElevated: '#243024',
    bgHover: '#2c382c',
    textPrimary: '#c8e6c8',
    textSecondary: '#8aad8a',
    textTertiary: '#5c7a5c',
    textMuted: '#3d5a3d',
    accent: '#4ade80',
    accentSecondary: '#22c55e',
    accentSubtle: 'rgba(74, 222, 128, 0.12)',
    accentGlow: 'rgba(74, 222, 128, 0.06)',
    neonPurple: '#b480ff',
    neonPink: '#ff6eb4',
    neonCyan: '#64d8ff',
    neonPurpleGlow: 'rgba(180, 128, 255, 0.08)',
    neonPinkGlow: 'rgba(255, 110, 180, 0.06)',
    neonCyanGlow: 'rgba(100, 216, 255, 0.06)',
    success: '#4ade80',
    warning: '#e0a458',
    error: '#d47878',
    info: '#78a5d4',
    borderSubtle: 'rgba(74, 222, 128, 0.06)',
    borderDefault: 'rgba(74, 222, 128, 0.08)',
    borderStrong: 'rgba(74, 222, 128, 0.14)',
    enableNeonTraces: false,
    enableScanlines: true,
    enableLogoGlow: false,
  },
};

/** All built-in theme presets */
export const BUILTIN_THEMES: ThemeDefinition[] = [
  THEME_CLASSIC_AMBER,
  THEME_SYNTHWAVE_TRACES,
  THEME_MIDNIGHT_PURPLE,
  THEME_TERMINAL_GREEN,
];

/** Get a theme by ID (checks built-in first, then custom) */
export function getThemeById(id: string, customThemes: ThemeDefinition[] = []): ThemeDefinition | undefined {
  return BUILTIN_THEMES.find(t => t.id === id) ?? customThemes.find(t => t.id === id);
}

/** Map from ThemeTokens keys to CSS custom property names */
export const TOKEN_TO_CSS: Record<keyof ThemeTokens, string | null> = {
  bgDeep: '--color-bg-deep',
  bgPrimary: '--color-bg-primary',
  bgSecondary: '--color-bg-secondary',
  bgTertiary: '--color-bg-tertiary',
  bgElevated: '--color-bg-elevated',
  bgHover: '--color-bg-hover',
  textPrimary: '--color-text-primary',
  textSecondary: '--color-text-secondary',
  textTertiary: '--color-text-tertiary',
  textMuted: '--color-text-muted',
  accent: '--color-accent',
  accentSecondary: '--color-accent-secondary',
  accentSubtle: '--color-accent-subtle',
  accentGlow: '--color-accent-glow',
  neonPurple: '--color-neon-purple',
  neonPink: '--color-neon-pink',
  neonCyan: '--color-neon-cyan',
  neonPurpleGlow: '--color-neon-purple-glow',
  neonPinkGlow: '--color-neon-pink-glow',
  neonCyanGlow: '--color-neon-cyan-glow',
  success: '--color-success',
  warning: '--color-warning',
  error: '--color-error',
  info: '--color-info',
  borderSubtle: '--color-border-subtle',
  borderDefault: '--color-border-default',
  borderStrong: '--color-border-strong',
  enableNeonTraces: null,   // Feature toggles don't map to CSS vars
  enableScanlines: null,
  enableLogoGlow: null,
};
